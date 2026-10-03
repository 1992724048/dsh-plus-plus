/**
 * Plus Plus — sharp-corner feature chunk.
 *
 * Flattens every corner in the shell while keeping what the host explicitly marked
 * as round. Written in, no switch — see README for why.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plus-plus/client.shape.js',
  factory: require => {
    const module = { exports: {} }
    const exports = module.exports

    const React = require('react')
    const core = require('dsh-plus-plus/client.core.js')
    const { createElement: h } = React
    const { defineFeature, registerStyles, dictionaries } = core

    const DICT = dictionaries('shape', {
      zh: {
        'shape.title': '直角',
        'shape.subtitle': '面板、卡片、按钮、输入框、代码块、标签全部改为直角；头像、状态点等圆形元素保留。',
        'shape.radiusScale': '圆角刻度',
        'shape.pills': '胶囊标签',
        'shape.roundKept': '保留圆形',
      },
      en: {
        'shape.title': 'Sharp corners',
        'shape.subtitle': 'Panels, cards, buttons, inputs, code blocks and chips are all square; avatars, status dots and other genuinely round elements keep their shape.',
        'shape.radiusScale': 'Radius scale',
        'shape.pills': 'Pill chips',
        'shape.roundKept': 'Kept round',
      },
    })

    /**
     * Two layers, because the host uses both styles.
     *
     * The radius scale: the host owns six `--dsw-radius-*` variables and most of
     * its CSS reads them rather than hardcoding a length, so zeroing the six
     * covers panels, cards, inputs, buttons, code blocks and modals. The five
     * `--dsl-*-radius` tokens derive from that scale and are reset explicitly, so
     * a stale theme value cannot leak through.
     *
     * The sweep: the host still hardcodes a length in ~163 rules, which no variable
     * reaches — including the 27 `999px` pills used for chips and tags. It needs
     * `!important` because the host's rules are class selectors `(0,1,0)` and a
     * universal selector is only `(0,0,0)`.
     *
     * Keeping the circles: the sweep would also flatten the 37 `border-radius: 50%`
     * rules for avatars, status dots, progress rings and the checkbox knob. The
     * host marks those with `corner-shape: round` (33 of the 37 carry it alongside
     * the `50%`), and that property is CSS Shapes' `corner-shape`. Declaring
     * `corner-shape: square` against that marker re-squares exactly what was
     * deliberately round, and nothing else.
     *
     * If a future runtime drops CSS Shapes, the degradation is "circles become
     * square too" — still consistent, just fewer circles.
     */
    const CSS = `
:root {
  --dsw-radius-xs: 0px;
  --dsw-radius-sm: 0px;
  --dsw-radius-md: 0px;
  --dsw-radius-lg: 0px;
  --dsw-radius-xl: 0px;
  --dsw-radius-panel: 0px;

  --dsl-code-block-border-radius: 0px;
  --dsl-guide-entry-radius: 0px;
  --dsl-search-radius: 0px;
  --dsl-terminal-radius: 0px;
  --dsl-web-radius: 0px;
}
* { border-radius: 0 !important; }
*::-webkit-scrollbar-thumb { border-radius: 0 !important; }
[style*="corner-shape"] { corner-shape: square !important; }
`.trim()

    /** A preview: a square card, a square pill, and the circle that survived. */
    function Settings({ t }) {
      return h('div', { className: 'pp-section' }, [
        h('h2', { className: 'pp-title' }, t('shape.title')),
        h('p', { className: 'pp-sub' }, t('shape.subtitle')),
        h('div', { className: 'pp-demo' }, [
          h('div', { className: 'pp-card' }, t('shape.radiusScale')),
          h('div', { className: 'pp-pill' }, t('shape.pills')),
          h('div', { className: 'pp-dot' }, null),
          h('span', { className: 'pp-sub' }, `${t('shape.roundKept')} ✓`),
        ]),
      ])
    }

    // Booted after `font`: both contribute to one stylesheet and at equal
    // specificity the later rule wins, so the corner sweep has the last word.
    defineFeature({
      id: 'shape',
      group: 'theme',
      order: 20,
      locale: DICT,
      css: CSS,
      title: 'shape.title',
      settings: Settings,
      apply(ctx) {
        registerStyles(ctx, CSS, 'shape')
      },
    })

    exports.id = 'dsh-plus-plus/client.shape.js'
    return module.exports
  },
})
