window.__ModuleLoader__.load({
  id: 'dsh-plus-plus/client.composer.fan.js',
  factory: () => {
    const module = { exports: {} }

    const FAN_TRIGGER = '[data-composer-card] button[aria-haspopup="listbox"]'
    const FAN_ROW = '[role="option"], [role="menuitem"], [role="menuitemradio"]'

    let missing = false
    let queued = false

    function miss(message) {
      if (missing) return
      missing = true
      console.warn(message)
    }

    function clearFan() {
      document.querySelectorAll('[data-pp-fan]').forEach((panel) => {
        panel.removeAttribute('data-pp-fan')
      })
      document.querySelectorAll('[data-pp-fan-item]').forEach((row) => {
        row.removeAttribute('data-pp-fan-item')
        row.style.left = ''
        row.style.top = ''
        row.style.removeProperty('--fan-x')
        row.style.removeProperty('--fan-y')
        row.style.removeProperty('--pull-x')
        row.style.removeProperty('--pull-y')
      })
    }

    function shapeFan() {
      const candidates = [...document.querySelectorAll('[role="listbox"], [role="menu"]')]
        .filter((element) => element.querySelector('[role="option"]') !== null)
      const list = candidates.find((element) => !candidates.some((other) => other !== element && element.contains(other)))
      if (list === undefined) {
        const foreign = [...document.querySelectorAll('[role="listbox"], [role="menu"]')]
          .some((element) => element.querySelector(FAN_ROW) !== null)
        if (foreign) miss('dsh-plus-plus: command fan rows are not options')
        else {
          clearFan()
          missing = false
        }
        return
      }
      const trigger = document.querySelector(FAN_TRIGGER)
      if (trigger === null) {
        miss('dsh-plus-plus: command fan trigger not found')
        return
      }
      if (list.getAttribute('role') !== 'listbox' && trigger.getAttribute('aria-expanded') !== 'true') {
        clearFan()
        missing = false
        return
      }
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
      if (!list.hasAttribute('data-pp-fan')) list.setAttribute('data-pp-fan', '')
      if (panel !== list && !panel.hasAttribute('data-pp-fan')) panel.setAttribute('data-pp-fan', '')
      const rows = [...list.querySelectorAll(FAN_ROW)]
      if (rows.length === 0) {
        miss('dsh-plus-plus: command fan found no menu rows')
        return
      }
      missing = false
      rows.forEach((row) => {
        if (!row.hasAttribute('data-pp-fan-item')) row.setAttribute('data-pp-fan-item', '')
      })
      const radius = Math.max(32, Math.min(200, (rows.length * 28) / Math.PI))
      const rect = trigger.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top - 12
      rows.forEach((row, index) => {
        const angle = rows.length === 1
          ? Math.PI / 2
          : Math.PI - (Math.PI * index) / (rows.length - 1)
        const stepX = Math.round(Math.cos(angle) * radius)
        const stepY = Math.round(-Math.sin(angle) * radius)
        const left = `${Math.round(cx + stepX)}px`
        const top = `${Math.round(cy + stepY)}px`
        if (row.style.left !== left) row.style.left = left
        if (row.style.top !== top) row.style.top = top
        const fanX = `${stepX}px`
        if (row.style.getPropertyValue('--fan-x').trim() !== fanX) {
          row.style.setProperty('--fan-x', fanX)
          row.style.setProperty('--fan-y', `${stepY}px`)
          row.style.setProperty('--pull-x', `${Math.round(Math.cos(angle) * 14)}px`)
          row.style.setProperty('--pull-y', `${Math.round(-Math.sin(angle) * 14)}px`)
        }
        const name = (row.textContent ?? '').trim()
        if (name !== '' && row.getAttribute('title') !== name) row.setAttribute('title', name)
      })
    }

    function run() {
      if (queued) return
      queued = true
      requestAnimationFrame(() => {
        queued = false
        shapeFan()
      })
    }

    function install(ctx) {
      console.debug('dsh-plus-plus: command fan armed')
      ctx.effect(() => {
        shapeFan()
        const observer = new MutationObserver(run)
        observer.observe(document.body, { childList: true, subtree: true })
        const poll = setInterval(shapeFan, 150)
        return () => {
          observer.disconnect()
          clearInterval(poll)
          clearFan()
        }
      }, 'dsh-plus-plus: command fan')
    }

    module.exports = { install }
    return module.exports
  },
})
