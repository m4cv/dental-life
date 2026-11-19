// CI render smoke test: opens the production build in headless Chrome (software WebGL),
// starts a game and checks that the real three.js scene is actually rendering the character.
// Screenshots go to smoke-output/ and are also printed (base64 JPEG) into the log so the render
// can be inspected from the run log alone.
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
const tools = await context.newPage() // blank page used only for image analysis

const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

const printJpeg = (name, base64) => {
  console.log(`JPEG_B64_START ${name}`)
  for (let i = 0; i < base64.length; i += 3000) console.log(`B64 ${base64.slice(i, i + 3000)}`)
  console.log(`JPEG_B64_END ${name}`)
}

/** Fraction of pixels in a region (fractions of width/height) that satisfy a colour test. */
async function colourShare(png, region, testSource) {
  return tools.evaluate(
    async ({ b64, region, testSource }) => {
      const img = new Image()
      img.src = `data:image/png;base64,${b64}`
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const x0 = Math.floor(region[0] * c.width)
      const y0 = Math.floor(region[1] * c.height)
      const w = Math.floor((region[2] - region[0]) * c.width)
      const h = Math.floor((region[3] - region[1]) * c.height)
      const data = ctx.getImageData(x0, y0, w, h).data
      const test = new Function('r', 'g', 'b', `return (${testSource})`)
      let n = 0
      for (let i = 0; i < data.length; i += 4) if (test(data[i], data[i + 1], data[i + 2])) n++
      return n / (data.length / 4)
    },
    { b64: png.toString('base64'), region, testSource },
  )
}

/** Share of pixels that differ noticeably between two screenshots. */
async function diffShare(a, b) {
  return tools.evaluate(
    async ({ a, b }) => {
      const load = async (s) => {
        const img = new Image()
        img.src = `data:image/png;base64,${s}`
        await img.decode()
        const c = document.createElement('canvas')
        c.width = img.width
        c.height = img.height
        const ctx = c.getContext('2d')
        ctx.drawImage(img, 0, 0)
        return ctx.getImageData(0, 0, c.width, c.height).data
      }
      const [da, db] = await Promise.all([load(a), load(b)])
      let n = 0
      for (let i = 0; i < da.length; i += 4) {
        if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 60) n++
      }
      return n / (da.length / 4)
    },
    { a: a.toString('base64'), b: b.toString('base64') },
  )
}

/** Tile screenshots into one JPEG contact sheet (rendered by the browser). */
async function contactSheet(shots, columns) {
  const html = `<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(${columns},390px);gap:4px">${shots
    .map((s) => `<img style="width:390px;display:block" src="data:image/png;base64,${s.toString('base64')}">`)
    .join('')}</body>`
  await tools.setViewportSize({ width: columns * 394, height: 900 })
  await tools.setContent(html)
  await tools.waitForFunction(() => [...document.images].every((i) => i.complete))
  return tools.screenshot({ type: 'jpeg', quality: 62, fullPage: true })
}

await page.goto(URL)
await page.getByRole('heading', { name: 'Dental Life' }).waitFor()
await page.screenshot({ path: `${OUT}/1-menu.png` })
check('menu renders', true)

await page.getByRole('button', { name: 'New Game' }).tap()
await page.locator('canvas').waitFor({ timeout: 30000 })
check('New Game mounts a real <canvas> (lazy three.js chunk loaded)', true)

// ---- preview panel is real and wired -------------------------------------------------------
const panel = page.getByTestId('char-preview')
await panel.waitFor({ timeout: 10000 })
for (const id of ['anim-idle', 'anim-walk', 'anim-run', 'view-front', 'view-side', 'view-back', 'view-face', 'view-orbit']) {
  if ((await page.getByTestId(id).count()) !== 1) check(`preview button ${id} exists`, false)
}
const pressed = async (id) => (await page.getByTestId(id).getAttribute('aria-pressed')) === 'true'
check('default preview is Walk + Orbit', (await pressed('anim-walk')) && (await pressed('view-orbit')))
const box = await page.getByTestId('anim-idle').boundingBox()
check('touch targets are at least 44 px tall', box !== null && box.height >= 44, `${box?.height}px`)

await page.waitForTimeout(3000)
const orbitA = await page.screenshot()
await page.waitForTimeout(2000)
const orbitB = await page.screenshot()
check('scene is animating (two screenshots 2 s apart differ)', Buffer.compare(orbitA, orbitB) !== 0)

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

