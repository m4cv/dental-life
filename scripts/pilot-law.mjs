// The control law of the smoke test's pilot, kept apart so it can be simulated without a browser (scripts/sim-pilot.mjs).
//
// The pilot steers the on-screen joystick toward a point using a read-out that is a little old: on the CI machine (software
// rendering, 1–3 frames per second) it can be a second behind. A pilot that brakes only when it is close overshoots by
// speed × delay, circles the point and gives up; one that lets its speed fall with the distance to the point does not.

/** Walking and running speed (m/s), the same numbers as character/animations/pose.ts. */
export const WALK = 1.45
export const RUN = 3.6
/** The pilot assumes the read-out is this old (s) and never moves faster than it could stop within the distance left. */
export const ASSUMED_DELAY = 0.9
/** The slowest it ever creeps (m/s), so it still gets there. */
export const CREEP = 0.22
const DEADZONE = 0.12

/**
 * Stick deflection (x right, y forward, 0..1 each axis) that steers from the read-out position `d` to (tx, tz).
 * `d.cam` is the camera heading in degrees; `cap` limits the speed as a fraction of full speed (0..1).
 */
export function pilotStick(d, tx, tz, { tol = 0.25, cap = 1, top = WALK } = {}) {
  const dx = tx - d.x
  const dz = tz - d.z
  const dist = Math.hypot(dx, dz) || 1
  const yaw = (d.cam * Math.PI) / 180
  const fx = Math.sin(yaw)
  const fz = Math.cos(yaw)
  const v = Math.max(CREEP, (dist - tol * 0.6) / ASSUMED_DELAY)
  const fraction = Math.min(cap, v / top)
  const m = DEADZONE + (1 - DEADZONE) * fraction
  return [((dz * fx - dx * fz) / dist) * m, ((dx * fx + dz * fz) / dist) * m]
}
