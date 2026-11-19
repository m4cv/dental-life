// The university compound as plain data and pure functions (Stages 7 and 8): no three.js, no React, so
// scripts/test-campus.mjs and scripts/test-route.mjs can check it on plain Node. The scene draws it and the
// physics collides with it from the same numbers, so the two can never drift apart.
//
// Ground plane (x, z) in metres like the rest of the game: +x is east, -z is north.
//
// WHAT IS REAL AND WHAT IS ESTIMATED. Real (the user's four photographs): a cream stone building of four
// floors with arched windows, a projecting entrance with blue side panels, three steps and a red carpet,
// and, behind it, a courtyard enclosed by four-floor wings with black-framed windows, a stair tower with
// iron balconies, lawns with hedges, a pink-and-cream paved path, a date palm, tan canopies over a
// cafeteria and blue benches. ESTIMATED: every dimension, the plan of the ground floor (lobby, corridor,
// two lecture halls, a student-affairs office), the furniture, the people, and everything upstairs, which
// is not built (the stairs and the upper floors, and the ground floors of the wings, come with later
// stages). No photograph of the inside exists yet; the inside is a plausible, plain university interior.
import type { Collider } from '../controls/movement.ts'
import type { Rect, ZoneId } from '../street/streetLayout.ts'
import { LAMP_R, PALM_R } from '../street/streetLayout.ts'

