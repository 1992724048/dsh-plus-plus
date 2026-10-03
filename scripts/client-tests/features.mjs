/**
 * What each feature promises: the font stack, the corner sweep, the composer
 * layout, and the surface swap.
 *
 * Every assertion here encodes a decision that came from the user or from reading
 * the host's own CSS, with the reason attached — so a later change has to argue
 * with the reason rather than just with the value.
 */

import assert from 'node:assert/strict'

import { allCss, bootRun, rulesMatching, test } from './harness.mjs'

/** One feature's descriptor, booted. */
async function featureOf(id) {
  const { cache } = await bootRun()
  const descriptor = cache.get(`client.${id}.js`).exports.descriptor
  assert.ok(descriptor !== undefined, `the ${id} chunk must export a descriptor`)
  return descriptor
}

// ── font ─────────────────────────────────────────────────────────────────────

test('the host font variables are re-pointed at our stacks', async () => {
  // Regression: the first version wrote an `html, body` rule, which any class
  // selector outranks — the sidebar changed but the conversation did not. The
  // conversation is built from these two variables, including the markdown
  // heading ladder.
  const css = allCss((await bootRun()).styleTags)
  const declared = (name) => new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(css)?.[1]?.trim()

  assert.equal(declared('--dsw-font-family'), 'var(--pp-font-sans)')
  assert.equal(declared('--ds-font-family-code'), 'var(--pp-font-mono)')
  assert.match(declared('--pp-font-mono') ?? '', /^'JetBrains Mono'/)
  assert.match(declared('--pp-font-sans') ?? '', /^'HarmonyOS Sans'/)
  assert.doesNotMatch(css, /^\s*html\s*,/m, 'an element rule loses to any class selector')
})

