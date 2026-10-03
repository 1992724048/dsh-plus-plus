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

const cache = new Map()
const styleTags = []
const loaded = []

function requireImpl(specifier) {
  if (specifier === 'react') return React
  if (!specifier.startsWith(`${PACKAGE}/`)) {
    throw new Error(`client-modules: ${PACKAGE}/client.js requested external "${specifier}"`)
  }
  const file = specifier.slice(PACKAGE.length + 1)
  if (!CLIENT_CHUNK.test(file)) {
    throw new Error(`client-modules: cannot resolve chunk "${file}" — the name must match client.*.js`)
  }
  if (!cache.has(file)) {
    // Seed first so a require cycle degrades to a placeholder rather than
    // recursing forever; the real exports replace it below.
    cache.set(file, { exports: {} })
    loaded.push(file)
    cache.set(file, { exports: evaluate(file, requireImpl, styleTags) })
  }
  return cache.get(file).exports
}

let exports
try {
  exports = evaluate('client.js', requireImpl, styleTags)
} catch (error) {
  console.log('ENTRY THREW     :', error.message)
  process.exit(1)
}

console.log('entry id        :', PACKAGE)
console.log('chunks resolved :', loaded.join(', ') || 'none')
console.log('exports         :', Object.keys(exports).join(', '))
console.log('typeof apply    :', typeof exports.apply)
console.log('inject          :', JSON.stringify([...exports.inject]))
console.log('toStringTag     :', Object.prototype.toString.call(exports))

const effects = []
const slots = []
const namespaces = []
try {
  exports.apply({
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
