/**
 * What each feature promises: the font stack, the corner sweep, the composer
 * layout, and the surface swap.
 *
 * Every assertion here encodes a decision that came from the user or from reading
 * the host's own CSS, with the reason attached — so a later change has to argue
 * with the reason rather than just with the value.
 */

import assert from 'node:assert/strict'

import { allCss, bootRun, test } from './harness.mjs'

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

  // Three literal colours are allowed and intentional: the pure-white triggers and
  // their hover. Asserting they are the ONLY ones means a new literal has to be
  // argued for rather than slipping in.
  const literals = [...css.matchAll(/:\s*(#[0-9a-f]{3,8})\b/gi)].map(m => m[1].toLowerCase())
  assert.deepEqual([...new Set(literals)].sort(), ['#000', '#ededed', '#fff'],
    `only the pure-white triggers may use literal colours; found ${literals.join(', ')}`)

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

test('the model trigger is not width-capped', async () => {
  // The model name does not fit. Two caps were in the way: the host's own
  // min(360px, 45cqw) on the model trigger, and a max-width of none was needed
  // because the trigger holds name + effort + chevron. Both hosts' labels already
  // ellipsize, so removing the cap gives the name room before that matters.
  const { css } = await featureOf('composer')

  // The generic trigger cap is generous enough for a permission mode.
  const triggers = [...css.matchAll(/button\[aria-haspopup="menu"\]\s*\{([^}]*)\}/g)].map(m => m[1])
  assert.ok(triggers.length > 0, 'the trigger rule must be locatable')
  const capped = triggers.find(block => /max-width:\s*340px/.test(block))
  assert.ok(capped, 'a labelled trigger needs a width that fits a permission mode')

  // The model trigger takes whatever the composer can spare.
  const model = /\[data-composer-card\] \[data-slot="conversation\.input\.model"\] button\s*\{([^}]*)\}/.exec(css)?.[1]
  assert.ok(model, 'the model trigger must have its own rule')
  assert.match(model, /max-width:\s*none/, 'the model trigger must not inherit a width cap')

  // Both keep the shared height and padding, declared once on the common rule.
  const shared = triggers.find(block => /height:\s*var\(--pp-composer-control-size\)/.test(block))
  assert.ok(shared !== undefined, 'the triggers must take the shared height')
  assert.match(shared, /padding-inline:\s*12px/, 'both triggers share one padding')
  assert.doesNotMatch(shared, /min-height/, 'no min-height on the trigger')
})

test('permission and model triggers share one style', async () => {
  // They previously diverged even though both matched the same selector: the
  // permission button fell through to the translucent generic fill while the model
  // one got the white. Now there is exactly one rule declaring the look, so they
  // cannot drift apart again.
  const { css } = await featureOf('composer')

  // Count the declarations that decide the fill: one solid white, one hover.
  const fills = [...css.matchAll(/button\[aria-haspopup="menu"\][^{]*\{([^}]*)\}/g)]
    .map(m => m[1])
    .filter(block => /background:\s*#fff/.test(block))
  assert.equal(fills.length, 1, `the white fill must be declared once, found ${fills.length} times`)
  assert.match(fills[0], /color:\s*#000/, 'black content on white')

  // Neither may be reachable by a rule that treats them differently: no
  // id-based or position-based styling may target one of the two alone.
  const generic = /\[data-composer-card\] :is\(button, \[role="button"\]\)\s*\{([^}]*)\}/.exec(css)?.[1]
  assert.ok(generic !== undefined, 'the generic control rule must exist')
  assert.match(generic, /background:\s*var\(--pp-composer-control\)/,
    'the generic fill must be the palette control value, so only the menu override paints white')

  // The white hover must exist and be the only hover override for the triggers.
  const hovers = [...css.matchAll(/button\[aria-haspopup="menu"\]:hover[^{]*\{([^}]*)\}/g)].map(m => m[1])
  assert.equal(hovers.length, 1, 'the triggers share one hover')
  assert.match(hovers[0], /background:\s*#ededed/)
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

test('permission and model triggers are solid white', async () => {
  const { css } = await featureOf('composer')

  // Literal white, not a palette entry — "pure white" was the instruction, and a
  // themed near-white would drift from it. The content goes black to stay legible.
  //
  // Anchored on aria-haspopup of *menu*, which is what both labelled triggers carry.
  // The attach button carries listbox, so a rule matching listbox as well would
  // paint all four white and make the four identical — which is exactly what
  // happened when the white rule matched both.
  const blocks = [...css.matchAll(/button\[aria-haspopup="menu"\][^{]*\{([^}]*)\}/g)].map(m => m[1])
  assert.ok(blocks.length > 0, 'the menu trigger rule must be locatable')
  const white = blocks.find(block => /background:\s*#fff/.test(block))
  assert.ok(white !== undefined, 'the labelled triggers must be solid white')
  assert.match(white, /color:\s*#000/, 'they need black content on white')

  // The attach button must NOT be caught by the white rule.
  assert.doesNotMatch(css, /button\[aria-haspopup="listbox"\][^{]*\{[^}]*background:\s*#fff/,
    'the attach button carries listbox and must keep the accent fill, not the white one')

  // The generic hover must not win over the white pair, or they would go grey on
  // hover while the other two stayed black.
  const genericHover = /:is\(button, \[role="button"\]\):hover[^{]*\{([^}]*)\}/.exec(css)?.[1]
  assert.ok(genericHover !== undefined, 'the generic control hover must exist')
  assert.match(genericHover, /var\(--pp-composer-hover\)/, 'it should use the palette hover')

  const whiteHover = [...css.matchAll(/aria-haspopup="menu"\]:hover[^{]*\{([^}]*)\}/g)].map(m => m[1])
  assert.ok(whiteHover.length > 0, 'the white triggers need their own hover')
  for (const block of whiteHover) assert.match(block, /background:\s*#ededed/)

  // Order matters: the white rules must come after the *composer-scoped* generic
  // ones. The dock has its own generic rules at the end of the sheet, but they are
  // scoped to the dock's subtree and cannot reach the composer.
  const genericIndex = css.indexOf('[data-composer-card] :is(button, [role="button"]) {')
  const whiteIndex = css.search(/aria-haspopup="menu"\][^{]*\{[^}]*background:\s*#fff/)
  assert.ok(genericIndex >= 0 && whiteIndex > genericIndex,
    'the white triggers must come after the generic control rules, or they lose the cascade')
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

  assert.equal(get('--pp-composer-surface', 'light'), 'rgb(255 255 255 / 50%)',
    'light: the editor is a translucent white')
  assert.equal(get('--pp-composer-surface', 'dark'), '#000', 'dark: the editor is solid black')
  assert.equal(get('--pp-composer-accent', 'light'), '#000', 'light: attach and send are black')
  assert.equal(get('--pp-composer-accent', 'dark'), '#fff', 'dark: attach and send are white')
  assert.ok(get('--pp-composer-control', 'light').includes('/'), 'light: the other controls are translucent')
  assert.equal(get('--pp-composer-control', 'dark'), '#000', 'dark: the other controls are black')
  // The blur is a variable so one declaration covers both: on in light, off in dark.
  assert.notEqual(get('--pp-composer-blur', 'light'), '0px', 'light: the surface is blurred')
  assert.equal(get('--pp-composer-blur', 'dark'), '0px', 'dark: the blur is off, not merely weaker')
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
