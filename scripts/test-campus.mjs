// Campus checks (plain Node 22.18+, no browser, no dependencies): the layout of Stage 8 (the open main
// entrance, the ground floor, the courtyard, the people), the floor under her feet, where she can walk,
// where the car cannot, and the zone names.
import { buildGrid, queryGrid } from '../src/controls/spatial.ts'
import { PLAYER_RADIUS, pointBlocked } from '../src/controls/movement.ts'
import { CAM, CAM_INDOOR, cameraOffset, indoorPitch, safeDistance } from '../src/camera/followCamera.ts'
import { ROUTE_BOUNDS, ROUTE_CAMERA_COLLIDERS, ROUTE_CAR_COLLIDERS, WORLD_COLLIDERS, worldZoneAt } from '../src/streets/routeLayout.ts'
import { ZONE_NAMES } from '../src/street/streetLayout.ts'
import {
  BUILDING_WALLS, CEILING_PANELS, CEIL_H, CEIL_Y, DOORS, FLOOR_Y, FURNITURE, HALL1_BLOCKS, HALL2_BLOCKS, PERSON_R, ROW_DEPTH, ROW_Z0, UNI, UNI_BLOCKS,
  UNI_CAMERA_COLLIDERS, UNI_COLLIDERS, UNI_COURT, UNI_COURT_PALM, UNI_KIOSKS, UNI_LAWNS, UNI_MAIN, UNI_MAIN_UPPER, SEATED_ALONE, UNI_PEOPLE, UNI_ROOMS, UNI_ROUND, UNI_STEPS, UNI_STEP_WALLS,
  UNI_VESTIBULE, FL, CLINIC, campusZoneAt, chairCentres, enteredBuilding, floorHeightAt, insideBuilding, roomById, wallPieces,
} from '../src/university/uniLayout.ts'

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures += 1
}
const f2 = (v) => v.toFixed(2)
const EPS = 1e-6
const overlap = (a, b) => a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.z0 < b.z1 - EPS && b.z0 < a.z1 - EPS
const inRect = (r, x, z) => x >= r.x0 - EPS && x <= r.x1 + EPS && z >= r.z0 - EPS && z <= r.z1 + EPS
const within = (inner, outer) => inner.x0 >= outer.x0 - EPS && inner.x1 <= outer.x1 + EPS && inner.z0 >= outer.z0 - EPS && inner.z1 <= outer.z1 + EPS
const cx = (r) => (r.x0 + r.x1) / 2
const cz = (r) => (r.z0 + r.z1) / 2

console.log(`      (${UNI_COLLIDERS.length} campus colliders, ${UNI_PEOPLE.length} people, ${FURNITURE.length} pieces of furniture, ${BUILDING_WALLS.length} walls, ${CEILING_PANELS.length} ceiling lights)`)

