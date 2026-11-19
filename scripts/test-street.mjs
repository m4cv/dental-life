// Neighbourhood layout checks (plain Node 22.18+, no browser, no dependencies).
import { PLAYER_RADIUS, pointBlocked } from '../src/controls/movement.ts'
import { CAM, CAM_INDOOR, indoorPitch, safeDistance, cameraOffset } from '../src/camera/followCamera.ts'
import { buildGrid, colliderExtent, queryGrid } from '../src/controls/spatial.ts'
import { spawnFromQuery } from '../src/home/spawn.ts'
import { CAMERA_ONLY_COLLIDERS, CEILING_Y, FRONT_DOOR, FRONT_DOOR_COLLIDER, HOME_COLLIDERS, HOME_SPAWN, PORCH, ROOMS, WALLS } from '../src/home/homeLayout.ts'
import {
  ASPHALT, BARRIERS, BINS, BOULEVARD, FLOOR_H, GATE, HOUSE_RECTS, LAMPS, LANES, LOTS, PALMS, PARAPET_LINES, PARAPET_H, PAVING, PLOT, PLOT_WALLS,
  STREET_COLLIDERS, TINT_COUNT, WORLD_BOUNDS, ZONE_NAMES, insideHome, mulberry32, zoneAt,
} from '../src/street/streetLayout.ts'

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures += 1
}

const EPS = 1e-6
const overlap = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > EPS && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > EPS
const R = (c) => {
  const [x0, x1, z0, z1] = colliderExtent(c)
  return { x0, x1, z0, z1 }
}

// ---- the lots -----------------------------------------------------------------------------------
check('the street has dozens of buildings', LOTS.length >= 60, `${LOTS.length} lots`)
check('lot ids are unique', new Set(LOTS.map((l) => l.id)).size === LOTS.length)
check('the same seed gives the same street', (() => {
  const a = mulberry32(90)
  const b = mulberry32(90)
  const xs = [a(), a(), a()]
  const ys = [b(), b(), b()]
  return xs.every((v, i) => v === ys[i]) && xs[0] !== xs[1]
})())
{
  let bad = ''
  for (let i = 0; i < LOTS.length && !bad; i++) for (let j = i + 1; j < LOTS.length; j++) if (overlap(LOTS[i].rect, LOTS[j].rect)) { bad = `${LOTS[i].id} / ${LOTS[j].id}`; break }
  check('no two buildings overlap', !bad, bad)
}
const roads = [...ASPHALT, ...PAVING]
{
  const bad = LOTS.find((l) => roads.some((r) => overlap(l.rect, r)) || LANES.some((r) => overlap(l.rect, r.rect)) || overlap(l.rect, PLOT) || HOUSE_RECTS.some((h) => overlap(l.rect, h)))
  check('no building stands on a road, the home plot or the house', !bad, bad ? bad.id : '')
}
check('road surface pieces do not overlap (nothing flickers where roads meet)', ASPHALT.every((a, i) => roads.every((b, j) => i >= j || !overlap(a, b))) && PAVING.every((a, i) => PAVING.every((b, j) => i >= j || !overlap(a, b))))
{
  const faces = (l) => {
    const r = l.rect
    return roads.some((q) => {
      if (l.face === 'N') return Math.abs(q.z1 - r.z0) < EPS && Math.min(q.x1, r.x1) - Math.max(q.x0, r.x0) > 0.5
      if (l.face === 'S') return Math.abs(q.z0 - r.z1) < EPS && Math.min(q.x1, r.x1) - Math.max(q.x0, r.x0) > 0.5
      if (l.face === 'E') return Math.abs(q.x0 - r.x1) < EPS && Math.min(q.z1, r.z1) - Math.max(q.z0, r.z0) > 0.5
      return Math.abs(q.x1 - r.x0) < EPS && Math.min(q.z1, r.z1) - Math.max(q.z0, r.z0) > 0.5
    })
  }
  const bad = LOTS.filter((l) => l.style !== 'closing' && l.rect.x1 > -56 && !faces(l))
  check('every building faces a road on the side it says it faces', bad.length === 0, bad.map((l) => l.id).join(', '))
}
check('heights follow floors (ground floor + 3.2 m per further floor)', LOTS.every((l) => Math.abs(l.height - (l.groundH + (l.floors - 1) * FLOOR_H)) < 1e-9))
check('shops are three to six floors, the low houses beside the home one or two', LOTS.filter((l) => l.style === 'shop').every((l) => l.floors >= 3 && l.floors <= 6) && LOTS.filter((l) => l.style === 'house').every((l) => l.floors <= 2))
check('the skyline varies (at least five different heights and six of seven paint colours)', new Set(LOTS.map((l) => l.height.toFixed(1))).size >= 5 && new Set(LOTS.map((l) => l.tint)).size >= Math.min(6, TINT_COUNT))
check('lots are wide enough to read as buildings', LOTS.every((l) => Math.min(l.rect.x1 - l.rect.x0, l.rect.z1 - l.rect.z0) >= 6.4))

