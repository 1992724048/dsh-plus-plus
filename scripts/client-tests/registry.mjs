/**
 * The core chunk: the feature registry, palette layers, dictionaries, and the
 * settings-page composition.
 */

import assert from 'node:assert/strict'

import { bootRun, test, themeStub } from './harness.mjs'

test('core is loaded once and is a singleton across chunks', async () => {
  const { cache } = await bootRun()
  const core = cache.get('client.core.js').exports
  assert.equal(typeof core.defineFeature, 'function')
  assert.equal(typeof core.registerStyles, 'function')
  assert.equal(typeof core.applyPalette, 'function')
  assert.equal(typeof core.dictionaries, 'function')
})

test('each feature chunk declares exactly one complete feature', async () => {
  const { cache } = await bootRun()
  const core = cache.get('client.core.js').exports
  const declared = core.listFeatures()
  const featureChunks = [...cache.keys()].filter(file => file !== 'client.core.js' && !file.endsWith('.css.js'))

  assert.equal(declared.length, featureChunks.length, 'one feature per chunk')
  for (const file of featureChunks) {
    const id = file.replace(/^client\.|\.js$/g, '')
    const feature = declared.find(entry => entry.id === id)
    assert.ok(feature, `${file} should declare "${id}"; got ${declared.map(f => f.id).join(', ')}`)
    assert.equal(typeof feature.apply, 'function', `${id} must provide apply()`)
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
  // `shape` must come after `font`, or a font rule could re-introduce a rounded
  // corner.
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

test('each feature gets its own palette layer — they do not overwrite each other', async () => {
  // The regression that shipped: the host stores overrides in a `Map<source, layer>`
  // and `overrideTokens` **replaces** a source's whole layer. Both the composer and
  // the surface chunks used one source, so the second to apply silently erased the
  // first one's tokens — and the composer stylesheet, whose backgrounds and borders
  // are all `var(--pp-composer-*)`, lost every one of them. The input box and its
  // buttons went backgroundless and borderless.
  //
  // Both `overrideTokens` calls *succeeded*, so no assertion keyed on the descriptor
  // could see it. This one checks the layer identities.
  const { palettes } = await bootRun()
  assert.ok(palettes.length >= 2, `expected a layer per feature, got ${palettes.length}`)

  const sources = palettes.map(entry => entry.source)
  assert.equal(new Set(sources).size, sources.length,
    `palette layers must have distinct sources; got ${sources.join(', ')}`)
  for (const source of sources) {
    assert.match(source, /^dsh-plus-plus\./,
      `${source} must be namespaced under this package so a host upgrade cannot collide`)
  }

  // The composer's tokens must survive *alongside* the surface's — that is what
  // "not overwritten" means in practice.
  const allTokens = palettes.flatMap(entry => Object.keys(entry.tokens))
  for (const token of ['--pp-composer-surface', '--pp-composer-stroke', '--dsw-alias-bg-base']) {
    assert.ok(allTokens.includes(token),
      `${token} went missing — one feature's layer replaced another's`)
  }
})

test('a palette layer is replaced, not stacked, when a feature re-applies', async () => {
  // The hot-reload case. Re-applying must leave exactly one layer for that feature
  // rather than accumulating.
  const { cache } = await bootRun()
  const core = cache.get('client.core.js').exports
  const { ctx, applied, disposed } = themeStub()
  const palette = { '--pp-x': { light: '#fff', dark: '#000' } }

  core.applyPalette(ctx, palette, 'demo')
  assert.deepEqual(applied, ['dsh-plus-plus.demo'])
  assert.deepEqual(disposed, [], 'the first apply has nothing to replace')

  core.applyPalette(ctx, palette, 'demo')
  assert.equal(applied.length, 2)
  assert.deepEqual(disposed, ['dsh-plus-plus.demo'],
    're-applying must release the previous layer first')

  // A label is mandatory: without one there is no layer identity.
  assert.throws(() => core.applyPalette(ctx, palette, ''), /needs a feature label/,
    'a palette with no layer identity would collide with every other feature')
})

test('core applies a palette through the theme service, and survives it being absent', async () => {
  const { cache } = await bootRun()
  const core = cache.get('client.core.js').exports
  const { ctx } = themeStub()
  const palette = { '--pp-x': { light: '#fff', dark: '#000' } }

  const dispose = core.applyPalette(ctx, palette, 'test')
  assert.equal(typeof dispose, 'function')

  // No theme service: the feature still loads, it just has no palette.
  const bare = { get: () => undefined }
  assert.doesNotThrow(() => core.applyPalette(bare, palette, 'test'),
    'a composition without themes must not fail a feature that declares a palette')
})

test('the merged dictionary is balanced across every feature', async () => {
  const { dictionaries } = await bootRun()
  const entry = dictionaries.find(d => d.ns === 'settings.plusPlus')
  assert.ok(entry, 'the entry must register its namespace')
  assert.deepEqual([...Object.keys(entry.dicts)].sort(), ['en', 'zh'])
  // Each feature's keys appear under its own prefix.
  assert.ok('font.font.title' in entry.dicts.zh, 'font keys must be prefixed')
  assert.ok('shape.shape.title' in entry.dicts.zh, 'shape keys must be prefixed')
  assert.ok('nav' in entry.dicts.zh, 'the entry keeps its own unprefixed keys')
})

test('the settings page composes one section per feature', async () => {
  const { slots, cache } = await bootRun()
  const page = slots.find(entry => entry.id === 'dsh-plus-plus')
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
  // disposer chain nested.
  const { effects } = await bootRun()
  const seen = new Map()
  for (const label of effects) seen.set(label, (seen.get(label) ?? 0) + 1)
  for (const [label, count] of seen) {
    assert.equal(count, 1, `effect "${label}" registered ${count} times`)
  }
})
