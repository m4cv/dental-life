// Home layout, interaction and routine checks (plain Node 22.18+, no browser, no dependencies).
import { PLAYER_RADIUS, createPlayer, pointBlocked, stepPlayer, stickToWorld, wrapAngle } from '../src/controls/movement.ts'
import { APPROACH_TIMEOUT, ARRIVE_DIST, startAction, stepAction, worldToStick } from '../src/controls/interaction.ts'
import { spawnFromQuery } from '../src/home/spawn.ts'
import {
  CEILING_Y, FRONT_DOOR, FRONT_DOOR_COLLIDER, FURNITURE, FURNITURE_COLLIDERS, HOME_BOUNDS, HOME_COLLIDERS, HOME_SPAWN,
  ROOMS, SPOTS, WALLS, WALL_PIECES, WALL_T, spotById, wallColliders, wallPieces,
} from '../src/home/homeLayout.ts'
import {
  DOOR_ACTION, ROUTINE_STEPS, START_MINUTES, actionFor, completeStep, formatClock, initialRoutine, nearestSpot, openDoor, promptFor, routineComplete,
} from '../src/home/routine.ts'

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures += 1
}

// ---- walls --------------------------------------------------------------------------------------
{
  const w = { id: 't', a: [0, 0], b: [4, 0], openings: [{ id: 'd', at: 2, w: 1, h: 2.2, sill: 0, kind: 'door' }] }
  const p = wallPieces(w)
  const solid = p.filter((q) => q.part === 'solid')
  check('a wall with a door splits into two solid blocks and a lintel', solid.length === 2 && p.filter((q) => q.part === 'lintel').length === 1)
  check('the lintel spans the door width and sits above the door', Math.abs(p.find((q) => q.part === 'lintel').sx - 1) < 1e-9 && Math.abs(p.find((q) => q.part === 'lintel').y0 - 2.2) < 1e-9)
  const total = solid.reduce((a, q) => a + q.sx, 0) + 1
  check('the blocks plus the doorway cover the whole wall (including the corner overhang)', Math.abs(total - (4 + WALL_T)) < 1e-9, `${total}`)
  const win = wallPieces({ id: 'w', a: [0, 0], b: [0, -4], openings: [{ id: 'x', at: -2, w: 1, h: 1, sill: 1, kind: 'window' }] })
  check('a window leaves a sill below and a lintel above', win.some((q) => q.part === 'sill' && Math.abs(q.y1 - 1) < 1e-9) && win.some((q) => q.part === 'lintel' && Math.abs(q.y0 - 2) < 1e-9))
  check('walls running north-south get their thickness along x', win.every((q) => Math.abs(q.sx - WALL_T) < 1e-9))
  const cw = wallColliders({ id: 'w', a: [0, 0], b: [0, -4], openings: [{ id: 'x', at: -2, w: 1, h: 1, sill: 1, kind: 'window' }] })
  check('a window stays solid for the player (glass) but a door is a gap', cw.length === 1 && wallColliders(w).length === 2)
}
check('every wall is axis-aligned', WALLS.every((w) => w.a[0] === w.b[0] || w.a[1] === w.b[1]))
check('every opening fits inside its wall and below the ceiling', WALLS.every((w) => {
  const alongX = w.a[1] === w.b[1]
  const a = alongX ? Math.min(w.a[0], w.b[0]) : Math.min(w.a[1], w.b[1])
  const b = alongX ? Math.max(w.a[0], w.b[0]) : Math.max(w.a[1], w.b[1])
  return w.openings.every((o) => o.at - o.w / 2 > a && o.at + o.w / 2 < b && o.sill + o.h < CEILING_Y - 0.2)
}))
check('doors are wide enough to walk through (player diameter 0.56 m)', WALLS.flatMap((w) => w.openings).filter((o) => o.kind !== 'window').every((o) => o.w >= 0.56 + 0.2))
check('no wall pieces overlap the room floors', WALL_PIECES.every((p) => ROOMS.every((r) => {
  const ox = Math.min(p.x + p.sx / 2, r.x1) - Math.max(p.x - p.sx / 2, r.x0)
  const oz = Math.min(p.z + p.sz / 2, r.z1) - Math.max(p.z - p.sz / 2, r.z0)
  return !(ox > 1e-6 && oz > 1e-6)
})), 'walls stay outside the inner rectangles')

