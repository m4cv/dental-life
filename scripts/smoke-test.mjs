// CI render smoke test: opens the production build in headless Chrome (software WebGL),
// starts a game and checks that the real three.js scene is actually rendering the character.
// Screenshots go to smoke-output/ and are also printed (base64 JPEG) into the log so the render
// can be inspected from the run log alone.
import fs from 'node:fs'
import { chromium } from 'playwright-core'
import { RUN, WALK, pilotStick } from './pilot-law.mjs'

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
async function contactSheet(shots, columns, tile = 390) {
  const html = `<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(${columns},${tile}px);gap:4px">${shots
    .map((s) => `<img style="width:${tile}px;display:block" src="data:image/png;base64,${s.toString('base64')}">`)
    .join('')}</body>`
  await tools.setViewportSize({ width: columns * (tile + 4), height: 900 })
  await tools.setContent(html)
  await tools.waitForFunction(() => [...document.images].every((i) => i.complete))
  return tools.screenshot({ type: 'jpeg', quality: 62, fullPage: true })
}

// Stage 2 character inspector (still available at ?preview=1): regression coverage for the character
await page.goto(`${URL}?preview=1`)
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

// =============================================================================================
// Stage 3: the playable scene and the touch controls, driven with real multi-touch events
// =============================================================================================
console.log('\n--- Stage 3: touch controls in the courtyard test set (?scene=courtyard, phone held sideways, 844×390) ---')
// Software rendering is slow, so this part runs at 1x pixel density (4x fewer pixels) to get more
// simulated seconds per real second. The simulation clamps each frame to 0.5 s, so slow frames
// still advance the game.
const W = 844
const H = 390
const context3 = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
const p3 = await context3.newPage()
p3.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[stage3] ${m.text()}`)
})
p3.on('pageerror', (e) => errors.push(`[stage3] pageerror: ${e.message}`))
const cdp = await context3.newCDPSession(p3)
const touchEvent = (type, points) =>
  cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map(([x, y, id]) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })),
  })

const readDebug = async () => {
  const el = p3.getByTestId('player-debug')
  if ((await el.count()) === 0) return null
  const text = await el.innerText()
  const m = text.match(/x (-?[\d.]+) z (-?[\d.]+) · ([\d.]+) m\/s\s+cam (\d+)° ([\d.]+) m/)
  return m ? { x: +m[1], z: +m[2], speed: +m[3], cam: +m[4], dist: +m[5], text } : null
}
const until = async (pred, ms) => {
  const t0 = Date.now()
  let d = null
  while (Date.now() - t0 < ms) {
    d = await readDebug()
    if (d && pred(d)) return d
    await p3.waitForTimeout(300)
  }
  return d
}
const fmt = (d) => (d ? d.text.replace(/\s+/g, ' ') : 'no read-out')
const angleDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180)

await p3.goto(`${URL}?scene=courtyard`)
await p3.getByRole('heading', { name: 'Dental Life' }).waitFor()
// the main menu has to fit a landscape phone without scrolling (also on a small 640×360 one)
const menuFits = async () => {
  const b = await p3.getByRole('button', { name: 'New Game' }).boundingBox()
  const t = await p3.getByRole('heading', { name: 'Dental Life' }).boundingBox()
  const f = await p3.getByText(/^Stage \d/).boundingBox()
  const vw = p3.viewportSize().width
  const vh = p3.viewportSize().height
  const inside = (r) => !!r && r.x >= 0 && r.y >= 0 && r.x + r.width <= vw && r.y + r.height <= vh
  return inside(b) && inside(t) && inside(f) && !(b.y < t.y + t.height && b.x < t.x + t.width && b.x + b.width > t.x)
}
check('main menu fits the 844×390 landscape screen (title, New Game and footer all visible, nothing overlapping)', await menuFits())
await p3.setViewportSize({ width: 640, height: 360 })
check('main menu also fits a small 640×360 landscape screen', await menuFits())
await p3.setViewportSize({ width: W, height: H })
const menuShot = await p3.screenshot({ path: `${OUT}/s3-0-menu.png` })
await p3.getByRole('button', { name: 'New Game' }).tap()
await p3.locator('canvas').waitFor({ timeout: 30000 })
await p3.getByTestId('touch-controls').waitFor({ timeout: 15000 })
check('landscape: no "turn your phone" prompt is shown', (await p3.getByTestId('rotate-prompt').count()) === 0)
const have = async (id) => (await p3.getByTestId(id).count()) === 1
check(
  'touch overlay, joystick, Run and Recenter buttons exist',
  (await have('touch-controls')) && (await have('joystick')) && (await have('btn-run')) && (await have('btn-recenter')),
)
check('the Stage 2 preview panel is not shown in the playable game', (await p3.getByTestId('char-preview').count()) === 0)
check('first-run hint is visible', await have('controls-hint'))
const runBox = await p3.getByTestId('btn-run').boundingBox()
const recBox = await p3.getByTestId('btn-recenter').boundingBox()
check('Run and Recenter are at least 44 px', !!runBox && !!recBox && runBox.width >= 44 && runBox.height >= 44 && recBox.width >= 44 && recBox.height >= 44, `${runBox?.width}px / ${recBox?.width}px`)
const joyBox = await p3.getByTestId('joystick').boundingBox()
check('joystick rests in the bottom-left corner', !!joyBox && joyBox.x < 100 && joyBox.y + joyBox.height > H * 0.7 && joyBox.y + joyBox.height <= H, `${joyBox?.x?.toFixed(0)}, ${joyBox?.y?.toFixed(0)}`)
check('joystick is 121 px wide: under a third of the screen height', !!joyBox && Math.abs(joyBox.width - 121) <= 1 && joyBox.width < H / 3, `${joyBox?.width}px`)
check('Run and Recentre sit in the bottom-right corner, stacked, inside the screen', !!runBox && !!recBox && runBox.x > W * 0.75 && runBox.x + runBox.width <= W && runBox.y + runBox.height <= H && recBox.y + recBox.height < runBox.y, `run ${runBox?.x?.toFixed(0)},${runBox?.y?.toFixed(0)} recentre ${recBox?.x?.toFixed(0)},${recBox?.y?.toFixed(0)}`)
const diagBox = await p3.getByTestId('diagnostics').boundingBox()
const menuBtn = await p3.getByRole('button', { name: 'Back to main menu' }).boundingBox()
check('the read-out panel does not cover the Recentre button or the Menu button', !!diagBox && !!recBox && !!menuBtn && diagBox.y + diagBox.height < recBox.y && menuBtn.x + menuBtn.width < diagBox.x, `panel bottom ${((diagBox?.y ?? 0) + (diagBox?.height ?? 0)).toFixed(0)}, recentre top ${recBox?.y?.toFixed(0)}`)
const hintBox = await p3.getByTestId('controls-hint').boundingBox()
const overlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
check('the first-run hint does not overlap the joystick or the buttons', !!hintBox && !!joyBox && !!runBox && !!recBox && !overlap(hintBox, joyBox) && !overlap(hintBox, runBox) && !overlap(hintBox, recBox))

const start = await until((d) => Math.abs(d.z - 8) < 0.3 && d.cam === 180, 60000)
check('player starts at the spawn point facing north (x 0, z 8, camera 180°)', !!start && Math.abs(start.x) < 0.3 && Math.abs(start.z - 8) < 0.3 && start.cam === 180 && start.speed < 0.2, fmt(start))
await p3.waitForTimeout(1500)
const shotStart = await p3.screenshot({ path: `${OUT}/s3-1-start.png` })

// ---- 1. walk: left thumb on the joystick, pushed forward ----
await touchEvent('touchStart', [[110, 300, 1]])
await touchEvent('touchMove', [[110, 280, 1]])
await touchEvent('touchMove', [[110, 240, 1]])
check('joystick becomes active under the thumb', (await p3.getByTestId('joystick').getAttribute('data-active')) === 'true')
const walking = await until((d) => d.z < start.z - 1.5, 90000)
check('stick forward walks the character north (-z), straight', !!walking && walking.z < start.z - 1.5 && Math.abs(walking.x - start.x) < 0.4, fmt(walking))
const walkSpeed = await until((d) => d.speed >= 1.2, 20000)
check('walking speed is about 1.45 m/s', !!walkSpeed && walkSpeed.speed >= 1.2 && walkSpeed.speed <= 1.7, fmt(walkSpeed))
const shotWalk = await p3.screenshot({ path: `${OUT}/s3-2-walking.png` })
check('the scene changes while walking', Buffer.compare(shotStart, shotWalk) !== 0 && (await diffShare(shotStart, shotWalk)) > 0.01)

// ---- 2. release: joystick returns, she stops ----
await touchEvent('touchEnd', [])
check('joystick returns to rest on release', (await p3.getByTestId('joystick').getAttribute('data-active')) === 'false')
const stopped = await until((d) => d.speed < 0.2, 40000)
check('she stops after the thumb is lifted', !!stopped && stopped.speed < 0.2, fmt(stopped))

// ---- 3. run toggle ----
await p3.getByTestId('btn-run').tap()
check('Run button toggles on', (await p3.getByTestId('btn-run').getAttribute('aria-pressed')) === 'true')
await touchEvent('touchStart', [[110, 300, 1]])
await touchEvent('touchMove', [[110, 240, 1]])
const running = await until((d) => d.speed >= 3.2, 90000)
check('running reaches about 3.6 m/s', !!running && running.speed >= 3.2 && running.speed <= 3.75, fmt(running))
const shotRun = await p3.screenshot({ path: `${OUT}/s3-3-running.png` })

// ---- 4. collision: keep pushing north into the building ----
const wall = await until((d) => d.z < -10.4 && d.speed < 0.3, 120000)
check('the north building stops her (z about -10.7) while the stick is still held', !!wall && wall.z > -10.9 && wall.z < -10.5 && wall.speed < 0.3, fmt(wall))
await touchEvent('touchEnd', [])
await p3.getByTestId('btn-run').tap()
check('Run button toggles off', (await p3.getByTestId('btn-run').getAttribute('aria-pressed')) === 'false')
const shotWall = await p3.screenshot({ path: `${OUT}/s3-4-wall.png` })

// ---- 5. camera drag on the right half ----
const camBefore = (await readDebug()).cam
await touchEvent('touchStart', [[600, 200, 5]])
for (const x of [620, 640, 660, 680, 700]) await touchEvent('touchMove', [[x, 200, 5]])
await touchEvent('touchEnd', [])
const turned = await until((d) => angleDiff(d.cam, camBefore) > 20, 30000)
check('dragging the right half turns the camera by the drag distance (about 31°)', !!turned && angleDiff(turned.cam, camBefore) > 20 && angleDiff(turned.cam, camBefore) < 45, `${camBefore}° → ${turned?.cam}°`)
check('dragging to the right turns the view to the right (compass heading goes down, 180° → about 148°)', !!turned && turned.cam < camBefore && turned.cam > camBefore - 45, `${camBefore}° → ${turned?.cam}°`)
const shotLook = await p3.screenshot({ path: `${OUT}/s3-5-look.png` })

// ---- 6. recenter ----
await p3.getByTestId('btn-recenter').tap()
const centred = await until((d) => angleDiff(d.cam, 180) < 6, 30000)
check('Recenter swings the camera back behind her', !!centred && angleDiff(centred.cam, 180) < 6, fmt(centred))

// ---- 7. camera-relative steering: turn the camera, push forward, she slides along the wall ----
await touchEvent('touchStart', [[600, 200, 5]])
for (const x of [620, 640, 660, 680, 700]) await touchEvent('touchMove', [[x, 200, 5]])
await touchEvent('touchEnd', [])
await until((d) => angleDiff(d.cam, 180) > 20, 30000)
const slideStart = await readDebug()
await touchEvent('touchStart', [[110, 300, 1]])
await touchEvent('touchMove', [[110, 240, 1]])
const slid = await until((d) => d.x > slideStart.x + 1.0, 90000)
await touchEvent('touchEnd', [])
check('forward follows the camera: she slides east along the wall and does not enter it', !!slid && slid.x > slideStart.x + 1.0 && slid.z >= -10.8, `${fmt(slideStart)} → ${fmt(slid)}`)

// ---- 8. pinch zoom with two fingers on the right half ----
const zoomBefore = (await readDebug()).dist
await touchEvent('touchStart', [[520, 180, 1]])
await touchEvent('touchStart', [[520, 180, 1], [620, 180, 2]])
for (const k of [20, 40, 60, 80]) await touchEvent('touchMove', [[520 - k, 180, 1], [620 + k * 0.5, 180, 2]])
await touchEvent('touchEnd', [])
const zoomedIn = await until((d) => d.dist < zoomBefore - 0.5, 30000)
check('spreading two fingers zooms the camera in', !!zoomedIn && zoomedIn.dist < zoomBefore - 0.5, `${zoomBefore} m → ${zoomedIn?.dist} m`)
await touchEvent('touchStart', [[470, 180, 1]])
await touchEvent('touchStart', [[470, 180, 1], [760, 180, 2]])
for (const k of [30, 60, 90, 120]) await touchEvent('touchMove', [[470 + k * 0.4, 180, 1], [760 - k * 0.6, 180, 2]])
await touchEvent('touchEnd', [])
const zoomedOut = await until((d) => d.dist > zoomedIn.dist + 0.5, 30000)
check('pinching two fingers together zooms the camera out', !!zoomedOut && zoomedOut.dist > zoomedIn.dist + 0.5, `${zoomedIn?.dist} m → ${zoomedOut?.dist} m`)
const shotZoom = await p3.screenshot({ path: `${OUT}/s3-6-zoom.png` })
check('two-finger gestures did not scroll or zoom the page', (await p3.evaluate(() => [window.scrollX, window.scrollY, window.visualViewport.scale])).join() === '0,0,1')

// ---- 9. keyboard fallback ----
const keyStart = await readDebug()
await p3.keyboard.down('ArrowDown')
const back = await until((d) => d.z > keyStart.z + 0.8, 60000)
await p3.keyboard.up('ArrowDown')
check('keyboard fallback: ArrowDown walks backwards (away from the camera direction)', !!back && back.z > keyStart.z + 0.8, `${fmt(keyStart)} → ${fmt(back)}`)

// ---- 10. turning the phone upright shows the rotate prompt; turning it back removes it ----
await p3.setViewportSize({ width: 390, height: 844 })
await p3.getByTestId('rotate-prompt').waitFor({ timeout: 10000 })
const promptBox = await p3.getByTestId('rotate-prompt').boundingBox()
check('portrait: a "Turn your phone sideways" prompt covers the whole screen', !!promptBox && promptBox.width >= 389 && promptBox.height >= 843 && (await p3.getByText('Turn your phone sideways').isVisible()))
const shotPortrait = await p3.screenshot({ path: `${OUT}/s3-7-portrait-prompt.png` })
await p3.setViewportSize({ width: W, height: H })
await p3.waitForTimeout(500)
check('turning back to landscape removes the prompt', (await p3.getByTestId('rotate-prompt').count()) === 0)
const joyBack = await p3.getByTestId('joystick').boundingBox()
check('after rotating back the joystick is again in the bottom-left corner at 121 px', !!joyBack && joyBack.x < 100 && joyBack.y > H * 0.5 && Math.abs(joyBack.width - 121) <= 1, `${joyBack?.x?.toFixed(0)}, ${joyBack?.y?.toFixed(0)} ${joyBack?.width}px`)
const afterTurn = await readDebug()
await touchEvent('touchStart', [[110, 300, 1]])
await touchEvent('touchMove', [[110, 240, 1]])
const stillWalks = await until((d) => d.speed > 0.8, 40000)
await touchEvent('touchEnd', [])
check('the joystick still works after rotating', !!stillWalks && stillWalks.speed > 0.8, `${fmt(afterTurn)} → ${fmt(stillWalks)}`)

// ---- 11. leaving and starting again resets the player ----
await p3.getByRole('button', { name: 'Back to main menu' }).tap()
await p3.getByRole('heading', { name: 'Dental Life' }).waitFor()
await p3.getByRole('button', { name: 'New Game' }).tap()
await p3.locator('canvas').waitFor({ timeout: 30000 })
const again = await until((d) => Math.abs(d.z - 8) < 0.3 && d.cam === 180, 60000)
check('a new game starts again at the spawn point with no leftover input', !!again && Math.abs(again.x) < 0.3 && again.speed < 0.2, fmt(again))
check('Run is off in a new game', (await p3.getByTestId('btn-run').getAttribute('aria-pressed')) === 'false')

printJpeg('sheet3', (await contactSheet([menuShot, shotStart, shotWalk, shotRun, shotWall, shotLook, shotZoom, shotPortrait], 2, 560)).toString('base64'))

// =============================================================================================
// Stage 4: the home. Walk through the rooms with the on-screen stick, do the morning routine
// step by step, then leave through the front door.
// =============================================================================================
console.log('\n--- Stage 4: the home alone (?scene=home, 844×390) ---')
const context4 = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
const p4 = await context4.newPage()
p4.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[stage4] ${m.text()}`)
})
p4.on('pageerror', (e) => errors.push(`[stage4] pageerror: ${e.message}`))
const cdp4 = await context4.newCDPSession(p4)
const touch4 = (type, points) =>
  cdp4.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map(([x, y, id]) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })),
  })
