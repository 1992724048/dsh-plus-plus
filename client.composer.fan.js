window.__ModuleLoader__.load({
  id: 'dsh-plus-plus/client.composer.fan.js',
  factory: () => {
    const module = { exports: {} }

    const FAN_TRIGGER = '[data-composer-card] button[aria-haspopup="listbox"]'
    const FAN_ROW = '[role="option"], [role="menuitem"], [role="menuitemradio"]'
    const FAN_LIVE = '[data-pp-fan]:not([data-pp-fan-ghost])'
    const FAN_ITEM = '[data-pp-fan-item]'
    const FAN_GHOST = '[data-pp-fan-ghost]'
    const FAN_CLOSE_MS = 220

    let missing = false
    let queued = false
    let fanSource = 'other'
    let fanArmed = false
    let closing = false

    function miss(message) {
      if (missing) return
      missing = true
      console.warn(message)
    }

    function clearFan() {
      fanArmed = false
      document.querySelectorAll(FAN_LIVE).forEach((panel) => {
        panel.removeAttribute('data-pp-fan')
      })
      document.querySelectorAll(`${FAN_ITEM}:not([data-pp-fan-closing])`).forEach((row) => {
        row.removeAttribute('data-pp-fan-item')
        row.style.left = ''
        row.style.top = ''
        row.style.removeProperty('--fan-x')
        row.style.removeProperty('--fan-y')
        row.style.removeProperty('--pull-x')
        row.style.removeProperty('--pull-y')
      })
    }

    function reducedMotion() {
      return typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }

    function fanIsClosing() {
      const trigger = document.querySelector(FAN_TRIGGER)
      return trigger === null || trigger.getAttribute('aria-expanded') !== 'true'
    }

    function collectRemovedRows(records) {
      const rows = []
      for (const record of records) {
        for (const node of record.removedNodes) {
          if (!(node instanceof Element)) continue
          if (node.matches(FAN_ITEM)) rows.push(node)
          node.querySelectorAll(FAN_ITEM).forEach((row) => rows.push(row))
        }
      }
      return rows.filter((row) => row.isConnected === false && !row.hasAttribute('data-pp-fan-closing'))
    }

    function closeGhost(rows) {
      const ghost = document.createElement('div')
      ghost.setAttribute('data-pp-fan', '')
      ghost.setAttribute('data-pp-fan-ghost', '')
      rows.forEach((row) => {
        row.setAttribute('data-pp-fan-closing', '')
        ghost.appendChild(row)
      })
      document.body.appendChild(ghost)
      closing = true
      setTimeout(() => {
        ghost.remove()
        closing = false
      }, FAN_CLOSE_MS)
    }

    function dropGhosts() {
      document.querySelectorAll(FAN_GHOST).forEach((ghost) => ghost.remove())
      closing = false
    }

    function harvestClosingRows(records) {
      if (closing) return
      if (!fanArmed) return
      if (!fanIsClosing()) return
      const rows = collectRemovedRows(records)
      if (rows.length === 0) return
      if (reducedMotion()) return
      closeGhost(rows)
    }

    function trackSourceEvent(event) {
      const trigger = document.querySelector(FAN_TRIGGER)
      if (trigger === null) return
      if (trigger.getAttribute('aria-expanded') === 'true') return
      fanSource = trigger.contains(event.target) ? 'button' : 'other'
    }

    function onTriggerClick(event) {
      if (!(event.target instanceof Element)) return
      const trigger = event.target.closest(FAN_TRIGGER)
      if (trigger === null) return
      if (trigger.getAttribute('aria-expanded') !== 'true') return
      if (document.querySelector(FAN_LIVE) === null) return
      event.preventDefault()
      event.stopPropagation()
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
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
      if (fanSource !== 'button' || trigger.getAttribute('aria-expanded') !== 'true') {
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
      const rect = trigger.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) {
        clearFan()
        missing = false
        return
      }
      missing = false
      fanArmed = true
      rows.forEach((row) => {
        if (!row.hasAttribute('data-pp-fan-item')) row.setAttribute('data-pp-fan-item', '')
      })
      const radius = Math.max(32, Math.min(200, (rows.length * 28) / Math.PI))
      const cx = rect.left + rect.width / 2
      const rowHeight = rows[0].offsetHeight || 36
      const cy = rect.bottom - rowHeight / 2
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

    function run(records) {
      harvestClosingRows(records)
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
        document.addEventListener('pointerdown', trackSourceEvent, true)
        document.addEventListener('keydown', trackSourceEvent, true)
        document.addEventListener('click', onTriggerClick, true)
        return () => {
          observer.disconnect()
          clearInterval(poll)
          document.removeEventListener('pointerdown', trackSourceEvent, true)
          document.removeEventListener('keydown', trackSourceEvent, true)
          document.removeEventListener('click', onTriggerClick, true)
          clearFan()
          dropGhosts()
        }
      }, 'dsh-plus-plus: command fan')
    }

    module.exports = { install }
    return module.exports
  },
})
