/**
 * How the shell loads the client half: the bundle patch, the entry's exports, and
 * the two-member `require`.
 *
 * Every test here guards a failure that took down the whole entry at boot.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  CLIENT_CHUNK, PACKAGE, ROOT, SEED_WORDS,
  allChunkFiles, boot, bootRun, expectedChunkOrder, featureChunkFiles, readCode, requiredChunkFiles, test,
} from './harness.mjs'

test('the entry bundle parses, registers and exports the loader face', () => {
  const { exports } = boot()
  assert.equal(typeof exports.apply, 'function')
  assert.equal(typeof exports.name, 'string')
  // The array comes from another vm realm; compare contents, not the reference.
  assert.deepEqual([...exports.inject], ['slots', 'locale'])
})

test('apply() runs to completion, as the shell requires at boot', async () => {
  // Two regressions this guards, both of which failed the whole entry:
  //
  //  - apply used to throw `styles is not defined`, because the `styles` builtin
  //    belongs to the dynamic client-half path, not to a `__ModuleLoader__` bundle;
  //  - apply used to throw `require("…/client.core.js") missed the module table`,
  //    because the shell's `require` is a synchronous seed-word lookup and a sibling
  //    chunk must go through `require.async`.
  const result = await bootRun()
  assert.ok(result.effects.length > 0, 'apply must install at least one effect')
  assert.equal(result.cache.size, allChunkFiles().length,
    'every chunk file must load — one per feature, plus the core')
})

test('the bundle patch registers exactly one row, on the bare package name', () => {
  // Two shell constraints, verified against the `client-modules` source, that are
  // easy to violate and invisible until the plugin fails to boot:
  //
  //  - ONE client half per package: the registry resolves `exports["./client"]`
  //    (singular) and `parseDshClient` accepts no `components` field;
  //  - the client half binds to the BARE package name: a subpath row carries none.
  const patch = fs.readFileSync(path.join(ROOT, 'cordis.patch.yml'), 'utf8')
  const rows = [...patch.matchAll(/^\s*-\s+id:\s*(\S+)\s*$/gm)].map(m => m[1])
  const names = [...patch.matchAll(/^\s*name:\s*'?([^'\s]+)'?\s*$/gm)].map(m => m[1])

  assert.equal(rows.length, 1, `the patch must insert exactly one row, found ${rows.length}`)
  assert.deepEqual(names, [PACKAGE], `the row must name the bare package; got ${names.join(', ')}`)
  assert.ok(rows.every(id => !id.includes('/')), 'a row id must not be a subpath')
})

test('every chunk filename satisfies the loader naming rule', () => {
  for (const file of allChunkFiles()) {
    assert.match(file, CLIENT_CHUNK, `${file} is not a valid client chunk name`)
  }
})

test('the entry requires exactly the chunks that exist on disk', async () => {
  const { cache } = await bootRun()
  const required = [...cache.keys()].sort()
  assert.deepEqual(required, allChunkFiles(),
    'a chunk on disk that nothing requires is dead code; a required chunk that is missing will not load')
  for (const [file, entry] of cache) assert.ok(entry.exports, `${file} resolved to nothing`)

  // And the declared order, not just the set: core first, then the features.
  // Compared by content so the assertion does not encode a sort order.
  const declared = expectedChunkOrder()
  assert.equal(declared[0], './client.core.js', 'the core chunk must load first')
  assert.deepEqual(
    declared.slice(1).map(name => name.slice('./'.length)).sort(),
    requiredChunkFiles(),
    'CHUNKS must list every feature chunk exactly once, after the core',
  )
})

test('every chunk name in CHUNKS is relative and matches the chunk rule', () => {
  const block = /const CHUNKS = \[([\s\S]*?)\]/.exec(readCode('client.js'))
  assert.ok(block, 'CHUNKS must be locatable')
  const names = [...block[1].matchAll(/'([^']+)'/g)].map(m => m[1])
  assert.ok(names.length > 0, 'CHUNKS must not be empty')
  for (const name of names) {
    assert.ok(name.startsWith('./'), `${name} must be relative — require.async rejects a package specifier`)
    assert.match(name.slice(2), CLIENT_CHUNK, `${name} does not match the shell's chunk rule`)
  }
})

test('chunks are reached through require.async, never the synchronous require', async () => {
  // The specific mistake: a package-scoped require compiles fine, resolves fine
  // under Node's own resolver, and passes a lenient harness — then fails in the
  // browser with `missed the module table`.
  const { requireImpl, cache } = await bootRun()
  const sync = requireImpl.calls.filter(call => call.kind === 'sync')

  assert.ok(sync.length > 0, 'react must be required synchronously')
  for (const { spec } of sync) {
    assert.ok(SEED_WORDS.has(spec), `sync require of "${spec}" would miss the module table`)
  }
  // Every sync require must be a platform seed word, and the set is small enough to
  // name: react for every chunk, plus the UI primitives a feature needs in order to
  // render. Both are answered by the shell's seeded module table — the host's own
  // client bundles require them exactly this way — so neither misses it.
  // A package the plugin itself ships must never appear here: that is the mistake
  // this test exists to catch, and the SEED_WORDS check above is what enforces it.
  assert.deepEqual([...new Set(sync.map(call => call.spec))].sort(),
    ['@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-primitives', 'react'],
    'only the seeded platform modules may be required synchronously')

  // The entry fetches each chunk in declaration order. The feature chunks then ask
  // for core again, already materialized — so those repeats must be cache hits.
  const asyncSpecs = requireImpl.calls.filter(call => call.kind === 'async').map(call => call.spec)
  assert.deepEqual([...new Set(asyncSpecs)], expectedChunkOrder(),
    'chunks must be fetched through require.async, in declaration order')
  assert.equal(cache.size, allChunkFiles().length,
    'core must be materialized exactly once despite the repeat requests each feature makes')
})

test('no chunk uses the synchronous require to reach the core', () => {
  // The feature chunks were the second place this went wrong: each reached for the
  // core synchronously at factory time, which is the same miss.
  // The core is a feature-chunk responsibility; declaration-only chunks are owned
  // by their feature and export data rather than booting the registry.
  for (const file of featureChunkFiles()) {
    const source = readCode(file)
    assert.doesNotMatch(source, /require\(\s*['"`]dsh-plus-plus\//,
      `${file} must not require a chunk synchronously — use require.async on the core chunk`)
    assert.match(source, /require\.async\(\s*['"]\.\/client\.core\.js['"]\s*\)/,
      `${file} must reach core through require.async`)
  }
  for (const file of allChunkFiles().filter(name => name.endsWith('.css.js'))) {
    const source = readCode(file)
    assert.doesNotMatch(source, /require\(\s*['"`]dsh-plus-plus\//,
      `${file} must not require a chunk synchronously`)
    assert.doesNotMatch(source, /require\.async\(\s*['"]\.\/client\.core\.js['"]\s*\)/,
      `${file} is a declaration chunk and must not boot the feature registry`)
  }
})

test('the bundle references no free variable the loader does not provide', () => {
  // `__ModuleLoader__` factories receive only `require` plus page globals. Any other
  // bare identifier resolves to a page global or throws at boot.
  for (const file of ['client.js', ...allChunkFiles()]) {
    const source = readCode(file)
    for (const builtin of ['styles', 'host', 'harness']) {
      // A negative lookbehind for anything that would make this a property
      // access, so `ctx.styles` and `'styles'` are not flagged.
      const pattern = '(?<![.\\w$\'"\\x60])' + builtin + '\\s*\\.'
      assert.doesNotMatch(source, new RegExp(pattern),
        `${file}: ${builtin} is not provided to a __ModuleLoader__ bundle`)
    }
  }
})
