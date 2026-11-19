// Runs the smoke test's routes through the real movement code with a delayed read-out, with the old and the new control law.
// Usage: node scripts/sim-pilot.mjs   (Node 22.18+; development aid, not part of `npm test`)
import { createPlayer, stepPlayer } from '../src/controls/movement.ts'
import { buildGrid, queryGrid } from '../src/controls/spatial.ts'
import { FRONT_DOOR_COLLIDER, HOME_COLLIDERS } from '../src/home/homeLayout.ts'
import { STREET_COLLIDERS, WORLD_BOUNDS } from '../src/street/streetLayout.ts'
import { RUN, WALK, pilotStick } from './pilot-law.mjs'

const oldLaw = (d, tx, tz, { tol, slow }) => {
  const dx = tx - d.x, dz = tz - d.z, dist = Math.hypot(dx, dz) || 1
  const m = Math.min(slow ? 0.6 : 1, Math.max(0.4, dist / 0.9))
  const yaw = (d.cam * Math.PI) / 180
  return [((dz * Math.sin(yaw) - dx * Math.cos(yaw)) / dist) * m, ((dx * Math.sin(yaw) + dz * Math.cos(yaw)) / dist) * m]
}
const newLaw = (d, tx, tz, o) => pilotStick(d, tx, tz, { tol: o.tol, cap: o.slow ? 0.6 : 1, top: o.run ? RUN : WALK })

const SHUT = buildGrid([...HOME_COLLIDERS, FRONT_DOOR_COLLIDER], WORLD_BOUNDS, 12, 2)
const WORLD = buildGrid([...HOME_COLLIDERS, ...STREET_COLLIDERS], WORLD_BOUNDS, 12, 2)

// the routes of scripts/smoke-test.mjs: [start, [[x, z, opts], ...], grid, run?]
const T = (o) => ({ tol: 0.25, ...o })
const ROUTES = {
  'bed → mirror': [[4.55, -4.7], [[5.15, -5.35, T({ tol: 0.45, slow: true })]], SHUT],
  'mirror → wardrobe': [[5.15, -5.55], [[4.5, -4.8, T({ tol: 0.35 })], [4.5, -3.95, T({ tol: 0.4, slow: true })]], SHUT],
  'wardrobe → front door': [[4.5, -3.75], [[3.9, -4.9, T({ tol: 0.3 })], [3.0, -4.9, T({ tol: 0.3 })], [2.55, -4.5, T()], [2.55, -2.3, T()], [2.5, -1.15, T({ tol: 0.4 })]], SHUT],
  'door → notebook': [[2.5, -1.2], [[2.55, -2.4, T({ tol: 0.35 })], [2.55, -4.9, T({ tol: 0.35 })], [2.75, -6.1, T({ tol: 0.3 })], [2.7, -6.95, T({ tol: 0.3 })], [2.45, -7.2, T({ tol: 0.3 })], [2.45, -8.2, T({ tol: 0.3, slow: true })]], SHUT],
  'notebook → breakfast': [[2.45, -8.45], [[2.5, -7.5, T({ tol: 0.3 })], [3.6, -7.0, T({ tol: 0.3 })], [4.95, -7.0, T({ tol: 0.3 })], [4.95, -8.1, T({ tol: 0.3, slow: true })]], SHUT],
  'breakfast → bathroom': [[4.95, -8.45], [[5.0, -7.95, T({ tol: 0.3 })], [5.9, -7.95, T({ tol: 0.3, slow: true })]], SHUT],
  'bathroom → front door': [[6.25, -7.7], [[5.0, -7.95, T({ tol: 0.3 })], [4.9, -7.0, T({ tol: 0.3 })], [2.75, -6.9, T({ tol: 0.3 })], [2.75, -6.0, T({ tol: 0.3 })], [2.55, -4.9, T({ tol: 0.35 })], [2.55, -2.3, T({ tol: 0.35 })], [2.5, -1.15, T({ tol: 0.4, slow: true })]], SHUT],
  'porch → gate → lane': [[2.5, 0.9], [[2.5, 2.4, T({ tol: 0.4 })], [2.5, 2.8, T({ tol: 0.4 })], [2.5, 4.9, T({ tol: 0.35 })], [2.5, 7.4, T({ tol: 0.4 })]], WORLD],
  'lane run east': [[10.9, 4.9], [[18, 7.6, T({ tol: 2.2, run: true })], [34, 7.6, T({ tol: 2.2, run: true })], [50, 7.6, T({ tol: 2.2, run: true })], [60, 7.6, T({ tol: 2.2, run: true })]], WORLD],
  'lane mouth': [[60.5, 7.4], [[66.5, 7.6, T({ tol: 0.6 })]], WORLD],
  'across Ninety Street': [[66.5, 7.6], [[79, 7.6, T({ tol: 0.8 })], [92.4, 7.6, T({ tol: 0.6 })]], WORLD],
  'back through the gate': [[2.5, 5.6], [[2.5, 3.0, T({ tol: 0.5 })], [2.5, 1.0, T({ tol: 0.4 })], [2.5, -1.2, T({ tol: 0.4 })]], WORLD],
}

/** frame: seconds of game per frame; delay: how old the read-out is (s). Returns the seconds taken, or null if it never arrives. */
function fly(route, law, frame, delay) {
  const [[sx, sz], points, grid] = route
  const p = createPlayer(sx, sz, 0)
  const hist = []
  let t = 0
  let stick = [0, 0]
  for (const [tx, tz, o] of points) {
    for (;;) {
      if (t > 60) return { stuck: [p.x.toFixed(2), p.z.toFixed(2), tx, tz] }
      hist.push([t, p.x, p.z])
      let seen = hist[0]
      for (const h of hist) if (h[0] <= t - delay) seen = h
      const d = { x: seen[1], z: seen[2], cam: grid === SHUT ? 270 : 0 }
      if (Math.hypot(tx - d.x, tz - d.z) <= o.tol) break
      stick = law(d, tx, tz, o)
      const top = o.run ? RUN : WALK
      stepPlayer(p, stick[0], stick[1], (d.cam * Math.PI) / 180, top, frame, queryGrid(grid, p.x, p.z), WORLD_BOUNDS)
      t += frame
    }
    stick = [0, 0]
  }
  return t
}

const lags = [0.15, 0.5, 1.0, 1.5]
const frames = [0.1, 0.3, 0.5]
for (const [name, law] of [['old', oldLaw], ['new', newLaw]]) {
  let ok = 0
  let total = 0
  const worst = []
  for (const [rn, route] of Object.entries(ROUTES)) {
    let fails = 0
    let slowest = 0
    for (const lag of lags) for (const fr of frames) {
      const t = fly(route, law, fr, lag)
      total++
      if (typeof t === 'object') { fails++; if (process.env.V) console.log(`  ${rn} lag ${lag} frame ${fr}: stuck at ${t.stuck.join(' ')}`) }
      else { ok++; slowest = Math.max(slowest, t) }
    }
    worst.push(`${rn}: ${fails ? fails + ' FAIL' : 'ok'} (slowest ${slowest.toFixed(0)} s)`)
  }
  console.log(`\n${name} law: ${ok}/${total} runs arrived`)
  console.log(worst.join('\n'))
}