const read4 = async () => {
  const el = p4.getByTestId('player-debug')
  if ((await el.count()) === 0) return null
  const text = await el.innerText()
  const m = text.match(/x (-?[\d.]+) z (-?[\d.]+) · ([\d.]+) m\/s\s+cam (\d+)° ([\d.]+) m/)
  return m ? { x: +m[1], z: +m[2], speed: +m[3], cam: +m[4], dist: +m[5], text } : null
}
const fmt4 = (d) => (d ? `x ${d.x} z ${d.z} cam ${d.cam}°` : 'no read-out')
/** Opens a scene (default: the home alone, ?scene=home) with extra query parameters, starts a game and waits for the read-out. */
const openHome = async (query = '', scene = 'home') => {
  const qs = [scene ? `scene=${scene}` : '', query.replace(/^\?/, '')].filter(Boolean).join('&')
  await p4.goto(`${URL}${qs ? '?' + qs : ''}`)
  await p4.getByRole('heading', { name: 'Dental Life' }).waitFor()
  await p4.getByRole('button', { name: 'New Game' }).tap()
  await p4.locator('canvas').waitFor({ timeout: 30000 })
  await p4.getByTestId('touch-controls').waitFor({ timeout: 15000 })
  const t0 = Date.now()
  let d = null
  while (Date.now() - t0 < 60000) {
    d = await read4()
    if (d && (d.x !== 0 || d.z !== 0)) return d
    await p4.waitForTimeout(300)
  }
  return d
}

