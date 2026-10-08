window.__ModuleLoader__.load({
  id: "dsh-plus-plus/client.composer.css.controls.js",
  factory: () => {
    const module = { exports: {} }
    const CSS = `
[data-composer-card] :is(button, [role="button"]) {
  border: 1px solid var(--pp-composer-stroke);
  border-radius: 0;
  box-shadow: none;
  background: var(--pp-composer-control);
  transform: translateZ(0);
  align-self: center;
  vertical-align: middle;
}

[data-composer-card] :is(button, [role="button"]):hover:not(:disabled) {
  background: var(--pp-composer-hover);
}

[data-composer-card] :is(button, [role="button"]):focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary, #2563EB));
  outline-offset: 2px;
}

[data-composer-card] button[aria-haspopup="listbox"][aria-expanded="true"] {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary, #2563EB));
  outline-offset: 2px;
}

[data-pp-fan] {
  background: transparent !important;
  box-shadow: none !important;
  border: 0 !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

[data-pp-fan] [class*="_material"] {
  display: none !important;
}

[data-pp-fan] [data-pp-fan-item] {
  position: fixed !important;
  min-width: max-content;
  white-space: nowrap;
  transform: translate(-50%, -50%);
  transition: transform .14s ease;
}

[data-pp-fan] [data-pp-fan-item]:hover,
[data-pp-fan] [data-pp-fan-item][aria-selected="true"] {
  transform: translate(-50%, -50%) scale(1.08);
  outline: 2px solid var(--pp-composer-accent-hover);
  outline-offset: 2px;
}

[data-pp-fan] *:not([data-pp-fan-item]):not(:has([data-pp-fan-item])):not([data-pp-fan-item] *) {
  display: none !important;
}


[data-composer-card] button.pp-attach {
  background: var(--pp-composer-tool);
  border: 0;
  color: var(--pp-composer-tool-ink);
  width: var(--pp-composer-control-size);
  height: var(--pp-composer-control-size);
  padding: 0;
  display: grid;
  place-items: center;
  transition: background-color var(--pp-composer-accent-transition) ease,
              color var(--pp-composer-accent-transition) ease;
}

[data-composer-card] button.pp-attach:hover:not(:disabled) {
  background: var(--pp-composer-accent-hover);
  color: var(--pp-composer-accent-hover-ink);
}
`.trim()
    module.exports = { CSS }
    return module.exports
  },
})
