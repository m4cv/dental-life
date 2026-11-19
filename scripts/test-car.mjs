// Car checks (plain Node 22.18+, no browser, no dependencies): the driving model, the collisions, and drives through the real neighbourhood.
import { buildGrid, queryGrid } from '../src/controls/spatial.ts'
import { PLAYER_RADIUS, pointBlocked, resolveCollisions } from '../src/controls/movement.ts'
import { HOME_COLLIDERS } from '../src/home/homeLayout.ts'
import { STREET_COLLIDERS, WORLD_BOUNDS, LANES, BARRIERS } from '../src/street/streetLayout.ts'
import { CAR, ENTER_REACH, NO_INPUT, carCirclePoints, carColliders, carLeft, createCar, distanceToCar, exitSpot, steerLimit, stepCar } from '../src/vehicle/carPhysics.ts'
import { PARKED_CAR, carFromQuery, startsDriving } from '../src/vehicle/carLayout.ts'

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures += 1
}
const near = (a, b, tol) => Math.abs(a - b) <= tol
/** Exact circle-against-collider overlap (more than `slack` m deep): pointBlocked's box test is a square, which over-reports at corners. */
const overlaps = (x, z, R, c, slack = 0.02) => {
  if (c.kind === 'circle') return Math.hypot(x - c.x, z - c.z) < c.r + R - slack
  const qx = Math.min(Math.max(x, c.x - c.hw), c.x + c.hw)
  const qz = Math.min(Math.max(z, c.z - c.hd), c.z + c.hd)
  return Math.hypot(x - qx, z - qz) < R - slack
}
const deg = (r) => (r * 180) / Math.PI
const f2 = (v) => v.toFixed(2)
const OPEN = [] // an empty field
const FIELD = { minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000 }
const run = (car, input, seconds, colliders = OPEN, bounds = FIELD, dt = 1 / 30) => {
  for (let t = 0; t < seconds - 1e-9; t += dt) stepCar(car, typeof input === 'function' ? input(car, t) : input, dt, colliders, bounds)
  return car
}

// ---- the pedals --------------------------------------------------------------------------------
{
  const car = createCar(0, 0, 0)
  let t = 0
  const dt = 1 / 30
  while (car.speed < CAR.maxSpeed * 0.9 && t < 30) { stepCar(car, { throttle: 1, brake: 0, steer: 0 }, dt, OPEN, FIELD); t += dt }
  check('full gas gets her to 90 % of top speed in 4 to 12 seconds', t > 4 && t < 12, `${f2(t)} s`)
  run(car, { throttle: 1, brake: 0, steer: 0 }, 30)
  check('and she never goes faster than the top speed', car.speed <= CAR.maxSpeed + 1e-9 && car.speed > CAR.maxSpeed * 0.97, `${f2(car.speed)} m/s`)
}
{
  const car = createCar(0, 0, 0)
  car.speed = 12
  const z0 = car.z
  let t = 0
  while (car.speed > 0.01 && t < 10) { stepCar(car, { throttle: 0, brake: 1, steer: 0 }, 1 / 30, OPEN, FIELD); t += 1 / 30 }
  check('the brake stops a car doing 12 m/s within 1.6 s and 10 m', t < 1.6 && car.z - z0 < 10, `${f2(t)} s, ${f2(car.z - z0)} m`)
  check('the brake lights are on while she slows down', (() => { const c = createCar(0, 0, 0); c.speed = 8; stepCar(c, { throttle: 0, brake: 1, steer: 0 }, 1 / 30, OPEN, FIELD); return c.braking })())
}
{
  const car = createCar(0, 0, 0)
  run(car, { throttle: 0, brake: 1, steer: 0 }, 6)
  check('with the brake held after stopping she reverses', car.speed < -1 && car.z < -2, `${f2(car.speed)} m/s, z ${f2(car.z)}`)
  check('reverse is slower than driving: at most 3.5 m/s', car.speed >= -CAR.maxReverse - 1e-9 && near(car.speed, -CAR.maxReverse, 0.05), `${f2(car.speed)}`)
  run(car, { throttle: 1, brake: 0, steer: 0 }, 1.5)
  check('gas while reversing brakes first and then drives forward', car.speed > 0, `${f2(car.speed)}`)
}
{
  const car = createCar(0, 0, 0)
  car.speed = 10
  let t = 0
  while (car.speed > 0 && t < 30) { stepCar(car, NO_INPUT, 1 / 30, OPEN, FIELD); t += 1 / 30 }
  check('letting go of everything makes her coast to a stop in 4 to 10 s', t > 4 && t < 10, `${f2(t)} s`)
}

