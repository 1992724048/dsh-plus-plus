window.__ModuleLoader__.load({
  id: 'dsh-plus-plus/client.composer.effort.js',
  factory: () => {
    const module = { exports: {} }

    const MODEL_SLOT = '[data-slot="conversation.input.model"]'

    const EFFORT_ATTR = 'data-pp-effort'

    const EFFORT_MATCH = [
      { index: 5, words: ['最高', '最大', 'max', 'ultra', 'very high'] },
      { index: 4, words: ['高', 'high'] },
      { index: 3, words: ['中', '中等', 'medium', 'mid'] },
      { index: 2, words: ['低', 'low'] },
      { index: 1, words: ['关闭', '禁用', '无', 'none', 'off', 'disable'] },
      { index: 0, words: ['默认', 'default', '供应商默认', 'provider default'] },
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

    function install(ctx) {
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
    }

    module.exports = { install }
    return module.exports
  },
})
