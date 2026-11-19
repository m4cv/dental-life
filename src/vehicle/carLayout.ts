// Where the car stands (Stage 6), as plain data. Pure, so the tests can use it.
import type { Bounds } from '../controls/movement.ts'
import { spawnFromQuery, type Spawn } from '../home/spawn.ts'

/**
 * The car is parked in the lane in front of the home, against the south kerb a few metres east of the
 * gate, facing east (toward Ninety Street). Its driver's door (the left side) faces the middle of the lane.
 * An ESTIMATE like the rest of the street: when the real parking place is known it is changed here.
 */
export const PARKED_CAR: Spawn = { x: 9.0, z: 9.45, heading: Math.PI / 2 }

/** `?car=x,z,deg` puts the car somewhere else (deg: 0 faces south, 90 east, 180 north, 270 west), for tests and for looking at it. */
export function carFromQuery(search: string, bounds: Bounds): Spawn {
  return spawnFromQuery(search, bounds, PARKED_CAR, 'car')
}

/** `?drive=1` starts the game already sitting in the car (a testing aid). */
export function startsDriving(search: string): boolean {
  return new URLSearchParams(search).get('drive') === '1'
}
