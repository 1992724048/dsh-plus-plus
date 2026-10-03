/**
 * Shared harness for the client-side self tests.
 *
 * The browser half is a set of hand-written ModuleLoader bundles with no test
 * runner and no module graph, so these tests load them the way the shell does.
 *
 * ## Why this harness is so careful about fidelity
 *
 * A stub that answers less than the real thing does not fail — it *hides*. Three
 * times now a stub of ours let a real regression through, and each time the cause
 * was the stub being more forgiving than the host:
 *
 *  - a `require` that accepted any specifier, where the shell's answers only
 *    platform seed words and throws `missed the module table` otherwise;
 *  - a context with no `ctx.get` at all, so a feature written to degrade
 *    gracefully degraded *in the test* and applied nothing;
 *  - an `overrideTokens` that appended to a list, where the host's
 *    `Map<source, layer>` replaces a source's whole layer.
 *
 * So each stub below reproduces the host's real semantics, and `bundles.mjs`
 * asserts that fidelity rather than trusting it.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

export const ROOT = fileURLToPath(new URL('../..', import.meta.url))
export const PACKAGE = 'dsh-plus-plus'

/** The loader's own chunk-naming rule, copied so a change upstream is visible. */
export const CLIENT_CHUNK = /^client\.[A-Za-z0-9][A-Za-z0-9._-]*\.js$/

/** The shell's platform seed list, verbatim. `require` answers only these. */
export const SEED_WORDS = new Set([
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
  '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
])

export const noop = () => {}

// ── collectors ───────────────────────────────────────────────────────────────

/** Collected `test(name, fn)` cases, run by the entry point. */
const cases = []

export function test(name, fn) {
  cases.push([name, fn])
}

/** Run every collected case; returns a process exit code. */
export async function run(label) {
  let failures = 0
  for (const [name, fn] of cases) {
    try {
      await fn()
      process.stdout.write(`  ok  ${name}\n`)
    } catch (error) {
      failures += 1
      process.stdout.write(`FAIL  ${name}\n      ${error?.message ?? error}\n`)
    }
  }
  process.stdout.write(`\n${label}: ${cases.length - failures}/${cases.length} passed\n`)
  return failures === 0 ? 0 : 1
}

// ── disk helpers ─────────────────────────────────────────────────────────────

/** Every chunk file on disk, core included, sorted. */
export function allChunkFiles() {
  return fs.readdirSync(ROOT).filter(name => /^client\..*\.js$/.test(name)).sort()
}

/** The chunk files that declare a feature — i.e. everything but the core. */
export function featureChunkFiles() {
  return allChunkFiles().filter(name => name !== 'client.core.js')
}

/** Read one file with comments stripped, so prose cannot match a code pattern. */
export function readCode(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/**
 * The chunk specifiers `client.js` lists, in declaration order.
 *
 * Read from the source rather than restated, so adding a chunk cannot leave a test
 * asserting a stale list.
 */
export function expectedChunkOrder() {
  const block = /const CHUNKS = \[([\s\S]*?)\]/.exec(readCode('client.js'))
  assert.ok(block, 'CHUNKS must be locatable in client.js')
  return [...block[1].matchAll(/'([^']+)'/g)].map(m => m[1])
}

// ── the stub context ─────────────────────────────────────────────────────────

/**
 * A stub client context recording every effect, slot and palette registration.
 *
 * Services are created once and handed out by `get`, as a Cordis context does. A
 * fresh object per `get` would hide the reuse the palette assertions depend on.
 */
export function stubContext() {
  const effects = []
  const slots = []
  const dictionaries = []

  const locale = {
    register(ns, dicts) { dictionaries.push({ ns, dicts }); return noop },
    bind: () => key => key,
  }
  const slotsService = {
    inject(key, callback) { callback(); return noop },
    register(options) { slots.push(options); return noop },
  }

  // The theme service reproduces the host's `Map<source, layer>`: calling
  // `overrideTokens` with a source it already holds **replaces that source's whole
  // layer**. `palettes` therefore holds the *surviving* layers, and
  // `paletteHistory` holds everything ever passed, for diagnostics.
  const palettes = []
  const paletteBySource = new Map()
  const paletteHistory = []
  const theme = {
    overrideTokens(source, tokens) {
      paletteHistory.push({ source, tokens })
      const existing = paletteBySource.get(source)
      if (existing !== undefined) {
        const at = palettes.indexOf(existing)
        if (at >= 0) palettes.splice(at, 1)
      }
      const layer = { source, tokens }
      paletteBySource.set(source, layer)
      palettes.push(layer)
      return () => {
        if (paletteBySource.get(source) !== layer) return
        paletteBySource.delete(source)
        const at = palettes.indexOf(layer)
        if (at >= 0) palettes.splice(at, 1)
      }
    },
  }

  const services = new Map([['locale', locale], ['slots', slotsService], ['theme', theme]])

  const ctx = {
    effect(fn, label) {
      const dispose = fn()
      effects.push(label)
      return typeof dispose === 'function' ? dispose : noop
    },
    get(name) { return services.get(name) },
    // Both access shapes the entry and the chunks use: `ctx.get`, and properties
    // for services named in `inject`.
    locale,
    slots: slotsService,
    theme,
  }

  return { ctx, effects, slots, dictionaries, palettes, paletteHistory }
}

// ── the loader ───────────────────────────────────────────────────────────────

/** A React stand-in; the bundles only use createElement and two hooks. */
const REACT = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: initial => [initial, noop],
  useEffect: noop,
}

