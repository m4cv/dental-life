// Stage 9 browser check (about 6–8 minutes): the timetable, the day chips, the guidance card, the seats of the two lecture
// halls, sitting through lectures with the clock running on, the greyed-out seat on a day without lectures, and pictures
// of the sitting pose and the door signs. Run by hand: Actions → Browser test: lectures (manual).
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
const shoot = async (name) => shots.push(await p4.screenshot({ path: `${OUT}/l-${name}.png` }))
const waitToast = async (re, ms = 40000) => {
  try {
    await p4.waitForFunction((src) => new RegExp(src).test(document.querySelector('[data-testid="toast"]')?.textContent ?? ''), re.source, { timeout: ms })
    return true
  } catch {
    return false
  }
}

try {
  // ---- 1. the menu: day chips; the weekday on the clock ----
  console.log('\n--- 1. the day chips and the timetable ---')
  await p4.goto(URL)
  await p4.getByRole('heading', { name: 'Dental Life' }).waitFor()
  const chips = await p4.locator('[data-testid^="day-"]').count()
  check('the menu has six day chips, Saturday to Thursday', chips === 6)
  check('Saturday is chosen to begin with', (await p4.getByTestId('day-sat').getAttribute('data-active')) === 'true')
  await p4.getByTestId('day-wed').tap()
  check('tapping Wednesday chooses it', (await p4.getByTestId('day-wed').getAttribute('data-active')) === 'true' && (await p4.getByTestId('day-sat').getAttribute('data-active')) === 'false')
  await p4.screenshot({ path: `${OUT}/l-0-menu.png` })

  const d1 = await open('routine=done&at=-160,-466,180', 'mon')
  check('a game started from the menu with Monday chosen shows Mon on the clock, at 07:00 (routine skipped)', !!d1 && (await weekday()) === 'Mon' && (await clockText()) === '07:00', `${await weekday()} ${await clockText()}`)
  await p4.getByTestId('btn-timetable').tap()
  await p4.getByTestId('timetable-panel').waitFor({ timeout: 8000 })
  const monRows = await p4.locator('[data-testid^="session-mon-"]').count()
  check('the timetable opens on today (Monday): four lectures, all "Not started"', monRows === 4 && (await p4.locator('[data-testid^="session-mon-"][data-state="upcoming"]').count()) === 4, `${monRows} rows`)
  check('the summary line counts four lectures to come', /4 lectures · 0 present · 0 late · 0 missed · 4 to come/.test((await p4.getByTestId('attendance-summary').innerText()) || ''), await p4.getByTestId('attendance-summary').innerText())
  await shoot('1-timetable-mon')
  await p4.getByTestId('tab-sun').tap()
  check('the Sunday tab lists three clinic and lab sessions, none of them a lecture', (await p4.locator('[data-testid^="session-sun-"]').count()) === 3 && (await p4.locator('[data-testid^="session-sun-"][data-state="lecture"]').count()) === 0)
  await shoot('2-timetable-sun')
  const box = await p4.getByTestId('timetable-panel').locator('> div').boundingBox()
  check('the panel fits the 844×390 screen', !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= W && box.y + box.height <= H, JSON.stringify(box))
  await p4.getByTestId('btn-timetable-close').tap()
  check('the Close button closes it', (await p4.getByTestId('timetable-panel').count()) === 0)

  // ---- 2. Saturday: the guidance card, the seat in the Grand Hall, sitting through two lectures ----
  console.log('\n--- 2. Saturday in the Grand Hall ---')
  const a = await open('routine=done&day=sat&at=-160,-466,180')
  check('Saturday: the clock says Sat 07:00', !!a && (await weekday()) === 'Sat' && (await clockText()) === '07:00')
  check('outside the building there is no lecture card yet (the route card is the guide)', (await p4.getByTestId('class-hud').count()) === 0)
  const inDoor = await route([[-160, -474], [-160, -481], [-160, -488.1]])
  check('she walks in through the entrance and the lobby into the corridor', !!inDoor && (await waitZone('corridor')), fmt4(inDoor))
  await p4.getByTestId('class-hud').waitFor({ timeout: 8000 }).catch(() => {})
  const card = p4.getByTestId('class-hud')
  const cardText = ((await card.innerText().catch(() => '')) || '').replace(/\s+/g, ' ')
  check('the card names the next lecture (Periodontology 1, Grand Hall, 08:00), the distance and what to do', /Periodontology 1/.test(cardText) && /Grand Hall/.test(cardText) && /08:00/.test(cardText) && /\d+ m/.test(cardText) && /corridor/i.test(cardText), cardText)
  const cbox = await card.boundingBox()
  const diag = await p4.getByTestId('diagnostics').boundingBox()
  const clk = await p4.getByTestId('clock').boundingBox()
  const list = await p4.getByTestId('routine-hud').boundingBox()
  const over = (x, y) => !!x && !!y && x.x < y.x + y.width && x.x + x.width > y.x && x.y < y.y + y.height && x.y + x.height > y.y
  check('the card is on the screen and covers nothing: not the clock, the checklist or the read-out', !!cbox && cbox.x >= 0 && cbox.x + cbox.width <= W && !over(cbox, clk) && !over(cbox, list) && !over(cbox, diag), JSON.stringify(cbox))
  await shoot('3-class-card')

  const atDoor = await route([[-171.5, -488.1]])
  check('along the corridor to the door of the Grand Hall', !!atDoor)
  await shoot('4-corridor-door')
  const inHall = await route([[-171.5, -485.6], [-176.7, -484.95]], { tol: 0.2 })
  check('through the door and along the back aisle to the end of the first row', !!inHall && (await waitZone('hall1')), fmt4(inHall))
  const seatLabel = await label()
  check('the button offers "Attend: Periodontology 1"', seatLabel === 'Attend: Periodontology 1', `${seatLabel}`)
  const note = (await p4.getByTestId('interact-note').innerText().catch(() => '')) || ''
  check('the note says the lecture starts at 08:00 and she will wait', /08:00/.test(note) && /wait/.test(note), note)
  await btn().tap()
  await p4.getByTestId('action-progress').waitFor({ timeout: 8000 })
  check('pressing it starts the lecture: a progress bar with its name', /Attend: Periodontology 1/.test((await p4.getByTestId('action-progress').innerText()) || ''))
  // she walks the last steps into the chair, then sits: wait until the bar is past a third
  await p4.waitForFunction(() => Number(document.querySelector('[data-testid="action-progress"]')?.getAttribute('data-progress') ?? 0) >= 0.35, null, { timeout: 60000 }).catch(() => {})
  const mid = await read4()
  const clockMid = await clockText()
  check('while she sits, the clock has moved on past 07:00 toward 08:00 and beyond', clockMid > '07:10', clockMid)
  check('she is on the chair (within 15 cm of the seat)', !!mid && Math.hypot(mid.x + 176.7, mid.z + 484.42) < 0.15, fmt4(mid))
  await shoot('5-sitting')
  await p4.waitForTimeout(1500)
  await shoot('6-sitting-later')
  check('the lecture ends with a message: it is over, marked present', await waitToast(/Periodontology 1.*marked present/))
  check('the clock stands at 10:00 (the end of the lecture)', (await clockText()) === '10:00', await clockText())
  const next = await label()
  check('the seat now offers the next lecture, Fixed Prosthodontics 3', next === 'Attend: Fixed Prosthodontics 3', `${next}`)
  await shoot('7-after-lecture')
  await p4.getByTestId('btn-timetable').tap()
  await p4.getByTestId('timetable-panel').waitFor({ timeout: 8000 })
  check('the timetable shows Periodontology 1 as Present', (await p4.getByTestId('session-sat-perio1').getAttribute('data-state')) === 'present')
  check('and the summary counts one present, one to come', /2 lectures · 1 present · 0 late · 0 missed · 1 to come/.test((await p4.getByTestId('attendance-summary').innerText()) || ''), await p4.getByTestId('attendance-summary').innerText())
  await p4.getByTestId('btn-timetable-close').tap()
  await btn().tap()
  check('the second lecture (10:00–12:00) is attended straight away, at its start', (await waitToast(/Fixed Prosthodontics 3.*marked present/, 60000)) && (await clockText()) === '12:00', await clockText())
  check('afterwards the seat is greyed out with the reason', await (async () => {
    await p4.waitForTimeout(800)
    const l = await label()
    return l === 'Take a seat' && !(await btn().isEnabled()) && /No more lectures in this hall today/.test((await p4.getByTestId('interact-note').innerText().catch(() => '')) || '')
  })())

  // ---- 3. Wednesday: Hall 313 ----
  console.log('\n--- 3. Wednesday in Hall 313 ---')
  const w = await open('routine=done&day=wed&at=-147.5,-488.4,0')
  check('Wednesday: the clock says Wed', !!w && (await weekday()) === 'Wed')
  await shoot('8-signs-313')
  const in313 = await route([[-147.5, -485.6], [-144.9, -484.95]], { tol: 0.2 })
  check('through the door of Hall 313 to the end of its first row', !!in313 && (await waitZone('hall2')), fmt4(in313))
  check('the button offers "Attend: Oral Medicine 1"', (await label()) === 'Attend: Oral Medicine 1')
  await btn().tap()
  check('Oral Medicine 1 is attended and marked present', await waitToast(/Oral Medicine 1.*marked present/, 60000))
  check('the clock stands at 10:00', (await clockText()) === '10:00', await clockText())
  check('and the seat offers Oral Surgery 1 (10:00–11:00)', (await label()) === 'Attend: Oral Surgery 1')
  await shoot('9-hall313')

  // ---- 4. Sunday: clinic only, nothing to attend ----
  console.log('\n--- 4. Sunday ---')
  const s = await open('routine=done&day=sun&at=-176.7,-484.95,0')
  check('Sunday: the clock says Sun', !!s && (await weekday()) === 'Sun')
  check('the Grand Hall seat is greyed out: no lectures in this hall today', (await label()) === 'Take a seat' && !(await btn().isEnabled()) && /No lectures in this hall today/.test((await p4.getByTestId('interact-note').innerText().catch(() => '')) || ''))
  await p4.getByTestId('class-hud').waitFor({ timeout: 8000 }).catch(() => {})
  check('the card says there are no more lectures today and that the clinic opens later', /No more lectures today/.test((await p4.getByTestId('class-hud').innerText().catch(() => '')) || ''))
  await shoot('10-sunday')
} catch (e) {
  check('the Stage 9 walk finished without an exception', false, String(e.message).split('\n')[0])
}
await letGo().catch(() => {})
if (shots.length) printJpeg('sheet9', (await contactSheet(shots, 2)).toString('base64'))
check('no console errors / page errors', errors.length === 0, errors.join(' || '))
await browser.close()
const failed = results.filter((ok) => !ok).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
