// The way to a lecture hall, as plain geometry (no React, no three.js): from wherever she is inside the university
// compound, the next point to walk to, the distance left along the way and what to do. It does not look at walls:
// the points are chosen so that the straight line to the next one is clear (the doorway, the arch, the corridor, the
// aisles of the halls, the door of the hall). Used by the "next class" card; scripts/test-academics.mjs walks it
// from many places with the real collision code.
//
// Inside the dental clinic (Stage 10) the furniture is too varied for hand-picked points, so there the way is read off a
// distance map computed once from the real colliders (a flood fill from the goal over the free floor): the aim is a point
// about a metre further down that map. The clinic's goals are the hand-wash counter, the mask and glove dispensers and her
// stool; from the corridor she goes in by the double door at its west end.
import { PLAYER_RADIUS, pointBlocked, type Bounds } from '../controls/movement.ts'
import { buildGrid, queryGrid, type ColliderGrid } from '../controls/spatial.ts'
import {
  CLINIC, CLINIC_PASSAGE, CLINIC_PREP, CLINIC_SEAT, DOORS, HALL1_BLOCKS, HALL2_BLOCKS, LECTURE_SEATS, ROW_Z0, UNI_COLLIDERS, UNI_COURT, UNI_MAIN, campusZoneAt, roomById,
} from '../university/uniLayout.ts'
import type { LectureRoom } from './timetable.ts'

export interface Point {
  x: number
  z: number
}
export interface Guide {
  /** The point to walk to next. */
  aim: Point
  /** Metres left, along the points. */
  remaining: number
  /** What to do, in a few words. */
  text: string
}

/** Where the door of each room opens from the corridor (x). */
const DOOR_X: Record<LectureRoom | 'office', number> = { hall1: DOORS.hall1b, hall2: DOORS.hall2, office: DOORS.office }
/** The middle of the corridor, and the strip behind the desks of each hall (the back aisle) just inside the doors. */
const CORRIDOR_Z = -488.1
const BACK_Z = -485.5
/** Past the last row of desks (towards the board) she can cross the hall anywhere. */
const FRONT_Z = -480.4
/** The corridor side of the doors, just outside the wall. */
const OUTSIDE_Z = -487.2
const STEPS_FOOT: Point = { x: -160, z: -468 }
const DOORWAY: Point = { x: DOORS.entrance, z: -476.5 }
const LOBBY: Point = { x: DOORS.lobbyArch, z: -482.5 }
const ARCH: Point = { x: DOORS.lobbyArch, z: -487.6 }
const COURT_DOOR: Point = { x: DOORS.courtyard, z: -488.9 }
/** The Student Affairs office: the way round the clerk's desk is the 70 cm along its west wall. */
const OFFICE_WEST = -143.05
const OFFICE_STRIP_Z = -485.75

/** The lanes of a hall that run north–south between and beside the blocks of desks. */
function lanes(room: LectureRoom): number[] {
  const r = roomById(room).rect
  if (room === 'hall1') {
    const [a, b] = HALL1_BLOCKS
    return [(r.x0 + a.x0) / 2, (a.x1 + b.x0) / 2, (b.x1 + r.x1) / 2]
  }
  const [a] = HALL2_BLOCKS
  return [(r.x0 + a.x0) / 2, (a.x1 + r.x1) / 2]
}
/** The lane a seat opens onto: the nearest one to its east. */
function seatLane(room: LectureRoom): number {
  const seat = LECTURE_SEATS[room]
  return lanes(room)
    .filter((l) => l > seat.x)
    .reduce((best, l) => (l < best ? l : best), Infinity)
}

