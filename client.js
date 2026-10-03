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

    /**
     * The chunks this entry pulls in, in boot order. The first must be the core.
     *
     * `require.async('./<name>')` is the only way to reach a sibling chunk. Two
     * facts about the shell's `require` make that unavoidable:
     *
     *  - plain `require(spec)` is a **synchronous module-table lookup**. It answers a
     *    platform seed word (`react`, `react-dom`, `react/jsx-runtime`,
     *    `@deepseek-ai/cordis`, `@deepseek-ai/dsh-client-store`,
     *    `@deepseek-ai/dsh-client-ui-slots`, `@deepseek-ai/dsh-client-ui-primitives`,
     *    `@deepseek-ai/dsh-client-ui-dockkit`) or an already-materialized graph row,
     *    and throws `missed the module table` for anything else. A package's own
     *    chunk is neither, so `require('dsh-plus-plus/client.core.js')` fails the
     *    whole entry at boot.
     *
     *  - `require.async(spec)` is the chunk path, and it only accepts a **relative**
     *    `./name.js` whose name matches `client\.[A-Za-z0-9][A-Za-z0-9._-]*\.js`. It
     *    returns a promise, so the load below is async by necessity — which is fine,
     *    because the shell awaits a client's `apply` before using it.
     *
     * The names are relative because that is what `require.async` accepts; the
     * `dsh-plus-plus/` prefix only works for Node's own resolver (npm pack, tests).
     */
    const CHUNKS = [
      './client.core.js',
      './client.font.js',
      './client.shape.js',
      './client.composer.js',
    ]

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

    // ── registration ───────────────────────────────────────────────────────────
    /**
     * `apply` receives the client context from the loader, once per client run.
     * Every registration hangs off `ctx.effect` so a fiber unload tears it down.
     *
     * It is async because the chunks have to be fetched first: `require.async`
     * returns a promise, and the shell awaits this function's result.
     */
    async function apply(ctx) {
      const loaded = []
      for (const name of CHUNKS) loaded.push(await require.async(name))

      // CHUNKS[0] is the core chunk; the rest are feature chunks. Each feature
      // exports a descriptor rather than registering itself, because `defineFeature`
      // lives in core and core is only reachable asynchronously — so the entry is
      // the one place where both halves meet.
      const core = loaded[0]
      const { defineFeature, listFeatures, dictionaries } = core

      for (const chunk of loaded.slice(1)) {
        if (chunk?.descriptor !== undefined) defineFeature(chunk.descriptor)
      }

      // One namespace, one registration. Each feature's dictionary is namespaced by
      // its id, and the halves are kept separate while flattening *within* a half —
      // so `locale.register`'s balance check still runs exactly once, and so
      // `core.dictionaries` can name the offending key before we ever get there.
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

      // The page frame's own stylesheet, inserted before the feature sheets so a
      // feature can override the frame if it ever needs to. `registerStyles` opens
      // the effect itself, so calling it directly avoids nesting two.
      core.registerStyles(ctx, PAGE_CSS, 'page')

      // Features, in declared order. `apply` is async because a chunk reaches core
      // through `require.async`, so each one is awaited.
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
    }

    exports.apply = apply
    exports.inject = ['slots', 'locale']
    exports.name = 'dsh-plus-plus'
    return module.exports
  },
})
