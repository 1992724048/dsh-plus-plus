window.__ModuleLoader__.load({
  id: 'dsh-plus-plus',
  factory: require => {
    const module = { exports: {} }
    const exports = module.exports

    const React = require('react')
    const { createElement: h, useCallback, useEffect, useRef, useState } = React
    const { IconSettingsOutlineMedium, Modal } = require('@deepseek-ai/dsh-client-ui-primitives')

    const CHUNKS = [
      './client.core.js',
      './client.font.js',
      './client.shape.js',
      './client.composer.js',
      './client.composer.css.js',
      './client.session.js',
      './client.surface.js',
    ]

    const PAGE_CSS = `
.pp-page { display: flex; flex-direction: column; gap: 22px; padding: 4px 2px 24px; }
.pp-section { display: flex; flex-direction: column; gap: 8px; }
.pp-title { margin: 0; font-size: 18px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.pp-sub { margin: 0; font-size: 13px; color: var(--dsw-alias-label-secondary); }
.pp-warn { margin: 0; font-size: 12px; color: var(--dsw-alias-state-warn-primary); }
.pp-ok { margin: 0; font-size: 12px; color: var(--dsw-alias-state-success-primary); }
.pp-sample {
  margin: 0; padding: 12px 14px; border-radius: 0;
  border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary); font-size: 13px;
  font-family: var(--pp-font-mono); white-space: pre-wrap;
}
.pp-sans { font-family: var(--pp-font-sans); }
.pp-row { margin: 0 0 6px; }
.pp-row:last-child { margin: 0; }
.pp-tag { display: inline-block; min-width: 72px; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.pp-demo { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pp-card {
  padding: 8px 14px; font-size: 12px; color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1);
}
.pp-pill {
  padding: 4px 12px; font-size: 11px; color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l2);
}
.pp-dot {
  width: 12px; height: 12px; flex: none;
  background: var(--dsw-alias-brand-primary);
  border-radius: 50%; corner-shape: round;
}
[class*="_frame"]:not([data-sidebar-collapsed]) [class*="_footArea"] {
  flex-direction: row;
  align-items: center;
  gap: 4px;
}
[class*="_frame"]:not([data-sidebar-collapsed]) [class*="_settingsArea"] {
  flex: 1;
}
[class*="_frame"]:not([data-sidebar-collapsed]) [class*="_footerActions"] {
  align-self: stretch;
  display: flex;
  align-items: center;
  width: auto;
  order: 2;
  gap: 6px;
}
.pp-settings {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  display: grid;
  place-items: center;
  cursor: pointer;
  align-self: center;
  flex: 0 0 auto;
  width: 2.75rem;
  height: 2.75rem;
  max-width: 100%;
  aspect-ratio: 1 / 1;
}
.pp-settings:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.pp-modal-body {
  max-width: min(560px, calc(100vw - 48px));
  max-height: min(68vh, 640px);
  overflow-y: auto;
  outline: none;
}
`.trim()

    const USER_INFO_SELECTORS = [
      '[class*="_settingsArea"] [class*="triggerRow"]',
      '[class*="_settingsArea"] button:not(.pp-settings)',
    ]

    const findUserInfo = () => {
      for (const selector of USER_INFO_SELECTORS) {
        const el = document.querySelector(selector)
        if (el !== null) return el
      }
      return null
    }

    function SettingsShortcut({ t, listFeatures }) {
      const label = t('nav')
      const [open, setOpen] = useState(false)
      const triggerRef = useRef(null)
      const bodyRef = useRef(null)

      const closeModal = useCallback(() => {
        setOpen(false)
      }, [])

      useEffect(() => {
        if (!open) return undefined
        bodyRef.current?.focus()
        const onKeyDown = (event) => {
          if (event.key === 'Escape') closeModal()
        }
        document.addEventListener('keydown', onKeyDown)
        return () => {
          document.removeEventListener('keydown', onKeyDown)
          triggerRef.current?.focus()
        }
      }, [open, closeModal])

      useEffect(() => {
        let frame = 0
        let measuredTrigger = null
        let measuredUser = null

        const applySize = () => {
          const trigger = triggerRef.current
          const userInfo = findUserInfo()
          if (trigger === null || trigger === undefined || userInfo === null) return
          if (userInfo !== measuredUser) {
            measuredUser = userInfo
            resizeObserver.disconnect()
            resizeObserver.observe(userInfo)
          }
          measuredTrigger = trigger
          const size = userInfo.getBoundingClientRect().height
          if (!(size > 0)) return
          const next = `${size}px`
          if (trigger.style.height === next) return
          trigger.style.width = next
          trigger.style.height = next
        }

        const schedule = () => {
          if (frame !== 0) return
          frame = window.requestAnimationFrame(() => {
            frame = 0
            applySize()
          })
        }

        const resizeObserver = new ResizeObserver(schedule)
        const mutationObserver = new MutationObserver(() => {
          const intact = measuredUser !== null && measuredUser.isConnected
            && measuredTrigger !== null
            && measuredTrigger === triggerRef.current
            && measuredTrigger.isConnected
          if (intact) return
          schedule()
        })

        applySize()
        mutationObserver.observe(document.body, { childList: true, subtree: true })

        return () => {
          if (frame !== 0) window.cancelAnimationFrame(frame)
          resizeObserver.disconnect()
          mutationObserver.disconnect()
        }
      }, [])

      const openModal = (event) => {
        event.preventDefault()
        event.stopPropagation()
        console.debug('dsh-plus-plus: settings modal open')
        setOpen(true)
      }

      return h(React.Fragment, null, [
        h('button', {
          key: 'trigger',
          ref: triggerRef,
          type: 'button',
          className: 'pp-settings',
          'aria-label': label,
          'aria-haspopup': 'dialog',
          'aria-expanded': open,
          title: label,
          onClick: openModal,
        }, h(IconSettingsOutlineMedium, { size: 16 })),
        open && h(Modal, {
          key: 'modal',
          open: true,
          onClose: closeModal,
          title: t('modal.title'),
          closeLabel: t('modal.close'),
        }, h('div', {
          ref: bodyRef,
          className: 'pp-modal-body',
          tabIndex: -1,
        }, h(SettingsPage, { t, listFeatures }))),
      ])
    }

    function SettingsPage({ t, listFeatures }) {
      const features = listFeatures().filter(feature => typeof feature.settings === 'function')
      return h('div', { className: 'pp-page' }, [
        h('header', { key: 'head', className: 'pp-section' }, [
          h('h2', { className: 'pp-title' }, t('nav')),
          h('p', { className: 'pp-sub' }, t('meta.subtitle', { n: String(features.length) })),
        ]),
        ...features.map((feature, index) => h(feature.settings, {
          key: feature.id,
          t: (key, vars) => t(`${feature.id}.${key}`, vars),
          order: index,
        })),
      ])
    }

    async function apply(ctx) {
      const loaded = []
      for (const name of CHUNKS) loaded.push(await require.async(name))

      const core = loaded[0]
      const { defineFeature, listFeatures, dictionaries } = core

      for (const chunk of loaded.slice(1)) {
        if (chunk?.descriptor !== undefined) defineFeature(chunk.descriptor)
      }

      const DICT = dictionaries('settings.plusPlus', {
        zh: {
          'nav': 'Plus Plus',
          'meta.subtitle': '{n} 组增强已启用',
          'modal.title': 'Plus Plus 设置',
          'modal.close': '关闭',
        },
        en: {
          'nav': 'Plus Plus',
          'meta.subtitle': '{n} enhancements enabled',
          'modal.title': 'Plus Plus Settings',
          'modal.close': 'Close',
        },
      })

      const halves = { zh: { ...DICT.zh }, en: { ...DICT.en } }
      for (const feature of listFeatures()) {
        if (feature.locale === undefined) continue
        for (const half of ['zh', 'en']) {
          for (const [key, value] of Object.entries(feature.locale[half] ?? {})) {
            halves[half][`${feature.id}.${key}`] = value
          }
        }
      }

      ctx.effect(() => ctx.locale.register('settings.plusPlus', halves), 'dsh-plus-plus: dictionaries')
      const t = ctx.locale.bind('settings.plusPlus')

      core.registerStyles(ctx, PAGE_CSS, 'page')

      for (const feature of listFeatures()) {
        if (typeof feature.apply !== 'function') continue
        await feature.apply(ctx)
      }

      const settingsInjected = () => ({ listFeatures })

      ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
        name: 'sidebar.footer.action',
        id: 'dsh-plus-plus',
        order: 10,
        locale: 'settings.plusPlus',
        inject: settingsInjected,
      }, SettingsShortcut))
    }

    exports.apply = apply
    exports.inject = ['slots', 'locale']
    exports.name = 'dsh-plus-plus'
    return module.exports
  },
})
