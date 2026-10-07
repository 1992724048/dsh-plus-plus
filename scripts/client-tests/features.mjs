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
  // Composer's declarations moved to a data-only chunk; rehydrate the fields the
  // feature tests read so they assert the sheet that apply() actually installs.
  if (id === 'composer') {
    const declaration = cache.get('client.composer.css.js').exports
    descriptor.css = `${declaration.CSS}\n${declaration.SEAT_CSS}`
    descriptor.seatCss = declaration.SEAT_CSS
    descriptor.palette = declaration.PALETTE
  }
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
  assert.match(declared('--pp-font-sans') ?? '', /^'HarmonyOS Sans SC'/)
  assert.doesNotMatch(css, /^\s*html\s*,/m, 'an element rule loses to any class selector')
})

test('the CJK fallback the stacks name is the family the packaged faces declare', async () => {
  const css = allCss((await bootRun()).styleTags)
  const { default: fs } = await import('node:fs')
  const { default: path } = await import('node:path')
  const { ROOT } = await import('./harness.mjs')
  const face = path.resolve(ROOT, 'node_modules',
    'harmonyos-sans-webfont-splitted/dist/HarmonyOS_Sans_SC/Regular.css')
  const family = /font-family:\s*"([^"]+)"/.exec(fs.readFileSync(face, 'utf8'))?.[1]
  assert.ok(family, 'the HarmonyOS sheet must declare a font-family')
  const { FONT_STACK } = await import('../../src/fonts.js')
  assert.ok(FONT_STACK.mono.includes(family),
    `the code stack must fall back to "${family}" before the generic monospace`)
  assert.ok(FONT_STACK.sans.includes(family),
    `the body stack must fall back to "${family}"`)
  assert.ok(css.includes(`'${family}'`),
    `the served variables must reference "${family}" — a name the faces never declare matches nothing and drops Chinese to the system font`)
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
  const source = readCode('client.composer.js') + readCode('client.composer.css.js')
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
  assert.ok(hovers.length > 0, 'the _modes triggers need a hover of their own')
  for (const block of hovers) {
    assert.match(block, /background:\s*var\(--pp-composer-trigger-hover\)/,
      'the _modes triggers hover on their own palette value — the model trigger took the accent yellow instead')
  }
  assert.doesNotMatch(css, /\[data-slot="conversation\.input\.model"\] button:hover[^{]*\{[^}]*trigger-hover/,
    'the model hover must be fully moved off the trigger value, not declared twice')
})

test('the attach and send buttons hover yellow, cross-fading over 200ms', async () => {
  const { css, palette } = await featureOf('composer')

  // The colour itself, per the instruction: one value for both schemes.
  assert.equal(palette['--pp-composer-accent-hover'].light, '#ffee22')
  assert.equal(palette['--pp-composer-accent-hover'].dark, '#ffee22',
    'the yellow was specified as one colour, so it is not theme-dependent')
  assert.equal(palette['--pp-composer-accent-transition'].light, '200ms')
  assert.equal(palette['--pp-composer-accent-transition'].dark, '200ms')

  // The accent controls plus the model trigger must carry the hover…
  for (const [name, anchor] of [
    ['attach', /\[data-composer-card\] button\[aria-haspopup="listbox"\]:hover:not\(:disabled\)/],
    ['send', /\[data-composer-card\] \[class\*="_trailing"\] > button:last-of-type:hover:not\(:disabled\)/],
    ['model', /\[data-composer-card\] \[data-slot="conversation\.input\.model"\] button:hover:not\(:disabled\)/],
  ]) {
    assert.match(css, anchor, `${name} must have a hover rule`)
  }
  assert.equal([...css.matchAll(/var\(--pp-composer-accent-hover\)/g)].length, 3,
    'attach, send and the model trigger use it — the _modes triggers must not')

  // …and the transition must sit on the **resting** state, not on the hover. A
  // transition declared only while hovered animates into the state and snaps out
  // of it, so the fade would be one-way and "200ms" would only hold on the way in.
  //
  // Anchored on the accent fill rather than on the selector: the attach button is
  // matched by two separate rules — one for its size, one for its colour — and
  // only the second carries the transition.
  const attachResting = /\[data-composer-card\] button\[aria-haspopup="listbox"\],\s*\n\[data-composer-card\] \[data-input-scroll\][^{]*\{\s*\n\s*background:\s*var\(--pp-composer-accent\);([^}]*)\}/.exec(css)
  const sendResting = /\[data-composer-card\] \[class\*="_trailing"\] > button:last-of-type\s*\{([^}]*)\}/.exec(css)

  for (const [name, match] of [['attach', attachResting], ['send', sendResting]]) {
    const resting = match?.[1]
    assert.ok(resting !== undefined, `${name} resting colour rule must be locatable`)
    assert.match(resting, /transition:[^;]*background-color[^;]*var\(--pp-composer-accent-transition\)/,
      `${name} must declare the transition while resting, so it also fades back out`)
  }
  // Count by the *declaration*, not the property: the transition wraps onto a
  // second line for the colour, so each control contributes two matches and a
  // count of 2 would only ever match a single-property transition.
  //
  // Eight, not six: the permission trigger also declares the same 200ms pair for its
  // mode colours, so the two accent controls plus the permission rule contribute
  // three declarations each with two properties — and the model trigger now joins
  // them, having taken the send button's hover. Asserting a smaller number here
  // would be asserting that one of these controls does not cross-fade, which is not
  // the intent — the per-control loop above is what pins those three.
  assert.equal([...css.matchAll(/--pp-composer-accent-transition\) ease/g)].length, 8,
    'all four animated controls declare the transition, for background and colour')
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

