import { PALETTE } from '@/config/palette'
import { COURTYARD_COLLIDERS, SPAWN, WORLD_BOUNDS } from './courtyardLayout'
import { PlayerRig, type RigConfig } from './PlayerRig'
import { CourtyardBackdrop } from './TestScene'

/** The courtyard paving is 4 cm thick, so the character stands on top of it. */
const RIG: RigConfig = {
  spawn: SPAWN,
  groundY: 0.04,
  bounds: WORLD_BOUNDS,
  colliders: () => COURTYARD_COLLIDERS,
  // Sun direction, kept fixed relative to the player so her shadow always lands on screen.
  sun: { offset: [7, 13, 9], intensity: 2.5, half: 7 },
}

/**
 * The Stage 3 test set: the player walks and runs around the courtyard with touch controls.
 * Since Stage 4 the home is the default scene; this one stays reachable at ?scene=courtyard so the
 * movement and camera tests keep running against the same set.
 */
export function PlayableScene() {
  return (
    <>
      <color attach="background" args={[PALETTE.sky]} />
      <fog attach="fog" args={[PALETTE.haze, 30, 120]} />
      <hemisphereLight args={[PALETTE.skyLight, PALETTE.sand, 1.05]} />
      <CourtyardBackdrop />
      <PlayerRig config={RIG} />
    </>
  )
}
