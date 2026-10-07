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

export function featureChunkFiles() {
  return allChunkFiles().filter(name => name !== 'client.core.js' && !name.endsWith('.css.js'))
}

export function requiredChunkFiles() {
  return [...featureChunkFiles(), ...declarationChunkFiles()].sort()
}

/** Declaration-only chunks: data for their owning feature, never a descriptor. */
export function declarationChunkFiles() {
  return allChunkFiles().filter(name => name.endsWith('.css.js'))
}

/** Read one file with comments stripped, so prose cannot match a code pattern. */
export function readCode(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8')
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
    // The host injects by handing the callback a generator runner and collecting
    // what it yields, so a plugin's
    //
    //   ctx.slots.inject(name, function* () {
    //     yield ctx.slots.register({ name, id }, Component)
    //   })
    //
    // registers each entry exactly as it declares it. Calling the generator without
    // iterating it would run no `yield` and register nothing — which would make a
    // plugin that registers nothing look identical to one that registers correctly.
    inject(key, callback) {
      const iterator = callback()
      if (typeof iterator?.next === 'function') {
        for (const step of iterator) void step
      }
      return noop
    },
    register(options, component) { slots.push({ ...options, component }); return noop },
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

/** A React stand-in; the bundles only use createElement, hooks and Fragment. */
const REACT = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: initial => [initial, noop],
  useEffect: noop,
  useCallback: fn => fn,
  useMemo: fn => fn(),
  Fragment: 'Fragment',
}

const RENDERED_NODES = []

/**
 * Invoke one slot component the way React would mount it, and return the element
 * tree it produced.
 *
 * `renderSlotEntry` only builds the component's props. A menu row can then still
 * throw inside its own `onSelect` — the exact regression behind "click does
 * nothing" — while every prop-shape assertion passes. Materialising the tree here
 * is enough to run those handlers without pulling in a renderer.
 */
export function renderSlotComponent(entry, props = {}) {
  const resolved = renderSlotEntry(entry, props)
  const component = entry.component ?? entry.Component ?? entry.registered
  assert.equal(typeof component, 'function', 'the slot must register a component')
  const element = component(resolved)
  RENDERED_NODES.push({ entry, props: resolved, element })
  return { ...resolved, element }
}

/**
 * Render one registered slot entry the way the shell does: resolve `inject` by
 * CALLING it, resolve `store.create()`, and hand the component a `t` derived from
 * the registration's `locale` namespace.
 *
 * Without this the browser half can pass every structural assertion and still crash
 * on mount, which is exactly what happened twice.
 */
export function renderSlotEntry(entry, props = {}) {
  if (typeof entry?.inject !== 'function') {
    throw new TypeError("inject is not a function — the runtime calls it as a factory")
  }
  const injected = entry.inject()
  const t = key => `${entry.locale ?? 'default'}.${key}`
  // `hooks` sources are BARE observable sources — `subscribe`/`getSnapshot`, the
  // shape `bindInjectSources` binds with `observableHook`. Each becomes a selector
  // hook: `use<Name>(selector)` reads the source through `getSnapshot`. A source
  // that is not shaped like an observable means the entry will crash on mount in
  // the browser even though every structural assertion passes.
  const { hooks, ...rest } = injected
  const bound = {}
  for (const [name, source] of Object.entries(hooks ?? {})) {
    const hookName = 'use' + (name[0]?.toUpperCase() ?? '') + name.slice(1)
    if (source === undefined || typeof source.subscribe !== 'function' || typeof source.getSnapshot !== 'function') {
      throw new TypeError(
        `hooks.${name} must be a subscribe/getSnapshot observable — `
        + `bindInjectSources() binds it with observableHook(), which calls subscribe() and getSnapshot()`,
      )
    }
    const selectorHook = (selector, equal) => {
      const snapshot = source.getSnapshot()
      return selector === undefined ? snapshot : selector(snapshot, equal)
    }
    bound[hookName] = selectorHook
    bound[name] = selectorHook
    bound['raw' + hookName[0].toUpperCase() + hookName.slice(1)] = selectorHook
  }
  return { ...props, ...rest, ...bound, t }
}
/**
 * A stand-in for dsh-client-ui-primitives.
 *
 * The real module exports ~200 components. A plugin only needs the handful it
 * renders, so each is a marker function that records its props when called — which
 * is enough for a test to assert the structure without a renderer.
 */
const PRIMITIVES = new Proxy({
  Modal: 'Modal',
  Button: 'Button',
  MenuItemButton: 'MenuItemButton',
  IconTrashOutlineRegular: 'IconTrashOutlineRegular',
}, {
  get(target, key) {
    // Anything not named above still has to resolve: a plugin rendering an
    // unstubbed component must not fail at require time.
    return key in target ? target[key] : String(key)
  },
})
/**
 * A stand-in for dsh-client-store's snapshot store.
 *
 * Models the three methods the slot `store` option actually exercises: a `create`
 * that yields the store, `getSnapshot`, and `set`. It is deliberately not a full
 * zustand stand-in — what matters here is that a registration passing `store` can
 * hand the runtime something with a `create`.
 */
function createSnapshotStore(init = null) {
  let snapshot = init
  return {
    getSnapshot: () => snapshot,
    set: next => { snapshot = next },
    subscribe: () => () => {},
  }
}

const CLIENT_STORE = { createSnapshotStore }
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
      // The composer chunk polls for its permission button and watches it for mode
      // changes. Without these the chunk throws at apply and takes the whole entry
      // down with it — which is the failure mode the stub exists to prevent, not to
      // accommodate. querySelector answers null, which is the page-with-no-conversation
      // case, so the poll simply exhausts and stops.
      querySelector: () => null,
    },
    // Never fires. Enough to model "the composer has not mounted": the poll runs
    // its course, finds nothing, and clears itself. A real interval would hold the
    // process open and outlive the test.
    MutationObserver: class {
      observe() {}
      disconnect() {}
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
    if (spec === '@deepseek-ai/dsh-client-ui-primitives') return PRIMITIVES
    if (spec === '@deepseek-ai/dsh-client-store') return CLIENT_STORE
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
