/**
 * Plus Plus — composer feature chunk.
 *
 * Restyles the message composer: the editor and the tool row are separate blocks
 * with a gutter, every control is its own block, and the whole palette follows the
 * host's light/dark scheme.
 *
 * Pure CSS. The host's composer is `conversation.composer.bar`, a `single` slot whose
 * `replaceRisk` is `shadows-shipped-ui` — registering there would replace the editor
 * outright and take its paste, `@`-mention, slash-command, attachment,
 * IME-composition and voice-input behaviour with it. Everything the mock-up asks for
 * is reachable by restyling, so nothing here registers a slot.
 *
 * ## Why this keys off `data-*`, not class names
 *
 * The host's class names are build-scoped hashes (`.RlGAzG_row`, `.wq12jW_trigger`),
 * so they change on every release and a selector written against them silently stops
 * matching. It does expose stable attributes — `data-composer-card`,
 * `data-input-scroll`, `data-composer-input` — and those are what this stylesheet
 * anchors on. The three hash classes used are each paired with a structural check,
 * so a rename cannot widen the blast radius.
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
        'composer.subtitle': '编辑区、工具行、各个按钮各自独立成块。亮色主题下编辑区半透明白色毛玻璃、附件与发送黑底；暗色主题相反。',
      },
      en: {
        'composer.title': 'Composer',
        'composer.subtitle': 'The editor, the tool row and every control are their own blocks. Light: a translucent white blurred editor with black attach and send. Dark: reversed.',
      },
    }

    /**
     * The composer palette, one entry per scheme.
     *
     * Declared through `ctx.theme.overrideTokens` rather than as CSS custom
     * properties in a `:root` block, because that is the host's own light/dark
     * mechanism: a `{ light, dark }` token map is recomposed whenever the scheme
     * changes, so the composer follows the theme without this chunk knowing how the
     * shell scopes its themes or which attribute carries the scheme.
     *
     * The colours:
     *
     *  - dark — editor solid black, controls black, attach and send white.
     *  - light — editor 50% white over a blur, controls 12% black over the same
     *    blur, attach and send black. "Reversed" means the accent swaps from white
     *    to black, not that every value inverts.
     *
     * The blur is a variable rather than a literal: it is `0px` in dark, which turns
     * the effect off, so one declaration covers both schemes. `blur(0px)` is a no-op,
     * not a per-frame cost.
     */
    const PALETTE = {
      '--pp-composer-surface': { light: 'rgb(255 255 255 / 50%)', dark: '#000' },
      '--pp-composer-control': { light: 'rgb(0 0 0 / 12%)', dark: '#000' },
      '--pp-composer-accent': { light: '#000', dark: '#fff' },
      // The hover the user asked for: the attach and send buttons go yellow. One
      // value for both schemes, since it was specified as a single colour.
      '--pp-composer-accent-hover': { light: '#ffee22', dark: '#ffee22' },
      '--pp-composer-accent-hover-ink': { light: '#000', dark: '#000' },
      // How long the accent pair takes to cross-fade on hover.
      '--pp-composer-accent-transition': { light: '200ms', dark: '200ms' },
      // The labelled triggers get a quiet grey on hover, as they are not the
      // primary action.
      '--pp-composer-white-hover': { light: '#ededed', dark: '#ededed' },
      '--pp-composer-stroke': { light: 'rgb(0 0 0 / 16%)', dark: 'rgb(255 255 255 / 22%)' },
      '--pp-composer-hover': { light: 'rgb(0 0 0 / 8%)', dark: '#1a1a1a' },
      '--pp-composer-blur': { light: '16px', dark: '0px' },
    }

    /**
     * The composer's seat in the scroller.
     *
     * Found from a console dump of the live DOM: the host pins the composer to the
     * bottom of the scroll area with `position: sticky; bottom: 0; z-index: 7` and
     * lays a 36px gradient over the top of it, fading from transparent into the
     * **opaque** conversation background:
     *
     *     linear-gradient(180deg,
     *       color-mix(in srgb, var(--dsw-alias-bg-base) 0%, transparent) 0px,
     *       var(--dsw-alias-bg-base) 36px)
     *
     * That opaque wash is what made message text look "covered": the last 36px of
     * every message was swallowed by solid chat colour as it scrolled past.
     *
     * The fade itself is kept — it is what stops text colliding with the composer's
     * top edge — but it now runs to transparent instead of to the chat background, so
     * text scrolls *through* it and stays legible right up to the composer.
     *
     * The seat is matched on its readable class suffix rather than the build hash,
     * the same way the row and dock are matched above. It is the one place this
     * stylesheet depends on a host class name, because the host gives the seat no
     * `data-` attribute of its own.
     *
     * `!important` is required: the host's own rule is a compound class selector, and
     * nothing at class level outranks it without one.
     */
    const SEAT_CSS = `
[class*="composerSeat"] {
  background: linear-gradient(180deg, rgb(0 0 0 / 0%) 0px, rgb(0 0 0 / 0%) var(--pp-composer-seat-fade, 36px)) !important;
}
`.trim()

    /**
     * The composer restyle.
     *
     * The card stops being a surface — its own opaque background is dropped — so the
     * blocks are what actually paints, and the card becomes the gutter between them.
     */
    const CSS = `
[data-composer-card] {
  --pp-composer-block-gap: 4px;
  --pp-composer-inset: 10px;
  /* One height for every control. The host ships 28px on the attach button, the
     send button and both dropdown triggers alike; an earlier version set the
     triggers to 26px through min-height, which is what made them sit visibly
     shorter than the buttons beside them. */
  --pp-composer-control-size: 28px;

  background: transparent;
  box-shadow: none;
  border: 0;
  gap: var(--pp-composer-block-gap);
  padding: var(--pp-composer-block-gap) 0;
}

/* ── the editor block ───────────────────────────────────────────────────────── */

[data-composer-card] > [data-input-scroll] {
  box-sizing: border-box;
  border: 1px solid var(--pp-composer-stroke);
  background: var(--pp-composer-surface);
  -webkit-backdrop-filter: blur(var(--pp-composer-blur));
  backdrop-filter: blur(var(--pp-composer-blur));
  margin-inline: var(--pp-composer-inset);
  border-radius: 0;
}

/* The host sizes the editor's padding for a borderless card; the block now carries
   its own border, so the text is inset to clear it. */
[data-composer-input] {
  padding: 10px 12px;
  min-height: 44px;
}

[data-composer-placeholder] {
  inset: 10px 12px auto;
}

[data-composer-card] > [data-input-scroll]::-webkit-scrollbar-track {
  margin-top: 10px;
}

/* ── the tool row ───────────────────────────────────────────────────────────── */

/* Not a surface: the row is only a positioning context holding the blocks apart.
   Its own gap is left alone — the tighter spacing the user asked for is applied to
   the two inner groups below, which is where those pairs actually sit. */
[data-composer-card] > [data-input-scroll] ~ [class*="_row"] {
  background: transparent;
  border: 0;
  margin-inline: var(--pp-composer-inset);
  border-radius: 0;
  padding: 0;
}

/* The host ships 12px inside these groups, dropping to 8px under a 560px
   container query. Both pairs the user named sit inside one of them — attach and
   permission in the leading group, model and send in the trailing one — so the gap
   is set here. 4px makes the blocks read as neighbours rather than a toolbar. */
[data-composer-card] :is([class*="_tools"], [class*="_modes"], [class*="_standardControls"]) {
  gap: 4px;
}

/* ── controls ───────────────────────────────────────────────────────────────── */

/* Every control is its own block: a bordered, filled surface with no shadow.

   The cleared transform removes the host's nudge on the send button — a translateY
   tuned for a layout that button no longer sits in.

   The explicit alignment is stated rather than inherited. The controls shifted
   downwards whenever the message list was not scrolled to the bottom, and the
   cause is vertical placement rather than any transform of their own: the host
   centres the row's groups, and the composer's own padding changes with scroll
   state, so an inherited alignment leaves the smaller square buttons sitting low
   against the taller row. Pinning it here makes every control independent of what
   the row does. */
[data-composer-card] :is(button, [role="button"]) {
  border: 1px solid var(--pp-composer-stroke);
  border-radius: 0;
  box-shadow: none;
  background: var(--pp-composer-control);
  transform: none;
  align-self: center;
  vertical-align: middle;
  -webkit-backdrop-filter: blur(var(--pp-composer-blur));
  backdrop-filter: blur(var(--pp-composer-blur));
}

[data-composer-card] :is(button, [role="button"]):hover:not(:disabled) {
  background: var(--pp-composer-hover);
}

/* The two labelled triggers — permission and model — carry a label, an icon and a
   chevron, so they are sized by content rather than forced square.

   Anchored on structure, not on aria-haspopup. An earlier version used that
   attribute and it was wrong: the model trigger carries menu, but the permission
   trigger carries **no** aria-haspopup at all — it opens by other means — so the
   rule matched only one of the two. The other kept the host's own padding of
   0 4px 0 8px, its 220px max-width and its transparent fill, which is what it
   looked like.

   Position within the row is stable and observable, so it is used instead:
   permission is a button in the modes group, model is the one inside the model
   slot. Both are white — the fill is a literal rather than a palette entry,
   because "pure white" was the instruction and a themed near-white would drift
   from it.

   The width is set here rather than left to the host: the model trigger's
   min(360px, 45cqw) cap is what left the name too narrow, and the permission
   trigger's fixed 220px is too tight for a long mode name. Both hosts' labels
   already ellipsize, so a generous width gives them room before that matters. */
[data-composer-card] [class*="_modes"] button,
[data-composer-card] [data-slot="conversation.input.model"] button {
  height: var(--pp-composer-control-size);
  padding: 0 12px;
  max-width: 340px;
  background: #fff;
  color: #000;
  border-color: var(--pp-composer-stroke);
  /* The trigger now clips. The host's own buttons declare no overflow, so without
     this the labels are free to run outside the box whenever the width cannot
     follow them — which is what a fixed max-width plus unshrinkable text produces.
     The host's labels already ellipsize, so clipping here only bounds the edge. */
  overflow: hidden;
}

/* The model trigger's width.
 *
 * It shares the labelled-trigger rule above, so the width is the same as the
 * permission trigger's — the model name simply ellipsizes past it, which is the
 * host's own behaviour for the label. An earlier version gave the model its own
 * max-width of 50cqw, which made it visibly wider than the permission button and
 * read as a different treatment; the cap is shared now.
 *
 * min-width:0 keeps the host's own fallback reachable: when the row genuinely
 * has no room the trigger may still shrink and the row wraps. */
[data-composer-card] [data-slot="conversation.input.model"] button {
  min-width: 0;
}

/* The model's own text, forced visible.
 *
 * The host hides it in compact mode. A ResizeObserver on the control groups sets a
 * text-display variable that the label and effort spans read, and it also gives
 * those spans a flex-shrink of 1000 — a thousand times the rate of anything else,
 * so they reach zero width first while the icon and chevron keep their size. What
 * renders is a bare square with no text at all.
 *
 * Three attempts to reach that through the variable did not work, and this one
 * stops trying. Declaring it on the button does nothing, because the row is where
 * the host sets it. Declaring it on the row does nothing either, which says the
 * host writes it as an inline style — and an inline style outranks every selector
 * at every level, so no declaration in this sheet can beat it.
 *
 * So the spans are pinned directly. !important does outrank a non-important inline
 * style, and the host's own rule carries none, as its bundled source shows. The
 * icon is pinned hidden to match, so the compact look cannot half-apply.
 *
 * Overflow is already clipped by the shared trigger rule above, so forcing the
 * text visible cannot push it outside the box — that was the overflow bug, and it
 * was fixed at the clip, not by hiding the text. */
[data-composer-card] [data-slot="conversation.input.model"] [class*="triggerLabel"],
[data-composer-card] [data-slot="conversation.input.model"] [class*="triggerEffort"] {
  display: inline !important;
  flex: 0 0 auto !important;
}

[data-composer-card] [data-slot="conversation.input.model"] [class*="triggerIcon"] {
  display: none !important;
}

/* The labelled triggers keep their quiet grey hover. They are not the primary
   action, so the accent pair's yellow is deliberately not shared with them. */
[data-composer-card] [class*="_modes"] button:hover:not(:disabled),
[data-composer-card] [data-slot="conversation.input.model"] button:hover:not(:disabled) {
  background: var(--pp-composer-white-hover);
}

/* Square controls: attach and send.

   The attach button is the "+" carrying aria-haspopup of listbox — it is the only
   one — and it is also the first button in the row's leading group. Either anchor
   finds it; the group one is kept as a backstop in case the attribute changes. */
[data-composer-card] button[aria-haspopup="listbox"],
[data-composer-card] [data-input-scroll] ~ [class*="_row"] > div:first-child > button:first-of-type {
  width: var(--pp-composer-control-size);
  height: var(--pp-composer-control-size);
  padding: 0;
}

/* ── the two accent controls ────────────────────────────────────────────────── */

/* Selected by structure, not by name. The obvious anchor is the submit button's
   aria-label, but that string is localised: on an English UI a selector matching
   it finds nothing and the button quietly loses its accent.

   The submit button is the last button in the trailing group. An earlier attempt
   anchored on the activity slot that precedes it, but the host hides an empty
   activity slot with display:none, so the sibling combinator stopped matching
   exactly when the composer was empty — which is when the button was reported as
   oversized. last-of-type is unaffected by whether that slot is rendered.

   NOTE: no backticks in this comment — it lives inside a template literal, and a
   backtick here closes the literal early and turns the rest of the CSS into
   JavaScript. A test walks every CSS literal's boundary to catch exactly this. */

/* Attach: the "+" that opens the file/command list — the only button carrying
   aria-haspopup of listbox, and the first button in the row's leading group.
   Both anchors are listed so a change to either still leaves the accent applied.

   The transition is declared on the resting state, not on the hover. A rule that
   appears only while hovered animates *into* that state but snaps out of it, so
   the fade would be one-way. */
[data-composer-card] button[aria-haspopup="listbox"],
[data-composer-card] [data-input-scroll] ~ [class*="_row"] > div:first-child > button:first-of-type {
  background: var(--pp-composer-accent);
  color: var(--pp-composer-surface);
  transition: background-color var(--pp-composer-accent-transition) ease,
              color var(--pp-composer-accent-transition) ease;
}

[data-composer-card] button[aria-haspopup="listbox"]:hover:not(:disabled),
[data-composer-card] [data-input-scroll] ~ [class*="_row"] > div:first-child > button:first-of-type:hover:not(:disabled) {
  background: var(--pp-composer-accent-hover);
  color: var(--pp-composer-accent-hover-ink);
}

/* Send: the last button of the trailing group, whatever the activity slot is doing.
   Square, like attach, and the same 28px as every other control. */
[data-composer-card] [class*="_trailing"] button:last-of-type {
  background: var(--pp-composer-accent);
  color: var(--pp-composer-surface);
  width: var(--pp-composer-control-size);
  height: var(--pp-composer-control-size);
  padding: 0;
  transition: background-color var(--pp-composer-accent-transition) ease,
              color var(--pp-composer-accent-transition) ease;
}

[data-composer-card] [class*="_trailing"] button:last-of-type:hover:not(:disabled) {
  background: var(--pp-composer-accent-hover);
  color: var(--pp-composer-accent-hover-ink);
}

[data-composer-card] [class*="_trailing"] button:last-of-type:disabled {
  opacity: .4;
}

/* ── attachments ────────────────────────────────────────────────────────────── */

/* The attachment rail and the overlay are siblings of the editor, above it; they
   move into the editor's block so a queued file reads as part of the draft. */
[data-composer-card] > [data-slot="conversation.input.attachments"],
[data-composer-card] > [data-slot="conversation.input.overlay"] {
  margin-inline: var(--pp-composer-inset);
}

/* ── the dock below ─────────────────────────────────────────────────────────── */

/* Ambient entries get their own blocks on their own background. The dock is a
   sibling of the card, not a child, so the card's palette does not reach it — every
   value is restated rather than inherited. */
[data-composer-card] ~ [class*="_dock"] {
  background: transparent;
  border: 0;
  margin-top: var(--pp-composer-block-gap);
}

[data-composer-card] ~ [class*="_dock"] :is(button, [role="button"]) {
  border: 1px solid var(--pp-composer-stroke);
  border-radius: 0;
  box-shadow: none;
  background: var(--pp-composer-control);
  transform: none;
}

[data-composer-card] ~ [class*="_dock"] :is(button, [role="button"]):hover:not(:disabled) {
  background: var(--pp-composer-hover);
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
      // Concatenated into the one stylesheet rather than registered separately: the
      // seat rule needs the card's fade variable to resolve, and two style tags
      // would make that depend on insertion order for no benefit.
      seatCss: SEAT_CSS,
      palette: PALETTE,
      title: 'composer.title',
      settings: Settings,
      async apply(ctx) {
        const { registerStyles, applyPalette } = await core()

        // The palette first, so the stylesheet's var() references resolve against
        // real values on the frame they are first used.
        applyPalette(ctx, PALETTE, 'composer')
        registerStyles(ctx, `${CSS}\n${SEAT_CSS}`, 'composer')
      },
    }
    return module.exports
  },
})