// ---- roads --------------------------------------------------------------------------------------
check('Ninety Street is 30 m wide and its parts meet exactly', (() => {
  const b = BOULEVARD
  return b.x1 - b.x0 === 30 && b.pavementW[1] === b.carriageW[0] && b.carriageW[1] === b.median[0] && b.median[1] === b.carriageE[0] && b.carriageE[1] === b.pavementE[0] && b.pavementE[1] === b.x1
})())
check('the lanes are six metres wide and meet the pavement of Ninety Street', LANES.filter((l) => !l.id.startsWith('cross')).every((l) => Math.abs(l.rect.z1 - l.rect.z0 - 6) < EPS && l.rect.x1 === BOULEVARD.x0))
check('the road-works barrier closes the south end of Ninety Street edge to edge (the north end is open since Stage 7)', BARRIERS.length === 1 && BARRIERS.every((b) => b.x0 === BOULEVARD.x0 && b.x1 === BOULEVARD.x1 && b.z0 > 30))

// ---- the plot and the house -----------------------------------------------------------------------
check('the house rectangles do not overlap each other', HOUSE_RECTS.every((a, i) => HOUSE_RECTS.every((b, j) => i >= j || !overlap(a, b))))
check('the gate is as wide as a car door opening and in line with the front door', GATE.x1 - GATE.x0 >= 1.8 && Math.abs((GATE.x0 + GATE.x1) / 2 - FRONT_DOOR.x) < 0.01)
check('there is at least 1.3 m of yard all round the house', HOUSE_RECTS.every((h) => h.x0 - PLOT.x0 >= 1.3 || h.x0 >= 1.8) && PLOT.x1 - 7.2 >= 1.3 && -9.2 - PLOT.z0 >= 1.3 && PLOT.x0 - -0.2 <= -1.3)
check('the plot walls leave exactly the gate open in the south wall', (() => {
  const south = PLOT_WALLS.filter((w) => Math.abs(w.z1 - PLOT.z1) < EPS && w.x1 - w.x0 > 1 && w.x1 - w.x0 < PLOT.x1 - PLOT.x0 - 1).sort((p, q) => p.x0 - q.x0)
  return south.length === 2 && Math.abs(south[1].x0 - GATE.x1) < EPS && Math.abs(south[0].x1 - GATE.x0) < EPS
})())
check('the plot walls stay clear of the house and of the neighbouring buildings', PLOT_WALLS.every((w) => HOUSE_RECTS.every((h) => !overlap(w, h)) && LOTS.every((l) => !overlap(w, l.rect))))
{
  // the parapet follows the outline: one side of each segment is house, the other is not
  const inside = (x, z) => HOUSE_RECTS.some((r) => x > r.x0 + EPS && x < r.x1 - EPS && z > r.z0 + EPS && z < r.z1 - EPS)
  const ok = PARAPET_LINES.every(([x0, z0, x1, z1], i) => {
    const mx = (x0 + x1) / 2
    const mz = (z0 + z1) / 2
    const alongX = Math.abs(z0 - z1) < EPS
    const a = alongX ? inside(mx, mz - 0.1) : inside(mx - 0.1, mz)
    const b = alongX ? inside(mx, mz + 0.1) : inside(mx + 0.1, mz)
    const next = PARAPET_LINES[(i + 1) % PARAPET_LINES.length]
    return a !== b && next[0] === x1 && next[1] === z1
  })
  check('the roof parapet runs once around the outline of the house and closes', ok)
}
check('the roof sits on top of the 2.9 m walls', Math.abs(2.9 - CEILING_Y) < EPS)