const len = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z)
const chain = (from: Point, pts: Point[]): number => {
  let d = 0
  let p = from
  for (const q of pts) {
    d += len(p, q)
    p = q
  }
  return d
}
const inRect = (r: { x0: number; x1: number; z0: number; z1: number }, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1
const go = (here: Point, pts: Point[], text: string, extra = 0): Guide => ({ aim: pts[0], remaining: chain(here, pts) + extra, text })

/** From inside a hall (not in the back aisle): the points to the back aisle, by the nearest lane. */
function toBackAisle(room: LectureRoom, x: number, z: number): Point[] {
  const lane = lanes(room).reduce((best, l) => (Math.abs(l - x) < Math.abs(best - x) ? l : best))
  const pts: Point[] = []
  if (Math.abs(lane - x) > 0.3 && z > FRONT_Z) pts.push({ x: lane, z })
  pts.push({ x: lane, z: BACK_Z })
  return pts
}

/** The way to the seat of a lecture hall from (x, z). */
export function guideToSeat(x: number, z: number, room: LectureRoom): Guide {
  const seat = LECTURE_SEATS[room]
  const door = DOOR_X[room]
  const seatPt: Point = { x: seat.x, z: seat.z }
  const here: Point = { x, z }
  const zone = campusZoneAt(x, z)
  const backAisle = z < ROW_Z0[0] - 0.25
  // from the door of the hall to the seat: along the back aisle to the seat's row, then in
  const inward: Point[] = [{ x: door, z: BACK_Z }, { x: seat.x, z: BACK_Z }, seatPt]

  if (zone === room) {
    const lane = seatLane(room)
    const text = 'Take your seat: the end chair of the first row, by the aisle'
    if (backAisle) {
      if (Math.abs(x - seat.x) > 0.4) return go(here, [{ x: seat.x, z: BACK_Z }, seatPt], 'Go along the back aisle to your seat')
      return go(here, [seatPt], text)
    }
    // at the end of the row, or in the aisle beside it: in
    if (Math.abs(z - seat.z) < 0.45 && x > seat.x) return go(here, [seatPt], text)
    if (Math.abs(x - lane) < 0.45) return go(here, [{ x: lane, z: seat.z }, seatPt], 'Walk up the aisle to your seat')
    // in front of the desks: across to the aisle, then up it
    if (z > FRONT_Z) return go(here, [{ x: lane, z }, { x: lane, z: seat.z }, seatPt], 'Go to the aisle by your seat')
    // in another lane: out to the back aisle and along it
    return go(here, [...toBackAisle(room, x, z), { x: seat.x, z: BACK_Z }, seatPt], 'Go along the back aisle to your seat')
  }
  // in the corridor: along it to the door, then in
  if (zone === 'corridor') {
    const corridorAtDoor: Point = { x: door, z: CORRIDOR_Z }
    if (Math.abs(x - door) > 1.2) return go(here, [corridorAtDoor, ...inward], 'Follow the corridor to the hall door')
    return go(here, inward, 'Go in through the hall door')
  }
  return viaCorridor(x, z, zone, [{ x: door, z: CORRIDOR_Z }, ...inward], 0)
}

/**
 * From anywhere that is not the corridor: the way into the corridor, and on along `tail` (the points that follow it), with
 * `extra` metres still to go after the last one. The lobby, the office, the other hall, the clinic, the courtyard and the
 * street all lead there.
 */
function viaCorridor(x: number, z: number, zone: ReturnType<typeof campusZoneAt>, tail: Point[], extra: number): Guide {
  const here: Point = { x, z }
  // in the lobby (and the doorway): through the arch into the corridor
  if (zone === 'lobby') return go(here, [ARCH, ...tail], 'Cross the lobby to the corridor', extra)
  // in the office: round the clerk's desk, then out of its door
  if (zone === 'office') {
    const od = DOOR_X.office
    const out: Point[] = [{ x: od, z: OFFICE_STRIP_Z }, { x: od, z: OUTSIDE_Z }]
    if (z > -485.0) {
      const west: Point[] = Math.abs(x - OFFICE_WEST) > 0.3 ? [{ x: OFFICE_WEST, z }] : []
      return go(here, [...west, { x: OFFICE_WEST, z: OFFICE_STRIP_Z }, ...out, ...tail], 'Leave the office into the corridor', extra)
    }
    return go(here, [...(Math.abs(x - od) > 0.35 ? out : out.slice(1)), ...tail], 'Leave the office into the corridor', extra)
  }
  // in a lecture hall (the other one): out into the corridor by its door
  if (zone === 'hall1' || zone === 'hall2') {
    const backAisle = z < ROW_Z0[0] - 0.25
    const od = DOOR_X[zone]
    const exit: Point[] = [{ x: od, z: OUTSIDE_Z }]
    const pts: Point[] = backAisle ? (Math.abs(x - od) > 0.4 ? [{ x: od, z: BACK_Z }, ...exit] : exit) : [...toBackAisle(zone, x, z), { x: od, z: BACK_Z }, ...exit]
    return go(here, [...pts, ...tail], 'Leave this hall into the corridor', extra)
  }
  // in the dental clinic: down the distance map to its door, then out of it into the corridor
  if (zone === 'clinic') {
    const d = clinicDescent(x, z, 'door')
    const out: Point[] = [CLINIC_DOOR_OUT, ...tail]
    if (d.arrived) return go(here, out, 'Leave the clinic into the corridor', extra)
    return { aim: d.aim, remaining: d.remaining + chain(CLINIC_DOOR_IN, out) + extra, text: 'Leave the clinic into the corridor' }
  }
  // behind the building (the courtyard and its door): in through the back door
  if (zone === 'courtyard' || (z < UNI_MAIN.z0 + 0.45 && inRect({ x0: UNI_MAIN.x0, x1: UNI_MAIN.x1, z0: UNI_COURT.z0, z1: UNI_MAIN.z1 }, x, z))) {
    return go(here, [COURT_DOOR, ARCH, ...tail], 'Go back in through the courtyard door', extra)
  }
  // outside: up the steps and through the main entrance
  const lineUp = Math.abs(x - DOORWAY.x) < 2.5 && z < STEPS_FOOT.z + 2
  const to: Point[] = [DOORWAY, LOBBY, ARCH, ...tail]
  if (lineUp) return go(here, to, 'Go up the steps and in through the main entrance', extra)
  return go(here, [STEPS_FOOT, ...to], 'Go to the main entrance of the university', extra)
}

// ---------------------------------------------------------------------------------------------
// The dental clinic (Stage 10)
// ---------------------------------------------------------------------------------------------

/** What she is heading for in the clinic: her stool, or one of the three places where she gets ready. */
export type ClinicTarget = 'seat' | 'wash' | 'mask' | 'gloves'
type FieldTarget = ClinicTarget | 'door'

/** The two ends of the clinic door: in the corridor, and just inside the clinic. */
const CLINIC_DOOR_OUT: Point = { x: -180.6, z: DOORS.clinicZ }
const CLINIC_DOOR_IN: Point = { x: -183.4, z: DOORS.clinicZ }
const FIELD_CELL = 0.2
/** Keep this far from every wall and piece of furniture on the way (her radius and a little more). */
const FIELD_CLEAR = PLAYER_RADIUS + 0.04
const FIELD_BOUNDS: Bounds = { minX: CLINIC.x0 - 0.2, maxX: CLINIC_PASSAGE.x1 + 0.6, minZ: CLINIC.z0 - 0.2, maxZ: CLINIC.z1 + 0.2 }
const FIELD_NX = Math.ceil((FIELD_BOUNDS.maxX - FIELD_BOUNDS.minX) / FIELD_CELL)
const FIELD_NZ = Math.ceil((FIELD_BOUNDS.maxZ - FIELD_BOUNDS.minZ) / FIELD_CELL)

let fieldGrid: ColliderGrid | null = null
const fields = new Map<FieldTarget, Float32Array>()

const cellX = (i: number) => FIELD_BOUNDS.minX + (i + 0.5) * FIELD_CELL
const cellZ = (j: number) => FIELD_BOUNDS.minZ + (j + 0.5) * FIELD_CELL
const cellI = (x: number) => Math.min(FIELD_NX - 1, Math.max(0, Math.floor((x - FIELD_BOUNDS.minX) / FIELD_CELL)))
const cellJ = (z: number) => Math.min(FIELD_NZ - 1, Math.max(0, Math.floor((z - FIELD_BOUNDS.minZ) / FIELD_CELL)))

function floorFree(x: number, z: number): boolean {
  if (!fieldGrid) fieldGrid = buildGrid(UNI_COLLIDERS, FIELD_BOUNDS, 4, FIELD_CLEAR + 0.1)
  for (const c of queryGrid(fieldGrid, x, z)) if (pointBlocked(x, z, 0, c, FIELD_CLEAR)) return false
  return true
}

const goalOf = (t: FieldTarget): Point => (t === 'door' ? CLINIC_DOOR_IN : t === 'seat' ? CLINIC_SEAT : CLINIC_PREP[t])

/** Path length (m) from every cell to the goal over the free floor (Infinity where it cannot be reached), computed once per goal. */
function fieldFor(t: FieldTarget): Float32Array {
  const cached = fields.get(t)
  if (cached) return cached
  const dist = new Float32Array(FIELD_NX * FIELD_NZ).fill(Infinity)
  const free = new Uint8Array(FIELD_NX * FIELD_NZ)
  for (let j = 0; j < FIELD_NZ; j++) for (let i = 0; i < FIELD_NX; i++) free[j * FIELD_NX + i] = floorFree(cellX(i), cellZ(j)) ? 1 : 0
  const goal = goalOf(t)
  // the goal may itself be a hair too close to something: start from the nearest free cell
  let best = -1
  let bestD = Infinity
  for (let j = 0; j < FIELD_NZ; j++) {
    for (let i = 0; i < FIELD_NX; i++) {
      if (!free[j * FIELD_NX + i]) continue
      const d = Math.hypot(cellX(i) - goal.x, cellZ(j) - goal.z)
      if (d < bestD) {
        bestD = d
        best = j * FIELD_NX + i
      }
    }
  }
  if (best >= 0) {
    // a label-correcting flood fill with a FIFO queue (the map is small)
    const queue: number[] = [best]
    dist[best] = 0
    for (let head = 0; head < queue.length; head++) {
      const k = queue[head]
      const i = k % FIELD_NX
      const j = (k - i) / FIELD_NX
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue
          const ni = i + di
          const nj = j + dj
          if (ni < 0 || nj < 0 || ni >= FIELD_NX || nj >= FIELD_NZ) continue
          const nk = nj * FIELD_NX + ni
          if (!free[nk]) continue
          // a diagonal step needs both of the cells beside it to be free, so it never cuts a corner
          if (di && dj && (!free[j * FIELD_NX + ni] || !free[nj * FIELD_NX + i])) continue
          const nd = dist[k] + (di && dj ? Math.SQRT2 : 1) * FIELD_CELL
          if (nd < dist[nk] - 1e-6) {
            dist[nk] = nd
            queue.push(nk)
          }
        }
      }
    }
  }
  fields.set(t, dist)
  return dist
}