// ---- the pilot: steers the on-screen stick (analog) toward a point, like a thumb would ----
const STICK = { x: 110, y: 300, r: 51 }
let held = false
const stick4 = async (sx, sy) => {
  if (!held) {
    await touch4('touchStart', [[STICK.x, STICK.y, 1]])
    held = true
  }
  await touch4('touchMove', [[STICK.x + sx * STICK.r, STICK.y - sy * STICK.r, 1]])
}
const letGo = async () => {
  if (held) {
    await touch4('touchEnd', [])
    held = false
  }
}
/** Pushes the stick toward (tx, tz) with strength m (0..1), given the camera heading from the read-out. */
const steer = async (d, tx, tz, m) => {
  const dx = tx - d.x
  const dz = tz - d.z
  const dist = Math.hypot(dx, dz) || 1
  const yaw = (d.cam * Math.PI) / 180
  const fx = Math.sin(yaw)
  const fz = Math.cos(yaw)
  await stick4(((dz * fx - dx * fz) / dist) * m, ((dx * fx + dz * fz) / dist) * m)
}
const walkTo = async (tx, tz, { tol = 0.25, slow = false, ms = 45000, run = false } = {}) => {
  const t0 = Date.now()
  let d = null
  while (Date.now() - t0 < ms) {
    d = await read4()
    if (!d) {
      await p4.waitForTimeout(100)
      continue
    }
    const dist = Math.hypot(tx - d.x, tz - d.z)
    if (dist <= tol) {
      await letGo()
      return d
    }
    const [sx, sy] = pilotStick(d, tx, tz, { tol, cap: slow ? 0.6 : 1, top: run ? RUN : WALK })
    await stick4(sx, sy)
    await p4.waitForTimeout(90)
  }
  await letGo()
  console.log(`info  walkTo(${tx}, ${tz}) gave up at ${fmt4(d)}`)
  return null
}
/** Keeps pushing toward a point for `ms` (used to lean on a closed door). */
const pushToward = async (tx, tz, ms, { settle = false } = {}) => {
  // with `settle`, `ms` is the least time to push; she keeps pushing (up to six times as long) until she has stopped against something,
  // so a slow machine (the game runs slower than real time below two frames a second) does not end the push before she gets there
  const t0 = Date.now()
  const limit = settle ? Math.min(ms * 6, 90000) : ms
  let still = 0
  while (Date.now() - t0 < limit) {
    const d = await read4()
    if (d) {
      await steer(d, tx, tz, 1)
      still = d.speed < 0.1 ? still + 1 : 0
      if (settle && Date.now() - t0 >= ms && still >= 3) break
    }
    await p4.waitForTimeout(90)
  }
  await letGo()
}
const route = async (points, opts) => {
  let d = null
  for (const [x, z, o] of points) {
    d = await walkTo(x, z, { ...opts, ...o })
    if (!d) return null
  }
  return d
}