// ---- steering ----------------------------------------------------------------------------------
{
  // the sign: heading east (90°), stick right → she turns toward the south (heading shrinks toward 0)
  const car = createCar(0, 0, Math.PI / 2)
  car.speed = 5
  run(car, { throttle: 0.4, brake: 0, steer: 1 }, 1.5)
  check('stick right turns the car to the right (facing east, she veers south)', car.z > 0.5 && car.heading < Math.PI / 2, `heading ${f2(deg(car.heading))}°, z ${f2(car.z)}`)
  const car2 = createCar(0, 0, Math.PI / 2)
  car2.speed = 5
  run(car2, { throttle: 0.4, brake: 0, steer: -1 }, 1.5)
  check('stick left turns the car to the left (she veers north)', car2.z < -0.5 && Math.atan2(Math.sin(car2.heading - Math.PI / 2), Math.cos(car2.heading - Math.PI / 2)) > 0, `heading ${f2(deg(car2.heading))}°, z ${f2(car2.z)}`)
  const car3 = createCar(0, 0, 0)
  car3.speed = -2
  run(car3, { throttle: 0, brake: 1, steer: 1 }, 1)
  check('steering works the other way round while reversing (a real car)', car3.heading > 0, `heading ${f2(deg(car3.heading))}°`)
}
{
  // the turning circle at a crawl: radius = wheelbase / tan(max wheel angle), measured from the path
  const car = createCar(0, 0, 0)
  car.speed = 1.5
  let minX = Infinity, maxX = -Infinity
  for (let t = 0; t < 12; t += 1 / 60) {
    stepCar(car, { throttle: 0.05, brake: 0, steer: 1 }, 1 / 60, OPEN, FIELD)
    car.speed = 1.5 // hold the crawl
    minX = Math.min(minX, car.x); maxX = Math.max(maxX, car.x)
  }
  const diameter = maxX - minX
  const R = CAR.wheelbase / Math.tan(CAR.steerMax)
  const Rc = Math.hypot(R, CAR.wheelbase / 2) // the centre of the car is half a wheelbase ahead of the rear axle
  check('the turning circle at a crawl matches wheelbase / tan(wheel angle)', near(diameter / 2, Rc, 0.15), `centre of the car ${f2(diameter / 2)} m, expected ${f2(Rc)} m (rear axle ${f2(R)} m)`)
  check('so a U-turn needs about 7 m of road (the lanes are 6 m wide: a three-point turn)', R * 2 + CAR.width > 6, `${f2(R * 2 + CAR.width)} m`)
}
{
  check('full lock when crawling, then the wheel angle gets smaller with speed', steerLimit(0) === CAR.steerMax && steerLimit(4) === CAR.steerMax && steerLimit(6) < steerLimit(5) && steerLimit(13) < steerLimit(8) && steerLimit(13) < 0.12, `${f2(deg(steerLimit(13)))}° at 13 m/s`)
  // sideways acceleration (speed² / radius) stays bearable at every speed with the stick hard over
  let worst = 0
  for (let v = 1; v <= CAR.maxSpeed; v += 1) worst = Math.max(worst, (v * v * Math.tan(steerLimit(v))) / CAR.wheelbase)
  check('full stick at any speed never asks for more than 8 m/s² sideways', worst < 8, `${f2(worst)} m/s²`)
  const car = createCar(0, 0, 0)
  car.steer = 0
  run(car, { throttle: 0, brake: 0, steer: 1 }, 0.1)
  check('the wheels take 0.15–0.4 s to go from straight to full lock', car.steer < 0 && Math.abs(car.steer) > 0.2 && Math.abs(car.steer) < CAR.steerMax, `${f2(car.steer)} rad after 0.1 s`)
  run(car, { throttle: 0, brake: 0, steer: 0 }, 0.5)
  check('and straighten up by themselves when the stick is let go', Math.abs(car.steer) < 1e-9)
}

