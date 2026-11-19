// The route from the home to the university (Stage 7), as plain data and pure functions: no
// three.js, no React, so scripts/test-route.mjs can check it on plain Node. The scene draws it and the
// physics collides with it from the same numbers, so the two can never drift apart.
//
// Ground plane (x, z) in metres like the rest of the game: +x is east, -z is north.
//
// WHAT IS REAL AND WHAT IS ESTIMATED. Real: the university stands on Al-Shaab Street (شارع الشعب), east
// of Inma City in Aden, and its front is a cream stone building of four floors with arched windows and a
// projecting entrance (the user's photographs). Estimated, until the user sends the home's location and
// street-level photographs: where the home is relative to the university, so the whole drive is a
// stylised, COMPRESSED version (about 800 m instead of several kilometres); the roundabout, the side
// streets, the shops on Ninety Street and the lots along Al-Shaab Street follow the character of the
// satellite screenshots, not any real building. Moving something later is a data edit.
//
// The picture, from the home: the lane in front of the gate runs east to Ninety Street; Ninety Street
// (which used to stop at a barrier) goes on north for 330 m between rows of shops, with a few side
// streets; it ends at a roundabout; the third exit, to the west, is Al-Shaab Street, a 16 m street that
// runs west for 290 m with the university's walled compound on its north side.
import type { Bounds, Collider } from '../controls/movement.ts'
import {
  BOULEVARD, LAMP_R, PALM_R, PARAPET_H, STREET_COLLIDERS, mulberry32, splitRow, zoneAt,
  type Lot, type Rect, type Row, type ZoneId,
} from '../street/streetLayout.ts'
import { HOME_COLLIDERS } from '../home/homeLayout.ts'

const R = (x0: number, x1: number, z0: number, z1: number): Rect => ({ x0, x1, z0, z1 })

// ---------------------------------------------------------------------------------------------
// Ninety Street, north of where Stage 5 stopped, and its side streets.
// ---------------------------------------------------------------------------------------------

/** Ninety Street goes on from the old end (z -70) to the roundabout (z -405). */
export const NORTH = { z0: -405, z1: -70 }

/** The roundabout: a paved square the width of Ninety Street with a round island in the middle. */
export const PLAZA = R(BOULEVARD.x0, BOULEVARD.x1, -435, -405)
export const ISLAND = { x: 79, z: -420, r: 7.5, h: 0.45 }
/** The ring road around the island: the lanes in the middle of it. */
export const RING_R = 11.25

/** Side streets: 7 m wide, 14 m long, each ending in a blind wall. */
export const SIDE_W = 7
export const SIDE_L = 14
export interface SideStreet {
  id: string
  side: 'W' | 'E'
  z: number
  rect: Rect
}
const side = (id: string, s: 'W' | 'E', z: number): SideStreet => ({
  id,
  side: s,
  z,
  rect: s === 'W' ? R(BOULEVARD.x0 - SIDE_L, BOULEVARD.x0, z - SIDE_W / 2, z + SIDE_W / 2) : R(BOULEVARD.x1, BOULEVARD.x1 + SIDE_L, z - SIDE_W / 2, z + SIDE_W / 2),
})
export const SIDE_STREETS: SideStreet[] = [side('w1', 'W', -140), side('w2', 'W', -245), side('w3', 'W', -330), side('e1', 'E', -185), side('e2', 'E', -290), side('e3', 'E', -365)]

/** Depth of the building rows along Ninety Street (west rows end at x 38, east rows at x 124). */
const WEST_ROW_X0 = 38
const EAST_ROW_X1 = 124

// ---------------------------------------------------------------------------------------------
// Al-Shaab Street: west from the roundabout, 16 m of asphalt, 3 m pavements, rows of buildings.
// ---------------------------------------------------------------------------------------------

export const SHAAB = {
  x0: -230,
  x1: BOULEVARD.x0,
  z0: -428,
  z1: -412,
  pavN: [-431, -428] as [number, number],
  pavS: [-412, -409] as [number, number],
  /** Middle of the westbound lane (the north half), in right-hand traffic. */
  laneZ: -424,
}