// ---- character is actually drawn, with the right outfit colours ----------------------------
const select = async (id, wait) => {
  await page.getByTestId(id).tap()
  await page.waitForTimeout(wait)
}
const VIEW_WAIT = 7000
const POSE_WAIT = 5000

await select('anim-idle', POSE_WAIT)
await select('view-front', VIEW_WAIT)
check('Idle + Front buttons switch state', (await pressed('anim-idle')) && (await pressed('view-front')) && !(await pressed('anim-walk')))
const frontIdle = await page.screenshot({ path: `${OUT}/2-front-idle.png` })
await page.waitForTimeout(1500)
const frontIdle2 = await page.screenshot()

// regions are fractions of the screenshot: [x0, y0, x1, y1]
const coatWhite = await colourShare(frontIdle, [0.36, 0.36, 0.64, 0.6], 'Math.min(r,g,b)>=200 && Math.max(r,g,b)-Math.min(r,g,b)<=30')
const hijab = await colourShare(frontIdle, [0.4, 0.1, 0.6, 0.24], 'r>=150 && r<=240 && g>=105 && g<=210 && b>=105 && b<=210 && r>g+10 && r>b+10 && Math.abs((g-b))<=18')
const skin = await colourShare(frontIdle, [0.43, 0.12, 0.57, 0.22], 'r>=170 && r<=245 && g>=105 && g<=195 && b>=80 && b<=165 && r>g+22 && g>b+12')
const flower = await colourShare(frontIdle, [0.3, 0.1, 0.7, 0.3], 'r>=185 && g<=120 && b>=80 && b<=175 && r>g+80')
console.log(`info  colour shares: coat white ${(coatWhite * 100).toFixed(1)} %, hijab ${(hijab * 100).toFixed(1)} %, skin ${(skin * 100).toFixed(1)} %, flower pink ${(flower * 100).toFixed(2)} %`)
check('white lab coat is visible in the centre of the screen', coatWhite > 0.08)
check('dusty-rose hijab is visible around the head', hijab > 0.12)
check('skin tone is visible in the face area', skin > 0.04)
check('pink flower accessory is visible', flower > 0.0002)

await select('anim-walk', POSE_WAIT)
const frontWalk = await page.screenshot({ path: `${OUT}/3-front-walk.png` })
await select('anim-run', POSE_WAIT)
const frontRun = await page.screenshot({ path: `${OUT}/4-front-run.png` })

const dIdle = await diffShare(frontIdle, frontIdle2)
const dWalk = await diffShare(frontIdle, frontWalk)
const dRun = await diffShare(frontIdle, frontRun)
console.log(`info  pixel difference vs idle: idle→idle ${(dIdle * 100).toFixed(2)} %, walk ${(dWalk * 100).toFixed(2)} %, run ${(dRun * 100).toFixed(2)} %`)
check('Walk and Run visibly change the pose (idle is steady)', dWalk > dIdle * 1.5 && dRun > dIdle * 1.5 && dRun > 0.004)

await select('anim-walk', POSE_WAIT)
await select('view-side', VIEW_WAIT)
const sideWalk = await page.screenshot({ path: `${OUT}/5-side-walk.png` })
await select('anim-idle', POSE_WAIT)
await select('view-back', VIEW_WAIT)
const backIdle = await page.screenshot({ path: `${OUT}/6-back-idle.png` })
await select('view-face', VIEW_WAIT)
const faceShot = await page.screenshot({ path: `${OUT}/7-face.png` })
await select('view-orbit', 800)
check('all camera buttons respond', await pressed('view-orbit'))

printJpeg('sheet', (await contactSheet([frontIdle, frontWalk, frontRun, sideWalk, backIdle, faceShot], 3)).toString('base64'))
const faceJpeg = await (async () => {
  await tools.setViewportSize({ width: 390, height: 844 })
  await tools.setContent(`<body style="margin:0"><img style="width:390px;display:block" src="data:image/png;base64,${faceShot.toString('base64')}"></body>`)
  await tools.waitForFunction(() => [...document.images].every((i) => i.complete))
  return tools.screenshot({ type: 'jpeg', quality: 80, fullPage: true })
})()
printJpeg('face', faceJpeg.toString('base64'))

check('no console errors / page errors', errors.length === 0, errors.join(' || '))

await browser.close()
const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
