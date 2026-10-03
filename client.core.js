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
     * Apply one feature's palette as a host token layer.
     *
     * `theme.overrideTokens(source, tokens)` takes a `{ light, dark }` map per token
     * and recomposes it whenever the scheme changes — which is the host's own
     * light/dark mechanism, so a feature declares both schemes once and never has
     * to know how the shell scopes its themes.
     *
     * It is idempotent by contract: "calling again with the same source replaces
     * that source's whole layer and restacks it on top", so a hot reload that
     * applies the plugin again does not stack duplicates. `source` is pinned to
     * this package by the host's façade, so passing `label` is only for readability.
     *
     * Returns a no-op when the `theme` service is absent, so a feature with a
     * palette still loads on a composition without themes rather than failing.
     */
    function applyPalette(ctx, palette, label) {
      const theme = ctx.get?.('theme')
      if (!theme?.overrideTokens || palette === undefined) return () => {}
      const dispose = theme.overrideTokens('dsh-plus-plus', palette)
      void label
      return typeof dispose === 'function' ? dispose : () => {}
    }

    exports.id = 'dsh-plus-plus/client.core.js'
    exports.PACKAGE = 'dsh-plus-plus'
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