/**
 * Evaluate one bundle in a fresh realm and return its registration.
 *
 * `styleTags` is passed in rather than created here: every chunk runs in its own
 * realm with its own `document`, but they all append into one list, or the test
 * would only see the tags the *entry* realm inserted and silently miss everything
 * a feature chunk contributed.
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

/**
 * A `require` that models the shell's exactly, because the difference *is* the bug.
 *
 *  - `require(spec)` is a **synchronous module-table lookup**. It answers only a
 *    platform seed word or an already-materialized graph row and throws
 *    `missed the module table` otherwise. A sibling chunk is neither.
 *  - `require.async(spec)` is the chunk path. It accepts only a relative `./name.js`
 *    matching `client.*.js`, and returns a promise.
 */
function makeRequire(cache, styleTags) {
  const loadChunk = file => {
    assert.match(file, CLIENT_CHUNK, `"${file}" is not a valid client chunk name`)
    if (cache.has(file)) return cache.get(file).exports
    // Seed before evaluating so a cycle sees a placeholder rather than recursing.
    cache.set(file, { exports: {} })
    cache.set(file, { exports: evaluate(file, syncRequire, styleTags).registration.factory(syncRequire) })
    return cache.get(file).exports
  }

  const syncRequire = spec => {
    requireImpl.calls.push({ kind: 'sync', spec })
    if (spec === 'react') return REACT
    if (SEED_WORDS.has(spec)) throw new Error(`seed word "${spec}" has no test implementation`)
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

  /** Every `require` / `require.async` call, in order. */
  syncRequire.calls = []

  const requireImpl = syncRequire
  return requireImpl
}

/**
 * Resolve the entry, its core and every feature chunk.
 *
 * Does **not** run `apply` — the chunk loads are async, so a caller awaits `run()`
 * itself. Returning a promise-shaped result and forgetting to await it is how the
 * original async failure stayed invisible, so the split is explicit.
 */
export function boot() {
  const cache = new Map()
  const styleTags = []
  const requireImpl = makeRequire(cache, styleTags)

  const { registration } = evaluate('client.js', requireImpl, styleTags)
  const exports = registration.factory(requireImpl)
  const stub = stubContext()

  return {
    exports,
    styleTags,
    cache,
    requireImpl,
    /** Everything `apply` registered: effects, slots, dictionaries, palettes. */
    ...stub,
    /** Run `apply` and resolve once every chunk has loaded. */
    run: () => exports.apply(stub.ctx),
  }
}

/** Boot and run in one step, for the assertions that only need the end state. */
export async function bootRun() {
  const result = boot()
  await result.run()
  return result
}

/** Every stylesheet text the boot inserted, concatenated. */
export function allCss(styleTags) {
  return styleTags.map(node => node.textContent ?? '').join('\n')
}

/**
 * Every CSS rule block in a sheet, as `{ selector, body }`.
 *
 * Parsing by scanning braces rather than by regex: these sheets contain
 * multi-line selector lists and declaration values wrapped across lines, and a
 * pattern aimed at one rule keeps matching a neighbour instead. Splitting on the
 * braces cannot confuse two adjacent rules whatever their shape — which is what
 * several earlier regex attempts could not manage.
 */
export function cssRules(css) {
  const rules = []
  let selector = ''
  let body = ''
  let depth = 0
  for (const char of css) {
    if (char === '{') {
      depth += 1
      if (depth === 1) {
        // Comments precede the selector and would otherwise be read as part of it,
        // which makes a rule impossible to match on the selectors alone.
        selector = body.replace(/\/\*[\s\S]*?\*\//g, '').trim()
        body = ''
      }
      continue
    }
    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        rules.push({ selector, body: body.replace(/\/\*[\s\S]*?\*\//g, '').trim() })
        selector = ''
        body = ''
      }
      continue
    }
    body += char
  }
  return rules
}

/**
 * The rules whose selector list mentions `needle`.
 *
 * Sorted longest selector first, so a caller asking about one element gets the
 * narrowest rule rather than whichever happens to come first.
 */
export function rulesMatching(css, needle) {
  return cssRules(css)
    .filter(rule => rule.selector.includes(needle))
    .sort((a, b) => b.selector.length - a.selector.length)
}

/** The body of the narrowest matching rule, or undefined. */
export function bodyMatching(css, needle) {
  return rulesMatching(css, needle)[0]?.body
}

/** A recording theme service, for tests that drive `applyPalette` directly. */
export function themeStub() {
  const applied = []
  const disposed = []
  const ctx = {
    get: name => (name === 'theme'
      ? { overrideTokens: source => { applied.push(source); return () => disposed.push(source) } }
      : undefined),
  }
  return { ctx, applied, disposed }
}
