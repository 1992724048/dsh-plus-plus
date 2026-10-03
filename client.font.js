/**
 * Plus Plus — font feature chunk.
 *
 * JetBrains Mono first, HarmonyOS Sans as the Chinese fallback, both from npm
 * dependencies rather than the system, so a machine with neither installed still
 * renders identically.
 *
 * Owns everything font-specific: which stylesheets to load, the stacks, and the
 * host variables to re-point. Nothing here reaches outside the chunk except the
 * core helpers.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plus-plus/client.font.js',
  factory: require => {
    const module = { exports: {} }
    const exports = module.exports

    const React = require('react')
    const core = require('dsh-plus-plus/client.core.js')
    const { createElement: h } = React
    const { defineFeature, registerStyles, dictionaries, FONT_ROUTE } = core

    // ── copy ───────────────────────────────────────────────────────────────────
    const DICT = dictionaries('font', {
      zh: {
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
        'font.title': 'Fonts',
        'font.subtitle': 'JetBrains Mono first, HarmonyOS Sans as the Chinese fallback — both from npm dependencies, never from the system.',
        'font.stack': 'Current stack',
        'font.sans': 'Body',
        'font.mono': 'Monospace',
        'font.loading': 'Checking fonts…',
        'font.ok': 'Fonts ready',
        'font.missing': 'Font not ready: {name}. The host may have no font route — check that dependencies installed completely.',
      },
    })

    // ── what to load ───────────────────────────────────────────────────────────
    /**
     * The stylesheets to load, per family.
     *
     * Each entry is a path relative to that family's served root, because the
     * packages resolve their own `url()` relatively and the host serves each
     * package from its own root: `@fontsource/jetbrains-mono` writes
     * `./files/…`, while the HarmonyOS package writes `./Regular/…`.
     *
     * The subsets loaded are the ones that can carry glyphs this shell shows: the
     * UI is zh/en, and conversations can carry Cyrillic or Greek. The HarmonyOS SC
     * stylesheets are one per weight and cover the whole CJK range — their
     * `unicode-range` already splits them into ~82 shards per weight, so a page
     * only downloads the shards holding characters actually on screen.
     */
    const SHEETS = [
      ...['latin', 'latin-ext', 'cyrillic', 'greek', 'vietnamese']
        .flatMap(subset => ['300', '400', '500', '600', '700'].map(weight => `${subset}-${weight}.css`))
        .map(file => ({ family: 'jetbrains-mono', file })),
      ...['Light', 'Regular', 'Medium', 'Semibold', 'Bold']
        .map(weight => ({ family: 'harmonyos-sans-sc', file: `${weight}.css` })),
    ]

    /** One representative asset per family, for the readiness check. */
    const PROBES = [
      ['JetBrains Mono', `${FONT_ROUTE}/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2`],
      ['HarmonyOS Sans', `${FONT_ROUTE}/harmonyos-sans-sc/Regular.css`],
    ]

    // ── the stylesheet ─────────────────────────────────────────────────────────
    /**
     * JetBrains Mono leads every monospace stack and HarmonyOS Sans follows it.
     * The browser resolves the list per character, so Latin text uses JetBrains
     * Mono and CJK falls through to HarmonyOS Sans within one declaration.
     *
     * The host already owns two font variables — `--dsw-font-family` for body and
     * `--ds-font-family-code` for code — and the conversation surface is built
     * entirely out of them, including the markdown heading ladder
     * (`--dsw-font-markdown-h1…h4` all end in `var(--dsw-font-family)`).
     *
     * So we re-point those two variables rather than writing element rules. An
     * `html, body` rule loses to any class selector that sets its own
     * `font-family`, which is exactly why the first version covered the sidebar
     * but not the conversation.
     */
    const CSS = `
@import ${SHEETS.map(entry => `url("${FONT_ROUTE}/${entry.family}/${entry.file}")`).join('\n@import ')};

:root {
  --pp-font-mono: 'JetBrains Mono', 'HarmonyOS Sans', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --pp-font-sans: 'HarmonyOS Sans', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;

  /* Re-point the host's own variables at our stacks, keeping its size and weight
     ladders intact. */
  --dsw-font-family: var(--pp-font-sans);
  --ds-font-family-code: var(--pp-font-mono);

  /* A third variable the host reads in a few places (document preview, tool cards)
     where it falls back to inheriting. */
  --dsw-font: var(--pp-font-sans);
}
code, pre, kbd, samp {
  font-family: var(--ds-font-family-code);
  font-feature-settings: 'liga' 1, 'calt' 1;
}
`.trim()

    /**
     * Probe both families once.
     *
     * A 404 means the host is not serving that package, which is otherwise a
     * failure the user would only notice as subtly wrong-looking glyphs.
     */
    async function probe() {
      return Promise.all(PROBES.map(async ([name, url]) => {
        try {
          const response = await fetch(url, { method: 'HEAD' })
          return response.ok ? undefined : name
        } catch {
          return name
        }
      })).then(results => results.filter(Boolean))
    }

    // ── settings section ───────────────────────────────────────────────────────
    /**
     * A live preview of the stack.
     *
     * `t` comes from `client.js`, which owns the locale binding — a feature
     * contributes one section and never registers a dictionary itself.
     */
    function Settings({ t }) {
      const { useState, useEffect } = React
      const [missing, setMissing] = useState(undefined)

      useEffect(() => {
        let alive = true
        void probe().then(result => { if (alive) setMissing(result) })
        return () => { alive = false }
      }, [])

      return h('div', { className: 'pp-section' }, [
        h('h2', { className: 'pp-title' }, t('font.title')),
        h('p', { className: 'pp-sub' }, t('font.subtitle')),
        missing === undefined
          ? h('p', { className: 'pp-sub' }, t('font.loading'))
          : missing.length === 0
            ? h('p', { className: 'pp-ok' }, t('font.ok'))
            : h('p', { className: 'pp-warn' }, t('font.missing', { name: missing.join(', ') })),
        h('pre', { className: 'pp-sample' }, [
          h('div', { className: 'pp-row' }, [
            h('span', { className: 'pp-tag' }, t('font.mono')),
            h('span', { className: 'pp-sans' }, 'const'),
            ' x = 1; ',
            h('span', { className: 'pp-sans' }, '你好'),
          ]),
          h('div', { className: 'pp-row' }, [
            h('span', { className: 'pp-tag' }, t('font.sans')),
            '正文示例：这是一段中文，用来验证兜底字体。',
          ]),
        ]),
      ])
    }

    // ── declaration ────────────────────────────────────────────────────────────
    defineFeature({
      id: 'font',
      group: 'theme',
      order: 10,
      locale: DICT,
      css: CSS,
      title: 'font.title',
      settings: Settings,
      apply(ctx) {
        registerStyles(ctx, CSS, 'font')
      },
    })

    exports.id = 'dsh-plus-plus/client.font.js'
    return module.exports
  },
})
