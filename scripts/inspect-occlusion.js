/**
 * Locate whatever is occluding the bottom of the conversation scroller.
 *
 * The user reports that message text cannot scroll into the region behind the
 * composer, as though a background covered it. The bundle has 23 `mask-image`
 * rules and 64 `position: sticky|fixed` rules, so guessing which one is at fault
 * is not viable — this script has the browser answer instead.
 *
 * Paste the whole thing into DevTools on the conversation page and run it. It
 * prints every element between the scroller and the composer that paints
 * something, plus every mask and sticky in that stack, so the culprit can be
 * named rather than inferred.
 */
(() => {
  const composer = document.querySelector('[data-composer-card]')
  if (composer === null) {
    console.warn('no [data-composer-card] on this page — open a conversation first')
    return
  }

  // Walk up from the composer to the conversation root, recording each level.
  const stack = []
  for (let node = composer; node !== null && node !== document.body; node = node.parentElement) {
    stack.push(node)
  }
  stack.push(document.body)

  const describe = node => {
    const style = getComputedStyle(node)
    return {
      el: node,
      tag: node.tagName.toLowerCase(),
      classes: typeof node.className === 'string' ? node.className : '(none)',
      data: Object.fromEntries(
        [...node.attributes].filter(a => a.name.startsWith('data-')).map(a => [a.name, a.value]),
      ),
      background: style.backgroundColor,
      backgroundImage: style.backgroundImage === 'none' ? 'none' : 'set',
      backdropFilter: style.backdropFilter === 'none' ? 'none' : style.backdropFilter,
      maskImage: style.maskImage === 'none' ? 'none' : style.maskImage,
      position: style.position,
      overflowY: style.overflowY,
      zIndex: style.zIndex,
      rect: (({ x, y, width, height }) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(width), h: Math.round(height) }))(node.getBoundingClientRect()),
    }
  }

  console.log('%c— composer stack (composer first, then up) —', 'font-weight:bold')
  for (const node of stack) console.table([describe(node)])

  // Anything that paints and overlaps the composer's own box, from any branch.
  const composerRect = composer.getBoundingClientRect()
  console.log('%c— elements overlapping the composer, by paint area —', 'font-weight:bold')
  const overlapping = []
  for (const node of document.querySelectorAll('*')) {
    const style = getComputedStyle(node)
    const paints = style.backgroundColor !== 'rgba(0, 0, 0, 0)'
      || style.backgroundImage !== 'none'
      || (style.backdropFilter !== 'none' && style.backdropFilter !== '')
      || (style.maskImage !== 'none' && style.maskImage !== '')
    if (!paints) continue
    const rect = node.getBoundingClientRect()
    if (rect.height === 0 || rect.width === 0) continue
    const intersects = !(rect.right < composerRect.left || rect.left > composerRect.right
      || rect.bottom < composerRect.top || rect.top > composerRect.bottom)
    if (!intersects) continue
    const area = rect.width * rect.height
    overlapping.push({ ...describe(node), area: Math.round(area) })
  }
  overlapping.sort((a, b) => b.area - a.area)
  console.table(overlapping.slice(0, 25))

  // The scroller, and whether its bottom is actually reachable.
  console.log('%c— scroll containers —', 'font-weight:bold')
  const scrollers = []
  for (const node of stack) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) scrollers.push(node)
  }
  for (const node of scrollers) {
    const style = getComputedStyle(node)
    console.table([{
      classes: typeof node.className === 'string' ? node.className : '(none)',
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
      atBottom: Math.abs(node.scrollHeight - node.clientHeight - node.scrollTop) < 2,
      maskImage: style.maskImage === 'none' ? 'none' : style.maskImage,
      maskSize: style.maskSize,
      maskRepeat: style.maskRepeat,
      paddingBottom: style.paddingBottom,
    }])
  }

  console.log('%c— filters, which create a containing block and can clip —', 'font-weight:bold')
  console.table(stack.map(node => {
    const style = getComputedStyle(node)
    return {
      classes: typeof node.className === 'string' ? node.className : '(none)',
      filter: style.filter,
      backdropFilter: style.backdropFilter,
      clipPath: style.clipPath,
      contain: style.contain,
      isolation: style.isolation,
      transform: style.transform === 'none' ? 'none' : 'set',
    }
  }).filter(row => row.filter !== 'none' || row.backdropFilter !== 'none'
    || row.clipPath !== 'none' || row.contain !== 'none' || row.transform !== 'none'))
})()