test('the editor is borderless and its placeholder is lifted off the host\'s dim', async () => {
  // Two reported problems, one block. The placeholder only ever inherited the
  // host's own heavily-dimmed colour, which is right for a hint sitting on the chat
  // background and wrong here: the wash already lifts the backdrop to about mid
  // grey, so a value tuned against near-black lands far lower once composited over
  // it, and the prompt reads as a smudge. And the block carried the same hairline as
  // every button beside it, which on a blurred translucent surface is a redundant
  // second edge.
  const { css } = await featureOf('composer')

  // The block keeps the wash and the blur — that is what makes it read as a surface
  // once the outline is gone — and drops the border.
  const block = /\[data-composer-card\] > \[data-input-scroll\]\s*\{([^}]*)\}/.exec(css)
  assert.ok(block, 'the editor block rule must exist')
  assert.match(block[1], /border:\s*0(?![\w-])/, 'the editor must not be outlined')
  assert.doesNotMatch(block[1], /border:\s*1px/, 'and must not reinstate the hairline')
  assert.match(block[1], /background:\s*var\(--pp-composer-surface\)/,
    'the wash is what replaces the outline as the surface')
  assert.match(block[1], /backdrop-filter:\s*blur\(var\(--pp-composer-blur\)\)/,
    'and so is the blur')

  // The placeholder is the thing that was reported, so it is the thing styled. It
  // must take a palette value rather than a literal, because only the palette knows
  // which scheme is live.
  const placeholder = /\[data-composer-placeholder\]\s*\{([^}]*)\}/.exec(css)
  assert.ok(placeholder, 'the placeholder rule must exist')
  assert.match(placeholder[1], /color:\s*var\(--pp-composer-placeholder-ink\)/,
    'the placeholder must take its colour from the palette')
  assert.match(placeholder[1], /inset:\s*10px 12px auto;/,
    'and keep the draft inset, or the two start on different columns')

  // The draft is explicitly NOT restyled. An earlier pass pinned the typed text to
  // a near-pure value, which fixed nothing that was reported and made the draft
  // louder than every other label in the composer — the input already carries the
  // host's label-primary, which is the right colour for text that has been typed.
  const draft = /\[data-composer-input\]\s*\{([^}]*)\}/.exec(css)
  assert.ok(draft, 'the editor input rule must exist')
  assert.doesNotMatch(draft[1], /color:/,
    'the typed draft keeps the host\'s own ink — only the placeholder was reported')
  assert.doesNotMatch(css, /--pp-composer-ink\b(?!-)/,
    'the token was renamed: it is the placeholder\'s, not a general ink')

  // Both schemes are declared, and both are translucent rather than opaque: the
  // placeholder sits on the same wash as the draft, so alpha is the only knob that
  // keeps the two from drifting apart in lightness.
  const { palettes } = await bootRun()
  const layer = palettes.find(entry => entry.tokens['--pp-composer-placeholder-ink'] !== undefined)
  assert.ok(layer !== undefined, 'the placeholder ink must be declared through the theme layer')
  const ink = layer.tokens['--pp-composer-placeholder-ink']
  assert.equal(ink.light, 'rgb(0 0 0 / 62%)', 'light: a dimmed black')
  assert.equal(ink.dark, 'rgb(255 255 255 / 78%)', 'dark: a dimmed white')
  assert.notEqual(ink.light, ink.dark, 'the two schemes must not share one value')
  for (const scheme of ['light', 'dark']) {
    assert.match(ink[scheme], /\/ \d+%\)/, `${scheme}: must stay translucent to match the wash`)
  }
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

  // The editor stays translucent in both schemes, and every surface on it reads
  // white now: the light scheme was asked back to white (it had been inverted to
  // black). The ink and the hairline are what still flip with the theme.
  assert.equal(get('--pp-composer-surface', 'light'), 'rgb(255 255 255 / 50%)',
    'light: the editor is a translucent white wash')
  assert.equal(get('--pp-composer-surface', 'dark'), 'rgb(255 255 255 / 50%)',
    'dark: the editor is a translucent white wash')

  // Labelled triggers: white surfaces in both schemes, with dark ink — a glyph on
  // a white button has to be black, in both.
  assert.equal(get('--pp-composer-trigger', 'light'), '#fff', 'light: the triggers are white')
  assert.equal(get('--pp-composer-trigger', 'dark'), '#fff', 'dark: the triggers are white')
  assert.equal(get('--pp-composer-trigger-ink', 'light'), '#000', 'light: their labels are black')
  assert.equal(get('--pp-composer-trigger-ink', 'dark'), '#000', 'dark: their labels are black')

  // Attach, send and model follow the same pairing.
  assert.equal(get('--pp-composer-accent', 'light'), '#fff', 'light: attach and send are white')
  assert.equal(get('--pp-composer-accent', 'dark'), '#fff', 'dark: attach and send are white')
  assert.equal(get('--pp-composer-accent-ink', 'light'), '#000', 'light: their glyphs are black')
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

