import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { buildHome } from '@/home/buildHome'
import { CAMERA_ONLY_COLLIDERS, FRONT_DOOR_COLLIDER, HOME_COLLIDERS, SPOTS } from '@/home/homeLayout'
import { actionFor, isHomeSpotId, promptFor } from '@/home/routine'
import { useRoutineStore } from '@/state/useRoutineStore'
import type { RigInteraction } from './PlayerRig'

// What the home scene (Stage 4) and the neighbourhood scene (Stage 5) share: the colliders of the
// house with the front door shut and open, the morning-routine interaction, the animation of the
// door and the notebook, and the three warm lights seen in the photographs.

/** Colliders with the front door shut, and with it open (the doorway is then a gap). */
export const COLLIDERS_SHUT = [...HOME_COLLIDERS, FRONT_DOOR_COLLIDER]
export const COLLIDERS_OPEN = HOME_COLLIDERS
/** The same, plus the ceiling fixtures and air-conditioners the camera keeps out of. */
export const CAMERA_SHUT = [...COLLIDERS_SHUT, ...CAMERA_ONLY_COLLIDERS]
export const CAMERA_OPEN = [...COLLIDERS_OPEN, ...CAMERA_ONLY_COLLIDERS]

/** How far the front door swings open (radians, about the hinge, out onto the porch). */
const DOOR_OPEN_ANGLE = -Math.PI / 2 + 0.08

export const INTERACTION: RigInteraction = {
  spots: SPOTS,
  promptAt: (spot) => promptFor(spot, useRoutineStore.getState().routine),
  actionAt: (spot) => actionFor(spot),
  onDone: (spot) => {
    if (isHomeSpotId(spot.id)) useRoutineStore.getState().finish(spot.id)
  },
}

/** Swings the front door with the routine and hides the notebook once it is packed. */
export function useHomeAnimation(home: ReturnType<typeof buildHome>): void {
  const doorAngle = useRef(0)
  useFrame((_, delta) => {
    const { routine } = useRoutineStore.getState()
    const wanted = routine.doorOpen ? DOOR_OPEN_ANGLE : 0
    doorAngle.current += (wanted - doorAngle.current) * (1 - Math.exp(-5 * Math.min(delta, 0.1)))
    home.frontDoor.rotation.y = doorAngle.current
    home.notebook.visible = !routine.done.includes('pack')
  })
}

/** The chandelier, the bedside lamp and the dining pendant. */
export function HomeLights() {
  return (
    <>
      <pointLight position={[1.7, 2.1, -3.2]} intensity={9} distance={9} decay={2} color="#ffd9a0" />
      <pointLight position={[5.6, 2.3, -4.6]} intensity={7} distance={8} decay={2} color="#ffd2c0" />
      <pointLight position={[3.9, 2.5, -8.0]} intensity={6} distance={8} decay={2} color="#ffe6c4" />
    </>
  )
}