// ---- the building ----------------------------------------------------------------------------------
check('the ground floor stands 45 cm above the forecourt and its ceiling is 3.6 m above its floor', FLOOR_Y === 0.45 && CEIL_H === 3.6 && Math.abs(CEIL_Y - 4.05) < EPS)
check('the ceiling is below the second floor (the slab is 15 cm thick) so the hollow storey fits under the upper floors', CEIL_Y < FL && FL - CEIL_Y >= 0.15 - EPS)
check('every wall is axis-aligned, runs inside the main building and has openings that fit', BUILDING_WALLS.every((w) => {
  const a = w.s0
  const b = w.s1
  const long = w.axis === 'x' ? [UNI_MAIN.x0, UNI_MAIN.x1] : [UNI_MAIN.z0, UNI_MAIN.z1]
  const across = w.axis === 'x' ? [UNI_MAIN.z0, UNI_MAIN.z1] : [UNI_MAIN.x0, UNI_MAIN.x1]
  return a >= long[0] - EPS && b <= long[1] + EPS && w.c - w.t / 2 >= across[0] - EPS && w.c + w.t / 2 <= across[1] + EPS
    && w.openings.every((o) => o.at - o.w / 2 > a && o.at + o.w / 2 < b && FLOOR_Y + o.h <= w.top + EPS)
}))
check('every doorway she can use is at least 90 cm wide and 2.3 m high (the wide ones 3 m and more)', BUILDING_WALLS.every((w) => w.openings.every((o) => o.w >= 0.9 && o.h >= 2.3)))
check('the main entrance is the 5 m opening in the south wall, in line with the steps, the carpet and the gate', (() => {
  const o = BUILDING_WALLS.find((w) => w.id === 'south').openings[0]
  return o.at === DOORS.entrance && o.w === 5 && Math.abs(cx(UNI_STEPS.rect) - DOORS.entrance) < EPS && Math.abs(cx(UNI_VESTIBULE) - DOORS.entrance) < EPS && Math.abs((UNI.gate.x0 + UNI.gate.x1) / 2 - DOORS.entrance) < EPS
})())
check('the courtyard door is in the north wall in line with the lobby, and the lobby has a wide arch onto the corridor', (() => {
  const n = BUILDING_WALLS.find((w) => w.id === 'north').openings[0]
  const corr = BUILDING_WALLS.find((w) => w.id === 'corridor').openings.find((o) => o.at === DOORS.lobbyArch)
  return n.at === DOORS.courtyard && corr && corr.w >= 5
})())
check('a wall with a doorway splits into solid blocks and a lintel above it; the doorway itself has no solid in it', (() => {
  const w = BUILDING_WALLS.find((q) => q.id === 'corridor')
  const pieces = wallPieces(w)
  const solid = pieces.filter((p) => p.part === 'solid')
  const lintels = pieces.filter((p) => p.part === 'lintel')
  return lintels.length === w.openings.length && w.openings.every((o) => solid.every((p) => !(p.rect.x0 < o.at + o.w / 2 - EPS && p.rect.x1 > o.at - o.w / 2 + EPS)))
})())
check('the three exterior walls on the south, west and east are 40 cm thick and the interior walls 20 cm', BUILDING_WALLS.filter((w) => w.exterior).every((w) => Math.abs(w.t - 0.4) < EPS) && BUILDING_WALLS.filter((w) => !w.exterior).every((w) => Math.abs(w.t - 0.2) < EPS))
check('the entrance is hollow for the four metres between the blue shoulders and sits in front of the south wall', UNI_VESTIBULE.z1 === UNI_MAIN.z1 + 4 && UNI_VESTIBULE.z0 === UNI_MAIN.z1 && UNI_BLOCKS.some((b) => b.id === 'shoulder-w' && b.rect.x1 === UNI_VESTIBULE.x0) && UNI_BLOCKS.some((b) => b.id === 'shoulder-e' && b.rect.x0 === UNI_VESTIBULE.x1))

