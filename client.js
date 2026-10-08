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
}
[class*="_frame"]:not([data-sidebar-collapsed]) [class*="_settingsArea"] {
  width: auto;
}
[class*="_frame"]:not([data-sidebar-collapsed]) [class*="_footerActions"] {
  width: auto;
  margin-left: auto;
  order: 2;
  gap: 6px;
}
.pp-settings {
  box-sizing: border-box;
  width: 26px;
  height: 26px;
  margin-left: auto;
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

    function SettingsShortcut({ t }) {
      const label = t('nav')
      const open = () => {
        const trigger = document.querySelector('[class*="_settingsArea"] button[aria-haspopup="dialog"]')
        trigger?.click()
        const pick = (tries) => {
          const own = document.querySelector('.pp-settings')
          const item = [...document.querySelectorAll('button, [role="tab"], a')].find((el) => (
            el !== own
            && el.textContent?.trim() === label
            && el.closest('[class*="_footArea"]') === null
          ))
          if (item !== undefined) {
            item.click()
            return
          }
          if (tries > 0) window.setTimeout(() => pick(tries - 1), 120)
        }
        window.setTimeout(() => pick(6), 240)
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
