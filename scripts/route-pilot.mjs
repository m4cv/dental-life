// The driver that follows the route, kept apart so the pure test (scripts/test-route.mjs), the Node
// simulation (scripts/sim-route.mjs) and the browser smoke test all use the SAME law.
//
// Input: where the car is (x, z), which way it points (heading, rad, 0 faces +z) and how fast it goes
// (m/s, forward positive). Output: the pedals and the wheel the way the on-screen controls give them.
// The speed it asks for falls before each bend (so a read-out that is a little old cannot make it overshoot).
import { buildGrid, queryGrid } from '../src/controls/spatial.ts'
import { ROUTE_AT, ROUTE_BOUNDS, ROUTE_LEGS, ROUTE_LENGTH, WORLD_COLLIDERS, atUniversity, projectOnRoute, routePoint } from '../src/streets/routeLayout.ts'
import { PARKED_CAR } from '../src/vehicle/carLayout.ts'
import { CAR, carCirclePoints, createCar, stepCar } from '../src/vehicle/carPhysics.ts'

const at = (i) => ROUTE_LEGS[i]

/** Stretches of the route that have to be driven slowly: [from s, to s, m/s]. */
export const SLOW_ZONES = [
  [at(ROUTE_AT.turn) - 14, at(ROUTE_AT.north) + 14, 5.5],
  [at(ROUTE_AT.ringStart) - 6, at(ROUTE_AT.ringEnd) + 16, 6.5],
  [at(ROUTE_AT.gateTurn) - 30, ROUTE_LENGTH, 5],
]

/** The settings for a read-out that is up to a second old (the browser test on a slow machine): slow, aims far ahead, steers gently. */
export const LAGGED = { cruise: 6, look: 12, gain: 0.8 }

const BRAKING = 4.5 // m/s² the pilot plans with (the car can do 9.5)

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))

/** The fastest speed allowed at route position s: the cruise speed, lowered ahead of every slow zone. */
export function allowedSpeed(s, cruise) {
  let v = cruise
  for (const [from, to, vz] of SLOW_ZONES) {
    if (s > to) continue
    const gap = Math.max(0, from - s)
    v = Math.min(v, Math.sqrt(vz * vz + 2 * BRAKING * gap))
  }
  return v
}

/**
 * @param {{x:number,z:number,heading:number,speed:number}} p
 * @param {{cruise?:number,look?:number,gain?:number}} [o]
 */
export function routeDrive(p, { cruise = 13, look = 6, gain = 2.2 } = {}) {
  const fix = projectOnRoute(p.x, p.z)
  // aim at a point further along the route: further when she is fast
  const [tx, tz] = routePoint(fix.s + look + Math.max(0, p.speed) * 0.8)
  const want = Math.atan2(tx - p.x, tz - p.z)
  const diff = wrap(want - p.heading) // positive: the aim point is on the left
  const steer = clamp(-diff * gain, -1, 1)
  const v = allowedSpeed(fix.s, cruise)
  const err = v - p.speed
  const throttle = err > 0 ? clamp(err * 0.5, 0, 1) : 0
  const brake = err < -0.4 && p.speed > 0.5 ? clamp(-err * 0.6, 0, 1) : 0
  return { throttle, brake, steer, s: fix.s, off: fix.off }
}

// ---- the same drive, simulated with the real car physics and the real world --------------------------

const GRID = buildGrid(WORLD_COLLIDERS, ROUTE_BOUNDS, 12, 3.2)
const hits = (x, z, c, slack = 0.02) => {
  if (c.kind === 'circle') return Math.hypot(x - c.x, z - c.z) < c.r + CAR.circleRadius - slack
  const qx = Math.min(Math.max(x, c.x - c.hw), c.x + c.hw)
  const qz = Math.min(Math.max(z, c.z - c.hd), c.z + c.hd)
  return Math.hypot(x - qx, z - qz) < CAR.circleRadius - slack
}

/**
 * Drives from the parking place to the university with the pilot above. `lag` (s) makes the pilot see the car as it
 * was that long ago, like the browser test's read-out on a slow machine. `trace(t, car, u)` is called every `every` seconds.
 */
export function driveRoute({ cruise = 13, lag = 0, limit = 400, trace = null, every = 2, look, gain } = {}) {
  const car = createCar(PARKED_CAR.x, PARKED_CAR.z, PARKED_CAR.heading)
  const dt = 1 / 30
  const history = []
  let t = 0
  let clipped = null
  let off = 0
  let offAt = ''
  let maxSpeed = 0
  let arrivedAt = null
  let nextTrace = 0
  while (t < limit && arrivedAt === null) {
    history.push({ x: car.x, z: car.z, heading: car.heading, speed: car.speed })
    const seen = history[Math.max(0, history.length - 1 - Math.round(lag / dt))]
    const u = routeDrive(seen, { cruise, ...(look === undefined ? {} : { look }), ...(gain === undefined ? {} : { gain }) })
    stepCar(car, { throttle: u.throttle, brake: u.brake, steer: u.steer }, dt, queryGrid(GRID, car.x, car.z), ROUTE_BOUNDS)
    if (!clipped) for (const [x, z] of carCirclePoints(car)) for (const c of queryGrid(GRID, x, z)) if (hits(x, z, c)) clipped = `${x.toFixed(1)}, ${z.toFixed(1)} at ${t.toFixed(1)} s`
    const here = projectOnRoute(car.x, car.z)
    if (here.off > off) { off = here.off; offAt = `${car.x.toFixed(1)}, ${car.z.toFixed(1)} at ${t.toFixed(1)} s` }
    maxSpeed = Math.max(maxSpeed, car.speed)
    if (trace && t >= nextTrace) { trace(t, car, u); nextTrace += every }
    if (atUniversity(car.x, car.z)) arrivedAt = t
    t += dt
  }
  return { car, t, clipped, off, offAt, maxSpeed, arrivedAt }
}