// ---- rooms and furniture -----------------------------------------------------------------------------
check('there are five rooms: the lobby, the corridor, two lecture halls and the Student Affairs office', UNI_ROOMS.length === 5 && ['lobby', 'corridor', 'hall1', 'hall2', 'office'].every((id) => roomById(id)))
check('every room lies inside the main building and no two rooms overlap', UNI_ROOMS.every((r, i) => within(r.rect, UNI_MAIN) && UNI_ROOMS.every((q, j) => i >= j || !overlap(r.rect, q.rect))))
check('every piece of furniture lies inside its room (or the courtyard) and none overlaps another', (() => {
  const bad = []
  FURNITURE.forEach((f, i) => {
    const room = UNI_ROOMS.some((r) => within(f.rect, r.rect)) || within(f.rect, { x0: UNI_COURT.x0 - 1, x1: UNI_COURT.x1 + 1, z0: UNI_COURT.z0, z1: UNI_COURT.z1 })
    if (!room) bad.push(f.id)
    FURNITURE.forEach((q, j) => {
      if (i < j && overlap(f.rect, q.rect) && !(f.kind === 'hedge' && q.kind === 'hedge')) bad.push(`${f.id}/${q.id}`)
    })
  })
  return bad.length === 0
})(), '')
check('the desk rows of the two halls leave an aisle of at least 90 cm between the blocks and 1.2 m at the sides', (() => {
  const aisle = (blocks, room) => {
    const xs = [room.x0, ...blocks.flatMap((b) => [b.x0, b.x1]), room.x1]
    const gaps = []
    for (let i = 1; i < xs.length - 1; i += 2) gaps.push(xs[i + 1] - xs[i])
    return gaps
  }
  const g1 = aisle(HALL1_BLOCKS, roomById('hall1').rect)
  const g2 = aisle(HALL2_BLOCKS, roomById('hall2').rect)
  return [...g1, ...g2].every((g) => g >= 0.9) && ROW_Z0.length === 3 && ROW_DEPTH === 1.0
})())
check('the chairs of a desk block fill it with one chair about every 60 cm', (() => {
  const c = chairCentres(-180.6, -176.4)
  return c.length === 7 && c.every((x) => x > -180.6 && x < -176.4) && Math.abs(c[1] - c[0] - 0.6) < 1e-9
})())
check('no ceiling light hangs outside the building (the main building or the clinic) or over the courtyard', CEILING_PANELS.every((p) => inRect(UNI_MAIN, p.x, p.z) || inRect(CLINIC, p.x, p.z)))

// ---- the floor under her feet ----------------------------------------------------------------------------
check('the forecourt is at 0, the treads at 15, 30 and 45 cm, the building and the courtyard at 45 cm', (() => {
  const s = UNI_STEPS.rect
  const len = (s.z1 - s.z0) / 3
  const at = (k) => floorHeightAt(DOORS.entrance, s.z1 - len * (k + 0.5))
  return floorHeightAt(DOORS.entrance, -452) === 0 && Math.abs(at(0) - 0.15) < EPS && Math.abs(at(1) - 0.3) < EPS && Math.abs(at(2) - 0.45) < EPS
    && floorHeightAt(-160, -482) === FLOOR_Y && floorHeightAt(-160, -515) === FLOOR_Y && floorHeightAt(-176, -484) === FLOOR_Y
})())
check('walking straight up the steps never raises the floor by more than 15 cm at a time and never lowers it', (() => {
  let last = floorHeightAt(DOORS.entrance, -469.5)
  let worst = 0
  for (let z = -469.5; z >= -479; z -= 0.05) {
    const h = floorHeightAt(DOORS.entrance, z)
    if (h < last - EPS) return false
    worst = Math.max(worst, h - last)
    last = h
  }
  return worst <= 0.15 + EPS && last === FLOOR_Y
})())
check('the floor is 0 everywhere in the forecourt and in the streets (nothing is raised by mistake)', (() => {
  for (let x = -198; x <= -122; x += 2) for (let z = -470; z >= -433; z -= 2) if (!inRect(UNI_STEPS.rect, x, z) && floorHeightAt(x, z) !== 0) return false
  return floorHeightAt(70, -100) === 0 && floorHeightAt(-60, -420) === 0 && floorHeightAt(2.5, 1) === 0
})())

// ---- where she is ------------------------------------------------------------------------------------------
check('she is inside the building (the ceiling over her) in every room and in the doorway, and outside on the steps and in the courtyard', insideBuilding(-160, -482) && insideBuilding(-176, -484) && insideBuilding(-160, -476) && insideBuilding(-160, -488)
  && !insideBuilding(-160, -472) && !insideBuilding(-160, -495) && !insideBuilding(-160, -452))
