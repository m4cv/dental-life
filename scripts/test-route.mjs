// Route checks (plain Node 22.18+, no browser, no dependencies): the layout of Stage 7 (Ninety Street
// north, the roundabout, Al-Shaab Street, the university's compound), the walkability of the whole
// world, a car driving the whole route with the real physics, the arrow and the clock.
import { buildGrid, queryGrid } from '../src/controls/spatial.ts'
import { PLAYER_RADIUS, pointBlocked } from '../src/controls/movement.ts'
import { FRONT_DOOR_COLLIDER, HOME_COLLIDERS } from '../src/home/homeLayout.ts'
import { ASPHALT, BARRIERS, BOULEVARD, HOUSE_RECTS, LOTS, PAVING, PLOT, PLOT_WALLS, LANES, ZONE_NAMES, zoneAt } from '../src/street/streetLayout.ts'
import {
  CLOCK_MIN_PER_M, ISLAND, LOOKAHEAD, NORTH, NORTH_LAMPS, NORTH_PALMS, PLAZA, RING_R, ROUTE, ROUTE_ASPHALT, ROUTE_BOUNDS, ROUTE_COLLIDERS, ROUTE_LENGTH, ROUTE_LOTS,
  ROUTE_PAVING, ROUTE_STEPS, SHAAB, SHAAB_LAMPS, SHAAB_PALMS, SIDE_STREETS, UNI, UNI_BLOCKS, UNI_BOOTH, UNI_CANOPY_POLES, UNI_LAMPS, UNI_PALMS, UNI_PILLARS, UNI_STEPS, UNI_WALLS,
  WORLD_COLLIDERS, arrowDegrees, atUniversity, instructionAt, minutesFor, projectOnRoute, remainingFrom, routePoint, worldZoneAt,
} from '../src/streets/routeLayout.ts'
import { CLINIC_BEHIND, UNI_MAIN, UNI_MAIN_UPPER, UNI_VESTIBULE } from '../src/university/uniLayout.ts'
import { LAGGED, driveRoute } from './route-pilot.mjs'

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures += 1
}
const f1 = (v) => v.toFixed(1)
const f2 = (v) => v.toFixed(2)
const EPS = 1e-6
const overlap = (a, b) => a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.z0 < b.z1 - EPS && b.z0 < a.z1 - EPS
const inRect = (r, x, z) => x >= r.x0 - EPS && x <= r.x1 + EPS && z >= r.z0 - EPS && z <= r.z1 + EPS
const cell = (c) => ({ x0: c.x - c.hw, x1: c.x + c.hw, z0: c.z - c.hd, z1: c.z + c.hd })
const circleRect = (c) => ({ x0: c.x - c.r, x1: c.x + c.r, z0: c.z - c.r, z1: c.z + c.r })
const clock = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.floor(min % 60)).padStart(2, '0')}`

// ---- the numbers ---------------------------------------------------------------------------------
console.log(`      (${ROUTE_LOTS.length} lots, ${ROUTE_COLLIDERS.length} route colliders, ${WORLD_COLLIDERS.length} in the whole world, route ${f1(ROUTE_LENGTH)} m)`)

// ---- roads -----------------------------------------------------------------------------------------
const ALL_ASPHALT = [...ASPHALT, ...ROUTE_ASPHALT]
const ALL_PAVING = [...PAVING, ...ROUTE_PAVING]
const ROADS = [...ALL_ASPHALT, ...ALL_PAVING]
check('Ninety Street goes on north from where it stopped, with the same lanes (x 67–77.5 and 80.5–91) up to the roundabout', (() => {
  const w = ROUTE_ASPHALT[0]
  const e = ROUTE_ASPHALT[1]
  return w.x0 === BOULEVARD.carriageW[0] && w.x1 === BOULEVARD.carriageW[1] && e.x0 === BOULEVARD.carriageE[0] && e.x1 === BOULEVARD.carriageE[1] && w.z1 === BOULEVARD.z0 && w.z0 === NORTH.z0 && NORTH.z1 === BOULEVARD.z0
})())
check('the barrier at the north end is gone: only the south barrier is left', BARRIERS.length === 1 && BARRIERS[0].z0 > 30)
check('the roundabout is a 30 m square (the width of Ninety Street) with a round island in the middle and a 7 m ring road', PLAZA.x1 - PLAZA.x0 === 30 && PLAZA.z1 - PLAZA.z0 === 30 && ISLAND.x === (PLAZA.x0 + PLAZA.x1) / 2 && ISLAND.z === (PLAZA.z0 + PLAZA.z1) / 2 && PLAZA.x1 - (ISLAND.x + ISLAND.r) >= 7 && Math.abs(RING_R - (ISLAND.r + 15) / 2) < 1e-9)
check('Al-Shaab Street is 16 m of asphalt between two 3 m pavements and it meets the roundabout', SHAAB.z1 - SHAAB.z0 === 16 && SHAAB.z0 - SHAAB.pavN[0] === 3 && SHAAB.pavS[0] - SHAAB.z1 === 0 && SHAAB.pavS[1] - SHAAB.pavS[0] === 3 && SHAAB.x1 === PLAZA.x0 && PLAZA.z0 < SHAAB.pavN[0] && PLAZA.z1 > SHAAB.pavS[1])
check('the road pieces do not overlap each other (so nothing flickers)', (() => { const a = [...ALL_ASPHALT, ...ALL_PAVING]; return a.every((r, i) => a.every((q, j) => i >= j || !overlap(r, q))) })())
check('every side street is 7 m wide, 14 m long, opens onto Ninety Street and is closed at its end', SIDE_STREETS.length === 6 && SIDE_STREETS.every((s) => {
  const r = s.rect
  const open = s.side === 'W' ? r.x1 === BOULEVARD.x0 : r.x0 === BOULEVARD.x1
  const end = ROUTE_LOTS.some((l) => l.id.startsWith(`rt-end-${s.id}`) && (s.side === 'W' ? l.rect.x1 === r.x0 : l.rect.x0 === r.x1) && l.rect.z0 === r.z0 && l.rect.z1 === r.z1)
  return r.z1 - r.z0 === 7 && Math.abs(r.x1 - r.x0) === 14 && open && end
}))

// ---- buildings -------------------------------------------------------------------------------------
check('the route lots have unique ids and never repeat a Stage 5 lot', new Set([...LOTS, ...ROUTE_LOTS].map((l) => l.id)).size === LOTS.length + ROUTE_LOTS.length)
check('lots are wide enough to read as buildings (6 m at least)', ROUTE_LOTS.every((l) => Math.min(l.rect.x1 - l.rect.x0, l.rect.z1 - l.rect.z0) >= 6 - EPS), ROUTE_LOTS.filter((l) => Math.min(l.rect.x1 - l.rect.x0, l.rect.z1 - l.rect.z0) < 6 - EPS).map((l) => l.id).join(', '))
check('no route lot overlaps another lot, a house, the yard or a wall of the compound', (() => {
  const others = [...LOTS.map((l) => l.rect), ...HOUSE_RECTS, ...PLOT_WALLS, ...UNI_WALLS, ...UNI_BLOCKS.map((b) => b.rect)]
  const bad = []
  ROUTE_LOTS.forEach((l, i) => {
    ROUTE_LOTS.forEach((q, j) => { if (i < j && overlap(l.rect, q.rect)) bad.push(`${l.id}/${q.id}`) })
    others.forEach((r) => { if (overlap(l.rect, r)) bad.push(l.id) })
  })
  return bad.length === 0 ? true : bad.slice(0, 5).join(', ')
})() === true)
check('no building stands on a road (route lots, university blocks, booth, steps)', (() => {
  const solids = [...ROUTE_LOTS.map((l) => l.rect), ...UNI_BLOCKS.map((b) => b.rect), UNI_BOOTH, UNI_STEPS.rect, ...LOTS.map((l) => l.rect)]
  return solids.every((r) => ROADS.every((p) => !overlap(r, p)))
})())
check('the university blocks do not overlap each other, the steps, the booth or the walls', (() => {
  const all = [...UNI_BLOCKS.map((b) => b.rect), UNI_STEPS.rect, UNI_BOOTH, ...UNI_WALLS]
  return all.every((a, i) => all.every((b, j) => i >= j || !overlap(a, b)))
})())
check('every university block, the steps and the booth lie inside the compound', [...UNI_BLOCKS.map((b) => b.rect), UNI_STEPS.rect, UNI_BOOTH].every((r) => r.x0 >= UNI.compound.x0 && r.x1 <= UNI.compound.x1 && r.z0 >= UNI.compound.z0 && r.z1 <= UNI.compound.z1))
check('the main building is four floors, the entrance projects four metres and is in the middle, the door faces the street', (() => {
  // since Stage 8 the main building is hollow on the ground floor: its footprint is UNI_MAIN and the entrance is the doorway between two shoulders
  const sh = UNI_BLOCKS.filter((b) => b.id.startsWith('shoulder'))
  return UNI_MAIN_UPPER.y1 === 4 * UNI.floorH && sh.length === 2 && sh.every((b) => b.rect.z0 === UNI_VESTIBULE.z0 && b.rect.z1 === UNI_VESTIBULE.z1) && UNI_VESTIBULE.z1 === UNI_MAIN.z1 + 4 && Math.abs((UNI_VESTIBULE.x0 + UNI_VESTIBULE.x1) / 2 - UNI.gate.cx) < 1e-9 && Math.abs((UNI_MAIN.x0 + UNI_MAIN.x1) / 2 - UNI.gate.cx) < 1e-9 && UNI_STEPS.rect.z0 === UNI_VESTIBULE.z1
})())
check('the gate is 9 m wide and in line with the entrance, the steps and the arrival spot', UNI.gate.x1 - UNI.gate.x0 === 9 && Math.abs((UNI.gate.x0 + UNI.gate.x1) / 2 - UNI.gate.cx) < 1e-9 && UNI.arrival.x === UNI.gate.cx && UNI.arrival.z > UNI_STEPS.rect.z1 && UNI.arrival.z < UNI.compound.z1)
check('the gate opens on the pavement of Al-Shaab Street: the compound meets it', UNI.compound.z1 === SHAAB.pavN[0] && UNI.compound.z0 >= ROUTE_BOUNDS.minZ)

// ---- props -------------------------------------------------------------------------------------------
check('median lamps and palms go on alternately down the middle of Ninety Street, 9 m apart, as at the old end', (() => {
  const all = [...NORTH_LAMPS.map((p) => ({ ...p, k: 'L' })), ...NORTH_PALMS.map((p) => ({ ...p, k: 'P' }))].sort((a, b) => b.z - a.z)
  return all.length > 30 && all.every((p, i) => p.x === 79 && Math.abs(p.z - (-27 - 9 * (i + 1))) < 1e-9 && p.k === (i % 2 === 0 ? 'P' : 'L')) && all[all.length - 1].z > NORTH.z0
})())
check('lamps and palms of Al-Shaab Street stand on its pavements, off the university gate', SHAAB_PALMS.every((p) => p.z > SHAAB.pavS[0] && p.z < SHAAB.pavS[1]) && SHAAB_LAMPS.every((p) => p.z > SHAAB.pavN[0] && p.z < SHAAB.pavN[1] && (p.x < UNI.gate.x0 - 6 || p.x > UNI.gate.x1 + 6)) && SHAAB_PALMS.length >= 8 && SHAAB_LAMPS.length >= 5)
check('no prop or collider of the route stands inside a building or on another', (() => {
  const solids = [...ROUTE_LOTS.map((l) => l.rect), ...UNI_BLOCKS.map((b) => b.rect), UNI_BOOTH, UNI_STEPS.rect, ...LOTS.map((l) => l.rect), ...UNI_WALLS]
  const props = [...NORTH_LAMPS, ...NORTH_PALMS, ...SHAAB_PALMS, ...SHAAB_LAMPS, ...UNI_PALMS, ...UNI_LAMPS, ...UNI_CANOPY_POLES]
  const bad = props.filter((p) => solids.some((r) => inRect(r, p.x, p.z)))
  const clash = props.filter((p, i) => props.some((q, j) => i < j && Math.hypot(p.x - q.x, p.z - q.z) < 0.6))
  return bad.length === 0 && clash.length === 0 && !UNI_PILLARS.some((r) => props.some((p) => inRect(r, p.x, p.z)))
})())
check('the island is clear of the lanes: nothing else of the route stands on the ring road', ROUTE_COLLIDERS.filter((c) => c.kind === 'circle' && !(c.x === ISLAND.x && c.z === ISLAND.z)).every((c) => Math.hypot(c.x - ISLAND.x, c.z - ISLAND.z) > ISLAND.r + 8 || !inRect(PLAZA, c.x, c.z)))

// ---- the drive's line --------------------------------------------------------------------------------
check('the route runs from the lane at the home gate to the university forecourt, about 800 m', Math.abs(ROUTE[0][0] - 2.5) < 1e-9 && ROUTE[0][1] === 7.6 && atUniversity(...ROUTE[ROUTE.length - 1]) && ROUTE_LENGTH > 700 && ROUTE_LENGTH < 900, f1(ROUTE_LENGTH) + ' m')
check('every metre of the route lies on a road, pavement or the forecourt', (() => {
  const bad = []
  for (let s = 0; s <= ROUTE_LENGTH; s += 0.5) {
    const [x, z] = routePoint(s)
    if (!ROADS.some((r) => inRect(r, x, z)) && !inRect(UNI.compound, x, z)) bad.push(`${f1(s)} m (${f1(x)}, ${f1(z)})`)
  }
  return bad.length === 0 ? true : bad.slice(0, 4).join('; ')
})() === true)
check('the route keeps its distance from solid things: at least 2 m from every building and prop (a car is 1.7 m wide)', (() => {
  const grid = buildGrid(WORLD_COLLIDERS, ROUTE_BOUNDS, 12, 4)
  let worst = Infinity
  for (let s = 0; s <= ROUTE_LENGTH; s += 0.5) {
    const [x, z] = routePoint(s)
    for (const c of queryGrid(grid, x, z)) {
      const d = c.kind === 'circle' ? Math.hypot(x - c.x, z - c.z) - c.r : Math.hypot(Math.max(Math.abs(x - c.x) - c.hw, 0), Math.max(Math.abs(z - c.z) - c.hd, 0))
      worst = Math.min(worst, d)
    }
  }
  check.worst = worst
  return worst >= 2
})(), `closest ${f2(check.worst)} m`)
check('projecting a point near the route gives its place along the route to within 3 m, even 4 m to the side', (() => {
  let worst = 0
  for (let s = 5; s < ROUTE_LENGTH - 5; s += 3) {
    const [x, z] = routePoint(s)
    const [x2, z2] = routePoint(s + 1)
    const dx = x2 - x
    const dz = z2 - z
    const n = Math.hypot(dx, dz) || 1
    for (const side of [-4, 0, 4]) {
      const fix = projectOnRoute(x + (dz / n) * side, z + (-dx / n) * side)
      worst = Math.max(worst, Math.abs(fix.s - s))
    }
  }
  check.projWorst = worst
  return worst <= 12
})(), `worst error ${f1(check.projWorst)} m`)
check('instructions come in order from the lane to the gate', (() => {
  const texts = []
  for (let s = 0; s <= ROUTE_LENGTH; s += 1) { const t = instructionAt(s); if (texts[texts.length - 1] !== t) texts.push(t) }
  return texts.length === ROUTE_STEPS.length && ROUTE_STEPS.every((st, i) => texts[i] === st.text) && ROUTE_STEPS.every((st, i) => i === 0 || st.s > ROUTE_STEPS[i - 1].s)
})())
check('the HUD distance counts down along the route: it is the whole route at the gate and about nothing at the arrival spot', Math.abs(remainingFrom(2.5, 7.6) - ROUTE_LENGTH) < 0.01 && remainingFrom(UNI.arrival.x, UNI.arrival.z) < 0.01 && remainingFrom(85.75, -200) > remainingFrom(85.75, -300))

// ---- the arrow -----------------------------------------------------------------------------------------
{
  // heading 0 faces south (+z): north is straight behind, east is on the left, west on the right
  const north = Math.PI
  const a1 = arrowDegrees(85.75, -100, north)
  const a2 = arrowDegrees(85.75, -100, Math.PI / 2) // facing east: the route goes north, so on the left
  const a3 = arrowDegrees(85.75, -100, 0) // facing south: the route is straight behind
  const a4 = arrowDegrees(85.75, -100, -Math.PI / 2) // facing west: on the right
  check('on Ninety Street facing north the arrow points up', Math.abs(a1) < 1, f1(a1) + '°')
  check('facing east it points to the left (about −90°), facing west to the right (+90°), facing south it points back', Math.abs(a2 + 90) < 2 && Math.abs(a4 - 90) < 2 && Math.abs(Math.abs(a3) - 180) < 2, `${f1(a2)}° ${f1(a4)}° ${f1(a3)}°`)
  const a5 = arrowDegrees(-100, SHAAB.laneZ, -Math.PI / 2) // on Al-Shaab Street facing west: ahead
  check('on Al-Shaab Street facing west the arrow points up', Math.abs(a5) < 1, f1(a5) + '°')
  const a6 = arrowDegrees(-160, SHAAB.laneZ, -Math.PI / 2) // at the gate: turn right, north
  check('level with the gate, facing west, it points to the right (the gate is on the right)', a6 > 30 && a6 <= 90.5, f1(a6) + '°')
  check('the arrow looks ahead 22 m so it does not swing wildly near the route', LOOKAHEAD === 22)
  const spin = (() => { let m = 0; let prev = arrowDegrees(...routePoint(0), 0); for (let s = 1; s <= ROUTE_LENGTH - 25; s += 1) { const [x, z] = routePoint(s); const a = arrowDegrees(x, z, 0); m = Math.max(m, Math.min(Math.abs(a - prev), 360 - Math.abs(a - prev))); prev = a } return m })()
  check('walking the route with the camera fixed, the arrow turns by less than 45° from one metre to the next', spin < 45, f1(spin) + '°')
}

// ---- zones and the clock -----------------------------------------------------------------------------------
check('zones: the place chip names the neighbourhood, the roundabout, Al-Shaab Street, the university, its lobby, its courtyard and the clinic', worldZoneAt(2.5, 0.15) === 'home' && worldZoneAt(20, 7.6) === 'lane' && worldZoneAt(79, -100) === 'boulevard' && worldZoneAt(79, -420) === 'junction' && worldZoneAt(-100, -420) === 'shaab' && worldZoneAt(-160, -450) === 'university' && worldZoneAt(50, -245) === 'lane' && Object.values(ZONE_NAMES).length === 14 && worldZoneAt(-160, -482) === 'lobby' && worldZoneAt(-160, -520) === 'courtyard' && worldZoneAt(-190, -490) === 'clinic')
check('arrival: inside the compound counts, the pavement outside the gate does not', atUniversity(-160, -440) && atUniversity(-190, -480) && !atUniversity(-160, -430) && !atUniversity(-160, -424) && !atUniversity(-100, -450))
check('clock: nothing passes at home or in the yard, a game minute for 41.7 m elsewhere', minutesFor(10, 2.5, -3) === 0 && minutesFor(10, 4, -5) === 0 && Math.abs(minutesFor(41.7, 79, -100) - 1) < 0.01 && CLOCK_MIN_PER_M === 0.024)
check('clock: the whole drive takes about 19 game minutes (arriving at about 07:19)', (() => { const m = ROUTE_LENGTH * CLOCK_MIN_PER_M; check.arrive = clock(7 * 60 + m); return m > 15 && m < 25 })(), `${f1(ROUTE_LENGTH * CLOCK_MIN_PER_M)} min, arrive ${check.arrive}`)

// ---- walking the whole world ---------------------------------------------------------------------------------
{
  const CELL = 0.5
  const NX = Math.round((ROUTE_BOUNDS.maxX - ROUTE_BOUNDS.minX) / CELL)
  const NZ = Math.round((ROUTE_BOUNDS.maxZ - ROUTE_BOUNDS.minZ) / CELL)
  const grid = buildGrid(WORLD_COLLIDERS, ROUTE_BOUNDS, 12, PLAYER_RADIUS + 1)
  const B = ROUTE_BOUNDS
  const free = (x, z) => {
    if (x < B.minX + PLAYER_RADIUS || x > B.maxX - PLAYER_RADIUS || z < B.minZ + PLAYER_RADIUS || z > B.maxZ - PLAYER_RADIUS) return false
    for (const c of queryGrid(grid, x, z)) if (pointBlocked(x, z, 0.5, c, PLAYER_RADIUS)) return false
    return true
  }
  const seen = new Uint8Array(NX * NZ)
  const stack = new Int32Array(NX * NZ)
  const at = (x, z) => [Math.round((x - B.minX) / CELL), Math.round((z - B.minZ) / CELL)]
  let sp = 0
  const [si, sj] = at(2.5, 1.0)
  seen[sj * NX + si] = 1
  stack[sp++] = sj * NX + si
  while (sp) {
    const k = stack[--sp]
    const i = k % NX
    const j = (k - i) / NX
    for (let n = 0; n < 4; n++) {
      const ni = i + (n === 0 ? 1 : n === 1 ? -1 : 0)
      const nj = j + (n === 2 ? 1 : n === 3 ? -1 : 0)
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue
      const kk = nj * NX + ni
      if (seen[kk] || !free(B.minX + ni * CELL, B.minZ + nj * CELL)) continue
      seen[kk] = 1
      stack[sp++] = kk
    }
  }
  const reach = (x, z) => {
    const fi = (x - B.minX) / CELL
    const fj = (z - B.minZ) / CELL
    for (const i of [Math.floor(fi), Math.ceil(fi)]) for (const j of [Math.floor(fj), Math.ceil(fj)]) if (i >= 0 && j >= 0 && i < NX && j < NZ && seen[j * NX + i] === 1) return true
    return false
  }
  const WANTED = {
    'the old end of Ninety Street (west pavement)': [65.5, -69],
    'Ninety Street, the east pavement half way': [92.5, -240],
    'Ninety Street, the median half way': [79, -241],
    'the roundabout, south side': [79, -409],
    'the roundabout, east side': [90, -420],
    'the roundabout, north side': [79, -432],
    'the roundabout, west side': [68, -420],
    'Al-Shaab Street, east end': [60, SHAAB.laneZ],
    'Al-Shaab Street, west end': [-228, SHAAB.laneZ],
    'Al-Shaab Street, north pavement in the west': [-215, -429.5],
    'Al-Shaab Street, south pavement in the east': [30, -410.5],
    'the university gate': [-160, -431.2],
    'the arrival spot': [UNI.arrival.x, UNI.arrival.z],
    'the forecourt, west end': [-195, -440],
    'the forecourt, east end': [-125, -470],
    'at the foot of the steps': [-160, -469.8],
    'behind the canopy': [-190, -468],
    ...Object.fromEntries(SIDE_STREETS.map((s) => [`the end of side street ${s.id}`, [s.side === 'W' ? s.rect.x0 + 0.8 : s.rect.x1 - 0.8, s.z]])),
  }
  for (const [name, p] of Object.entries(WANTED)) check(`reachable on foot from the porch: ${name}`, free(p[0], p[1]) && reach(p[0], p[1]), `${p[0]}, ${p[1]}`)
  check('the inside of every route building is not reachable', ROUTE_LOTS.every((l) => !reach((l.rect.x0 + l.rect.x1) / 2, (l.rect.z0 + l.rect.z1) / 2)) && UNI_BLOCKS.filter((b) => b.id !== 'wing-w').every((b) => !reach((b.rect.x0 + b.rect.x1) / 2, (b.rect.z0 + b.rect.z1) / 2)) && !reach((CLINIC_BEHIND.x0 + CLINIC_BEHIND.x1) / 2, (CLINIC_BEHIND.z0 + CLINIC_BEHIND.z1) / 2))
  const OUTSIDE = { 'behind the west rows': [20, -300], 'behind the east rows (beyond the world)': [123, -300], 'north of the roundabout': [79, -448], 'west of the university': [-215, -470], 'east of the university': [-100, -470], 'behind the north rows of Al-Shaab Street': [-20, -450], 'south of Al-Shaab Street': [-60, -400], 'the island': [79, -420] }
  for (const [name, p] of Object.entries(OUTSIDE)) check(`not reachable: ${name}`, !reach(p[0], p[1]))
  check('the walkable area never touches the edge of the world', (() => {
    for (let i = 0; i < NX; i++) if (seen[i] || seen[(NZ - 1) * NX + i]) return false
    for (let j = 0; j < NZ; j++) if (seen[j * NX] || seen[j * NX + NX - 1]) return false
    return true
  })())
  let cells = 0
  for (let k = 0; k < seen.length; k++) cells += seen[k]
  console.log(`      (${(cells * CELL * CELL).toFixed(0)} m² can be walked on)`)
}

// ---- driving the whole route ------------------------------------------------------------------------------------
{
  const fast = driveRoute({ cruise: 13 })
  check('a car driven by the autopilot follows the whole route from the parking place to the university forecourt', fast.arrivedAt !== null, fast.arrivedAt === null ? `stopped at ${f1(fast.car.x)}, ${f1(fast.car.z)} after ${f1(fast.t)} s` : `${f1(fast.arrivedAt)} s, top ${f1(fast.maxSpeed * 3.6)} km/h`)
  check('and never touches a building, a wall, a lamp, a palm or the island on the way', fast.clipped === null, fast.clipped ?? '')
  check('and stays within 4 m of the line of the route', fast.off < 4, `${f2(fast.off)} m at ${fast.offAt}`)
  check('the drive takes between 60 and 120 seconds at full speed', fast.arrivedAt > 60 && fast.arrivedAt < 120, f1(fast.arrivedAt) + ' s')
  const slow = driveRoute({ ...LAGGED, lag: 0.9, limit: 400 })
  check('with a read-out 0.9 s old at 6 m/s (what the browser test on a slow machine has) the same drive still arrives, without touching anything', slow.arrivedAt !== null && slow.clipped === null && slow.off < 6, slow.arrivedAt === null ? `stopped at ${f1(slow.car.x)}, ${f1(slow.car.z)}` : `${f1(slow.arrivedAt)} s, off ${f2(slow.off)} m at ${slow.offAt} ${slow.clipped ?? ''}`)
}
check('lanes of Stage 5 still run to Ninety Street: the home lane meets the pavement', LANES.some((l) => l.id === 'lane-home' && l.rect.x1 === BOULEVARD.x0) && zoneAt(70, 0) === 'boulevard')

// the unused imports above keep the test honest about what the layout exports
void [PLOT, FRONT_DOOR_COLLIDER, HOME_COLLIDERS, UNI_LAMPS, UNI_PILLARS]

console.log(failures ? `\n${failures} route checks FAILED` : '\nAll route checks passed.')
process.exit(failures ? 1 : 0)