// ---- rooms and furniture -------------------------------------------------------------------------
check('there are four rooms and three of them come from photographs', ROOMS.length === 4 && ROOMS.filter((r) => r.source === 'photos').length === 3)
check('furniture stays inside its room', FURNITURE.every((f) => ROOMS.some((r) => f.x - f.hw >= r.x0 - 1e-9 && f.x + f.hw <= r.x1 + 1e-9 && f.z - f.hd >= r.z0 - 1e-9 && f.z + f.hd <= r.z1 + 1e-9)))
check('no two pieces of furniture overlap', FURNITURE.every((a, i) => FURNITURE.every((b, j) => i >= j || Math.abs(a.x - b.x) >= a.hw + b.hw - 1e-9 || Math.abs(a.z - b.z) >= a.hd + b.hd - 1e-9)))

// ---- walkability: flood fill on a 10 cm grid with the real player radius -------------------------
const CELL = 0.1
const X0 = HOME_BOUNDS.minX
const Z0 = HOME_BOUNDS.minZ
const NX = Math.round((HOME_BOUNDS.maxX - X0) / CELL)
const NZ = Math.round((HOME_BOUNDS.maxZ - Z0) / CELL)
const blocked = (x, z, extra = [], r = PLAYER_RADIUS) =>
  x < X0 + r || x > HOME_BOUNDS.maxX - r || z < Z0 + r || z > HOME_BOUNDS.maxZ - r ||
  [...HOME_COLLIDERS, ...extra].some((c) => pointBlocked(x, z, 0.1, c, r))
function flood(extra, r = PLAYER_RADIUS) {
  const seen = new Uint8Array(NX * NZ)
  const idx = (x, z) => Math.round((z - Z0) / CELL) * NX + Math.round((x - X0) / CELL)
  // start from the grid cell nearest the spawn, so every step stays exactly on the grid
  const sx = X0 + Math.round((HOME_SPAWN.x - X0) / CELL) * CELL
  const sz = Z0 + Math.round((HOME_SPAWN.z - Z0) / CELL) * CELL
  const queue = [[sx, sz]]
  seen[idx(sx, sz)] = 1
  while (queue.length) {
    const [x, z] = queue.pop()
    for (const [dx, dz] of [[CELL, 0], [-CELL, 0], [0, CELL], [0, -CELL]]) {
      const nx = x + dx
      const nz = z + dz
      if (nx < X0 || nz < Z0 || nx >= X0 + NX * CELL || nz >= Z0 + NZ * CELL) continue
      const k = idx(nx, nz)
      if (seen[k] || blocked(nx, nz, extra, r)) continue
      seen[k] = 1
      queue.push([nx, nz])
    }
  }
  return (x, z) => seen[idx(x, z)] === 1
}
const near = (f) => (x, z) => [[0, 0], [0.05, 0], [-0.05, 0], [0, 0.05], [0, -0.05], [0.05, 0.05], [-0.05, -0.05], [0.05, -0.05], [-0.05, 0.05]].some(([dx, dz]) => f(x + dx, z + dz))
const reach = near(flood([FRONT_DOOR_COLLIDER]))
check('the spawn point is free', !blocked(HOME_SPAWN.x, HOME_SPAWN.z))
for (const s of SPOTS) check(`the spot "${s.id}" is free and reachable from the bed with the front door shut`, !blocked(s.x, s.z, [FRONT_DOOR_COLLIDER]) && reach(s.x, s.z), `${s.x}, ${s.z}`)
check('with the door shut she cannot get outside (the doorstep is cut off)', !reach(FRONT_DOOR.x, FRONT_DOOR.z + 0.6))
const reachOpen = near(flood([]))
check('with the door open she can step out onto the porch', reachOpen(FRONT_DOOR.x, FRONT_DOOR.z + 0.6) && reachOpen(FRONT_DOOR.x, 1.2))
check('but not past the porch walls (the street is Stage 5)', !reachOpen(1.2, 0.9) && !reachOpen(3.8, 0.9) && !reachOpen(FRONT_DOOR.x, 1.9))
check('she cannot get outside the house any other way (west, east, far north, between rooms and the porch)', !reachOpen(-0.6, -3) && !reachOpen(7.5, -4.2) && !reachOpen(3.7, -9.6) && !reachOpen(5.2, -1.5) && !reachOpen(7.5, -8))
{
  // every room is reachable, and each interior door is wide enough for her to actually pass
  const centre = (r) => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2]
  let ok = true
  let which = ''
  for (const r of ROOMS) {
    let any = false
    for (let x = r.x0; x <= r.x1 && !any; x += 0.1) for (let z = r.z0; z <= r.z1 && !any; z += 0.1) if (reach(x, z)) any = true
    if (!any) {
      ok = false
      which += ` ${r.id}`
    }
  }
  check('every room has floor space she can reach', ok, which)
  void centre
}
{
  // comfort: with a fatter player (0.36 m radius, about 8 cm of slack per side) the doorways and the
  // living-room passage must still connect the rooms, so a thumb does not have to be pixel-perfect
  const fat = flood([FRONT_DOOR_COLLIDER], 0.36)
  const fatNear = near(fat)
  check('comfort: the bedroom door, the hall opening and the bath door all pass a 0.36 m radius', fatNear(3.5, -4.9) && fatNear(2.75, -6.5) && fatNear(5.5, -8.0))
  for (const [name, x, z] of [['the dining area (west)', 3.0, -7.0], ['the dining area (east)', 5.0, -7.0], ['the bathroom', 6.0, -7.2], ['the front door', 2.6, -1.0]]) {
    check(`comfort: from the bed she can still reach ${name} at 0.36 m`, fatNear(x, z), `${x}, ${z}`)
  }
}
check('the camera can never see through the roof (walls reach the ceiling height)', WALL_PIECES.filter((p) => p.part === 'solid').every((p) => p.y1 === CEILING_Y))
check('furniture colliders match the furniture list', FURNITURE_COLLIDERS.length === FURNITURE.length + 1)

