/**
 * Host-side self test.
 *
 * Boots the plugin against a stub `webServer` and drives the font route the way a
 * browser would: real URL, no server-supplied match. Covers the asset serving, the
 * MIME and cache headers, the relative-URL resolution the packages rely on, the
 * traversal guard, and teardown.
 *
 * Run: `node scripts/host-selftest.mjs`
 */

import assert from 'node:assert/strict'

import * as plugin from '../index.js'
import { FONT_ROUTE, assetRoot } from '../src/fonts.js'

const tests = []
const test = (name, fn) => tests.push([name, fn])

/** A stub `webServer` that records the route the plugin registers. */
function createStub() {
  const routes = []
  return {
    routes,
    get(name) {
      return name === 'webServer'
        ? {
            register: route => {
              routes.push(route)
              return () => {
                const index = routes.indexOf(route)
                if (index >= 0) routes.splice(index, 1)
              }
            },
          }
        : undefined
    },
  }
}

/** Drive the registered font route and capture the response. */
async function request(ctx, url) {
  const route = ctx.routes[0]
  assert.ok(route, 'the font route must be registered')
  let status
  let headers
  const chunks = []
  const res = {
    writeHead(code, head) { status = code; headers = head },
    end(body) { if (body !== undefined) chunks.push(body) },
  }
  await route.handler({ url, method: 'GET', headers: {} }, res)
  return { status, headers, body: Buffer.concat(chunks) }
}

/** Every woff2 file starts with the ASCII tag `wOF2`. */
function assertWoff2(body, label) {
  assert.equal(body.subarray(0, 4).toString('latin1'), 'wOF2', `${label} must be a real woff2`)
}

// ── tests ────────────────────────────────────────────────────────────────────

test('plugin entry declares its identity and takes no hard dependency', () => {
  assert.equal(plugin.name, 'plus-plus')
  assert.deepEqual(plugin.inject, [], 'inject must stay empty: a named service would hold the fiber PENDING')
})

test('registers exactly one prefix route and tears it down', () => {
  const ctx = createStub()
  const dispose = plugin.apply(ctx)
  assert.equal(ctx.routes.length, 1)
  assert.equal(ctx.routes[0].kind, 'prefix')
  assert.equal(ctx.routes[0].path, FONT_ROUTE)
  dispose()
  assert.equal(ctx.routes.length, 0, 'the route must be removed on teardown')
})

test('both font packages resolve to an asset root', () => {
  assert.ok(assetRoot('jetbrains-mono'), '@fontsource/jetbrains-mono must resolve')
  assert.ok(assetRoot('harmonyos-sans-sc'), 'harmonyos-sans-webfont-splitted must resolve')
  assert.equal(assetRoot('not-installed'), undefined, 'an unknown family must answer undefined')
})

test('serves a JetBrains Mono shard with the right content type', async () => {
  const ctx = createStub()
  plugin.apply(ctx)
  const { status, headers, body } = await request(
    ctx,
    `${FONT_ROUTE}/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2`,
  )
  assert.equal(status, 200)
  assert.equal(headers['content-type'], 'font/woff2')
  assert.match(headers['cache-control'], /immutable/, 'the assets must be cacheable')
  assert.ok(body.length > 0, 'the shard must have content')
  assertWoff2(body, 'latin-400')
})

test('serves a HarmonyOS stylesheet with its unicode-range intact', async () => {
  const ctx = createStub()
  plugin.apply(ctx)
  const { status, headers, body } = await request(ctx, `${FONT_ROUTE}/harmonyos-sans-sc/Regular.css`)
  assert.equal(status, 200)
  assert.match(headers['content-type'], /text\/css/)
  const text = body.toString('utf8')
  assert.match(text, /@font-face/, 'the package stylesheet must reach the browser intact')
  assert.match(text, /unicode-range/, 'its unicode-range shards must survive')
})

test('a relative url inside a served stylesheet resolves to a served shard', async () => {
  // This is the contract that makes the whole design work: each package is served
  // from its own root, so the `url()` its own stylesheets already contain keep
  // resolving. If the roots ever move, these two tests fail.
  for (const [family, stylesheet, pattern] of [
    ['jetbrains-mono', 'latin-400.css', /url\((\.\/files\/[^)]+\.woff2)\)/],
    ['harmonyos-sans-sc', 'Regular.css', /url\("(\.\/Regular\/[^"]+\.woff2)"\)/],
  ]) {
    const ctx = createStub()
    plugin.apply(ctx)
    const css = await request(ctx, `${FONT_ROUTE}/${family}/${stylesheet}`)
    assert.equal(css.status, 200, `${stylesheet} must be served`)
    const href = pattern.exec(css.body.toString('utf8'))?.[1]
    assert.ok(href, `${stylesheet} must reference a shard`)
    const shard = await request(ctx, `${FONT_ROUTE}/${family}/${href.replace(/^\.\//, '')}`)
    assert.equal(shard.status, 200, `${href} must resolve over the same route`)
    assertWoff2(shard.body, href)
  }
})

test('refuses path traversal out of the package root', async () => {
  const ctx = createStub()
  plugin.apply(ctx)
  for (const url of [
    `${FONT_ROUTE}/jetbrains-mono/../../../package.json`,
    `${FONT_ROUTE}/jetbrains-mono/%2e%2e/%2e%2e/package.json`,
    `${FONT_ROUTE}/harmonyos-sans-sc/../../package.json`,
    // Encoded slash, which must not survive into a usable path either.
    `${FONT_ROUTE}/jetbrains-mono/..%2f..%2fpackage.json`,
  ]) {
    const { status } = await request(ctx, url)
    assert.ok(status === 400 || status === 403 || status === 404, `${url} must not be served (got ${status})`)
  }
})

test('refuses a non-font extension, an unknown family and a missing file', async () => {
  const ctx = createStub()
  plugin.apply(ctx)
  assert.equal((await request(ctx, `${FONT_ROUTE}/jetbrains-mono/package.json`)).status, 403)
  assert.equal((await request(ctx, `${FONT_ROUTE}/nope/x.woff2`)).status, 404)
  assert.equal((await request(ctx, `${FONT_ROUTE}/jetbrains-mono/missing.woff2`)).status, 404)
})

test('ignores the query string', async () => {
  const ctx = createStub()
  plugin.apply(ctx)
  const { status } = await request(ctx, `${FONT_ROUTE}/jetbrains-mono/latin-400.css?v=123`)
  assert.equal(status, 200)
})

// ── runner ───────────────────────────────────────────────────────────────────

let failures = 0
for (const [name, fn] of tests) {
  try {
    await fn()
    process.stdout.write(`  ok  ${name}\n`)
  } catch (error) {
    failures += 1
    process.stdout.write(`FAIL  ${name}\n      ${error?.message ?? error}\n`)
  }
}
process.stdout.write(`\n${tests.length - failures}/${tests.length} passed\n`)
process.exit(failures === 0 ? 0 : 1)
