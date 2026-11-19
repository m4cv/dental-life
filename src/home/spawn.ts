// Debug spawn for tests and for looking at one room: ?at=x,z,deg (deg: 0 faces south, 90 east,
// 180 north, 270 west). Pure, so the test script can check it.
import { HOME_BOUNDS, HOME_SPAWN } from './homeLayout.ts'

export interface Spawn {
  x: number
  z: number
  heading: number
}

/** Reads `?at=` from a query string; returns the normal spawn when it is missing or out of range. */
export function spawnFromQuery(search: string): Spawn {
  const raw = new URLSearchParams(search).get('at')
  if (!raw) return HOME_SPAWN
  const parts = raw.split(',').map((s) => Number(s.trim()))
  if (parts.length < 2 || parts.some((n) => !Number.isFinite(n))) return HOME_SPAWN
  const [x, z, deg = 0] = parts
  if (x < HOME_BOUNDS.minX || x > HOME_BOUNDS.maxX || z < HOME_BOUNDS.minZ || z > HOME_BOUNDS.maxZ) return HOME_SPAWN
  return { x, z, heading: (deg * Math.PI) / 180 }
}
