/**
 * Client-bundle smoke test.
 *
 * The browser half is a hand-written ModuleLoader bundle, so it has no test runner
 * and no module graph. This parses it the way the loader does and runs `apply`
 * against a stub client context, asserting that every registration lands and that
 * the font stylesheet points at real, servable routes.
 *
 * Run: `node scripts/client-selftest.mjs`
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

import { FAMILIES, assetRoot } from '../src/fonts.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const FONT_ROUTE = '/api/dsh-plus-plus/fonts'

const noop = () => {}
const tests = []
const test = (name, fn) => tests.push([name, fn])

// ── harness ──────────────────────────────────────────────────────────────────

/** Parse client.js and run its factory against a stub, collecting every effect. */
function boot() {
  const descriptor = {}
  const inserted = []
  const effects = []

  // The sandbox deliberately provides ONLY what a real page provides. In particular
  // it does not define `styles`: that builtin belongs to the *dynamic* client-half
  // path (`evaluateClientHalf`), not to a `__ModuleLoader__` bundle, whose factory
  // receives just `require`. Supplying it here once hid a boot failure that only
  // appears in the real shell.
  const styleTags = []
  const sandbox = {
    window: { __ModuleLoader__: { load: value => Object.assign(descriptor, value) } },
    console,
    document: {
      documentElement: { lang: 'zh' },
      createElement: tag => (tag === 'style'
        ? { tag, textContent: '', setAttribute: noop, remove: () => { styleTags.pop() } }
        : {}),
      head: {
        appendChild: node => { styleTags.push(node); return node },
      },
    },
    fetch: async () => ({ ok: true, status: 200 }),
    setInterval: noop,
    clearInterval: noop,
  }
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'client.js'), 'utf8'), sandbox, { filename: 'client.js' })

  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: initial => [initial, noop],
    useEffect: noop,
  }
  sandbox.React = React

  const ctx = {
    effect(fn, label) {
      const dispose = fn()
      effects.push(label)
      return typeof dispose === 'function' ? dispose : noop
    },
    locale: {
      register: (ns, dicts) => { inserted.push(`__locale__${ns}:${Object.keys(dicts).join(',')}`); return noop },
      bind: () => key => key,
    },
    slots: {
      inject(key, callback) { effects.push(`inject:${key}`); callback(); return noop },
      register() { return noop },
    },
  }

  const exports = descriptor.factory(name => {
    if (name === 'react') return React
    throw new Error(`unexpected require: ${name}`)
  })
  exports.apply(ctx)

  return { descriptor, inserted, effects, exports, sandbox, styleTags }
}

/** The stylesheet the plugin inserted, read back out of the <style> tag. */
function stylesheet(result) {
  return result.styleTags.map(node => node.textContent ?? '').join('\n')
}

// ── tests ────────────────────────────────────────────────────────────────────

test('the bundle parses and registers as dsh-plus-plus', () => {
  const { descriptor, exports } = boot()
  assert.equal(descriptor.id, 'dsh-plus-plus')
  assert.equal(typeof exports.apply, 'function')
  // The bundle array comes from another vm realm, so compare its contents rather
  // than the reference: `deepEqual` would fail on the prototype difference alone.
  assert.deepEqual([...exports.inject], ['slots', 'locale'])
})

test('apply() runs to completion, as the shell requires at boot', () => {
  // The regression this guards: `apply` used to throw `styles is not defined`,
  // because the `styles` builtin belongs to the dynamic client-half path and not
  // to a `__ModuleLoader__` bundle. `boot()` throws if apply throws, so reaching
  // this assertion at all is the test — but say it explicitly so a failure names
  // the cause instead of surfacing as an opaque harness error.
  let result
  assert.doesNotThrow(() => { result = boot() }, 'apply(ctx) must not throw')
  assert.ok(result.effects.includes('dsh-plus-plus: fonts'), 'the font stylesheet effect must run')
  assert.equal(result.styleTags.length, 1, 'exactly one <style> tag must be inserted')
  assert.ok(result.styleTags[0].textContent.length > 0, 'the style tag must carry the stylesheet')
})