// ---- spots ---------------------------------------------------------------------------------------
check('every step has a spot, and the front door has one', ROUTINE_STEPS.every((s) => SPOTS.some((p) => p.id === s.id)) && SPOTS.some((p) => p.id === 'door'))
check('spots are far enough apart that the nearest one is never ambiguous', SPOTS.every((a, i) => SPOTS.every((b, j) => i >= j || Math.hypot(a.x - b.x, a.z - b.z) > a.radius + b.radius - 0.3)))
check('standing on a spot offers exactly that spot', SPOTS.every((s) => nearestSpot(s.x, s.z)?.id === s.id))
check('far from everything nothing is offered (the bed)', nearestSpot(HOME_SPAWN.x, HOME_SPAWN.z) === null)
check('just out of reach nothing is offered', nearestSpot(spotById('brush').x + 0.9, spotById('brush').z) === null)

// ---- routine -------------------------------------------------------------------------------------
{
  let s = initialRoutine()
  check('the day starts at 06:30 with nothing done', formatClock(s.minutes) === '06:30' && s.done.length === 0 && START_MINUTES === 390)
  check('the door prompt is greyed out with a reason until everything is done', (() => { const p = promptFor(spotById('door'), s); return p && !p.enabled && /0 of 5/.test(p.note) })())
  check('a step offers its button until it is done, then nothing', promptFor(spotById('brush'), s)?.label === 'Brush teeth' && promptFor(spotById('brush'), completeStep(s, 'brush')) === null)
  s = completeStep(s, 'brush')
  const again = completeStep(s, 'brush')
  check('completing a step twice changes nothing (no double time)', again === s)
  check('the clock moves on when a step is done', formatClock(s.minutes) === '06:34')
  check('the door cannot be opened early', openDoor(s) === s && !openDoor(s).doorOpen)
  for (const step of ROUTINE_STEPS) s = completeStep(s, step.id)
  check('all five steps complete the routine and the clock lands at 07:00', routineComplete(s) && formatClock(s.minutes) === '07:00', formatClock(s.minutes))
  check('the door prompt is enabled once the routine is complete', promptFor(spotById('door'), s)?.enabled === true)
  s = openDoor(s)
  check('then the door opens, and the prompt is gone', s.doorOpen && promptFor(spotById('door'), s) === null)
  check('the clock formats past midnight', formatClock(24 * 60 + 5) === '00:05')
}