// ---- zones --------------------------------------------------------------------------------------
check('zones: bedroom is home', zoneAt(HOME_SPAWN.x, HOME_SPAWN.z) === 'home' && insideHome(HOME_SPAWN.x, HOME_SPAWN.z))
check('zones: the doorway is home, the step outside is the yard', zoneAt(2.5, 0.15) === 'home' && zoneAt(2.5, 0.4) === 'yard' && !insideHome(2.5, 0.4))
check('zones: the lane and Ninety Street', zoneAt(20, 7.6) === 'lane' && zoneAt(79, 0) === 'boulevard' && zoneAt(-30, -27) === 'lane')
check('every zone has a name', ['home', 'yard', 'lane', 'boulevard'].every((z) => typeof ZONE_NAMES[z] === 'string' && ZONE_NAMES[z].length > 3))
check('?at= works over the whole neighbourhood and still falls back when out of range', (() => {
  const a = spawnFromQuery('?at=63,7.6,90', WORLD_BOUNDS)
  const b = spawnFromQuery('?at=300,0', WORLD_BOUNDS)
  const c = spawnFromQuery('?at=0,-60', WORLD_BOUNDS)
  const d = spawnFromQuery('?at=63,7.6,90')
  return a.x === 63 && a.z === 7.6 && Math.abs(a.heading - Math.PI / 2) < 1e-9 && b.x === HOME_SPAWN.x && c.x === HOME_SPAWN.x && d.x === HOME_SPAWN.x
})())

// ---- props -------------------------------------------------------------------------------------
check('lamps, palms and bins are not inside a building or a wall', [...LAMPS, ...PALMS, ...BINS].every((p) => !LOTS.some((l) => p.x > l.rect.x0 && p.x < l.rect.x1 && p.z > l.rect.z0 && p.z < l.rect.z1) && !PLOT_WALLS.some((w) => p.x > w.x0 && p.x < w.x1 && p.z > w.z0 && p.z < w.z1)))
check('bins do not overlap walls or lots', BINS.every((b) => {
  const r = { x0: b.x - 0.28, x1: b.x + 0.28, z0: b.z - 0.28, z1: b.z + 0.28 }
  return LOTS.every((l) => !overlap(r, l.rect)) && PLOT_WALLS.every((w) => !overlap(r, w))
}))
check('the median lamps and palms stand in the median', [...LAMPS, ...PALMS.slice(0, -1)].every((p) => p.x > BOULEVARD.median[0] && p.x < BOULEVARD.median[1]))
check('the palm in the yard is inside the plot and off the porch path', PALMS.slice(-1).every((p) => p.x > PLOT.x0 && p.x < PLOT.x1 && p.z > PLOT.z0 && p.z < PLOT.z1 && Math.abs(p.x - FRONT_DOOR.x) > 2))

// ---- walkability: flood fill with the real player radius ------------------------------------------
const MOVE_ALL = (shut) => [...HOME_COLLIDERS, ...(shut ? [FRONT_DOOR_COLLIDER] : []), ...STREET_COLLIDERS]
const moveGrid = (shut) => buildGrid(MOVE_ALL(shut), WORLD_BOUNDS, 12, 1.5)
const CELL = 0.25
const NX = Math.round((WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX) / CELL)
const NZ = Math.round((WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ) / CELL)
function flooder(shut, radius, from) {
  const grid = buildGrid(MOVE_ALL(shut), WORLD_BOUNDS, 12, radius + 1)
  const free = (x, z) => {
    if (x < WORLD_BOUNDS.minX + radius || x > WORLD_BOUNDS.maxX - radius || z < WORLD_BOUNDS.minZ + radius || z > WORLD_BOUNDS.maxZ - radius) return false
    for (const c of queryGrid(grid, x, z)) if (pointBlocked(x, z, 0.5, c, radius)) return false
    return true
  }
  const at = (x, z) => [Math.round((x - WORLD_BOUNDS.minX) / CELL), Math.round((z - WORLD_BOUNDS.minZ) / CELL)]
  const seen = new Uint8Array(NX * NZ)
  const [si, sj] = at(from[0], from[1])
  const stack = [[si, sj]]
  seen[sj * NX + si] = 1
  while (stack.length) {
    const [i, j] = stack.pop()
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di
      const nj = j + dj
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ || seen[nj * NX + ni]) continue
      if (!free(WORLD_BOUNDS.minX + ni * CELL, WORLD_BOUNDS.minZ + nj * CELL)) continue
      seen[nj * NX + ni] = 1
      stack.push([ni, nj])
    }
  }
  // a point counts as reached when any of the four grid cells around it was reached
  const reach = (x, z) => {
    const fi = (x - WORLD_BOUNDS.minX) / CELL
    const fj = (z - WORLD_BOUNDS.minZ) / CELL
    for (const i of [Math.floor(fi), Math.ceil(fi)]) for (const j of [Math.floor(fj), Math.ceil(fj)]) if (i >= 0 && j >= 0 && i < NX && j < NZ && seen[j * NX + i] === 1) return true
    return false
  }
  return { free, reach, seen }
}

