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
        row.removeAttribute('data-pp-fan-start')
        row.style.left = ''
        row.style.top = ''
        row.style.transform = ''
      })
    }

    function shapeFan() {
      const list = [...document.querySelectorAll('[role="listbox"], [role="menu"]')]
        .find((element) => element.querySelector(FAN_ROW) !== null)
      if (list === undefined) {
        clearFan()
        missing = false
        return
      }
      const trigger = document.querySelector(FAN_TRIGGER)
      if (trigger === null) {
        miss('dsh-plus-plus: command fan trigger not found')
        return
      }
      const owned = list.getAttribute('role') === 'listbox' || trigger.getAttribute('aria-expanded') === 'true'
      if (!owned) {
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
      const widest = rows.reduce((max, row) => Math.max(max, row.getBoundingClientRect().width), 0)
      const radius = Math.max(64, Math.min(240, (rows.length * (widest + 8)) / Math.PI))
      const rect = trigger.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top - 12
      rows.forEach((row, index) => {
        const angle = rows.length === 1
          ? Math.PI / 2
          : Math.PI - (Math.PI * index) / (rows.length - 1)
        const left = `${Math.round(cx + Math.cos(angle) * radius)}px`
        const top = `${Math.round(cy - Math.sin(angle) * radius)}px`
        if (row.style.left !== left) row.style.left = left
        if (row.style.top !== top) row.style.top = top
        if (!row.hasAttribute('data-pp-fan-start')) {
          row.setAttribute('data-pp-fan-start', '')
          const x = Number.parseFloat(left)
          const y = Number.parseFloat(top)
          row.style.transform = `translate(-50%, -50%) translate(${Math.round(cx - x)}px, ${Math.round(cy - y)}px) scale(0.4)`
          requestAnimationFrame(() => {
            row.style.transform = ''
          })
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
