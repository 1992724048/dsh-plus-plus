/**
 * Plus Plus — composer feature chunk.
 *
 * Restyles the message composer: the editor and the tool row become two separate
 * blocks with a gap, the editor takes a translucent blurred dark surface, and the
 * controls go borderless — the attachment and send buttons sit on white, the rest
 * inherit the editor's surface.
 *
 * Pure CSS. The host's composer is `conversation.composer.bar`, a `single` slot
 * whose `replaceRisk` is `shadows-shipped-ui` — registering there would replace the
 * editor outright and take the editor's paste, `@`-mention, slash-command,
 * attachment, IME-composition and voice-input behaviour with it. Everything the
 * mock-up asks for is reachable by restyling, so nothing here registers a slot.
 *
 * ## Why this keys off `data-*`, not class names
 *
 * The host's class names are build-scoped hashes (`.RlGAzG_row`, `.wq12jW_trigger`),
 * so they change on every release and a selector written against them silently stops
 * matching. It does expose stable attributes — `data-composer-card`,
 * `data-input-scroll`, `data-composer-input` — and those are what this stylesheet
 * anchors on. The hash classes are used only where a stable attribute does not exist,
 * and then alongside a structural attribute check so a rename cannot widen the blast
 * radius.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plus-plus/client.composer.js',
  factory: require => {
    const module = { exports: {} }
    const exports = module.exports

    const React = require('react')
    const { createElement: h } = React

    /** The core chunk. See client.font.js for why this is `require.async`. */
    let corePromise
    const core = () => (corePromise ??= require.async('./client.core.js'))

    const DICT = {
      zh: {
        'composer.title': '输入框',
        'composer.subtitle': '纯黑编辑区、纯黑工具行，两者独立成块、间距 4px；每个按钮各自独立成块——附件与发送白底，其余沿用黑底。',
      },
      en: {
        'composer.title': 'Composer',
        'composer.subtitle': 'A solid black editor and a solid black tool row, each its own block with a 4px gutter; every control is its own block — attach and send on white, the rest on black.',
      },
    }

    /**
     * The composer restyle.
     *
     * Two parts: a token block that themes can override, and the rules themselves.
     *
     * The editor surface is `rgb(0 0 0 / 80%)` plus `backdrop-filter: blur()`, as
     * specified. `backdrop-filter` needs something to blur *through*, so the card's
     * own opaque background is dropped and the composer grows a 1px border to keep an
     * edge against any wallpaper.
     *
     * The two-block layout works by removing the card's background and letting each
     * half paint its own. The host already puts `gap:12px` on the card, which becomes
     * the 8px gutter once the padding is retuned.
     */
    const CSS = `
[data-composer-card] {
  /* Editor surface: solid black. Opaque on purpose — the composer floats over the
     conversation, and a translucent surface lets scrolled message text show through
     as a smear behind the text being typed. */
  --pp-composer-surface: #000;
  --pp-composer-control-fill: #fff;
  --pp-composer-block-gap: 4px;
  --pp-composer-inset: 10px;
  --pp-composer-stroke: 1px solid var(--dsw-alias-border-l1);
  --pp-composer-control-size: 26px;
  --pp-composer-send-size: 28px;

  /* The card stops being a surface; it becomes the gutter between three surfaces:
     the editor, the tool row, and — no longer attached to either. */
  background: transparent;
  box-shadow: none;
  border: 0;
  gap: var(--pp-composer-block-gap);
  padding: var(--pp-composer-block-gap) 0;
}

/* ── the editor block ───────────────────────────────────────────────────────── */

/* The scroll wrapper holds the editor and is the first of the three blocks. */
[data-composer-card] > [data-input-scroll] {
  box-sizing: border-box;
  border: var(--pp-composer-stroke);
  background: var(--pp-composer-surface);
  margin-inline: var(--pp-composer-inset);
  border-radius: 0;
}

/* The host sizes the editor's own padding for a borderless card; the block now
   carries its own border, so the text is inset to clear it. */
[data-composer-input] {
  padding: 10px 12px;
  min-height: 44px;
}

[data-composer-placeholder] {
  inset: 10px 12px auto;
}

/* The host gives the scroll area a right margin for a scrollbar gutter that only
   exists when the text overflows; inside a bordered block it just looks inset. */
[data-composer-card] > [data-input-scroll]::-webkit-scrollbar-track {
  margin-top: 10px;
}

/* ── the tool row ───────────────────────────────────────────────────────────── */

/* The row is no longer a surface. Each control becomes its own block, so the row
   itself is only a positioning context with a gap between the buttons. */
[data-composer-card] > [data-input-scroll] ~ [class*="_row"] {
  background: transparent;
  border: 0;
  margin-inline: var(--pp-composer-inset);
  border-radius: 0;
  padding: 0;
  /* The host ships 12px; the blocks read as separate only with a real gutter. */
  gap: 8px;
}

/* The host's inner groups also carry a 12px gap and, on the trailing group, an
   auto left margin. Both are kept — they are what spreads the blocks apart and
   pushes the trailing ones to the right edge. */

/* ── controls: each one its own block ────────────────────────────────────────── */

/* Every control is a bordered block with the editor's surface. The host draws
   them with a fill and no border; the mock-up wants a bordered block per control,
   so the border is set here rather than cleared. */
[data-composer-card] :is(button, [role="button"]) {
  border: var(--pp-composer-stroke);
  border-radius: 0;
  box-shadow: none;
  background: var(--pp-composer-surface);
}

/* ── control sizing ─────────────────────────────────────────────────────────── */

/* The host fixes the attach button at 28x28 and the send button at 34x34, and the
   send button additionally carries a translateY(-2px) nudge tuned for a layout it
   no longer sits in. Both are overridden so every control shares one scale. */
[data-composer-card] button[aria-haspopup="listbox"],
[data-composer-card] button[aria-haspopup="menu"] {
  padding: 4px 10px;
  min-height: var(--pp-composer-control-size);
}

[data-composer-card] :is(button, [role="button"]) {
  transform: none;
}

[data-composer-card] button[aria-haspopup="listbox"] ~ button,
[data-composer-card] [data-input-scroll] ~ [class*="_row"] > div:first-child > button:first-of-type {
  width: var(--pp-composer-control-size);
  height: var(--pp-composer-control-size);
  padding: 0;
}

[data-composer-card] :is(button, [role="button"]):hover:not(:disabled) {
  background: #1a1a1a;
}

/* ── the two white controls ─────────────────────────────────────────────────── */

/* Selected by structure, not by name. The obvious anchor is the submit button's
   aria-label, but that string is localised: on an English UI a selector matching
   it finds nothing and the button quietly loses its fill.

   The submit button is identified as the last button in the trailing group instead.
   The earlier attempt anchored on the activity slot that precedes it, but the host
   hides an empty activity slot with display:none, so the sibling combinator stopped
   matching exactly when the composer was empty — which is when the button was
   reported as oversized. last-of-type on the trailing group is unaffected by whether
   the slot before it is rendered.

   NOTE: no backticks in this comment — it lives inside a template literal, and a
   backtick here closes the literal early and turns the rest of the CSS into
   JavaScript. A test walks every CSS literal's boundary to catch exactly this. */

/* Attach: the "+" beside the hidden file input — the first button in the row's
   leading group. */
[data-composer-card] [data-input-scroll] ~ [class*="_row"] > div:first-child > button:first-of-type {
  background: var(--pp-composer-control-fill);
  color: #000;
}

[data-composer-card] [data-input-scroll] ~ [class*="_row"] > div:first-child > button:first-of-type:hover:not(:disabled) {
  background: #e8e8e8;
}

/* Send: the last button of the trailing group, whatever the activity slot is doing. */
[data-composer-card] [class*="_trailing"] button:last-of-type {
  background: var(--pp-composer-control-fill);
  color: #000;
  width: var(--pp-composer-send-size);
  height: var(--pp-composer-send-size);
  padding: 0;
}

[data-composer-card] [class*="_trailing"] button:last-of-type:hover:not(:disabled) {
  background: #e8e8e8;
}

[data-composer-card] [class*="_trailing"] button:last-of-type:disabled {
  opacity: .4;
}

/* ── attachments ────────────────────────────────────────────────────────────── */

/* The attachment rail is a sibling of the editor, above it; it moves into the
   editor's block so a queued file reads as part of the draft. */
[data-composer-card] > [data-slot="conversation.input.attachments"] {
  margin-inline: var(--pp-composer-inset);
}

[data-composer-card] > [data-slot="conversation.input.overlay"] {
  margin-inline: var(--pp-composer-inset);
}

/* ── the dock below ─────────────────────────────────────────────────────────── */

/* Ambient entries under the card get their own blocks, on their own background.
   The dock is a sibling of the card, not a child, so the card's custom properties
   do not reach it — every value is restated rather than inherited. */
[data-composer-card] ~ [class*="_dock"] {
  background: transparent;
  border: 0;
  margin-top: var(--pp-composer-block-gap);
}

[data-composer-card] ~ [class*="_dock"] :is(button, [role="button"]) {
  border: var(--pp-composer-stroke);
  border-radius: 0;
  box-shadow: none;
  background: var(--pp-composer-surface);
  transform: none;
}

[data-composer-card] ~ [class*="_dock"] :is(button, [role="button"]):hover:not(:disabled) {
  background: #1a1a1a;
}
`.trim()

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
      // After `shape`: the host gives the send button a border-radius of 999px and
      // marks it `corner-shape: round`, and the corner sweep must have the last word.
      order: 30,
      locale: DICT,
      css: CSS,
      title: 'composer.title',
      settings: Settings,
      async apply(ctx) {
        const { registerStyles } = await core()
        registerStyles(ctx, CSS, 'composer')
      },
    }
    return module.exports
  },
})
