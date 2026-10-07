window.__ModuleLoader__.load({
  id: 'dsh-plus-plus/client.composer.js',
  factory: require => {
    const module = { exports: {} }
    const exports = module.exports

    const React = require('react')
    const { createElement: h } = React

    let corePromise
    const core = () => (corePromise ??= require.async('./client.core.js'))
    let declarationsPromise
    const declarations = () => (declarationsPromise ??= require.async('./client.composer.css.js'))

    const PERMISSION_SLOT = '[data-slot="conversation.input.permission"]'

    const PERMISSION_MODES = [
      { mode: 'readonly', match: '仅可查看' },
      { mode: 'readonly', match: '仅可' },
      { mode: 'readonly', match: '只读' },
      { mode: 'readonly', match: '查看' },
      { mode: 'readonly', match: 'Read-only' },
      { mode: 'readonly', match: 'Read only' },
      { mode: 'workspace', match: '工作区' },
      { mode: 'workspace', match: 'Workspace' },
      { mode: 'full', match: '完全权限' },
      { mode: 'full', match: '完全' },
      { mode: 'full', match: 'Full access' },
      { mode: 'full', match: 'Full' },
    ]

    const MODE_ATTR = 'data-pp-mode'

    function permissionText(button) {
      const label = button.getAttribute('aria-label') ?? ''
      const span = button.querySelector('[class*="triggerLabel"]')
      return label + ' ' + (span?.textContent ?? '')
    }

    function permissionMode(text) {
      for (const entry of PERMISSION_MODES) {
        if (text.includes(entry.match)) return entry.mode
      }
      return undefined
    }

    function watchPermission(button) {
      const paint = () => {
        const mode = permissionMode(permissionText(button))
        if (mode === undefined) button.removeAttribute(MODE_ATTR)
        else if (button.getAttribute(MODE_ATTR) !== mode) button.setAttribute(MODE_ATTR, mode)
      }

      paint()

      const observer = new MutationObserver(paint)
      observer.observe(button, { childList: true, subtree: true, characterData: true })
      return () => observer.disconnect()
    }

    const DICT = {
      zh: {
        'composer.title': '输入框',
        'composer.subtitle': '编辑区、工具行、各个按钮各自独立成块。亮色主题下编辑区半透明白色毛玻璃、附件与发送黑底；暗色主题相反。',
      },
      en: {
        'composer.title': 'Composer',
        'composer.subtitle': 'The editor, the tool row and every control are their own blocks. Light: a translucent white blurred editor with black attach and send. Dark: reversed.',
      },
    }

    function Settings({ t }) {
      return h('div', { className: 'pp-section' }, [
        h('h2', { className: 'pp-title' }, t('composer.title')),
        h('p', { className: 'pp-sub' }, t('composer.subtitle')),
      ])
    }

    exports.id = 'dsh-plus-plus/client.composer.js'
    exports.descriptor = {
      id: 'composer',
      group: 'ui',
      order: 30,
      locale: DICT,
      title: 'composer.title',
      settings: Settings,
      async apply(ctx) {
        const [{ registerStyles, applyPalette }, declaration] = await Promise.all([core(), declarations()])

        applyPalette(ctx, declaration.PALETTE, 'composer')
        registerStyles(ctx, `${declaration.CSS}\n${declaration.SEAT_CSS}`, 'composer')

        ctx.effect(() => {
          let stopWatching
          let ticks = 0

          const poll = setInterval(() => {
            const slot = document.querySelector(PERMISSION_SLOT)
            const button = slot?.querySelector('button')
            if (button === undefined || button === null) {
              if (++ticks > 40) clearInterval(poll)
              return
            }

            clearInterval(poll)
            stopWatching = watchPermission(button)
          }, 250)

          return () => {
            clearInterval(poll)
            if (typeof stopWatching === 'function') stopWatching()
          }
        }, 'dsh-plus-plus: permission mode')
      },
    }
    return module.exports
  },
})
