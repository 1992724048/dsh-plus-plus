/**
 * Diagnostic probe: run the client half the way the shell does, and report what
 * breaks.
 *
 * Reproduces a boot failure without a browser: loads `client.js`, resolves its
 * sibling chunks through the same `require` the shell provides, and runs
 * `apply(ctx)` against a stub context. Any throw is reported verbatim — this is
 * what pointed at `styles is not defined` when the entry failed to activate.
 *
 * Run: `node scripts/probe-client.mjs`
 */

import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const PACKAGE = 'dsh-plus-plus'

/** The loader's own chunk-naming rule, copied so a change upstream is visible. */
const CLIENT_CHUNK = /^client\.[A-Za-z0-9][A-Za-z0-9._-]*\.js$/

const noop = () => {}

/** Evaluate one bundle in its own realm and return what its factory exported. */
function evaluate(fileName, requireImpl, styleTags) {
  let registration
  const sandbox = {
    window: { __ModuleLoader__: { load: value => { registration = value } } },
    console,
    // A real page provides these. `styles` deliberately does not exist here,
    // because it is not one of the globals a __ModuleLoader__ factory receives.
    document: {
      documentElement: { lang: 'zh' },
      createElement: tag => (tag === 'style'
        ? {
            tag,
            textContent: '',
            attributes: {},
            setAttribute(name, value) { this.attributes[name] = value },
            getAttribute(name) { return this.attributes[name] },
            remove: noop,
          }
        : {}),
      head: { appendChild: node => { styleTags.push(node); return node } },
    },
    fetch: async () => ({ ok: true }),
    setInterval: noop,
    clearInterval: noop,
  }
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(path.join(ROOT, fileName), 'utf8'), sandbox, { filename: fileName })
  if (registration === undefined) throw new Error(`${fileName} did not call __ModuleLoader__.load`)
  return registration.factory(requireImpl)
}

const React = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: initial => [initial, noop],
  useEffect: noop,
}

/** The shell's platform seed list. `require` answers only these, synchronously. */
const SEED_WORDS = new Set([
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
  '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
])

const cache = new Map()
const styleTags = []
const loaded = []

/**
 * Model the shell's two-member `require` exactly, because the difference is the bug.
 *
 * `require(spec)` is a synchronous seed-word / materialized-row lookup that throws
 * `missed the module table` for anything else — and a sibling chunk is neither.
 * `require.async(spec)` is the chunk path, accepting only a relative `./client.*.js`.
 */
function makeRequire() {
  const loadChunk = file => {
    if (!CLIENT_CHUNK.test(file)) {
      throw new Error(`client-modules: invalid relative chunk request "./${file}"`)
    }
    if (cache.has(file)) return cache.get(file).exports
    // Seed first so a require cycle degrades to a placeholder rather than
    // recursing forever; the real exports replace it below.
    cache.set(file, { exports: {} })
    loaded.push(file)
    cache.set(file, { exports: evaluate(file, requireImpl, styleTags) })
    return cache.get(file).exports
  }

  const requireImpl = spec => {
    if (spec === 'react') return React
    if (SEED_WORDS.has(spec)) throw new Error(`seed word "${spec}" has no probe implementation`)
    const record = cache.get(spec)
    if (record !== undefined) return record.exports
    throw new Error(
      `client-modules: require("${spec}") missed the module table — not a platform seed word, `
      + 'not a materialized module, and no registered package factory',
    )
  }

  requireImpl.async = async spec => {
    if (!spec.startsWith('./')) throw new Error(`client-modules: invalid relative chunk request "${spec}"`)
    return loadChunk(spec.slice(2))
  }

  return requireImpl
}

const requireImpl = makeRequire()

let exports
try {
  exports = evaluate('client.js', requireImpl, styleTags)
} catch (error) {
  console.log('ENTRY THREW     :', error.message)
  process.exit(1)
}

console.log('entry id        :', PACKAGE)
console.log('exports         :', Object.keys(exports).join(', '))
console.log('typeof apply    :', typeof exports.apply)
console.log('inject          :', JSON.stringify([...exports.inject]))
console.log('toStringTag     :', Object.prototype.toString.call(exports))

const effects = []
const slots = []
const namespaces = []
try {
  // `apply` is async: it fetches the chunks through `require.async` first. Not
  // awaiting it here is how a chunk-loading failure would slip past this probe.
  await exports.apply({
    effect(fn, label) {
      const dispose = fn()
      effects.push(label)
      return typeof dispose === 'function' ? dispose : noop
    },
    locale: {
      register(ns) { namespaces.push(ns); return noop },
      bind: () => key => key,
    },
    slots: {
      inject(key, callback) { callback(); return noop },
      register(options) { slots.push(`${options.name}/${options.id}`); return noop },
    },
  })
  console.log('apply ok        :', effects.join(', '))
  console.log('dictionaries    :', namespaces.join(', '))
  console.log('slots           :', slots.join(', '))
  console.log('chunks fetched  :', loaded.join(', ') || 'none')
  console.log('style tags      :', styleTags.length)
  for (const tag of styleTags) {
    const label = tag.getAttribute?.('data-feature') ?? '(unlabelled)'
    console.log(`  ${String(label).padStart(8)}  ${(tag.textContent ?? '').length} bytes`)
  }
} catch (error) {
  console.log('APPLY THREW     :', error.message)
  process.exit(1)
}

const core = cache.get('client.core.js')?.exports
if (core !== undefined) {
  console.log('features        :', core.listFeatures().map(f => `${f.id}@${f.order}`).join(', '))
}