test('the permission button is borderless and coloured by its mode', async () => {
  // The host exposes no structural marker for the permission mode — it is React
  // state rendered as text — so the chunk reads it and publishes data-pp-mode, and
  // the stylesheet keys on that. A selector written against the label itself would
  // find nothing on an English UI.
  const { css, palette } = await featureOf('composer')

  const base = /\[data-slot="conversation\.input\.permission"\] button\s*\{([^}]*)\}/.exec(css)
  assert.ok(base, 'the permission rule must exist')
  assert.match(base[1], /border:\s*0(?![\w-])/, 'the permission button must not be outlined')
  assert.match(base[1], /transition:/, 'and must cross-fade between modes')

  // Each mode is a background, keyed on its own attribute value — the asked-for
  // property is the fill, not the label.
  for (const mode of ['readonly', 'workspace', 'full']) {
    const rule = new RegExp('button\\[data-pp-mode="' + mode + '"\\]\\s*\\{([^}]*)\\}').exec(css)
    assert.ok(rule, mode + ' must have its own rule')
    assert.match(rule[1], new RegExp('background:\\s*var\\(--pp-composer-permission-' + mode + '\\)'),
      mode + ' must set the background from its own token')
    assert.match(rule[1], /color:\s*var\(\S+-ink\)/,
      mode + ' must pair the fill with a matching ink')
  }

  // Three distinct hues, and each must differ from its own ink — the one
  // invariant a palette edit can silently break.
  const fills = ['readonly', 'workspace', 'full'].map(m => palette['--pp-composer-permission-' + m].dark)
  assert.equal(new Set(fills).size, 3, 'the three modes must be three colours; got ' + fills.join(' '))
  assert.deepEqual(fills, ['#67C23A', '#409EFF', '#E6A23C'],
    'the asked-for mode colours: view-only green, workspace blue, full-access orange')
  for (const mode of ['readonly', 'workspace', 'full']) {
    const fill = palette['--pp-composer-permission-' + mode].dark
    const ink = palette['--pp-composer-permission-' + mode + '-ink'].dark
    assert.notEqual(fill, ink, mode + ': its ink would be invisible on its own fill')
  }

  // A mode colour is a mode colour: it must not invert with the theme, or 'green'
  // would mean two different things in the two schemes.
  for (const mode of ['readonly', 'workspace', 'full']) {
    const token = '--pp-composer-permission-' + mode
    assert.equal(palette[token].light, palette[token].dark,
      token + ' is a mode colour, not a theme colour — it must not invert')
  }

  // Focus is the yellow, on the background, and outranks the hover.
  const focus = /button:focus-visible\s*\{([^}]*)\}/.exec(css)
  assert.ok(focus, 'the permission button needs a focus rule')
  assert.match(focus[1], /background:\s*var\(--pp-composer-permission-focus\)/,
    'focus must paint the background yellow, as asked')
  assert.equal(palette['--pp-composer-permission-focus'].dark, '#ffee22',
    'and it is the same yellow the accent hover already uses')

  // The mode rules must follow the shared trigger rule or the shared fill wins on
  // source order and the button stays black/white.
  const shared = css.indexOf('[class*="_modes"] button,')
  const modes = css.indexOf('button[data-pp-mode=')
  assert.ok(shared >= 0 && modes >= 0 && modes > shared,
    'the mode rules must follow the shared trigger rule to win at equal specificity')
})

test("the permission mode is reflected from the host's label, not a CSS match", async () => {
  // The mapping is JS because the mode is not in the DOM structurally. It still
  // has to be the one place that guesses a locale, and it must degrade to the
  // neutral default rather than mis-colour a mode when the text is not recognised.
  const { readCode } = await import('./harness.mjs')
  const source = readCode('client.composer.js') + readCode('client.composer.css.js')

  assert.match(source, /PERMISSION_MODES/, 'the mode mapping must be one named constant')
  assert.match(source, /data-pp-mode/, 'and published as the attribute the sheet keys on')
  assert.match(source, /MutationObserver/, 'mode changes are React state, so they need an observer')

  // No rule may match the host's label text directly — that is the exact mistake
  // this chunk exists to avoid, and it fails silently on a non-Chinese UI.
  const { css } = await featureOf('composer')
  for (const label of ['只读', '工作区', '完全权限', 'Read-only', 'Workspace', 'Full access']) {
    assert.ok(!css.includes(label), 'the stylesheet must not match the localized label ' + label)
  }
})

test("every host permission label maps to a mode", async () => {
  // The regression exactly as reported: read-only rendered no colour at all. The
  // mapping matched 只读, the host renders 仅可查看, and the two share no substring,
  // so the attribute was never set and the button kept the default fill. A mapping
  // that matches nothing and a mapping that is not wired up look identical from the
  // page, so each host string is asserted here against the mode it must produce.
  const { readCode } = await import('./harness.mjs')
  const source = readCode('client.composer.js') + readCode('client.composer.css.js')

  // The list as data, parsed from the source so the test cannot drift from it.
  const block = /const PERMISSION_MODES = \[([\s\S]*?)\n    \]/.exec(source)
  assert.ok(block, 'PERMISSION_MODES must be locatable')
  const entries = [...block[1].matchAll(/mode:\s*'([a-z]+)',\s*match:\s*'([^']+)'/g)]
    .map(m => ({ mode: m[1], match: m[2] }))
  assert.ok(entries.length >= 3, 'every mode needs at least one entry')

  const resolve = text => {
    for (const e of entries) if (text.includes(e.match)) return e.mode
    return undefined
  }

  // Read off the live button. The first two are the host's own strings; the third
  // is from the captured DOM in composer-dom.html.
  for (const pair of [['仅可查看', 'readonly'], ['工作区', 'workspace'], ['完全权限', 'full']]) {
    assert.equal(resolve('访问模式，当前：' + pair[0] + ' ' + pair[0]), pair[1],
      'the host renders ' + pair[0] + ' and it must map to ' + pair[1])
  }

  // Order is load-bearing: a shorter substring must never precede a longer one that
  // contains it, or the shorter shadows the longer for the whole list. Only
  // cross-mode shadows are a bug — the full pair is same-mode by design.
  for (let i = 0; i < entries.length - 1; i += 1) {
    const a = entries[i], b = entries[i + 1]
    if (b.match.includes(a.match) && a.mode !== b.mode) {
      assert.fail(
        a.match + ' precedes ' + b.match + ' and shadows it across modes',
        '— the more specific entry must be tested first',
      )
    }
  }

  // Every mode the mapping can produce must have a rule that consumes it, or the
  // attribute is set and nothing paints — the exact symptom that was reported.
  const { css } = await featureOf('composer')
  for (const mode of new Set(entries.map(e => e.mode))) {
    assert.ok(css.includes('button[data-pp-mode="' + mode + '"]'),
      mode + ' has a mapping but no rule would consume it')
  }

  // An unrecognised label must fall through to the neutral default rather than
  // mis-colour a mode, so the mapping may only cover modes that have a rule above.
  assert.equal(resolve('访问模式，当前：某种未知模式'), undefined,
    'an unknown label must not map to any mode')
})

