window.__ModuleLoader__.load({
  id: 'dsh-plus-plus/client.composer.attach.js',
  factory: require => {
    const module = { exports: {} }

    const React = require('react')
    const { createElement: h } = React
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    const { IconPaperclipOutlineRegular, Tooltip } = primitives

    function AttachButton({ t }) {
      const label = t('composer.attach')
      return h(Tooltip, { label, side: 'top', delayMs: 500 }, h('button', {
        type: 'button',
        className: 'pp-attach',
        'aria-label': label,
        onClick: () => document.querySelector('[data-composer-card] input[type="file"]')?.click(),
      }, h(IconPaperclipOutlineRegular, { size: 14 })))
    }

    function install(ctx) {
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
    }

    module.exports = { install }
    return module.exports
  },
})