// ---- reading the HUD ----
const btn = () => p4.getByTestId('btn-interact')
const buttonLabel = async () => {
  try {
    await btn().waitFor({ timeout: 4000 })
    return (await btn().innerText()).trim()
  } catch {
    return null
  }
}
const clock = async () => (await p4.getByTestId('clock').innerText()).replace(/[^\d:]/g, '')
const waitDone = async (id, ms = 30000) => {
  try {
    await p4.locator(`[data-testid="routine-step-${id}"][data-done="true"]`).waitFor({ timeout: ms })
    return true
  } catch {
    return false
  }
}
const shots4 = {}
/** Taps the Interact button at a spot and checks the whole action. */
const doStep = async (id, expectLabel, expectClock, { lockTest = false } = {}) => {
  const label = await buttonLabel()
  check(`${id}: the button says "${expectLabel}" when she stands at the spot`, label === expectLabel, `${label}`)
  if (label !== expectLabel) return false
  check(`${id}: the button is enabled`, await btn().isEnabled())
  if (lockTest) {
    const ibox = await btn().boundingBox()
    const runBox4 = await p4.getByTestId('btn-run').boundingBox()
    const recBox4 = await p4.getByTestId('btn-recenter').boundingBox()
    const joyBox4 = await p4.getByTestId('joystick').boundingBox()
    check(
      'the Interact button sits left of Run and Recenter, clear of the joystick, at least 44 px high',
      !!ibox && ibox.height >= 44 && ibox.x + ibox.width <= runBox4.x && !overlap(ibox, runBox4) && !overlap(ibox, recBox4) && !overlap(ibox, joyBox4) && inside4(ibox),
      JSON.stringify(ibox),
    )
    shots4.button = await p4.screenshot({ path: `${OUT}/s4-2-interact-button.png` })
  }
  await btn().tap()
  let started = true
  try {
    await p4.getByTestId('action-progress').waitFor({ timeout: 5000 })
  } catch {
    started = false
  }
  check(`${id}: tapping it starts the action (progress bar shown)`, started)
  check(`${id}: the button is hidden while she is busy`, (await p4.getByTestId('btn-interact').count()) === 0)
  if (lockTest) {
    // the stick is locked while she acts: leaning on it for a second must not move her
    const spot = { mirror: [5.15, -5.55], dress: [4.5, -3.75], brush: [6.25, -7.7], eat: [4.95, -8.45], pack: [2.45, -8.45] }[id]
    await stick4(0, -1)
    await p4.waitForTimeout(1000)
    await letGo()
    const after = await read4()
    check(`${id}: while she acts the stick is locked (pushing it for a second moves her nowhere)`, !!after && Math.hypot(after.x - spot[0], after.z - spot[1]) < 0.3, `${fmt4(after)} vs spot ${spot}`)
    shots4.act = await p4.screenshot({ path: `${OUT}/s4-3-action.png` })
  }
  const done = await waitDone(id)
  check(`${id}: the checklist ticks it off when the action finishes`, done)
  if (!done) return false
  check(`${id}: the clock moves on to ${expectClock}`, (await clock()) === expectClock, await clock())
  check(`${id}: a short message confirms it`, (await p4.getByTestId('toast').count()) === 1)
  try {
    await btn().waitFor({ state: 'detached', timeout: 3000 })
  } catch {
    /* checked below */
  }
  check(`${id}: the button is gone once the step is done`, (await p4.getByTestId('btn-interact').count()) === 0)
  return true
}
const inside4 = (r) => !!r && r.x >= 0 && r.y >= 0 && r.x + r.width <= W && r.y + r.height <= H

// ---- start: the bedroom ----
const spawn4 = await openHome()
check('the home scene (?scene=home) shows the routine checklist', await p4.getByTestId('routine-hud').isVisible())
check('she starts in the bedroom (x 4.55, z -4.7) with the camera facing west', !!spawn4 && Math.abs(spawn4.x - 4.55) < 0.3 && Math.abs(spawn4.z + 4.7) < 0.3 && spawn4.cam === 270, fmt4(spawn4))
check('no "turn your phone" prompt in landscape', (await p4.getByTestId('rotate-prompt').count()) === 0)
check('the checklist has the five steps plus leaving, none ticked', (await p4.locator('[data-testid^="routine-step-"]').count()) === 6 && (await p4.locator('[data-testid^="routine-step-"][data-done="true"]').count()) === 0)
check('the clock starts at 06:30', (await clock()) === '06:30', await clock())
check('nothing to do at the bed: no Interact button', (await p4.getByTestId('btn-interact').count()) === 0)
{
  const hudBox = await p4.getByTestId('routine-hud').boundingBox()
  const clockBox = await p4.getByTestId('clock').boundingBox()
  const joy = await p4.getByTestId('joystick').boundingBox()
  const diag = await p4.getByTestId('diagnostics').boundingBox()
  const menu = await p4.getByRole('button', { name: 'Back to main menu' }).boundingBox()
  check('checklist and clock are fully on screen', inside4(hudBox) && inside4(clockBox), JSON.stringify(hudBox))
  check('the checklist does not cover the menu button, the clock, the read-out or the joystick', !!menu && !!diag && !!joy && !overlap(hudBox, menu) && !overlap(hudBox, clockBox) && !overlap(hudBox, diag) && !overlap(hudBox, joy))
  check('the clock does not cover the menu button or the read-out', !overlap(clockBox, menu) && !overlap(clockBox, diag))
}
await p4.waitForTimeout(2500)
shots4.bed = await p4.screenshot({ path: `${OUT}/s4-1-bedroom.png` })
check('the bedroom renders something different from the courtyard', (await diffShare(shots4.bed, shotStart)) > 0.05)