/** How far the way is from just inside the clinic door to the goal (m). */
export function clinicPathFromDoor(t: ClinicTarget): number {
  const f = fieldFor(t)
  return f[cellJ(CLINIC_DOOR_IN.z) * FIELD_NX + cellI(CLINIC_DOOR_IN.x)]
}

interface Descent {
  aim: Point
  remaining: number
  /** She is within half a metre of the goal. */
  arrived: boolean
}

/** From (x, z) inside the clinic: the point about a metre further along the shortest way to the goal, and the distance left. */
function clinicDescent(x: number, z: number, t: FieldTarget): Descent {
  const f = fieldFor(t)
  const goal = goalOf(t)
  let i = cellI(x)
  let j = cellJ(z)
  // she may be standing in a cell the map keeps clear of (a hair from a chair): look for the nearest cell with a way to the goal
  if (!Number.isFinite(f[j * FIELD_NX + i])) {
    let bd = Infinity
    let bi = i
    let bj = j
    for (let dj = -8; dj <= 8; dj++) {
      for (let di = -8; di <= 8; di++) {
        const ni = i + di
        const nj = j + dj
        if (ni < 0 || nj < 0 || ni >= FIELD_NX || nj >= FIELD_NZ || !Number.isFinite(f[nj * FIELD_NX + ni])) continue
        const d = Math.hypot(di, dj)
        if (d < bd) {
          bd = d
          bi = ni
          bj = nj
        }
      }
    }
    if (!Number.isFinite(bd)) return { aim: goal, remaining: Math.hypot(goal.x - x, goal.z - z), arrived: false }
    i = bi
    j = bj
  }
  const start = f[j * FIELD_NX + i] + Math.hypot(cellX(i) - x, cellZ(j) - z)
  let travelled = 0
  while (travelled < 1.0 && f[j * FIELD_NX + i] > 0.05) {
    let bi = i
    let bj = j
    let bv = f[j * FIELD_NX + i]
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const ni = i + di
        const nj = j + dj
        if ((!di && !dj) || ni < 0 || nj < 0 || ni >= FIELD_NX || nj >= FIELD_NZ) continue
        const v = f[nj * FIELD_NX + ni]
        if (v < bv - 1e-6) {
          bv = v
          bi = ni
          bj = nj
        }
      }
    }
    if (bi === i && bj === j) break
    travelled += Math.hypot(bi - i, bj - j) * FIELD_CELL
    i = bi
    j = bj
  }
  const atGoal = f[j * FIELD_NX + i] <= 0.05
  const aim: Point = atGoal ? goal : { x: cellX(i), z: cellZ(j) }
  return { aim, remaining: start, arrived: start < 0.5 }
}