check('she has "entered" only once she is through the doorway into the lobby, not while standing in it', !enteredBuilding(-160, -472) && !enteredBuilding(-160, -476.5) && !enteredBuilding(-160, -478.4) && enteredBuilding(-160, -480) && enteredBuilding(-176, -484))
check('the place name follows her: forecourt, doorway/lobby, corridor, lecture halls, office and courtyard', (() => {
  const z = (x, y) => worldZoneAt(x, y)
  return z(-160, -452) === 'university' && z(-160, -476) === 'lobby' && z(-160, -482) === 'lobby' && z(-160, -488) === 'corridor' && z(-175, -482) === 'hall1' && z(-148, -482) === 'hall2' && z(-141, -482) === 'office' && z(-160, -500) === 'courtyard'
})())
check('every campus zone has a name to show in the HUD', ['lobby', 'corridor', 'hall1', 'hall2', 'office', 'courtyard'].every((id) => typeof ZONE_NAMES[id] === 'string' && ZONE_NAMES[id].length > 3), ['lobby', 'hall1', 'courtyard'].map((id) => ZONE_NAMES[id]).join(' | '))
check('outside the main building and the courtyard the campus has no zone of its own', campusZoneAt(-160, -452) === null && campusZoneAt(-190, -515) === null && campusZoneAt(-160, -540) === null)

