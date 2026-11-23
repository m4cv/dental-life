// Stage 10 browser check (about 8 minutes): the dental clinic. The guidance card from the corridor to the double door, getting
// ready (wash, mask, gloves, in that order, each moving the clock on), the greyed-out stool until she is ready, a whole clinic
// session on a Tuesday, the getting-ready starting over for the next session on a Thursday, a day without clinic sessions, and
// pictures of the door sign, the room, the sink and the dental stool. Run on a branch by putting [clinic] in a commit message.
// Opens the production build (npx vite preview --port 4173) in headless Chrome with software WebGL, 844×390 like a phone on its side.
import fs from 'node:fs'
import { chromium } from 'playwright-core'
import { RUN, WALK, pilotStick } from './pilot-law.mjs'

const URL = process.env.SMOKE_URL ?? 'http://127.0.0.1:4173/'
const OUT = 'smoke-output'
const W = 844
const H = 390
fs.mkdirSync(OUT, { recursive: true })

const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}
const printJpeg = (name, base64) => {
  console.log(`JPEG_B64_START ${name}`)
  for (let i = 0; i < base64.length; i += 3000) console.log(`B64 ${base64.slice(i, i + 3000)}`)
  console.log(`JPEG_B64_END ${name}`)
}

for (let t0 = Date.now(); ; ) {
  try {
    if ((await fetch(URL)).ok) break
  } catch {
    /* not up yet */
  }
  if (Date.now() - t0 > 30000) throw new Error('the preview server did not start')
  await new Promise((r) => setTimeout(r, 500))
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
const p4 = await context.newPage()
const tools = await context.newPage()
const errors = []
p4.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
p4.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
const cdp = await context.newCDPSession(p4)
const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y, id]) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) })

async function contactSheet(shots, columns, tile = 560) {
  const html = `<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(${columns},${tile}px);gap:4px">${shots
    .map((s) => `<img style="width:${tile}px;display:block" src="data:image/png;base64,${s.toString('base64')}">`)
    .join('')}</body>`
  await tools.setViewportSize({ width: columns * (tile + 4), height: 900 })
  await tools.setContent(html)
  await tools.waitForFunction(() => [...document.images].every((i) => i.complete))
  return tools.screenshot({ type: 'jpeg', quality: 62, fullPage: true })
}

const read4 = async () => {
  const el = p4.getByTestId('player-debug')
  if ((await el.count()) === 0) return null
  const m = (await el.innerText()).match(/x (-?[\d.]+) z (-?[\d.]+) · ([\d.]+) m\/s\s+cam (\d+)° ([\d.]+) m/)
  return m ? { x: +m[1], z: +m[2], speed: +m[3], cam: +m[4], dist: +m[5] } : null
}
const fmt4 = (d) => (d ? `x ${d.x} z ${d.z} cam ${d.cam}°` : 'no read-out')
/** Opens the neighbourhood (the default scene) with the query and starts a game. `chip` = a day chip to tap in the menu first. */
const open = async (query, chip = null) => {
  await p4.goto(`${URL}${query ? '?' + query.replace(/^\?/, '') : ''}`)
  await p4.getByRole('heading', { name: 'Dental Life' }).waitFor()
  if (chip) await p4.getByTestId(`day-${chip}`).tap()
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
const STICK = { x: 110, y: 300, r: 51 }
let held = false
const stick = async (sx, sy) => {
  if (!held) {
    await touch('touchStart', [[STICK.x, STICK.y, 1]])
    held = true
  }
  await touch('touchMove', [[STICK.x + sx * STICK.r, STICK.y - sy * STICK.r, 1]])
}
const letGo = async () => {
  if (held) {
    await touch('touchEnd', [])
    held = false
  }
}
const walkTo = async (tx, tz, { tol = 0.3, ms = 90000 } = {}) => {
  const t0 = Date.now()
  let d = null
  while (Date.now() - t0 < ms) {
    d = await read4()
    if (!d) {
      await p4.waitForTimeout(100)
      continue
    }
    if (Math.hypot(tx - d.x, tz - d.z) <= tol) {
      await letGo()
      return d
    }
    const [sx, sy] = pilotStick(d, tx, tz, { tol, cap: 1, top: WALK })
    await stick(sx, sy)
    await p4.waitForTimeout(90)
  }
  await letGo()
  console.log(`info  walkTo(${tx}, ${tz}) gave up at ${fmt4(d)}`)
  return null
}
const route = async (points, opts) => {
  let d = null
  for (const [x, z] of points) {
    d = await walkTo(x, z, opts)
    if (!d) return null
  }
  return d
}
void RUN

const btn = () => p4.getByTestId('btn-interact')
const label = async () => {
  try {
    await btn().waitFor({ timeout: 6000 })
    return (await btn().innerText()).trim()
  } catch {
    return null
  }
}
const clockText = async () => ((await p4.getByTestId('clock').innerText()).match(/\d\d:\d\d/) ?? [''])[0]
const weekday = async () => (await p4.getByTestId('weekday').innerText().catch(() => '')).trim()
const zone = async () => p4.getByTestId('place').getAttribute('data-zone').catch(() => null)
const waitZone = async (want, ms = 8000) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    if ((await zone()) === want) return true
    await p4.waitForTimeout(250)
  }
  console.log(`info  zone is "${await zone()}", wanted "${want}"`)
  return false
}
const shots = []
const shoot = async (name) => shots.push(await p4.screenshot({ path: `${OUT}/c-${name}.png` }))
const waitToast = async (re, ms = 150000) => {
  try {
    await p4.waitForFunction((src) => new RegExp(src).test(document.querySelector('[data-testid="toast"]')?.textContent ?? ''), re.source, { timeout: ms })
    return true
  } catch {
    return false
  }
}