const CLINIC_TEXT: Record<ClinicTarget, string> = {
  seat: 'Your dental unit: the stool at the end of the first row, by the aisle',
  wash: 'Wash your hands at the counter by the door',
  mask: 'Put on a mask: the dispenser above the counter',
  gloves: 'Put on gloves: the box next to the masks',
}

/** The way to a place in the dental clinic (her stool, or where she gets ready) from (x, z) anywhere in the university. */
export function guideToClinic(x: number, z: number, target: ClinicTarget): Guide {
  const here: Point = { x, z }
  const zone = campusZoneAt(x, z)
  const text = CLINIC_TEXT[target]
  if (zone === 'clinic') {
    const d = clinicDescent(x, z, target)
    return { aim: d.aim, remaining: d.remaining, text }
  }
  const inside = clinicPathFromDoor(target)
  if (zone === 'corridor') {
    // at the door already: straight in; otherwise along the corridor to it
    if (x < CLINIC_DOOR_OUT.x + 0.5) return go(here, [CLINIC_DOOR_IN], 'Go in through the clinic door', inside)
    return go(here, [CLINIC_DOOR_OUT, CLINIC_DOOR_IN], 'Follow the corridor west to the clinic door', inside)
  }
  return viaCorridor(x, z, zone, [CLINIC_DOOR_OUT, CLINIC_DOOR_IN], inside)
}

/** The angle of an aim point relative to the camera, in degrees (0 = straight ahead, positive = to the right). */
export function bearingDegrees(x: number, z: number, aim: Point, camYaw: number): number {
  const dx = aim.x - x
  const dz = aim.z - z
  const ahead = dx * Math.sin(camYaw) + dz * Math.cos(camYaw)
  // the same convention as the route arrow: the camera's right-hand side is (-cos yaw, sin yaw)
  const right = dx * -Math.cos(camYaw) + dz * Math.sin(camYaw)
  return (Math.atan2(right, ahead) * 180) / Math.PI
}
