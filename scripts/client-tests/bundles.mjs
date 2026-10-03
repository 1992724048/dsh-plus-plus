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

import { ROOT, allChunkFiles, bootRun, featureChunkFiles, readCode, test } from './harness.mjs'

test('the entry is newer than every chunk it requires', () => {
  // The shell derives an entry's revision from the *entry file's* metadata —
  // framedHash over mtimeMs, ctimeMs and size — and resolves a chunk against that
  // same revision. It never hashes the chunk's own bytes.
  //
  // So editing a chunk without touching the entry leaves the browser's cached URL
  // looking fresh and the change silently does not appear: no error, no crash, and
  // no amount of restarting helps, because a restart re-derives the same revision
  // from the same unchanged mtime. Several rounds of composer fixes looked like
  // no-ops for exactly this reason.
  //
  // `npm run watch` keeps the entry ahead of its chunks. This asserts the invariant
  // that makes the watcher necessary, so a stale tree is caught here rather than by
  // someone wondering why the screen did not change.
  const entryMtime = fs.statSync(path.join(ROOT, 'client.js')).mtimeMs
  const stale = featureChunkFiles()
    .filter(file => fs.statSync(path.join(ROOT, file)).mtimeMs > entryMtime)

  assert.deepEqual(stale, [],
    `these chunks are newer than client.js, so the browser keeps serving a stale revision: ${stale.join(', ')}\n`
    + '    run `npm run sync:entry`, or keep `npm run watch` running, then refresh the page')
})

test('every bundle parses, and a failure names the line', () => {
  // The only backtick guard that has ever been reliable, and it is this simple one.
  //
  // SIX times a comment quoting code closed a CSS template literal early:
  // styles.insert, inherit, an aria-label selector, a display rule, a max-width
  // rule and a hex colour, and finally a transform plus an align-items rule. Each
  // time the symptom was a syntax error in code far from the cause.
  //
  // Two guards tried to find the stray backtick and both failed: one walked
  // opener→closer, which — once the literal was already closed — walked into the
  // *next* literal and reported nothing; the other scanned every block comment and
  // produced 31 false positives on the JS comments that legitimately name
  // `require.async`.
  //
  // So this does not search at all. A file that parses is correct by definition,
  // and a file that does not is caught here. The line number is derived from the
  // error position, which is what a search would have been for.
  for (const file of ['client.js', ...allChunkFiles()]) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8')
    try {
      // `compileFunction(source, params, options)` — params is an array.
      vm.compileFunction(source, [], { filename: file })
    } catch (error) {
      // Node reports the position for a syntax error; turn it into a line so the
      // comment that has to be reworded is immediately findable.
      const stack = String(error.stack ?? '')
      const position = /:(\d+)\n/.exec(stack)
      const line = position === null ? '?' : position[1]
      // The reported line is where the parser noticed; the stray backtick is at or
      // just before it, so show that neighbourhood.
      const lines = source.split('\n')
      const at = Number(line) - 1
      const near = lines.slice(Math.max(0, at - 2), at + 1)
        .map((text, i) => `      ${Math.max(1, at - 1) + i} | ${text}`)
        .join('\n')
      assert.fail(
        `${file} does not parse: ${error.message}\n`
        + `    the usual cause is a backtick inside a CSS comment closing the template literal early\n`
        + `${near}`,
      )
    }
  }
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