// ---- 1. the mirror, a few steps from the bed ----
try {
await walkTo(5.15, -5.35, { tol: 0.45, slow: true })
await doStep('mirror', 'Check mirror', '06:36', { lockTest: true })
// first pictures out early, in case something later goes wrong
printJpeg('sheet4a', (await contactSheet([shots4.bed, shots4.button, shots4.act].filter(Boolean), 2, 560)).toString('base64'))

// ---- 2. get dressed, beside the wardrobe ----
await route([[4.5, -4.8, { tol: 0.35 }], [4.5, -3.95, { tol: 0.4, slow: true }]])
await doStep('dress', 'Get dressed', '06:41')

// ---- 3. through the bedroom door to the front door: it must stay shut until the routine is done ----
const doorRoute = await route([[3.9, -4.9, { tol: 0.3 }], [3.0, -4.9, { tol: 0.3 }], [2.55, -4.5], [2.55, -2.3], [2.5, -1.15, { tol: 0.4 }]])
check('she walks out of the bedroom through the doorway and down the living room to the front door', !!doorRoute && doorRoute.z > -1.6, fmt4(doorRoute))
const doorLabel = await buttonLabel()
check('at the front door the button says "Leave home" but is greyed out', doorLabel === 'Leave home' && (await btn().isDisabled()) && (await btn().getAttribute('data-spot')) === 'door', `${doorLabel}`)
check('and it says why: finish the routine first (2 of 5)', /2 of 5/.test((await p4.getByTestId('interact-note').innerText().catch(() => '')) || ''))
await p4.keyboard.press('e')
await p4.waitForTimeout(700)
check('pressing E does nothing while it is greyed out', (await p4.getByTestId('action-progress').count()) === 0 && !(await p4.getByTestId('routine-step-door').getAttribute('data-done').then((v) => v === 'true')))
await pushToward(2.5, 1.2, 2800)
const leaned = await read4()
check('the shut front door stops her (she cannot walk through it)', !!leaned && leaned.z < -0.15, fmt4(leaned))
shots4.door = await p4.screenshot({ path: `${OUT}/s4-4-front-door-shut.png` })

// ---- 4. dining area: pack the notebook, have breakfast ----
await route([[2.55, -2.4, { tol: 0.35 }], [2.55, -4.9, { tol: 0.35 }], [2.75, -6.1, { tol: 0.3 }], [2.7, -6.95, { tol: 0.3 }], [2.45, -7.2, { tol: 0.3 }], [2.45, -8.2, { tol: 0.3, slow: true }]])
await doStep('pack', 'Pack notebook', '06:44')
// (the way to the table's east end is a channel only about 0.8 m wide between the wall and the chairs, and the doorway
// into the living room is right beside its start: the waypoints keep clear of the doorway before they enter it)
await route([[2.5, -7.5, { tol: 0.3 }], [3.6, -7.0, { tol: 0.3 }], [4.95, -7.0, { tol: 0.3 }], [4.95, -8.1, { tol: 0.3, slow: true }]])
await doStep('eat', 'Have breakfast', '06:56')

// ---- 5. bathroom: brush teeth ----
await route([[5.0, -7.95, { tol: 0.3 }], [5.9, -7.95, { tol: 0.3, slow: true }]])
await doStep('brush', 'Brush teeth', '07:00')
check('all five steps are ticked and the clock reads 07:00', (await p4.locator('[data-testid^="routine-step-"][data-done="true"]').count()) === 5 && (await clock()) === '07:00')
check('leaving is still not ticked', (await p4.getByTestId('routine-step-door').getAttribute('data-done')) === 'false')

// ---- 6. back to the front door, which now opens ----
const backHome = await route([[5.0, -7.95, { tol: 0.3 }], [4.9, -7.0, { tol: 0.3 }], [2.75, -6.9, { tol: 0.3 }], [2.75, -6.0, { tol: 0.3 }], [2.55, -4.9, { tol: 0.35 }], [2.55, -2.3, { tol: 0.35 }], [2.5, -1.15, { tol: 0.4, slow: true }]])
check('she walks all the way back through the house to the front door', !!backHome && backHome.z > -1.6, fmt4(backHome))
const leaveLabel = await buttonLabel()
check('after the routine the "Leave home" button is lit up and enabled', leaveLabel === 'Leave home' && (await btn().isEnabled()), `${leaveLabel}`)
check('and the greyed-out note is gone', (await p4.getByTestId('interact-note').count()) === 0)
if (await btn().isEnabled()) await btn().tap()
await p4.getByTestId('action-progress').waitFor({ timeout: 5000 }).catch(() => {})
check('the door ticks off the checklist once it has opened', await waitDone('door'))
check('and the clock stays at 07:00', (await clock()) === '07:00')
await p4.waitForTimeout(1500)
const out = await walkTo(2.5, 0.95, { tol: 0.3, ms: 25000 })
check('with the door open she can step out onto the porch (z past the wall line)', !!out && out.z > 0.5 && out.z < 1.6, fmt4(out))
await pushToward(2.5, 3.5, 2500)
const porchEnd = await read4()
check('in the home-only scene the porch ends at the edge of the home area', !!porchEnd && porchEnd.z < 1.6 && porchEnd.z > 0.6, fmt4(porchEnd))
await p4.waitForTimeout(800)
shots4.porch = await p4.screenshot({ path: `${OUT}/s4-5-porch.png` })
} catch (e) {
  check('the Stage 4 walk-through finished without an exception', false, String(e.message).split('\n')[0])
}

// ---- 7. a look into every room (spawned straight there with ?at=x,z,deg) ----
const VIEWS = [
  ['living room, looking at the front door', '?at=1.6,-1.0,0'],
  ['living room, looking at the television wall', '?at=2.6,-4.6,40'],
  ['dining area', '?at=3.7,-7.0,180'],
  ['bedroom, bed and curtains', '?at=4.4,-4.2,90'],
  ['dressing table and mirror', '?at=5.1,-5.5,180'],
  ['bathroom (estimated)', '?at=5.95,-7.9,90'],
]
const viewShots = []
try {
  for (const [name, query] of VIEWS) {
    const at = await openHome(query)
    const [qx, qz] = query.slice(4).split(',').map(Number)
    check(`?at= puts her in the ${name}`, !!at && Math.abs(at.x - qx) < 0.3 && Math.abs(at.z - qz) < 0.3, fmt4(at))
    await p4.waitForTimeout(2500)
    viewShots.push(await p4.screenshot({ path: `${OUT}/s4-view-${viewShots.length + 1}.png` }))
  }
  check('the six room views all look different from each other', (await Promise.all(viewShots.slice(1).map((v, i) => diffShare(viewShots[i], v)))).every((x) => x > 0.04))
} catch (e) {
  check('the room views finished without an exception', false, String(e.message).split('\n')[0])
}
printJpeg('sheet4', (await contactSheet([shots4.door, shots4.porch, ...viewShots].filter(Boolean), 2, 560)).toString('base64'))


