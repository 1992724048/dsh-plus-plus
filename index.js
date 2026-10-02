/**
 * DSH Plus Plus — plugin entry (Host half).
 *
 * Currently one feature: serving the bundled fonts to the browser half.
 *
 * Every harness facility is reached through `ctx`, and `inject` is empty. That is
 * deliberate: Cordis withholds services a fiber does not name and keeps the fiber
 * PENDING while a named one is absent, so declaring a dependency would make this
 * plugin inactive on a composition that simply lacks a web server. Since the whole
 * value here is additive, a missing service must degrade this one feature and never
 * the plugin — which is what `ctx.get()` (answers `undefined`) gives.
 *
 * @module index.js
 */

import { FONT_ROUTE, installFontRoutes } from './src/fonts.js'

export const name = 'plus-plus'

/** Re-exported so a composition can see what the plugin mounts. */
export { FONT_ROUTE }

/**
 * No hard service dependency.
 *
 * See the module doc: naming a service in `inject` would hold this fiber PENDING
 * until that service appears, which is wrong for an additive plugin.
 */
export const inject = []

export function apply(ctx) {
  return installFontRoutes({ ctx })
}