// these read what is on the screen and answer at once (null / empty) when the element is not there, instead of waiting 30 s for it
const attr = async (id, name) => {
  const el = p4.getByTestId(id)
  return (await el.count()) === 0 ? null : el.getAttribute(name)
}
const text = async (id) => {
  const el = p4.getByTestId(id)
  return (await el.count()) === 0 ? '' : ((await el.innerText()) || '').replace(/\s+/g, ' ').trim()
}
const chip = (id) => attr(`prep-${id}`, 'data-done')
const chips = async () => `${await chip('wash')}/${await chip('mask')}/${await chip('gloves')}`
const note = () => text('interact-note')
const hudText = () => text('class-hud')
const hudPhase = () => attr('class-hud', 'data-phase')
/** Presses the Interact button; when it is not there (at 1 FPS she can overshoot the spot) steps back onto the spot and tries again. */
const press = async (x, z) => {
  for (let k = 0; k < 4; k++) {
    try {
      await btn().tap({ timeout: 6000 })
      return true
    } catch (e) {
      console.log(`info  the button could not be pressed at ${fmt4(await read4())} (${String(e.message).split('\n')[0]}); stepping onto ${x}, ${z}`)
      await walkTo(x, z, { tol: 0.15, ms: 20000 })
      await p4.waitForTimeout(600)
    }
  }
  return false
}
/** Walks to a spot until the button shows (stepping closer once if it does not). */
const toSpot = async (x, z, path = []) => {
  await route([...path, [x, z]], { tol: 0.2 })
  let l = await label()
  if (!l) {
    await walkTo(x, z, { tol: 0.12, ms: 20000 })
    l = await label()
  }
  return l
}

// A quick look (set CLI_DIAG=1, or put [diag] in the commit message): inside the clinic, at the sink and at the stool.
if (process.env.LEC_DIAG || process.env.CLI_DIAG) {
  const d = await open('routine=done&day=tue&at=-183.4,-488.1,-90')
  await p4.waitForTimeout(4000)
  console.log(`info  diag: at ${fmt4(d)} now ${fmt4(await read4())}, zone ${await zone()}`)
  console.log(`info  diag: screen text ${JSON.stringify(((await p4.evaluate(() => document.body.innerText)) || '').replace(/\s+/g, ' ').slice(0, 600))}`)
  await shoot('diag-door')
  await walkTo(-185.8, -481.8, { tol: 0.2 })
  await p4.waitForTimeout(1500)
  await shoot('diag-sink')
  printJpeg('diag', (await contactSheet(shots, 2)).toString('base64'))
  await browser.close()
  process.exit(0)
}

