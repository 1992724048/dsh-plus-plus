window.__ModuleLoader__.load({
  id: "dsh-plus-plus/client.composer.css.model.js",
  factory: () => {
    const module = { exports: {} }
    const CSS = `
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

[data-composer-card] [data-slot="conversation.input.model"] [class*="triggerEffort"] {
  border-radius: 0;
  flex-shrink: 0;
  padding: 0 5px;
  line-height: 18px;
  font-size: 11px;
  font-weight: 500;
  background: var(--pp-composer-effort-0);
  color: var(--pp-composer-effort-ink-on);
}

[data-composer-card] [data-slot="conversation.input.model"] [class*="triggerEffort"][data-pp-effort="1"] {
  background: var(--pp-composer-effort-1);
  color: var(--pp-composer-effort-ink-on);
}

[data-composer-card] [data-slot="conversation.input.model"] [class*="triggerEffort"][data-pp-effort="2"] {
  background: var(--pp-composer-effort-2);
  color: var(--pp-composer-effort-ink);
}

[data-composer-card] [data-slot="conversation.input.model"] [class*="triggerEffort"][data-pp-effort="3"] {
  background: var(--pp-composer-effort-3);
  color: var(--pp-composer-effort-ink);
}

[data-composer-card] [data-slot="conversation.input.model"] [class*="triggerEffort"][data-pp-effort="4"] {
  background: var(--pp-composer-effort-4);
  color: var(--pp-composer-effort-ink);
}

[data-composer-card] [data-slot="conversation.input.model"] [class*="triggerEffort"][data-pp-effort="5"] {
  background: var(--pp-composer-effort-5);
  color: var(--pp-composer-effort-ink-on);
}

[data-composer-card] [class*="_modes"] button:hover:not(:disabled) {
  background: var(--pp-composer-trigger-hover);
}

[data-composer-card] [data-slot="conversation.input.model"] button:hover:not(:disabled) {
  background: var(--pp-composer-accent-hover);
  color: var(--pp-composer-accent-hover-ink);
}
`.trim()
    module.exports = { CSS }
    return module.exports
  },
})
