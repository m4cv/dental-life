// Layout of the home (Stage 4), shared by the scene (what is drawn) and the physics (what the
// player bumps into) so the two can never drift apart. Pure data and pure functions: no three.js,
// no React, so scripts/test-home.mjs can check it on plain Node.
//
// Ground plane is (x, z) in metres, like the rest of the game: +x is east, -z is north.
// Rooms, door positions and sizes are ESTIMATED from five photographs (no floor plan yet), so they
// are marked as such in `ROOMS`. Furniture styles and colours follow the photographs.
import type { Bounds, Collider } from '../controls/movement.ts'

export type V3 = [number, number, number]

export const WALL_T = 0.2
export const CEILING_Y = 2.9

export type RoomId = 'living' | 'dining' | 'bedroom' | 'bathroom'

export interface Room {
  id: RoomId
  name: string
  /** Inner (floor) rectangle. */
  x0: number
  x1: number
  z0: number
  z1: number
  /** Where the content comes from, so the report can be honest about it. */
  source: 'photos' | 'estimate'
}

export const ROOMS: Room[] = [
  { id: 'living', name: 'Living room', x0: 0, x1: 3.4, z0: -6.4, z1: 0, source: 'photos' },
  { id: 'dining', name: 'Dining area', x0: 2.0, x1: 5.4, z0: -9.0, z1: -6.6, source: 'photos' },
  { id: 'bedroom', name: 'Bedroom', x0: 3.6, x1: 7.0, z0: -6.4, z1: -2.8, source: 'photos' },
  { id: 'bathroom', name: 'Bathroom', x0: 5.6, x1: 7.0, z0: -9.0, z1: -6.6, source: 'estimate' },
]

export interface Opening {
  /** Position along the wall (x for walls running east-west, z for walls running north-south). */
  at: number
  w: number
  h: number
  /** Height of the bottom edge: 0 for doors, above the floor for windows. */
  sill: number
  kind: 'door' | 'window' | 'opening'
  id: string
}

export interface WallDef {
  id: string
  a: [number, number]
  b: [number, number]
  openings: Opening[]
}

const door = (id: string, at: number, w: number, h: number): Opening => ({ id, at, w, h, sill: 0, kind: 'door' })
const opening = (id: string, at: number, w: number, h: number): Opening => ({ id, at, w, h, sill: 0, kind: 'opening' })
const windowAt = (id: string, at: number, w: number, h: number, sill: number): Opening => ({ id, at, w, h, sill, kind: 'window' })

export const FRONT_DOOR = { x: 2.5, z: 0.1, w: 1.0, h: 2.2 }

export const WALLS: WallDef[] = [
  { id: 'south', a: [-0.1, 0.1], b: [3.5, 0.1], openings: [door('front', FRONT_DOOR.x, FRONT_DOOR.w, FRONT_DOOR.h)] },
  { id: 'west', a: [-0.1, 0.1], b: [-0.1, -6.5], openings: [] },
  {
    id: 'north',
    a: [-0.1, -6.5],
    b: [7.1, -6.5],
    openings: [windowAt('living-window', 1.1, 0.8, 0.9, 1.3), opening('hall', 2.75, 1.1, 2.3)],
  },
  { id: 'living-east', a: [3.5, 0.1], b: [3.5, -6.5], openings: [door('bedroom-door', -4.9, 1.0, 2.2)] },
  { id: 'bedroom-south', a: [3.5, -2.7], b: [7.1, -2.7], openings: [] },
  { id: 'east', a: [7.1, -2.7], b: [7.1, -9.1], openings: [windowAt('bedroom-window', -4.2, 1.6, 1.4, 0.9)] },
  { id: 'dining-west', a: [1.9, -6.5], b: [1.9, -9.1], openings: [] },
  { id: 'far-north', a: [1.9, -9.1], b: [7.1, -9.1], openings: [windowAt('dining-window', 3.7, 1.4, 1.3, 0.9)] },
  { id: 'bath-wall', a: [5.5, -6.5], b: [5.5, -9.1], openings: [door('bath-door', -8.0, 0.9, 2.1)] },
]

/** A wall block: centre, footprint and vertical extent. */
export interface WallPiece {
  x: number
  z: number
  /** Footprint size along x and z. */
  sx: number
  sz: number
  y0: number
  y1: number
  /** What it is, so the scene can colour windows' sills differently, etc. */
  part: 'solid' | 'lintel' | 'sill'
}

const lo = (a: number, b: number) => Math.min(a, b)
const hi = (a: number, b: number) => Math.max(a, b)