// =============================================================================================
// Stage 5: the neighbourhood (the default scene): out of the front door, through the yard gate,
// down the lane to Ninety Street. The same pilot steers the on-screen stick.
// =============================================================================================
console.log('\n--- Stage 5: the neighbourhood (default scene, 844×390) ---')
const zoneNow = async () => p4.getByTestId('place').getAttribute('data-zone').catch(() => null)
const waitZone = async (want, ms = 6000) => {
  const t0 = Date.now()
  let z = null
  while (Date.now() - t0 < ms) {
    z = await zoneNow()
    if (z === want) return true
    await p4.waitForTimeout(250)
  }
  console.log(`info  zone is "${z}", wanted "${want}"`)
  return false
}
const shots5 = []
try {
  // a normal new game still starts in the bedroom of the same world
  const s0 = await openHome('', '')
  check('the default scene starts in the bedroom, and the place chip says she is at home', !!s0 && Math.abs(s0.x - 4.55) < 0.3 && Math.abs(s0.z + 4.7) < 0.3 && (await waitZone('home')), fmt4(s0))
  check('the place chip shows the name', ((await p4.getByTestId('place').innerText()) || '').trim() === 'At home')
  check('the morning routine is still there and not ticked', (await p4.locator('[data-testid^="routine-step-"][data-done="true"]').count()) === 0)

  // ?routine=done: the door is already open; she starts on the porch
  const porch = await openHome('?routine=done&at=2.5,0.9,0', '')
  check('?routine=done starts her on the porch with every step ticked', !!porch && Math.abs(porch.z - 0.9) < 0.3 && (await p4.locator('[data-testid^="routine-step-"][data-done="true"]').count()) === 6, fmt4(porch))
  check('on the porch the place chip says "Home yard"', await waitZone('yard'))
  check('there is nothing to interact with on the porch (the door is open)', (await p4.getByTestId('btn-interact').count()) === 0)
  await p4.waitForTimeout(2500)
  shots5.push(await p4.screenshot({ path: `${OUT}/s5-1-porch.png` }))

  // the yard has walls: leaning on the east wall stops her
  await route([[2.5, 2.4, { tol: 0.4 }]])
  await pushToward(12, 1.2, 4500, { settle: true })
  const eastWall = await read4()
  check('the wall around the yard stops her (she walks east across the yard but cannot go out)', !!eastWall && eastWall.x > 7.2 && eastWall.x < 8.4, fmt4(eastWall))
  shots5.push(await p4.screenshot({ path: `${OUT}/s5-2-yard-wall.png` }))

  // through the gate and into the lane
  const gate = await route([[2.5, 2.8, { tol: 0.4 }], [2.5, 4.9, { tol: 0.35 }]])
  check('she walks through the gate in the south wall of the yard', !!gate && gate.z > 4.5, fmt4(gate))
  const lane = await route([[2.5, 7.4, { tol: 0.4 }]])
  check('and the place chip changes to the lane', !!lane && (await waitZone('lane')) && ((await p4.getByTestId('place').innerText()) || '').trim() === 'Neighbourhood lane')
  await p4.waitForTimeout(1200)
  shots5.push(await p4.screenshot({ path: `${OUT}/s5-3-lane.png` }))

  // the buildings on both sides of the lane are solid
  await pushToward(2.5, 20, 3800, { settle: true })
  const south = await read4()
  check('the building across the lane stops her (south side)', !!south && south.z > 9 && south.z < 10.5, fmt4(south))
  await route([[10, 7.4, { tol: 0.5 }]])
  await pushToward(10, -20, 3500, { settle: true })
  const north = await read4()
  check('the walls on the home side stop her (north side)', !!north && north.z > 4.7 && north.z < 6, fmt4(north))

  // run east along the lane to Ninety Street (Run toggles a faster pace)
  // (the read-out is a few tenths of a second old, and at running speed that is metres: a tight waypoint would make the pilot
  // overshoot and circle it, so the run uses loose waypoints and the precise ones come back at walking pace)
  await p4.getByTestId('btn-run').tap()
  const eastLane = await route([[18, 7.6, { tol: 2.2 }], [34, 7.6, { tol: 2.2 }], [50, 7.6, { tol: 2.2 }], [60, 7.6, { tol: 2.2 }]], { ms: 40000, run: true })
  await p4.getByTestId('btn-run').tap()
  check('she runs east along the lane for about 60 m', !!eastLane && eastLane.x > 57, fmt4(eastLane))
  shots5.push(await p4.screenshot({ path: `${OUT}/s5-4-lane-east.png` }))
  const mouth = await route([[66.5, 7.6, { tol: 0.6 }]], { ms: 30000 })
  check('at the end of the lane she steps onto Ninety Street and the chip says so', !!mouth && (await waitZone('boulevard')) && ((await p4.getByTestId('place').innerText()) || '').trim() === 'Ninety Street', fmt4(mouth))
  await p4.waitForTimeout(1200)
  shots5.push(await p4.screenshot({ path: `${OUT}/s5-5-ninety-street.png` }))

  // across the road to the east pavement; the buildings beyond are solid
  const across = await route([[79, 7.6, { tol: 0.8 }], [92.4, 7.6, { tol: 0.6 }]], { ms: 40000 })
  check('she crosses both carriageways and the median to the east pavement', !!across && across.x > 91, fmt4(across))
  await pushToward(110, 7.6, 3000, { settle: true })
  const eastEnd = await read4()
  check('the shops on the east side are solid (she stops at the pavement edge)', !!eastEnd && eastEnd.x > 92 && eastEnd.x < 93.8, fmt4(eastEnd))

  // north along the pavement to the road-works barrier
  await pushToward(92.4, -60, 15000, { settle: true })
  const barrier = await read4()
  check('the barrier closes the road at the north end (she cannot go past it)', !!barrier && barrier.z > -30.1 && barrier.z < -28.9, fmt4(barrier))
  await p4.waitForTimeout(1200)
  shots5.push(await p4.screenshot({ path: `${OUT}/s5-6-barrier.png` }))
} catch (e) {
  check('the Stage 5 walk finished without an exception', false, String(e.message).split('\n')[0])
}
printJpeg('sheet5a', (await contactSheet(shots5.filter(Boolean), 2, 560)).toString('base64'))

// she can walk back in through the open front door
try {
  const back = await openHome('?routine=done&at=2.5,5.6,180', '')
  check('she starts in the lane in front of the gate', !!back && Math.abs(back.z - 5.6) < 0.3, fmt4(back))
  const inside = await route([[2.5, 3.0, { tol: 0.5 }], [2.5, 1.0, { tol: 0.4 }], [2.5, -1.2, { tol: 0.4 }]], { ms: 40000 })
  check('she walks through the gate, across the porch and through the open front door into the living room', !!inside && inside.z < -0.6, fmt4(inside))
  check('and the place chip says she is at home again', await waitZone('home'))
} catch (e) {
  check('walking back inside finished without an exception', false, String(e.message).split('\n')[0])
}