test('the permission watcher re-acquires the button after a session switch', async () => {
  const { readCode } = await import('./harness.mjs')
  const source = readCode('client.composer.js')

  assert.match(source, /if \(button === watched\) return/,
    'the poll must keep running and skip only while the same button element stays mounted')
  assert.equal([...source.matchAll(/clearInterval\(poll\)/g)].length, 1,
    'the poll must survive finding its button — only the effect cleanup may stop it, '
    + 'or every session switch leaves the new button unwatched and uncoloured')
  assert.match(source, /if \(typeof watching === 'function'\) watching\(\)/,
    'the replaced button\'s observer must be torn down with it')
})

test('the attach, model and send buttons are borderless, and the model sits 4px from the send button', async () => {
  // Three small asks on the same controls. None of them may be folded into the
  // shared trigger rule, because that rule is shared with the permission button and
  // changing it there would move a control the user did not ask about.
  const { css } = await featureOf('composer')

  // Borderless. The generic control rule gives every button a hairline; the attach
  // and send triggers remove their own inside their accent rules, and the model
  // removes its in the standalone override below.
  const attach = rulesMatching(css, 'button[aria-haspopup="listbox"]')
    .find(rule => /border:\s*0/.test(rule.body))
  assert.ok(attach, 'the attach trigger must carry its own borderless declaration')
  assert.doesNotMatch(attach.body, /border:\s*1px/, 'and must not reinstate the hairline')

  const send = rulesMatching(css, '[class*="_trailing"] > button:last-of-type')
    .find(rule => /border:\s*0/.test(rule.body))
  assert.ok(send, 'the send button must carry its own borderless declaration')
  assert.doesNotMatch(send.body, /border:\s*1px/, 'and must not reinstate the hairline')

  const overrides = rulesMatching(css, '[data-slot="conversation.input.model"] button')
    .filter(rule => !rule.selector.includes(','))
  const model = overrides.find(rule => /border:\s*0/.test(rule.body))
  assert.ok(model, 'the model trigger must carry its own borderless declaration')
  assert.doesNotMatch(model.body, /border:\s*1px/, 'and must not reinstate the hairline')

  // 4px from the send button. Model and send are siblings in the trailing group,
  // whose gap the host ships at 12px; the 4px the user asked for is set there. The
  // inner-group rule above reaches _standardControls — the group the model button is
  // *inside* — so it cannot be what spaces these two apart.
  const trailing = /\[data-composer-card\] \[class\*="_trailing"\]\s*\{([^}]*)\}/.exec(css)
  assert.ok(trailing, 'the trailing group needs its own gap rule')
  assert.match(trailing[1], /gap:\s*4px/,
    'model and send are siblings in the trailing group, and the host gives that 12px')

  // The two gutters stay independent: changing the control gaps must not drag the
  // model-to-send distance along, and vice versa. So this one is a literal rather
  // than the row gutter the inner groups use.
  assert.doesNotMatch(trailing[1], /var\(--pp-composer-block-gap\)/,
    'the model-to-send gap must be literal, not tied to the row gutter')
})

test('the composer icons are thin and stable while the thread scrolls', async () => {
  const { css, palette } = await featureOf('composer')

  const icons = /\[data-composer-card\] button\[aria-haspopup="listbox"\] > svg,\s*\n\[data-composer-card\] \[class\*="_trailing"\] > button:last-of-type > svg\s*\{([^}]*)\}/.exec(css)
  assert.ok(icons, 'the attach and send glyphs share one size rule')
  assert.match(icons[1], /width:\s*16px/, 'an 18px render fattened a 14px glyph — thin it to 16')
  assert.doesNotMatch(icons[1], /18px/, 'and no 18px may remain')

  const stroke = /button\[aria-haspopup="listbox"\] > svg path\[stroke="currentColor"\]\s*\{([^}]*)\}/.exec(css)
  assert.ok(stroke, 'the plus stroke needs its own rule')
  assert.match(stroke[1], /stroke-width:\s*1\.3(?![\d.])/, 'the hairline was forced to 1.6 — thin it back')

  const generic = /\[data-composer-card\] :is\(button, \[role="button"\]\)\s*\{([^}]*)\}/.exec(css)
  assert.ok(generic, 'the generic control rule must exist')
  assert.doesNotMatch(generic[1], /backdrop-filter/,
    'a backdrop-filtered button re-rasters against the scrolled backdrop and drags its glyph with it')

  const attachment = palette['--pp-composer-attachment']
  assert.equal(attachment.light, '#F56C6C', 'light: the image chip is red')
  assert.equal(attachment.dark, '#F56C6C', 'dark: and stays red')
  assert.equal(palette['--pp-composer-attachment-ink'].light, '#fff', 'with a white icon')

  const tile = /\[data-slot="conversation\.input\.attachments"\] \[class\*="_thumbnail"\]\s*\{([^}]*)\}/.exec(css)
  assert.ok(tile, 'the image chip must carry its own tile rule')
  assert.match(tile[1], /background:\s*var\(--pp-composer-attachment\)/, 'red fill from the palette')
  assert.doesNotMatch(tile[1], /#/, 'and no literal may paint it')

  const preview = /\[class\*="_thumbnail"\] img\s*\{([^}]*)\}/.exec(css)
  assert.ok(preview, 'the preview must be addressed')
  assert.match(preview[1], /display:\s*none/, 'the chip is a red tile, so the preview img stays out of it')

  const glyph = /\[class\*="_thumbnail"\]::after\s*\{([^}]*)\}/.exec(css)
  assert.ok(glyph, 'the icon must be drawn by the chip itself')
  assert.match(glyph[1], /-webkit-mask:\s*url\("data:image\/svg\+xml/, 'a masked glyph, not an emoji')
  assert.match(glyph[1], /background:\s*var\(--pp-composer-attachment-ink\)/, 'painted white from the palette')
})

