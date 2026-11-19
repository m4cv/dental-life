// Unit checks for the locomotion maths. Runs on plain Node (22.18+ strips TypeScript types).
import {
  RIG, WALK_SPEED, RUN_SPEED, createPose, solvePose, ankleHeight, advancePhase, stepRate, blinkAmount, gaitBlend, applyGesture, GESTURES,
} from '../src/character/animations/pose.ts'

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures += 1
}

const TAU = Math.PI * 2
const speeds = [0, 0.3, 0.8, WALK_SPEED, 2.2, 3, RUN_SPEED, 5]
const steps = 360

const flat = (p) => [
  p.bodyX, p.bodyY, p.hipsYaw, p.torsoPitch, p.torsoYaw, p.torsoRoll, p.headPitch, p.headYaw, p.headRoll,
  p.blink, p.skirtPitch, p.skirtRoll, p.skirtFlare, p.bagRoll, p.bagPitch,
  ...Object.values(p.legL), ...Object.values(p.legR), ...Object.values(p.armL), ...Object.values(p.armR),
]

// 1. Everything finite, feet never below the ground, bob range plausible.
{
  let finite = true
  let worst = Infinity
  const bob = {}
  for (const s of speeds) {
    let lo = Infinity, hi = -Infinity
    for (let i = 0; i < steps; i++) {
      const p = solvePose(createPose(), s, (i / steps) * TAU, i * 0.037)
      if (!flat(p).every(Number.isFinite)) finite = false
      for (const leg of [p.legL, p.legR]) {
        const sole = p.bodyY + ankleHeight(leg.thigh, leg.knee) - RIG.ankleY
        worst = Math.min(worst, sole)
      }
      lo = Math.min(lo, p.bodyY); hi = Math.max(hi, p.bodyY)
    }
    bob[s] = hi - lo
  }
  check('all pose values are finite', finite)
  check('feet never sink below the ground', worst > -1e-9, `lowest sole ${worst.toExponential(2)} m`)
  check('idle has almost no vertical bob', bob[0] < 0.001, `${(bob[0] * 100).toFixed(2)} cm`)
  check('walk bob is 2–7 cm', bob[WALK_SPEED] > 0.02 && bob[WALK_SPEED] < 0.07, `${(bob[WALK_SPEED] * 100).toFixed(1)} cm`)
  check('run bob is under 14 cm', bob[RUN_SPEED] < 0.14, `${(bob[RUN_SPEED] * 100).toFixed(1)} cm`)
}

// 2. The cycle repeats seamlessly.
{
  let maxDiff = 0
  for (const s of [WALK_SPEED, RUN_SPEED]) {
    for (let i = 0; i < 60; i++) {
      const ph = (i / 60) * TAU
      const a = flat(solvePose(createPose(), s, ph, 1))
      const b = flat(solvePose(createPose(), s, ph + TAU, 1))
      a.forEach((v, k) => { maxDiff = Math.max(maxDiff, Math.abs(v - b[k])) })
    }
  }
  check('gait cycle is periodic', maxDiff < 1e-9, `max diff ${maxDiff.toExponential(1)}`)
}

// 3. Left and right legs are exactly half a cycle apart.
{
  let maxDiff = 0
  for (let i = 0; i < 120; i++) {
    const ph = (i / 120) * TAU
    const a = solvePose(createPose(), WALK_SPEED, ph, 0)
    const b = solvePose(createPose(), WALK_SPEED, ph + Math.PI, 0)
    for (const k of ['thigh', 'knee', 'foot']) maxDiff = Math.max(maxDiff, Math.abs(a.legL[k] - b.legR[k]))
  }
  check('legs are mirrored half a cycle apart', maxDiff < 1e-9)
}

// 4. No pops when speed changes smoothly (blend continuity).
{
  let worst = 0
  for (let s = 0; s < 4.5; s += 0.01) {
    const a = flat(solvePose(createPose(), s, 1.3, 2))
    const b = flat(solvePose(createPose(), s + 0.01, 1.3, 2))
    a.forEach((v, k) => { worst = Math.max(worst, Math.abs(v - b[k])) })
  }
  check('pose blends continuously with speed', worst < 0.05, `largest step ${worst.toFixed(4)}`)
}

