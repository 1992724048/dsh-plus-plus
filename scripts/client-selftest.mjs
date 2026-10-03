/**
 * Client-side self test.
 *
 * The browser half is a set of hand-written ModuleLoader bundles with no test
 * runner and no module graph, so this loads them the way the shell does — one
 * shared `require` that resolves sibling chunks — and asserts what the shell
 * requires of them and what the features promise.
 *
 * Run: `node scripts/client-selftest.mjs`
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const PACKAGE = 'dsh-plus-plus'

/** The loader's own chunk-naming rule, copied so a change upstream is visible. */
const CLIENT_CHUNK = /^client\.[A-Za-z0-9][A-Za-z0-9._-]*\.js$/

const noop = () => {}
const tests = []
const test = (name, fn) => tests.push([name, fn])

// ── harness ──────────────────────────────────────────────────────────────────

/**
 * Evaluate one bundle in a fresh realm and return its registration.
 *
 * `styleTags` is passed in rather than created here: every chunk runs in its own
 * realm with its own `document`, but they all have to append into one list, or the
 * test would only ever see the tags the *entry* realm inserted and silently miss
 * everything a feature chunk contributed.
 */
function evaluate(fileName, requireImpl, styleTags) {
  let registration
  const sandbox = {
    window: { __ModuleLoader__: { load: value => { registration = value } } },
    console,
    // Only what a real page provides. Notably no `styles`: that builtin belongs to
    // the dynamic client-half path, not to a `__ModuleLoader__` bundle, whose
    // factory receives just `require`.
    document: {
      documentElement: { lang: 'zh' },
      createElement: tag => (tag === 'style'
        ? { tag, textContent: '', setAttribute: noop, remove: () => { styleTags.pop() } }
        : {}),
      head: { appendChild: node => { styleTags.push(node); return node } },
    },
    fetch: async () => ({ ok: true, status: 200 }),
    setInterval: noop,
    clearInterval: noop,
  }
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(path.join(ROOT, fileName), 'utf8'), sandbox, { filename: fileName })
  assert.ok(registration, `${fileName} did not call __ModuleLoader__.load`)
  return { registration, sandbox }
}

/** A stub client context that records every effect and slot registration. */
function stubContext() {
  const effects = []
  const slots = []
  const dictionaries = []
  const ctx = {
    effect(fn, label) {
      const dispose = fn()
      effects.push(label)
      return typeof dispose === 'function' ? dispose : noop
    },
    locale: {
      register(ns, dicts) { dictionaries.push({ ns, dicts }); return noop },
      bind: ns => (key) => dictsLookup?.[key] ?? key,
    },
    slots: {
      inject(key, callback) { callback(); return noop },
      register(options, component) { slots.push(options); return noop },
    },
  }
  return { ctx, effects, slots, dictionaries }
}

let dictsLookup = {}

/** The shell's platform seed list, verbatim. `require` answers only these. */
const SEED_WORDS = new Set([
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
  '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
])

/**
 * A `require` that models the shell's exactly, because the difference *is* the bug.
 *
 * The shell hands a factory a `require` with two very different members:
 *
 *  - `require(spec)` is a **synchronous module-table lookup**. It answers only a
 *    platform seed word or an already-materialized graph row and throws
 *    `missed the module table` for anything else. A sibling chunk is neither — which
 *    is why `require('dsh-plus-plus/client.core.js')` fails the entry at boot, and
 *    why an earlier harness here that accepted any specifier hid that failure.
 *  - `require.async(spec)` is the chunk path. It accepts only a relative `./name.js`
 *    matching `client.*.js`, and returns a promise.
 */
function makeRequire(cache, styleTags) {
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: initial => [initial, noop],
    useEffect: noop,
  }

  const loadChunk = file => {
    assert.match(file, CLIENT_CHUNK, `"${file}" is not a valid client chunk name`)
    if (cache.has(file)) return cache.get(file).exports
    // Seed before evaluating so a cycle sees a placeholder rather than recursing;
    // the real exports replace it below.
    cache.set(file, { exports: {} })
    cache.set(file, { exports: evaluate(file, syncRequire, styleTags).registration.factory(syncRequire) })
    return cache.get(file).exports
  }

  const syncRequire = spec => {
    requireImpl.calls.push({ kind: 'sync', spec })
    if (spec === 'react') return React
    if (SEED_WORDS.has(spec)) {
      throw new Error(`seed word "${spec}" has no test implementation`)
    }
    const record = cache.get(spec)
    if (record !== undefined) return record.exports
    throw new Error(
      `client-modules: require("${spec}") missed the module table — not a platform seed word, `
      + 'not a materialized module, and no registered package factory',
    )
  }

  syncRequire.async = async spec => {
    requireImpl.calls.push({ kind: 'async', spec })
    if (!spec.startsWith('./')) throw new Error(`client-modules: invalid relative chunk request "${spec}"`)
    return loadChunk(spec.slice(2))
  }

  /** Every `require` / `require.async` call, in order, for the assertions below. */
  syncRequire.calls = []

  const requireImpl = syncRequire
  return requireImpl
}