// ---- collisions --------------------------------------------------------------------------------
const wall = { kind: 'box', x: 0, z: 20, hw: 50, hd: 0.125, height: 3 } // a 25 cm wall across the road at z 20
{
  for (const dt of [1 / 120, 1 / 60, 1 / 30, 1 / 15, 0.1, 0.25, 0.5]) {
    const car = createCar(0, 0, 0)
    car.speed = CAR.maxSpeed
    run(car, { throttle: 1, brake: 0, steer: 0 }, 6, [wall], FIELD, dt)
    const front = car.z + 1.0 + CAR.circleRadius
    if (!(front <= 20 - 0.125 + 1e-6)) { check(`a car at top speed cannot go through a thin wall (frame ${dt.toFixed(3)} s)`, false, `front at z ${f2(front)}`); break }
    if (dt === 0.5) check('a car at top speed cannot go through a 25 cm wall, at any frame rate from 120 to 2 per second', true)
  }
  const car = createCar(0, 0, 0)
  car.speed = CAR.maxSpeed
  let maxBump = 0
  for (let t = 0; t < 4; t += 1 / 30) { stepCar(car, { throttle: 1, brake: 0, steer: 0 }, 1 / 30, [wall], FIELD); maxBump = Math.max(maxBump, car.bump) }
  check('a head-on hit stops her dead and registers as a big bump', Math.abs(car.speed) < 0.2 && maxBump > 0.8, `speed ${f2(car.speed)}, bump ${f2(maxBump)}`)
  const g = createCar(-12, 17.0, Math.PI / 2 - 0.35) // heading 20° into the wall, which she meets almost side-on
  g.speed = 10
  let inside20 = false
  for (let t = 0; t < 2; t += 1 / 60) { stepCar(g, { throttle: 1, brake: 0, steer: 0 }, 1 / 60, [wall], FIELD); if (g.z + 1.0 * Math.cos(g.heading) + CAR.circleRadius > 20 - 0.125 + 1e-6) inside20 = true }
  check('grazing a wall at 20° keeps most of the speed and swings the nose along the wall', g.speed > 8 && !inside20 && Math.abs(Math.cos(g.heading)) < 0.1, `${f2(g.speed)} m/s, heading ${f2(deg(g.heading))}°`)
  const g2 = createCar(-12, 17.0, Math.PI / 2 + 0.35)
  g2.speed = -6 // the same, in reverse
  for (let t = 0; t < 2; t += 1 / 60) stepCar(g2, { throttle: 0, brake: 1, steer: 0 }, 1 / 60, [wall], FIELD)
  check('and the same in reverse (she backs along the wall, not through it)', g2.z - 1.0 * Math.cos(g2.heading) + CAR.circleRadius <= 20 - 0.125 + 1e-6 || g2.z < 20)
}
{
  // a lamp post (circle) beside the road: she drives into it and ends up outside it
  const lamp = { kind: 'circle', x: 0, z: 10, r: 0.15, height: 6 }
  const car = createCar(0, 0, 0)
  run(car, { throttle: 1, brake: 0, steer: 0 }, 6, [lamp])
  check('a lamp post stops her too, and she is never inside it', carCirclePoints(car).every(([x, z]) => !overlaps(x, z, CAR.circleRadius, lamp, 1e-6)))
}
{
  const car = createCar(0, 0, Math.PI / 2)
  run(car, { throttle: 1, brake: 0, steer: 0 }, 10, OPEN, { minX: -100, maxX: 20, minZ: -50, maxZ: 50 })
  check('the edge of the world stops her as well', car.x + CAR.circleOffsets[3] + CAR.circleRadius <= 20 + 1e-6, `x ${f2(car.x)}`)
}

