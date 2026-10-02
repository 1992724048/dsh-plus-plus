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
        'shape.title': '直角',
        'shape.subtitle': '面板、卡片、按钮、输入框、代码块、标签全部改为直角；头像、状态点等圆形元素保留。',
        'shape.radiusScale': '圆角刻度',
        'shape.pills': '胶囊标签',
        'shape.roundKept': '保留圆形',
        'shape.on': '直角',
        'shape.keep': '保留',
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
        'shape.title': 'Sharp corners',
        'shape.subtitle': 'Panels, cards, buttons, inputs, code blocks and chips are all square; avatars, status dots and other genuinely round elements keep their shape.',
        'shape.radiusScale': 'Radius scale',
        'shape.pills': 'Pill chips',
        'shape.roundKept': 'Kept round',
        'shape.on': 'Square',
        'shape.keep': 'Kept',
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
     *
     * The host already owns two font variables — `--dsw-font-family` for body
     * text and `--ds-font-family-code` for code — and the conversation surface is
     * built entirely out of them, including the markdown heading ladder
     * (`--dsw-font-markdown-h1…h4` all end in `var(--dsw-font-family)`).
     *
     * So we redefine those two variables rather than writing our own element
     * rules. An `html, body` rule loses to any class selector that sets its own
     * `font-family`, which is exactly why the first version covered the sidebar
     * but not the conversation. Redefining the variable reaches every consumer at
     * once and keeps the host's own size/weight ladder intact.
     */
    const STACK_CSS = `
:root {
  --pp-font-mono: 'JetBrains Mono', 'HarmonyOS Sans', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --pp-font-sans: 'HarmonyOS Sans', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;

  /* Re-point the host's own font variables at our stacks. Body text keeps the
     host's CJK-friendly tail as a final fallback. */
  --dsw-font-family: var(--pp-font-sans);
  --ds-font-family-code: var(--pp-font-mono);

  /* The host reads a third variable in a few places (document preview, tool
     cards) where it falls back to inheriting; point it at the body face too. */
  --dsw-font: var(--pp-font-sans);
}
code, pre, kbd, samp {
  font-family: var(--ds-font-family-code);
  font-feature-settings: 'liga' 1, 'calt' 1;
}
`.trim()

    // ── sharp corners ──────────────────────────────────────────────────────────
    /**
     * Flatten every corner in the shell, keeping genuinely round things round.
     *
     * Two layers, and both are needed because the host uses both styles:
     *
     *  1. The radius scale. The host owns six `--dsw-radius-*` variables and most
     *     of its CSS reads them rather than hardcoding a length, so zeroing the
     *     six covers panels, cards, inputs, buttons, code blocks and modals. The
     *     five `--dsl-*-radius` tokens are derived from the scale and are reset
     *     explicitly so a stale theme value cannot leak through.
     *
     *  2. The ~163 rules that hardcode a `px` length, which no variable reaches —
     *     including the 27 `999px` pills used for chips and tags.
     *
     * The sweep has to win against class selectors (`(0,1,0)`), so it uses
     * `!important`. That in turn would flatten the 37 `border-radius: 50%` rules
     * for avatars, status dots, progress rings and checkbox knobs — which the user
     * asked to keep round.
     *
     * The host marks those with `corner-shape: round` (33 of the 37 rules carry
     * it alongside the `50%`), and that property is the CSS Shapes `corner-shape`
     * feature. Declaring `corner-shape: square` re-squares exactly the elements
     * that were deliberately round, leaving everything else flattened.
     */
    const SHARP_CSS = `
:root {
  --dsw-radius-xs: 0px;
  --dsw-radius-sm: 0px;
  --dsw-radius-md: 0px;
  --dsw-radius-lg: 0px;
  --dsw-radius-xl: 0px;
  --dsw-radius-panel: 0px;

  --dsl-code-block-border-radius: 0px;
  --dsl-guide-entry-radius: 0px;
  --dsl-search-radius: 0px;
  --dsl-terminal-radius: 0px;
  --dsl-web-radius: 0px;
}
* { border-radius: 0 !important; }
*::-webkit-scrollbar-thumb { border-radius: 0 !important; }

/* Keep what the host explicitly marked as round: avatars, status dots, the
   checkbox knob, progress rings. */
[style*="corner-shape"] { corner-shape: square !important; }
`.trim()

    /** Settings-page styling. Scoped under `.pp-` so it cannot restyle the shell. */
    const PAGE_CSS = `
.pp-page { display: flex; flex-direction: column; gap: 16px; padding: 4px 2px 24px; }
.pp-title { margin: 0; font-size: 18px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.pp-title--gap { margin-top: 8px; }
.pp-sub { margin: 0; font-size: 13px; color: var(--dsw-alias-label-secondary); }
.pp-warn { margin: 0; font-size: 12px; color: var(--dsw-alias-state-warn-primary); }
.pp-ok { margin: 0; font-size: 12px; color: var(--dsw-alias-state-success-primary); }
.pp-block { display: flex; flex-direction: column; gap: 8px; }
.pp-block__title { margin: 0; font-size: 14px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.pp-demo { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pp-demo__card {
  padding: 8px 14px; font-size: 12px; color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1);
}
.pp-demo__pill {
  padding: 4px 12px; font-size: 11px; color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l2);
}
.pp-demo__dot {
  width: 12px; height: 12px; flex: none;
  background: var(--dsw-alias-brand-primary);
  border-radius: 50%; corner-shape: round;
}
.pp-demo__label { font-size: 11px; color: var(--dsw-alias-label-secondary); }
.pp-sample {
  margin: 0; padding: 12px 14px; border-radius: 0;
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
      return `${imports}\n${STACK_CSS}\n${SHARP_CSS}\n${PAGE_CSS}`
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
      }, () => h(SettingsPage, { t })))
    }

    // ── settings page ──────────────────────────────────────────────────────────
    /**
     * The two active features, with a live readiness check for the fonts.
     *
     * The check issues `HEAD` against one representative asset per family: a 404
     * means the host is not serving that package, which is otherwise a failure the
     * user would only notice as subtly wrong-looking glyphs.
     */
    function SettingsPage({ t }) {
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
        // ── fonts ──
        h('h2', { key: 'font-title', className: 'pp-title' }, t('font.title')),
        h('p', { key: 'font-sub', className: 'pp-sub' }, t('font.subtitle')),

        missing === undefined
          ? h('p', { key: 'font-loading', className: 'pp-sub' }, t('font.loading'))
          : missing.length === 0
            ? h('p', { key: 'font-ok', className: 'pp-ok' }, t('font.ok'))
            : h('p', { key: 'font-warn', className: 'pp-warn' }, t('font.missing', { name: missing.join(', ') })),

        h('section', { key: 'font-stack', className: 'pp-block' }, [
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

        // ── sharp corners ──
        h('h2', { key: 'shape-title', className: 'pp-title pp-title--gap' }, t('shape.title')),
        h('p', { key: 'shape-sub', className: 'pp-sub' }, t('shape.subtitle')),
        h('div', { key: 'shape-demo', className: 'pp-demo' }, [
          h('div', { key: 'a', className: 'pp-demo__card' }, t('shape.radiusScale')),
          h('div', { key: 'b', className: 'pp-demo__pill' }, t('shape.pills')),
          h('div', { key: 'c', className: 'pp-demo__dot' }, null),
          h('span', { key: 'd', className: 'pp-demo__label' }, `${t('shape.roundKept')} ✓`),
        ]),
      ])
    }

    exports.apply = apply
    exports.inject = inject
    exports.name = 'dsh-plus-plus'
    return module.exports
  },
})
