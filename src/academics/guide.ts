// The way to a lecture hall, as plain geometry (no React, no three.js): from wherever she is inside the university
// compound, the next point to walk to, the distance left along the way and what to do. It does not look at walls:
// the points are chosen so that the straight line to the next one is clear (the doorway, the arch, the corridor, the
// aisles of the halls, the door of the hall). Used by the "next class" card; scripts/test-academics.mjs walks it
// from many places with the real collision code.
import { DOORS, HALL1_BLOCKS, HALL2_BLOCKS, LECTURE_SEATS, ROW_Z0, UNI_COURT, UNI_MAIN, campusZoneAt, roomById } from '../university/uniLayout.ts'
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
const go = (here: Point, pts: Point[], text: string): Guide => ({ aim: pts[0], remaining: chain(here, pts), text })

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
  const tail: Point[] = [{ x: door, z: CORRIDOR_Z }, ...inward]
  // in the lobby (and the doorway): through the arch into the corridor
  if (zone === 'lobby') return go(here, [ARCH, ...tail], 'Cross the lobby to the corridor')
  // in the office: round the clerk's desk, then out of its door
  if (zone === 'office') {
    const od = DOOR_X.office
    const out: Point[] = [{ x: od, z: OFFICE_STRIP_Z }, { x: od, z: OUTSIDE_Z }]
    if (z > -485.0) {
      const west: Point[] = Math.abs(x - OFFICE_WEST) > 0.3 ? [{ x: OFFICE_WEST, z }] : []
      return go(here, [...west, { x: OFFICE_WEST, z: OFFICE_STRIP_Z }, ...out, ...tail], 'Leave the office into the corridor')
    }
    return go(here, [...(Math.abs(x - od) > 0.35 ? out : out.slice(1)), ...tail], 'Leave the office into the corridor')
  }
  // in the other lecture hall: out into the corridor by its door
  if (zone === 'hall1' || zone === 'hall2') {
    const od = DOOR_X[zone]
    const exit: Point[] = [{ x: od, z: OUTSIDE_Z }]
    const pts: Point[] = backAisle ? (Math.abs(x - od) > 0.4 ? [{ x: od, z: BACK_Z }, ...exit] : exit) : [...toBackAisle(zone, x, z), { x: od, z: BACK_Z }, ...exit]
    return go(here, [...pts, ...tail], 'Leave this hall into the corridor')
  }
  // behind the building (the courtyard and its door): in through the back door
  if (zone === 'courtyard' || (z < UNI_MAIN.z0 + 0.45 && inRect({ x0: UNI_MAIN.x0, x1: UNI_MAIN.x1, z0: UNI_COURT.z0, z1: UNI_MAIN.z1 }, x, z))) {
    return go(here, [COURT_DOOR, ARCH, ...tail], 'Go back in through the courtyard door')
  }
  // outside: up the steps and through the main entrance
  const lineUp = Math.abs(x - DOORWAY.x) < 2.5 && z < STEPS_FOOT.z + 2
  const to: Point[] = [DOORWAY, LOBBY, ARCH, ...tail]
  if (lineUp) return go(here, to, 'Go up the steps and in through the main entrance')
  return go(here, [STEPS_FOOT, ...to], 'Go to the main entrance of the university')
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