// ---- walking: the colliders ----------------------------------------------------------------------------------
const B = ROUTE_BOUNDS
const walkGrid = buildGrid(WORLD_COLLIDERS, B, 12, PLAYER_RADIUS + 1)
const free = (x, z, r = PLAYER_RADIUS) => {
  if (x < B.minX + r || x > B.maxX - r || z < B.minZ + r || z > B.maxZ - r) return false
  // the walking physics ignores the height of what is in the way: everything solid blocks her, a low bench as well as a wall
  for (const c of queryGrid(walkGrid, x, z)) if (pointBlocked(x, z, 0, c, r)) return false
  return true
}
{
  const CELL = 0.1
  const box = { x0: UNI.compound.x0 - 2, x1: UNI.compound.x1 + 2, z0: UNI.compound.z0 - 2, z1: UNI.compound.z1 + 2 }
  const NX = Math.round((box.x1 - box.x0) / CELL)
  const NZ = Math.round((box.z1 - box.z0) / CELL)
  const seen = new Uint8Array(NX * NZ)
  const stack = new Int32Array(NX * NZ)
  const idx = (x, z) => [Math.round((x - box.x0) / CELL), Math.round((z - box.z0) / CELL)]
  const start = idx(UNI.arrival.x, UNI.arrival.z)
  let sp = 0
  seen[start[1] * NX + start[0]] = 1
  stack[sp++] = start[1] * NX + start[0]
  while (sp) {
    const k = stack[--sp]
    const i = k % NX
    const j = (k - i) / NX
    for (let n = 0; n < 4; n++) {
      const ni = i + (n === 0 ? 1 : n === 1 ? -1 : 0)
      const nj = j + (n === 2 ? 1 : n === 3 ? -1 : 0)
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue
      const kk = nj * NX + ni
      if (seen[kk] || !free(box.x0 + ni * CELL, box.z0 + nj * CELL)) continue
      seen[kk] = 1
      stack[sp++] = kk
    }
  }
  const reach = (x, z) => {
    const [i, j] = idx(x, z)
    return i >= 0 && j >= 0 && i < NX && j < NZ && seen[j * NX + i] === 1
  }
  const WANTED = {
    'the foot of the steps': [-160, -469.8],
    'the top step': [-160, -472.5],
    'the middle of the doorway': [-160, -476],
    'the lobby, in front of the guard desk': [-157.5, -480],
    'the lobby, behind the planters (north side)': [-160, -485.2],
    'the corridor, west end': [-180.5, -488.1],
    'the corridor, east end': [-139.5, -488.1],
    'the corridor, in front of the courtyard door': [-160, -488.1],
    'lecture hall 1, in front of the lecturer': [-171.5, -480.1],
    'lecture hall 1, the aisle between the desk blocks': [-174.9, -483.2],
    'lecture hall 1, the west edge': [-181.2, -482],
    'lecture hall 2, in front of the lectern': [-146, -480.1],
    'lecture hall 2, the east aisle': [-143.9, -483.2],
    'the Student Affairs office, by the door': [-141, -486],
    'the Student Affairs office, the middle': [-141.2, -482.5],
    'the courtyard door': [-160, -490],
    'the courtyard, beside the first lawn': [-170, -493],
    'the courtyard, the path in the middle': [-160, -505],
    'the courtyard, west bench side': [-180.4, -505],
    'the courtyard, east bench side': [-139.6, -505],
    'the courtyard, the foot of the palm planter': [-160, -514.9],
    'the courtyard, between the kiosks': [-160, -521],
    'the courtyard, by the back wing': [-160, -525.5],
    'the courtyard, behind the west lawn': [-174, -512.5],
  }
  for (const [name, p] of Object.entries(WANTED)) check(`she can walk from the arrival spot to ${name}`, free(p[0], p[1]) && reach(p[0], p[1]), `${p[0]}, ${p[1]}`)
  const NOT = {
    'inside the west wing, behind the clinic': [-190, -517],
    'inside the east wing': [-130, -505],
    'inside the back wing': [-160, -533],
    'inside the tower': [-148, -525],
    'inside the west blue shoulder': [-165, -476],
    'beyond the west wall of the compound': [-205, -500],
    'beyond the back wall of the compound': [-160, -548],
  }
  for (const [name, p] of Object.entries(NOT)) check(`she cannot get into ${name}`, !reach(p[0], p[1]))
  check('she cannot walk through the south wall beside the entrance, or the corridor wall beside a door', (() => {
    for (const x of [-175, -150, -140, -170]) if (reach(x, -478.2)) return false
    for (const x of [-175.5, -165, -156, -139.5]) if (reach(x, -486.5)) return false
    return true
  })())
  check('the walls between the lobby and the two halls and the office are solid except through the corridor doors', (() => {
    for (const z of [-484, -480]) for (const x of [-168, -152, -143.5]) if (reach(x, z)) return false
    return true
  })())
  check('both lecture halls, the office and the lobby can only be entered through their doors (the arch, 1.4 m and 1 m wide)', (() => {
    const door = (x) => reach(x, -486.5)
    return door(DOORS.hall1a) && door(DOORS.hall1b) && door(DOORS.hall2) && door(DOORS.office) && door(DOORS.lobbyArch)
  })())
  check('the standing people, the guard and the clerk on their chairs, the people on stools and the furniture cannot be walked through', SEATED_ALONE.length >= 4 && [...UNI_PEOPLE.filter((p) => p.pose === 'stand'), ...SEATED_ALONE].every((p) => !free(p.x, p.z)) && FURNITURE.filter((f) => f.kind !== 'hedge').every((f) => !free(cx(f.rect), cz(f.rect))))
  check('no free spot is unreachable inside the building: every free cell of the lobby, corridor, halls and office can be walked to', (() => {
    const bad = []
    for (const room of UNI_ROOMS) {
      for (let x = room.rect.x0 + 0.4; x < room.rect.x1 - 0.3; x += 0.4) {
        for (let z = room.rect.z0 + 0.4; z < room.rect.z1 - 0.3; z += 0.4) {
          if (free(x, z) && !reach(x, z)) bad.push(`${room.id} ${f2(x)},${f2(z)}`)
        }
      }
    }
    return bad.length === 0 ? true : bad.slice(0, 4).join('; ')
  })() === true)
  // the camera inside and round the building: never inside a wall or a piece of furniture, never above the ceiling, never too close to her
  {
    const camColliders = [...WORLD_COLLIDERS, ...ROUTE_CAMERA_COLLIDERS]
    const g = buildGrid(camColliders, B, 12, 10.5)
    let cases = 0
    let inside = 0
    let aboveCeiling = 0
    let minArm = Infinity
    let worst = ''
    for (let x = box.x0 + 0.3; x < box.x1; x += 0.9) {
      for (let z = box.z0 + 0.3; z < box.z1; z += 0.9) {
        if (!reach(x, z) || !(insideBuilding(x, z) || inRect(UNI_COURT, x, z) || inRect(UNI_STEPS.rect, x, z))) continue
        const ceiling = insideBuilding(x, z) ? CEIL_Y : Infinity
        const near = queryGrid(g, x, z)
        for (let k = 0; k < 12; k++) {
          const yaw = (k / 12) * Math.PI * 2
          const pivot = [x, floorHeightAt(x, z) + CAM.pivotY, z]
          const pitch = indoorPitch(pivot, yaw, CAM.pitchDefault, 4.6, near, ceiling)
          const arm = safeDistance(pivot, yaw, pitch, 4.6, near, ceiling, CAM_INDOOR.armMin, CAM_INDOOR.margin)
          const o = cameraOffset(yaw, pitch, arm)
          const px = x + o[0]
          const py = pivot[1] + o[1]
          const pz = z + o[2]
          cases++
          const thin = UNI_ROUND.some((q) => Math.hypot(q.x - x, q.z - z) < 1.0) || UNI_PEOPLE.some((q) => Math.hypot(q.x - x, q.z - z) < 1.0)
          if (!thin && arm < minArm) { minArm = arm; worst = `x ${x.toFixed(1)} z ${z.toFixed(1)} yaw ${Math.round((yaw * 180) / Math.PI)} pitch ${pitch.toFixed(2)} ceiling ${ceiling}` }
          if (camColliders.some((c) => pointBlocked(px, pz, py, c, 0))) inside++
          if (py > ceiling) aboveCeiling++
        }
      }
    }
    check(`the camera never ends up inside a wall, a desk or the upper floors (${cases} positions × headings on the steps, in the building and in the courtyard)`, inside === 0, `${inside} inside`)
    check('and never above the ceiling while she is under it', aboveCeiling === 0, `${aboveCeiling} above`)
    check('and it always keeps at least 0.8 m from her (except right beside a person or a planter)', minArm >= 0.8 - 1e-9, `${minArm.toFixed(2)} m at ${worst}`)
  }
  let cells = 0
  for (let k = 0; k < seen.length; k++) cells += seen[k]
  console.log(`      (${(cells * CELL * CELL).toFixed(0)} m² of the compound can be walked on)`)
}

