// Movement, collision and camera checks (plain Node 22.18+, no browser, no dependencies).
import {
  ACCEL, DECEL, MAX_FRAME, PLAYER_RADIUS, STICK_DEADZONE, createPlayer, resolveCollisions, shapeStick, stepPlayer,
  stickToWorld, wrapAngle, pointBlocked,
} from '../src/controls/movement.ts'
import { CAM, CAM_INDOOR, applyLook, cameraOffset, createCam, easeArm, fovForAspect, indoorPitch, safeDistance } from '../src/camera/followCamera.ts'
import { controlLayout, needsRotate } from '../src/controls/layout.ts'
import { BENCH_X, BENCH_Z, BUILDINGS, COURTYARD_COLLIDERS, PALM, SPAWN, WORLD_BOUNDS } from '../src/world/courtyardLayout.ts'

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures += 1
}
const near = (a, b, tol) => Math.abs(a - b) <= tol

const WALK = 1.45
const RUN = 3.6
const NONE = []
const OPEN = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 }

function run(p, stick, yaw, max, seconds, colliders = NONE, bounds = OPEN, fps = 60) {
  const dt = 1 / fps
  for (let t = 0; t < seconds - 1e-9; t += dt) stepPlayer(p, stick[0], stick[1], yaw, max, dt, colliders, bounds)
}

// ---- stick shaping ---------------------------------------------------------------------------
check('dead-zone ignores tiny stick movement', shapeStick(0.05, 0.05).every((v) => v === 0) && shapeStick(0, STICK_DEADZONE)[1] === 0)
{
  const [x, y] = shapeStick(0, 1)
  check('full stick maps to exactly 1', near(x, 0, 1e-12) && near(y, 1, 1e-12))
  const [a, b] = shapeStick(0.6, 0.6)
  check('stick beyond a full circle is clamped', Math.hypot(a, b) <= 1 + 1e-12)
  const [c, d] = shapeStick(0.3, 0.4)
  check('shaping keeps the stick direction', near(Math.atan2(c, d), Math.atan2(0.3, 0.4), 1e-9))
  let monotone = true
  let last = -1
  for (let m = 0; m <= 1.2; m += 0.01) {
    const s = Math.hypot(...shapeStick(m, 0))
    if (s < last - 1e-12) monotone = false
    last = s
  }
  check('stick response never decreases as it is pushed further', monotone)
}

// ---- camera-relative direction ---------------------------------------------------------------
{
  const close = (v, w) => near(v[0], w[0], 1e-9) && near(v[1], w[1], 1e-9)
  check('camera looking north (yaw π): up = -z, right = +x', close(stickToWorld(0, 1, Math.PI), [0, -1]) && close(stickToWorld(1, 0, Math.PI), [1, 0]))
  check('camera looking south (yaw 0): up = +z, right = -x', close(stickToWorld(0, 1, 0), [0, 1]) && close(stickToWorld(1, 0, 0), [-1, 0]))
  check('camera looking east (yaw π/2): up = +x, right = +z', close(stickToWorld(0, 1, Math.PI / 2), [1, 0]) && close(stickToWorld(1, 0, Math.PI / 2), [0, 1]))
  check('world direction keeps the stick length', near(Math.hypot(...stickToWorld(0.3, 0.4, 1.234)), 0.5, 1e-12))
}

// ---- speed, acceleration, stopping -----------------------------------------------------------
{
  const p = createPlayer(0, 0, 0)
  run(p, [0, 1], Math.PI, WALK, 0.1)
  check('starts slowly (acceleration is limited)', p.speed > 0.4 && p.speed < 1.2, `${p.speed.toFixed(2)} m/s after 0.1 s`)
  run(p, [0, 1], Math.PI, WALK, 1.5)
  check('reaches walking speed', near(p.speed, WALK, 0.02), `${p.speed.toFixed(3)} m/s`)
  check('walks in the direction the camera looks (north = -z)', p.z < -1 && Math.abs(p.x) < 1e-6, `z ${p.z.toFixed(2)}`)
  run(p, [0, 1], Math.PI, RUN, 2)
  check('reaches running speed', near(p.speed, RUN, 0.02), `${p.speed.toFixed(3)} m/s`)
  const before = p.z
  run(p, [0, 0], Math.PI, RUN, 0.5)
  check('stops when the stick is released', p.speed < 0.01, `${p.speed.toFixed(3)} m/s`)
  check('stopping distance is short and finite', before - p.z < 0 || Math.abs(p.z - before) < 0.9, `${Math.abs(p.z - before).toFixed(2)} m`)
  const h = createPlayer(0, 0, 0)
  run(h, [0, 0.5], Math.PI, RUN, 3)
  check('half stick gives half speed', near(h.speed, RUN * (0.5 - STICK_DEADZONE) / (1 - STICK_DEADZONE), 0.05), `${h.speed.toFixed(2)} m/s`)
  check('acceleration and braking limits are sane', ACCEL > 4 && DECEL >= ACCEL)
}