// ---------------------------------------------------------------------------------------------
// The university's compound, on the north side of Al-Shaab Street.
// ---------------------------------------------------------------------------------------------

export const UNI = {
  compound: R(-200, -120, -495, -431),
  /** The gate: an opening in the front wall, with a pillar on each side. */
  gate: { x0: -164.5, x1: -155.5, cx: -160 },
  wallT: 0.3,
  wallH: 2.4,
  floorH: 4.2,
  /** Where she stands when she arrives: in the forecourt, facing the entrance. */
  arrival: { x: -160, z: -452 },
}

export interface UniBlock {
  id: string
  rect: Rect
  floors: number
  height: number
}
const FL = UNI.floorH
export const UNI_BLOCKS: UniBlock[] = [
  { id: 'main', rect: R(-182, -138, -490, -478), floors: 4, height: 4 * FL },
  { id: 'wing-w', rect: R(-198, -182, -490, -480), floors: 2, height: 2 * FL },
  { id: 'wing-e', rect: R(-138, -122, -490, -480), floors: 2, height: 2 * FL },
  // the entrance projects four metres towards the street and is a little taller than the rest
  { id: 'entrance', rect: R(-168, -152, -478, -474), floors: 4, height: 4 * FL + 1.4 },
]
/** Three steps up to the entrance; the red carpet runs up the middle. The door itself opens in Stage 8. */
export const UNI_STEPS = { rect: R(-165, -155, -474, -471), h: 0.45, carpet: R(-161.2, -158.8, -474, -471) }
export const UNI_BOOTH = R(-153.8, -151, -437.6, -434.8)
export const UNI_BOOTH_H = 2.6
export const UNI_CANOPY = { rect: R(-197, -177, -463, -447), h: 3.1 }
export const UNI_CANOPY_POLES: { x: number; z: number }[] = [
  { x: -196, z: -462 }, { x: -186.5, z: -462 }, { x: -178, z: -462 },
  { x: -196, z: -448 }, { x: -186.5, z: -448 }, { x: -178, z: -448 },
]
export const UNI_PALMS: { x: number; z: number; h: number }[] = [
  { x: -173, z: -458, h: 6 }, { x: -147, z: -458, h: 6.4 }, { x: -173, z: -468, h: 5.6 }, { x: -147, z: -468, h: 6 },
  { x: -193, z: -437, h: 5.2 }, { x: -127, z: -437, h: 5.6 },
]
export const UNI_LAMPS: { x: number; z: number }[] = [{ x: -176, z: -440 }, { x: -144, z: -440 }, { x: -176, z: -474 }, { x: -144, z: -474 }]

/** The compound's wall: front (two pieces, the gate between), both sides and the back. */
export const UNI_WALLS: Rect[] = (() => {
  const c = UNI.compound
  const t = UNI.wallT
  return [
    R(c.x0 + t, UNI.gate.x0, c.z1 - t, c.z1),
    R(UNI.gate.x1, c.x1 - t, c.z1 - t, c.z1),
    R(c.x0, c.x0 + t, c.z0, c.z1),
    R(c.x1 - t, c.x1, c.z0, c.z1),
    R(c.x0 + t, c.x1 - t, c.z0, c.z0 + t),
  ]
})()
/** The pillars on each side of the gate carry the sign over it. */
export const UNI_PILLARS: Rect[] = [R(-165.5, UNI.gate.x0, -431.7, -430.7), R(UNI.gate.x1, -154.5, -431.7, -430.7)]
export const UNI_SIGN = { y0: 4.9, y1: 6.3, x0: -165.5, x1: -154.5, z: -431.2 }

// ---------------------------------------------------------------------------------------------
// Roads
// ---------------------------------------------------------------------------------------------

const cw = BOULEVARD.carriageW
const ce = BOULEVARD.carriageE

/** Asphalt of the route (pieces that do not overlap, so nothing flickers where roads meet). */
export const ROUTE_ASPHALT: Rect[] = [
  R(cw[0], cw[1], NORTH.z0, NORTH.z1),
  R(ce[0], ce[1], NORTH.z0, NORTH.z1),
  PLAZA,
  R(SHAAB.x0, SHAAB.x1, SHAAB.z0, SHAAB.z1),
  ...SIDE_STREETS.map((s) => s.rect),
]

