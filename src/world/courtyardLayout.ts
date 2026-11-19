// Layout of the Stage 1 courtyard test set, shared by the scene (what is drawn) and the physics
// (what the player bumps into) so the two can never drift apart. Pure data, no imports of values.
import type { Bounds, Collider } from '../controls/movement.ts'

export type V3 = [number, number, number]

/** Beige blocks with a blue trim band that enclose the courtyard on three sides. */
export const BUILDINGS: { position: V3; size: V3 }[] = [
  { position: [0, 0, -14], size: [36, 12, 6] },
  { position: [-15, 0, 0], size: [6, 12, 22] },
  { position: [15, 0, 0], size: [6, 12, 22] },
]

export const PALM = { position: [-1.5, 0, -3] as V3, trunkRadius: 0.34, height: 5 }

export const BENCH_X = 11
export const BENCH_Z = [-7, -2.5, 2.5, 7]
export const BENCH_SIZE: V3 = [0.6, 0.45, 1.8]

/** Where the player appears when a game starts, and which way she faces (toward the courtyard). */
export const SPAWN = { x: 0, z: 8, heading: Math.PI }

/** Generous walkable area; the real world arrives in later stages. */
export const WORLD_BOUNDS: Bounds = { minX: -45, maxX: 45, minZ: -45, maxZ: 45 }

export const COURTYARD_COLLIDERS: Collider[] = [
  ...BUILDINGS.map(
    (b): Collider => ({ kind: 'box', x: b.position[0], z: b.position[2], hw: b.size[0] / 2, hd: b.size[2] / 2, height: b.size[1] }),
  ),
  { kind: 'circle', x: PALM.position[0], z: PALM.position[2], r: PALM.trunkRadius, height: PALM.height },
  ...BENCH_Z.map(
    (z): Collider => ({ kind: 'box', x: BENCH_X, z, hw: BENCH_SIZE[0] / 2, hd: BENCH_SIZE[2] / 2, height: BENCH_SIZE[1] }),
  ),
]