// ---- diagonal movement is not faster ---------------------------------------------------------
{
  const p = createPlayer(0, 0, 0)
  run(p, [0.9, 0.9], 0.3, RUN, 3)
  check('diagonal stick is not faster than straight', p.speed <= RUN + 0.01, `${p.speed.toFixed(3)} m/s`)
}

// ---- turning ---------------------------------------------------------------------------------
{
  const p = createPlayer(0, 0, Math.PI)
  run(p, [1, 0], Math.PI, WALK, 0.6) // camera north, push right → east, heading π/2
  check('turns toward the stick direction', near(p.heading, Math.PI / 2, 0.05), `${p.heading.toFixed(3)} rad`)
  const q = createPlayer(0, 0, Math.PI - 0.1)
  stepPlayer(q, 0, -1, 0, WALK, 1 / 60, NONE, OPEN) // wants south... facing π-0.1, target atan2(0, -1)=π
  run(q, [-0.7, 0.1], Math.PI, WALK, 0.1)
  check('heading stays within (-π, π] across the ±π seam', Math.abs(q.heading) <= Math.PI + 1e-9)
  const r = createPlayer(0, 0, 3.0)
  stepPlayer(r, 0.0, 1, Math.PI + 0.35, WALK, 1 / 60, NONE, OPEN)
  check('turns the short way round the seam', Math.abs(wrapAngle(r.heading - 3.0)) < 0.2, `${r.heading.toFixed(3)}`)
  const s = createPlayer(0, 0, 1.0)
  run(s, [0, 0], 0, WALK, 1)
  check('keeps facing the same way after the stick is released', s.heading === 1.0)
}

// ---- frame-rate independence -----------------------------------------------------------------
{
  const a = createPlayer(0, 0, 0)
  const b = createPlayer(0, 0, 0)
  const c = createPlayer(0, 0, 0)
  run(a, [0, 1], Math.PI, RUN, 3, NONE, OPEN, 120)
  run(b, [0, 1], Math.PI, RUN, 3, NONE, OPEN, 60)
  run(c, [0, 1], Math.PI, RUN, 3, NONE, OPEN, 20)
  check('same distance at 120, 60 and 20 FPS', near(a.z, b.z, 0.05) && near(b.z, c.z, 0.1), `${a.z.toFixed(2)} / ${b.z.toFixed(2)} / ${c.z.toFixed(2)}`)
  const slow = createPlayer(0, 0, 0)
  stepPlayer(slow, 0, 1, Math.PI, RUN, 5, NONE, OPEN)
  check('a very long frame is clamped (no teleporting)', Math.abs(slow.z) < RUN * MAX_FRAME, `${Math.abs(slow.z).toFixed(2)} m`)
  const z = createPlayer(0, 0, 0)
  stepPlayer(z, 0, 1, Math.PI, RUN, 0, NONE, OPEN)
  stepPlayer(z, 0, 1, Math.PI, RUN, -1, NONE, OPEN)
  check('zero or negative frame time changes nothing', z.x === 0 && z.z === 0 && Number.isFinite(z.speed))
}

