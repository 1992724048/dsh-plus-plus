window.__ModuleLoader__.load({
  id: 'dsh-plus-plus/client.composer.fan.js',
  factory: () => {
    const module = { exports: {} }

    const FAN_TRIGGER = '[aria-haspopup="listbox"][aria-expanded="true"]'
    const FAN_ROW = '[role="option"], [role="menuitem"], [role="menuitemradio"]'

    function clearFan() {
      document.querySelectorAll('[data-pp-fan]').forEach((panel) => {
        panel.removeAttribute('data-pp-fan')
      })
      document.querySelectorAll('[data-pp-fan-item]').forEach((row) => {
        row.removeAttribute('data-pp-fan-item')
        row.style.left = ''
        row.style.top = ''
      })
    }

    function shapeFan() {
      const trigger = document.querySelector(FAN_TRIGGER)
      if (trigger === null) {
        clearFan()
        return
      }
      const list = [...document.querySelectorAll('[role="listbox"], [role="menu"]')]
        .find((element) => element.querySelector(FAN_ROW) !== null)
      if (list === undefined) return
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
      const rows = [...list.querySelectorAll(FAN_ROW)]
      if (rows.length === 0) return
      const rect = trigger.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top - 12
      const radius = Math.max(88, Math.min(168, 44 + rows.length * 12))
      rows.forEach((row, index) => {
        const angle = rows.length === 1
          ? Math.PI / 2
          : Math.PI - (Math.PI * index) / (rows.length - 1)
        row.setAttribute('data-pp-fan-item', '')
        row.style.left = `${Math.round(cx + Math.cos(angle) * radius)}px`
        row.style.top = `${Math.round(cy - Math.sin(angle) * radius)}px`
        const name = (row.textContent ?? '').trim()
        if (name !== '') row.setAttribute('title', name)
      })
    }

    function install(ctx) {
      ctx.effect(() => {
        shapeFan()
        const poll = setInterval(shapeFan, 150)
        return () => {
          clearInterval(poll)
          clearFan()
        }
      }, 'dsh-plus-plus: command fan')
    }

    module.exports = { install }
    return module.exports
  },
})