// 5. Joint limits stay human.
{
  let kneeMax = 0, thighMax = 0, elbowMax = 0, kneeMin = 0
  for (const s of speeds) for (let i = 0; i < steps; i++) {
    const p = solvePose(createPose(), s, (i / steps) * TAU, 0)
    for (const leg of [p.legL, p.legR]) {
      kneeMax = Math.max(kneeMax, leg.knee); kneeMin = Math.min(kneeMin, leg.knee)
      thighMax = Math.max(thighMax, Math.abs(leg.thigh))
    }
    for (const arm of [p.armL, p.armR]) elbowMax = Math.max(elbowMax, arm.elbow)
  }
  check('knees never hyper-extend', kneeMin >= 0)
  check('knee flexion under 100°', kneeMax < 1.75, `${(kneeMax * 57.3).toFixed(0)}°`)
  check('hip swing under 45°', thighMax < 0.79, `${(thighMax * 57.3).toFixed(0)}°`)
  check('elbow flexion under 115°', elbowMax < 2, `${(elbowMax * 57.3).toFixed(0)}°`)
}

// 6. Phase and blink helpers.
{
  check('standing still does not advance the gait', advancePhase(1, 0, 1) === 1 && stepRate(0) === 0)
  let phase = 0
  for (let i = 0; i < 2000; i++) phase = advancePhase(phase, RUN_SPEED, 0.016)
  check('phase stays inside [0, 2π)', phase >= 0 && phase < TAU)
  let blinks = 0, prev = 0
  for (let t = 0; t < 60; t += 0.01) { const b = blinkAmount(t); if (prev === 0 && b > 0) blinks++; prev = b }
  check('blinks 10–25 times a minute', blinks >= 10 && blinks <= 25, `${blinks}`)
  check('gait blend anchors', gaitBlend(0) === 0 && gaitBlend(WALK_SPEED) === 1 && gaitBlend(RUN_SPEED) === 2 && gaitBlend(99) === 2)
}

// Informational: pose snapshot at mid-stride.
{
  const w = solvePose(createPose(), WALK_SPEED, Math.PI / 2, 0)
  const r = solvePose(createPose(), RUN_SPEED, Math.PI / 2, 0)
  console.log(`info  walk @π/2: thigh R ${(w.legR.thigh * 57.3).toFixed(0)}° knee L ${(w.legL.knee * 57.3).toFixed(0)}° bodyY ${(w.bodyY * 100).toFixed(1)} cm`)
  console.log(`info  run  @π/2: thigh R ${(r.legR.thigh * 57.3).toFixed(0)}° knee L ${(r.legL.knee * 57.3).toFixed(0)}° bodyY ${(r.bodyY * 100).toFixed(1)} cm flare ${r.skirtFlare.toFixed(2)}`)
}

// Gestures (Stage 4): hands-busy standing actions blended over the standing pose.
{
  const kinds = Object.keys(GESTURES)
  check('there are six gestures: brush, mirror, dress, eat, pack, open', kinds.length === 6 && ['brush', 'mirror', 'dress', 'eat', 'pack', 'open'].every((k) => kinds.includes(k)))
  const before = flat(solvePose(createPose(), 0, 0, 0))
  check('weight 0 leaves the pose untouched', kinds.every((k) => flat(applyGesture(solvePose(createPose(), 0, 0, 0), k, 0, 1.3)).every((v, i) => v === before[i])))
  let finite = true
  let legsKept = true
  let armsMoved = true
  let tooFar = false
  for (const k of kinds) {
    for (let i = 0; i < 120; i++) {
      const base = solvePose(createPose(), 0, 0, i * 0.05)
      const legs = JSON.stringify([base.legL, base.legR, base.bodyY, base.hipsYaw])
      const g = applyGesture(solvePose(createPose(), 0, 0, i * 0.05), k, 1, i * 0.05)
      if (!flat(g).every(Number.isFinite)) finite = false
      if (JSON.stringify([g.legL, g.legR, g.bodyY, g.hipsYaw]) !== legs) legsKept = false
      if (Math.abs(g.armR.pitch - base.armR.pitch) < 0.05 && Math.abs(g.armR.elbow - base.armR.elbow) < 0.05) armsMoved = false
      // arms stay within a sane range so nothing clips through the head or the body
      if (Math.abs(g.armR.pitch) > 1.6 || Math.abs(g.armL.pitch) > 1.6 || g.armR.elbow > 2.3 || g.armL.elbow > 2.3 || g.armR.elbow < -0.1) tooFar = true
    }
  }
  check('every gesture stays finite over time', finite)
  check('gestures never touch the legs, the hips or the body height (she keeps standing)', legsKept)
  check('every gesture visibly moves the right arm', armsMoved)
  check('no gesture pushes an arm past a sane range', !tooFar)
  const half = applyGesture(solvePose(createPose(), 0, 0, 0), 'brush', 0.5, 0)
  const full = applyGesture(solvePose(createPose(), 0, 0, 0), 'brush', 1, 0)
  const none = solvePose(createPose(), 0, 0, 0)
  check('half weight lies between none and full', half.armR.pitch > Math.min(none.armR.pitch, full.armR.pitch) && half.armR.pitch < Math.max(none.armR.pitch, full.armR.pitch))
}

if (failures) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nAll pose checks passed')