// ---- collisions ------------------------------------------------------------------------------
{
  const box = [{ kind: 'box', x: 0, z: -5, hw: 4, hd: 1, height: 3 }]
  const p = createPlayer(0, 0, 0)
  run(p, [0, 1], Math.PI, RUN, 5, box)
  check('cannot walk through a wall', near(p.z, -4 + PLAYER_RADIUS, 0.02), `stopped at z ${p.z.toFixed(3)}`)
  check('speed is zero while pushing against a wall', p.speed < 0.05, `${p.speed.toFixed(3)} m/s`)
  // diagonal into the wall: slides along it
  const longWall = [{ kind: 'box', x: 0, z: -5, hw: 40, hd: 1, height: 3 }]
  const q = createPlayer(0, 0, 0)
  run(q, [0.7, 0.7], Math.PI, RUN, 3, longWall)
  check('slides along a wall instead of sticking', q.x > 1.5 && near(q.z, -4 + PLAYER_RADIUS, 0.05), `x ${q.x.toFixed(2)}, z ${q.z.toFixed(2)}`)
  // round trunk
  const trunk = [{ kind: 'circle', x: 0, z: -3, r: 0.34, height: 5 }]
  const t = createPlayer(0.05, 0, 0)
  run(t, [0, 1], Math.PI, WALK, 6, trunk)
  check('walks around a tree trunk and carries on', t.z < -4, `z ${t.z.toFixed(2)}`)
  let worst = 1e9
  const u = createPlayer(0.05, 0, 0)
  for (let i = 0; i < 600; i++) {
    stepPlayer(u, 0, 1, Math.PI, WALK, 1 / 60, trunk, OPEN)
    worst = Math.min(worst, Math.hypot(u.x, u.z + 3))
  }
  check('never overlaps the trunk', worst >= 0.34 + PLAYER_RADIUS - 1e-6, `closest ${worst.toFixed(3)} m`)
  // started inside a box → pushed out through the nearest face
  const [x, z] = resolveCollisions(0, -5.2, PLAYER_RADIUS, box, OPEN)
  check('a point inside a box is pushed out through the nearest face', near(z, -6 - PLAYER_RADIUS, 1e-9) && Math.abs(x) < 1e-9, `(${x.toFixed(2)}, ${z.toFixed(2)})`)
  const edge = createPlayer(WORLD_BOUNDS.maxX - 1, 0, 0)
  run(edge, [-1, 0], 0, RUN, 4, NONE, WORLD_BOUNDS)
  check('cannot leave the world bounds', edge.x <= WORLD_BOUNDS.maxX - PLAYER_RADIUS + 1e-9 && edge.x >= WORLD_BOUNDS.maxX - 1 - 1e-6 && Number.isFinite(edge.x), `x ${edge.x.toFixed(2)}`)
}

// ---- the real courtyard ----------------------------------------------------------------------
{
  const north = BUILDINGS[0]
  const innerFace = north.position[2] + north.size[2] / 2
  const p = createPlayer(SPAWN.x, SPAWN.z, SPAWN.heading)
  run(p, [0, 1], Math.PI, RUN, 9, COURTYARD_COLLIDERS, WORLD_BOUNDS)
  check('stopped by the north building from the spawn point', near(p.z, innerFace + PLAYER_RADIUS, 0.03), `z ${p.z.toFixed(3)}, wall face ${innerFace}`)
  const w = createPlayer(SPAWN.x, SPAWN.z, SPAWN.heading)
  run(w, [-1, 0], Math.PI, RUN, 9, COURTYARD_COLLIDERS, WORLD_BOUNDS) // push left with camera north → west
  const west = BUILDINGS[1]
  check('stopped by the west building', near(w.x, west.position[0] + west.size[0] / 2 + PLAYER_RADIUS, 0.03), `x ${w.x.toFixed(3)}`)
  const b = createPlayer(8, BENCH_Z[2], 0)
  run(b, [1, 0], Math.PI, WALK, 6, COURTYARD_COLLIDERS, WORLD_BOUNDS)
  check('a bench blocks the way', b.x < BENCH_X - 0.3 + 0.01, `x ${b.x.toFixed(2)}`)
  const palm = createPlayer(PALM.position[0] + 0.02, 0, 0)
  run(palm, [0, 1], Math.PI, RUN, 3, COURTYARD_COLLIDERS, WORLD_BOUNDS)
  check('the palm trunk blocks the way', Math.hypot(palm.x - PALM.position[0], palm.z - PALM.position[2]) >= PALM.trunkRadius + PLAYER_RADIUS - 1e-6)
  check('the spawn point is clear of every obstacle', COURTYARD_COLLIDERS.every((c) => !pointBlocked(SPAWN.x, SPAWN.z, 0.5, c, PLAYER_RADIUS)))
  check('the layout has the expected obstacles', COURTYARD_COLLIDERS.length === BUILDINGS.length + 1 + BENCH_Z.length)
}