export const R = (x0: number, x1: number, z0: number, z1: number): Rect => ({ x0, x1, z0, z1 })
const inRect = (r: Rect, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1

// ---------------------------------------------------------------------------------------------
// The compound
// ---------------------------------------------------------------------------------------------

export const UNI = {
  /** The walled compound: forecourt at the street end, the building behind it, the courtyard behind that. */
  compound: R(-200, -120, -545, -431),
  /** The gate: an opening in the front wall, with a pillar on each side. */
  gate: { x0: -164.5, x1: -155.5, cx: -160 },
  wallT: 0.3,
  wallH: 2.4,
  floorH: 4.2,
  /** Where she stands when she arrives: in the forecourt, facing the entrance. */
  arrival: { x: -160, z: -452 },
}
export const FL = UNI.floorH

/** The ground floor and the courtyard stand 45 cm above the forecourt: three steps up at the entrance. */
export const FLOOR_Y = 0.45
/** Clear height of the ground-floor rooms, and the world height of their ceiling (the slab above is 15 cm thick). */
export const CEIL_H = 3.6
export const CEIL_Y = FLOOR_Y + CEIL_H

/** The main building: 44 m wide, 12 m deep, four floors. Its ground floor is hollow (Stage 8). */
export const UNI_MAIN = R(-182, -138, -490, -478)
/** The doorway passage between the two blue shoulders of the entrance, 5 m wide and 4 m deep. */
export const UNI_VESTIBULE = R(-162.5, -157.5, -478, -474)
/** The courtyard behind the building, enclosed by the main building, two wings and the back wing. */
export const UNI_COURT = R(-182, -138, -527, -490)

export interface UniBlock {
  id: string
  rect: Rect
  floors: number
  height: number
}
/** Solid blocks (nothing inside): the wings, the back wing, the stair tower and the two blue shoulders of the entrance. */
export const UNI_BLOCKS: UniBlock[] = [
  { id: 'wing-w', rect: R(-198, -182, -527, -480), floors: 4, height: 4 * FL },
  { id: 'wing-e', rect: R(-138, -122, -527, -480), floors: 4, height: 4 * FL },
  { id: 'back', rect: R(-198, -122, -537, -527), floors: 4, height: 4 * FL },
  { id: 'tower', rect: R(-152, -144, -527, -523), floors: 4, height: 4 * FL + 3 },
  // the entrance projects four metres towards the street and is a little taller than the rest
  { id: 'shoulder-w', rect: R(-168, -162.5, -478, -474), floors: 4, height: 4 * FL + 1.4 },
  { id: 'shoulder-e', rect: R(-157.5, -152, -478, -474), floors: 4, height: 4 * FL + 1.4 },
]
/** The three upper floors of the main building, over the hollow ground floor. */
export const UNI_MAIN_UPPER = { rect: UNI_MAIN, y0: FL, y1: 4 * FL }
/** The part of the entrance above the doorway. */
export const UNI_ENTRANCE_TOP = { rect: UNI_VESTIBULE, y0: CEIL_Y, y1: 4 * FL + 1.4 }

/** Three steps up to the doorway; the red carpet runs up the middle. She can walk up them (floorHeightAt). */
export const UNI_STEPS = { rect: R(-165, -155, -474, -471), h: FLOOR_Y, treads: 3, carpet: R(-161.2, -158.8, -474, -471) }
/** A low wall on each side of the steps, so nobody climbs the side of a tread. */
export const UNI_STEP_WALLS: Rect[] = [R(-165.4, -165, -474, -470.6), R(-155, -154.6, -474, -470.6)]
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
/** The paved floor of the compound. */
export const UNI_FLOOR = R(UNI.compound.x0, UNI.compound.x1, UNI.compound.z0, UNI.compound.z1)

// ---------------------------------------------------------------------------------------------
// The walls of the ground floor, with their doorways
// ---------------------------------------------------------------------------------------------

export interface WallOpening {
  /** Position along the wall (x for walls running east-west, z for walls running north-south). */
  at: number
  w: number
  /** Clear height above the floor (FLOOR_Y). */
  h: number
}
export interface UniWall {
  id: string
  /** 'x': runs east-west at z = c; 'z': runs north-south at x = c. s0 < s1 are the ends along it. */
  axis: 'x' | 'z'
  c: number
  s0: number
  s1: number
  t: number
  base: number
  top: number
  /** Exterior walls carry the facade texture outside; interior walls are plain on both sides. */
  exterior: boolean
  openings: WallOpening[]
}

const EXT_T = 0.4
const INT_T = 0.2
const ext = (id: string, axis: 'x' | 'z', c: number, s0: number, s1: number, openings: WallOpening[]): UniWall => ({ id, axis, c, s0, s1, t: EXT_T, base: 0, top: FL, exterior: true, openings })
const inn = (id: string, axis: 'x' | 'z', c: number, s0: number, s1: number, openings: WallOpening[]): UniWall => ({ id, axis, c, s0, s1, t: INT_T, base: FLOOR_Y, top: CEIL_Y, exterior: false, openings })
const door = (at: number, w = 1.4, h = 2.5): WallOpening => ({ at, w, h })

/** The three clear-width numbers the tests care about: every doorway is at least a metre wide. */
export const DOORS = { hall1a: -178.5, hall1b: -171.5, hall2: -147.5, office: -141, lobbyArch: -160, courtyard: -160, entrance: -160 }

export const BUILDING_WALLS: UniWall[] = [
  ext('south', 'x', -478.2, -182, -138, [{ at: DOORS.entrance, w: 5, h: CEIL_H }]),
  ext('north', 'x', -489.8, -182, -138, [{ at: DOORS.courtyard, w: 3.2, h: 2.8 }]),
  ext('west', 'z', -181.8, -490, -478, []),
  ext('east', 'z', -138.2, -490, -478, []),
  // the corridor wall: doors to the halls and the office, and a wide arch to the lobby
  inn('corridor', 'x', -486.5, -181.6, -138.4, [door(DOORS.hall1a), door(DOORS.hall1b), { at: DOORS.lobbyArch, w: 6, h: 3 }, door(DOORS.hall2), door(DOORS.office, 1.0, 2.4)]),
  inn('lobby-w', 'z', -168, -486.4, -478.4, []),
  inn('lobby-e', 'z', -152, -486.4, -478.4, []),
  inn('office-w', 'z', -143.5, -486.4, -478.4, []),
]

export interface WallPiece {
  rect: Rect
  y0: number
  y1: number
  part: 'solid' | 'lintel' | 'sill'
}

/** Splits a wall around its doorways into solid blocks, lintels above and (where the floor is raised) sills below. */
export function wallPieces(w: UniWall): WallPiece[] {
  const ops = [...w.openings].sort((a, b) => a.at - b.at)
  const out: WallPiece[] = []
  const mk = (from: number, to: number, y0: number, y1: number, part: WallPiece['part']) => {
    if (to - from < 1e-6 || y1 - y0 < 1e-6) return
    out.push({ rect: w.axis === 'x' ? R(from, to, w.c - w.t / 2, w.c + w.t / 2) : R(w.c - w.t / 2, w.c + w.t / 2, from, to), y0, y1, part })
  }
  let cursor = w.s0
  for (const o of ops) {
    const a = o.at - o.w / 2
    const b = o.at + o.w / 2
    mk(cursor, a, w.base, w.top, 'solid')
    mk(a, b, FLOOR_Y + o.h, w.top, 'lintel')
    if (w.base < FLOOR_Y) mk(a, b, w.base, FLOOR_Y, 'sill')
    cursor = b
  }
  mk(cursor, w.s1, w.base, w.top, 'solid')
  return out
}

const box = (r: Rect, height: number): Collider => ({ kind: 'box', x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, hw: (r.x1 - r.x0) / 2, hd: (r.z1 - r.z0) / 2, height })
const circle = (x: number, z: number, r: number, height: number): Collider => ({ kind: 'circle', x, z, r, height })

export const wallColliders = (w: UniWall): Collider[] => wallPieces(w).filter((p) => p.part === 'solid').map((p) => box(p.rect, w.top))

// ---------------------------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------------------------

export type RoomId = 'lobby' | 'corridor' | 'hall1' | 'hall2' | 'office'
export interface UniRoom {
  id: RoomId
  name: string
  /** The floor, between the faces of the walls. */
  rect: Rect
  floor: 'granite' | 'tile' | 'vinyl'
}
export const UNI_ROOMS: UniRoom[] = [
  { id: 'lobby', name: 'University lobby', rect: R(-167.9, -152.1, -486.4, -478.4), floor: 'granite' },
  { id: 'corridor', name: 'Ground-floor corridor', rect: R(-181.6, -138.4, -489.6, -486.6), floor: 'tile' },
  { id: 'hall1', name: 'Grand Hall', rect: R(-181.6, -168.1, -486.4, -478.4), floor: 'vinyl' },
  { id: 'hall2', name: 'Hall 313', rect: R(-151.9, -143.6, -486.4, -478.4), floor: 'vinyl' },
  { id: 'office', name: 'Student Affairs office', rect: R(-143.4, -138.4, -486.4, -478.4), floor: 'vinyl' },
]
export const roomById = (id: RoomId): UniRoom => UNI_ROOMS.find((r) => r.id === id) as UniRoom

// ---------------------------------------------------------------------------------------------
// Furniture, courtyard features and people
// ---------------------------------------------------------------------------------------------

export type FurnKind = 'deskrow' | 'lectern' | 'guarddesk' | 'bench' | 'cabinet' | 'officedesk' | 'table' | 'hedge'
export interface Furn {
  id: string
  kind: FurnKind
  rect: Rect
  /** Height of the top (above the floor). */
  h: number
  /** The way it faces (a bench faces its sitters' view, a desk row faces the board). */
  facing: 'N' | 'S' | 'E' | 'W'
}
const furn = (id: string, kind: FurnKind, rect: Rect, h: number, facing: Furn['facing'] = 'S'): Furn => ({ id, kind, rect, h, facing })

/** Rows of student desks (a table in front, a chair behind), all facing the board on the south wall. */
export const ROW_Z0 = [-484.6, -483.2, -481.8]
export const ROW_DEPTH = 1.0
export const HALL1_BLOCKS: Rect[] = [R(-180.6, -176.4, 0, 0), R(-173.4, -169.2, 0, 0)]
export const HALL2_BLOCKS: Rect[] = [R(-150.9, -144.6, 0, 0)]

/** The lawns of the courtyard, each with a hedge round it. */
export const UNI_LAWNS: Rect[] = [R(-178, -165, -511, -494), R(-155, -142, -511, -494)]
export const HEDGE_T = 0.5
/** The canopies (the cafeteria) at the back of the courtyard, 3.1 m high. */
export const UNI_KIOSKS: Rect[] = [R(-181, -168, -522, -513), R(-151, -139, -522, -513)]
export const KIOSK_H = 3.1
/** The date palm in the middle of the back of the courtyard, in a round brick planter. */
export const UNI_COURT_PALM = { x: -160, z: -517, h: 7.4, planterR: 1.4 }

/** The centres of the chairs along one block of a desk row: one chair per 60 cm or so, the whole block filled. */
export function chairCentres(x0: number, x1: number): number[] {
  const n = Math.max(1, Math.floor((x1 - x0) / 0.6 + 1e-6))
  const pitch = (x1 - x0) / n
  return Array.from({ length: n }, (_, k) => x0 + (k + 0.5) * pitch)
}

/**
 * Her seat in each lecture hall (Stage 9): the chair at the end of the north desk row, next to the aisle. It is drawn like
 * the other chairs, but its place is left out of the desk row's collider so she can walk in and sit there.
 * `slot` is the free space of the chair (the desk row's chair half, one chair wide).
 */
export interface LectureSeat {
  room: 'hall1' | 'hall2'
  x: number
  z: number
  /** She faces the board on the south wall (0 faces +z). */
  heading: number
  slot: Rect
}
const lectureSeat = (room: LectureSeat['room'], block: Rect): LectureSeat => {
  const xs = chairCentres(block.x0, block.x1)
  const pitch = (block.x1 - block.x0) / xs.length
  const x = xs[xs.length - 1]
  return { room, x, z: ROW_Z0[0] + 0.18, heading: 0, slot: R(x - pitch / 2, x + pitch / 2, ROW_Z0[0], ROW_Z0[0] + ROW_DEPTH / 2) }
}
export const LECTURE_SEATS: Record<LectureSeat['room'], LectureSeat> = {
  hall1: lectureSeat('hall1', HALL1_BLOCKS[0]),
  hall2: lectureSeat('hall2', HALL2_BLOCKS[0]),
}

const hedgeRects = (l: Rect): Rect[] => [
  R(l.x0 - HEDGE_T, l.x1 + HEDGE_T, l.z0 - HEDGE_T, l.z0),
  R(l.x0 - HEDGE_T, l.x1 + HEDGE_T, l.z1, l.z1 + HEDGE_T),
  R(l.x0 - HEDGE_T, l.x0, l.z0, l.z1),
  R(l.x1, l.x1 + HEDGE_T, l.z0, l.z1),
]

export const FURNITURE: Furn[] = (() => {
  const out: Furn[] = []
  ROW_Z0.forEach((z0, i) => {
    HALL1_BLOCKS.forEach((b, j) => out.push(furn(`h1-row${i}-${j}`, 'deskrow', R(b.x0, b.x1, z0, z0 + ROW_DEPTH), 0.8)))
    HALL2_BLOCKS.forEach((b, j) => out.push(furn(`h2-row${i}-${j}`, 'deskrow', R(b.x0, b.x1, z0, z0 + ROW_DEPTH), 0.8)))
  })
  out.push(furn('h1-lectern', 'lectern', R(-175.9, -174.1, -480.3, -479.1), 1.0))
  out.push(furn('h2-lectern', 'lectern', R(-148.3, -147.1, -480.3, -479.1), 1.0))
  out.push(furn('guard-desk', 'guarddesk', R(-155.8, -153.4, -482.2, -480.8), 1.0, 'W'))
  out.push(furn('lobby-bench-a', 'bench', R(-167.6, -167.1, -484.6, -482.8), 0.45, 'E'))
  out.push(furn('lobby-bench-b', 'bench', R(-167.6, -167.1, -481.2, -479.4), 0.45, 'E'))
  out.push(furn('office-desk-a', 'officedesk', R(-142.7, -139.5, -484.2, -483.3), 0.75, 'N'))
  out.push(furn('office-desk-b', 'officedesk', R(-142.7, -140.5, -481.0, -480.1), 0.75, 'N'))
  out.push(furn('office-cabinets', 'cabinet', R(-139.2, -138.4, -485.6, -482.0), 1.8, 'W'))
  // the courtyard: hedges round the lawns, blue benches along both wings, tables under the canopies
  UNI_LAWNS.forEach((l, i) => hedgeRects(l).forEach((r, j) => out.push(furn(`hedge-${i}-${j}`, 'hedge', r, 0.55))))
  for (const z0 of [-509, -505.5, -502, -498.5]) {
    out.push(furn(`bench-w-${z0}`, 'bench', R(-181.8, -181.3, z0, z0 + 1.6), 0.45, 'E'))
    out.push(furn(`bench-e-${z0}`, 'bench', R(-138.7, -138.2, z0, z0 + 1.6), 0.45, 'W'))
  }
  const tables: Rect[] = [R(-179.5, -177, -520.5, -519.5), R(-175, -172.5, -520.5, -519.5), R(-149.5, -147, -520.5, -519.5), R(-145, -142.5, -520.5, -519.5)]
  tables.forEach((r, i) => out.push(furn(`table-${i}`, 'table', r, 0.8)))
  return out
})()

export interface Round {
  id: string
  kind: 'planter' | 'bin' | 'palm-planter'
  x: number
  z: number
  r: number
  h: number
}
export const UNI_ROUND: Round[] = [
  { id: 'lobby-planter-a', kind: 'planter', x: -164.2, z: -485.7, r: 0.35, h: 1.1 },
  { id: 'lobby-planter-b', kind: 'planter', x: -155.8, z: -485.7, r: 0.35, h: 1.1 },
  { id: 'bin-w', kind: 'bin', x: -181.5, z: -511.3, r: 0.25, h: 0.9 },
  { id: 'bin-e', kind: 'bin', x: -138.5, z: -511.3, r: 0.25, h: 0.9 },
  { id: 'palm-planter', kind: 'palm-planter', x: UNI_COURT_PALM.x, z: UNI_COURT_PALM.z, r: UNI_COURT_PALM.planterR, h: 0.5 },
]

export interface Person {
  id: string
  x: number
  z: number
  /** 0 faces +z (south); forward = (sin h, cos h). */
  heading: number
  pose: 'stand' | 'sit'
  /** Which clothes and skin tone (an index into the builder's looks). */
  look: number
  /** Standing people are solid (a small circle); a seated person is part of the bench, chair or desk. */
  where: 'lobby' | 'corridor' | 'hall1' | 'hall2' | 'office' | 'courtyard'
}
const P = (id: string, where: Person['where'], pose: Person['pose'], x: number, z: number, heading: number, look: number): Person => ({ id, where, pose, x, z, heading, look })
const E = Math.PI / 2
const W = -Math.PI / 2
const N = Math.PI
export const UNI_PEOPLE: Person[] = [
  P('guard', 'lobby', 'sit', -157.0, -481.5, E, 0),
  P('lecturer', 'hall1', 'stand', -173.0, -479.6, N, 1),
  // seated students sit on the chairs of the desk rows (see chairCentres)
  P('h1-s1', 'hall1', 'sit', -179.7, -484.35, 0, 2),
  P('h1-s2', 'hall1', 'sit', -178.5, -484.35, 0, 3),
  P('h1-s3', 'hall1', 'sit', -171.9, -484.35, 0, 4),
  P('h1-s4', 'hall1', 'sit', -170.7, -484.35, 0, 5),
  P('corr-a', 'corridor', 'stand', -146.0, -488.3, E, 3),
  P('corr-b', 'corridor', 'stand', -145.2, -488.0, W, 6),
  P('h2-s1', 'hall2', 'sit', -149.955, -484.35, 0, 2),
  P('h2-s2', 'hall2', 'sit', -148.695, -484.35, 0, 4),
  P('clerk', 'office', 'sit', -141.1, -484.9, 0, 5),
  P('court-a', 'courtyard', 'sit', -181.55, -508.2, E, 6),
  P('court-b', 'courtyard', 'sit', -181.55, -501.2, E, 2),
  P('court-c', 'courtyard', 'sit', -138.45, -504.7, W, 4),
  P('kiosk-a', 'courtyard', 'sit', -178.8, -518.9, N, 3),
  P('kiosk-b', 'courtyard', 'sit', -148.4, -518.9, N, 5),
  P('court-d', 'courtyard', 'stand', -163.5, -503.0, E, 2),
  P('court-e', 'courtyard', 'stand', -162.7, -503.3, W, 6),
]
export const PERSON_R = 0.3
export const PERSON_H = 1.7

// ---------------------------------------------------------------------------------------------
// Colliders
// ---------------------------------------------------------------------------------------------

/**
 * The collider(s) of a piece of furniture: a desk row is two (the table half and the chair half, so her seat can be left open);
 * everything else is its rectangle.
 */
export function furnColliders(f: Furn): Collider[] {
  if (f.kind !== 'deskrow') return [box(f.rect, FLOOR_Y + f.h)]
  const r = f.rect
  const mid = r.z0 + ROW_DEPTH / 2
  const out: Collider[] = [box(R(r.x0, r.x1, mid, r.z1), FLOOR_Y + f.h)]
  const chairs = R(r.x0, r.x1, r.z0, mid)
  const hole = Object.values(LECTURE_SEATS).find((q) => q.slot.x0 >= r.x0 - 1e-9 && q.slot.x1 <= r.x1 + 1e-9 && q.slot.z0 === r.z0)
  if (!hole) return [...out, box(chairs, FLOOR_Y + f.h)]
  if (hole.slot.x0 > r.x0 + 1e-9) out.push(box(R(r.x0, hole.slot.x0, chairs.z0, chairs.z1), FLOOR_Y + f.h))
  if (hole.slot.x1 < r.x1 - 1e-9) out.push(box(R(hole.slot.x1, r.x1, chairs.z0, chairs.z1), FLOOR_Y + f.h))
  return out
}

/** Seated people whose chair is not part of a desk block or a bench (the guard, the clerk, the stools at the kiosks): they are solid like the standing ones. */
export const SEATED_ALONE: Person[] = UNI_PEOPLE.filter((p) => p.pose === 'sit' && !FURNITURE.some((f) => inRect(f.rect, p.x, p.z)))

/** Everything solid in the compound, for people and for the car. */
export const UNI_COLLIDERS: Collider[] = [
  ...UNI_BLOCKS.map((b) => box(b.rect, b.height + 1)),
  ...BUILDING_WALLS.flatMap(wallColliders),
  ...UNI_STEP_WALLS.map((r) => box(r, FLOOR_Y)),
  box(UNI_BOOTH, UNI_BOOTH_H),
  ...UNI_WALLS.map((w) => box(w, UNI.wallH)),
  ...UNI_PILLARS.map((p) => box(p, UNI_SIGN.y1)),
  ...UNI_CANOPY_POLES.map((p) => circle(p.x, p.z, 0.16, UNI_CANOPY.h)),
  ...UNI_PALMS.map((p) => circle(p.x, p.z, PALM_R, p.h)),
  ...UNI_LAMPS.map((p) => circle(p.x, p.z, LAMP_R, 6.5)),
  ...FURNITURE.flatMap(furnColliders),
  ...UNI_ROUND.map((r) => circle(r.x, r.z, r.r, FLOOR_Y + r.h)),
  ...UNI_PEOPLE.filter((p) => p.pose === 'stand').map((p) => circle(p.x, p.z, PERSON_R, FLOOR_Y + PERSON_H)),
  ...SEATED_ALONE.map((p) => circle(p.x, p.z, PERSON_R, FLOOR_Y + 1.2)),
]
/** Things only the camera must keep out of: the three upper floors over the hollow ground floor and the entrance above the doorway. */
export const UNI_CAMERA_COLLIDERS: Collider[] = [
  { ...box(UNI_MAIN_UPPER.rect, UNI_MAIN_UPPER.y1 + 1), bottom: UNI_MAIN_UPPER.y0 },
  { ...box(UNI_ENTRANCE_TOP.rect, UNI_ENTRANCE_TOP.y1 + 1), bottom: UNI_ENTRANCE_TOP.y0 },
]
/** The steps are walkable for her, but a car must not climb them (and so must not reach the doorway). */
export const UNI_CAR_COLLIDERS: Collider[] = [box(UNI_STEPS.rect, FLOOR_Y)]

// ---------------------------------------------------------------------------------------------
// Where she is
// ---------------------------------------------------------------------------------------------

/**
 * The height of the floor under (x, z): the forecourt is 0, the three treads rise 15 cm each, and the building
 * and the courtyard stand on the 45 cm of the top tread. Continuous enough for a slow ease in the rig.
 */
export function floorHeightAt(x: number, z: number): number {
  if (inRect(UNI_MAIN, x, z) || inRect(UNI_VESTIBULE, x, z) || inRect(UNI_COURT, x, z)) return FLOOR_Y
  const s = UNI_STEPS.rect
  if (inRect(s, x, z)) {
    const len = (s.z1 - s.z0) / UNI_STEPS.treads
    const k = Math.min(UNI_STEPS.treads, Math.max(0, Math.ceil((s.z1 - z) / len - 1e-9)))
    return (UNI_STEPS.h * k) / UNI_STEPS.treads
  }
  return 0
}

/** True while she is under the ground floor's ceiling (the rooms, the corridor and the doorway). */
export function insideBuilding(x: number, z: number): boolean {
  return inRect(UNI_MAIN, x, z) || inRect(UNI_VESTIBULE, x, z)
}

/** True once she has gone through the doorway into the lobby: the "entered the main building" moment. */
export function enteredBuilding(x: number, z: number): boolean {
  return inRect(UNI_MAIN, x, z) && z <= -478.6
}

/** The place chip inside the compound's buildings and courtyard; null elsewhere (the forecourt stays 'university'). */
export function campusZoneAt(x: number, z: number): ZoneId | null {
  if (inRect(UNI_VESTIBULE, x, z)) return 'lobby'
  if (inRect(UNI_COURT, x, z) && z < -490) return 'courtyard'
  if (!inRect(UNI_MAIN, x, z)) return null
  if (z < -486.5) return 'corridor'
  if (x < -168) return 'hall1'
  if (x < -152) return 'lobby'
  if (x < -143.5) return 'hall2'
  return 'office'
}

/** Where the lights hang in the halls and corridors (the 3D builder puts a panel at each). */
export const CEILING_PANELS: { x: number; z: number; w: number; d: number }[] = [
  { x: -160, z: -482.5, w: 3.2, d: 1.2 },
  { x: -164.5, z: -480, w: 1.6, d: 1.0 },
  { x: -155.5, z: -480, w: 1.6, d: 1.0 },
  ...[-176, -168, -160, -152, -144].map((x) => ({ x, z: -488.1, w: 2.2, d: 0.7 })),
  ...[-178, -171].flatMap((x) => [-484, -480.5].map((z) => ({ x, z, w: 2.6, d: 0.8 }))),
  ...[-484, -480.5].map((z) => ({ x: -147.75, z, w: 2.6, d: 0.8 })),
  { x: -141, z: -483, w: 1.6, d: 0.8 },
  { x: -141, z: -480, w: 1.6, d: 0.8 },
]
