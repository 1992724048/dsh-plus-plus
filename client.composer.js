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

    const MODEL_SLOT = '[data-slot="conversation.input.model"]'

    const FAN_TRIGGER = '[data-composer-card] button[aria-haspopup="listbox"]'

    function shapeFan() {
      const trigger = document.querySelector(`${FAN_TRIGGER}[aria-expanded="true"]`)
      if (trigger === null) {
        document.querySelectorAll('[data-pp-fan]').forEach((panel) => {
          panel.removeAttribute('data-pp-fan')
          panel.querySelectorAll('[role="option"]').forEach((option) => {
            option.style.left = ''
            option.style.top = ''
          })
        })
        return
      }
      const list = document.querySelector('[role="listbox"]')
      if (list === null) return
      let panel = list
      while (panel !== document.body && panel !== null && getComputedStyle(panel).position !== 'fixed') {
        panel = panel.parentElement
      }
      if (panel === null || panel === document.body) return
      panel.setAttribute('data-pp-fan', '')
      const options = [...list.querySelectorAll('[role="option"]')]
      if (options.length === 0) return
      const rect = trigger.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top - 12
      const radius = Math.max(88, Math.min(168, 44 + options.length * 12))
      options.forEach((option, index) => {
        const angle = options.length === 1
          ? Math.PI / 2
          : Math.PI - (Math.PI * index) / (options.length - 1)
        option.style.left = `${Math.round(cx + Math.cos(angle) * radius)}px`
        option.style.top = `${Math.round(cy - Math.sin(angle) * radius)}px`
        const name = (option.textContent ?? '').trim()
        if (name !== '') option.setAttribute('title', name)
      })
    }

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

    const EFFORT_ATTR = 'data-pp-effort'

    const EFFORT_MATCH = [
      { index: 4, words: ['最高', '最大', 'max', 'ultra', 'very high'] },
      { index: 0, words: ['关闭', '禁用', '无', 'none', 'off', 'disable'] },
      { index: 3, words: ['高', 'high'] },
      { index: 2, words: ['中', '中等', 'medium', 'mid'] },
      { index: 1, words: ['低', 'low'] },
      { index: 5, words: ['默认', 'default', '供应商默认', 'provider default'] },
    ]

    function effortLevel(text) {
      const value = text.trim().toLowerCase()
      if (value === '') return undefined
      for (const entry of EFFORT_MATCH) {
        if (entry.words.some(word => value.includes(word))) return String(entry.index)
      }
      return '0'
    }

    function watchEffort(span) {
      const paint = () => {
        const level = effortLevel(span.textContent ?? '')
        if (level === undefined) span.removeAttribute(EFFORT_ATTR)
        else if (span.getAttribute(EFFORT_ATTR) !== level) span.setAttribute(EFFORT_ATTR, level)
      }

      paint()

      const observer = new MutationObserver(paint)
      observer.observe(span, { childList: true, subtree: true, characterData: true })
      return () => observer.disconnect()
    }

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
      return h(Tooltip, { label, side: 'top', delayMs: 500 }, h('button', {
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

        ctx.effect(() => {
          let watching
          let watched = null

          const poll = setInterval(() => {
            const span = document.querySelector(MODEL_SLOT + ' [class*="triggerEffort"]')
            if (span === watched) return
            if (typeof watching === 'function') watching()
            watched = span
            watching = span === null ? undefined : watchEffort(span)
          }, 250)

          return () => {
            clearInterval(poll)
            if (typeof watching === 'function') watching()
          }
        }, 'dsh-plus-plus: effort badge')

        ctx.effect(() => {
          shapeFan()
          const poll = setInterval(shapeFan, 150)
          return () => clearInterval(poll)
        }, 'dsh-plus-plus: command fan')

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
