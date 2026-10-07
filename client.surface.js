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
        'surface.subtitle': '主题背景图铺满整个窗口（浅色 bk、暗色 bg）；侧边栏与顶部标题栏半透明，透出底图；会话内容区像博客文章一样铺白色半透明卡片，底部输入框与按钮除外。',
      },
      en: {
        'surface.title': 'Surfaces',
        'surface.subtitle': 'A themed backdrop fills the whole window (bk in light, bg in dark); the sidebar and the top title bar stay translucent above it; the thread sits on a white translucent article card, with the composer and its buttons left off it.',
      },
    }

    const PALETTE = {
      '--dsw-alias-bg-base': { light: 'rgb(249 250 251)', dark: 'rgb(28 28 30)' },
      '--dsw-specific-sidebar-fill': { light: 'rgb(255 255 255 / 50%)', dark: 'rgb(20 20 22 / 50%)' },
      '--pp-surface-chat-image': {
        light: 'url("/api/dsh-plus-plus/assets/bk.jpg")',
        dark: 'url("/api/dsh-plus-plus/assets/bg.jpg")',
      },
      '--pp-surface-article-card': {
        light: 'rgb(255 255 255 / 85%)',
        dark: 'rgb(255 255 255 / 12%)',
      },
    }

    const CSS = `
[class*="composerSeat"] {
  background: linear-gradient(180deg, rgb(0 0 0 / 0%) 0px, rgb(0 0 0 / 0%) 36px);
}

html [class*="_frame"]:has(> [class*="_sidebarCol"]) {
  background-image: var(--pp-surface-chat-image);
  background-attachment: fixed;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

html [class*="_root"]:has([data-conversation-region="chat"]) {
  background-image: var(--pp-surface-chat-image);
  background-attachment: fixed;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

[data-conversation-region="chat"] {
  background-image: var(--pp-surface-chat-image);
  background-attachment: fixed;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

[data-conversation-scroll]::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: var(--dsh-composer-height, 0px);
  left: 0;
  right: 0;
  width: calc(var(--dsh-chat-content-width, 680px) + 48px);
  margin-inline: auto;
  background: var(--pp-surface-article-card);
  pointer-events: none;
  z-index: -1;
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
