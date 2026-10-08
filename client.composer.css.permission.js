window.__ModuleLoader__.load({
  id: "dsh-plus-plus/client.composer.css.permission.js",
  factory: () => {
    const module = { exports: {} }
    const CSS = `
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

[data-composer-card] [data-slot="conversation.input.permission"] button[data-pp-mode="readonly"]:hover:not(:disabled) {
  background: var(--pp-composer-permission-readonly-hover);
}

[data-composer-card] [data-slot="conversation.input.permission"] button[data-pp-mode="workspace"]:hover:not(:disabled) {
  background: var(--pp-composer-permission-workspace-hover);
}

[data-composer-card] [data-slot="conversation.input.permission"] button[data-pp-mode="full"]:hover:not(:disabled) {
  background: var(--pp-composer-permission-full-hover);
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
`.trim()
    module.exports = { CSS }
    return module.exports
  },
})