// ---- the person: stepping in and out -----------------------------------------------------------
{
  const car = createCar(PARKED_CAR.x, PARKED_CAR.z, PARKED_CAR.heading)
  const [lx, lz] = carLeft(car.heading)
  check('the driver sits on the left: heading east, the left side is north', near(lx, 0, 1e-9) && near(lz, -1, 1e-9))
  check('the default parking place is in the home lane, driver side to the middle of the lane', LANES.some((l) => l.rect.x0 <= car.x && car.x <= l.rect.x1 && l.rect.z0 <= car.z && car.z <= l.rect.z1) && car.z > 7.6)
  const colliders = [...HOME_COLLIDERS, ...STREET_COLLIDERS]
  check('the parked car does not touch a wall', carCirclePoints(car).every(([x, z]) => !colliders.some((c) => overlaps(x, z, CAR.circleRadius, c, 0.001))))
  check('a person stands next to the car and the Get in button appears within reach', distanceToCar(9, 7.9, car) < ENTER_REACH && distanceToCar(9, 5, car) > ENTER_REACH && distanceToCar(9, 9.45, car) === 0)
  const spot = exitSpot(car, colliders, WORLD_BOUNDS)
  check('she steps out on the driver\'s side, in the lane, on her feet and clear of the car', !!spot && spot.z < car.z - 1 && !colliders.some((c) => pointBlocked(spot.x, spot.z, 0.5, c, PLAYER_RADIUS)), spot ? `x ${f2(spot.x)} z ${f2(spot.z)} facing ${f2(deg(spot.heading))}°` : 'null')
  check('and she faces away from the car', !!spot && near(Math.sin(spot.heading), lx, 1e-9) && near(Math.cos(spot.heading), lz, 1e-9))
  // the parked car, as seen by someone on foot: she cannot walk through it
  const [sx, sz] = resolveCollisions(9, 9.45, PLAYER_RADIUS, carColliders(car), WORLD_BOUNDS)
  check('someone on foot cannot walk through the parked car', Math.hypot(sx - 9, sz - 9.45) > 0.5)
  // car tight against a wall on its driver's side: she gets out the other side or the back
  const jammed = createCar(9, 5.5, -Math.PI / 2) // facing west with the driver's side (left = south)... north wall on the right
  const spot2 = exitSpot(jammed, colliders, WORLD_BOUNDS)
  check('with the right side against a wall she still steps out (driver side)', !!spot2)
  const boxed = createCar(9, 7.6, 0)
  const spot3 = exitSpot(boxed, [{ kind: 'box', x: 9, z: 7.6, hw: 6, hd: 6, height: 3 }], WORLD_BOUNDS)
  check('and when there is nowhere at all to stand she cannot get out (the game says so)', spot3 === null)
}
{
  check('?car= parses like ?at=', (() => { const c = carFromQuery('?car=60,7.6,90', WORLD_BOUNDS); return c.x === 60 && c.z === 7.6 && near(c.heading, Math.PI / 2, 1e-9) })())
  check('?car= out of range or missing gives the parking place', carFromQuery('?car=900,0,0', WORLD_BOUNDS) === PARKED_CAR && carFromQuery('', WORLD_BOUNDS) === PARKED_CAR)
  check('?drive=1 starts in the car', startsDriving('?drive=1') && !startsDriving('') && !startsDriving('?drive=0'))
}

