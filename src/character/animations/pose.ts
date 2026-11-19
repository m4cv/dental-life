/**
 * Procedural locomotion for the main character. Pure maths — no three.js, no React — so it can
 * be unit-tested in Node (scripts/test-pose.mjs) and reused by any controller.
 *
 * Conventions (character local space: +y up, +z forward, +x = the character's LEFT):
 *  - Every pitch angle here is "forward positive" (a thigh swung forward is positive).
 *    The renderer converts to three.js rotations for each kind of segment.
 *  - Speeds are metres per second. Idle = 0, WALK_SPEED, RUN_SPEED are the blend anchors.
 */

/** Skeleton dimensions in metres. Standing ankle height = hipY - thigh - shin. */
export const RIG = {
  hipY: 0.85,
  hipX: 0.09,
  thigh: 0.4,
  shin: 0.37,
  ankleY: 0.08,
  waistY: 0.95,
  shoulderY: 1.3,
  shoulderX: 0.175,
  upperArm: 0.28,
  foreArm: 0.25,
  neckY: 1.42,
  headCenterY: 1.52,
} as const

/** Extra hem depth at full stride, as a fraction (1.45× deeper at a run). */
export const SKIRT_FLARE_MAX = 0.45

export const WALK_SPEED = 1.45
export const RUN_SPEED = 3.6

const TAU = Math.PI * 2

export interface LegPose {
  /** Hip swing, forward positive (rad). */
  thigh: number
  /** Knee flexion, >= 0 bends the shin backwards (rad). */
  knee: number
  /** Ankle compensation in three.js rotation.x sign (rad). */
  foot: number
}

export interface ArmPose {
  /** Shoulder swing, forward positive (rad). */
  pitch: number
  /** Arm lifted away from the body (rad, >= 0 is outward). */
  abduct: number
  /** Elbow flexion, forward positive (rad). */
  elbow: number
}

export interface Pose {
  bodyX: number
  bodyY: number
  hipsYaw: number
  torsoPitch: number
  torsoYaw: number
  torsoRoll: number
  headPitch: number
  headYaw: number
  headRoll: number
  /** 0 = eyes open, 1 = closed. */
  blink: number
  /** Coat hem swing, forward positive (rad). */
  skirtPitch: number
  skirtRoll: number
  /** Coat hem depth multiplier, 1 … 1 + SKIRT_FLARE_MAX, so legs never poke through at a run. */
  skirtFlare: number
  bagRoll: number
  bagPitch: number
  legL: LegPose
  legR: LegPose
  armL: ArmPose
  armR: ArmPose
}