// a look at the neighbourhood from several places
const VIEWS5 = [
  ['the yard and the gate, from the porch', '?routine=done&at=2.5,1.0,0'],
  ['the home lane looking east', '?routine=done&at=4,7.6,90'],
  ['the home lane looking west', '?routine=done&at=40,7.6,270'],
  ['the cross lane looking north', '?routine=done&at=-23,12,180'],
  ['Ninety Street from the west pavement', '?routine=done&at=66,7.6,90'],
  ['Ninety Street from the median, looking north', '?routine=done&at=79,5,180'],
  ['the side of the house and its roof', '?routine=done&at=8.0,-1.0,180'],
  ['the back yard behind the house', '?routine=done&at=4,-9.7,270'],
]
const viewShots5 = []
try {
  for (const [name, query] of VIEWS5) {
    const at = await openHome(query, '')
    const [qx, qz] = query.split('at=')[1].split(',').map(Number)
    check(`?at= puts her at ${name}`, !!at && Math.abs(at.x - qx) < 0.4 && Math.abs(at.z - qz) < 0.4, fmt4(at))
    await p4.waitForTimeout(2500)
    viewShots5.push(await p4.screenshot({ path: `${OUT}/s5-view-${viewShots5.length + 1}.png` }))
  }
  check('the eight neighbourhood views all look different from each other', (await Promise.all(viewShots5.slice(1).map((v, i) => diffShare(viewShots5[i], v)))).every((x) => x > 0.03))
} catch (e) {
  check('the neighbourhood views finished without an exception', false, String(e.message).split('\n')[0])
}
printJpeg('sheet5', (await contactSheet(viewShots5.filter(Boolean), 2, 560)).toString('base64'))

// ================= Stage 6: the car =================
// Two fingers like a real player: the left thumb steers on the stick (id 1), the right thumb holds Gas or Brake (id 2).
const shots6 = []
const speedo = () => p4.getByTestId('speedometer')
const fingers6 = new Map()
const cur6 = { pedal: null, stick: false }
const touchAll6 = (type) => touch4(type, [...fingers6].map(([id, [x, y]]) => [x, y, id]))
const releaseAll6 = async () => {
  if (fingers6.size) await touch4('touchEnd', [])
  fingers6.clear()
  cur6.pedal = null
  cur6.stick = false
}
const pedalCentre = async (id) => {
  const b = await p4.getByTestId(id).boundingBox()
  return [b.x + b.width / 2, b.y + b.height / 2]
}
/** pedal: 'gas' | 'brake' | null; stick: [sx, sy] (-1..1) | null. Changing which fingers are down lifts both and presses again. */
const setDrive = async ({ pedal = null, stick = null } = {}) => {
  if (cur6.pedal !== pedal || cur6.stick !== !!stick) {
    await releaseAll6()
    if (stick) {
      fingers6.set(1, [STICK.x, STICK.y])
      await touchAll6('touchStart')
      cur6.stick = true
    }
    if (pedal) {
      fingers6.set(2, await pedalCentre(pedal === 'gas' ? 'btn-gas' : 'btn-brake'))
      await touchAll6('touchStart')
      cur6.pedal = pedal
    }
  }
  if (stick) {
    fingers6.set(1, [STICK.x + stick[0] * STICK.r, STICK.y - stick[1] * STICK.r])
    await touchAll6('touchMove')
  }
}
const until6 = async (pred, ms, every = 150) => {
  const t0 = Date.now()
  let last = null
  while (Date.now() - t0 < ms) {
    last = await read4()
    if (last && pred(last)) return { hit: true, d: last }
    await p4.waitForTimeout(every)
  }
  return { hit: false, d: last }
}
/** Brakes to a halt and lets go the moment the car has stopped (the brake would back it up), then waits until it is still. */
const stopCar = async (ms = 60000) => {
  await setDrive({ pedal: 'brake' })
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const d = await read4()
    const g = await speedo().getAttribute('data-gear').catch(() => 'D')
    if (d && (d.speed < 0.4 || g === 'R')) break
    await p4.waitForTimeout(100)
  }
  await releaseAll6()
  return (await until6((d) => d.speed < 0.3, 25000)).d
}
const waitLabel = async (want, ms = 10000) => {
  const t0 = Date.now()
  let got = null
  while (Date.now() - t0 < ms) {
    got = await p4.getByTestId('btn-interact').innerText().then((t) => t.trim()).catch(() => null)
    if (got === want) return true
    await p4.waitForTimeout(200)
  }
  console.log(`info  button said "${got}", wanted "${want}"`)
  return false
}
const kmh = async () => Number((await speedo().getAttribute('data-kmh').catch(() => '0')) ?? 0)