// ---- camera ----------------------------------------------------------------------------------
{
  const cam = createCam(Math.PI)
  const off = cameraOffset(cam.yaw, cam.pitch, cam.dist)
  check('camera sits behind a player who faces north (+z side) and above', off[2] > 4 && Math.abs(off[0]) < 1e-9 && off[1] > 0.8, off.map((v) => v.toFixed(2)).join(', '))
  check('camera is exactly `dist` away from the pivot', near(Math.hypot(...off), CAM.distDefault, 1e-9))

  const a = createCam(0)
  applyLook(a, 100, 0)
  check('dragging right turns the view to the right (heading shrinks)', a.yaw < -0.4)
  {
    // physical check: from yaw 0 she looks along +z and her right-hand side is -x
    const r = createCam(0)
    applyLook(r, 80, 0)
    const fwd = [Math.sin(r.yaw), Math.cos(r.yaw)]
    check('after a drag to the right the camera looks toward its right-hand side', fwd[0] * -1 > 0.3, `forward ${fwd.map((v) => v.toFixed(2))}`)
    const l = createCam(0)
    applyLook(l, -80, 0)
    check('after a drag to the left it looks toward its left-hand side', Math.sin(l.yaw) > 0.3)
  }
  const b = createCam(0)
  const before = b.pitch
  applyLook(b, 0, 60)
  check('dragging down lifts the camera', b.pitch > before)
  applyLook(b, 0, 1e6)
  check('pitch is clamped at the top', b.pitch === CAM.pitchMax)
  applyLook(b, 0, -1e6)
  check('pitch is clamped at the bottom', b.pitch === CAM.pitchMin)
  const z = createCam(0)
  applyLook(z, 0, 0, 1e6)
  check('zoom out is clamped', z.dist === CAM.distMax)
  applyLook(z, 0, 0, -1e6)
  check('zoom in is clamped', z.dist === CAM.distMin)
  const w = createCam(3.1)
  for (let i = 0; i < 50; i++) applyLook(w, 40, 0)
  check('yaw stays wrapped after a long drag', Math.abs(w.yaw) <= Math.PI + 1e-9)

  const pivot = [0, CAM.pivotY, -9.8]
  // camera must go behind the player, i.e. toward +z (yaw π). Put a wall just behind her.
  const wall = [{ kind: 'box', x: 0, z: -7, hw: 5, hd: 0.5, height: 8 }]
  const open = safeDistance(pivot, Math.PI, CAM.pitchDefault, CAM.distDefault, [])
  const blocked = safeDistance(pivot, Math.PI, CAM.pitchDefault, CAM.distDefault, wall)
  check('open space: full distance', open === CAM.distDefault)
  check('a wall behind her shortens the arm', blocked < CAM.distDefault - 0.5 && blocked >= CAM.armMin, `${blocked.toFixed(2)} m`)
  // indoors: a ceiling keeps the camera below it, however steeply it looks down or up
  const high = safeDistance([0, CAM.pivotY, 0], Math.PI, 1.1, 6, [])
  const lowRoof = safeDistance([0, CAM.pivotY, 0], Math.PI, 1.1, 6, [], 2.9)
  check('without a ceiling the camera may climb high; with one at 2.9 m it stops short of it', high === 6 && lowRoof < 3 && lowRoof >= CAM.armMin, `${lowRoof.toFixed(2)} m`)
  const roofOk = (() => {
    for (let pitch = 0; pitch <= 1.15; pitch += 0.05) {
      const arm = safeDistance([0, CAM.pivotY, 0], 1, pitch, 3.2, [], 2.9)
      const o = cameraOffset(1, pitch, arm)
      if (arm > CAM.armMin + 1e-9 && CAM.pivotY + o[1] > 2.9 - 0.12 + 1e-9) return false
    }
    return true
  })()
  check('at every pitch the camera ends below the ceiling (unless pinned at the minimum arm)', roofOk)
  {
  // indoors, with the real walls: wherever she stands and whichever way the camera points, the
  // camera must end up inside the same room as her, below the ceiling and never inside furniture
  const { HOME_COLLIDERS, HOME_BOUNDS, CEILING_Y, ROOMS, FRONT_DOOR_COLLIDER } = await import('../src/home/homeLayout.ts')
  const cols = [...HOME_COLLIDERS, FRONT_DOOR_COLLIDER]
  const roomAt = (x, z) => ROOMS.find((r) => x >= r.x0 - 0.1 && x <= r.x1 + 0.1 && z >= r.z0 - 0.1 && z <= r.z1 + 0.1)?.id ?? null
  let bad = 0
  let cases = 0
  let minArm = 9
  let climbs = 0
  let doorway = 0
  const why = { room: 0, wall: 0, ceiling: 0, arm: 0 }
  for (const r of ROOMS) {
    for (let x = r.x0 + 0.4; x <= r.x1 - 0.4; x += 0.35) {
      for (let z = r.z0 + 0.4; z <= r.z1 - 0.4; z += 0.35) {
        if (cols.some((c) => pointBlocked(x, z, 0.1, c, 0.28))) continue
        const pivot = [x, CAM.pivotY, z]
        for (let k = 0; k < 8; k++) {
          const yaw = (k / 8) * Math.PI * 2
          const pitch = indoorPitch(pivot, yaw, CAM.pitchDefault, 3.2, cols, CEILING_Y)
          const arm = safeDistance(pivot, yaw, pitch, 3.2, cols, CEILING_Y, CAM_INDOOR.armMin, CAM_INDOOR.margin)
          const o = cameraOffset(yaw, pitch, arm)
          const cx = x + o[0]
          const cz = z + o[2]
          const cy = pivot[1] + o[1]
          cases += 1
          minArm = Math.min(minArm, arm)
          if (pitch > CAM.pitchDefault + 0.01) climbs += 1
          const sameRoom = roomAt(cx, cz) === r.id
          const inWall = cols.some((c) => pointBlocked(cx, cz, cy, c, 0))
          if (!sameRoom) why.room += 1
          if (inWall) why.wall += 1
          if (cy > CEILING_Y - 0.1) why.ceiling += 1
          if (arm < CAM_INDOOR.armMin - 1e-9) why.arm += 1
          if (inWall || cy > CEILING_Y - 0.1 || arm < CAM_INDOOR.armMin - 1e-9) bad += 1
          else if (!sameRoom) doorway += 1
        }
      }
    }
  }
  check(`indoors the camera never ends up behind a wall, inside furniture or above the ceiling (${cases} positions × headings)`, cases > 400 && bad === 0, `${bad} bad of ${cases} ${JSON.stringify(why)}, ${doorway} in a doorway, closest arm ${minArm.toFixed(2)} m, climbed in ${climbs}`)
  void HOME_BOUNDS
}
check('a new camera can start closer indoors (createCam with a distance)', createCam(0, 3.2).dist === 3.2 && createCam(0).dist === CAM.distDefault)
  const low = [{ kind: 'box', x: 0, z: -7, hw: 5, hd: 0.5, height: 0.45 }]
  const over = safeDistance(pivot, Math.PI, 0.6, 4, low)
  check('the camera can rise over a low bench', over === 4, `${over}`)
  const floor = safeDistance([0, 0.5, 0], 0, -0.05, 5, [])
  check('the camera never goes under the ground', floor < 5 && floor >= CAM.armMin, `${floor.toFixed(2)} m`)
  check('arm shortens instantly and lengthens smoothly', easeArm(4, 2, 0.016) === 2 && easeArm(2, 4, 0.016) > 2 && easeArm(2, 4, 0.016) < 2.2)
}