export function createPose(): Pose {
  return {
    bodyX: 0,
    bodyY: 0,
    hipsYaw: 0,
    torsoPitch: 0,
    torsoYaw: 0,
    torsoRoll: 0,
    headPitch: 0,
    headYaw: 0,
    headRoll: 0,
    blink: 0,
    skirtPitch: 0,
    skirtRoll: 0,
    skirtFlare: 1,
    bagRoll: 0,
    bagPitch: 0,
    legL: { thigh: 0, knee: 0, foot: 0 },
    legR: { thigh: 0, knee: 0, foot: 0 },
    armL: { pitch: 0, abduct: 0, elbow: 0 },
    armR: { pitch: 0, abduct: 0, elbow: 0 },
  }
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (t: number) => {
  const c = clamp(t, 0, 1)
  return c * c * (3 - 2 * c)
}

/** Position on the idle(0) → walk(1) → run(2) scale for a speed in m/s. */
export function gaitBlend(speed: number): number {
  const s = Math.max(0, speed)
  const u = s <= WALK_SPEED ? s / WALK_SPEED : 1 + (s - WALK_SPEED) / (RUN_SPEED - WALK_SPEED)
  return Math.min(u, 2)
}

/** Blend a value between its idle, walk and run settings. */
function mix3(idle: number, walk: number, run: number, u: number): number {
  return u <= 1 ? lerp(idle, walk, smooth(u)) : lerp(walk, run, smooth(u - 1))
}

/** Gait-cycle angular speed (rad/s). Zero when standing still. */
export function stepRate(speed: number): number {
  if (speed < 0.02) return 0
  const u = gaitBlend(speed)
  return u <= 1 ? 3.4 + 2.25 * u : 5.65 + 3.15 * (u - 1)
}

/** Advance the gait phase; keeps it inside [0, 2π). */
export function advancePhase(phase: number, speed: number, dt: number): number {
  const next = (phase + stepRate(speed) * dt) % TAU
  return next < 0 ? next + TAU : next
}

/** Deterministic blink: roughly every 3–5 seconds, lasting ~0.18 s. Returns 0..1. */
export function blinkAmount(time: number): number {
  const period = 3.6
  const index = Math.floor(time / period)
  const hash = Math.abs(Math.sin(index * 127.1 + 311.7) * 43758.5453) % 1
  const start = 0.5 + hash * 2.2
  const d = time - index * period - start
  const length = 0.18
  if (d < 0 || d > length) return 0
  return Math.sin((d / length) * Math.PI)
}

/** Height of the ankle above the ground for a leg, from hip swing and knee flexion. */
export function ankleHeight(thigh: number, knee: number): number {
  return RIG.hipY - RIG.thigh * Math.cos(thigh) - RIG.shin * Math.cos(thigh - knee)
}

function solveLeg(out: LegPose, p: number, hipAmp: number, kneeBase: number, kneeSwing: number) {
  const a = hipAmp * Math.sin(p)
  const swing = Math.max(0, Math.cos(p + 0.35))
  const k = kneeBase + kneeSwing * Math.pow(swing, 1.6)
  out.thigh = a
  out.knee = k
  out.foot = 0.75 * (a - k)
}

/**
 * Fill `pose` for the given speed (m/s), gait phase (rad) and clock time (s).
 * The body is lowered each frame so the lowest foot just touches the ground, which gives the
 * natural walking bob for free; running adds a flight lift on top. Feet never sink below y = 0.
 */
export function solvePose(pose: Pose, speed: number, phase: number, time: number): Pose {
  const u = gaitBlend(speed)
  const runW = smooth(u - 1)
  const idleW = 1 - smooth(u / 0.7)

  const hipAmp = mix3(0, 0.36, 0.62, u)
  const kneeBase = mix3(0, 0.06, 0.3, u)
  const kneeSwing = mix3(0, 0.62, 1.25, u)
  const armAmp = mix3(0, 0.34, 0.62, u)
  const elbowBase = mix3(0.16, 0.2, 1.35, u)
  const elbowSwing = mix3(0, 0.45, 0.35, u)
  const abduct = mix3(0.04, 0.05, 0.03, u)
  const lean = mix3(0, 0.03, 0.2, u)
  const hipsTwist = mix3(0, 0.09, 0.2, u)
  const sway = mix3(0, 0.022, 0.01, u)
  const rollAmp = mix3(0, 0.03, 0.05, u)

  const sinP = Math.sin(phase)
  const cosP = Math.cos(phase)

  // Right leg leads the cycle, left leg is half a cycle behind.
  solveLeg(pose.legR, phase, hipAmp, kneeBase, kneeSwing)
  solveLeg(pose.legL, phase + Math.PI, hipAmp, kneeBase, kneeSwing)

  // Arms swing against the leg on the same side.
  const pitchR = -armAmp * sinP
  const pitchL = armAmp * sinP
  const norm = (pitch: number) => (armAmp > 1e-4 ? pitch / armAmp : 0)
  const breathe = Math.sin(time * 1.9)
  pose.armR.pitch = pitchR + idleW * 0.02 * breathe
  pose.armL.pitch = pitchL - idleW * 0.02 * breathe
  pose.armR.elbow = elbowBase + elbowSwing * (0.5 + 0.5 * norm(pitchR))
  pose.armL.elbow = elbowBase + elbowSwing * (0.5 + 0.5 * norm(pitchL))
  pose.armR.abduct = abduct
  pose.armL.abduct = abduct

  // Ground contact: drop the body until the lowest ankle is at standing height, then add lift.
  const lowest = Math.min(
    ankleHeight(pose.legL.thigh, pose.legL.knee),
    ankleHeight(pose.legR.thigh, pose.legR.knee),
  )
  const lift = runW * 0.055 * (0.5 - 0.5 * Math.cos(2 * phase))
  pose.bodyY = RIG.ankleY - lowest + lift
  pose.bodyX = sway * cosP + idleW * 0.006 * Math.sin(time * 0.45)

  pose.hipsYaw = hipsTwist * sinP
  pose.torsoYaw = -0.9 * hipsTwist * sinP
  pose.torsoPitch = lean + idleW * 0.008 * breathe
  pose.torsoRoll = -rollAmp * cosP + idleW * 0.012 * Math.sin(time * 0.45)

  // Head stays level against the torso motion, plus a slow idle look-around.
  pose.headYaw = -0.8 * pose.torsoYaw + idleW * 0.1 * Math.sin(time * 0.37)
  pose.headPitch = -0.9 * lean + idleW * 0.03 * Math.sin(time * 0.53 + 1)
  pose.headRoll = -0.8 * pose.torsoRoll
  pose.blink = blinkAmount(time)

  // Coat hem: flare and tilt so the leading knee never pokes through the fabric.
  const maxFwd = Math.max(pose.legL.thigh, pose.legR.thigh, 0)
  const reach = Math.max(Math.abs(pose.legL.thigh), Math.abs(pose.legR.thigh))
  pose.skirtFlare = 1 + SKIRT_FLARE_MAX * clamp((reach - 0.28) / 0.34, 0, 1)
  pose.skirtPitch = 0.35 * maxFwd
  pose.skirtRoll = -0.5 * pose.torsoRoll + 0.012 * Math.sin(time * 0.9) * idleW

  pose.bagRoll = mix3(0, 0.08, 0.18, u) * Math.sin(phase + 0.8) + 0.01 * Math.sin(time * 1.1)
  pose.bagPitch = mix3(0, 0.05, 0.14, u) * Math.cos(2 * phase + 0.3)

  return pose
}
