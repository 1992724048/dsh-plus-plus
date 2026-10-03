/**
 * Diagnose the composer's vertical alignment and the white-trigger background.
 *
 * Paste into DevTools on a conversation page, scroll the message list a little so
 * it is NOT at the bottom, then run it. It reports, per control: its box, the
 * computed transform, and every background on the element — so the shift and the
 * non-white background can be attributed to a specific declaration rather than
 * guessed at.
 */
(() => {
  const card = document.querySelector('[data-composer-card]')
  if (card === null) {
    console.warn('no [data-composer-card] — open a conversation first')
    return
  }

  /** Controls in the order the user named them. */
  const named = [
    ['attach +', '[data-composer-card] button[aria-haspopup="listbox"] ~ button'],
    ['permission', '[data-composer-card] button[aria-haspopup="listbox"]'],
    ['model', '[data-composer-card] button[aria-haspopup="menu"]'],
    ['send', '[data-composer-card] [class*="_trailing"] button:last-of-type'],
  ]

  console.log('%c— control boxes —', 'font-weight:bold')
  const rows = []
  for (const [name, selector] of named) {
    const el = document.querySelector(selector)
    if (el === null) {
      rows.push({ name, found: false })
      continue
    }
    const rect = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    rows.push({
      name,
      found: true,
      top: Math.round(rect.top * 10) / 10,
      bottom: Math.round(rect.bottom * 10) / 10,
      height: Math.round(rect.height * 10) / 10,
      transform: style.transform,
      position: style.position,
      alignSelf: style.alignSelf,
      verticalAlign: style.verticalAlign,
      background: style.backgroundColor,
    })
  }
  console.table(rows)

  // The row is the flex container that decides vertical placement; its own metrics
  // explain every child's offset.
  console.log('%c— containers —', 'font-weight:bold')
  const containers = [
    ['card', card],
    ['scroll', card.querySelector('[data-input-scroll]')],
    ['row', card.querySelector('[class*="_row"]')],
    ['tools', card.querySelector('[class*="_tools"]')],
    ['modes', card.querySelector('[class*="_modes"]')],
    ['trailing', card.querySelector('[class*="_trailing"]')],
  ].filter(([, el]) => el !== null)
  console.table(containers.map(([name, el]) => {
    const rect = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    return {
      name,
      top: Math.round(rect.top * 10) / 10,
      height: Math.round(rect.height * 10) / 10,
      paddingTop: style.paddingTop,
      paddingBottom: style.paddingBottom,
      gap: style.gap,
      alignItems: style.alignItems,
      transform: style.transform,
    }
  }))

  // Which rule actually wins the background? Walk the cascade in order and report
  // every declaration that sets a background on the element.
  console.log('%c— declarations setting background on permission / model —', 'font-weight:bold')
  for (const [name, selector] of named.slice(1, 3)) {
    const el = document.querySelector(selector)
    if (el === null) continue
    const hits = []
    for (const sheet of document.styleSheets) {
      let rules
      try {
        rules = sheet.cssRules
      } catch {
        continue
      }
      if (rules === undefined) continue
      for (const rule of rules) {
        if (rule.selectorText === undefined || rule.style === undefined) continue
        const bg = rule.style.background || rule.style.backgroundColor
        if (bg === undefined || bg === '') continue
        let matches = false
        try {
          matches = el.matches(rule.selectorText)
        } catch {
          matches = false
        }
        if (matches) {
          hits.push({
            selector: rule.selectorText.slice(0, 80),
            background: bg,
            important: rule.style.getPropertyPriority('background') === 'important'
              || rule.style.getPropertyPriority('background-color') === 'important',
            href: (sheet.href ?? 'inline').split('/').slice(-1)[0],
          })
        }
      }
    }
    console.log(`  ${name}:`, hits)
  }
})()
