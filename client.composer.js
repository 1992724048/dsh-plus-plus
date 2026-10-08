window.__ModuleLoader__.load({
  id: 'dsh-plus-plus/client.composer.js',
  factory: require => {
    const module = { exports: {} }
    const exports = module.exports

    const React = require('react')
    const { createElement: h } = React

    let corePromise
    const core = () => (corePromise ??= require.async('./client.core.js'))

    const STYLE_PARTS = [
      './client.composer.css.js',
      './client.composer.css.layout.js',
      './client.composer.css.controls.js',
      './client.composer.css.model.js',
      './client.composer.css.permission.js',
      './client.composer.css.chrome.js',
    ]

    const BEHAVIORS = [
      './client.composer.permission.js',
      './client.composer.effort.js',
      './client.composer.fan.js',
      './client.composer.attach.js',
    ]

    const DICT = {
      zh: {
        'composer.title': '输入框',
        'composer.subtitle': '编辑区、工具行、各个按钮各自独立成块。两个主题下编辑区均为半透明白色毛玻璃、按钮白色；墨色与描边随主题反转。',
        'composer.attach': '添加文件',
      },
      en: {
        'composer.title': 'Composer',
        'composer.subtitle': 'The editor, the tool row and every control are their own blocks. Both schemes: a translucent white blurred editor and white buttons; ink and hairlines follow the theme.',
        'composer.attach': 'Add files',
      },
    }

    function Settings({ t }) {
      return h('div', { className: 'pp-section' }, [
        h('h2', { className: 'pp-title' }, t('composer.title')),
        h('p', { className: 'pp-sub' }, t('composer.subtitle')),
      ])
    }

    exports.id = 'dsh-plus-plus/client.composer.js'
    exports.descriptor = {
      id: 'composer',
      group: 'ui',
      order: 30,
      locale: DICT,
      title: 'composer.title',
      settings: Settings,
      async apply(ctx) {
        const [{ registerStyles, applyPalette }, declarations, ...parts] = await Promise.all([
          core(),
          ...STYLE_PARTS.map(name => require.async(name)),
        ])

        applyPalette(ctx, declarations.PALETTE, 'composer')
        const CSS = parts.map(part => part.CSS).filter(Boolean).join('\n')
        registerStyles(ctx, `${CSS}\n${declarations.SEAT_CSS}`, 'composer')

        const behaviors = await Promise.allSettled(BEHAVIORS.map(name => require.async(name)))
        for (const behavior of behaviors) {
          if (behavior.status === 'rejected') {
            console.error('dsh-plus-plus: composer behavior load failed', behavior.reason)
            continue
          }
          try {
            behavior.value.install(ctx)
          } catch (error) {
            console.error('dsh-plus-plus: composer behavior install failed', error)
          }
        }
      },
    }
    return module.exports
  },
})