try {
  // next to the parked car in the home lane
  const near6 = await openHome('?routine=done&at=9,7.4,0', '')
  check('she starts in the home lane beside the parked car', !!near6 && Math.abs(near6.x - 9) < 0.3 && Math.abs(near6.z - 7.4) < 0.3, fmt4(near6))
  check('the button beside the car says "Get in car"', (await waitLabel('Get in car')) && (await btn().getAttribute('data-spot')) === 'car')
  check('on foot there are no pedals and no speedometer, and Run is there', (await p4.getByTestId('btn-gas').count()) === 0 && (await speedo().count()) === 0 && (await p4.getByTestId('btn-run').count()) === 1)
  await p4.waitForTimeout(2500)
  shots6.push(await p4.screenshot({ path: `${OUT}/s6-1-parked.png` }))

  // walking into the parked car: it is solid
  await pushToward(9, 20, 3500, { settle: true })
  const bumped = await read4()
  check('the parked car is solid (she cannot walk through it)', !!bumped && bumped.z < 8.7, fmt4(bumped))
  await route([[9, 7.9, { tol: 0.3 }]])

  // get in
  await waitLabel('Get in car')
  await btn().tap()
  await speedo().waitFor({ timeout: 10000 }).catch(() => {})
  check('tapping it puts her in the car: the speedometer and both pedals appear and Run is gone', (await speedo().count()) === 1 && (await p4.getByTestId('btn-gas').count()) === 1 && (await p4.getByTestId('btn-brake').count()) === 1 && (await p4.getByTestId('btn-run').count()) === 0)
  check('the speedometer starts at 0 km/h in gear D', (await speedo().getAttribute('data-kmh')) === '0' && (await speedo().getAttribute('data-gear')) === 'D')
  check('the button now says "Get out"', await waitLabel('Get out'))
  const gasBox = await p4.getByTestId('btn-gas').boundingBox()
  const brakeBox = await p4.getByTestId('btn-brake').boundingBox()
  const speedBox = await speedo().boundingBox()
  const joy6 = await p4.getByTestId('joystick').boundingBox()
  const inter6 = await btn().boundingBox()
  check('the pedals fit on the screen and do not overlap each other, the stick, the speedometer or the Get out button', inside4(gasBox) && inside4(brakeBox) && !overlap(gasBox, brakeBox) && !overlap(gasBox, joy6) && !overlap(brakeBox, joy6) && !overlap(gasBox, speedBox) && !overlap(brakeBox, speedBox) && !!inter6 && !overlap(inter6, gasBox) && !overlap(inter6, brakeBox), JSON.stringify({ gasBox, brakeBox, speedBox }))
  check('both pedals are big enough for a thumb (at least 56 px)', gasBox.width >= 56 && gasBox.height >= 56 && brakeBox.width >= 56 && brakeBox.height >= 56)
  await p4.waitForTimeout(2000)
  shots6.push(await p4.screenshot({ path: `${OUT}/s6-2-in-car.png` }))

  // Gas: the car rolls east along the lane
  const before6 = await read4()
  await setDrive({ pedal: 'gas' })
  const rolling = await until6((d) => d.speed > 3 && d.x > before6.x + 3, 90000)
  check('holding Gas drives the car east along the lane (speed rises, x grows)', rolling.hit, fmt4(rolling.d) + ` · ${rolling.d?.speed} m/s`)
  check('the speedometer shows the speed in km/h', (await kmh()) > 5, String(await kmh()))
  check('while the car is moving, Get out is disabled and says to stop first', (await btn().isDisabled()) && ((await p4.getByTestId('interact-note').innerText().catch(() => '')) || '').includes('Stop the car'))
  await stopCar()

  // the south wall of the lane: pressing against it, however hard, the car stays inside the lane.
  // (the lane has a side lane at x 28..34, so only x below 26.5 is watched and the push ends there)
  shots6.push(await p4.screenshot({ path: `${OUT}/s6-3-stopped.png` }))
  await setDrive({ pedal: 'gas', stick: [0.9, 0] })
  let maxZ = -Infinity
  let contactAt = null
  const tWall = Date.now()
  while (Date.now() - tWall < 60000) {
    const d = await read4()
    if (d) {
      if (d.x < 26.5) maxZ = Math.max(maxZ, d.z)
      if (d.z > 9.2 && contactAt === null) contactAt = Date.now()
      if (d.x > 26.5 || (contactAt !== null && Date.now() - contactAt > 3500)) break
    }
    await p4.waitForTimeout(150)
  }
  check('steering right she presses against the wall on the south side of the lane', contactAt !== null, `max z ${maxZ.toFixed(2)}`)
  check('the wall stops her: the car stays inside the lane (z below 10.2) however hard she presses', maxZ > 9 && maxZ < 10.2, `max z ${maxZ.toFixed(2)}`)
  shots6.push(await p4.screenshot({ path: `${OUT}/s6-4-wall.png` }))

  // Brake: slows the car and, once stopped, reverses (gear R)
  await setDrive({ pedal: 'brake' })
  let revSpeed = 0
  const tRev = Date.now()
  while (Date.now() - tRev < 60000) {
    const g = await speedo().getAttribute('data-gear')
    const d = await read4()
    if (g === 'R' && d && d.speed > 0.6) {
      revSpeed = d.speed
      break
    }
    await p4.waitForTimeout(150)
  }
  check('Brake stops the car and then backs it up (the speedometer shows gear R)', revSpeed > 0.6, `${revSpeed} m/s in reverse`)
  await stopCar()

  // steering: the stick turns the car (left = north)
  const lane6 = await read4()
  await setDrive({ pedal: 'gas', stick: [-0.9, 0] })
  const north6 = await until6((d) => d.z < lane6.z - 1.5, 60000)
  check('pushing the stick left turns the car to the left (north) while it drives', north6.hit, `${fmt4(lane6)} → ${fmt4(north6.d)}`)
  await stopCar()

  // stop and get out
  await releaseAll6()
  const still = await until6((d) => d.speed < 0.3, 60000)
  check('letting go of everything lets the car roll to a stop', still.hit, `${still.d?.speed} m/s`)
  check('the button says "Get out" and is enabled once the car has stopped', (await waitLabel('Get out')) && !(await btn().isDisabled()))
  const stopped6 = await read4()
  await btn().tap()
  await p4.waitForFunction(() => !document.querySelector('[data-testid="speedometer"]'), null, { timeout: 15000 }).catch(() => {})
  check('Get out puts her back on foot: the pedals and the speedometer are gone and Run is back', (await speedo().count()) === 0 && (await p4.getByTestId('btn-gas').count()) === 0 && (await p4.getByTestId('btn-run').count()) === 1)
  // the read-out lags by a frame or two: wait until it shows her new place
  const away6 = (d) => Math.hypot(d.x - stopped6.x, d.z - stopped6.z)
  const out6 = (await until6((d) => away6(d) > 0.6, 15000)).d
  check('she is standing next to the car, not inside it', !!out6 && !!stopped6 && away6(out6) > 0.6 && away6(out6) < 3.5, `${fmt4(stopped6)} → ${fmt4(out6)}`)
  check('and the button offers "Get in car" again', await waitLabel('Get in car'))
  await p4.waitForTimeout(1500)
  shots6.push(await p4.screenshot({ path: `${OUT}/s6-5-out.png` }))
} catch (e) {
  check('the Stage 6 first drive finished without an exception', false, String(e.message).split('\n')[0])
}
await releaseAll6().catch(() => {})

// ?drive=1: start in the driver's seat, straight east across Ninety Street to the shops
try {
  const d0 = await openHome('?routine=done&drive=1&car=50,7.6,90', '')
  check('?drive=1 starts her in the driver\'s seat (speedometer and pedals are there)', !!d0 && (await speedo().count()) === 1 && (await p4.getByTestId('btn-gas').count()) === 1, fmt4(d0))
  check('?car= puts the car at x 50 in the lane', !!d0 && Math.abs(d0.x - 50) < 1, fmt4(d0))
  await setDrive({ pedal: 'gas' })
  const crossing = await until6((d) => d.x > 70, 120000)
  check('she drives east along the lane and onto Ninety Street', crossing.hit, fmt4(crossing.d))
  await p4.waitForTimeout(500)
  shots6.push(await p4.screenshot({ path: `${OUT}/s6-6-ninety-street.png` }))
  const shops = await until6((d) => d.x > 91.5 && d.speed < 0.3, 120000)
  check('she crosses the boulevard and the shops on the east side stop the car (x about 92)', shops.hit && shops.d.x < 93.6, fmt4(shops.d))
  await releaseAll6()
} catch (e) {
  check('the Stage 6 east drive finished without an exception', false, String(e.message).split('\n')[0])
}
await releaseAll6().catch(() => {})

// north along Ninety Street to the road-works barrier
try {
  const n0 = await openHome('?routine=done&drive=1&car=72.25,25,180', '')
  check('the car can start on the carriageway heading north', !!n0 && Math.abs(n0.x - 72.25) < 1 && Math.abs(n0.z - 25) < 1, fmt4(n0))
  await setDrive({ pedal: 'gas' })
  const fast = await until6((d) => d.speed > 8, 90000)
  check('on the open road the car reaches a good speed', fast.hit, `${fast.d?.speed} m/s`)
  check('the speedometer reads well above walking speed', (await kmh()) > 25, String(await kmh()))
  shots6.push(await p4.screenshot({ path: `${OUT}/s6-7-fast.png` }))
  const barrier6 = await until6((d) => d.z < -26.5 && d.speed < 0.3, 120000)
  check('the road-works barrier stops the car at the north end (z about -28)', barrier6.hit && barrier6.d.z > -30, fmt4(barrier6.d))
  await releaseAll6()
  await p4.waitForTimeout(1200)
  shots6.push(await p4.screenshot({ path: `${OUT}/s6-8-barrier.png` }))
} catch (e) {
  check('the Stage 6 north drive finished without an exception', false, String(e.message).split('\n')[0])
}
await releaseAll6().catch(() => {})
printJpeg('sheet6', (await contactSheet(shots6.filter(Boolean), 2, 560)).toString('base64'))

check('no console errors / page errors', errors.length === 0, errors.join(' || '))

await browser.close()
const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
