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
  assert.match(shared[1], /background:\s*#fff/, 'that rule must carry the white fill')
  assert.match(shared[1], /padding:\s*0 12px/, 'and the padding the host was overriding')
  assert.match(shared[1], /max-width:\s*340px/, 'and a width generous enough for a permission mode')
  assert.match(shared[1], /height:\s*var\(--pp-composer-control-size\)/, 'and the shared control height')

  // No rule may style a trigger through an attribute only one of them carries.
  assert.doesNotMatch(css, /button\[aria-haspopup="menu"\][^{]*\{[^}]*background/,
    'the permission trigger carries no aria-haspopup, so a menu-anchored rule misses it')

  // The attach button keeps listbox and must not be caught by the white rule.
  assert.doesNotMatch(css, /button\[aria-haspopup="listbox"\][^{]*\{[^}]*background:\s*#fff/,
    'the attach button must keep the accent fill')

  // One white fill and one white hover, shared — so the two cannot drift apart.
  assert.equal([...css.matchAll(/background:\s*#fff/g)].length, 1, 'the white fill must be declared once')
  const hovers = [...css.matchAll(/\[class\*="_modes"\] button:hover[^{]*\{([^}]*)\}/g)].map(m => m[1])
  assert.ok(hovers.length > 0, 'the triggers need a hover of their own')
  for (const block of hovers) assert.match(block, /background:\s*#ededed/)
})

test('the model trigger may shrink, and clips what does not fit', async () => {
  // The host already handles "the name does not fit": a ResizeObserver on the
  // control groups sets --dsh-composer-model-text-display to none on the row when
  // they cannot share a line, swapping the name for a bare icon.
  //
  // An earlier version fought that mechanism instead of using it, and produced the
  // visible bug this now guards: max-width:none plus flex:none plus a label pinned
  // to display:inline and flex-shrink:0 left nothing able to shrink and nothing
  // able to clip, so the text ran straight outside the button.
  //
  // So the contract is the opposite of what that version assumed: the trigger must
  // stay shrinkable, and the box must clip.
  const { css } = await featureOf('composer')

  const model = /\[data-composer-card\] \[data-slot="conversation\.input\.model"\] button\s*\{\s*max-width:\s*([^;]+);([^}]*)\}/.exec(css)
  assert.ok(model, 'the model trigger must override the shared width')
  assert.match(model[1], /50cqw/, 'a share of the row, not unbounded — it must not crowd out send')
  assert.match(model[2], /min-width:\s*0/, 'and min-width:0 so shrinking stays possible')
  assert.doesNotMatch(model[2], /flex:\s*none/,
    'flex:none stops the label collapsing to zero width and defeats the host\'s own fallback')

  // The shared rule must clip, so a label that cannot shrink is bounded by the box.
  const shared = /\[class\*="_modes"\] button,\s*\[data-composer-card\] \[data-slot="conversation\.input\.model"\] button\s*\{([^}]*)\}/.exec(css)
  assert.ok(shared, 'the shared trigger rule must exist')
  assert.match(shared[1], /overflow:\s*hidden/,
    'the trigger must clip; without it the text runs outside the button')

  // The host's compact-mode pair stays intact, so the fallback can still engage.
  const compact = /\[data-composer-card\] \[data-slot="conversation\.input\.model"\] button\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
  const vars = [...css.matchAll(/--dsh-composer-model-(text|icon)-display:\s*(\w+)/g)]
    .map(m => [m[1], m[2]])
  const text = vars.find(([name]) => name === 'text')?.[1]
  const icon = vars.find(([name]) => name === 'icon')?.[1]
  assert.equal(text, 'block', 'the name must be shown by default')
  assert.equal(icon, 'none', 'and the icon hidden, so the host can swap them')
  void compact
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
