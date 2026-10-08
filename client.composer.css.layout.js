window.__ModuleLoader__.load({
  id: "dsh-plus-plus/client.composer.css.layout.js",
  factory: () => {
    const module = { exports: {} }
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

[data-composer-card] [class*="_modes"] {
  order: 1;
}

[data-composer-card] [class*="_trailing"] {
  gap: 4px;
}

[data-composer-card] [class*="_trailing"] [class*="_activity"] {
  display: contents;
}
`.trim()
    module.exports = { CSS }
    return module.exports
  },
})
