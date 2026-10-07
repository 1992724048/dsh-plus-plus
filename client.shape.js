window.__ModuleLoader__.load({
  id: 'dsh-plus-plus/client.shape.js',
  factory: require => {
    const module = { exports: {} }
    const exports = module.exports

    const React = require('react')
    const { createElement: h } = React

    let corePromise
    const core = () => (corePromise ??= require.async('./client.core.js'))

    const DICT = {
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
    }

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

    exports.id = 'dsh-plus-plus/client.shape.js'
    exports.descriptor = {
      id: 'shape',
      group: 'theme',
      order: 20,
      locale: DICT,
      css: CSS,
      title: 'shape.title',
      settings: Settings,
      async apply(ctx) {
        const { registerStyles } = await core()
        registerStyles(ctx, CSS, 'shape')
      },
    }
    return module.exports
  },
})
