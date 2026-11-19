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

/**
 * Vertical field of view. A wide (landscape) screen is short, so the view is tightened a little
 * to keep the character a decent size; a tall portrait screen keeps the wider 50°.
 */
export function fovForAspect(aspect: number): number {
  return aspect >= 1.2 ? 46 : 50
}

export interface CamRig {
  yaw: number
  pitch: number
  dist: number
  /** Distance after the spring-arm; eased so the camera does not pop. */
  arm: number
}

export function createCam(yaw: number, dist: number = CAM.distDefault): CamRig {
  return { yaw, pitch: CAM.pitchDefault, dist, arm: dist }
}

/**
 * The drag is a head turn: dragging right turns the view to the right (the compass heading
 * shrinks), dragging down looks down (the camera rises). `zoom` is positive to zoom out.
 */
export function applyLook(cam: CamRig, dxPx: number, dyPx: number, zoomPx = 0): void {
  cam.yaw = wrapAngle(cam.yaw - dxPx * CAM.yawPerPx)
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
 * the first obstacle (or the ground). Always at least `armMin` (CAM.armMin outdoors).
 */
export function safeDistance(
  pivot: readonly [number, number, number],
  yaw: number,
  pitch: number,
  wanted: number,
  colliders: readonly Collider[],
  /** Indoors: the camera stays this far below the ceiling (default: no ceiling). */
  ceilingY: number = Infinity,
  armMin: number = CAM.armMin,
  /** How far the camera keeps from walls and furniture. */
  margin: number = 0.25,
): number {
  const STEP = 0.12
  let last = armMin
  for (let d = armMin; d <= wanted + 1e-9; d += STEP) {
    const o = cameraOffset(yaw, pitch, d)
    const x = pivot[0] + o[0]
    const y = pivot[1] + o[1]
    const z = pivot[2] + o[2]
    if (y < CAM.floorY || y > ceilingY - 0.12) return Math.max(last, armMin)
    for (const c of colliders) if (pointBlocked(x, z, y, c, margin)) return Math.max(last, armMin)
    last = d
  }
  return wanted
}

/**
 * Indoors the rooms are small and the walls thin, so the camera cannot always sit far behind her
 * (it would end up on the other side of a wall). It may come much closer than outdoors, and when
 * the way back is short it climbs and looks down from above instead.
 */
export const CAM_INDOOR = {
  armMin: 0.5,
  margin: 0.18,
  /** An arm this long (or the wanted distance, if shorter) is good enough: no need to climb. */
  goodArm: 2.0,
  pitchStep: 0.08,
  /** The steepest the camera may look down in a tight spot (the player's own drag stops at CAM.pitchMax). */
  pitchMax: 1.45,
} as const

/** The pitch to aim for indoors: the player's own pitch, raised only as far as needed for a decent arm. */
export function indoorPitch(
  pivot: readonly [number, number, number],
  yaw: number,
  pitch: number,
  wanted: number,
  colliders: readonly Collider[],
  ceilingY: number,
): number {
  const target = Math.min(wanted, CAM_INDOOR.goodArm)
  let bestArm = -1
  let bestPitch = pitch
  for (let p = pitch; p <= CAM_INDOOR.pitchMax + 1e-9; p += CAM_INDOOR.pitchStep) {
    const arm = safeDistance(pivot, yaw, p, wanted, colliders, ceilingY, CAM_INDOOR.armMin, CAM_INDOOR.margin)
    if (arm >= target - 1e-9) return p
    // keep the pitch with the longest arm; when every pitch is boxed in, the steepest one wins
    // (a bird's-eye view from just under the ceiling is the only one that cannot end up in a wall)
    const boxedIn = arm <= CAM_INDOOR.armMin + 1e-9 && bestArm <= CAM_INDOOR.armMin + 1e-9
    if (arm > bestArm + 1e-9 || boxedIn) {
      bestArm = arm
      bestPitch = p
    }
  }
  return bestPitch
}

/** Eases the arm: shortens at once (so it never sits inside a wall), lengthens smoothly. */
export function easeArm(arm: number, target: number, dt: number): number {
  if (target < arm) return target
  return arm + (target - arm) * (1 - Math.exp(-4 * dt))
}