/** Splits a wall around its openings into solid blocks, lintels (above) and sills (below windows). */
export function wallPieces(w: WallDef): WallPiece[] {
  const alongX = Math.abs(w.a[1] - w.b[1]) < 1e-9
  const c = alongX ? w.a[1] : w.a[0]
  const s0 = (alongX ? lo(w.a[0], w.b[0]) : lo(w.a[1], w.b[1])) - WALL_T / 2
  const s1 = (alongX ? hi(w.a[0], w.b[0]) : hi(w.a[1], w.b[1])) + WALL_T / 2
  const ops = [...w.openings].sort((p, q) => p.at - q.at)
  const out: WallPiece[] = []

  const add = (from: number, to: number, y0: number, y1: number, part: WallPiece['part']) => {
    if (to - from < 1e-6 || y1 - y0 < 1e-6) return
    const m = (from + to) / 2
    const len = to - from
    out.push(
      alongX
        ? { x: m, z: c, sx: len, sz: WALL_T, y0, y1, part }
        : { x: c, z: m, sx: WALL_T, sz: len, y0, y1, part },
    )
  }

  let cursor = s0
  for (const o of ops) {
    const from = o.at - o.w / 2
    const to = o.at + o.w / 2
    add(cursor, from, 0, CEILING_Y, 'solid')
    add(from, to, o.sill + o.h, CEILING_Y, 'lintel')
    if (o.sill > 0) add(from, to, 0, o.sill, 'sill')
    cursor = to
  }
  add(cursor, s1, 0, CEILING_Y, 'solid')
  return out
}

export const WALL_PIECES: WallPiece[] = WALLS.flatMap(wallPieces)

/** Floor-to-ceiling walls as colliders; windows count as wall (glass), doors and openings do not. */
export function wallColliders(w: WallDef): Collider[] {
  const alongX = Math.abs(w.a[1] - w.b[1]) < 1e-9
  const c = alongX ? w.a[1] : w.a[0]
  const s0 = (alongX ? lo(w.a[0], w.b[0]) : lo(w.a[1], w.b[1])) - WALL_T / 2
  const s1 = (alongX ? hi(w.a[0], w.b[0]) : hi(w.a[1], w.b[1])) + WALL_T / 2
  const gaps = w.openings.filter((o) => o.kind !== 'window').sort((p, q) => p.at - q.at)
  const out: Collider[] = []
  const add = (from: number, to: number) => {
    if (to - from < 1e-6) return
    const m = (from + to) / 2
    const half = (to - from) / 2
    out.push(
      alongX
        ? { kind: 'box', x: m, z: c, hw: half, hd: WALL_T / 2, height: CEILING_Y }
        : { kind: 'box', x: c, z: m, hw: WALL_T / 2, hd: half, height: CEILING_Y },
    )
  }
  let cursor = s0
  for (const o of gaps) {
    add(cursor, o.at - o.w / 2)
    cursor = o.at + o.w / 2
  }
  add(cursor, s1)
  return out
}

/** Blocks the front doorway while the door is shut. */
export const FRONT_DOOR_COLLIDER: Collider = {
  kind: 'box',
  x: FRONT_DOOR.x,
  z: FRONT_DOOR.z,
  hw: FRONT_DOOR.w / 2,
  hd: WALL_T / 2,
  height: FRONT_DOOR.h,
}

// ---------------------------------------------------------------------------------------------
// Furniture. `box` is the footprint used for collisions; the scene draws the detailed look.
// ---------------------------------------------------------------------------------------------

export interface FurnitureBox {
  id: string
  x: number
  z: number
  hw: number
  hd: number
  height: number
}

export const FURNITURE: FurnitureBox[] = [
  // living room
  { id: 'sofa', x: 0.475, z: -3.15, hw: 0.475, hd: 2.15, height: 0.9 },
  { id: 'armchair', x: 1.3, z: -5.95, hw: 0.45, hd: 0.42, height: 0.85 },
  { id: 'coffee-table', x: 1.65, z: -3.5, hw: 0.45, hd: 0.3, height: 0.42 },
  { id: 'tv-console', x: 3.2, z: -2.7, hw: 0.2, hd: 0.8, height: 0.5 },
  // dining area
  { id: 'dining-table', x: 3.7, z: -8.45, hw: 0.8, hd: 0.43, height: 0.76 },
  { id: 'chair-1', x: 3.1, z: -7.62, hw: 0.21, hd: 0.21, height: 0.9 },
  { id: 'chair-2', x: 3.7, z: -7.62, hw: 0.21, hd: 0.21, height: 0.9 },
  { id: 'chair-3', x: 4.3, z: -7.62, hw: 0.21, hd: 0.21, height: 0.9 },
  // bedroom
  { id: 'bed', x: 5.975, z: -4.2, hw: 0.925, hd: 0.8, height: 0.55 },
  { id: 'nightstand', x: 6.7, z: -5.25, hw: 0.22, hd: 0.2, height: 0.5 },
  { id: 'dresser', x: 5.2, z: -6.17, hw: 0.65, hd: 0.23, height: 0.78 },
  { id: 'glass-cabinet', x: 6.35, z: -6.25, hw: 0.3, hd: 0.15, height: 1.7 },
  { id: 'wardrobe', x: 4.6, z: -3.1, hw: 0.9, hd: 0.3, height: 2.2 },
  // bathroom (estimate)
  { id: 'toilet', x: 6.6, z: -8.65, hw: 0.2, hd: 0.35, height: 0.8 },
  { id: 'basin', x: 6.78, z: -7.7, hw: 0.22, hd: 0.28, height: 0.9 },
]

