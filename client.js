/**
 * DSH Plus Plus — browser half.
 *
 * Currently one feature: the bundled font stack.
 *
 * Fonts come from npm packages rather than from the system, so a machine with
 * neither face installed still renders identically. The host serves the packages'
 * woff2 shards and stylesheets over `/api/dsh-plus-plus/fonts/*`; this half points
 * `@font-face` at those routes and applies the resulting stack.
 *
 * Hand-written ModuleLoader bundle: no build step, no dependency beyond the
 * `react` the shell already provides. All colour comes from theme variables.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plus-plus',
  factory: require => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')
    const { createElement: h } = React

    const NS = 'settings.plusPlus'
    const inject = ['slots', 'locale']

    // ── copy ───────────────────────────────────────────────────────────────────
    // `locale.register(ns, dicts)` enforces bilingual balance, so both halves must
    // carry the same keys or registration fails in the browser.
    const DICT = {
      zh: {
        'nav': 'Plus Plus',
        'font.title': '字体',
        'font.subtitle': 'JetBrains Mono 优先，鸿蒙字体兜底中文——两者都来自 npm 依赖，不依赖系统安装。',
        'font.stack': '当前字体栈',
        'font.sans': '正文',
        'font.mono': '等宽',
        'font.loading': '正在检测字体……',
        'font.ok': '字体就绪',
        'font.missing': '字体未就绪：{name}。宿主可能没有字体路由，检查依赖是否安装完整。',
      },
      en: {
        'nav': 'Plus Plus',
        'font.title': 'Fonts',
        'font.subtitle': 'JetBrains Mono first, HarmonyOS Sans as the Chinese fallback — both from npm dependencies, never from the system.',
        'font.stack': 'Current stack',
        'font.sans': 'Body',
        'font.mono': 'Monospace',
        'font.loading': 'Checking fonts…',
        'font.ok': 'Fonts ready',
        'font.missing': 'Font not ready: {name}. The host may have no font route — check that dependencies installed completely.',
      },
    }

    // ── fonts ──────────────────────────────────────────────────────────────────
    /** Route prefix served by the host. Must match `FONT_ROUTE` in src/fonts.js. */
    const FONT_ROUTE = '/api/dsh-plus-plus/fonts'

    /**
     * The stylesheets to load, per family.
     *
     * Each entry is a path relative to that family's served root, because the
     * packages resolve their own `url()` relatively and the host serves each
     * package from its own root: `@fontsource/jetbrains-mono` writes
     * `./files/…`, while the HarmonyOS package writes `./Regular/…`.
     *
     * The subsets loaded are the ones that carry glyphs this shell can show: the
     * UI is zh/en, and conversations can carry Cyrillic or Greek. The HarmonyOS SC
     * stylesheets are one per weight and cover the whole CJK range — their
     * `unicode-range` already splits them into ~82 shards per weight, so a page
     * only downloads the shards containing characters actually on screen.
     */
    const SHEETS = [
      ...['latin', 'latin-ext', 'cyrillic', 'greek', 'vietnamese']
        .flatMap(subset => ['300', '400', '500', '600', '700'].map(weight => `${subset}-${weight}.css`))
        .map(file => ({ family: 'jetbrains-mono', file })),
      ...['Light', 'Regular', 'Medium', 'Semibold', 'Bold']
        .map(weight => ({ family: 'harmonyos-sans-sc', file: `${weight}.css` })),
    ]

    /**
     * The stack itself.
     *
     * JetBrains Mono leads every monospace stack and HarmonyOS Sans follows it.
     * The browser resolves the list per character, so Latin text uses JetBrains
     * Mono and CJK falls through to HarmonyOS Sans within a single declaration.
     *
     * `local()`-first: if the machine happens to have a face, the browser uses it
     * and never fetches a shard. The npm package is the guarantee, not the first
     * choice.
     */
    const STACK_CSS = `
:root {
  --pp-font-mono: 'JetBrains Mono', 'HarmonyOS Sans', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --pp-font-sans: 'HarmonyOS Sans', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
html, body, button, input, textarea, select { font-family: var(--pp-font-sans); }
code, pre, kbd, samp, [class*='mono'], [class*='code'] {
  font-family: var(--pp-font-mono);
  font-feature-settings: 'liga' 1, 'calt' 1;
}
`.trim()

    /** Settings-page styling. Scoped under `.pp-` so it cannot restyle the shell. */
    const PAGE_CSS = `
.pp-page { display: flex; flex-direction: column; gap: 16px; padding: 4px 2px 24px; }
.pp-title { margin: 0; font-size: 18px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.pp-sub { margin: 0; font-size: 13px; color: var(--dsw-alias-label-secondary); }
.pp-warn { margin: 0; font-size: 12px; color: var(--dsw-alias-state-warn-primary); }
.pp-ok { margin: 0; font-size: 12px; color: var(--dsw-alias-state-success-primary); }
.pp-block { display: flex; flex-direction: column; gap: 8px; }
.pp-block__title { margin: 0; font-size: 14px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.pp-sample {
  margin: 0; padding: 12px 14px; border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary); font-size: 13px;
  font-family: var(--pp-font-mono); white-space: pre-wrap;
}
.pp-sample__sans { font-family: var(--pp-font-sans); }
.pp-sample__row { margin: 0 0 6px; }
.pp-sample__row:last-child { margin: 0; }
.pp-sample__tag { display: inline-block; min-width: 72px; font-size: 11px; color: var(--dsw-alias-label-secondary); }
`.trim()

    /** Compose the stylesheet: the package CSS first, then the stack, then the page. */
    function fontCss() {
      const imports = SHEETS
        .map(entry => `@import url("${FONT_ROUTE}/${entry.family}/${entry.file}");`)
        .join('\n')
      return `${imports}\n${STACK_CSS}\n${PAGE_CSS}`
    }

    // ── registration ───────────────────────────────────────────────────────────
    /**
     * `apply` receives the client context from the loader, once per client run.
     * Every registration hangs off `ctx.effect` so a fiber unload tears it all down.
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh: DICT.zh, en: DICT.en }), 'dsh-plus-plus: dictionaries')
      const t = ctx.locale.bind(NS)

      // The stylesheet lives in its own <style> tag, owned by this effect so a
      // fiber unload takes it with it.
      //
      // It is created with `document.createElement` rather than a `styles` builtin:
      // this bundle is loaded through `window.__ModuleLoader__`, whose factory
      // receives only `require` — `styles` exists solely on the *dynamic* client-half
      // path (`evaluateClientHalf`), so referencing it here throws
      // "styles is not defined" and fails the whole entry at boot.
      ctx.effect(() => {
        const style = document.createElement('style')
        style.setAttribute('data-plugin', 'dsh-plus-plus')
        style.textContent = fontCss()
        document.head.appendChild(style)
        return () => style.remove()
      }, 'dsh-plus-plus: fonts')

      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'dsh-plus-plus',
        order: 40,
        label: () => t('nav'),
        locale: NS,
      }, () => h(FontPage, { t })))
    }

    // ── settings page ──────────────────────────────────────────────────────────
    /**
     * A preview of the stack, with a live readiness check.
     *
     * The check issues `HEAD` against one representative asset per family: a 404
     * means the host is not serving that package, which is otherwise a failure the
     * user would only notice as subtly wrong-looking glyphs.
     */
    function FontPage({ t }) {
      const { useState, useEffect } = React
      const [missing, setMissing] = useState(undefined)

      useEffect(() => {
        let alive = true
        const probes = [
          ['JetBrains Mono', `${FONT_ROUTE}/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2`],
          ['HarmonyOS Sans', `${FONT_ROUTE}/harmonyos-sans-sc/Regular.css`],
        ]
        Promise.all(probes.map(async ([name, url]) => {
          try {
            const response = await fetch(url, { method: 'HEAD' })
            return response.ok ? undefined : name
          } catch {
            return name
          }
        })).then(results => {
          if (alive) setMissing(results.filter(Boolean))
        })
        return () => { alive = false }
      }, [])

      return h('div', { className: 'pp-page' }, [
        h('h2', { key: 'title', className: 'pp-title' }, t('font.title')),
        h('p', { key: 'sub', className: 'pp-sub' }, t('font.subtitle')),

        missing === undefined
          ? h('p', { key: 'loading', className: 'pp-sub' }, t('font.loading'))
          : missing.length === 0
            ? h('p', { key: 'ok', className: 'pp-ok' }, t('font.ok'))
            : h('p', { key: 'warn', className: 'pp-warn' }, t('font.missing', { name: missing.join(', ') })),

        h('section', { key: 'stack', className: 'pp-block' }, [
          h('h3', { className: 'pp-block__title' }, t('font.stack')),
          h('pre', { className: 'pp-sample' }, [
            h('div', { key: 'mono', className: 'pp-sample__row' }, [
              h('span', { className: 'pp-sample__tag' }, t('font.mono')),
              h('span', { className: 'pp-sample__sans' }, 'const'),
              ' x = 1; ',
              h('span', { className: 'pp-sample__sans' }, '你好'),
            ]),
            h('div', { key: 'sans', className: 'pp-sample__row' }, [
              h('span', { className: 'pp-sample__tag' }, t('font.sans')),
              '正文示例：这是一段中文，用来验证兜底字体。',
            ]),
          ]),
        ]),
      ])
    }

    exports.apply = apply
    exports.inject = inject
    exports.name = 'dsh-plus-plus'
    return module.exports
  },
})