test('the bundle references no free variable the loader does not provide', () => {
  // `__ModuleLoader__` factories receive only `require` plus page globals. Any
  // other bare identifier resolves to a page global or throws at boot, so check
  // the handful this bundle is allowed to lean on.
  //
  // Comments are stripped first: prose like "served by the host" would otherwise
  // match `host.` and fail a test about code.
  const source = fs.readFileSync(path.join(ROOT, 'client.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  for (const builtin of ['styles', 'host', 'harness']) {
    assert.doesNotMatch(
      source,
      new RegExp(`(?<![.\\w$'"\`])${builtin}\\s*\\.`),
      `${builtin} is not provided to a __ModuleLoader__ bundle — use document.createElement or ctx`,
    )
  }
})

test('dictionaries, styles and the settings slot all register', () => {
  const { inserted, effects } = boot()
  const localeLine = inserted.find(entry => entry.startsWith('__locale__'))
  assert.ok(localeLine, 'the dictionary namespace must register')
  assert.ok(localeLine.includes('zh') && localeLine.includes('en'), 'both languages are required')
  assert.ok(effects.includes('inject:settings.section'), 'the settings section must register')
  assert.ok(effects.includes('dsh-plus-plus: fonts'), 'the font stylesheet effect must run')
})

test('both dictionary halves carry identical keys', () => {
  const source = fs.readFileSync(path.join(ROOT, 'client.js'), 'utf8')
  const block = /const DICT = \{[\s\S]*?\n {4}\}/.exec(source)?.[0]
  assert.ok(block, 'DICT must be locatable')
  const zhStart = block.indexOf('zh: {')
  const enStart = block.indexOf('en: {')
  assert.ok(zhStart >= 0 && enStart > zhStart, 'both halves must be present')
  const keys = text => new Set([...text.matchAll(/'([a-zA-Z.]+)':/g)].map(m => m[1]))
  const zh = keys(block.slice(zhStart, enStart))
  const en = keys(block.slice(enStart))
  // `locale.register` rejects an unbalanced namespace at runtime, so catch it here.
  for (const key of zh) assert.ok(en.has(key), `DICT.en is missing '${key}'`)
  for (const key of en) assert.ok(zh.has(key), `DICT.zh is missing '${key}'`)
})

test('every @import points at a route the host actually serves', () => {
  const css = stylesheet(boot())
  const imports = [...css.matchAll(/@import url\("([^"]+)"\)/g)].map(m => m[1])
  assert.ok(imports.length > 0, 'the stylesheet must import the packaged faces')

  for (const href of imports) {
    assert.ok(href.startsWith(`${FONT_ROUTE}/`), `${href} must sit under the font route`)
    const rest = href.slice(FONT_ROUTE.length + 1).split('/')
    const family = rest.shift()
    assert.ok(FAMILIES.includes(family), `${family} is not a served family`)
    // The stylesheet the browser will fetch next must exist on disk.
    const root = assetRoot(family)
    assert.ok(root !== undefined, `${family} must resolve to an asset root`)
    const file = path.resolve(root, rest.join('/'))
    assert.ok(file.startsWith(root + path.sep), `${href} must stay inside ${family}`)
    assert.ok(fs.existsSync(file), `${href} does not exist on disk`)
  }
})

test('the stack puts JetBrains Mono first and HarmonyOS Sans as the CJK fallback', () => {
  const css = stylesheet(boot())
  const mono = /--pp-font-mono:\s*([^;]+);/.exec(css)?.[1] ?? ''
  const sans = /--pp-font-sans:\s*([^;]+);/.exec(css)?.[1] ?? ''
  assert.match(mono, /^'JetBrains Mono'/, 'JetBrains Mono must lead the mono stack')
  assert.ok(mono.includes("'HarmonyOS Sans'"), 'HarmonyOS Sans must follow it for CJK')
  assert.match(sans, /^'HarmonyOS Sans'/, 'body text must lead with the Chinese face')
})

test('the stylesheet only reaches for font assets', () => {
  const css = stylesheet(boot())
  const urls = [...css.matchAll(/url\("([^"]+)"\)/g)].map(m => m[1])
  for (const url of urls) {
    const extension = url.split('?')[0].split('.').pop()
    assert.ok(['woff2', 'woff', 'css'].includes(extension), `${url} is not a font asset`)
  }
})

test('the host font variables are re-pointed at our stacks', () => {
  // Regression: the first version wrote `html, body { font-family }`, which any
  // class selector outranks — the sidebar changed but the conversation did not.
  // The conversation is built from these two host variables (including the
  // markdown heading ladder), so redefining them is what actually reaches it.
  const css = stylesheet(boot())
  const declared = (name) => new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(css)?.[1]?.trim()

  assert.equal(declared('--dsw-font-family'), 'var(--pp-font-sans)', 'body text must follow our sans stack')
  assert.equal(declared('--ds-font-family-code'), 'var(--pp-font-mono)', 'code must follow our mono stack')

  // And the stacks themselves must lead with the bundled faces.
  assert.match(declared('--pp-font-mono') ?? '', /^'JetBrains Mono'/)
  assert.match(declared('--pp-font-sans') ?? '', /^'HarmonyOS Sans'/)

  // Do not reintroduce a bare element rule: it is what silently lost the fight.
  assert.doesNotMatch(css, /^\s*html\s*,/m, 'an `html, body` rule loses to any class selector')
})

test('all six host radius tokens are zeroed', () => {
  const css = stylesheet(boot())
  const declared = (name) => new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(css)?.[1]?.trim()
  for (const token of ['xs', 'sm', 'md', 'lg', 'xl', 'panel']) {
    assert.equal(declared(`--dsw-radius-${token}`), '0px', `--dsw-radius-${token} must be zeroed`)
  }
  // The derived feature tokens are reset too, so a stale theme value cannot leak.
  for (const token of ['code-block-border-radius', 'guide-entry-radius', 'search-radius', 'terminal-radius', 'web-radius']) {
    assert.equal(declared(`--dsl-${token}`), '0px', `--dsl-${token} must be zeroed`)
  }
})

test('the hardcoded-length sweep wins over class rules but spares the round ones', () => {
  const css = stylesheet(boot())

  // The host hardcodes ~163 radii that no token reaches; the sweep must carry
  // !important to beat a `(0,1,0)` class selector.
  assert.match(css, /\*\s*\{\s*border-radius:\s*0\s*!important/, 'the sweep needs !important')

  // ...and must NOT blanket-redeclare corner-shape, which would square the
  // avatars and status dots the user asked to keep round. The host marks those
  // with `corner-shape: round`, so the sweep targets exactly that marker.
  assert.match(css, /\[style\*="corner-shape"\]\s*\{\s*corner-shape:\s*square\s*!important/,
    'the marker the host uses must be the one we key on')

  // No blanket rule: a `corner-shape` on :root would flatten everything the host
  // never marked, and a `*` rule would flatten the marker we rely on.
  assert.doesNotMatch(css, /:root\s*\{[^}]*corner-shape/, 'do not set corner-shape globally')
  assert.doesNotMatch(css, /\*\s*\{[^}]*corner-shape/, 'do not set corner-shape on every element')

  // The one legitimate `round` is the demo dot, which proves circles survive.
  const rules = [...css.matchAll(/([^{}]+)\{[^{}]*corner-shape:\s*(\w+)[^}]*\}/g)]
  assert.ok(rules.length > 0, 'at least one corner-shape rule must be present')
  for (const [, selector, value] of rules) {
    assert.match(selector, /\[style\*="corner-shape"\]|\.pp-demo__dot/,
      `unexpected corner-shape rule on ${selector.trim()}`)
    if (value === 'round') assert.match(selector, /\.pp-demo__dot/, 'only the demo dot may stay round')
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
