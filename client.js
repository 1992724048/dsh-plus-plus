/**
 * DSH Plus Plus — browser half (entry).
 *
 * This file is deliberately thin. It does three things and nothing else:
 *
 *   1. loads the feature chunks and the core layer;
 *   2. binds the locale, so a feature contributes a dictionary rather than
 *      registering one;
 *   3. renders one settings page that composes each feature's own section.
 *
 * Everything a feature actually does lives in its chunk. Adding one is a new
 * `client.<name>.js` plus one line in {@link CHUNKS} — this file does not change.
 *
 * Hand-written ModuleLoader bundle: no build step, no dependency beyond the
 * `react` the shell already provides.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plus-plus',
  factory: require => {
    const module = { exports: {} }
    const exports = module.exports

    const React = require('react')
    const { createElement: h } = React

    const core = require('dsh-plus-plus/client.core.js')
    const { listFeatures, dictionaries } = core

    /**
     * The feature chunks, in boot order.
     *
     * Every name must match `client\.[A-Za-z0-9][A-Za-z0-9._-]*\.js` — the shell's
     * own rule for resolving a sibling chunk — and each file must sit next to this
     * one. `scripts/probe-chunks.mjs` checks both.
     */
    const CHUNKS = [
      'client.font.js',
      'client.shape.js',
    ]

    for (const name of CHUNKS) require(`dsh-plus-plus/${name}`)

    // ── copy ───────────────────────────────────────────────────────────────────
    const NS = 'settings.plusPlus'
    const DICT = dictionaries(NS, {
      zh: {
        'nav': 'Plus Plus',
        'meta.subtitle': '{n} 组增强已启用',
        'meta.order': '启用顺序',
      },
      en: {
        'nav': 'Plus Plus',
        'meta.subtitle': '{n} enhancements enabled',
        'meta.order': 'Boot order',
      },
    })

    // ── page chrome ────────────────────────────────────────────────────────────
    /** Styling for the page frame. Every selector is scoped under `.pp-`. */
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
`.trim()

    /** One settings page: a frame, then each feature's own section in boot order. */
    function SettingsPage({ t }) {
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

    // ── registration ───────────────────────────────────────────────────────────
    /**
     * `apply` receives the client context from the loader, once per client run.
     * Every registration hangs off `ctx.effect` so a fiber unload tears it down.
     */
    function apply(ctx) {
      // One namespace, one registration. Each feature's dictionary is namespaced by
      // its id — `font.title` becomes `font.font.title` only if we are careless, so
      // the merge keeps the halves separate and only flattens *within* a half.
      const halves = { zh: { ...DICT.zh }, en: { ...DICT.en } }
      for (const feature of listFeatures()) {
        if (feature.locale === undefined) continue
        for (const half of ['zh', 'en']) {
          for (const [key, value] of Object.entries(feature.locale[half] ?? {})) {
            halves[half][`${feature.id}.${key}`] = value
          }
        }
      }
      ctx.effect(() => ctx.locale.register(NS, halves), 'dsh-plus-plus: dictionaries')
      const t = ctx.locale.bind(NS)

      // The page frame's own stylesheet, inserted before the feature sheets so a
      // feature can override the frame if it ever needs to. `registerStyles` opens
      // the effect itself, so it is called directly — wrapping it here would nest
      // two effects and register the label twice.
      core.registerStyles(ctx, PAGE_CSS, 'page')

      // Features, in declared order.
      for (const feature of listFeatures()) {
        if (typeof feature.apply !== 'function') continue
        feature.apply(ctx)
      }

      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'dsh-plus-plus',
        order: 40,
        label: () => t('nav'),
        locale: NS,
      }, () => h(SettingsPage, { t })))
    }

    exports.apply = apply
    exports.inject = ['slots', 'locale']
    exports.name = 'dsh-plus-plus'
    return module.exports
  },
})
