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
        'composer.subtitle': '编辑区与工具行分成两块；编辑区半透明毛玻璃；按钮全部无边框——附件与发送为白底，其余沿用编辑区底色。',
      },
      en: {
        'composer.title': 'Composer',
        'composer.subtitle': 'The editor and the tool row are two separate blocks; the editor gets a translucent blurred surface; every control is borderless — attach and send sit on white, the rest inherit the editor surface.',
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
  /* Editor surface: 80% black over whatever is behind it, blurred. */
  --pp-composer-surface: rgb(0 0 0 / 80%);
  --pp-composer-surface-blur: 12px;
  --pp-composer-control-fill: #fff;
  --pp-composer-block-gap: 8px;
  --pp-composer-inset: 10px;

  /* The card stops being a surface; it becomes the gutter between two surfaces. */
  background: transparent;
  box-shadow: none;
  border: 0;
  gap: var(--pp-composer-block-gap);
  padding: var(--pp-composer-block-gap) 0;
}

/* ── the editor block ───────────────────────────────────────────────────────── */

/* The scroll wrapper holds the editor, and is the element that needs to become a
   bordered block. It is a direct child of the card, as is the tool row. */
[data-composer-card] > [data-input-scroll] {
  box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--pp-composer-surface);
  -webkit-backdrop-filter: blur(var(--pp-composer-surface-blur));
  backdrop-filter: blur(var(--pp-composer-surface-blur));
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

/* ── the tool row block ─────────────────────────────────────────────────────── */

/* Same treatment, so the two halves read as siblings rather than one card. */
[data-composer-card] > [data-input-scroll] ~ [class*="_row"] {
  box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--pp-composer-surface);
  -webkit-backdrop-filter: blur(var(--pp-composer-surface-blur));
  backdrop-filter: blur(var(--pp-composer-surface-blur));
  margin-inline: var(--pp-composer-inset);
  border-radius: 0;
  padding: 4px 8px;
}

/* ── controls: borderless everywhere ────────────────────────────────────────── */

/* The host draws its controls with a filled background and no border. The mock-up
   wants no border on any of them, so the border is cleared explicitly rather than
   relied upon — the permission trigger and model trigger both ship with one. */
[data-composer-card] :is(button, [role="button"]) {
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

/* Permission and model: the editor's own surface, so they sit in the row without
   reading as separate blocks. The host paints them transparent; a faint fill keeps
   them legible against the blurred background. */
[data-composer-card] [aria-haspopup="listbox"],
[data-composer-card] [aria-haspopup="menu"] {
  background: transparent;
  padding: 4px 8px;
}

[data-composer-card] [aria-haspopup="listbox"]:hover,
[data-composer-card] [aria-haspopup="menu"]:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

/* ── the two white controls ─────────────────────────────────────────────────── */

/* Selected by structure, not by name. The obvious anchor is the submit button's
   aria-label, but that string is localised: on an English UI a selector matching
   it finds nothing and the button quietly loses its fill. The activity slot's
   data-slot is stable and sits immediately before the submit button in the
   trailing group, so "the button after the activity slot" identifies the submit
   action in any locale.

   NOTE: no backticks in this comment — it lives inside a template literal. */
[data-composer-card] > [data-input-scroll] ~ [class*="_row"] button[aria-label] {
  background: transparent;
}

/* Attach: the "+" beside the hidden file input — the first button in the row's
   leading group. */
[data-composer-card] [data-input-scroll] ~ [class*="_row"] > div:first-child > button:first-of-type,
[data-composer-card] button[aria-haspopup="listbox"] ~ button {
  background: var(--pp-composer-control-fill);
  color: #000;
}

[data-composer-card] button[aria-haspopup="listbox"] ~ button:hover:not(:disabled) {
  background: #e8e8e8;
}

/* Send: the button right after the activity slot. The host gives it 34x34 with a
   translateY nudge tuned for the old layout; inside a bordered row that offset
   misaligns it, so it is cleared. */
[data-composer-card] [data-slot="conversation.input.activity"] ~ button,
[data-composer-card] [data-slot="conversation.input.activity"] + button {
  background: var(--pp-composer-control-fill);
  color: #000;
  transform: none;
  width: 30px;
  height: 30px;
}

[data-composer-card] [data-slot="conversation.input.activity"] ~ button:hover:not(:disabled),
[data-composer-card] [data-slot="conversation.input.activity"] + button:hover:not(:disabled) {
  background: #e8e8e8;
}

[data-composer-card] [data-slot="conversation.input.activity"] ~ button:disabled,
[data-composer-card] [data-slot="conversation.input.activity"] + button:disabled {
  opacity: .45;
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

/* Ambient entries under the card keep the host's own treatment, but must not
   inherit the card's now-transparent background. */
[data-composer-card] ~ [class*="_dock"] {
  background: transparent;
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
