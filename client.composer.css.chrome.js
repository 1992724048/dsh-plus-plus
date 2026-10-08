window.__ModuleLoader__.load({
  id: "dsh-plus-plus/client.composer.css.chrome.js",
  factory: () => {
    const module = { exports: {} }
    const CSS = `
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
  background: var(--pp-composer-tool);
  border: 0;
  color: var(--pp-composer-tool-ink);
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

[data-composer-card] [class*="_trailing"] > button:has(> svg rect):not(:disabled),
[data-composer-card] [class*="_trailing"] > button:has(> svg rect):hover:not(:disabled),
[data-composer-card] [class*="_trailing"] > button:last-of-type:has(> svg rect):hover:not(:disabled) {
  background: var(--pp-composer-stop);
  color: var(--pp-composer-stop-ink);
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

html [data-conversation-region="composer"] [class*="_panel"]::before {
  background: var(--pp-composer-queue);
  -webkit-backdrop-filter: blur(var(--pp-composer-blur));
  backdrop-filter: blur(var(--pp-composer-blur));
}

html:has([data-conversation-composer-overlay]) [data-composer-card],
html:has([data-conversation-composer-overlay]) [data-slot="conversation.input.dock"] > * {
  display: none;
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
    module.exports = { CSS }
    return module.exports
  },
})
