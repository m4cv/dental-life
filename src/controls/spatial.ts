// A coarse grid over the colliders, so a big world (hundreds of colliders) only tests the few that
// are near the player or the camera. Pure: no three.js, no React; scripts/test-street.mjs checks
// that it never drops a collider that is within reach.
import type { Bounds, Collider } from './movement.ts'

export interface ColliderGrid {
  cell: number
  minX: number
  minZ: number
  cols: number
  rows: number
  cells: Collider[][]
}

/** Horizontal extent of a collider: [x0, x1, z0, z1]. */
export function colliderExtent(c: Collider): [number, number, number, number] {
  return c.kind === 'circle' ? [c.x - c.r, c.x + c.r, c.z - c.r, c.z + c.r] : [c.x - c.hw, c.x + c.hw, c.z - c.hd, c.z + c.hd]
}

/**
 * Puts every collider into each cell it comes within `reach` metres of, so that a query for any
 * point inside a cell returns every collider that is within `reach` of that point.
 */
export function buildGrid(colliders: readonly Collider[], bounds: Bounds, cell: number, reach: number): ColliderGrid {
  const cols = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / cell))
  const rows = Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) / cell))
  const cells: Collider[][] = Array.from({ length: cols * rows }, () => [])
  for (const c of colliders) {
    const [x0, x1, z0, z1] = colliderExtent(c)
    const i0 = Math.max(0, Math.floor((x0 - reach - bounds.minX) / cell))
    const i1 = Math.min(cols - 1, Math.floor((x1 + reach - bounds.minX) / cell))
    const j0 = Math.max(0, Math.floor((z0 - reach - bounds.minZ) / cell))
    const j1 = Math.min(rows - 1, Math.floor((z1 + reach - bounds.minZ) / cell))
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) cells[j * cols + i].push(c)
  }
  return { cell, minX: bounds.minX, minZ: bounds.minZ, cols, rows, cells }
}

/** The colliders near (x, z). Points outside the grid use the nearest edge cell. */
export function queryGrid(g: ColliderGrid, x: number, z: number): readonly Collider[] {
  const i = Math.min(g.cols - 1, Math.max(0, Math.floor((x - g.minX) / g.cell)))
  const j = Math.min(g.rows - 1, Math.max(0, Math.floor((z - g.minZ) / g.cell)))
  return g.cells[j * g.cols + i]
}
