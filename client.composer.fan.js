window.__ModuleLoader__.load({
  id: 'dsh-plus-plus/client.composer.fan.js',
  factory: () => {
    const module = { exports: {} }

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
      while (
        panel !== null
        && panel !== document.body
        && panel.matches('[data-composer-card]') === false
        && getComputedStyle(panel).position === 'static'
      ) {
        panel = panel.parentElement
      }
      if (panel === null || panel === document.body || panel.matches('[data-composer-card]')) panel = list
      list.setAttribute('data-pp-fan', '')
      if (panel !== list) panel.setAttribute('data-pp-fan', '')
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

    function install(ctx) {
      ctx.effect(() => {
        shapeFan()
        const poll = setInterval(shapeFan, 150)
        return () => clearInterval(poll)
      }, 'dsh-plus-plus: command fan')
    }

    module.exports = { install }
    return module.exports
  },
})
