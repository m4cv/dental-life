// Debug spawn for tests and for looking at one room: ?at=x,z,deg (deg: 0 faces south, 90 east,
// 180 north, 270 west). Pure, so the test script can check it.
import type { Bounds } from '../controls/movement.ts'
import { HOME_BOUNDS, HOME_SPAWN } from './homeLayout.ts'

export interface Spawn {
  x: number
  z: number
  heading: number
}

/**
 * Reads `?at=` from a query string; returns the normal spawn when it is missing or out of range.
 * The home alone (Stage 4) and the whole neighbourhood (Stage 5) have different bounds.
 */
export function spawnFromQuery(search: string, bounds: Bounds = HOME_BOUNDS, fallback: Spawn = HOME_SPAWN): Spawn {
  const raw = new URLSearchParams(search).get('at')
  if (!raw) return fallback
  const parts = raw.split(',').map((s) => Number(s.trim()))
  if (parts.length < 2 || parts.some((n) => !Number.isFinite(n))) return fallback
  const [x, z, deg = 0] = parts
  if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) return fallback
  return { x, z, heading: (deg * Math.PI) / 180 }
}