/** Paved pieces: the pavements and the median of Ninety Street, and the pavements of Al-Shaab Street. */
export const ROUTE_PAVING: Rect[] = [
  R(BOULEVARD.pavementW[0], BOULEVARD.pavementW[1], NORTH.z0, NORTH.z1),
  R(BOULEVARD.median[0], BOULEVARD.median[1], NORTH.z0, NORTH.z1),
  R(BOULEVARD.pavementE[0], BOULEVARD.pavementE[1], NORTH.z0, NORTH.z1),
  R(SHAAB.x0, SHAAB.x1, SHAAB.pavN[0], SHAAB.pavN[1]),
  R(SHAAB.x0, SHAAB.x1, SHAAB.pavS[0], SHAAB.pavS[1]),
]

/** The paved floor of the compound. */
export const UNI_FLOOR = R(UNI.compound.x0, UNI.compound.x1, UNI.compound.z0, UNI.compound.z1)

// ---------------------------------------------------------------------------------------------
// Buildings: rows of lots, split with a fixed seed so the route is always the same.
// ---------------------------------------------------------------------------------------------

/** The segments of [z0, z1] left between the side streets of one side (north to south). */
function segments(sideId: 'W' | 'E', z0: number, z1: number): [number, number][] {
  const cuts = SIDE_STREETS.filter((s) => s.side === sideId).map((s) => [s.z - SIDE_W / 2, s.z + SIDE_W / 2] as [number, number]).sort((a, b) => a[0] - b[0])
  const out: [number, number][] = []
  let cursor = z0
  for (const [a, b] of cuts) {
    out.push([cursor, a])
    cursor = b
  }
  out.push([cursor, z1])
  return out
}

function routeRows(): Row[] {
  const out: Row[] = []
  // Ninety Street: shops and flats facing it, on both sides, with a side street every so often
  segments('W', -409, NORTH.z1).forEach(([z0, z1], i) => out.push({ id: `rt-bw${i}`, rect: R(WEST_ROW_X0, BOULEVARD.x0, z0, z1), axis: 'z', face: 'E', style: 'shop' }))
  segments('E', NORTH.z0, NORTH.z1).forEach(([z0, z1], i) => out.push({ id: `rt-be${i}`, rect: R(BOULEVARD.x1, EAST_ROW_X1, z0, z1), axis: 'z', face: 'W', style: 'shop' }))
  // the blind end of every side street
  for (const s of SIDE_STREETS) {
    const r = s.rect
    if (s.side === 'W') out.push({ id: `rt-end-${s.id}`, rect: R(WEST_ROW_X0, r.x0, r.z0, r.z1), axis: 'z', face: 'E', style: 'closing' })
    else out.push({ id: `rt-end-${s.id}`, rect: R(r.x1, EAST_ROW_X1, r.z0, r.z1), axis: 'z', face: 'W', style: 'closing' })
  }
  // the roundabout is closed to the north and east (the 1st and 2nd exits do not lead anywhere yet)
  out.push({ id: 'rt-plaza-n', rect: R(PLAZA.x0, PLAZA.x1, -460, PLAZA.z0), axis: 'x', face: 'S', style: 'closing' })
  out.push({ id: 'rt-plaza-e', rect: R(PLAZA.x1, EAST_ROW_X1, PLAZA.z0, PLAZA.z1), axis: 'z', face: 'W', style: 'closing' })
  // Al-Shaab Street: the north side is the university compound between x -200 and -120
  const nz0 = -455
  out.push({ id: 'rt-sn-a', rect: R(SHAAB.x0, UNI.compound.x0, nz0, SHAAB.pavN[0]), axis: 'x', face: 'S', style: 'lane' })
  out.push({ id: 'rt-sn-b', rect: R(UNI.compound.x1, SHAAB.x1, nz0, SHAAB.pavN[0]), axis: 'x', face: 'S', style: 'lane' })
  out.push({ id: 'rt-ss', rect: R(SHAAB.x0, WEST_ROW_X0, SHAAB.pavS[1], -395), axis: 'x', face: 'N', style: 'lane' })
  // the west end of the street
  out.push({ id: 'rt-sw', rect: R(-256, SHAAB.x0, nz0, -395), axis: 'z', face: 'E', style: 'closing' })
  return out
}

