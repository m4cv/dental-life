// Pure movement maths for the player: no three.js, no React. Everything here is covered by
// scripts/test-controls.mjs, so changes to feel or collisions can be checked without a phone.
//
// Conventions: the ground plane is (x, z), +y is up. A camera "yaw" is the compass heading the
// camera looks along: forward = (sin yaw, cos yaw). Stick input is x = right, y = forward.

export interface BoxCollider {
  kind: 'box'
  /** Centre on the ground plane and half extents. */
  x: number
  z: number
  hw: number
  hd: number
  /** Top of the obstacle in metres (the camera can look over low things). */
  height: number
  /** Camera-only things that hang from the ceiling: the camera is blocked only at or above this height. */
  bottom?: number
}

export interface CircleCollider {
  kind: 'circle'
  x: number
  z: number
  r: number
  height: number
  bottom?: number
}

export type Collider = BoxCollider | CircleCollider

export interface Bounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface PlayerState {
  x: number
  z: number
  /** Velocity in m/s. */
  vx: number
  vz: number
  /** Direction the character faces, as a rotation about +y (0 faces +z). */
  heading: number
  /** Current ground speed in m/s, fed to the walk/run animation. */
  speed: number
}

export const PLAYER_RADIUS = 0.28
/** Fraction of stick travel ignored around the centre. */
export const STICK_DEADZONE = 0.12
/** m/s² when speeding up and when slowing down. */
export const ACCEL = 9
export const DECEL = 14
/** How quickly the character turns toward where the stick points (1/s, exponential). */
export const TURN_RATE = 12
/** Longest slice of time simulated per frame; longer frames are clamped (tab switches). */
export const MAX_FRAME = 0.5
/** Fixed simulation sub-step, so collisions behave the same at 15 and 120 FPS. */
export const SUBSTEP = 1 / 30

export function createPlayer(x: number, z: number, heading: number): PlayerState {
  return { x, z, vx: 0, vz: 0, heading, speed: 0 }
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

/** Wraps an angle into (-π, π]. */
export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a))
}

/**
 * Applies the dead-zone and re-scales the rest of the travel to 0..1, keeping direction.
 * Input beyond a full stick is clamped to 1.
 */
export function shapeStick(x: number, y: number): [number, number] {
  const m = Math.hypot(x, y)
  if (m <= STICK_DEADZONE) return [0, 0]
  const shaped = Math.min((m - STICK_DEADZONE) / (1 - STICK_DEADZONE), 1)
  return [(x / m) * shaped, (y / m) * shaped]
}

/** Stick (x right, y forward) → world direction on the ground plane for a camera heading. */
export function stickToWorld(x: number, y: number, camYaw: number): [number, number] {
  const fx = Math.sin(camYaw)
  const fz = Math.cos(camYaw)
  // right-hand vector of a camera looking along (fx, fz) is (-fz, fx)
  return [fx * y - fz * x, fz * y + fx * x]
}

/** True when (x, z) at height y lies inside the collider grown by `margin`. */
export function pointBlocked(x: number, z: number, y: number, c: Collider, margin = 0): boolean {
  if (y > c.height) return false
  if (c.bottom !== undefined && y < c.bottom) return false
  if (c.kind === 'circle') return Math.hypot(x - c.x, z - c.z) < c.r + margin
  return Math.abs(x - c.x) < c.hw + margin && Math.abs(z - c.z) < c.hd + margin
}

/** Pushes a circle of `radius` at (x, z) out of every collider and back inside the bounds. */
export function resolveCollisions(
  x: number,
  z: number,
  radius: number,
  colliders: readonly Collider[],
  bounds: Bounds,
): [number, number] {
  for (let pass = 0; pass < 4; pass++) {
    for (const c of colliders) {
      if (c.kind === 'circle') {
        const dx = x - c.x
        const dz = z - c.z
        const d = Math.hypot(dx, dz)
        const min = radius + c.r
        if (d < min) {
          if (d < 1e-9) x = c.x + min
          else {
            x = c.x + (dx / d) * min
            z = c.z + (dz / d) * min
          }
        }
      } else {
        const qx = clamp(x, c.x - c.hw, c.x + c.hw)
        const qz = clamp(z, c.z - c.hd, c.z + c.hd)
        const dx = x - qx
        const dz = z - qz
        const d = Math.hypot(dx, dz)
        if (d > 1e-9) {
          if (d < radius) {
            x = qx + (dx / d) * radius
            z = qz + (dz / d) * radius
          }
        } else {
          // centre is inside the box: leave through the nearest face
          const left = x - (c.x - c.hw)
          const right = c.x + c.hw - x
          const near = z - (c.z - c.hd)
          const far = c.z + c.hd - z
          const m = Math.min(left, right, near, far)
          if (m === left) x = c.x - c.hw - radius
          else if (m === right) x = c.x + c.hw + radius
          else if (m === near) z = c.z - c.hd - radius
          else z = c.z + c.hd + radius
        }
      }
    }
    x = clamp(x, bounds.minX + radius, bounds.maxX - radius)
    z = clamp(z, bounds.minZ + radius, bounds.maxZ - radius)
  }
  return [x, z]
}

function substep(
  p: PlayerState,
  stickX: number,
  stickY: number,
  camYaw: number,
  maxSpeed: number,
  h: number,
  colliders: readonly Collider[],
  bounds: Bounds,
  radius: number,
) {
  const [sx, sy] = shapeStick(stickX, stickY)
  const mag = Math.hypot(sx, sy)
  const [dirX, dirZ] = stickToWorld(sx, sy, camYaw)
  const targetVx = dirX * maxSpeed
  const targetVz = dirZ * maxSpeed

  // accelerate toward the target velocity, never faster than ACCEL / DECEL allow
  const dvx = targetVx - p.vx
  const dvz = targetVz - p.vz
  const dl = Math.hypot(dvx, dvz)
  const speedingUp = Math.hypot(targetVx, targetVz) > Math.hypot(p.vx, p.vz)
  const limit = (speedingUp ? ACCEL : DECEL) * h
  if (dl > limit) {
    p.vx += (dvx / dl) * limit
    p.vz += (dvz / dl) * limit
  } else {
    p.vx = targetVx
    p.vz = targetVz
  }

  const [nx, nz] = resolveCollisions(p.x + p.vx * h, p.z + p.vz * h, radius, colliders, bounds)
  // the velocity that actually happened: pushing into a wall slows her down to a stop
  p.vx = (nx - p.x) / h
  p.vz = (nz - p.z) / h
  p.x = nx
  p.z = nz
  p.speed = Math.hypot(p.vx, p.vz)

  // face where the stick points (not where the velocity currently is, so she turns at once)
  if (mag > 0.05) {
    const target = Math.atan2(dirX, dirZ)
    p.heading = wrapAngle(p.heading + wrapAngle(target - p.heading) * (1 - Math.exp(-TURN_RATE * h)))
  }
}

/** Advances the player by `dt` seconds of input. Mutates `p`. */
export function stepPlayer(
  p: PlayerState,
  stickX: number,
  stickY: number,
  camYaw: number,
  maxSpeed: number,
  dt: number,
  colliders: readonly Collider[],
  bounds: Bounds,
  radius = PLAYER_RADIUS,
): void {
  let remaining = Math.min(Math.max(dt, 0), MAX_FRAME)
  while (remaining > 1e-6) {
    const h = Math.min(remaining, SUBSTEP)
    substep(p, stickX, stickY, camYaw, maxSpeed, h, colliders, bounds, radius)
    remaining -= h
  }
}
