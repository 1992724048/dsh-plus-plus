window.__ModuleLoader__.load({
  id: 'dsh-plus-plus',
  factory: require => {
    const module = { exports: {} }
    const exports = module.exports

    const React = require('react')
    const { createElement: h } = React
    const { IconSettingsOutlineMedium } = require('@deepseek-ai/dsh-client-ui-primitives')

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
  height: 100%;
  aspect-ratio: 1 / 1;
  box-sizing: border-box;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  display: grid;
  place-items: center;
  cursor: pointer;
}
.pp-settings:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
`.trim()

    let opening = false

    const VALID_POPUPS = ['menu', 'dialog', 'listbox']
    const TRIGGER_SELECTORS = [
      '[class*="_settingsArea"] button[aria-haspopup="menu"]',
      '[class*="_settingsArea"] button[aria-haspopup="dialog"]',
      '[class*="_settingsArea"] button[aria-haspopup]',
      '[class*="_settingsArea"] button',
    ]
    const CANDIDATE_SELECTOR = 'button, a, [role="button"], [role="tab"], [role="option"], [role="menuitem"], [role="menuitemradio"]'

    const findTrigger = () => {
      for (const selector of TRIGGER_SELECTORS) {
        for (const el of document.querySelectorAll(selector)) {
          if (el.closest('.pp-settings') !== null) continue
          const popup = el.getAttribute('aria-haspopup')
          if (VALID_POPUPS.includes(popup)) return el
          console.warn(`dsh-plus-plus: settings trigger rejected aria-haspopup=${popup}`)
        }
      }
      return null
    }

    const isBlockedItem = (el) => el.closest('.pp-settings') !== null
      || el.closest('.pp-page') !== null
      || el.closest('input[type="file"], label[for]') !== null
      || el.getAttribute('role') === 'dialog'
      || el.getAttribute('aria-modal') === 'true'

    const matchSettingsText = (value) => {
      const text = (value ?? '').trim()
      return text === 'Settings'
        || text === '设置'
        || text.startsWith('Settings…')
        || text.startsWith('设置…')
    }

    const rankPlusPlus = (label, el) => {
      const text = (el.textContent ?? '').trim()
      const id = el.id ?? ''
      const className = el.getAttribute('class') ?? ''
      const named = el.getAttribute('aria-label') === label || el.getAttribute('title') === label
      const marked = id.includes('dsh-plus-plus')
        || id.includes('plusPlus')
        || id.includes('pp-')
        || className.includes('dsh-plus-plus')
        || className.includes('plusPlus')
        || className.includes('pp-')
      if (text === label || named || marked) return 0
      if (text.includes(label)) return 1
      return -1
    }

    const rankSettingsItem = (el) => {
      const id = (el.id ?? '').toLowerCase()
      const className = (el.getAttribute('class') ?? '').toLowerCase()
      const named = matchSettingsText(el.getAttribute('aria-label')) || matchSettingsText(el.getAttribute('title'))
      const marked = id.includes('setting') || className.includes('setting')
      if (matchSettingsText(el.textContent) || named || marked) return 0
      return -1
    }

    function SettingsShortcut({ t }) {
      const label = t('nav')
      const open = () => {
        if (opening) return
        opening = true
        console.debug('dsh-plus-plus: settings open called')
        const trigger = findTrigger()
        if (trigger === null) {
          console.warn('dsh-plus-plus: settings trigger not found')
          opening = false
          return
        }
        console.debug(`dsh-plus-plus: settings trigger selected tag=${trigger.tagName} aria-haspopup=${trigger.getAttribute('aria-haspopup')}`)
        trigger.click()
        console.debug('dsh-plus-plus: settings trigger click dispatched')
        let settingsClicked = false
        const pick = (tries) => {
          const candidates = [...document.querySelectorAll(CANDIDATE_SELECTOR)]
            .filter((el) => el !== trigger && !isBlockedItem(el))
          const rankTop = (ranker) => candidates
            .map((el) => ({ el, rank: ranker(el) }))
            .filter(({ rank }) => rank >= 0)
            .sort((a, b) => a.rank - b.rank)
          const plusPlus = rankTop((el) => rankPlusPlus(label, el))
          console.debug(`dsh-plus-plus: settings pick try=${tries} candidates=${plusPlus.length}`)
          const hit = plusPlus[0]
          if (hit !== undefined) {
            console.debug(`dsh-plus-plus: settings pick hit tag=${hit.el.tagName} text=${(hit.el.textContent ?? '').trim()} aria-label=${hit.el.getAttribute('aria-label') ?? ''} id=${hit.el.id}`)
            hit.el.click()
            opening = false
            return
          }
          if (!settingsClicked) {
            const settings = rankTop(rankSettingsItem)[0]
            if (settings !== undefined) {
              console.debug(`dsh-plus-plus: settings click settings item tag=${settings.el.tagName} text=${(settings.el.textContent ?? '').trim()}`)
              settings.el.click()
              settingsClicked = true
            }
          }
          if (tries > 0) {
            window.setTimeout(() => pick(tries - 1), 150)
            return
          }
          console.warn('dsh-plus-plus: settings pick gave up')
          opening = false
        }
        window.setTimeout(() => pick(16), 300)
      }
      return h('button', {
        type: 'button',
        className: 'pp-settings',
        'aria-label': label,
        title: label,
        onClick: open,
      }, h(IconSettingsOutlineMedium, { size: 16 }))
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
        },
        en: {
          'nav': 'Plus Plus',
          'meta.subtitle': '{n} enhancements enabled',
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

      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'dsh-plus-plus',
        order: 40,
        label: () => t('nav'),
        locale: 'settings.plusPlus',
      }, () => h(SettingsPage, { t, listFeatures })))

      ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
        name: 'sidebar.footer.action',
        id: 'dsh-plus-plus',
        order: 10,
        locale: 'settings.plusPlus',
      }, SettingsShortcut))
    }

    exports.apply = apply
    exports.inject = ['slots', 'locale']
    exports.name = 'dsh-plus-plus'
    return module.exports
  },
})
