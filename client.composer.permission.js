window.__ModuleLoader__.load({
  id: 'dsh-plus-plus/client.composer.permission.js',
  factory: () => {
    const module = { exports: {} }

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

    function install(ctx) {
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
    }

    module.exports = { install }
    return module.exports
  },
})
