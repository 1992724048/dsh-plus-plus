/**
 * Properties of the bundle files themselves, independent of any feature.
 *
 * These are the checks that keep a *whole class* of mistake out rather than one
 * instance of it: a stylesheet that does not parse, a CSS comment that closes its
 * template literal, or a stub that answers less than the host does.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

import { ROOT, allChunkFiles, bootRun, readCode, test } from './harness.mjs'

test('every bundle parses as JavaScript on its own', () => {
  // `compileFunction(source, params, options)` — params is an array.
  for (const file of ['client.js', ...allChunkFiles()]) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8')
    assert.doesNotThrow(() => vm.compileFunction(source, [], { filename: file }),
      `${file} does not parse`)
  }
})

test('no bundle puts a raw backtick inside a CSS template literal', () => {
  // FIVE times. A comment quoting code closed the enclosing template literal early
  // and turned the rest of the stylesheet into JavaScript — each time a dozen
  // unrelated tests reported a syntax error before the real cause was named:
  //
  //   1. styles.insert        2. inherit        3. an aria-label selector
  //   4. a display rule       5. a max-width rule, and a hex colour
  //
  // The rule is deliberately blunt: it does not ask whether the backtick is
  // *needed*, only whether one appears inside a CSS literal. Writing one there is
  // always a mistake here, so the rule is "never", not "be careful".
  const offenders = []
  for (const file of ['client.js', ...allChunkFiles()]) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8')
    for (const match of source.matchAll(/const\s+(\w*CSS\w*)\s*=\s*`/g)) {
      const start = match.index + match[0].length
      // Walk the literal to its true end, honouring escapes.
      let end = start
      for (;;) {
        end = source.indexOf('`', end)
        if (end < 0) {
          offenders.push(`${file} ${match[1]}: unterminated template literal`)
          break
        }
        let backslashes = 0
        for (let i = end - 1; i >= start && source[i] === '\\'; i -= 1) backslashes += 1
        if (backslashes % 2 === 0) break
        end += 1
      }
      if (end < 0) continue
      const body = source.slice(start, end)
      const at = body.indexOf('`')
      if (at < 0) continue
      // Report the file, the literal and the line, so the fix is obvious.
      const line = source.slice(0, start + at).split('\n').length
      const text = body.slice(at).split('\n')[0].trim()
      offenders.push(`${file} ${match[1]} ~line ${line}: ${text.slice(0, 60)}`)
    }
  }
  assert.deepEqual(offenders, [],
    `a backtick inside a CSS template literal closes it early — write the code without backticks:\n    ${offenders.join('\n    ')}`)
})

test('no CSS comment inside a stylesheet quotes code in backticks', () => {
  // The same rule one step earlier, because every one of the five slipped in
  // through a comment. Scoped to CSS literals: backticks in *JavaScript* comments
  // are fine, since they never cross a literal boundary.
  const offenders = []
  for (const file of ['client.js', ...allChunkFiles()]) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8')
    for (const match of source.matchAll(/const\s+(\w*CSS\w*)\s*=\s*`/g)) {
      const start = match.index + match[0].length
      let end = start
      for (;;) {
        end = source.indexOf('`', end)
        let backslashes = 0
        for (let i = end - 1; i >= start && source[i] === '\\'; i -= 1) backslashes += 1
        if (backslashes % 2 === 0) break
        end += 1
      }
      for (const comment of source.slice(start, end).matchAll(/\/\*([\s\S]*?)\*\//g)) {
        if (!comment[1].includes('`')) continue
        const line = source.slice(0, start + comment.index).split('\n').length
        const text = comment[1].split('\n').find(l => l.includes('`')).trim()
        offenders.push(`${file} ${match[1]} ~line ${line}: ${text.slice(0, 60)}`)
      }
    }
  }
  assert.deepEqual(offenders, [],
    `backticks inside a CSS comment end the template literal — describe the code in prose:\n    ${offenders.join('\n    ')}`)
})

test('the stylesheet only reaches for font assets', async () => {
  const { styleTags } = await bootRun()
  const css = styleTags.map(node => node.textContent ?? '').join('\n')
  for (const url of [...css.matchAll(/url\("([^"]+)"\)/g)].map(m => m[1])) {
    const extension = url.split('?')[0].split('.').pop()
    assert.ok(['woff2', 'woff', 'css'].includes(extension), `${url} is not a font asset`)
  }
})

// ── stub fidelity ────────────────────────────────────────────────────────────

test('the stub context models ctx.get, or features silently degrade to no-ops', async () => {
  // Twice now a stub has hidden a real bug: the host one returned a fresh service
  // object per `get`, and this one had no `get` at all — so `applyPalette` took its
  // "no theme service" branch and the palette silently never applied, with every
  // other test still green.
  //
  // A stub that answers nothing is the dangerous shape: a feature written to
  // degrade gracefully will, in the stub, do exactly that — and a test asserting the
  // descriptor still passes. So assert the stub's own fidelity.
  const { ctx, palettes } = await bootRun()
  assert.equal(typeof ctx.get, 'function', 'the stub must provide ctx.get')

  assert.equal(ctx.get('locale'), ctx.locale, 'ctx.get must return the same object as the property')
  assert.equal(ctx.get('slots'), ctx.slots, 'ctx.get must return the same object as the property')
  assert.equal(ctx.get('theme'), ctx.theme, 'ctx.get must return the same object as the property')
  assert.equal(ctx.get('locale'), ctx.get('locale'), 'repeated get must return the identical object')
  assert.equal(ctx.get('absent'), undefined, 'an absent service must answer undefined')

  assert.ok(palettes.length > 0,
    'if this is 0 the stub is hiding the features; the features are not the problem')
})

test('the stub theme replaces a source layer rather than appending', async () => {
  // The third fidelity gap: the host stores overrides in a `Map<source, layer>`, so
  // a repeat source replaces its whole layer. A stub that only appended would let
  // two features share a source without complaint — which is exactly the bug that
  // shipped and made the composer's backgrounds vanish.
  const result = await bootRun()
  const { ctx, palettes, paletteHistory } = result

  ctx.get('theme').overrideTokens('probe', { '--pp-probe': { light: '#fff', dark: '#000' } })
  const dispose = ctx.get('theme').overrideTokens('probe', { '--pp-probe': { light: '#000', dark: '#fff' } })
  assert.equal(typeof dispose, 'function', 'the host returns a disposer')

  // Both probe calls must be recorded — alongside the features' own layers, so
  // filter to this source.
  const recorded = paletteHistory.filter(entry => entry.source === 'probe')
  assert.equal(recorded.length, 2, 'both probe calls must be recorded')
  // Two calls recorded, but only one surviving layer — that difference *is* the
  // replacement semantics.
  const surviving = palettes.filter(entry => entry.source === 'probe')
  assert.equal(surviving.length, 1, 'a repeat source must leave exactly one layer')
  assert.deepEqual(surviving[0].tokens['--pp-probe'], { light: '#000', dark: '#fff' },
    'the surviving layer must be the newer one')

  // Disposing removes it, exactly as the host's does.
  dispose()
  assert.equal(palettes.filter(entry => entry.source === 'probe').length, 0)
})

test('readCode strips comments, so prose cannot satisfy a code assertion', () => {
  // Every source-level assertion in these tests goes through this. If it stopped
  // stripping, a comment mentioning a selector would make a missing rule look
  // present — the same failure shape as the stub gaps above.
  const stripped = readCode('client.shape.js')
  assert.ok(!/\/\*/.test(stripped), 'block comments must be gone')
  // The CSS is a template literal, so its own `/* */` are legitimately still there;
  // what matters is that the explanatory prose above the literal is not.
  assert.ok(!/sweep would flatten/.test(stripped), 'the prose comments must be gone')
})
