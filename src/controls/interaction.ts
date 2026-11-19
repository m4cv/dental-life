// Pure logic for "walk up to a spot and do something there": no three.js, no React, so
// scripts/test-home.mjs can run it on plain Node. While an action runs the stick is locked: she is
// walked gently to the spot (the normal collision code still applies), turns to face the right way,
// and then plays a gesture for a fixed time.
import type { Gesture } from '../character/animations/pose.ts'
import type { Spot } from '../home/homeLayout.ts'
import { wrapAngle, type PlayerState } from './movement.ts'

/** Stick strength used while walking to the spot (1 = full). */
export const APPROACH_STICK = 0.8
/** Slows down inside this distance so she does not overshoot. */
export const APPROACH_SLOW_ZONE = 0.4
/** Close enough to start the gesture. */
export const ARRIVE_DIST = 0.12
/** Give up walking after this long and do the action where she stands. */
export const APPROACH_TIMEOUT = 2

export interface Action {
  spot: Spot
  seconds: number
  gesture: Gesture
  phase: 'approach' | 'act'
  /** Seconds spent in the current phase. */
  t: number
}

export function startAction(spot: Spot, seconds: number, gesture: Gesture): Action {
  return { spot, seconds, gesture, phase: 'approach', t: 0 }
}

/** A world-space direction (dx, dz) expressed as stick input for a camera heading. Inverse of stickToWorld. */
export function worldToStick(dx: number, dz: number, camYaw: number): [number, number] {
  const fx = Math.sin(camYaw)
  const fz = Math.cos(camYaw)
  return [dz * fx - dx * fz, dx * fx + dz * fz]
}

/** Stick input that walks the player toward (x, z), slowing near the end. */
export function approachStick(p: PlayerState, x: number, z: number, camYaw: number): [number, number] {
  const dx = x - p.x
  const dz = z - p.z
  const d = Math.hypot(dx, dz)
  if (d < 1e-6) return [0, 0]
  const k = APPROACH_STICK * Math.min(1, Math.max(d / APPROACH_SLOW_ZONE, 0.3))
  const [sx, sy] = worldToStick(dx / d, dz / d, camYaw)
  return [sx * k, sy * k]
}

export interface ActionStep {
  /** Stick to feed the movement code this frame (locked to the action). */
  stick: [number, number]
  /** Heading she should turn toward (while acting), or null to leave it to the movement code. */
  faceTo: number | null
  /** 0..1 progress of the gesture. */
  progress: number
  /** True on the frame the gesture finishes. */
  done: boolean
}

/** Advances an action by `dt` seconds. Mutates `a`. */
export function stepAction(a: Action, p: PlayerState, dt: number, camYaw: number): ActionStep {
  if (a.phase === 'approach') {
    a.t += dt
    const d = Math.hypot(a.spot.x - p.x, a.spot.z - p.z)
    if (d > ARRIVE_DIST && a.t < APPROACH_TIMEOUT) {
      return { stick: approachStick(p, a.spot.x, a.spot.z, camYaw), faceTo: null, progress: 0, done: false }
    }
    a.phase = 'act'
    a.t = 0
  }
  a.t += dt
  const progress = Math.min(1, a.t / a.seconds)
  return { stick: [0, 0], faceTo: a.spot.heading, progress, done: a.t >= a.seconds }
}

/** Eases a heading toward `target` (exponential, rate in 1/s). */
export function turnToward(heading: number, target: number, dt: number, rate = 10): number {
  return wrapAngle(heading + wrapAngle(target - heading) * (1 - Math.exp(-rate * dt)))
}