// ---- driving through the real neighbourhood ----------------------------------------------------
const WORLD = [...HOME_COLLIDERS, ...STREET_COLLIDERS]
const GRID = buildGrid(WORLD, WORLD_BOUNDS, 12, 3.2)
const stepWorld = (car, input, dt = 1 / 30) => stepCar(car, input, dt, queryGrid(GRID, car.x, car.z), WORLD_BOUNDS)
const inside = (car) => carCirclePoints(car).some(([x, z]) => WORLD.some((c) => overlaps(x, z, CAR.circleRadius, c)))
{
  // 1. from the parking place along the lane to Ninety Street, across it, into the shops: a pursuit autopilot
  const car = createCar(PARKED_CAR.x, PARKED_CAR.z, PARKED_CAR.heading)
  const pursue = (c, goalX, goalZ) => {
    const want = Math.atan2(goalX - c.x, goalZ - c.z)
    const diff = Math.atan2(Math.sin(want - c.heading), Math.cos(want - c.heading)) // positive = goal is to the left
    return { throttle: 0.9, brake: 0, steer: Math.max(-1, Math.min(1, -diff * 2.2)) }
  }
  let t = 0
  let clipped = false
  let maxX = car.x
  while (t < 40) {
    // keep to the middle of the lane until x 60, then straight across the boulevard
    const goal = car.x < 58 ? [car.x + 9, 7.6] : [120, 7.6]
    stepWorld(car, pursue(car, ...goal))
    if (inside(car)) clipped = true
    maxX = Math.max(maxX, car.x)
    t += 1 / 30
  }
  check('she drives from the parking place down the lane and across Ninety Street without ever being inside a wall', !clipped)
  check('and the shops on the far side stop her', near(car.x, 94 - CAR.circleOffsets[3] - CAR.circleRadius, 0.4), `x ${f2(car.x)} z ${f2(car.z)}`)
  check('the drive takes less than 20 seconds', (() => { const c = createCar(PARKED_CAR.x, PARKED_CAR.z, PARKED_CAR.heading); let tt = 0; while (c.x < 90 && tt < 40) { stepWorld(c, pursue(c, ...(c.x < 58 ? [c.x + 9, 7.6] : [120, 7.6]))); tt += 1 / 30 } return tt < 20 })())
}
{
  // 2. north along the carriageway to the road-works barrier
  const car = createCar(72.25, 25, Math.PI)
  let t = 0
  let clipped = false
  while (t < 20) { stepWorld(car, { throttle: 1, brake: 0, steer: 0 }); if (inside(car)) clipped = true; t += 1 / 30 }
  const barrier = BARRIERS.find((b) => b.z1 < 0)
  check('she drives the length of Ninety Street at speed and the road-works barrier stops her', !clipped && !!barrier && car.z - CAR.circleOffsets[3] - CAR.circleRadius >= barrier.z1 - 1e-6 && car.z < barrier.z1 + 3, `z ${f2(car.z)}`)
}
{
  // 3. a three-point turn in the 6 m lane (the car is parked facing east; she wants to go west)
  const car = createCar(30, 7.6, Math.PI / 2)
  let t = 0
  let phase = 'fwd'
  let phaseStart = 0
  let clipped = false
  let moves = 0
  const wantHeading = -Math.PI / 2
  const angleTo = (c) => Math.abs(Math.atan2(Math.sin(wantHeading - c.heading), Math.cos(wantHeading - c.heading)))
  // how far one of the circles is from the lane walls (z 4.6 and 10.6); the front and rear circles are the ends of the car
  const clear = (c, i) => { const [, z] = carCirclePoints(c)[i]; return Math.min(z - CAR.circleRadius - 4.6, 10.6 - (z + CAR.circleRadius)) }
  const FRONT = 3
  const REAR = 0
  while (t < 90 && angleTo(car) > 0.35) {
    const held = t - phaseStart
    if (phase === 'fwd') {
      // forward with the wheels hard over to the left until the nose is near a wall…
      const stop = clear(car, FRONT) < 0.3 && held > 0.3
      stepWorld(car, stop ? { throttle: 0, brake: 1, steer: 0 } : { throttle: 0.2, brake: 0, steer: -1 })
      if (stop && Math.abs(car.speed) < 0.15) { phase = 'rev'; phaseStart = t; moves++ }
    } else {
      // …then backwards with the wheels over the other way (in reverse that keeps turning her left) until the tail is near a wall
      const stop = clear(car, REAR) < 0.3 && held > 0.3
      stepWorld(car, stop ? { throttle: 1, brake: 0, steer: 0 } : { throttle: 0, brake: 0.5, steer: 1 })
      if (stop && Math.abs(car.speed) < 0.15) { phase = 'fwd'; phaseStart = t; moves++ }
    }
    if (inside(car)) clipped = true
    t += 1 / 30
  }
  check('she can turn the car round in the 6 m lane with a three-point turn (never touching a wall)', angleTo(car) <= 0.35 && !clipped, `${f2(t)} s, ${moves} direction changes, heading ${f2(deg(car.heading))}°`)
}
{
  // 4. the car cannot get into the home: not through the gate, not through the open front door
  const car = createCar(2.5, 12, Math.PI) // in the lane, in line with the gate, facing north
  car.speed = 6
  let t = 0
  while (t < 8) { stepWorld(car, { throttle: 1, brake: 0, steer: 0 }); t += 1 / 30 }
  check('with the gate in front of her she may roll into the yard, but the house stops her at the front wall (she cannot drive in through the door)', car.z > 1.2 && !inside(car) && car.z - CAR.circleOffsets[3] - CAR.circleRadius > -0.2, `z ${f2(car.z)}`)
}

console.log(failures ? `\n${failures} car checks FAILED` : '\nAll car checks passed.')
process.exit(failures ? 1 : 0)
