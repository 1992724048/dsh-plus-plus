/**
 * Reproduce exactly what the shell's client module system does to this bundle.
 *
 * Diagnostic probe, not a test: it runs the factory the way the loader does and
 * then checks the exports face the loader requires. Run:
 *
 *   node scripts/probe-client.mjs
 */

import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')

let registration
// Mirror a real page as closely as possible: a bundle loaded through
// `__ModuleLoader__` gets `require` and page globals, nothing else. Notably no
// `styles` — that builtin belongs to the dynamic client-half path only.
const styleTags = []
const sandbox = {
  window: { __ModuleLoader__: { load: value => { registration = value } } },
  console,
  document: {
    documentElement: { lang: 'zh' },
    createElement: tag => (tag === 'style'
      ? { tag, textContent: '', setAttribute: () => {}, remove: () => {} }
      : {}),
    head: { appendChild: node => { styleTags.push(node); return node } },
  },
  fetch: async () => ({ ok: true }),
  setInterval: () => {},
  clearInterval: () => {},
}
vm.createContext(sandbox)
vm.runInContext(source, sandbox, { filename: 'client.js' })

console.log('registered id   :', registration?.id)
console.log('factory arity   :', registration?.factory?.length)

const React = { createElement: () => {}, useState: () => [], useEffect: () => {} }
const required = []
let exports
try {
  exports = registration.factory(specifier => {
    required.push(specifier)
    if (specifier === 'react') return React
    throw new Error(`client-modules: dsh-plus-plus/client.js requested external "${specifier}" before the module system existed`)
  })
} catch (error) {
  console.log('FACTORY THREW   :', error.message)
  process.exit(1)
}

console.log('required specs  :', JSON.stringify(required))
console.log('exports keys    :', Object.keys(exports))
console.log('typeof apply    :', typeof exports.apply)
console.log('typeof name     :', typeof exports.name)
console.log('toStringTag     :', Object.prototype.toString.call(exports))

// The loader requires `inject` to name services it waits for before calling apply.
const inject = exports.inject
console.log('inject          :', JSON.stringify([...(inject ?? [])]))

// Apply with a minimal context to see whether registration itself throws.
const noop = () => {}
const seen = []
try {
  exports.apply({
    effect: (fn, label) => { const d = fn(); seen.push(label); return typeof d === 'function' ? d : noop },
    locale: { register: () => noop, bind: () => key => key },
    slots: { inject: () => noop, register: () => noop },
  })
  console.log('apply ok        :', seen.join(', '))
  console.log('style tags      :', styleTags.length, '·', styleTags[0]?.textContent?.length ?? 0, 'bytes')
} catch (error) {
  console.log('APPLY THREW     :', error.message)
}
