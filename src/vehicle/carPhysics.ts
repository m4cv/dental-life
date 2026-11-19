// Pure car maths (Stage 6): no three.js, no React, so scripts/test-car.mjs can drive it on plain Node.
//
// The car is a "bicycle model": the front wheels steer, the rear axle follows, so it turns the way a
// real car does (the rear wheels cut inside the front ones) and cannot slide sideways. On top of that:
// one gas pedal, one brake pedal that also reverses, a steering angle that gets smaller with speed (so
// a phone's thumb cannot spin the car at full speed) and four circles along the body that push the car
// out of walls and lamp posts. Same ground plane as everything else: forward = (sin heading, cos heading).
import { resolveCollisions, wrapAngle, type Bounds, type CircleCollider, type Collider, pointBlocked, PLAYER_RADIUS } from '../controls/movement.ts'

export const CAR = {
  /** Body size in metres: a small five-door hatchback. */
  length: 3.65,
  width: 1.62,
  height: 1.5,
  wheelbase: 2.4,
  track: 1.38,
  wheelRadius: 0.29,
  /** Collision circles along the body (offset from the centre, forward positive) and their radius. */
  circleOffsets: [-1.0, -0.33, 0.33, 1.0] as readonly number[],
  circleRadius: 0.84,
  /** Speeds in m/s (13 m/s is about 47 km/h: a busy street, not a motorway). */
  maxSpeed: 13,
  maxReverse: 3.5,
  /** Accelerations in m/s². */
  accel: 4.4,
  brake: 9.5,
  reverseAccel: 2.6,
  rolling: 1.6,
  drag: 0.012,
  /** Largest wheel angle (rad), used when crawling. */
  steerMax: 0.62,
  /** At speed the wheel angle is limited so the sideways acceleration (speed² × tan(angle) / wheelbase) stays below this (m/s²): the tyres' grip. */
  maxLateral: 7,
  /** How fast the wheels turn toward the stick and back to straight (rad/s). */
  steerRate: 3.2,
  steerReturn: 5,
  /** The car stops at this speed or lower: the Get out button works. */
  exitSpeed: 1.2,
} as const

export interface CarState {
  /** Centre of the car on the ground plane (halfway between the axles). */
  x: number
  z: number
  /** Rotation about +y (0 faces +z, i.e. south); the car drives toward (sin, cos). */
  heading: number
  /** Signed speed along the heading in m/s (negative = reversing). */
  speed: number
  /** Front wheel angle in rad, positive = left. */
  steer: number
  /** Turning rate in rad/s (for the camera and the body lean). */
  yawRate: number
  /** 0..1 after a hit, fading out (for a little camera shake and the like). */
  bump: number
  /** Distance rolled since the start, for the wheel animation. */
  odometer: number
  /** True while the brake pedal is slowing the car down (brake lights). */
  braking: boolean
}

export interface CarInput {
  /** Gas pedal 0..1. */
  throttle: number
  /** Brake pedal 0..1 (reverses once the car has stopped). */
  brake: number
  /** Steering −1 (left) … +1 (right). */
  steer: number
}

export const NO_INPUT: CarInput = { throttle: 0, brake: 0, steer: 0 }

