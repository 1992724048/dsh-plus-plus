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
        'surface.subtitle': '主题背景图铺满整个窗口；工作区侧边栏与顶部标题栏提到80%不透明并模糊；会话功能栏80%半透明悬浮于内容之上，消息可滚入其下；内容区铺白色文章卡片，底部输入框除外；右侧会话面板浮动模糊、高度与会话内容区一致，且压在输入框、回到底部按钮与记录导航条之上。',
      },
      en: {
        'surface.title': 'Surfaces',
        'surface.subtitle': 'A themed backdrop fills the window; the sidebar and title bar wash it at 80% with blur; the conversation bar veils and floats above the thread, which scrolls beneath it; the thread keeps its white article card; the right panel floats as a blurred window at the content area height, stacked above the composer, the to-bottom button and the turn navigator.',
      },
    }

    const PALETTE = {
      '--dsw-alias-bg-base': { light: 'rgb(249 250 251)', dark: 'rgb(28 28 30)' },
      '--dsw-specific-sidebar-fill': {
        light: 'linear-gradient(rgb(255 255 255 / 80%), rgb(255 255 255 / 80%)), url("/api/dsh-plus-plus/assets/bk.jpg") fixed center / cover no-repeat, rgb(255 255 255)',
        dark: 'linear-gradient(rgb(20 20 22 / 80%), rgb(20 20 22 / 80%)), url("/api/dsh-plus-plus/assets/bg.jpg") fixed center / cover no-repeat, rgb(20 20 22)',
      },
      '--pp-surface-chat-image': {
        light: 'url("/api/dsh-plus-plus/assets/bk.jpg")',
        dark: 'url("/api/dsh-plus-plus/assets/bg.jpg")',
      },
      '--pp-surface-article-card': {
        light: 'rgb(255 255 255 / 85%)',
        dark: 'rgb(255 255 255 / 12%)',
      },
      '--pp-surface-header-veil': {
        light: 'rgb(255 255 255 / 80%)',
        dark: 'rgb(20 20 22 / 80%)',
      },
      '--pp-surface-panel-veil': {
        light: 'rgb(255 255 255 / 65%)',
        dark: 'rgb(20 20 22 / 65%)',
      },
      '--pp-surface-blur': { light: '16px', dark: '16px' },
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

html[data-windows-titlebar] [class*="_frame"]::before {
  background-image: none;
  background-color: var(--pp-surface-header-veil);
  -webkit-backdrop-filter: blur(var(--pp-surface-blur));
  backdrop-filter: blur(var(--pp-surface-blur));
}

html [data-slot="conversation.header"] > * {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 5;
  background-color: var(--pp-surface-header-veil);
}

html [data-conversation-scroll] {
  padding-top: var(--pp-header-height, 76px);
}

html[data-windows-titlebar] [class*="_frame"]:not([data-rightbar-collapsed]) {
  grid-template-columns: var(--dsh-windows-sidebar-width) minmax(0, 1fr) !important;
}

html [class*="_frame"] > [class*="_rightbarCol"] {
  position: absolute;
  top: var(--dsh-frame-top-clearance, 0px);
  right: 0;
  bottom: 0;
  z-index: 10;
  background-color: var(--pp-surface-panel-veil);
  -webkit-backdrop-filter: blur(var(--pp-surface-blur));
  backdrop-filter: blur(var(--pp-surface-blur));
  border-left: .5px solid var(--dsw-alias-border-l3);
}

html [class*="_body"] > [class*="_workspaceRow"] {
  z-index: 4 !important;
}

html [class*="_frame"][data-rightbar-collapsed] > [class*="_rightbarCol"] {
  display: none;
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

        ctx.effect(() => {
          let observer
          let watched = null

          const poll = setInterval(() => {
            const anchor = document.querySelector('[data-slot="conversation.header"]')
            const header = anchor?.firstElementChild ?? null
            if (header === watched) return
            if (observer) observer.disconnect()
            watched = header
            observer = undefined
            if (header === null) return
            observer = new ResizeObserver(() => {
              document.documentElement.style.setProperty('--pp-header-height', `${header.offsetHeight}px`)
            })
            observer.observe(header)
            document.documentElement.style.setProperty('--pp-header-height', `${header.offsetHeight}px`)
          }, 250)

          return () => {
            clearInterval(poll)
            if (observer) observer.disconnect()
          }
        }, 'dsh-plus-plus: conversation header')
      },
    }
    return module.exports
  },
})
