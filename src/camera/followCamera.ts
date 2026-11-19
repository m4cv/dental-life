// Pure third-person camera maths: an orbit rig around a pivot (the player's head height),
// with a spring-arm that shortens when something is in the way. No three.js, no React.
import { clamp, pointBlocked, wrapAngle, type Collider } from '../controls/movement.ts'

export const CAM = {
  /** Pivot height above the ground the camera orbits (about the character's head). */
  pivotY: 1.45,
  pitchDefault: 0.26,
  pitchMin: -0.05,
  pitchMax: 1.15,
  distDefault: 4.6,
  distMin: 2.2,
  distMax: 9,
  /** Never closer than this, even in a corner. */
  armMin: 1.0,
  /** The camera never goes below this height. */
  floorY: 0.3,
  /** Radians of rotation per CSS pixel of drag. */
  yawPerPx: 0.0055,
  pitchPerPx: 0.0042,
  /** Metres of distance per CSS pixel of pinch / per wheel notch. */
  zoomPerPx: 0.014,
} as const

export interface CamRig {
  yaw: number
  pitch: number
  dist: number
  /** Distance after the spring-arm; eased so the camera does not pop. */
  arm: number
}

export function createCam(yaw: number): CamRig {
  return { yaw, pitch: CAM.pitchDefault, dist: CAM.distDefault, arm: CAM.distDefault }
}

/**
 * Drag right turns the view left (the world follows the finger), drag down lifts the camera.
 * `zoom` is positive to zoom out.
 */
export function applyLook(cam: CamRig, dxPx: number, dyPx: number, zoomPx = 0): void {
  cam.yaw = wrapAngle(cam.yaw + dxPx * CAM.yawPerPx)
  cam.pitch = clamp(cam.pitch + dyPx * CAM.pitchPerPx, CAM.pitchMin, CAM.pitchMax)
  cam.dist = clamp(cam.dist + zoomPx * CAM.zoomPerPx, CAM.distMin, CAM.distMax)
}

/** Offset from the pivot to the camera for a heading, pitch and distance. */
export function cameraOffset(yaw: number, pitch: number, dist: number): [number, number, number] {
  const cp = Math.cos(pitch)
  return [-Math.sin(yaw) * cp * dist, Math.sin(pitch) * dist, -Math.cos(yaw) * cp * dist]
}

/**
 * How far back along the arm the camera can sit: marches out from the pivot and stops short of
 * the first obstacle (or the ground). Always at least CAM.armMin.
 */
export function safeDistance(
  pivot: readonly [number, number, number],
  yaw: number,
  pitch: number,
  wanted: number,
  colliders: readonly Collider[],
): number {
  const STEP = 0.12
  let last = CAM.armMin
  for (let d = CAM.armMin; d <= wanted + 1e-9; d += STEP) {
    const o = cameraOffset(yaw, pitch, d)
    const x = pivot[0] + o[0]
    const y = pivot[1] + o[1]
    const z = pivot[2] + o[2]
    if (y < CAM.floorY) return Math.max(last, CAM.armMin)
    for (const c of colliders) if (pointBlocked(x, z, y, c, 0.25)) return Math.max(last, CAM.armMin)
    last = d
  }
  return wanted
}

/** Eases the arm: shortens at once (so it never sits inside a wall), lengthens smoothly. */
export function easeArm(arm: number, target: number, dt: number): number {
  if (target < arm) return target
  return arm + (target - arm) * (1 - Math.exp(-4 * dt))
}