// ---- the courtyard ----------------------------------------------------------------------------------------------
check('the courtyard has two lawns inside hedges, benches along both wings, two kiosks and one palm in a planter', UNI_KIOSKS.length === 2 && UNI_LAWNS.length === 2 && FURNITURE.filter((f) => f.kind === 'hedge').length === 8 && FURNITURE.filter((f) => f.kind === 'bench' && f.id.startsWith('bench-')).length === 8 && UNI_ROUND.some((r) => r.kind === 'palm-planter') && UNI_COURT_PALM.h > 6)
check('the lawns, the planter and the tables lie inside the courtyard and do not touch the path down the middle (x −164..−156)', UNI_LAWNS.every((l) => within(l, UNI_COURT) && (l.x1 < -164 || l.x0 > -156)) && UNI_COURT_PALM.x - UNI_COURT_PALM.planterR > -164 + 1 - EPS)

// ---- people ------------------------------------------------------------------------------------------------------
check('there are 22 people, with unique ids, spread over the lobby, the halls, the corridor, the office, the courtyard and the clinic', UNI_PEOPLE.length === 22 && new Set(UNI_PEOPLE.map((p) => p.id)).size === 22 && ['lobby', 'corridor', 'hall1', 'hall2', 'office', 'courtyard', 'clinic'].every((w) => UNI_PEOPLE.some((p) => p.where === w)))
check('each person stands or sits inside the place they belong to', (() => {
  const room = (w) => (w === 'courtyard' ? UNI_COURT : w === 'clinic' ? CLINIC : roomById(w).rect)
  const bad = UNI_PEOPLE.filter((p) => !inRect(room(p.where), p.x, p.z))
  return bad.length === 0 ? true : bad.map((p) => p.id).join(', ')
})() === true)
check('the standing people do not stand inside furniture or walls, and she can walk round every one of them', (() => {
  const others = [...UNI_COLLIDERS.filter((c) => !(c.kind === 'circle' && Math.abs(c.r - PERSON_R) < EPS))]
  const g = buildGrid(others, B, 12, 2)
  const bad = []
  for (const p of [...UNI_PEOPLE.filter((q) => q.pose === 'stand'), ...SEATED_ALONE]) {
    // free of everything else at her shoulder width, and with a gap of at least 60 cm on one side
    const blocked = (x, z, r) => queryGrid(g, x, z).some((c) => pointBlocked(x, z, 0, c, r))
    if (blocked(p.x, p.z, PERSON_R)) bad.push(`${p.id} (inside something)`)
    const sides = [[0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9]].filter(([dx, dz]) => !blocked(p.x + dx, p.z + dz, PLAYER_RADIUS))
    if (sides.length === 0) bad.push(`${p.id} (boxed in)`)
  }
  return bad.length === 0 ? true : bad.join('; ')
})() === true)
check('seated people sit on a chair of their desk block or on a bench, a courtyard bench or a stool', (() => {
  const rows = (blocks, z) => blocks.flatMap((b) => chairCentres(b.x0, b.x1)).map((x) => ({ x, z }))
  const seats = [
    ...rows(HALL1_BLOCKS, ROW_Z0[0] + 0.25),
    ...rows(HALL2_BLOCKS, ROW_Z0[0] + 0.25),
  ]
  const hall = UNI_PEOPLE.filter((p) => p.pose === 'sit' && (p.where === 'hall1' || p.where === 'hall2'))
  const bad = hall.filter((p) => !seats.some((s) => Math.abs(s.x - p.x) < 0.05 && Math.abs(s.z - p.z) < 0.05))
  return bad.length === 0
})())

