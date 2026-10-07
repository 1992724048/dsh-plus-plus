window.__ModuleLoader__.load({
  id: 'dsh-plus-plus/client.core.js',
  factory: require => {
    const module = { exports: {} }
    const exports = module.exports

    const FONT_ROUTE = '/api/dsh-plus-plus/fonts'
    const PACKAGE = 'dsh-plus-plus'

    const features = []

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

    function listFeatures() {
      return [...features].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    }

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
        }
      }
    }

    function registerStyles(ctx, css, label) {
      return ctx.effect(() => styleSheet(css, label), `dsh-plus-plus: ${label ?? 'styles'}`)
    }

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

    const paletteLayers = new Map()

    function applyPalette(ctx, palette, label) {
      const theme = ctx.get?.('theme')
      if (!theme?.overrideTokens || palette === undefined) return () => {}
      if (typeof label !== 'string' || label === '') {
        throw new Error('core: applyPalette needs a feature label — it is the layer identity')
      }

      const previous = paletteLayers.get(label)
      if (previous !== undefined) {
        try { previous() } catch { }
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
