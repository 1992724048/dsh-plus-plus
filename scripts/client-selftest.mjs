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

/** Every chunk file on disk, core included, sorted. */
function allChunkFiles() {
  return fs.readdirSync(ROOT).filter(name => /^client\..*\.js$/.test(name)).sort()
}

/** The chunk files that declare a feature — i.e. everything but the core. */
function featureChunkFiles() {
  return allChunkFiles().filter(name => name !== 'client.core.js')
}

/**
 * The chunk specifiers `client.js` lists, in declaration order.
 *
 * Read from the source rather than restated here, so adding a chunk cannot leave
 * this file asserting a stale list — which is exactly the drift the
 * "chunks on disk match what the entry requires" test exists to catch.
 */
function expectedChunkOrder() {
  const source = fs.readFileSync(path.join(ROOT, 'client.js'), 'utf8')
  const block = /const CHUNKS = \[([\s\S]*?)\]/.exec(source)
  assert.ok(block, 'CHUNKS must be locatable in client.js')
  return [...block[1].matchAll(/'([^']+)'/g)].map(m => m[1])
}

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

/** A stub client context that records every effect, slot and palette registration. */
function stubContext() {
  const effects = []
  const slots = []
  const dictionaries = []
  const palettes = []
  // Services are created once and handed out by `get`, as a Cordis context does.
  // A fresh object per `get` would hide the very reuse the palette assertions
  // depend on — the same trap the host selftest fell into.
  const locale = {
    register(ns, dicts) { dictionaries.push({ ns, dicts }); return noop },
    bind: () => (key) => dictsLookup?.[key] ?? key,
  }
  const slotsService = {
    inject(key, callback) { callback(); return noop },
    register(options) { slots.push(options); return noop },
  }
  const theme = {
    overrideTokens(source, tokens) { palettes.push({ source, tokens }); return noop },
  }
  const services = new Map([['locale', locale], ['slots', slotsService], ['theme', theme]])

  const ctx = {
    effect(fn, label) {
      const dispose = fn()
      effects.push(label)
      return typeof dispose === 'function' ? dispose : noop
    },
    get(name) { return services.get(name) },
    // The entry and the feature chunks reach the services two ways: through
    // `ctx.get`, and as properties when they are named in `inject`. Both are
    // wired here so a chunk written either way works.
    locale,
    slots: slotsService,
    theme,
  }
  return { ctx, effects, slots, dictionaries, palettes }
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
    /** Everything `apply` registered: effects, slots, dictionaries, palettes. */
    ...stub,
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
  assert.equal(result.cache.size, allChunkFiles().length,
    'every chunk file must load — one per feature, plus the core')
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
  assert.deepEqual([...new Set(asyncSpecs)], expectedChunkOrder(),
    'chunks must be fetched through require.async, in declaration order')
  assert.equal(cache.size, allChunkFiles().length,
    'core must be materialized exactly once despite the repeat requests each feature makes')
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
  for (const file of featureChunkFiles()) {
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
  const files = ['client.js', ...allChunkFiles()]
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
  for (const file of allChunkFiles()) {
    assert.match(file, CLIENT_CHUNK, `${file} is not a valid client chunk name`)
  }
})