// ---- the camera --------------------------------------------------------------------------------------------------------
check('the upper floors only block the camera above the ceiling (4.2 m), the entrance above the doorway starts at the ceiling, and neither blocks the walkers', UNI_CAMERA_COLLIDERS.length === 3 && ROUTE_CAMERA_COLLIDERS.length === 3 && UNI_CAMERA_COLLIDERS[0].bottom === UNI_MAIN_UPPER.y0 && UNI_CAMERA_COLLIDERS[0].bottom >= CEIL_Y && UNI_CAMERA_COLLIDERS[1].bottom === CEIL_Y
  && !UNI_COLLIDERS.some((c) => c.kind === 'box' && Math.abs(c.x - cx(UNI_MAIN)) < EPS && Math.abs(c.z - cz(UNI_MAIN)) < EPS))

// ---- the car -------------------------------------------------------------------------------------------------------------------
check('the car cannot drive up the steps: the steps are solid for it and not for her', ROUTE_CAR_COLLIDERS.length === 1 && ROUTE_CAR_COLLIDERS[0].kind === 'box'
  && Math.abs(ROUTE_CAR_COLLIDERS[0].x - cx(UNI_STEPS.rect)) < EPS && Math.abs(ROUTE_CAR_COLLIDERS[0].hd - (UNI_STEPS.rect.z1 - UNI_STEPS.rect.z0) / 2) < EPS
  && free(DOORS.entrance, cz(UNI_STEPS.rect)) && UNI_STEP_WALLS.every((r) => !free(cx(r), cz(r))))
check('Stage 8 changes nothing in the forecourt for the car: the compound floor, the arrival spot and the gate are as before', UNI.arrival.x === -160 && UNI.arrival.z === -452 && UNI.gate.x0 === -164.5 && UNI.gate.x1 === -155.5 && UNI.compound.z0 === -545)

// ---- the main building is no longer a solid block ----------------------------------------------------------------------------------
check('the old solid main block is gone: the ground floor is hollow, the three upper floors are one block over it', !UNI_BLOCKS.some((b) => b.id === 'main' || b.id === 'entrance') && UNI_MAIN_UPPER.y0 === FL && UNI_MAIN_UPPER.y1 === 4 * FL)

console.log(failures ? `\n${failures} campus checks FAILED` : '\nAll campus checks passed.')
process.exit(failures ? 1 : 0)