export const ROUTE_LOTS: Lot[] = (() => {
  const rng = mulberry32(2024)
  return routeRows().flatMap((row) => splitRow(row, rng))
})()

// ---------------------------------------------------------------------------------------------
// Props: lamps and palms in the median, palms and lamps along Al-Shaab Street, the roundabout's island.
// ---------------------------------------------------------------------------------------------

const MEDIAN_X = (BOULEVARD.median[0] + BOULEVARD.median[1]) / 2

/** Lamps and palms in the median, continuing the pattern of Ninety Street at the old end (z -27 is a lamp). */
export const NORTH_LAMPS: { x: number; z: number }[] = []
export const NORTH_PALMS: { x: number; z: number; h: number }[] = []
for (let k = 1; -27 - 9 * k >= NORTH.z0 + 9; k++) {
  const z = -27 - 9 * k
  if (k % 2 === 0) NORTH_LAMPS.push({ x: MEDIAN_X, z })
  else NORTH_PALMS.push({ x: MEDIAN_X, z, h: 5 + ((k * 7) % 5) * 0.2 })
}

/** Palms on the south pavement of Al-Shaab Street, lamps (one arm over the road) on the north one. */
export const SHAAB_PALMS: { x: number; z: number; h: number }[] = []
for (let x = 40, k = 0; x > SHAAB.x0 + 8; x -= 24, k++) SHAAB_PALMS.push({ x, z: (SHAAB.pavS[0] + SHAAB.pavS[1]) / 2, h: 4.6 + (k % 3) * 0.4 })
export const SHAAB_LAMPS: { x: number; z: number }[] = []
for (let x = 30; x > SHAAB.x0 + 8; x -= 36) if (x < UNI.gate.x0 - 12 || x > UNI.gate.x1 + 12) SHAAB_LAMPS.push({ x, z: SHAAB.pavN[1] - 0.8 })

// ---------------------------------------------------------------------------------------------
// The whole world: bounds, colliders
// ---------------------------------------------------------------------------------------------

/** The playable area: the neighbourhood of Stage 5 plus the route north and west. */
export const ROUTE_BOUNDS: Bounds = { minX: -256, maxX: 124, minZ: -500, maxZ: 33.2 }

const box = (r: Rect, height: number): Collider => ({
  kind: 'box',
  x: (r.x0 + r.x1) / 2,
  z: (r.z0 + r.z1) / 2,
  hw: (r.x1 - r.x0) / 2,
  hd: (r.z1 - r.z0) / 2,
  height,
})

export const ROUTE_COLLIDERS: Collider[] = [
  ...ROUTE_LOTS.map((l) => box(l.rect, l.height + PARAPET_H)),
  ...UNI_BLOCKS.map((b) => box(b.rect, b.height + 1)),
  box(UNI_STEPS.rect, UNI_STEPS.h),
  box(UNI_BOOTH, UNI_BOOTH_H),
  ...UNI_WALLS.map((w) => box(w, UNI.wallH)),
  ...UNI_PILLARS.map((p) => box(p, UNI_SIGN.y1)),
  ...UNI_CANOPY_POLES.map((p): Collider => ({ kind: 'circle', x: p.x, z: p.z, r: 0.16, height: UNI_CANOPY.h })),
  ...UNI_PALMS.map((p): Collider => ({ kind: 'circle', x: p.x, z: p.z, r: PALM_R, height: p.h })),
  ...UNI_LAMPS.map((p): Collider => ({ kind: 'circle', x: p.x, z: p.z, r: LAMP_R, height: 6.5 })),
  { kind: 'circle', x: ISLAND.x, z: ISLAND.z, r: ISLAND.r, height: 1.2 },
  ...NORTH_LAMPS.map((l): Collider => ({ kind: 'circle', x: l.x, z: l.z, r: LAMP_R, height: 6.5 })),
  ...NORTH_PALMS.map((p): Collider => ({ kind: 'circle', x: p.x, z: p.z, r: PALM_R, height: p.h })),
  ...SHAAB_PALMS.map((p): Collider => ({ kind: 'circle', x: p.x, z: p.z, r: PALM_R, height: p.h })),
  ...SHAAB_LAMPS.map((l): Collider => ({ kind: 'circle', x: l.x, z: l.z, r: LAMP_R, height: 6.5 })),
]