test('the send button is found structurally, not via a slot that hides', async () => {
  // The regression: the send button was styled via the activity slot that precedes
  // it, but the host hides an empty activity slot with display:none — so the
  // sibling combinator stopped matching exactly when the composer was empty, which
  // is when the button was reported as oversized.
  const { css } = await featureOf('composer')
  assert.doesNotMatch(css, /conversation\.input\.activity[^\n]*[~+]\s*button/,
    'must not anchor on the activity slot — the host hides it when empty')
  assert.match(css, /\[class\*="_trailing"\] > button:last-of-type/,
    "the send button must be found as the trailing group's last button")

  // The child combinator is load-bearing. A descendant button:last-of-type matches
  // BOTH buttons in the trailing group, because the model trigger is also the last
  // button of type inside its own wrapper — the model button lives in
  // data-slot="conversation.input.model" > _root, itself inside the trailing group.
  // The send rule's fixed 28px width and zero padding therefore landed on the model
  // button too, squashing it to a square and clipping the name to "Spac".
  //
  // Asserted as an absence, because that is the form the bug took: the style exists,
  // it matches, and it matches too much. A positive match on the correct selector
  // would still pass with the descendant version also present.
  assert.doesNotMatch(css, /\[class\*="_trailing"\] button:last-of-type/,
    'the send rule must not use a descendant combinator — it would also style the model button')
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

test('the session chunk adds a delete entry to the host\'s overflow menu', async () => {
  // The host offers no way to delete a session — its own README lists "No Session
  // deletion" as a known limitation — so this entry is the whole feature. It must
  // land in the slot the workspace UI already renders rather than in a list of our
  // own, or the sidebar would have two competing menus.
  const { effects, slots } = await bootRun()

  const menu = slots.filter(entry => entry.name === 'sidebar.workspaces.session.menu.item')
  assert.equal(menu.length, 1, 'exactly one menu entry')
  assert.equal(menu[0].id, 'plus-plus.delete-session')
  assert.equal(menu[0].order, 500, 'delete sits after the host\'s own four entries (100-400)')

  // `inject` must be a FACTORY, not an object literal: the slot runtime calls it to
  // build the entry's injections. Passing the object itself is what produced
  // 'inject is not a function' at boot.
  assert.equal(typeof menu[0].inject, 'function',
    'inject must be a factory the runtime calls, not a plain object')
  const injected = menu[0].inject()
  assert.equal(typeof injected.raiseDeleteRequest, 'function',
    'the row must receive the request setter the click handler calls')

  // The dialog is contributed separately: a menu entry that deleted on select
  // would be one mis-click from irreversible.
  const overlay = slots.filter(entry => entry.name === 'shell.overlay')
  assert.equal(overlay.length, 1, 'the confirmation dialog must have its own slot entry')
  const overlayInjected = overlay[0].inject()
  assert.ok(overlayInjected.hooks?.deleteRequest !== undefined,
    'the dialog reads its pending request through the deleteRequest hook source')
  assert.equal(typeof overlayInjected.clearDeleteRequest, 'function',
    'the dialog must be able to dismiss the request it rendered')
  assert.ok(effects.includes('dsh-plus-plus: session delete'),
    'the menu and the dialog must be torn down together')
})

test('deleting a session is gated behind a confirmation that names it', async () => {
  // Nothing in the chunk deletes on select. The flow is menu -> request held in a
  // store -> dialog renders nothing until that store holds something.
  const { readCode } = await import('./harness.mjs')
  const source = readCode('client.session.js')

  // The DELETE only goes out from inside the dialog's confirm handler, which the
  // host's own archive dialog is the precedent for.
  assert.match(source, /async function requestDelete\(/,
    'the request helper must exist')
  assert.match(source, /method:\s*'DELETE'/,
    'it must be a DELETE — the host route refuses any other verb')

  // The dialog quotes the title, so a click on the wrong row is visible before it
  // is committed.
  assert.match(source, /description:\s*t\('session\.confirm\.desc',\s*\{\s*title:/,
    'the dialog must name the session being deleted')

  // Cancel is the first footer button so it is not what a stray Enter lands on.
  const cancelAt = source.indexOf("t('session.confirm.cancel')")
  const confirmAt = source.indexOf("t('session.confirm.action')")
  assert.ok(cancelAt > 0 && confirmAt > cancelAt,
    'cancel must precede the destructive action in the footer')

  // A failure is surfaced rather than swallowed: a silent no-op on a destructive
  // action is indistinguishable from success.
  assert.match(source, /role:\s*'alert'/, 'a failed delete must be announced')
  assert.match(source, /role:\s*'status'/, 'the in-flight state must be announced')
})

test('the session chunk never reaches for the host\'s session index', async () => {
  // workspace.json is the host's own state and it reconciles sessionIds against
  // disk on startup: an id edited out by hand is re-added while its log file still
  // exists, and a session whose directory is gone is already filtered from the
  // live view. So deleting the directory is what makes the bookkeeping correct, and
  // writing the file would be both wrong and a race against the host.
  const { readCode } = await import('./harness.mjs')
  const hostSource = readCode('client.session.js')
  assert.doesNotMatch(hostSource, /workspace\.json/,
    'the browser half must not reference the host\'s index file')
})

test('the injected store is declared before the factories that close over it', async () => {
  // The factories are module-level closures, so a store declared inside apply() is
  // out of scope for them: 'requestStore is not defined' fired on the first click,
  // long after registration succeeded.
  const { readCode } = await import('./harness.mjs')
  const source = readCode('client.session.js')

  const declaredAt = source.indexOf('const requestStore = createSnapshotStore(null)')
  assert.ok(declaredAt >= 0, 'the store must be declared at module level')
  const factoriesAt = source.indexOf('const deleteInjected = () =>')
  assert.ok(factoriesAt >= 0, 'the injected factories must exist')
  assert.ok(declaredAt < factoriesAt, 'the store must be declared before the factories that close over it')

  // And it must not ALSO be declared inside apply(), which is what shadowed it.
  // Scoped to the apply body: the module-level factories below the descriptor would
  // otherwise match a plain slice of the rest of the file.
  const applyAt = source.indexOf('async apply(ctx) {')
  assert.ok(applyAt >= 0, 'the descriptor must have an apply')
  // Locate the end by brace depth: the descriptor's closing brace also closes apply,
  // and a text marker would either stop short or run past into the factories.
  let depth = 0
  let end = applyAt
  for (const ch of source.slice(applyAt)) {
    if (ch === '{') depth += 1
    else if (ch === '}') { depth -= 1; if (depth === 0) break }
    end += 1
  }
  const applyBody = source.slice(applyAt, end)
  assert.ok(!/const requestStore = /.test(applyBody),
    'a per-apply store declaration leaves the factories referencing an unbound name')
})
test('a slot entry resolves the way the shell resolves it', async () => {
  // Structural assertions passed while the browser still crashed three times, in
  // three different ways: inject passed as an object, the store passed without a
  // create, and `t` named as a prop that the runtime never supplies. Each of those
  // is only visible if the entry is actually *invoked*, the way the shell invokes
  // it on mount. This test does that.
  const { renderSlotEntry, renderSlotComponent } = await import('./harness.mjs')
  const { slots } = await bootRun()

  const menuEntry = slots.find(candidate => candidate.name === 'sidebar.workspaces.session.menu.item')
  const overlayEntry = slots.find(candidate => candidate.name === 'shell.overlay')
  assert.ok(menuEntry, 'the delete menu row must be registered')
  assert.ok(overlayEntry, 'the delete overlay must be registered')

  const overlay = renderSlotEntry(overlayEntry)
  assert.equal(typeof overlay.t, 'function', 'the overlay must receive t')
  assert.equal(typeof overlay.useDeleteRequest, 'function', 'the overlay needs its request hook')
  assert.equal(typeof overlay.clearDeleteRequest, 'function', 'the overlay needs a dismiss hook')

  const rendered = renderSlotEntry(menuEntry, {
    sessionId: 'session-x',
    displayTitle: 'A session',
    useMenuOpenState: () => [false, () => {}],
  })
  assert.equal(typeof rendered.t, 'function', 'the row must receive t')
  assert.equal(typeof rendered.t('menu.deleteSession'), 'string', 'the menu label must translate')
  assert.equal(typeof rendered.raiseDeleteRequest, 'function', 'the row needs a request setter')

  const menuNode = renderSlotComponent(menuEntry, {
    sessionId: 'session-x',
    displayTitle: 'A session',
    useMenuOpenState: () => [false, () => {}],
  })
  assert.equal(typeof menuNode.element.props.onSelect, 'function', 'the row needs an onSelect handler')
  assert.equal(menuNode.element.props.danger, true, 'the row must request the primitive danger colours')

  menuNode.element.props.onSelect()
  assert.equal(
    overlay.useDeleteRequest(pending => pending)?.sessionId,
    'session-x',
    'the request must be visible to the overlay immediately after the click',
  )

  const dialogNode = renderSlotComponent(overlayEntry)
  assert.notEqual(dialogNode.element, null, 'the request must render a dialog')
  dialogNode.clearDeleteRequest()
  assert.equal(renderSlotComponent(overlayEntry).element, null, 'dismissing must clear the dialog')
})

test('the delete row closes the overflow menu before raising the dialog', async () => {
  const { renderSlotComponent } = await import('./harness.mjs')
  const { slots } = await bootRun()
  const menuEntry = slots.find(candidate => candidate.name === 'sidebar.workspaces.session.menu.item')
  const calls = []

  const menuNode = renderSlotComponent(menuEntry, {
    sessionId: 'session-x',
    displayTitle: 'A session',
    useMenuOpenState: () => [true, value => calls.push(value)],
  })
  menuNode.element.props.onSelect()

  assert.deepEqual(calls, [false], 'the row must close the host menu so the confirmation can take the pointer')
})

test('the confirmation resets its in-flight state for the next session', async () => {
  const { readCode } = await import('./harness.mjs')
  const source = readCode('client.session.js')
  const dialogStart = source.indexOf('function DeleteConfirmDialog')
  const effectStart = source.indexOf('useEffect(() => {', dialogStart)
  const confirmStart = source.indexOf('const confirm = useCallback', dialogStart)
  const effectEnd = source.indexOf('}, [request.sessionId])', effectStart)

  assert.ok(effectStart > dialogStart, 'the dialog must reset its state on a request change')
  assert.ok(effectEnd > effectStart && effectEnd < confirmStart,
    'the reset must run before the next confirmation handler is built')
  assert.match(source.slice(effectStart, effectEnd), /setDeleting\(false\)/,
    'a failed or interrupted delete must not leave the next dialog permanently disabled')
  assert.match(source.slice(effectStart, effectEnd), /setError\(null\)/,
    'the previous failure must not belong to the next session')
})

test('the delete menu row is red through the primitive danger prop', async () => {
  // MenuItemButton destructures only { children, shortcut, icon, disabled, danger,
  // separatorBefore, onSelect } — there is no className in that list, so a className
  // passed to it is silently dropped and the row paints in the ordinary ink. The
  // primitive's own Menu.module.css carries the destructive colour under `.danger`.
  const { readCode } = await import('./harness.mjs')
  const source = readCode('client.session.js')

  assert.match(source, /danger:\s*true/, 'the row must request the primitive danger colours')
  assert.doesNotMatch(source, /DELETE_MENU_ITEM_CLASS|pp-delete-menu-item/,
    'a className on MenuItemButton would be dropped by the primitive and would never paint')
})
test('every slot lookup resolves to a registered key', async () => {
  // The menu label rendered as the raw string 'menu.deleteSession' because client.js
  // registers each feature's dictionary as feature-id-prefixed, while a slot's `t` is
  // bound to the bare namespace. An unprefixed key misses silently and renders as
  // itself, so the labels have to be checked against the registered set.
  const feature = await featureOf('session')
  assert.ok(feature.locale !== undefined, 'the feature must contribute a dictionary')

  const { dictionaries } = await bootRun()
  const registered = dictionaries.find(entry => entry.ns === 'settings.plusPlus')
  assert.ok(registered !== undefined, 'the namespace must be registered')
  // client.js flattens each feature as `${feature.id}.${key}`, so this is the set a
  // slot's `t` is actually bound to.
  const keys = new Set(Object.keys(registered.dicts.zh))
  const { readCode } = await import('./harness.mjs')
  const source = readCode('client.session.js')

  for (const match of source.matchAll(/t\('([^']+)'\)/g)) {
    const key = match[1]
    // Slot names are not lookups.
    if (key.includes('sidebar.') || key.includes('shell.')) continue
    // The settings section is rendered by client.js with the feature-scoped t.
    if (key === 'title' || key === 'subtitle') continue
    assert.ok(keys.has(key),
      't(' + key + ') must exist under the registered namespace')
  }
})

test('the destructive confirm button out-specifies the primitive it sits on', async () => {
  // `Button` paints its own ink through a CSS-module class on the element. A single
  // class rule loses to that, and the confirm button rendered in the default ink
  // instead of red — a cosmetic miss, but the one signal that a destructive action
  // is a destructive action.
  const { css } = await featureOf('session')
  const rules = [...css.matchAll(/^([^\n{]+)\{([^}]*)\}/gm)]
    .map(m => ({ selector: m[1].trim(), body: m[2].trim() }))

  const action = rules.find(rule => /\.pp-delete-action/.test(rule.selector))
  assert.ok(action !== undefined, 'the delete action must be styled')

  // Specificity is class count: the rule must stack two class selectors so it wins
  // without !important, which the rest of this plugin never uses.
  const classes = (action.selector.match(/\.pp-delete-action/g) ?? []).length
  assert.ok(classes >= 2,
    `the rule needs two class selectors to beat the primitive's own, found ${classes}`)
  assert.doesNotMatch(action.body, /!important/,
    'and must do it by specificity, not by !important')

  // And it must carry a colour and a border, not just a hover.
  assert.match(action.body, /color:/, 'the label must be tinted')
  assert.match(action.body, /border-color:/, 'and so must the outline')

  // The shell's documented danger token is state-error-primary. An undocumented
  // `danger-*` name resolves to nothing and leaves the button in default ink.
  assert.match(action.body, /--dsw-alias-state-error-primary/,
    'the destructive colour must use the host error token')
  assert.doesNotMatch(css, /--dsw-alias-state-danger/,
    'danger-* is not a host token and silently falls through')
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
  const { palette, css } = await featureOf('surface')
  assert.deepEqual(
    [...Object.keys(palette)].sort(),
    ['--dsw-alias-bg-base', '--dsw-specific-sidebar-fill', '--pp-surface-article-card', '--pp-surface-blur', '--pp-surface-chat-image', '--pp-surface-header-veil'],
    'the swap owns the two column tokens plus its own backdrop, card, blur and header tokens, and nothing else',
  )
  assert.deepEqual(
    Object.keys(palette).filter(token => token.startsWith('--dsw-')).sort(),
    ['--dsw-alias-bg-base', '--dsw-specific-sidebar-fill'],
    'the swap must touch exactly the two column tokens of the host and no layer token',
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
    assert.match(sidebar, /url\("\/api\/dsh-plus-plus\/assets\//,
      `${scheme}: the sidebar paints the window image itself — its opaque layer hides every consumer stacked below it`)
    assert.match(sidebar, / fixed center \/ cover no-repeat, rgb\(/,
      `${scheme}: pinned to the viewport so every consumer renders the identical crop`)
    assert.match(sidebar, /\/ 65%\)/,
      `${scheme}: the sidebar wash must match the conversation bar's 65% veil — the user asked for one opacity everywhere`)
  }
})

test('the conversation header floats, veils and blurs over the thread', async () => {
  const { palette, css } = await featureOf('surface')

  assert.equal(palette['--pp-surface-header-veil'].light, 'rgb(255 255 255 / 65%)',
    'light: a white veil over the backdrop')
  assert.equal(palette['--pp-surface-header-veil'].dark, 'rgb(20 20 22 / 65%)',
    'dark: a dark veil over the backdrop')

  const rule = /html \[data-slot="conversation\.header"\] > \*\s*\{([^}]*)\}/.exec(css)
  assert.ok(rule, 'the header element must carry the veil')
  assert.match(rule[1], /background-color:\s*var\(--pp-surface-header-veil\)/,
    'the veil must come from the palette so the host can flip it with the scheme')
  assert.match(rule[1], /position:\s*absolute(?![\w-])/,
    'only an out-of-flow header lets the thread scroll up beneath it')
  assert.match(rule[1], /z-index:\s*5/, 'and stay above the messages it covers')
  assert.match(rule[1], /backdrop-filter:\s*blur\(var\(--pp-surface-blur\)\)/,
    'the blur must come from the palette')

  const scroller = /html \[data-conversation-scroll\]\s*\{([^}]*)\}/.exec(css)
  assert.ok(scroller, 'the thread must start below the floating header')
  assert.match(scroller[1], /padding-top:\s*var\(--pp-header-height, 76px\)/,
    'pushed by the measured header height, so the first message is never hidden')

  const { readCode } = await import('./harness.mjs')
  const source = readCode('client.surface.js')
  assert.match(source, /ResizeObserver/,
    'the header height is measured, not guessed — the host ships it at min-height and it can grow')
  assert.match(source, /if \(header === watched\) return/,
    'and it is re-measured across a session switch, when the header remounts')
})

test('the window title bar is a translucent blurred strip', async () => {
  const { palette, css } = await featureOf('surface')
  assert.equal(palette['--pp-surface-blur'].light, '16px', 'light: one blur for every surface')
  assert.equal(palette['--pp-surface-blur'].dark, '16px', 'dark: and the same again')

  const strip = /html\[data-windows-titlebar\] \[class\*="_frame"\]::before\s*\{([^}]*)\}/.exec(css)
  assert.ok(strip, 'the Windows title strip must carry its own rule')
  assert.match(strip[1], /background-image:\s*none(?![\w-])/,
    'the strip must give up the opaque image, or the backdrop behind it has nothing to blur')
  assert.match(strip[1], /background-color:\s*var\(--pp-surface-header-veil\)/,
    'a translucent veil instead')
  assert.match(strip[1], /backdrop-filter:\s*blur\(var\(--pp-surface-blur\)\)/,
    'and the frosted blur the user asked for')
})

test('the session side panel floats over the thread instead of squeezing it', async () => {
  const { css } = await featureOf('surface')

  const grid = /html\[data-windows-titlebar\] \[class\*="_frame"\]:not\(\[data-rightbar-collapsed\]\)\s*\{([^}]*)\}/.exec(css)
  assert.ok(grid, 'the frame must reclaim the track when the panel is open')
  assert.match(grid[1], /grid-template-columns:\s*var\(--dsh-windows-sidebar-width\) minmax\(0, 1fr\) !important/,
    'author !important outranks the inline template, so the chat gets its width back')
  assert.match(grid[1], /!important(?![\w-])/, 'without it the inline style wins and the chat stays squeezed')

  const panel = /html \[class\*="_frame"\] > \[class\*="_rightbarCol"\]\s*\{([^}]*)\}/.exec(css)
  assert.ok(panel, 'the panel column must carry its own rule')
  assert.match(panel[1], /position:\s*absolute(?![\w-])/, 'out of flow, so it overlays instead of pushing')
  assert.match(panel[1], /right:\s*0(?![\w-])/, 'pinned to the right edge')
  assert.match(panel[1], /backdrop-filter:\s*blur\(var\(--pp-surface-blur\)\)/, 'translucent and blurred')
  assert.match(panel[1], /background-color:\s*var\(--pp-surface-header-veil\)/, 'veiled from the palette')

  const closed = /html \[class\*="_frame"\]\[data-rightbar-collapsed\] > \[class\*="_rightbarCol"\]\s*\{([^}]*)\}/.exec(css)
  assert.ok(closed, 'the closed panel must be addressed')
  assert.match(closed[1], /display:\s*none/,
    'once out of the grid the host no longer clips an empty column — it has to be hidden by hand')
})