test('the entry requires exactly the chunks that exist on disk', async () => {
  const { cache } = await bootRun()
  const required = [...cache.keys()].sort()
  const onDisk = allChunkFiles()
  assert.deepEqual(required, onDisk,
    'a chunk on disk that nothing requires is dead code; a required chunk that is missing will not load')
  for (const [file, entry] of cache) assert.ok(entry.exports, `${file} resolved to nothing`)
  // And the declared order must match, not just the set: core first, then the
  // features. Compared by content so the assertion does not encode a sort order.
  const declared = expectedChunkOrder()
  assert.equal(declared[0], './client.core.js', 'the core chunk must load first')
  assert.deepEqual(
    declared.slice(1).map(name => name.slice('./'.length)).sort(),
    featureChunkFiles(),
    'CHUNKS must list every feature chunk exactly once, after the core',
  )
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

test('the composer chunk restyles without taking over the composer slot', async () => {
  // The composer's host slot is `conversation.composer.bar`, a `single` seat whose
  // `replaceRisk` is `shadows-shipped-ui`. Registering there would replace the
  // editor outright — paste, @-mention, slash commands, attachment, IME
  // composition and voice input all included. Nothing here may register a slot.
  const { cache } = await bootRun()
  const composer = cache.get('client.composer.js').exports
  const feature = cache.get('client.core.js').exports.listFeatures()
    .find(entry => entry.id === 'composer')
  assert.ok(feature, 'the composer feature must be declared')

  const css = feature.css
  // It must key off the host's stable data attributes, never its build-scoped
  // hash class names — those change every release and silently stop matching.
  assert.match(css, /\[data-composer-card\]/, 'must anchor on data-composer-card')
  assert.match(css, /\[data-input-scroll\]/, 'must anchor on data-input-scroll')
  assert.doesNotMatch(css, /\.RlGAzG/, 'must not hard-code a build-scoped host class name')

  // The structural decisions, each with the reason it was made.
  assert.match(css, /--pp-composer-block-gap:\s*4px/, 'the gutter between blocks is 4px')
  // Colours live in the palette (see below), not hard-coded here, so the scheme
  // can flip them. The stylesheet must reference them by variable.
  assert.match(css, /background:\s*var\(--pp-composer-surface\)/,
    'the editor must take its surface from the palette, not a literal')
  assert.doesNotMatch(css, /background:\s*#[0-9a-f]{3,8}\b/i,
    'no hard-coded colours — they cannot follow the scheme')
  // Each control is its own bordered block, so the row itself is not a surface.
  assert.match(css, /:is\(button, \[role="button"\]\)\s*\{[^}]*border:\s*1px solid var\(--pp-composer-stroke\)/,
    'every control must be its own bordered block')
  assert.match(css, /~ \[class\*="_row"\]\s*\{[^}]*background:\s*transparent/,
    'the tool row must not paint a shared background behind its buttons')
  // The blur is a variable so one declaration serves both schemes.
  assert.match(css, /backdrop-filter:\s*blur\(var\(--pp-composer-blur\)\)/,
    'the blur must come from the palette so dark can switch it off')
  void composer
})

test('the stub context models ctx.get, or features silently degrade to no-ops', async () => {
  // Twice now a stub has hidden a real bug: the host one returned a fresh service
  // object per `get`, and this one had no `get` at all — so `applyPalette` took its
  // "no theme service" branch and the palette silently never applied, with every
  // other test still green.
  //
  // A stub that answers nothing is the dangerous shape: features written to
  // degrade gracefully will, in the stub, do exactly that — and a test asserting
  // the descriptor will still pass. So assert the stub's own fidelity.
  const { stub } = await bootRun()
  assert.equal(typeof stub.ctx.get, 'function', 'the stub must provide ctx.get')

  const locale = stub.ctx.get('locale')
  const slots = stub.ctx.get('slots')
  const theme = stub.ctx.get('theme')
  assert.equal(locale, stub.ctx.locale, 'ctx.get must return the same object as the property')
  assert.equal(slots, stub.ctx.slots, 'ctx.get must return the same object as the property')
  assert.equal(theme, stub.ctx.theme, 'ctx.get must return the same object as the property')
  assert.equal(stub.ctx.get('locale'), locale, 'repeated get must return the identical object')
  assert.equal(stub.ctx.get('absent'), undefined, 'an absent service must answer undefined')

  // And the palette must actually have gone through it.
  assert.equal(stub.palettes.length, 1,
    'if this is 0 the stub is hiding the feature; the feature is not the problem')
})

test('the composer palette is declared for both schemes', async () => {
  // The host's `overrideTokens` takes a `{ light, dark }` map per token and
  // recomposes it on a scheme change. That is why the composer declares both
  // rather than picking a scheme itself — and why a half-declared token would
  // silently render as the shell's colour in one scheme.
  const { cache } = await bootRun()
  const { palette } = cache.get('client.composer.js').exports.descriptor

  assert.ok(palette !== undefined, 'the composer must declare a palette')
  const entries = Object.entries(palette)
  assert.ok(entries.length > 0, 'the palette must not be empty')
  for (const [token, modes] of entries) {
    assert.ok(token.startsWith('--pp-composer-'), `${token} must be namespaced to this plugin`)
    assert.deepEqual([...Object.keys(modes)].sort(), ['dark', 'light'],
      `${token} must declare both schemes`)
    for (const [scheme, value] of Object.entries(modes)) {
      assert.equal(typeof value, 'string', `${token}.${scheme} must be a string`)
      assert.ok(value !== '', `${token}.${scheme} must not be empty`)
    }
  }

  // The four values the user specified, in both schemes — asserted against what
  // `apply` pushed into the theme service, not the descriptor.
  const { palettes } = await bootRun()
  assert.equal(palettes.length, 1, 'the composer must apply exactly one palette layer')
  const applied = palettes[0].tokens
  const get = (token, scheme) => applied[token][scheme]
  assert.equal(get('--pp-composer-surface', 'light'), 'rgb(255 255 255 / 50%)',
    'light: the editor is a translucent white')
  assert.equal(get('--pp-composer-surface', 'dark'), '#000', 'dark: the editor is solid black')
  assert.equal(get('--pp-composer-accent', 'light'), '#000', 'light: attach and send are black')
  assert.equal(get('--pp-composer-accent', 'dark'), '#fff', 'dark: attach and send are white')
  assert.ok(get('--pp-composer-control', 'light').includes('/'), 'light: the other controls are translucent')
  assert.equal(get('--pp-composer-control', 'dark'), '#000', 'dark: the other controls are black')
  // The blur is a variable so one declaration covers both: on in light, off in dark.
  assert.notEqual(get('--pp-composer-blur', 'light'), '0px', 'light: the surface is blurred')
  assert.equal(get('--pp-composer-blur', 'dark'), '0px', 'dark: the blur is off, not merely weaker')
})

test('core applies a palette through the theme service, and survives it being absent', async () => {
  const { cache } = await bootRun()
  const core = cache.get('client.core.js').exports

  const applied = []
  const ctx = {
    get: name => (name === 'theme'
      ? { overrideTokens: (source, tokens) => { applied.push({ source, tokens }); return noop } }
      : undefined),
  }
  const palette = { '--pp-x': { light: '#fff', dark: '#000' } }
  const dispose = core.applyPalette(ctx, palette, 'test')
  assert.equal(applied.length, 1)
  assert.deepEqual(applied[0].tokens, palette)
  assert.equal(typeof dispose, 'function')

  // No theme service: the feature still loads, it just has no palette.
  const bare = { get: () => undefined }
  assert.doesNotThrow(() => core.applyPalette(bare, palette, 'test'),
    'a composition without themes must not fail a feature that declares a palette')
})

test('the composer identifies the send button without relying on a slot that hides', async () => {
  // The regression: the send button was styled via `activity ~ button`, but the host
  // hides an empty activity slot with `display: none` — so the sibling combinator
  // stopped matching exactly when the composer was empty, which is when the button
  // was reported as oversized. `:last-of-type` in the trailing group is unaffected.
  const { cache } = await bootRun()
  const css = cache.get('client.composer.js').exports.descriptor.css
  assert.doesNotMatch(css, /conversation\.input\.activity[^\n]*[~+]\s*button/,
    'must not anchor on the activity slot — the host hides it when empty')
  assert.match(css, /\[class\*="_trailing"\] button:last-of-type/,
    'the send button must be found structurally, as the trailing group\'s last button')
})

test('the composer chunk declares no slot registration', async () => {
  // Re-read the source rather than the descriptor: `apply` is opaque until run, and
  // the failure mode being guarded (silently replacing the editor) must be caught by
  // inspection, not by whatever `apply` happens to do with a stub context.
  const source = fs.readFileSync(path.join(ROOT, 'client.composer.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  assert.doesNotMatch(source, /slots\s*\.\s*(register|inject)\s*\(/,
    'the composer chunk must not register any slot — it only restyles')
  assert.doesNotMatch(source, /conversation\.composer\.bar/,
    'referencing the composer bar slot at all would invite a replacement')
})

test('no bundle puts a raw backtick inside a CSS template literal', () => {
  // Twice now a comment quoting code — `styles.insert`, `inherit`,
  // `aria-label="发送消息"` — has closed the enclosing template literal early and
  // turned the rest of the stylesheet into JavaScript. The symptom is a syntax
  // error far from the cause, so it is checked directly: a CSS template literal
  // may contain a backtick only as part of an escaped one.
  const files = ['client.js', ...allChunkFiles()]
  for (const file of files) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8')
    for (const match of source.matchAll(/const\s+(\w*CSS\w*)\s*=\s*`/g)) {
      const name = match[1]
      const start = match.index + match[0].length
      // Walk the literal to its true end, honouring escapes.
      let index = start
      for (;;) {
        index = source.indexOf('`', index)
        assert.ok(index >= 0, `${file}: ${name} has an unterminated template literal`)
        let backslashes = 0
        for (let i = index - 1; i >= start && source[i] === '\\'; i -= 1) backslashes += 1
        if (backslashes % 2 === 0) break
        index += 1
      }
      const body = source.slice(start, index)
      assert.doesNotMatch(body, /`/, `${file}: ${name} contains a bare backtick — it would close the literal early`)
    }
  }
})

test('every bundle parses as JavaScript on its own', () => {
  // Catches what the walk above cannot: a CSS block that never became a literal at
  // all, or any other stray edit. `compileFunction` parses without executing.
  for (const file of ['client.js', ...allChunkFiles()]) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8')
    // `compileFunction(source, params, …)` — the params argument must be an array;
    // the filename is the trailing options object.
    assert.doesNotThrow(() => vm.compileFunction(source, [], { filename: file }),
      `${file} does not parse`)
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
