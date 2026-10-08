window.__ModuleLoader__.load({
  id: 'dsh-plus-plus/client.composer.css.js',
  factory: () => {
    const module = { exports: {} }

    const PALETTE = {
      '--pp-composer-surface': { light: 'rgb(255 255 255 / 50%)', dark: 'rgb(0 0 0 / 60%)' },
      '--pp-composer-blur': { light: '16px', dark: '16px' },
      '--pp-composer-placeholder-ink': { light: 'rgb(0 0 0 / 62%)', dark: 'rgb(255 255 255 / 78%)' },
      '--pp-composer-permission-readonly': { light: '#67C23A', dark: '#67C23A' },
      '--pp-composer-permission-readonly-ink': { light: '#000', dark: '#000' },
      '--pp-composer-permission-readonly-hover': { light: '#85CE61', dark: '#85CE61' },
      '--pp-composer-permission-workspace': { light: '#409EFF', dark: '#409EFF' },
      '--pp-composer-permission-workspace-ink': { light: '#000', dark: '#000' },
      '--pp-composer-permission-workspace-hover': { light: '#66B1FF', dark: '#66B1FF' },
      '--pp-composer-permission-full': { light: '#E6A23C', dark: '#E6A23C' },
      '--pp-composer-permission-full-ink': { light: '#000', dark: '#000' },
      '--pp-composer-permission-full-hover': { light: '#EBB563', dark: '#EBB563' },
      '--pp-composer-trigger': { light: '#fff', dark: '#000' },
      '--pp-composer-trigger-ink': { light: '#000', dark: '#fff' },
      '--pp-composer-trigger-hover': { light: 'rgb(255 255 255 / 14%)', dark: 'rgb(255 255 255 / 14%)' },
      '--pp-composer-tool': { light: '#fff', dark: '#000' },
      '--pp-composer-tool-ink': { light: '#000', dark: '#fff' },
      '--pp-composer-effort-0': { light: '#909399', dark: '#909399' },
      '--pp-composer-effort-1': { light: '#F56C6C', dark: '#F56C6C' },
      '--pp-composer-effort-2': { light: '#E6A23C', dark: '#E6A23C' },
      '--pp-composer-effort-3': { light: '#67C23A', dark: '#67C23A' },
      '--pp-composer-effort-4': { light: '#409EFF', dark: '#409EFF' },
      '--pp-composer-effort-5': { light: '#6F459E', dark: '#6F459E' },
      '--pp-composer-effort-ink': { light: '#000', dark: '#000' },
      '--pp-composer-effort-ink-on': { light: '#fff', dark: '#fff' },
      '--pp-composer-accent': { light: '#fff', dark: '#000' },
      '--pp-composer-accent-ink': { light: '#000', dark: '#fff' },
      '--pp-composer-accent-hover': { light: '#ffee22', dark: '#ffee22' },
      '--pp-composer-accent-hover-ink': { light: '#000', dark: '#000' },
      '--pp-composer-accent-transition': { light: '200ms', dark: '200ms' },
      '--pp-composer-stroke': { light: 'rgb(0 0 0 / 16%)', dark: 'rgb(255 255 255 / 22%)' },
      '--pp-composer-control': { light: 'rgb(255 255 255 / 12%)', dark: 'rgb(255 255 255 / 12%)' },
      '--pp-composer-hover': { light: 'rgb(255 255 255 / 8%)', dark: 'rgb(255 255 255 / 8%)' },
      '--pp-composer-queue': { light: 'rgb(255 255 255 / 35%)', dark: 'rgb(0 0 0 / 45%)' },
      '--pp-composer-attachment': { light: '#F56C6C', dark: '#F56C6C' },
      '--pp-composer-attachment-ink': { light: '#fff', dark: '#fff' },
      '--pp-composer-stop': { light: '#F56C6C', dark: '#F56C6C' },
      '--pp-composer-stop-ink': { light: '#fff', dark: '#fff' },
      '--pp-composer-disabled': { light: '#C0C4CC', dark: '#3F434B' },
      '--pp-composer-disabled-ink': { light: '#787D86', dark: '#AEB3BB' },
    }

    const SEAT_CSS = `
[class*="composerSeat"] {
  background: linear-gradient(180deg, rgb(0 0 0 / 0%) 0px, rgb(0 0 0 / 0%) var(--pp-composer-seat-fade, 36px)) !important;
}
`.trim()

    module.exports = { PALETTE, SEAT_CSS }
    return module.exports
  },
})