export function createCar(x: number, z: number, heading: number): CarState {
  return { x, z, heading, speed: 0, steer: 0, yawRate: 0, bump: 0, odometer: 0, braking: false }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
const SUBSTEP = 1 / 60
const MAX_FRAME = 0.5

/** The largest wheel angle allowed at this speed (rad): full lock when crawling, a few degrees at top speed. */
export function steerLimit(speed: number): number {
  const v2 = speed * speed
  if (v2 < 1e-6) return CAR.steerMax
  return Math.min(CAR.steerMax, Math.atan((CAR.maxLateral * CAR.wheelbase) / v2))
}

/** The four collision circles of the car at its current pose. */
export function carCirclePoints(car: Pick<CarState, 'x' | 'z' | 'heading'>): Array<[number, number]> {
  const fx = Math.sin(car.heading)
  const fz = Math.cos(car.heading)
  return CAR.circleOffsets.map((o) => [car.x + fx * o, car.z + fz * o] as [number, number])
}

/** What a person on foot bumps into: the parked car as four circles. */
export function carColliders(car: Pick<CarState, 'x' | 'z' | 'heading'>): CircleCollider[] {
  return carCirclePoints(car).map(([x, z]) => ({ kind: 'circle', x, z, r: CAR.circleRadius - 0.04, height: CAR.height }))
}

/** Unit vector pointing out of the driver's door (the car's left; the driver sits on the left). */
export function carLeft(heading: number): [number, number] {
  return [Math.cos(heading), -Math.sin(heading)]
}

/** Distance from a point to the car body (0 when it touches the body). */
export function distanceToCar(px: number, pz: number, car: Pick<CarState, 'x' | 'z' | 'heading'>): number {
  let best = Infinity
  for (const [cx, cz] of carCirclePoints(car)) best = Math.min(best, Math.hypot(px - cx, pz - cz) - CAR.circleRadius)
  return Math.max(0, best)
}

/** How near a person must stand for the Get in button to appear. */
export const ENTER_REACH = 1.35

/**
 * Advances the car by `dt` seconds. Mutates `car`. `colliders` are what is near the car (the grid
 * for a car reaches further than the one for a person); `bounds` keep it inside the world.
 */
export function stepCar(car: CarState, input: CarInput, dt: number, colliders: readonly Collider[], bounds: Bounds): void {
  let remaining = Math.min(Math.max(dt, 0), MAX_FRAME)
  car.bump = Math.max(0, car.bump - 3 * remaining)
  while (remaining > 1e-6) {
    const h = Math.min(remaining, SUBSTEP)
    substep(car, input, h, colliders, bounds)
    remaining -= h
  }
}

function substep(car: CarState, input: CarInput, h: number, colliders: readonly Collider[], bounds: Bounds): void {
  // ---- the wheels turn toward the stick (positive stick = right = negative wheel angle) ----
  const target = -clamp(input.steer, -1, 1) * steerLimit(car.speed)
  const away = Math.abs(target) > Math.abs(car.steer) || Math.sign(target) !== Math.sign(car.steer)
  const maxTurn = (away ? CAR.steerRate : CAR.steerReturn) * h
  car.steer += clamp(target - car.steer, -maxTurn, maxTurn)

  // ---- pedals ----
  let v = car.speed
  const gas = clamp(input.throttle, 0, 1)
  const brake = clamp(input.brake, 0, 1)
  car.braking = false
  if (brake > 0) {
    if (v > 0.3) {
      v = Math.max(0, v - CAR.brake * brake * h)
      car.braking = true
    } else {
      // stopped (or already going backwards) with the brake held: reverse
      v = Math.max(-CAR.maxReverse, v - CAR.reverseAccel * brake * h)
    }
  } else if (gas > 0) {
    if (v < -0.2) {
      v = Math.min(0, v + CAR.brake * gas * h)
      car.braking = true
    } else {
      v += CAR.accel * gas * (1 - Math.max(v, 0) / CAR.maxSpeed) * h
    }
  } else if (v !== 0) {
    const slow = (CAR.rolling + CAR.drag * v * v) * h
    v = Math.abs(v) <= slow ? 0 : v - Math.sign(v) * slow
  }
  v = clamp(v, -CAR.maxReverse, CAR.maxSpeed)
  car.speed = v

  // ---- the bicycle model: the rear axle moves along the car, the car turns about it ----
  const half = CAR.wheelbase / 2
  let fx = Math.sin(car.heading)
  let fz = Math.cos(car.heading)
  const rx = car.x - fx * half + fx * v * h
  const rz = car.z - fz * half + fz * v * h
  const yawRate = (v / CAR.wheelbase) * Math.tan(car.steer)
  car.heading = wrapAngle(car.heading + yawRate * h)
  car.yawRate = yawRate
  fx = Math.sin(car.heading)
  fz = Math.cos(car.heading)
  car.x = rx + fx * half
  car.z = rz + fz * half
  car.odometer += v * h

  // ---- walls, lamp posts, the edge of the world: the circles push the car out ----
  let pushX = 0
  let pushZ = 0
  for (let pass = 0; pass < 3; pass++) {
    for (const [cx, cz] of carCirclePoints(car)) {
      const [nx, nz] = resolveCollisions(cx, cz, CAR.circleRadius, colliders, bounds)
      const dx = nx - cx
      const dz = nz - cz
      if (dx !== 0 || dz !== 0) {
        car.x += dx
        car.z += dz
        pushX += dx
        pushZ += dz
      }
    }
  }
  const push = Math.hypot(pushX, pushZ)
  if (push > 1e-6 && car.speed !== 0) {
    // n points out of the obstacle; d is the way the car is travelling.
    const nx = pushX / push
    const nz = pushZ / push
    const dir = car.speed > 0 ? 1 : -1
    const dx = dir * fx
    const dz = dir * fz
    const dn = dx * nx + dz * nz // negative = heading into the obstacle
    if (dn < 0) {
      car.bump = Math.max(car.bump, clamp((Math.abs(car.speed) * -dn) / 8, 0, 1))
      // Only the part of the speed that went into the obstacle is lost: a head-on hit stops the car, a graze keeps most of it…
      car.speed *= 1 - dn * dn
      // …and the nose swings along the obstacle, so a graze scrapes past instead of grinding to a halt.
      const tx = dx - dn * nx
      const tz = dz - dn * nz
      if (Math.hypot(tx, tz) > 0.15) {
        const goal = dir > 0 ? Math.atan2(tx, tz) : Math.atan2(-tx, -tz)
        car.heading = wrapAngle(car.heading + clamp(wrapAngle(goal - car.heading), -0.5, 0.5))
      }
    }
  }
}

/** Where a person steps out (and which way she faces): the driver's side first, then the other side, the back, the front. */
export function exitSpot(
  car: Pick<CarState, 'x' | 'z' | 'heading'>,
  colliders: readonly Collider[],
  bounds: Bounds,
): { x: number; z: number; heading: number } | null {
  const [lx, lz] = carLeft(car.heading)
  const fx = Math.sin(car.heading)
  const fz = Math.cos(car.heading)
  const side = CAR.width / 2 + PLAYER_RADIUS + 0.2
  const end = CAR.length / 2 + PLAYER_RADIUS + 0.25
  const candidates: Array<[number, number, number, number]> = [
    // x, z, heading toward the outside…
    [car.x + lx * side + fx * 0.25, car.z + lz * side + fz * 0.25, lx, lz],
    [car.x - lx * side + fx * 0.25, car.z - lz * side + fz * 0.25, -lx, -lz],
    [car.x - fx * end, car.z - fz * end, -fx, -fz],
    [car.x + fx * end, car.z + fz * end, fx, fz],
  ]
  const circles = carCirclePoints(car)
  for (const [x, z, dx, dz] of candidates) {
    if (x < bounds.minX + PLAYER_RADIUS || x > bounds.maxX - PLAYER_RADIUS || z < bounds.minZ + PLAYER_RADIUS || z > bounds.maxZ - PLAYER_RADIUS) continue
    if (colliders.some((c) => pointBlocked(x, z, 0.5, c, PLAYER_RADIUS + 0.02))) continue
    if (circles.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < CAR.circleRadius + PLAYER_RADIUS)) continue
    return { x, z, heading: Math.atan2(dx, dz) }
  }
  return null
}
