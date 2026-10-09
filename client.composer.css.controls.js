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

[data-composer-card] button[data-pp-fan-open] {
  transform: scale(0.96);
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.25);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
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
  width: 36px !important;
  height: 36px !important;
  padding: 0 !important;
  display: grid !important;
  place-items: center;
  border: 0 !important;
  border-radius: 0;
  background: var(--pp-composer-tool) !important;
  color: var(--pp-composer-tool-ink) !important;
  --pp-fan-ink: var(--pp-composer-tool-ink);
  box-shadow: 0 2px 8px rgb(0 0 0 / 25%);
  overflow: hidden;
  --fan-x: 0px;
  --fan-y: 0px;
  --pull-x: 0px;
  --pull-y: 0px;
  transform: translate(-50%, -50%);
  transition: transform .18s ease, background-color .12s ease;
  animation: pp-fan-open .24s cubic-bezier(.2, .8, .3, 1.1);
}

[data-pp-fan] [data-pp-fan-item] :is(svg, svg *) {
  color: var(--pp-fan-ink) !important;
}

[data-pp-fan] [data-pp-fan-item] :is(svg, svg *)[fill]:not([fill="none"]) {
  fill: var(--pp-fan-ink) !important;
}

[data-pp-fan] [data-pp-fan-item] :is(svg, svg *)[stroke]:not([stroke="none"]) {
  stroke: var(--pp-fan-ink) !important;
}

@keyframes pp-fan-open {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) translate(calc(-1 * var(--fan-x)), calc(-1 * var(--fan-y))) scale(.4);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%);
  }
}

[data-pp-fan-ghost] {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2147483000;
}

@keyframes pp-fan-close {
  from {
    opacity: 1;
    transform: translate(-50%, -50%);
  }
  to {
    opacity: 0;
    transform: translate(-50%, -50%) translate(calc(-1 * var(--fan-x)), calc(-1 * var(--fan-y))) scale(.3);
  }
}

[data-pp-fan-ghost] [data-pp-fan-item][data-pp-fan-closing] {
  transition: none;
  animation: pp-fan-close .22s cubic-bezier(.2, .8, .3, 1) forwards;
}

[data-pp-fan] [data-pp-fan-item] > :not(svg):not(:has(svg)) {
  display: none !important;
}

[data-pp-fan] [data-pp-fan-item] [class*="_label"]:not(:has(svg)),
[data-pp-fan] [data-pp-fan-item] [class*="_detail"]:not(:has(svg)),
[data-pp-fan] [data-pp-fan-item] [class*="_badge"]:not(:has(svg)) {
  display: none !important;
}

[data-pp-fan] [data-pp-fan-item]:hover {
  z-index: 5;
  background: var(--pp-composer-accent-hover, #ffee22) !important;
  color: var(--pp-composer-accent-hover-ink, #000) !important;
  --pp-fan-ink: var(--pp-composer-accent-hover-ink, #000);
  outline: none;
  transform: translate(-50%, -50%) translate(var(--pull-x), var(--pull-y)) scale(1.12);
  box-shadow: 0 4px 12px rgb(0 0 0 / 35%);
}

[data-pp-fan] [data-pp-fan-item][aria-selected="true"]:not(:hover),
[data-pp-fan] [data-pp-fan-item][class*="rowActive"]:not(:hover) {
  background: var(--dsw-alias-bg-layer-2) !important;
  color: var(--pp-composer-tool-ink) !important;
  --pp-fan-ink: var(--pp-composer-tool-ink);
}

[data-pp-fan] *:not([data-pp-fan-item]):not(:has([data-pp-fan-item])):not([data-pp-fan-item] *) {
  display: none !important;
}

@media (prefers-reduced-motion: reduce) {
  [data-pp-fan] [data-pp-fan-item] {
    animation: none;
    transition: none;
  }
  [data-pp-fan-ghost] [data-pp-fan-item][data-pp-fan-closing] {
    animation: none;
  }
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