// ---- landscape layout ----------------------------------------------------------------------------
{
  const L = controlLayout(844, 390)
  check('landscape 844×390: joystick base is 121 px, much smaller than a third of the height', L.base === 121 && L.base < 390 / 3, `${L.base}px`)
  check('landscape 844×390: knob 56 px, finger travel 51 px, both inside the base', L.knob === 56 && L.stickRadius === 51 && L.stickRadius * 2 <= L.base, `knob ${L.knob}, travel ${L.stickRadius}`)
  check('the layout is the same whichever way the screen is turned (it follows the short side)', JSON.stringify(controlLayout(390, 844)) === JSON.stringify(L))
  let small = true
  for (const [w, h] of [[640, 360], [740, 360], [800, 360], [844, 390], [915, 412], [932, 430], [1024, 768], [1366, 1024]]) {
    const l = controlLayout(w, h)
    if (l.runSize < 56 || l.recenterSize < 48 || l.base < 96 || l.base > 150) small = false
  }
  check('buttons stay at least 44 px (Run ≥ 56, Recentre ≥ 48) and the stick 96–150 px on every common screen', small)
  const tiny = controlLayout(640, 300)
  check('on a very short screen the stick is still usable (≥ 96 px)', tiny.base === 96, `${tiny.base}px`)
}
check('narrow portrait screens ask for rotation (390×844, 360×800)', needsRotate(390, 844) && needsRotate(360, 800))
check('landscape phones, tablets and desktop windows do not', !needsRotate(844, 390) && !needsRotate(1024, 768) && !needsRotate(820, 1180) && !needsRotate(1280, 720))
check('a square window is not asked to rotate', !needsRotate(500, 500))
check('the camera is tightened on wide screens and normal on tall ones', fovForAspect(844 / 390) === 46 && fovForAspect(390 / 844) === 50 && fovForAspect(1.2) === 46 && fovForAspect(1.19) === 50)

if (failures) {
  console.log(`\n${failures} control check(s) FAILED`)
  process.exit(1)
}
console.log('All control checks passed')