/** Everything she or the car can bump into, from the bedroom to the university's steps. */
export const WORLD_COLLIDERS: Collider[] = [...HOME_COLLIDERS, ...STREET_COLLIDERS, ...ROUTE_COLLIDERS]

// ---------------------------------------------------------------------------------------------
// Where she is
// ---------------------------------------------------------------------------------------------

const inRect = (r: Rect, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1

/** Zone names for the HUD: the route's places first, then the neighbourhood's (street/streetLayout.ts). */
export function worldZoneAt(x: number, z: number): ZoneId {
  if (inRect(UNI.compound, x, z)) return 'university'
  if (inRect(PLAZA, x, z)) return 'junction'
  if (x >= SHAAB.x0 && x <= SHAAB.x1 && z >= SHAAB.pavN[0] && z <= SHAAB.pavS[1]) return 'shaab'
  return zoneAt(x, z)
}

/** True once she is inside the university's gate: the drive is over. */
export function atUniversity(x: number, z: number): boolean {
  return inRect(UNI.compound, x, z)
}

// ---------------------------------------------------------------------------------------------
// The drive: a polyline from the home's gate to the forecourt, and what to tell the player along it.
// ---------------------------------------------------------------------------------------------

const ringPoint = (deg: number): [number, number] => [ISLAND.x + RING_R * Math.sin((deg * Math.PI) / 180), ISLAND.z + RING_R * Math.cos((deg * Math.PI) / 180)]

/** Right-hand traffic: north on Ninety Street is the east carriageway, its middle lane. */
const NORTH_LANE_X = (ce[0] + ce[1]) / 2
/** Counter-clockwise round the island from just past the south (30 degrees) to the west exit (250 degrees). */
const RING_DEGREES = [30, 52, 74, 96, 118, 140, 162, 184, 206, 228, 250]

export const ROUTE: [number, number][] = [
  [2.5, 7.6],
  [70, 7.6],
  // across the median where the lamp (z 9) and the palm (z 0) leave a 9 m gap
  [MEDIAN_X, 4.5],
  [NORTH_LANE_X, -4],
  [NORTH_LANE_X, PLAZA.z1 + 9],
  ...RING_DEGREES.map(ringPoint),
  [60, SHAAB.laneZ],
  [UNI.gate.cx, SHAAB.laneZ],
  [UNI.gate.cx, UNI.arrival.z],
]

/** Indices of the route's corners: where the lane ends, the gap in the median, the carriageway, the ring, the gate. */
export const ROUTE_AT = { turn: 1, gap: 2, north: 3, approach: 4, ringStart: 5, ringEnd: 5 + RING_DEGREES.length - 1, shaabEnd: 5 + RING_DEGREES.length, gateTurn: 5 + RING_DEGREES.length + 1, arrival: 5 + RING_DEGREES.length + 2 }

const LEGS: number[] = [0]
for (let i = 1; i < ROUTE.length; i++) LEGS.push(LEGS[i - 1] + Math.hypot(ROUTE[i][0] - ROUTE[i - 1][0], ROUTE[i][1] - ROUTE[i - 1][1]))
/** Length of the drive in metres. */
export const ROUTE_LENGTH = LEGS[LEGS.length - 1]
/** Metres along the route to its n-th corner. */
export const ROUTE_LEGS: readonly number[] = LEGS

/** The point on the route `s` metres from its start. */
export function routePoint(s: number): [number, number] {
  const t = Math.max(0, Math.min(ROUTE_LENGTH, s))
  let i = 1
  while (i < ROUTE.length - 1 && LEGS[i] < t) i++
  const span = LEGS[i] - LEGS[i - 1] || 1
  const k = (t - LEGS[i - 1]) / span
  return [ROUTE[i - 1][0] + (ROUTE[i][0] - ROUTE[i - 1][0]) * k, ROUTE[i - 1][1] + (ROUTE[i][1] - ROUTE[i - 1][1]) * k]
}

export interface RouteFix {
  /** Metres along the route of the nearest point. */
  s: number
  /** How far she is from the route. */
  off: number
}

/** Nearest point on the route to (x, z). */
export function projectOnRoute(x: number, z: number): RouteFix {
  let best: RouteFix = { s: 0, off: Infinity }
  for (let i = 1; i < ROUTE.length; i++) {
    const [ax, az] = ROUTE[i - 1]
    const [bx, bz] = ROUTE[i]
    const dx = bx - ax
    const dz = bz - az
    const len2 = dx * dx + dz * dz || 1
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2))
    const off = Math.hypot(x - (ax + dx * t), z - (az + dz * t))
    if (off < best.off) best = { s: LEGS[i - 1] + t * Math.sqrt(len2), off }
  }
  return best
}