try {
  // ---- 1. Tuesday morning: from the corridor to the door, and the room ----
  console.log('\n--- 1. Tuesday: the corridor, the door, the room ---')
  const a = await open('routine=done&day=tue&at=-172,-488.1,-90')
  check('Tuesday: the clock says Tue 07:00', !!a && (await weekday()) === 'Tue' && (await clockText()) === '07:00', `${await weekday()} ${await clockText()}`)
  check('she starts in the corridor', await waitZone('corridor'))
  await p4.getByTestId('class-hud').waitFor({ timeout: 8000 }).catch(() => {})
  const card = await hudText()
  check('the card names the clinic session (Fixed & Removable Prosthodontics 3, Clinic, 08:00) and says to follow the corridor west', /Fixed Prosthodontics 3 & Removable Prosthodontics 3/.test(card) && /Clinic/.test(card) && /08:00/.test(card) && /corridor/i.test(card) && (await hudPhase()) === 'walk', card)
  check('the three checklist chips are there and none is ticked', (await p4.getByTestId('prep-chips').count()) === 1 && (await chips()) === 'false/false/false', await chips())
  const cb = await p4.getByTestId('class-hud').boundingBox()
  const clk = await p4.getByTestId('clock').boundingBox()
  const list = await p4.getByTestId('routine-hud').boundingBox()
  const over = (x, y) => !!x && !!y && x.x < y.x + y.width && x.x + x.width > y.x && x.y < y.y + y.height && x.y + x.height > y.y
  check('the card (with its chips) is on the screen and covers neither the clock nor the checklist', !!cb && cb.x >= 0 && cb.x + cb.width <= W && cb.y + cb.height <= H && !over(cb, clk) && !over(cb, list), JSON.stringify(cb))
  await shoot('1-corridor-card')
  const atDoor = await route([[-179, -488.1]])
  check('along the corridor to the clinic door', !!atDoor)
  await shoot('2-clinic-door')
  const inDoor = await route([[-183.4, -488.1]], { tol: 0.25 })
  check('through the double door into the clinic (the place chip says so)', !!inDoor && (await waitZone('clinic')), fmt4(inDoor))
  await p4.waitForTimeout(1500)
  check('the card now says she is in the clinic and the first thing is to wash her hands', (await hudPhase()) === 'prep' && /Wash your hands/i.test(await hudText()), await hudText())
  await shoot('3-clinic-inside')

  // ---- 2. the stool is greyed out until she is ready ----
  console.log('\n--- 2. the stool before she is ready ---')
  const seatL = await toSpot(-186.3, -493.75, [[-184, -490], [-184, -493.75]])
  check('the stool offers "Attend: Fixed Prosthodontics 3 & Removable Prosthodontics 3", greyed out', seatL === 'Attend: Fixed Prosthodontics 3 & Removable Prosthodontics 3' && !(await btn().isEnabled()), `${seatL}`)
  check('and says to get ready first, with what is left', /Get ready first/.test(await note()) && /wash your hands/.test(await note()), await note())
  await shoot('4-stool-greyed')

  // ---- 3. wash, mask, gloves ----
  console.log('\n--- 3. getting ready ---')
  const c0 = await clockText()
  const w = await toSpot(-185.8, -481.8, [[-184, -486]])
  check('at the sink the button says "Wash hands"', w === 'Wash hands' && (await btn().isEnabled()), `${w}`)
  await press(-185.8, -481.8)
  await p4.getByTestId('action-progress').waitFor({ timeout: 8000 })
  await shoot('5-washing')
  check('washing: a done message with the checklist (1 of 3)', await waitToast(/Wash your hands — done\. 1 of 3 done/, 60000))
  check('the first chip is ticked and the clock moved on', (await chips()) === 'true/false/false' && (await clockText()) > c0, `${await chips()} ${c0} → ${await clockText()}`)
  const m = await toSpot(-188.4, -481.8)
  check('at the mask box the button says "Put on a mask"', m === 'Put on a mask' && (await btn().isEnabled()), `${m}`)
  await press(-188.4, -481.8)
  check('the mask goes on (2 of 3)', await waitToast(/Put on a mask — done\. 2 of 3 done/, 60000))
  const g = await toSpot(-190.8, -481.8)
  check('at the glove box the button says "Put on gloves"', g === 'Put on gloves' && (await btn().isEnabled()), `${g}`)
  await press(-190.8, -481.8)
  await p4.getByTestId('action-progress').waitFor({ timeout: 8000 }).catch(() => {})
  await shoot('6-gloves')
  check('the gloves go on: ready for the session', await waitToast(/Put on gloves — done\. Ready for the session/, 60000))
  check('all three chips are ticked and the card sends her to her stool', (await chips()) === 'true/true/true' && (await hudPhase()) === 'seat', `${await chips()} ${await hudPhase()}`)
  check('the clock is a few minutes past 07:00 (about four)', (await clockText()) >= '07:04' && (await clockText()) < '07:30', await clockText())

  // ---- 4. a whole session ----
  console.log('\n--- 4. a whole clinic session on the stool ---')
  const s = await toSpot(-186.3, -493.75, [[-184, -486], [-184, -493.75]])
  check('the stool now offers the session, enabled, with a note that she will wait for 08:00', s === 'Attend: Fixed Prosthodontics 3 & Removable Prosthodontics 3' && (await btn().isEnabled()) && /08:00/.test(await note()), `${s} · ${await note()}`)
  await press(-186.3, -493.75)
  await p4.getByTestId('action-progress').waitFor({ timeout: 8000 })
  await p4.waitForFunction(() => Number(document.querySelector('[data-testid="action-progress"]')?.getAttribute('data-progress') ?? 0) >= 0.35, null, { timeout: 150000 }).catch(() => {})
  const mid = await read4()
  check('she is on the stool (within 15 cm) and the clock has moved on', !!mid && Math.hypot(mid.x + 186.3, mid.z + 493.75) < 0.15 && (await clockText()) > '07:30', `${fmt4(mid)} ${await clockText()}`)
  await shoot('7-sitting-at-the-unit')
  await p4.waitForTimeout(1500)
  await shoot('8-sitting-later')
  check('the session ends with a message: Clinic, until 12:00, marked present', await waitToast(/Prosthodontics 3.*Clinic.*until 12:00.*marked present/))
  check('the clock stands at 12:00', (await clockText()) === '12:00', await clockText())
  check('the mask and gloves come off after the session: the checklist is gone with nothing more to attend today', (await p4.getByTestId('prep-chips').count()) === 0 && (await hudPhase()) === 'none', `${await chips()} ${await hudPhase()}`)
  await p4.waitForTimeout(800)
  check('the stool is greyed out: no more clinic sessions today', !(await btn().isEnabled().catch(() => true)) && /No more clinic sessions today/.test(await note()), `${await label()} · ${await note()}`)
  check('the card says no more classes today', /No more classes today/.test(await hudText()), await hudText())
  await p4.getByTestId('btn-timetable').tap()
  await p4.getByTestId('timetable-panel').waitFor({ timeout: 8000 })
  check('the timetable shows the Tuesday session as Present, counted as a session (not a lecture)', (await p4.getByTestId('session-tue-fixedremovable').getAttribute('data-state')) === 'present' && /Today \(Tuesday\): 1 sessions? · 1 present · 0 late · 0 missed · 0 to come/.test((await p4.getByTestId('attendance-summary').innerText()) || ''), await p4.getByTestId('attendance-summary').innerText())
  await shoot('9-timetable-tue')
  await p4.getByTestId('btn-timetable-close').tap()

  // ---- 5. Thursday: the second session needs the routine again ----
  console.log('\n--- 5. Thursday: two clinic sessions, then a lecture ---')
  const t = await open('routine=done&prep=done&day=thu&at=-184,-493.75,-90')
  check('Thursday: the clock says Thu, in the clinic, ready (prep=done)', !!t && (await weekday()) === 'Thu' && (await waitZone('clinic')) && (await chips()) === 'true/true/true', `${await weekday()} ${await chips()}`)
  const t1 = await toSpot(-186.3, -493.75)
  check('the stool offers Oral Surgery 1 (08:00–10:00), enabled', t1 === 'Attend: Oral Surgery 1' && (await btn().isEnabled()), `${t1}`)
  await press(-186.3, -493.75)
  check('Oral Surgery 1 is attended and marked present', await waitToast(/Oral Surgery 1.*Clinic.*marked present/))
  check('the clock stands at 10:00', (await clockText()) === '10:00', await clockText())
  await p4.waitForTimeout(800)
  check('the second session (Periodontology 1) is offered but greyed out: she has to get ready again', (await label()) === 'Attend: Periodontology 1' && !(await btn().isEnabled()) && /Get ready first/.test(await note()), `${await label()} · ${await note()}`)
  check('the chips start again from the beginning', (await chips()) === 'false/false/false', await chips())
  await shoot('10-thursday-second')

  // ---- 6. Monday: no clinic ----
  console.log('\n--- 6. Monday: no clinic session ---')
  const mo = await open('routine=done&prep=done&day=mon&at=-184,-493.75,-90')
  check('Monday: in the clinic', !!mo && (await weekday()) === 'Mon' && (await waitZone('clinic')))
  await toSpot(-186.3, -493.75)
  check('the stool is greyed out: no clinic session today', !(await btn().isEnabled().catch(() => true)) && /No clinic session today/.test(await note()), `${await label()} · ${await note()}`)
  await shoot('11-monday')
} catch (e) {
  check('the Stage 10 walk finished without an exception', false, String(e.message).split('\n')[0])
}
await letGo().catch(() => {})
if (shots.length) printJpeg('sheet10', (await contactSheet(shots, 2)).toString('base64'))
check('no console errors / page errors', errors.length === 0, errors.join(' || '))
await browser.close()
const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
