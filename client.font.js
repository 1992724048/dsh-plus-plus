window.__ModuleLoader__.load({
  id: 'dsh-plus-plus/client.font.js',
  factory: require => {
    const module = { exports: {} }
    const exports = module.exports

    const React = require('react')
    const { createElement: h } = React

    let corePromise
    const core = () => (corePromise ??= require.async('./client.core.js'))

    const DICT = {
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
    }

    const FONT_ROUTE = '/api/dsh-plus-plus/fonts'

    const SHEETS = [
      ...['latin', 'latin-ext', 'cyrillic', 'greek', 'vietnamese']
        .flatMap(subset => ['300', '400', '500', '600', '700'].map(weight => `${subset}-${weight}.css`))
        .map(file => ({ family: 'jetbrains-mono', file })),
      ...['Light', 'Regular', 'Medium', 'Semibold', 'Bold']
        .map(weight => ({ family: 'harmonyos-sans-sc', file: `${weight}.css` })),
    ]

    const PROBES = [
      ['JetBrains Mono', `${FONT_ROUTE}/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2`],
      ['HarmonyOS Sans', `${FONT_ROUTE}/harmonyos-sans-sc/Regular.css`],
    ]

    const CSS = `
@import ${SHEETS.map(entry => `url("${FONT_ROUTE}/${entry.family}/${entry.file}")`).join('\n@import ')};

:root {
  --pp-font-mono: 'JetBrains Mono', 'HarmonyOS Sans', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --pp-font-sans: 'HarmonyOS Sans', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --dsw-font-family: var(--pp-font-sans);
  --ds-font-family-code: var(--pp-font-mono);
  --dsw-font: var(--pp-font-sans);
}
code, pre, kbd, samp {
  font-family: var(--ds-font-family-code);
  font-feature-settings: 'liga' 1, 'calt' 1;
}
`.trim()

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

    exports.id = 'dsh-plus-plus/client.font.js'
    exports.descriptor = {
      id: 'font',
      group: 'theme',
      order: 10,
      locale: DICT,
      css: CSS,
      title: 'font.title',
      settings: Settings,
      async apply(ctx) {
        const { registerStyles } = await core()
        registerStyles(ctx, CSS, 'font')
      },
    }
    return module.exports
  },
})