/** How far ahead along the route the arrow looks. */
export const LOOKAHEAD = 22

/** Route position where each instruction starts (found by name from the polyline, not typed in). */
const sOf = (index: number) => LEGS[index]
export const ROUTE_STEPS: { s: number; text: string }[] = [
  { s: 0, text: 'Drive east along the lane to Ninety Street' },
  { s: sOf(ROUTE_AT.turn) - 6, text: 'Turn left onto Ninety Street, heading north' },
  { s: sOf(ROUTE_AT.north), text: 'Keep going north on Ninety Street' },
  { s: sOf(ROUTE_AT.ringStart) - 110, text: 'Roundabout ahead: take the 3rd exit, Al-Shaab Street' },
  { s: sOf(ROUTE_AT.ringStart) - 12, text: 'Round the island, then the 3rd exit: Al-Shaab Street' },
  { s: sOf(ROUTE_AT.ringEnd) + 1, text: 'Straight on along Al-Shaab Street' },
  { s: ROUTE_LENGTH - 90, text: 'The university gate is on your right' },
]

/** The instruction for a place `s` metres along the route. */
export function instructionAt(s: number): string {
  let text = ROUTE_STEPS[0].text
  for (const step of ROUTE_STEPS) if (s >= step.s) text = step.text
  return text
}

/** Metres left to the forecourt, measured along the route and from where she is now. */
export function remainingFrom(x: number, z: number): number {
  const fix = projectOnRoute(x, z)
  return Math.max(0, ROUTE_LENGTH - fix.s) + fix.off
}

/**
 * The arrow on the HUD: degrees clockwise from straight ahead (the way the camera looks, `yaw` in radians
 * with 0 facing south) to the place `LOOKAHEAD` metres further along the route. Pure, so it is tested.
 */
export function arrowDegrees(x: number, z: number, yaw: number): number {
  const fix = projectOnRoute(x, z)
  const [tx, tz] = routePoint(fix.s + LOOKAHEAD)
  const dx = tx - x
  const dz = tz - z
  if (Math.hypot(dx, dz) < 1) return 0
  const ahead = dx * Math.sin(yaw) + dz * Math.cos(yaw)
  const right = dx * -Math.cos(yaw) + dz * Math.sin(yaw)
  return (Math.atan2(right, ahead) * 180) / Math.PI
}

// ---------------------------------------------------------------------------------------------
// The clock
// ---------------------------------------------------------------------------------------------

/**
 * The route is a compressed version of the real drive, so the clock goes by distance: a game minute
 * for every 41.7 m on the ground, on foot or by car, once she has left the yard. The whole drive of
 * about 800 m takes about 19 game minutes (07:00 to about 07:19).
 */
export const CLOCK_MIN_PER_M = 0.024

/** Game minutes that moving `metres` at (x, z) takes off the clock (nothing indoors or in the yard). */
export function minutesFor(metres: number, x: number, z: number): number {
  const zone = zoneAt(x, z)
  if (zone === 'home' || zone === 'yard') return 0
  return metres * CLOCK_MIN_PER_M
}
