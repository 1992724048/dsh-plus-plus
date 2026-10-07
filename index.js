import { FONT_ROUTE, installFontRoutes } from './src/fonts.js'
import { SESSION_ROUTE, installSessionRoutes } from './src/sessions.js'

export const name = 'plus-plus'
export { FONT_ROUTE, SESSION_ROUTE }
export const inject = []

export function apply(ctx) {
  const disposeFonts = installFontRoutes({ ctx })
  const disposeSessions = installSessionRoutes({ ctx })
  return () => {
    disposeFonts()
    disposeSessions()
  }
}