// ---- actions -------------------------------------------------------------------------------------
check('worldToStick is the inverse of stickToWorld for every camera heading', (() => {
  for (let k = 0; k < 12; k++) {
    const yaw = (k / 12) * Math.PI * 2
    for (const [sx, sy] of [[0, 1], [1, 0], [0.4, -0.7], [-0.6, 0.2]]) {
      const [wx, wz] = stickToWorld(sx, sy, yaw)
      const [bx, by] = worldToStick(wx, wz, yaw)
      if (Math.abs(bx - sx) > 1e-9 || Math.abs(by - sy) > 1e-9) return false
    }
  }
  return true
})())
check('every spot has an action: the door opens in 1.6 s, each step uses its own gesture and time', SPOTS.every((sp) => actionFor(sp).seconds > 0) && actionFor(spotById('door')) === DOOR_ACTION && DOOR_ACTION.gesture === 'open' && actionFor(spotById('brush')).gesture === 'brush' && actionFor(spotById('brush')).seconds === 2.8)
{
  // run each action from 8 starting points around the spot, with the real movement code and collisions
  const GESTURE_KINDS = new Set(['brush', 'mirror', 'dress', 'eat', 'pack', 'open'])
  check('every action uses a gesture the character can play', SPOTS.every((sp) => GESTURE_KINDS.has(actionFor(sp).gesture)))
  let starts = 0
  let arrived = 0
  let finished = 0
  let facing = 0
  let worst = 0
  let slowest = 0
  for (const sp of SPOTS) {
    for (let k = 0; k < 8; k++) {
      for (const [camYaw, dist] of [[0, 0.7], [2.3, 0.7], [1, 0.45], [4, 0.45]]) {
        const a = (k / 8) * Math.PI * 2
        const x = sp.x + Math.cos(a) * dist
        const z = sp.z + Math.sin(a) * dist
        const spotsHere = nearestSpot(x, z)
        if (blocked(x, z, [FRONT_DOOR_COLLIDER]) || spotsHere?.id !== sp.id) continue
        starts += 1
        const p = createPlayer(x, z, 0)
        const { seconds, gesture } = actionFor(sp)
        const act = startAction(sp, seconds, gesture)
        let t = 0
        let acted = false
        let done = false
        let arrivedAt = null
        for (; t < 12 && !done; t += 1 / 60) {
          const s = stepAction(act, p, 1 / 60, camYaw)
          stepPlayer(p, s.stick[0], s.stick[1], camYaw, 1.45, 1 / 60, [...HOME_COLLIDERS, FRONT_DOOR_COLLIDER], HOME_BOUNDS)
          if (s.faceTo !== null) {
            acted = true
            if (arrivedAt === null) arrivedAt = Math.hypot(sp.x - p.x, sp.z - p.z)
            p.heading = wrapAngle(p.heading + wrapAngle(s.faceTo - p.heading) * (1 - Math.exp(-10 / 60)))
          }
          done = s.done
        }
        if (acted && arrivedAt <= ARRIVE_DIST + 0.03) arrived += 1
        if (done) finished += 1
        worst = Math.max(worst, arrivedAt ?? 9)
        slowest = Math.max(slowest, t)
        if (done && Math.abs(wrapAngle(p.heading - sp.heading)) < 0.35) facing += 1
      }
    }
  }
  check(`actions started from ${starts} nearby positions all finish`, starts >= 40 && finished === starts, `${finished}/${starts}`)
  check('she walks to the exact spot before the gesture starts (all but the few blocked by furniture)', arrived >= starts * 0.9, `${arrived}/${starts}, worst ${worst.toFixed(2)} m`)
  check('and ends up facing the way the spot says', facing >= starts * 0.9, `${facing}/${starts}`)
  check('an action never takes longer than the walk timeout plus its own length plus a moment', slowest <= APPROACH_TIMEOUT + 3.2 + 0.2, `${slowest.toFixed(2)} s`)
}

// ---- debug spawn ---------------------------------------------------------------------------------
check('?at= places her where asked, with the compass angle (270° = west)', (() => { const sp = spawnFromQuery('?at=2.5,-3,270'); return sp.x === 2.5 && sp.z === -3 && Math.abs(sp.heading - (3 * Math.PI) / 2) < 1e-9 })())
check('?at= with two numbers faces south', spawnFromQuery('?at=1,-2').heading === 0)
check('without ?at= she starts in the bedroom', spawnFromQuery('') === HOME_SPAWN && spawnFromQuery('?scene=home') === HOME_SPAWN)
check('a bad ?at= (text, too few numbers, outside the house) falls back to the normal start', ['?at=abc', '?at=1', '?at=40,40,0', '?at=1,-2,x'].every((q) => spawnFromQuery(q) === HOME_SPAWN))

if (failures) {
  console.log(`\n${failures} home check(s) FAILED`)
  process.exit(1)
}
console.log('All home checks passed')
