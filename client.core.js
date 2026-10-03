/**
 * Plus Plus — core chunk.
 *
 * The shared layer every feature chunk builds on: the feature registry, stylesheet
 * ownership, and the bilingual dictionary check. A feature chunk never touches
 * `document` or the dictionary plumbing itself — it declares a descriptor and this
 * layer does the work, so adding a feature never means editing this file.
 *
 * Loaded as `require('dsh-plus-plus/client.core.js')`.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plus-plus/client.core.js',
  factory: require => {
    const module = { exports: {} }
    const exports = module.exports

    /** Route prefix served by the host. Must match `FONT_ROUTE` in src/fonts.js. */
    const FONT_ROUTE = '/api/dsh-plus-plus/fonts'

    /**
     * This package's name.
     *
     * Used as the prefix of every palette layer's `source`, so each feature gets its
     * own layer — see {@link applyPalette}.
     */
    const PACKAGE = 'dsh-plus-plus'

    // ── feature registry ───────────────────────────────────────────────────────
    /**
     * The one place a feature is declared.
     *
     * `client.js` reads this list to decide what to load and in what order, so a
     * new feature is exactly two things: a chunk exporting a descriptor, and one
     * `defineFeature({ … })` call in it. Nothing else enumerates features — not the
     * settings page, not the loader, not the tests.
     *
     * Order is boot order, and it matters: features can both contribute to one
     * stylesheet, and at equal specificity the later rule wins. `shape` after
     * `font` is what keeps a font rule from re-introducing a rounded corner.
     */
    const features = []

    /**
     * Declare one feature.
     *
     * Throws on a duplicate id rather than letting the second registration shadow
     * the first: two features claiming the same id is always a copy-paste error,
     * and it is far cheaper to find at load than to debug as a missing effect.
     */
    function defineFeature(descriptor) {
      if (typeof descriptor?.id !== 'string' || descriptor.id === '') {
        throw new Error('core: a feature needs a string id')
      }
      if (features.some(entry => entry.id === descriptor.id)) {
        throw new Error(`core: duplicate feature id "${descriptor.id}"`)
      }
      features.push(Object.freeze({ group: 'misc', ...descriptor }))
      return descriptor
    }

    /** Every declared feature, in ascending `order`. */
    function listFeatures() {
      return [...features].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    }

    // ── stylesheets ────────────────────────────────────────────────────────────
    /**
     * Insert one stylesheet and return its disposer.
     *
     * A `<style>` tag is used rather than the `styles` builtin: this bundle is
     * loaded through `window.__ModuleLoader__`, whose factory receives only
     * `require`. `styles` exists solely on the dynamic client-half path
     * (`evaluateClientHalf`), so referencing it here throws `styles is not defined`
     * and fails the whole entry at boot.
     *
     * The tag is tagged `data-plugin` because the loader's `claimStyles` treats any
     * untagged `<style>` as belonging to whichever factory ran last — which would
     * hand its HMR bookkeeping the wrong owner and break teardown.
     */
    function styleSheet(css, label) {
      if (typeof css !== 'string' || css.trim() === '') return () => {}
      const style = document.createElement('style')
      style.setAttribute('data-plugin', 'dsh-plus-plus')
      if (label !== undefined) style.setAttribute('data-feature', label)
      style.textContent = css
      document.head.appendChild(style)
      return () => {
        try {
          style.remove()
        } catch {
          /* already detached */
        }
      }
    }

    /**
     * Register a stylesheet inside an effect, returning the effect's disposer.
     *
     * Wrapping rather than exposing `styleSheet` directly means a caller never has
     * to reason about *when* the tag is removed — the fiber owns that.
     */
    function registerStyles(ctx, css, label) {
      return ctx.effect(() => styleSheet(css, label), `dsh-plus-plus: ${label ?? 'styles'}`)
    }

    // ── bilingual dictionary ───────────────────────────────────────────────────
    /**
     * Validate one namespace's dictionaries and return them.
     *
     * `locale.register` enforces bilingual balance at registration time, which is
     * the browser: a mismatch surfaces as a boot failure with no clue which key is
     * wrong. Checking here names the offending keys instead.
     */
    function dictionaries(name, dicts) {
      const halves = Object.keys(dicts ?? {})
      if (halves.length === 0) throw new Error(`core: ${name} has no dictionaries`)
      const [reference, ...rest] = halves
      const expected = Object.keys(dicts[reference]).sort()
      for (const half of rest) {
        const actual = Object.keys(dicts[half]).sort()
        const missing = expected.filter(key => !actual.includes(key))
        const extra = actual.filter(key => !expected.includes(key))
        if (missing.length > 0 || extra.length > 0) {
          throw new Error(
            `core: ${name}.${half} is out of balance — missing ${missing.join(', ') || 'none'}`
            + `; unexpected ${extra.join(', ') || 'none'}`,
          )
        }
      }
      return dicts
    }

    /**
     * The palettes applied so far, as one merged map per source prefix.
     *
     * The host stores overrides in a `Map<source, layer>`: calling
     * `overrideTokens` with a source it already holds **replaces that source's whole
     * layer** rather than merging into it. So one source can carry exactly one
     * layer, and two features sharing a source would silently erase each other —
     * the second to apply wins and the first one's tokens stop resolving, taking
     * its stylesheet's backgrounds and borders with them.
     *
     * That is not hypothetical: the surface chunk re-pointed the host's
     * `--dsw-alias-bg-base`, which wiped the composer chunk's palette and left the
     * input box and its buttons with no background and no border at all.
     *
     * The fix is a `source` per feature — the host pins the prefix to this package,
     * so only the suffix is ours to choose — plus a per-source registry so a hot
     * reload replaces one feature's layer instead of stacking a second one.
     */
    const paletteLayers = new Map()

    /**
     * Apply one feature's palette as a host token layer.
     *
     * `theme.overrideTokens(source, tokens)` takes a `{ light, dark }` map per token
     * and recomposes it whenever the scheme changes — the host's own light/dark
     * mechanism, so a feature declares both schemes once and never has to know how
     * the shell scopes its themes.
     *
     * Idempotent per feature: calling twice for the same `label` releases the
     * previous layer first, so a hot reload that re-applies the plugin replaces
     * rather than accumulates.
     *
     * Returns a no-op when the `theme` service is absent, so a feature with a
     * palette still loads on a composition without themes rather than failing.
     *
     * @param {object} ctx Client context.
     * @param {object} palette `{ token: { light, dark } }`.
     * @param {string} label Feature id; becomes this feature's layer identity.
     * @returns {() => void} Disposer for this feature's layer only.
     */
    function applyPalette(ctx, palette, label) {
      const theme = ctx.get?.('theme')
      if (!theme?.overrideTokens || palette === undefined) return () => {}
      if (typeof label !== 'string' || label === '') {
        throw new Error('core: applyPalette needs a feature label — it is the layer identity')
      }

      // A reload of the same feature replaces its own layer and nothing else.
      const previous = paletteLayers.get(label)
      if (previous !== undefined) {
        try { previous() } catch { /* the layer is already gone */ }
        paletteLayers.delete(label)
      }

      const dispose = theme.overrideTokens(`${PACKAGE}.${label}`, palette)
      const release = () => {
        if (paletteLayers.get(label) !== release) return
        paletteLayers.delete(label)
        if (typeof dispose === 'function') dispose()
      }
      paletteLayers.set(label, release)
      return release
    }

    exports.id = 'dsh-plus-plus/client.core.js'
    exports.PACKAGE = PACKAGE
    exports.FONT_ROUTE = FONT_ROUTE
    exports.features = features
    exports.defineFeature = defineFeature
    exports.listFeatures = listFeatures
    exports.styleSheet = styleSheet
    exports.registerStyles = registerStyles
    exports.applyPalette = applyPalette
    exports.dictionaries = dictionaries
    return module.exports
  },
})
