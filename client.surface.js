/**
 * Plus Plus — surface feature chunk.
 *
 * Swaps the conversation background with the workspace sidebar's, so the chat
 * column reads as the recessed area and the sidebar as the raised one — the
 * opposite of the host's default.
 *
 * ## Why `overrideTokens` rather than element rules
 *
 * The host paints the chat column `--dsw-alias-bg-base` and the sidebar
 * `--dsw-specific-sidebar-fill`, and a dozen components read those same variables.
 * Restyling the two elements in place would repaint only those elements and leave
 * every card, menu and popover derived from the same tokens out of step. Swapping
 * the two token values instead moves the whole surface system at once, and the
 * `{ light, dark }` map keeps both schemes consistent through a theme change.
 *
 * That is the same mechanism the composer palette uses, and the same reason: this
 * is a palette decision, not a layout one.
 *
 * ## What is swapped
 *
 *   --dsw-alias-bg-base          takes the sidebar's fill
 *   --dsw-specific-sidebar-fill  takes the chat's base
 *
 * `--dsw-alias-bg-layer-1` and `-2` are deliberately left alone. They are the
 * raised surfaces *inside* whichever column they appear in — cards, menus, inputs —
 * and re-pointing them would leave every popup a shade that belongs to neither
 * column.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plus-plus/client.surface.js',
  factory: require => {
    const module = { exports: {} }
    const exports = module.exports

    const React = require('react')
    const { createElement: h } = React

    /** The core chunk. See client.font.js for why this is require.async. */
    let corePromise
    const core = () => (corePromise ??= require.async('./client.core.js'))

    const DICT = {
      zh: {
        'surface.title': '界面底色',
        'surface.subtitle': '聊天区与工作区侧边栏交换底色：聊天区用侧边栏的浅灰，侧边栏用聊天区的底色。',
      },
      en: {
        'surface.title': 'Surfaces',
        'surface.subtitle': 'The conversation and the workspace sidebar swap backgrounds: the chat takes the sidebar tint, the sidebar takes the chat base.',
      },
    }

    /**
     * The swap, one entry per scheme.
     *
     * The values are the host's own, read from the live page: the chat column was
     * `rgb(255, 255, 255)` and the sidebar `rgb(249, 250, 251)` in light. Writing
     * them as the host's own variables rather than the literals keeps the pair
     * self-describing and survives a host token rename only in one place.
     *
     * Declared per scheme because the host's own defaults differ per scheme — a
     * single value pair would flatten that difference and one of the two columns
     * would come out the wrong shade in one theme.
     */
    const PALETTE = {
      // Chat column → the sidebar's raised tint.
      '--dsw-alias-bg-base': { light: 'rgb(249 250 251)', dark: 'rgb(28 28 30)' },
      // Sidebar → the chat's flat base.
      '--dsw-specific-sidebar-fill': { light: 'rgb(255 255 255)', dark: 'rgb(20 20 22)' },
    }

    /**
     * The composer seat, restated here because the swap moves the chat background
     * out from under it.
     *
     * The host fades the seat's top edge into `--dsw-alias-bg-base`. After the swap
     * that value is the sidebar tint, which no longer matches the chat column the
     * seat actually sits on — so the fade would show as a mismatched band. The seat
     * rule is the same one the composer chunk applies; both chunks target it, and
     * the composer runs first, so this one is only a backstop for the case where
     * the composer feature is off.
     *
     * No `!important` is used here: this is a plain fallback, and the composer's own
     * rule carries the flag that actually wins.
     */
    const CSS = `
[class*="composerSeat"] {
  background: linear-gradient(180deg, rgb(0 0 0 / 0%) 0px, rgb(0 0 0 / 0%) 36px);
}
`.trim()

    function Settings({ t }) {
      return h('div', { className: 'pp-section' }, [
        h('h2', { className: 'pp-title' }, t('surface.title')),
        h('p', { className: 'pp-sub' }, t('surface.subtitle')),
      ])
    }

    exports.id = 'dsh-plus-plus/client.surface.js'
    exports.descriptor = {
      id: 'surface',
      group: 'theme',
      // After `composer`: the composer's own seat rule carries !important and must
      // keep the last word, so this fallback lands beneath it.
      order: 40,
      locale: DICT,
      css: CSS,
      palette: PALETTE,
      title: 'surface.title',
      settings: Settings,
      async apply(ctx) {
        const { registerStyles, applyPalette } = await core()
        applyPalette(ctx, PALETTE, 'surface')
        registerStyles(ctx, CSS, 'surface')
      },
    }
    return module.exports
  },
})
