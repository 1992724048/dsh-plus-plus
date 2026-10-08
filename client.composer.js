window.__ModuleLoader__.load({
  id: 'dsh-plus-plus/client.composer.js',
  factory: require => {
    const module = { exports: {} }
    const exports = module.exports

    const React = require('react')
    const { createElement: h } = React
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    const { IconPaperclipOutlineRegular, Tooltip } = primitives

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
        'composer.subtitle': '编辑区、工具行、各个按钮各自独立成块。两个主题下编辑区均为半透明白色毛玻璃、按钮白色；墨色与描边随主题反转。',
        'composer.attach': '添加文件',
      },
      en: {
        'composer.title': 'Composer',
        'composer.subtitle': 'The editor, the tool row and every control are their own blocks. Both schemes: a translucent white blurred editor and white buttons; ink and hairlines follow the theme.',
        'composer.attach': 'Add files',
      },
    }

    function AttachButton({ t }) {
      const label = t('composer.attach')
      return h(Tooltip, { label, delayMs: 500 }, h('button', {
        type: 'button',
        className: 'pp-attach',
        'aria-label': label,
        onClick: () => document.querySelector('[data-composer-card] input[type="file"]')?.click(),
      }, h(IconPaperclipOutlineRegular, { size: 14 })))
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
          let watching
          let watched = null

          const poll = setInterval(() => {
            const slot = document.querySelector(PERMISSION_SLOT)
            const button = slot?.querySelector('button') ?? null
            if (button === watched) return
            if (typeof watching === 'function') watching()
            watched = button
            watching = button === null ? undefined : watchPermission(button)
          }, 250)

          return () => {
            clearInterval(poll)
            if (typeof watching === 'function') watching()
          }
        }, 'dsh-plus-plus: permission mode')

        ctx.effect(() => ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
          name: 'conversation.input.left',
          id: 'plus-plus.attach',
          order: 10,
          locale: 'settings.plusPlus',
        }, AttachButton)), 'dsh-plus-plus: attach button')

        ctx.effect(() => ctx.inject(['commandUi'], (scope) => {
          const contributions = scope.commandUi?.live?.contributions
          if (contributions === undefined) return () => {}
          let target
          let restore
          const hide = () => {
            const next = contributions.get('file')
            if (next === undefined || next === target) return
            target = next
            restore = next.available
            next.available = () => false
          }
          const reveal = () => {
            if (target !== undefined && restore !== undefined) target.available = restore
            target = undefined
            restore = undefined
          }
          hide()
          const poll = setInterval(hide, 250)
          return () => {
            clearInterval(poll)
            reveal()
          }
        }, 'dsh-plus-plus: attach out of command menu'))
      },
    }
    return module.exports
  },
})