export const PLANT = { x: 0.28, z: -6.12, r: 0.22, height: 1.1 }

export const FURNITURE_COLLIDERS: Collider[] = [
  ...FURNITURE.map((f): Collider => ({ kind: 'box', x: f.x, z: f.z, hw: f.hw, hd: f.hd, height: f.height })),
  { kind: 'circle', x: PLANT.x, z: PLANT.z, r: PLANT.r, height: PLANT.height },
]

/**
 * Things that hang from the ceiling or sit high on a wall. She walks under them, so they are not
 * in the player's colliders, but the camera must never end up inside one (the chandelier right in
 * front of the lens hid half the screen in the first render).
 */
export const CAMERA_ONLY_COLLIDERS: Collider[] = [
  { kind: 'circle', x: 1.7, z: -3.2, r: 0.5, height: CEILING_Y, bottom: 1.8 }, // chandelier
  { kind: 'circle', x: 1.7, z: -4.9, r: 0.65, height: CEILING_Y, bottom: 2.55 }, // living-room ceiling fan
  { kind: 'circle', x: 4.8, z: -4.9, r: 0.65, height: CEILING_Y, bottom: 2.55 }, // bedroom ceiling fan
  { kind: 'circle', x: 3.7, z: -7.8, r: 0.25, height: CEILING_Y, bottom: 2.75 }, // dining pendant light
  { kind: 'circle', x: 6.3, z: -7.8, r: 0.25, height: CEILING_Y, bottom: 2.75 }, // bathroom light
  { kind: 'box', x: 1.1, z: -6.29, hw: 0.5, hd: 0.11, height: 2.7, bottom: 2.3 }, // air-conditioner, living room
  { kind: 'box', x: 4.6, z: -6.29, hw: 0.5, hd: 0.11, height: 2.7, bottom: 2.3 }, // air-conditioner, bedroom
]

/** A small porch in front of the door: a slab with low side walls. The street arrives in Stage 5. */
export const PORCH = { x0: 1.6, x1: 3.4, z0: 0.2, z1: 1.5, wallHeight: 0.9, wallT: 0.12 }

const PORCH_COLLIDERS: Collider[] = [
  { kind: 'box', x: PORCH.x0, z: (PORCH.z0 + PORCH.z1) / 2, hw: PORCH.wallT / 2, hd: (PORCH.z1 - PORCH.z0) / 2, height: PORCH.wallHeight },
  { kind: 'box', x: PORCH.x1, z: (PORCH.z0 + PORCH.z1) / 2, hw: PORCH.wallT / 2, hd: (PORCH.z1 - PORCH.z0) / 2, height: PORCH.wallHeight },
]

/** Everything solid that never changes: walls, porch walls and furniture (the front door is separate). */
export const HOME_COLLIDERS: Collider[] = [...WALLS.flatMap(wallColliders), ...PORCH_COLLIDERS, ...FURNITURE_COLLIDERS]

/** The walkable area: the house and the porch, nothing beyond. */
export const HOME_BOUNDS: Bounds = { minX: -2, maxX: 9, minZ: -11, maxZ: PORCH.z1 }

/** Where a new game starts: in the bedroom, facing the door (west). Heading 0 faces +z (south). */
export const HOME_SPAWN = { x: 4.55, z: -4.7, heading: -Math.PI / 2 }

// ---------------------------------------------------------------------------------------------
// Things to do. Heading = the way she faces while doing it (0 south, π/2 east, π north, -π/2 west).
// ---------------------------------------------------------------------------------------------

export type StepId = 'brush' | 'mirror' | 'dress' | 'eat' | 'pack'

/** The seats of the lecture halls (Stage 9), where she attends a lecture: see university/uniLayout.ts. */
export type SeatId = 'seat-hall1' | 'seat-hall2'

export interface Spot {
  id: StepId | 'door' | SeatId
  /** Where she stands (and is gently moved to) while doing it. */
  x: number
  z: number
  heading: number
  /** How close she must be for the button to appear. */
  radius: number
}

export const SPOTS: Spot[] = [
  { id: 'brush', x: 6.25, z: -7.7, heading: Math.PI / 2, radius: 0.85 },
  { id: 'mirror', x: 5.15, z: -5.55, heading: Math.PI, radius: 0.85 },
  { id: 'dress', x: 4.5, z: -3.75, heading: 0, radius: 0.85 },
  { id: 'eat', x: 4.95, z: -8.45, heading: -Math.PI / 2, radius: 0.85 },
  { id: 'pack', x: 2.45, z: -8.45, heading: Math.PI / 2, radius: 0.85 },
  { id: 'door', x: 2.5, z: -0.75, heading: 0, radius: 1.0 },
]

export function spotById(id: Spot['id']): Spot {
  const s = SPOTS.find((p) => p.id === id)
  if (!s) throw new Error(`unknown spot ${id}`)
  return s
}