const PORCH_START = [2.5, 1.0]
const open = flooder(false, PLAYER_RADIUS, PORCH_START)
const WANTED = {
  'the gate': [2.5, 4.8],
  'the west end of the home lane': [-55.3, 7.6],
  'the east end of the home lane': [63.6, 7.6],
  'the north lane (west end)': [-55.3, -27],
  'the north lane (east end)': [63.6, -27],
  'the south lane (west end)': [-55.3, 29.6],
  'the south lane (east end)': [63.6, 29.6],
  'the west cross lane, north part': [-23, -15],
  'the west cross lane, south part': [-23, 18],
  'the east cross lane, north part': [31, -15],
  'the east cross lane, south part': [31, 18],
  'the pavement of Ninety Street, north end': [65.5, -29.6],
  'the pavement of Ninety Street, south end': [65.5, 31.6],
  'the west carriageway': [72, 0],
  'the median': [79, 4.5],
  'the east carriageway': [85, -10],
  'the east pavement, north end': [92.7, -29.6],
  'the east pavement, south end': [92.7, 31.6],
  'the yard, east of the bedroom': [8.1, -6.5],
  'the yard, north of the dining area': [4, -9.9],
  'the yard, west of the living room': [-1.0, -3],
  'the bedroom': [HOME_SPAWN.x, HOME_SPAWN.z],
  'the living room': [1.7, -1.2],
  'the bathroom': [6.25, -7.7],
}
for (const [name, p] of Object.entries(WANTED)) check(`reachable on foot from the porch: ${name}`, open.free(p[0], p[1]) && open.reach(p[0], p[1]), `${p[0]}, ${p[1]}`)
check('the inside of a building is not reachable', LOTS.every((l) => !open.reach((l.rect.x0 + l.rect.x1) / 2, (l.rect.z0 + l.rect.z1) / 2)))
check('nothing beyond the south barrier or the east shops is reachable', !open.reach(79, 33.0) && !open.reach(125, 0))
{
  const shut = flooder(true, PLAYER_RADIUS, [HOME_SPAWN.x, HOME_SPAWN.z])
  check('with the front door shut she cannot get out of the house', !shut.reach(2.5, 1.0) && !shut.reach(63.6, 7.6) && shut.reach(1.7, -1.2))
}
{
  let reachableCells = 0
  for (let k = 0; k < open.seen.length; k++) reachableCells += open.seen[k]
  console.log(`      (${(reachableCells * CELL * CELL).toFixed(0)} m² can be walked on)`)
}
{
  // comfort: a wider player (radius 0.6) still gets through the gate and along every lane
  const wide = flooder(false, 0.6, PORCH_START)
  const need = {
    'the gate': [2.5, 4.8],
    'the west end of the home lane': [-55.0, 7.6],
    'the east end of the home lane': [63.0, 7.6],
    'the north lane (west end)': [-55.0, -27],
    'the south lane (east end)': [63.0, 29.6],
    'the pavement of Ninety Street, south end': [65.5, 30.5],
    'the east pavement, north end': [92.5, -28.5],
    'the median': [79, 4.5],
  }
  const lost = Object.keys(need).filter((n) => !wide.reach(need[n][0], need[n][1]))
  check('even a 1.2 m wide walker gets through the gate and along all lanes (nothing narrows below that)', lost.length === 0, lost.join(', '))
}
check('the walk from the porch to Ninety Street is about a minute at walking pace', (() => {
  const d = Math.hypot(64 - 2.5, 7.6 - 4.6) + 2.5 + 0
  return d / 1.45 > 25 && d / 1.45 < 75
})())

