window.__ModuleLoader__.load({
  id: 'dsh-plus-plus/client.composer.css.js',
  factory: () => {
    const module = { exports: {} }

    const PALETTE = {
      '--pp-composer-surface': { light: 'rgb(255 255 255 / 50%)', dark: 'rgb(255 255 255 / 50%)' },
      '--pp-composer-blur': { light: '16px', dark: '16px' },
      '--pp-composer-placeholder-ink': { light: 'rgb(0 0 0 / 62%)', dark: 'rgb(255 255 255 / 78%)' },
      '--pp-composer-permission-readonly': { light: '#67C23A', dark: '#67C23A' },
      '--pp-composer-permission-readonly-ink': { light: '#000', dark: '#000' },
      '--pp-composer-permission-workspace': { light: '#409EFF', dark: '#409EFF' },
      '--pp-composer-permission-workspace-ink': { light: '#000', dark: '#000' },
      '--pp-composer-permission-full': { light: '#E6A23C', dark: '#E6A23C' },
      '--pp-composer-permission-full-ink': { light: '#000', dark: '#000' },
      '--pp-composer-permission-hover': { light: 'rgb(255 255 255 / 18%)', dark: 'rgb(255 255 255 / 18%)' },
      '--pp-composer-trigger': { light: '#fff', dark: '#fff' },
      '--pp-composer-trigger-ink': { light: '#000', dark: '#000' },
      '--pp-composer-trigger-hover': { light: 'rgb(255 255 255 / 14%)', dark: 'rgb(255 255 255 / 14%)' },
      '--pp-composer-accent': { light: '#fff', dark: '#fff' },
      '--pp-composer-accent-ink': { light: '#000', dark: '#000' },
      '--pp-composer-accent-hover': { light: '#ffee22', dark: '#ffee22' },
      '--pp-composer-accent-hover-ink': { light: '#000', dark: '#000' },
      '--pp-composer-accent-transition': { light: '200ms', dark: '200ms' },
      '--pp-composer-stroke': { light: 'rgb(0 0 0 / 16%)', dark: 'rgb(255 255 255 / 22%)' },
      '--pp-composer-control': { light: 'rgb(255 255 255 / 12%)', dark: 'rgb(255 255 255 / 12%)' },
      '--pp-composer-hover': { light: 'rgb(255 255 255 / 8%)', dark: 'rgb(255 255 255 / 8%)' },
      '--pp-composer-attachment': { light: '#F56C6C', dark: '#F56C6C' },
      '--pp-composer-attachment-ink': { light: '#fff', dark: '#fff' },
      '--pp-composer-focus': { light: '#2563EB', dark: '#60a5fa' },
      '--pp-composer-disabled': { light: 'rgb(0 0 0 / 8%)', dark: 'rgb(255 255 255 / 10%)' },
      '--pp-composer-disabled-ink': { light: 'rgb(0 0 0 / 30%)', dark: 'rgb(255 255 255 / 30%)' },
    }

    const SEAT_CSS = `
[class*="composerSeat"] {
  background: linear-gradient(180deg, rgb(0 0 0 / 0%) 0px, rgb(0 0 0 / 0%) var(--pp-composer-seat-fade, 36px)) !important;
}
`.trim()

    const CSS = `
[data-composer-card] {
  --pp-composer-block-gap: 4px;
  --pp-composer-inset: 10px;
  --pp-composer-control-size: 28px;
  background: transparent;
  box-shadow: none;
  border: 0;
  gap: var(--pp-composer-block-gap);
  padding: 0 0 var(--pp-composer-block-gap);
}

[data-composer-card] > [data-input-scroll] {
  box-sizing: border-box;
  border: 0;
  background: var(--pp-composer-surface);
  -webkit-backdrop-filter: blur(var(--pp-composer-blur));
  backdrop-filter: blur(var(--pp-composer-blur));
  margin-inline: var(--pp-composer-inset);
  border-radius: 0;
}

[data-composer-input] {
  padding: 10px 12px;
  min-height: 44px;
}

[data-composer-placeholder] {
  color: var(--pp-composer-placeholder-ink);
  inset: 10px 12px auto;
}

[data-composer-card] > [data-input-scroll]::-webkit-scrollbar-track {
  margin-top: 10px;
}

[data-composer-card] > [data-input-scroll] ~ [class*="_row"] {
  background: transparent;
  border: 0;
  margin-inline: var(--pp-composer-inset);
  border-radius: 0;
  padding: 0;
}

[data-composer-card] :is([class*="_tools"], [class*="_modes"], [class*="_standardControls"]) {
  gap: 4px;
}

[data-composer-card] [class*="_trailing"] {
  gap: 4px;
}

[data-composer-card] [class*="_trailing"] [class*="_activity"] {
  display: contents;
}

[data-composer-card] :is(button, [role="button"]) {
  border: 1px solid var(--pp-composer-stroke);
  border-radius: 0;
  box-shadow: none;
  background: var(--pp-composer-control);
  transform: none;
  align-self: center;
  vertical-align: middle;
}

[data-composer-card] :is(button, [role="button"]):hover:not(:disabled) {
  background: var(--pp-composer-hover);
}

[data-composer-card] :is(button, [role="button"]):focus {
  outline: 2px solid var(--pp-composer-focus);
  outline-offset: 2px;
}

[data-composer-card] [class*="_modes"] button,
[data-composer-card] [data-slot="conversation.input.model"] button {
  height: var(--pp-composer-control-size);
  padding: 0 12px;
  width: max-content;
  max-width: 340px;
  background: var(--pp-composer-trigger);
  color: var(--pp-composer-trigger-ink);
  overflow: hidden;
}

[data-composer-card] [data-slot="conversation.input.model"] button {
  min-width: 0;
  border: 0;
  transition: background-color var(--pp-composer-accent-transition) ease,
              color var(--pp-composer-accent-transition) ease;
}

[data-composer-card] [data-slot="conversation.input.model"] [class*="triggerLabel"],
[data-composer-card] [data-slot="conversation.input.model"] [class*="triggerEffort"] {
  display: inline !important;
  flex: 0 0 auto !important;
}

[data-composer-card] [data-slot="conversation.input.model"] [class*="triggerIcon"] {
  display: none !important;
}

[data-composer-card] [class*="_modes"] button:hover:not(:disabled) {
  background: var(--pp-composer-trigger-hover);
}

[data-composer-card] [data-slot="conversation.input.model"] button:hover:not(:disabled) {
  background: var(--pp-composer-accent-hover);
  color: var(--pp-composer-accent-hover-ink);
}

[data-composer-card] [data-slot="conversation.input.permission"] button {
  border: 0;
  transition: background-color var(--pp-composer-accent-transition) ease,
              color var(--pp-composer-accent-transition) ease;
}

[data-composer-card] [data-slot="conversation.input.permission"] button[data-pp-mode="readonly"] {
  background: var(--pp-composer-permission-readonly);
  color: var(--pp-composer-permission-readonly-ink);
}

[data-composer-card] [data-slot="conversation.input.permission"] button[data-pp-mode="workspace"] {
  background: var(--pp-composer-permission-workspace);
  color: var(--pp-composer-permission-workspace-ink);
}

[data-composer-card] [data-slot="conversation.input.permission"] button[data-pp-mode="full"] {
  background: var(--pp-composer-permission-full);
  color: var(--pp-composer-permission-full-ink);
}

[data-composer-card] [data-slot="conversation.input.permission"] button:hover:not(:disabled) {
  background: var(--pp-composer-permission-hover);
  color: inherit;
}

[data-composer-card] [data-slot="conversation.input.permission"] [class*="_chevron"] {
  color: currentColor;
}

[data-composer-card] button[aria-haspopup="listbox"],
[data-composer-card] [data-input-scroll] ~ [class*="_row"] > div:first-child > button:first-of-type {
  width: var(--pp-composer-control-size);
  height: var(--pp-composer-control-size);
  padding: 0;
}

[data-composer-card] button[aria-haspopup="listbox"] > svg {
  display: block;
  width: 16px;
  height: 16px;
  shape-rendering: geometricPrecision;
}

[data-composer-card] [class*="_trailing"] > button:last-of-type > svg {
  display: block;
  width: 14px;
  height: 14px;
  shape-rendering: geometricPrecision;
}

[data-composer-card] [class*="_trailing"] > button:last-of-type > svg rect {
  rx: 0;
}

[data-composer-card] button[aria-haspopup="listbox"] > svg path[stroke="currentColor"] {
  stroke-width: 1.3;
}

[data-composer-card] button[aria-haspopup="listbox"],
[data-composer-card] [data-input-scroll] ~ [class*="_row"] > div:first-child > button:first-of-type {
  background: var(--pp-composer-accent);
  border: 0;
  color: var(--pp-composer-accent-ink);
  transition: background-color var(--pp-composer-accent-transition) ease,
              color var(--pp-composer-accent-transition) ease;
}

[data-composer-card] button[aria-haspopup="listbox"]:hover:not(:disabled),
[data-composer-card] [data-input-scroll] ~ [class*="_row"] > div:first-child > button:first-of-type:hover:not(:disabled) {
  background: var(--pp-composer-accent-hover);
  color: var(--pp-composer-accent-hover-ink);
}

[data-composer-card] [class*="_trailing"] > button:last-of-type {
  background: var(--pp-composer-accent);
  border: 0;
  color: var(--pp-composer-accent-ink);
  width: var(--pp-composer-control-size);
  height: var(--pp-composer-control-size);
  padding: 0;
  transition: background-color var(--pp-composer-accent-transition) ease,
              color var(--pp-composer-accent-transition) ease;
}

[data-composer-card] [class*="_trailing"] > button:last-of-type:hover:not(:disabled) {
  background: var(--pp-composer-accent-hover);
  color: var(--pp-composer-accent-hover-ink);
}

[data-composer-card] [class*="_trailing"] > button:last-of-type:disabled {
  background: var(--pp-composer-disabled);
  color: var(--pp-composer-disabled-ink);
  opacity: 1;
}

[data-composer-card] > [data-slot="conversation.input.attachments"],
[data-composer-card] > [data-slot="conversation.input.overlay"] {
  margin-inline: var(--pp-composer-inset);
}

[data-composer-card] [data-slot="conversation.input.attachments"] [class*="_remove"] {
  background: var(--pp-composer-attachment);
  color: var(--pp-composer-attachment-ink);
  opacity: 1;
}

html [data-conversation-region] [class*="_dock"]:not([data-composer-card] ~ *) {
  margin-bottom: calc(0px - var(--dsh-composer-stack-gap, 6px) - 3px);
}

[data-composer-card] ~ [class*="_dock"] {
  background: transparent;
  border: 0;
  margin-top: var(--pp-composer-block-gap);
}

[data-composer-card] ~ [class*="_dock"] :is(button, [role="button"]) {
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
  transform: none;
}

[data-composer-card] ~ [class*="_dock"] :is(button, [role="button"]):hover:not(:disabled) {
  background: var(--pp-composer-hover);
}
`.trim()

    module.exports = { PALETTE, CSS, SEAT_CSS }
    return module.exports
  },
})