test('every @import points at a route the host actually serves', async () => {
  const css = allCss((await bootRun()).styleTags)
  const imports = [...css.matchAll(/@import url\("([^"]+)"\)/g)].map(m => m[1])
  assert.ok(imports.length > 0, 'the stylesheet must import the packaged faces')

  for (const href of imports) {
    assert.ok(href.startsWith('/api/dsh-plus-plus/fonts/'), `${href} must sit under the font route`)
    const rest = href.slice('/api/dsh-plus-plus/fonts/'.length).split('/')
    const family = rest.shift()
    assert.ok(['jetbrains-mono', 'harmonyos-sans-sc'].includes(family), `${family} is not a served family`)
    // The stylesheet the browser fetches next must exist in the repo's node_modules.
    const { default: fs } = await import('node:fs')
    const { default: path } = await import('node:path')
    const { ROOT } = await import('./harness.mjs')
    const root = path.resolve(ROOT, 'node_modules', family === 'jetbrains-mono'
      ? '@fontsource/jetbrains-mono'
      : 'harmonyos-sans-webfont-splitted/dist/HarmonyOS_Sans_SC')
    const file = path.resolve(root, rest.join('/'))
    assert.ok(file.startsWith(root + path.sep), `${href} must stay inside ${family}`)
    assert.ok(fs.existsSync(file), `${href} does not exist on disk`)
  }
})

// ── shape ────────────────────────────────────────────────────────────────────

test('all six host radius tokens are zeroed', async () => {
  const css = allCss((await bootRun()).styleTags)
  const declared = (name) => new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(css)?.[1]?.trim()
  for (const token of ['xs', 'sm', 'md', 'lg', 'xl', 'panel']) {
    assert.equal(declared(`--dsw-radius-${token}`), '0px', `--dsw-radius-${token} must be zeroed`)
  }
  // The derived feature tokens are reset too, so a stale theme value cannot leak.
  for (const token of ['code-block-border-radius', 'guide-entry-radius', 'search-radius', 'terminal-radius', 'web-radius']) {
    assert.equal(declared(`--dsl-${token}`), '0px', `--dsl-${token} must be zeroed`)
  }
})

test('the hardcoded-length sweep wins over class rules but spares the round ones', async () => {
  const css = allCss((await bootRun()).styleTags)

  // The host hardcodes ~163 radii that no token reaches; the sweep must carry
  // !important to beat a `(0,1,0)` class selector.
  assert.match(css, /\*\s*\{\s*border-radius:\s*0\s*!important/)

  // ...and must key on the marker the host itself uses, so the 37 `50%` rules
  // (avatars, status dots, progress rings) are re-squared only via that marker.
  assert.match(css, /\[style\*="corner-shape"\]\s*\{\s*corner-shape:\s*square\s*!important/)
  assert.doesNotMatch(css, /:root\s*\{[^}]*corner-shape/, 'do not set corner-shape globally')
  assert.doesNotMatch(css, /\*\s*\{[^}]*corner-shape/, 'do not set corner-shape on every element')

  // The one legitimate `round` is the demo dot, which proves circles survive.
  const rules = [...css.matchAll(/([^{}]+)\{[^{}]*corner-shape:\s*(\w+)[^}]*\}/g)]
  assert.ok(rules.length > 0)
  for (const [, selector, value] of rules) {
    assert.match(selector, /\[style\*="corner-shape"\]|\.pp-dot/, `unexpected corner-shape rule on ${selector.trim()}`)
    if (value === 'round') assert.match(selector, /\.pp-dot/, 'only the demo dot may stay round')
  }
})

// ── composer ─────────────────────────────────────────────────────────────────

test('the composer chunk restyles without taking over the composer slot', async () => {
  // The composer's host slot is `conversation.composer.bar`, a `single` seat whose
  // `replaceRisk` is `shadows-shipped-ui`. Registering there would replace the
  // editor outright — paste, @-mention, slash commands, attachment, IME
  // composition and voice input all included.
  const { css } = await featureOf('composer')

  // It must key off the host's stable data attributes, never its build-scoped
  // hash class names — those change every release and silently stop matching.
  assert.match(css, /\[data-composer-card\]/, 'must anchor on data-composer-card')
  assert.match(css, /\[data-input-scroll\]/, 'must anchor on data-input-scroll')
  assert.doesNotMatch(css, /\.RlGAzG/, 'must not hard-code a build-scoped host class name')

  assert.match(css, /--pp-composer-block-gap:\s*4px/, 'the gutter between blocks is 4px')
  assert.match(css, /background:\s*var\(--pp-composer-surface\)/,
    'the editor must take its surface from the palette, not a literal')

  // No literal colours at all. Every one of them belongs in the palette, where the
  // host can flip it with the scheme — which is the whole point. Three rounds of
  // fixes here came from a literal that did not: the triggers were hard-coded white
  // while everything else inverted, so dark showed white buttons on a black editor.
  const literals = [...css.matchAll(/:\s*(#[0-9a-f]{3,8})\b/gi)].map(m => m[1].toLowerCase())
  assert.deepEqual([...new Set(literals)], [],
    `every colour must come from the palette so it can follow the theme; found literals ${literals.join(', ')}`)

  // And the palette itself carries no literal in the stylesheet's place — the
  // triggers must reference it rather than painting over it.
  assert.doesNotMatch(css, /\[class\*="_modes"\] button,[^{]*\{[^}]*background:\s*#/,
    'the labelled triggers must take their fill from the palette')

  // Each control is its own bordered block, so the row itself is not a surface.
  assert.match(css, /:is\(button, \[role="button"\]\)\s*\{[^}]*border:\s*1px solid var\(--pp-composer-stroke\)/,
    'every control must be its own bordered block')
  assert.match(css, /~ \[class\*="_row"\]\s*\{[^}]*background:\s*transparent/,
    'the tool row must not paint a shared background behind its buttons')
  assert.match(css, /backdrop-filter:\s*blur\(var\(--pp-composer-blur\)\)/,
    'the blur must come from the palette so dark can switch it off')
})

test('the composer chunk declares no slot registration', async () => {
  // Read the source rather than the descriptor: `apply` is opaque until run, and
  // the failure being guarded — silently replacing the editor — must be caught by
  // inspection, not by whatever `apply` does with a stub context.
  const { readCode } = await import('./harness.mjs')
  const source = readCode('client.composer.js')
  assert.doesNotMatch(source, /slots\s*\.\s*(register|inject)\s*\(/,
    'the composer chunk must not register any slot — it only restyles')
  assert.doesNotMatch(source, /conversation\.composer\.bar/,
    'referencing the composer bar slot at all would invite a replacement')
})

test('every composer control shares one height', async () => {
  // The attach, send, model and permission buttons all sit at a different height
  // from the permission one when they do not. Cause: an earlier version pinned the
  // triggers with a min-height while the host ships 28px on all four, and gave the
  // send button its own size variable on top.
  const { css } = await featureOf('composer')

  const sizes = [...css.matchAll(/(--pp-composer-[a-z-]*size)\s*:\s*([^;]+);/g)].map(m => m[1])
  assert.deepEqual([...new Set(sizes)], ['--pp-composer-control-size'],
    `every control must share one size variable; found ${sizes.join(', ')}`)
  assert.doesNotMatch(css, /min-height:\s*var\(--pp-composer/,
    'min-height overrides the shared height and reintroduces the mismatch')
  assert.doesNotMatch(css, /--pp-composer-send-size/, 'the send button must use the shared size')
  assert.match(css, /--pp-composer-control-size:\s*28px/,
    "the shared height should match the host's 28px")
})

test('the labelled triggers are found by structure, not by aria-haspopup', async () => {
  // The regression, straight from a console dump of the live DOM:
  //
  //   permission  <button class="dlU_AG_trigger" aria-label="访问模式…">
  //               — no aria-haspopup attribute at all
  //   model       <button class="wq12jW_trigger" aria-haspopup="menu" …>
  //
  // A rule anchored on aria-haspopup="menu" therefore matched the model trigger
  // and **not** the permission one, which kept the host's own padding of
  // 0 4px 0 8px, its 220px max-width and its transparent fill. That is why the
  // permission button looked half-transparent and the model one collapsed.
  const { css } = await featureOf('composer')

  // The rule that styles both, anchored on structure. The two selectors sit on
  // separate lines, so the pattern tolerates whitespace between them.
  const shared = /\[class\*="_modes"\] button,\s*\[data-composer-card\] \[data-slot="conversation\.input\.model"\] button\s*\{([^}]*)\}/.exec(css)
  assert.ok(shared, 'both labelled triggers must share one rule, anchored on structure')
  assert.match(shared[1], /background:\s*var\(--pp-composer-trigger\)/,
    'that rule must take the fill from the palette, so both schemes follow')
  assert.match(shared[1], /color:\s*var\(--pp-composer-trigger-ink\)/,
    'and the ink with it, so a white glyph does not sit on a white button')
  assert.match(shared[1], /padding:\s*0 12px/, 'and the padding the host was overriding')
  assert.match(shared[1], /max-width:\s*340px/, 'and a width generous enough for a permission mode')
  assert.match(shared[1], /height:\s*var\(--pp-composer-control-size\)/, 'and the shared control height')

  // No rule may style a trigger through an attribute only one of them carries.
  assert.doesNotMatch(css, /button\[aria-haspopup="menu"\][^{]*\{[^}]*background/,
    'the permission trigger carries no aria-haspopup, so a menu-anchored rule misses it')

  // The attach button keeps listbox and must not be caught by the trigger rule.
  assert.doesNotMatch(css, /button\[aria-haspopup="listbox"\][^{]*\{[^}]*background:\s*var\(--pp-composer-trigger\)/,
    'the attach button must keep the accent fill')

  // One fill declaration and one hover, shared — so the two cannot drift apart.
  assert.equal([...css.matchAll(/background:\s*var\(--pp-composer-trigger\)/g)].length, 1,
    'the trigger fill must be declared once')
  const hovers = [...css.matchAll(/\[class\*="_modes"\] button:hover[^{]*\{([^}]*)\}/g)].map(m => m[1])
  assert.ok(hovers.length > 0, 'the triggers need a hover of their own')
  for (const block of hovers) {
    assert.match(block, /background:\s*var\(--pp-composer-trigger-hover\)/,
      'the labelled triggers hover on their own palette value — not the accent yellow')
  }
})

test('the attach and send buttons hover yellow, cross-fading over 200ms', async () => {
  const { css, palette } = await featureOf('composer')

  // The colour itself, per the instruction: one value for both schemes.
  assert.equal(palette['--pp-composer-accent-hover'].light, '#ffee22')
  assert.equal(palette['--pp-composer-accent-hover'].dark, '#ffee22',
    'the yellow was specified as one colour, so it is not theme-dependent')
  assert.equal(palette['--pp-composer-accent-transition'].light, '200ms')
  assert.equal(palette['--pp-composer-accent-transition'].dark, '200ms')

  // Both accent controls must carry the hover…
  for (const [name, anchor] of [
    ['attach', /\[data-composer-card\] button\[aria-haspopup="listbox"\]:hover:not\(:disabled\)/],
    ['send', /\[data-composer-card\] \[class\*="_trailing"\] button:last-of-type:hover:not\(:disabled\)/],
  ]) {
    assert.match(css, anchor, `${name} must have a hover rule`)
  }
  assert.equal([...css.matchAll(/var\(--pp-composer-accent-hover\)/g)].length, 2,
    'exactly the two accent controls use it — the labelled triggers must not')

  // …and the transition must sit on the **resting** state, not on the hover. A
  // transition declared only while hovered animates into the state and snaps out
  // of it, so the fade would be one-way and "200ms" would only hold on the way in.
  //
  // Anchored on the accent fill rather than on the selector: the attach button is
  // matched by two separate rules — one for its size, one for its colour — and
  // only the second carries the transition.
  const attachResting = /\[data-composer-card\] button\[aria-haspopup="listbox"\],\s*\n\[data-composer-card\] \[data-input-scroll\][^{]*\{\s*\n\s*background:\s*var\(--pp-composer-accent\);([^}]*)\}/.exec(css)
  const sendResting = /\[data-composer-card\] \[class\*="_trailing"\] button:last-of-type\s*\{([^}]*)\}/.exec(css)

  for (const [name, match] of [['attach', attachResting], ['send', sendResting]]) {
    const resting = match?.[1]
    assert.ok(resting !== undefined, `${name} resting colour rule must be locatable`)
    assert.match(resting, /transition:[^;]*background-color[^;]*var\(--pp-composer-accent-transition\)/,
      `${name} must declare the transition while resting, so it also fades back out`)
  }
  // Count by the *declaration*, not the property: the transition wraps onto a
  // second line for the colour, so each control contributes two matches and a
  // count of 2 would only ever match a single-property transition.
  assert.equal([...css.matchAll(/--pp-composer-accent-transition\) ease/g)].length, 4,
    'both accent controls declare the transition, for background and for colour')
})

test('the model name and effort are pinned visible', async () => {
  // The host hides them in compact mode, through two mechanisms: a text-display
  // variable the spans read, and a flex-shrink of 1000 on those spans — a thousand
  // times anything else, so they reach zero width first while the icon and chevron
  // keep their size. What renders is a bare square with no text.
  //
  // Three attempts to answer that through the variable failed: on the button (the
  // row is where the host sets it) and on the row (which says the host writes an
  // inline style, and an inline style outranks every selector). So the spans are
  // pinned directly, and !important does beat a non-important inline style.
  const { css } = await featureOf('composer')

  const labels = /\[class\*="triggerLabel"\][^{]*\{([^}]*)\}/.exec(css)?.[1]
  assert.ok(labels, 'the model label must be pinned')
  assert.match(labels, /display:\s*inline\s*!important/, 'the name must stay visible')
  assert.match(labels, /flex:\s*0 0 auto\s*!important/,
    'and stop shrinking a thousand times faster than the icon')

  // The icon is pinned hidden to match, so the compact look cannot half-apply.
  assert.match(css, /\[class\*="triggerIcon"\][^{]*\{[^}]*display:\s*none\s*!important/,
    'the compact-mode icon must not appear alongside a forced-visible name')
})

test('the model trigger shares the labelled triggers\' width and may shrink', async () => {
  // The user reported the model button not matching the permission one. The
  // background was already shared; what differed was width — the model carried
  // its own max-width of 50cqw against the shared 340px, so it read as a
  // different treatment. It is now on the shared cap, and only min-width is left
  // as an override, so the host can still wrap the row when there is no room.
  const { css } = await featureOf('composer')

  // Only the rules whose selector list is *just* the model trigger count as
  // overrides. The shared labelled-trigger rule names it as its second selector,
  // and that rule is allowed to set the width — it is where both triggers get it.
  const overrides = rulesMatching(css, '[data-slot="conversation.input.model"] button')
    .filter(rule => !rule.selector.includes(',') && !rule.selector.includes(':hover'))
    .map(rule => rule.body)

  assert.ok(overrides.length > 0, 'the model trigger must still be able to override on its own')
  for (const block of overrides) {
    assert.doesNotMatch(block, /max-width/,
      'a standalone override must not re-cap the width — that is what made it look different')
    assert.doesNotMatch(block, /flex:\s*none/,
      'flex:none stops the label collapsing to zero width and defeats the host\'s own fallback')
  }
  assert.ok(overrides.some(block => /min-width:\s*0/.test(block)),
    'and keep min-width:0 so the row can still wrap')

  // The shared rule must clip, which is what keeps the forced text inside the box.
  const shared = /\[class\*="_modes"\] button,\s*\[data-composer-card\] \[data-slot="conversation\.input\.model"\] button\s*\{([^}]*)\}/.exec(css)
  assert.ok(shared, 'the shared trigger rule must exist')
  assert.match(shared[1], /width:\s*max-content/,
    'the trigger must size to its content — a cap alone still lays the box out narrower than the text')
  assert.match(shared[1], /max-width:\s*340px/, 'max-width stays, but only as a ceiling')
  assert.match(shared[1], /overflow:\s*hidden/,
    'the trigger must clip; without it the text runs outside the button')
})

test('every control is pinned to the row\'s vertical centre', async () => {
  // The controls sat lower than they should whenever the message list was not
  // scrolled to the bottom. The cause is vertical placement, not a transform of
  // their own: the host centres the row's groups, and the composer's padding
  // changes with scroll state, so an inherited alignment let the smaller square
  // buttons drop against the taller row.
  const { css } = await featureOf('composer')
  const generic = /\[data-composer-card\] :is\(button, \[role="button"\]\)\s*\{([^}]*)\}/.exec(css)?.[1]
  assert.ok(generic !== undefined, 'the generic control rule must be locatable')
  assert.match(generic, /align-self:\s*center/, 'every control must pin its own vertical alignment')
  assert.match(generic, /transform:\s*none/,
    'the host nudges the send button with a translateY for a layout it no longer sits in')
})

test('the inner control groups sit 4px apart', async () => {
  // The host ships 12px inside the tool groups, dropping to 8px under a container
  // query. Both pairs the user named — attach↔permission and model↔send — sit
  // inside one of those groups, so the gap belongs there, not on the row.
  const { css } = await featureOf('composer')
  const rule = /\[data-composer-card\] :is\(([^)]*)\)\s*\{\s*gap:\s*4px;/.exec(css)
  assert.ok(rule, 'a 4px gap rule on the inner groups must exist')
  assert.match(rule[1], /_tools/, 'the leading group holds attach and permission')
  assert.match(rule[1], /_standardControls|_trailing/, 'the trailing group holds model and send')

  const row = /~ \[class\*="_row"\]\s*\{([^}]*)\}/.exec(css)?.[1]
  assert.ok(row !== undefined, 'the row rule must exist')
  assert.doesNotMatch(row, /gap:/, 'the row keeps the host gap; the groups carry the 4px')
})

test('the composer palette is declared for both schemes', async () => {
  // The host's `overrideTokens` takes a `{ light, dark }` map per token and
  // recomposes it on a scheme change. That is why the composer declares both rather
  // than picking a scheme — and why a half-declared token would silently render as
  // the shell's colour in one scheme.
  //
  // Asserted against what `apply` pushed into the theme service, not the
  // descriptor: several features declare palettes now.
  const { palettes } = await bootRun()
  const layer = palettes.find(entry => entry.tokens['--pp-composer-surface'] !== undefined)
  assert.ok(layer !== undefined, 'the composer must apply a palette layer')
  const applied = layer.tokens
  const get = (token, scheme) => applied[token][scheme]

  for (const [token, modes] of Object.entries(applied)) {
    assert.ok(token.startsWith('--pp-composer-'), `${token} must be namespaced to this plugin`)
    assert.deepEqual([...Object.keys(modes)].sort(), ['dark', 'light'], `${token} needs both schemes`)
    for (const value of Object.values(modes)) {
      assert.equal(typeof value, 'string')
      assert.ok(value !== '', `${token} must not be empty`)
    }
  }

  // The whole composer inverts with the theme, and the editor stays translucent in
  // both. This is the contract three rounds of fixes were converging on without
  // stating it: the editor is a 50% wash either way, and everything sitting on it —
  // the labelled triggers and the accent pair — takes that scheme's own value.
  assert.equal(get('--pp-composer-surface', 'light'), 'rgb(0 0 0 / 50%)',
    'light: the editor is a translucent black wash')
  assert.equal(get('--pp-composer-surface', 'dark'), 'rgb(255 255 255 / 50%)',
    'dark: the editor is a translucent white wash')

  // Labelled triggers: the scheme's own colour, with the ink flipped so a glyph on a
  // white button is black and vice versa.
  assert.equal(get('--pp-composer-trigger', 'light'), '#000', 'light: the triggers are black')
  assert.equal(get('--pp-composer-trigger', 'dark'), '#fff', 'dark: the triggers are white')
  assert.equal(get('--pp-composer-trigger-ink', 'light'), '#fff', 'light: their labels are white')
  assert.equal(get('--pp-composer-trigger-ink', 'dark'), '#000', 'dark: their labels are black')

  // Attach and send follow the same pairing.
  assert.equal(get('--pp-composer-accent', 'light'), '#000', 'light: attach and send are black')
  assert.equal(get('--pp-composer-accent', 'dark'), '#fff', 'dark: attach and send are white')
  assert.equal(get('--pp-composer-accent-ink', 'light'), '#fff', 'light: their glyphs are white')
  assert.equal(get('--pp-composer-accent-ink', 'dark'), '#000', 'dark: their glyphs are black')

  // A fill and its ink must never be the same value, in either scheme — that is
  // what makes the glyph legible, and it is the one invariant a palette edit can
  // silently break.
  for (const scheme of ['light', 'dark']) {
    assert.notEqual(get('--pp-composer-trigger', scheme), get('--pp-composer-trigger-ink', scheme),
      `${scheme}: a trigger and its ink would be invisible`)
    assert.notEqual(get('--pp-composer-accent', scheme), get('--pp-composer-accent-ink', scheme),
      `${scheme}: an accent button and its glyph would be invisible`)
  }

  // The blur is on in both, because the editor is translucent in both.
  assert.notEqual(get('--pp-composer-blur', 'light'), '0px', 'light: the surface is blurred')
  assert.notEqual(get('--pp-composer-blur', 'dark'), '0px', 'dark: the surface is blurred too')
})

test('the send button is found structurally, not via a slot that hides', async () => {
  // The regression: the send button was styled via the activity slot that precedes
  // it, but the host hides an empty activity slot with display:none — so the
  // sibling combinator stopped matching exactly when the composer was empty, which
  // is when the button was reported as oversized.
  const { css } = await featureOf('composer')
  assert.doesNotMatch(css, /conversation\.input\.activity[^\n]*[~+]\s*button/,
    'must not anchor on the activity slot — the host hides it when empty')
  assert.match(css, /\[class\*="_trailing"\] button:last-of-type/,
    "the send button must be found as the trailing group's last button")
})

// ── the seat, shared by two chunks ────────────────────────────────────────────

test('the composer seat no longer washes out scrolled text', async () => {
  // Found from a console dump of the live DOM: the host pins the composer to the
  // bottom of the scroller with `position: sticky` and lays a 36px gradient over its
  // top edge, fading into the *opaque* conversation background. That wash swallowed
  // the last 36px of every message — which is exactly the "text looks covered"
  // report. The fade is kept; it must now run to transparent.
  const { seatCss } = await featureOf('composer')
  assert.match(seatCss, /composerSeat/, 'must target the host seat element')
  assert.match(seatCss, /!important/, "the host's compound selector needs it")
})

test('the seat fade is transparent in every chunk that touches it', async () => {
  // Two chunks carry a seat rule — the composer's (with !important) and the
  // surface chunk's fallback. Both must fade to transparent, or whichever wins the
  // cascade reintroduces the opaque wash that hid the scrolled text.
  for (const id of ['composer', 'surface']) {
    const descriptor = await featureOf(id)
    const css = descriptor.seatCss ?? descriptor.css
    assert.match(css, /composerSeat/, `${id} must target the seat`)
    const gradient = /linear-gradient\([^;]+\)/.exec(css)?.[0]
    assert.ok(gradient !== undefined, `${id} must declare a gradient`)
    for (const stop of gradient.matchAll(/rgba\([^)]*\)|#[0-9a-f]{3,8}/gi)) {
      assert.match(stop[0], /\/ ?0%\)|transparent/,
        `${id}: ${stop[0]} is opaque — it would wash the scrolled text out again`)
    }
    assert.doesNotMatch(gradient, /bg-base/, `${id}: must not fade into the chat background`)
  }
})

test('the composer still installs exactly one stylesheet', async () => {
  // The seat rule needs the card's fade variable to resolve, so it is
  // concatenated rather than registered as a second style tag — two tags would make
  // that depend on insertion order for no benefit.
  const { effects } = await bootRun()
  const installed = effects.filter(label => label.includes('composer'))
  assert.equal(installed.length, 1, 'the composer must install exactly one stylesheet')
})

// ── surface ──────────────────────────────────────────────────────────────────

test('the surface swap exchanges exactly the two host tokens', async () => {
  // The host paints the chat column with one token and the sidebar with another,
  // and a dozen components read those same two. Swapping the values moves the whole
  // system; restyling the two elements would repaint only those elements and leave
  // every card and popup out of step.
  //
  // The layer tokens must NOT be touched: they are the raised surfaces inside
  // whichever column they appear in, and re-pointing them would leave every popup a
  // shade belonging to neither column.
  const { palette } = await featureOf('surface')
  assert.deepEqual(
    [...Object.keys(palette)].sort(),
    ['--dsw-alias-bg-base', '--dsw-specific-sidebar-fill'],
    'the swap must touch exactly the two column tokens and nothing else',
  )
  for (const token of Object.keys(palette)) {
    assert.deepEqual([...Object.keys(palette[token])].sort(), ['dark', 'light'],
      `${token} must differ per scheme, or one theme comes out wrong`)
  }

  // Both schemes must declare a real, distinct pair — a swap that copied one value
  // into the other would leave the two columns identical and look like a bug.
  for (const scheme of ['light', 'dark']) {
    const chat = palette['--dsw-alias-bg-base'][scheme]
    const sidebar = palette['--dsw-specific-sidebar-fill'][scheme]
    assert.notEqual(chat, sidebar, `${scheme}: the two columns must end up different`)
    assert.match(chat, /^rgb\(/, `${scheme}: chat must be a concrete colour, not a var() cycle`)
    assert.match(sidebar, /^rgb\(/, `${scheme}: sidebar must be a concrete colour`)
  }
})
