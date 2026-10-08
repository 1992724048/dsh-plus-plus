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
        'surface.subtitle': '主题背景图铺满整个窗口；侧边栏与顶部标题栏80%不透明并模糊；会话功能栏用同款分层底、滚动内容不再透出；会话信息固定到功能栏右下与页签对齐；内容区白色文章卡片；右侧面板弹出式模糊窗口，层级压过输入区与导航条。',
      },
      en: {
        'surface.title': 'Surfaces',
        'surface.subtitle': 'A themed backdrop fills the window; the sidebar and title bar wash it at 80% with blur; the conversation bar layers the same wash so scrolling content no longer ghosts through; the session info pins to the bar beside the tabs; the thread keeps its white article card; the right panel pops in as a blurred window stacked above the composer and the navigator.',
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

html [data-conversation-composer-overlay] {
  background: var(--dsw-specific-sidebar-fill);
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
  z-index: 8;
  background: var(--dsw-specific-sidebar-fill);
}

html [data-conversation-scroll] {
  padding-top: var(--pp-header-height, 76px);
  scrollbar-gutter: stable;
}

html [class*="composerSeat"] {
  z-index: 9 !important;
}

html [data-conversation-region] [data-composer-card] ~ [class*="_dock"] {
  position: fixed;
  top: calc(var(--dsh-frame-top-clearance, 0px) + var(--pp-header-height, 76px));
  right: 12px;
  transform: translateY(calc(-100% - 7px));
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
  visibility: hidden;
  opacity: 0;
  transform: translateX(20px);
}

@media (prefers-reduced-motion: no-preference) {
  html [class*="_frame"] > [class*="_rightbarCol"] {
    transition: opacity .16s ease, transform .16s ease;
  }

  html [class*="_frame"][data-rightbar-collapsed] > [class*="_rightbarCol"] {
    transition: opacity .16s ease, transform .16s ease, visibility 0s linear .16s;
  }
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