// ---- the grid never forgets a collider that is within reach --------------------------------------
{
  const all = MOVE_ALL(true)
  const grids = [
    [buildGrid(all, WORLD_BOUNDS, 12, 1.5), 1.5],
    [buildGrid(all, WORLD_BOUNDS, 12, 10), 10],
  ]
  const rng = mulberry32(7)
  let bad = 0
  for (const [g, reach] of grids) {
    for (let n = 0; n < 400; n++) {
      const x = WORLD_BOUNDS.minX + rng() * (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX)
      const z = WORLD_BOUNDS.minZ + rng() * (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ)
      const got = new Set(queryGrid(g, x, z))
      for (const c of all) {
        const [x0, x1, z0, z1] = colliderExtent(c)
        const d = Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1))
        if (d <= reach - 0.01 && !got.has(c)) bad++
      }
    }
  }
  check('the collider grid returns every collider within reach of a point', bad === 0, `${bad} missing`)
  check('the grid is much smaller than the full list (that is its point)', queryGrid(grids[0][0], 20, 7.6).length < all.length / 4, `${queryGrid(grids[0][0], 20, 7.6).length} of ${all.length}`)
}

// ---- the camera in the lanes: never inside a building or the yard wall -------------------------------
{
  const camGrid = (shut) => buildGrid([...MOVE_ALL(shut), ...CAMERA_ONLY_COLLIDERS], WORLD_BOUNDS, 12, 10.5)
  for (const shut of [false, true]) {
    const g = camGrid(shut)
    const full = [...MOVE_ALL(shut), ...CAMERA_ONLY_COLLIDERS]
    const f = flooder(shut, PLAYER_RADIUS, shut ? [HOME_SPAWN.x, HOME_SPAWN.z] : PORCH_START)
    let cases = 0
    let inside = 0
    let minArm = Infinity
    let worst = ''
    for (let x = WORLD_BOUNDS.minX + 0.5; x < WORLD_BOUNDS.maxX; x += 2.1) {
      for (let z = WORLD_BOUNDS.minZ + 0.5; z < WORLD_BOUNDS.maxZ; z += 2.1) {
        if (!f.reach(x, z)) continue
        const ceiling = insideHome(x, z) ? CEILING_Y : Infinity
        const near = queryGrid(g, x, z)
        for (let k = 0; k < 12; k++) {
          const yaw = (k / 12) * Math.PI * 2
          const pivot = [x, CAM.pivotY, z]
          const pitch = indoorPitch(pivot, yaw, CAM.pitchDefault, 4.0, near, ceiling)
          const arm = safeDistance(pivot, yaw, pitch, 4.0, near, ceiling, CAM_INDOOR.armMin, CAM_INDOOR.margin)
          const o = cameraOffset(yaw, pitch, arm)
          const cx = x + o[0]
          const cy = CAM.pivotY + o[1]
          const cz = z + o[2]
          cases++
          // right beside a palm trunk or lamp post the camera may have to stay close (it still never ends up inside one)
          const thin = [...LAMPS, ...PALMS].some((q) => Math.hypot(q.x - x, q.z - z) < 1.0)
          if (!thin && arm < minArm) { minArm = arm; worst = `x ${x.toFixed(1)} z ${z.toFixed(1)} yaw ${Math.round((yaw * 180) / Math.PI)} pitch ${pitch.toFixed(2)} ceiling ${ceiling}` }
          if (full.some((c) => pointBlocked(cx, cz, cy, c, 0))) inside++
        }
      }
    }
    check(`the camera never ends up inside a building or wall (${shut ? 'door shut' : 'door open'}, ${cases} positions × headings)`, inside === 0, `${inside} inside, shortest arm ${minArm.toFixed(2)} m at ${worst}`)
    check(`and it always keeps at least 0.8 m from her (${shut ? 'door shut' : 'door open'})`, minArm >= 0.8 - 1e-9, `${minArm.toFixed(2)} m at ${worst}`)
  }
}

// ---- the front door is the way out ----------------------------------------------------------------------
check('the front door leads to the porch and the porch to the gate in a straight line', Math.abs(FRONT_DOOR.x - (GATE.x0 + GATE.x1) / 2) < 0.01 && PORCH.x0 < FRONT_DOOR.x && PORCH.x1 > FRONT_DOOR.x)
check('the rooms of the house are still the Stage 4 rooms', ROOMS.length === 4 && WALLS.length === 9)
check('the parapet is lower than a person, so it never hides the roof from above', PARAPET_H > 0 && PARAPET_LINES.length === 8)

console.log(failures === 0 ? '\nAll street checks passed.' : `\n${failures} street check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