test('the backdrop fills the window and every image layer shares one crop', async () => {
  const { palette, css } = await featureOf('surface')

  const image = palette['--pp-surface-chat-image']
  assert.equal(image.light, 'url("/api/dsh-plus-plus/assets/bk.jpg")',
    'light: the backdrop is bk')
  assert.equal(image.dark, 'url("/api/dsh-plus-plus/assets/bg.jpg")',
    'dark: the backdrop is bg')

  const frame = /html \[class\*="_frame"\]:has\(> \[class\*="_sidebarCol"\]\)\s*\{([^}]*)\}/.exec(css)
  assert.ok(frame, 'the window frame must carry the image')
  assert.match(frame[1], /background-image:\s*var\(--pp-surface-chat-image\)/,
    'the whole window must take its image from the palette')

  const root = /html \[class\*="_root"\]:has\(\[data-conversation-region="chat"\]\)\s*\{([^}]*)\}/.exec(css)
  assert.ok(root, 'the conversation column must carry the image under its header too')

  const rule = /\[data-conversation-region="chat"\]\s*\{([^}]*)\}/.exec(css)
  assert.ok(rule, 'the chat region must carry the image rule')
  assert.match(rule[1], /background-image:\s*var\(--pp-surface-chat-image\)/,
    'the image must come from the palette so the host can flip it with the scheme')
  assert.match(rule[1], /background-size:\s*cover/, 'and cover the column')

  for (const [name, match] of [['frame', frame], ['root', root], ['chat', rule]]) {
    assert.match(match[1], /background-attachment:\s*fixed/,
      `${name}: every image layer must be pinned to the viewport crop, or the pattern jumps at each boundary`)
  }

  assert.doesNotMatch(css, /assets\/bk\.jpg/,
    'the stylesheet must not hard-code an image URL — only the palette may name it')
  assert.doesNotMatch(rule[1], /background:\s/,
    'the backdrop must add an image layer, never replace the column colour')
})

test('the thread sits on a translucent article card that stops above the composer', async () => {
  const { palette, css } = await featureOf('surface')

  const card = palette['--pp-surface-article-card']
  assert.equal(card.light, 'rgb(255 255 255 / 85%)', 'light: a white paper column')
  assert.equal(card.dark, 'rgb(255 255 255 / 12%)', 'dark: a translucent white wash, not a slab')

  const rule = /\[data-conversation-scroll\]::before\s*\{([^}]*)\}/.exec(css)
  assert.ok(rule, 'the card must hang off the scroller, not the body')
  assert.match(rule[1], /bottom:\s*var\(--dsh-composer-height, 0px\)/,
    'the seat height is measured onto the scroller — the card must stop exactly above it, since the composer is excluded')
  assert.match(rule[1], /width:\s*calc\(var\(--dsh-chat-content-width[^)]*\)\s*\+ 48px\)/,
    'the card follows the content column, blog-article style')
  assert.match(rule[1], /background:\s*var\(--pp-surface-article-card\)/,
    'the fill must come from the palette')
  assert.match(rule[1], /z-index:\s*-1/, 'behind the messages, above the backdrop')
  assert.match(rule[1], /pointer-events:\s*none/, 'and it must never swallow a click')
})