/**
 * Boot the whole client half: the entry, its core, and every feature chunk.
 *
 * `boot()` resolves the entry's exports but does **not** run `apply` — the chunk
 * loads are async, so each test awaits `run()` itself. Returning a promise-shaped
 * result and forgetting to await it is exactly the mistake that made the original
 * failure invisible, so it is made explicit here.
 */
function boot() {
  const cache = new Map()
  // One tag list for every realm, so feature chunks' stylesheets are visible too.
  const styleTags = []
  const requireImpl = makeRequire(cache, styleTags)

  const { registration } = evaluate('client.js', requireImpl, styleTags)
  const exports = registration.factory(requireImpl)
  const stub = stubContext()

  return {
    exports,
    stub,
    styleTags,
    cache,
    requireImpl,
    /** Run `apply` and resolve once every chunk has loaded. */
    run: () => exports.apply(stub.ctx),
  }
}

/** Boot and run in one step, for the many assertions that only need the end state. */
async function bootRun() {
  const result = boot()
  await result.run()
  return result
}

/** Every stylesheet text the boot inserted, concatenated. */
function allCss(styleTags) {
  return styleTags.map(node => node.textContent ?? '').join('\n')
}

// ── tests ────────────────────────────────────────────────────────────────────

test('the entry bundle parses, registers and exports the loader face', () => {
  const { exports } = boot()
  assert.equal(typeof exports.apply, 'function')
  assert.equal(typeof exports.name, 'string')
  // The array comes from another vm realm; compare contents, not the reference.
  assert.deepEqual([...exports.inject], ['slots', 'locale'])
})

test('apply() runs to completion, as the shell requires at boot', async () => {
  // Two regressions this guards, both of which failed the whole entry in the shell:
  //
  //  - `apply` used to throw `styles is not defined`, because the `styles` builtin
  //    belongs to the dynamic client-half path, not to a `__ModuleLoader__` bundle.
  //  - `apply` used to throw `require("…/client.core.js") missed the module table`,
  //    because the shell's `require` is a synchronous seed-word lookup and a sibling
  //    chunk must go through `require.async`.
  //
  // The stub models both faithfully, so reaching this assertion is itself the test;
  // say it anyway so a failure names the cause.
  const result = await bootRun()
  assert.ok(result.stub.effects.length > 0, 'apply must install at least one effect')
  assert.equal(result.cache.size, 3, 'all three chunks must have loaded')
})

test('chunks are reached through require.async, never the synchronous require', async () => {
  // The specific mistake: `require('dsh-plus-plus/client.core.js')` compiles fine,
  // resolves fine under Node's own resolver, and passes a lenient harness — then
  // fails in the browser with `missed the module table`. Assert the entry only ever
  // calls the async member for a chunk.
  const { requireImpl, cache } = await bootRun()
  const sync = requireImpl.calls.filter(call => call.kind === 'sync')

  assert.ok(sync.length > 0, 'react must be required synchronously')
  for (const { spec } of sync) {
    assert.ok(SEED_WORDS.has(spec), `sync require of "${spec}" would miss the module table`)
  }
  assert.deepEqual([...new Set(sync.map(call => call.spec))], ['react'],
    'the only synchronous require must be the react seed word')

  // The entry fetches each chunk in declaration order. The feature chunks then ask
  // for core again, which is already materialized by then — so those repeats must
  // be cache hits, not new fetches. Assert first-occurrence order and the count.
  const asyncSpecs = requireImpl.calls.filter(call => call.kind === 'async').map(call => call.spec)
  assert.deepEqual([...new Set(asyncSpecs)], ['./client.core.js', './client.font.js', './client.shape.js'],
    'chunks must be fetched through require.async, in declaration order')
  assert.equal(cache.size, 3, 'core must be materialized exactly once despite the repeat requests')
})

