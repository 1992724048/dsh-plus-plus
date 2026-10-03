/**
 * Report what the browser actually computed for the composer controls.
 *
 * The screenshot showed the model trigger as a narrow black square with the label
 * collapsed — which says the plugin's rules are loading (black is the generic
 * control fill) but something else is winning on width and on the white fill.
 *
 * Rather than guess, this prints, per control: the box, every computed property
 * that matters, and — the part that actually decides it — every rule in the
 * cascade that sets those properties, in document order, with the winner marked.
 *
 * Paste into DevTools on a conversation page and run it.
 */
(() => {
  const card = document.querySelector('[data-composer-card]')
  if (card === null) {
    console.warn('no [data-composer-card] — open a conversation first')
    return
  }

  const targets = [
    ['attach', card.querySelector('button[aria-haspopup="listbox"]')],
    ['permission', card.querySelector('[data-slot="conversation.input.permission"] button')],
    ['model', card.querySelector('[data-slot="conversation.input.model"] button')],
    ['send', card.querySelector('[class*="_trailing"] button:last-of-type')],
  ].filter(([, el]) => el !== null)

  /** Flatten every stylesheet into { selector, style, sheet } triples. */
  const rules = []
  for (const sheet of document.styleSheets) {
    let list
    try {
      list = sheet.cssRules
    } catch {
      continue
    }
    if (list === undefined) continue
    const walk = (items) => {
      for (const rule of items) {
        if (rule.selectorText !== undefined && rule.style !== undefined) {
          rules.push({ selector: rule.selectorText, style: rule.style, sheet: sheet.href ?? 'inline' })
        }
        if (rule.cssRules !== undefined) walk(rule.cssRules)
      }
    }
    walk(list)
  }

  const PROPS = [
    'max-width', 'min-width', 'width', 'height', 'padding',
    'background-color', 'color', 'overflow', 'flex', 'flex-shrink',
  ]

  for (const [name, el] of targets) {
    const rect = el.getBoundingClientRect()
    const computed = getComputedStyle(el)

    console.log(`%c=== ${name} ===`, 'font-weight:bold;font-size:14px')
    console.log('  outerHTML:', el.outerHTML.slice(0, 300))
    console.table([{
      width: Math.round(rect.width * 10) / 10,
      height: Math.round(rect.height * 10) / 10,
      ...Object.fromEntries(PROPS.map(p => [p, computed[p]])),
    }])

    // Every rule that touches this element and sets one of the properties above,
    // in document order — the last one with equal specificity wins.
    const hits = []
    for (const rule of rules) {
      let matches = false
      try {
        matches = el.matches(rule.selectorText)
      } catch {
        continue
      }
      if (!matches) continue
      const set = {}
      for (const p of PROPS) {
        const value = rule.style.getPropertyValue(p)
        if (value !== '') {
          set[p] = value
            + (rule.style.getPropertyPriority(p) === 'important' ? ' !important' : '')
        }
      }
      if (Object.keys(set).length > 0) {
        hits.push({
          selector: rule.selectorText.slice(0, 70),
          specificity: specificityOf(rule.selectorText, el),
          ...set,
          sheet: String(rule.sheet).split('/').slice(-1)[0].slice(0, 40),
        })
      }
    }
    hits.sort((a, b) => a.specificity - b.specificity)
    console.table(hits)
  }

  /** A crude specificity count, enough to explain who beats whom. */
  function specificityOf(selector, el) {
    try {
      const probe = document.createElement('div')
      // Count via a throwaway match against progressively simpler selectors.
      const parts = selector.split(',')[0].trim()
      if (el.matches(parts)) {
        const ids = (parts.match(/#[\w-]+/g) ?? []).length
        const classes = (parts.match(/\.[\w-]+/g) ?? []).length
          + (parts.match(/\[[^\]]+\]/g) ?? []).length
          + (parts.match(/:(?!:)[\w-]+/g) ?? []).length
        const tags = (parts.match(/(^|[\s>+~])[a-z][\w-]*/gi) ?? []).length
        void probe
        return ids * 100 + classes * 10 + tags
      }
      return -1
    } catch {
      return -1
    }
  }
})()
