// CI render smoke test: opens the production build in headless Chrome (software WebGL),
// starts a game and checks that the real three.js scene is actually rendering.
// Screenshots are written to smoke-output/ and uploaded as a workflow artifact.
import fs from 'node:fs'
import { chromium } from 'playwright-core'

const URL = process.env.SMOKE_URL ?? 'http://127.0.0.1:4173/'
const OUT = 'smoke-output'
fs.mkdirSync(OUT, { recursive: true })

const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      /* server not up yet */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Server at ${url} did not start within ${timeoutMs} ms`)
}

await waitForServer(URL)

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
})
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
})
const page = await context.newPage()

const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

await page.goto(URL)
await page.getByRole('heading', { name: 'Dental Life' }).waitFor()
await page.screenshot({ path: `${OUT}/1-menu.png` })
check('menu renders', true)

await page.getByRole('button', { name: 'New Game' }).tap()
await page.locator('canvas').waitFor({ timeout: 30000 })
check('New Game mounts a real <canvas> (lazy three.js chunk loaded)', true)

await page.waitForTimeout(3000)
const shotA = await page.screenshot({ path: `${OUT}/2-game-a.png` })
await page.waitForTimeout(2000)
const shotB = await page.screenshot({ path: `${OUT}/3-game-b.png` })

// Also print a compressed JPEG into the log (base64) so the render can be inspected from the
// run log alone, without downloading the artifact.
const jpg = (await page.screenshot({ type: 'jpeg', quality: 70 })).toString('base64')
console.log('JPEG_B64_START')
for (let i = 0; i < jpg.length; i += 3000) console.log(`B64 ${jpg.slice(i, i + 3000)}`)
console.log('JPEG_B64_END')

const gl = await page.evaluate(() => {
  const canvas = document.querySelector('canvas')
  const ctx = canvas.getContext('webgl2')
  const ext = ctx?.getExtension('WEBGL_debug_renderer_info')
  return {
    width: canvas.width,
    height: canvas.height,
    version: ctx ? ctx.getParameter(ctx.VERSION) : null,
    renderer: ctx && ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null,
    lost: ctx ? ctx.isContextLost() : null,
  }
})
check('canvas has a live WebGL 2 context', !!gl.version && gl.lost === false, JSON.stringify(gl))
check('canvas has non-zero size', gl.width > 0 && gl.height > 0, `${gl.width}×${gl.height}`)

const diag = await page.getByTestId('diagnostics').innerText()
const fps = Number(diag.match(/(\d+) FPS/)?.[1] ?? 0)
check('render loop is running (FPS meter reports > 0)', fps > 0, diag.replace(/\n/g, ' | '))
check('scene is animating (two screenshots 2 s apart differ)', Buffer.compare(shotA, shotB) !== 0)
check('no console errors / page errors', errors.length === 0, errors.join(' || '))

await browser.close()
const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