test('every chunk name in CHUNKS is relative and matches the chunk rule', async () => {
  const source = fs.readFileSync(path.join(ROOT, 'client.js'), 'utf8')
  const block = /const CHUNKS = \[([\s\S]*?)\]/.exec(source)
  assert.ok(block, 'CHUNKS must be locatable')
  const names = [...block[1].matchAll(/'([^']+)'/g)].map(m => m[1])
  assert.ok(names.length > 0, 'CHUNKS must not be empty')
  for (const name of names) {
    assert.ok(name.startsWith('./'), `${name} must be relative — require.async rejects a package specifier`)
    assert.match(name.slice(2), CLIENT_CHUNK, `${name} does not match the shell's chunk rule`)
  }
  // The core chunk must come first: the entry reads it as loaded[0].
  assert.equal(names[0], './client.core.js', 'the core chunk must load first')
})

test('no chunk uses the synchronous require to reach the core', async () => {
  // The feature chunks were the second place this went wrong: they each did
  // `require('dsh-plus-plus/client.core.js')` at factory time, which is the same
  // miss. They must go through `require.async` too.
  for (const file of ['client.font.js', 'client.shape.js']) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
    assert.doesNotMatch(source, /require\(\s*['"`]dsh-plus-plus\//,
      `${file} must not require a chunk synchronously — use require.async('./client.core.js')`)
    assert.match(source, /require\.async\(\s*['"]\.\/client\.core\.js['"]\s*\)/,
      `${file} must reach core through require.async`)
  }
})

test('the bundle references no free variable the loader does not provide', () => {
  // `__ModuleLoader__` factories receive only `require` plus page globals. Any
  // other bare identifier resolves to a page global or throws at boot.
  //
  // Comments are stripped first: prose like "served by the host" would otherwise
  // match `host.` and fail a test about code.
  const files = ['client.js', 'client.core.js', 'client.font.js', 'client.shape.js']
  for (const file of files) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
    for (const builtin of ['styles', 'host', 'harness']) {
      // A negative lookbehind for anything that would make this a property
      // access, so `ctx.styles` and `'styles'` are not flagged.
      const pattern = '(?<![.\\w$\'"\\x60])' + builtin + '\\s*\\.'
      assert.doesNotMatch(source, new RegExp(pattern),
        `${file}: ${builtin} is not provided to a __ModuleLoader__ bundle`)
    }
  }
})

test('the bundle patch registers exactly one row, on the bare package name', () => {
  // Two shell constraints, verified against the `client-modules` source, that are
  // easy to violate and invisible until the plugin fails to boot:
  //
  //  - ONE client half per package: the registry resolves `exports["./client"]`
  //    (singular) and `parseDshClient` accepts no `components` field.
  //  - the client half binds to the BARE package name: a subpath row carries none.
  const patch = fs.readFileSync(path.join(ROOT, 'cordis.patch.yml'), 'utf8')
  const rows = [...patch.matchAll(/^\s*-\s+id:\s*(\S+)\s*$/gm)].map(m => m[1])
  const names = [...patch.matchAll(/^\s*name:\s*'?([^'\s]+)'?\s*$/gm)].map(m => m[1])

  assert.equal(rows.length, 1, `the patch must insert exactly one row, found ${rows.length}`)
  assert.deepEqual(names, [PACKAGE], `the row must name the bare package; got ${names.join(', ')}`)
  assert.ok(rows.every(id => !id.includes('/')), 'a row id must not be a subpath')
})

test('every chunk filename satisfies the loader naming rule', () => {
  for (const file of fs.readdirSync(ROOT).filter(name => /^client\..*\.js$/.test(name))) {
    assert.match(file, CLIENT_CHUNK, `${file} is not a valid client chunk name`)
  }
})

test('the entry requires exactly the chunks that exist on disk', async () => {
  const { requireImpl, cache } = await bootRun()
  const required = [...cache.keys()].sort()
  const onDisk = fs.readdirSync(ROOT).filter(name => /^client\..*\.js$/.test(name)).sort()
  assert.deepEqual(required, onDisk,
    'a chunk on disk that nothing requires is dead code; a required chunk that is missing will not load')
  // Every required chunk must have resolved to something.
  for (const [file, entry] of cache) assert.ok(entry.exports, `${file} resolved to nothing`)
})

test('core is loaded once and is a singleton across chunks', async () => {
  const { cache } = await bootRun()
  const coreEntries = [...cache.entries()].filter(([file]) => file === 'client.core.js')
  assert.equal(coreEntries.length, 1, 'core must be a single module')
  const core = cache.get('client.core.js').exports
  assert.equal(typeof core.defineFeature, 'function')
  assert.equal(typeof core.registerStyles, 'function')
  assert.equal(typeof core.dictionaries, 'function')
})

test('each feature chunk declares exactly one complete feature', async () => {
  const { cache } = await bootRun()
  const core = cache.get('client.core.js').exports
  const declared = core.listFeatures()
  const featureChunks = [...cache.keys()].filter(file => file !== 'client.core.js')

  assert.equal(declared.length, featureChunks.length, 'one feature per chunk')
  for (const file of featureChunks) {
    const id = file.replace(/^client\.|\.js$/g, '')
    const feature = declared.find(entry => entry.id === id)
    assert.ok(feature, `${file} should declare "${id}"; got ${declared.map(f => f.id).join(', ')}`)
    assert.equal(typeof feature.apply, 'function', `${id} must provide apply()`)
    assert.ok(feature.css.trim().length > 0, `${id} must contribute a stylesheet`)
    assert.equal(typeof feature.settings, 'function', `${id} must contribute a settings section`)
    assert.deepEqual([...Object.keys(feature.locale ?? {})].sort(), ['en', 'zh'], `${id} needs both halves`)
    assert.deepEqual(
      [...Object.keys(feature.locale.zh)].sort(),
      [...Object.keys(feature.locale.en)].sort(),
      `${id}'s dictionary halves must carry the same keys`,
    )
  }
})

test('features boot in ascending order', async () => {
  // Features share a stylesheet, so at equal specificity the later rule wins.
  // `shape` must therefore come after `font`, or a font rule could re-introduce a
  // rounded corner.
  const { cache } = await bootRun()
  const orders = [...cache.get('client.core.js').exports.listFeatures()].map(f => f.order)
  assert.deepEqual([...orders], [...orders].sort((a, b) => a - b), 'listFeatures() must be ordered')
})

test('core rejects a duplicate feature id', async () => {
  const { cache } = await bootRun()
  const core = cache.get('client.core.js').exports
  assert.throws(() => core.defineFeature({ id: 'font' }), /duplicate feature id/,
    'a second feature claiming an id must throw rather than shadow the first')
  assert.throws(() => core.defineFeature({}), /needs a string id/)
})

test('core rejects an unbalanced dictionary, naming the key', async () => {
  const { cache } = await bootRun()
  const core = cache.get('client.core.js').exports
  assert.throws(
    () => core.dictionaries('x', { zh: { a: '1', b: '2' }, en: { a: '1' } }),
    /out of balance — missing b/,
    'locale.register would fail in the browser with no clue which key; name it here',
  )
})

test('the merged dictionary is balanced across every feature', async () => {
  const { stub } = await bootRun()
  const entry = stub.dictionaries.find(d => d.ns === 'settings.plusPlus')
  assert.ok(entry, 'the entry must register its namespace')
  assert.deepEqual([...Object.keys(entry.dicts)].sort(), ['en', 'zh'])
  // Each feature's keys must appear under its own prefix.
  assert.ok('font.font.title' in entry.dicts.zh, 'font keys must be prefixed')
  assert.ok('shape.shape.title' in entry.dicts.zh, 'shape keys must be prefixed')
  assert.ok('nav' in entry.dicts.zh, 'the entry keeps its own unprefixed keys')
})

test('the settings page composes one section per feature', async () => {
  const { stub, cache } = await bootRun()
  const page = stub.slots.find(entry => entry.id === 'dsh-plus-plus')
  assert.ok(page, 'the settings section must register')
  assert.equal(page.locale, 'settings.plusPlus')

  const features = cache.get('client.core.js').exports.listFeatures()
  assert.equal(
    features.filter(f => typeof f.settings === 'function').length,
    features.length,
    'every feature must contribute a settings section',
  )
})

test('each effect is registered exactly once', async () => {
  // Regression: the entry wrapped `core.registerStyles` in a second `ctx.effect`,
  // and since `registerStyles` already opens one, the label appeared twice and the
  // disposer chain nested. Harmless today, but the kind of drift that hides a real
  // bug later — so assert the log has no duplicates.
  const { effects } = (await bootRun()).stub
  const seen = new Map()
  for (const label of effects) seen.set(label, (seen.get(label) ?? 0) + 1)
  for (const [label, count] of seen) {
    assert.equal(count, 1, `effect "${label}" registered ${count} times`)
  }
})

test('every @import points at a route the host actually serves', async () => {
  const { styleTags } = await bootRun()
  const css = allCss(styleTags)
  const imports = [...css.matchAll(/@import url\("([^"]+)"\)/g)].map(m => m[1])
  assert.ok(imports.length > 0, 'the stylesheet must import the packaged faces')

  for (const href of imports) {
    assert.ok(href.startsWith('/api/dsh-plus-plus/fonts/'), `${href} must sit under the font route`)
    const rest = href.slice('/api/dsh-plus-plus/fonts/'.length).split('/')
    const family = rest.shift()
    assert.ok(['jetbrains-mono', 'harmonyos-sans-sc'].includes(family), `${family} is not a served family`)
    // The stylesheet the browser fetches next must exist in the repo's node_modules.
    const root = path.resolve(ROOT, 'node_modules', family === 'jetbrains-mono'
      ? '@fontsource/jetbrains-mono'
      : 'harmonyos-sans-webfont-splitted/dist/HarmonyOS_Sans_SC')
    const file = path.resolve(root, rest.join('/'))
    assert.ok(file.startsWith(root + path.sep), `${href} must stay inside ${family}`)
    assert.ok(fs.existsSync(file), `${href} does not exist on disk`)
  }
})

test('the host font variables are re-pointed at our stacks', async () => {
  // Regression: the first version wrote `html, body { font-family }`, which any
  // class selector outranks — the sidebar changed but the conversation did not.
  const css = allCss((await bootRun()).styleTags)
  const declared = (name) => new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(css)?.[1]?.trim()

  assert.equal(declared('--dsw-font-family'), 'var(--pp-font-sans)')
  assert.equal(declared('--ds-font-family-code'), 'var(--pp-font-mono)')
  assert.match(declared('--pp-font-mono') ?? '', /^'JetBrains Mono'/)
  assert.match(declared('--pp-font-sans') ?? '', /^'HarmonyOS Sans'/)
  assert.doesNotMatch(css, /^\s*html\s*,/m, 'an `html, body` rule loses to any class selector')
})

test('all six host radius tokens are zeroed', async () => {
  const css = allCss((await bootRun()).styleTags)
  const declared = (name) => new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(css)?.[1]?.trim()
  for (const token of ['xs', 'sm', 'md', 'lg', 'xl', 'panel']) {
    assert.equal(declared(`--dsw-radius-${token}`), '0px', `--dsw-radius-${token} must be zeroed`)
  }
  for (const token of ['code-block-border-radius', 'guide-entry-radius', 'search-radius', 'terminal-radius', 'web-radius']) {
    assert.equal(declared(`--dsl-${token}`), '0px', `--dsl-${token} must be zeroed`)
  }
})

test('the hardcoded-length sweep wins over class rules but spares the round ones', async () => {
  const css = allCss((await bootRun()).styleTags)

  // The host hardcodes ~163 radii that no token reaches; the sweep must carry
  // !important to beat a `(0,1,0)` class selector.
  assert.match(css, /\*\s*\{\s*border-radius:\s*0\s*!important/)

  // ...and must key on the marker the host itself uses, so the 37 `50%` rules
  // (avatars, status dots, progress rings) are re-squared only via that marker.
  assert.match(css, /\[style\*="corner-shape"\]\s*\{\s*corner-shape:\s*square\s*!important/)
  assert.doesNotMatch(css, /:root\s*\{[^}]*corner-shape/, 'do not set corner-shape globally')
  assert.doesNotMatch(css, /\*\s*\{[^}]*corner-shape/, 'do not set corner-shape on every element')

  // The one legitimate `round` is the demo dot, which proves circles survive.
  const rules = [...css.matchAll(/([^{}]+)\{[^{}]*corner-shape:\s*(\w+)[^}]*\}/g)]
  assert.ok(rules.length > 0)
  for (const [, selector, value] of rules) {
    assert.match(selector, /\[style\*="corner-shape"\]|\.pp-dot/, `unexpected corner-shape rule on ${selector.trim()}`)
    if (value === 'round') assert.match(selector, /\.pp-dot/, 'only the demo dot may stay round')
  }
})

test('the stylesheet only reaches for font assets and theme variables', async () => {
  const css = allCss((await bootRun()).styleTags)
  for (const url of [...css.matchAll(/url\("([^"]+)"\)/g)].map(m => m[1])) {
    const extension = url.split('?')[0].split('.').pop()
    assert.ok(['woff2', 'woff', 'css'].includes(extension), `${url} is not a font asset`)
  }
})

// ── runner ───────────────────────────────────────────────────────────────────

let failures = 0
for (const [name, fn] of tests) {
  try {
    await fn()
    process.stdout.write(`  ok  ${name}\n`)
  } catch (error) {
    failures += 1
    process.stdout.write(`FAIL  ${name}\n      ${error?.message ?? error}\n`)
  }
}
process.stdout.write(`\n${tests.length - failures}/${tests.length} passed\n`)
process.exit(failures === 0 ? 0 : 1)
