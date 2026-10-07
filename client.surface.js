window.__ModuleLoader__.load({
  id: 'dsh-plus-plus/client.surface.js',
  factory: require => {
    const module = { exports: {} }
    const exports = module.exports

    const React = require('react')
    const { createElement: h } = React

    let corePromise
    const core = () => (corePromise ??= require.async('./client.core.js'))

    const DICT = {
      zh: {
        'surface.title': '界面底色',
        'surface.subtitle': '聊天区与工作区侧边栏交换底色：聊天区用侧边栏的浅灰，侧边栏用聊天区的底色。聊天区另铺主题背景图——浅色 bk、暗色 bg，取自插件自带的 imgs 目录。',
      },
      en: {
        'surface.title': 'Surfaces',
        'surface.subtitle': 'The conversation and the workspace sidebar swap backgrounds: the chat takes the sidebar tint, the sidebar takes the chat base. The chat also carries a themed backdrop — bk in light, bg in dark — served from the plugin\'s imgs folder.',
      },
    }

    const PALETTE = {
      '--dsw-alias-bg-base': { light: 'rgb(249 250 251)', dark: 'rgb(28 28 30)' },
      '--dsw-specific-sidebar-fill': { light: 'rgb(255 255 255)', dark: 'rgb(20 20 22)' },
      '--pp-surface-chat-image': {
        light: 'url("/api/dsh-plus-plus/assets/bk.jpg")',
        dark: 'url("/api/dsh-plus-plus/assets/bg.jpg")',
      },
    }

    const CSS = `
[class*="composerSeat"] {
  background: linear-gradient(180deg, rgb(0 0 0 / 0%) 0px, rgb(0 0 0 / 0%) 36px);
}

[data-conversation-region="chat"] {
  background-image: var(--pp-surface-chat-image);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
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
