import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { PALETTE } from '@/config/palette'
import { buildHome } from '@/home/buildHome'
import {
  CEILING_Y, FRONT_DOOR_COLLIDER, HOME_BOUNDS, HOME_COLLIDERS, SPOTS,
} from '@/home/homeLayout'
import { actionFor, promptFor } from '@/home/routine'
import { spawnFromQuery } from '@/home/spawn'
import { useRoutineStore } from '@/state/useRoutineStore'
import { PlayerRig, type RigConfig, type RigInteraction } from './PlayerRig'

/** Colliders with the front door shut, and with it open (the doorway is then a gap). */
const COLLIDERS_SHUT = [...HOME_COLLIDERS, FRONT_DOOR_COLLIDER]
const COLLIDERS_OPEN = HOME_COLLIDERS

/** How far the front door swings open (radians, about the hinge, out onto the porch). */
const DOOR_OPEN_ANGLE = -Math.PI / 2 + 0.08

const INTERACTION: RigInteraction = {
  spots: SPOTS,
  promptAt: (spot) => promptFor(spot, useRoutineStore.getState().routine),
  actionAt: (spot) => actionFor(spot),
  onDone: (spot) => useRoutineStore.getState().finish(spot.id),
}

/**
 * Stage 4: the home, as a walkable interior with a morning routine. Rooms, furniture and colours
 * follow the photographs; the layout (room sizes, door positions) is estimated until a plan exists.
 */
export function HomeScene() {
  const home = useMemo(() => buildHome(), [])
  const spawn = useMemo(() => spawnFromQuery(window.location.search), [])
  const doorAngle = useRef(0)

  useEffect(() => {
    useRoutineStore.getState().reset()
    return () => home.dispose()
  }, [home])

  const rig = useMemo<RigConfig>(
    () => ({
      spawn,
      groundY: 0,
      bounds: HOME_BOUNDS,
      colliders: () => (useRoutineStore.getState().routine.doorOpen ? COLLIDERS_OPEN : COLLIDERS_SHUT),
      ceilingY: CEILING_Y,
      camDist: 3.2,
      // Mostly overhead: indoors the sun is only there to give her and the furniture soft shadows.
      sun: { offset: [2, 14, 3], intensity: 0.9, half: 6 },
      interaction: INTERACTION,
    }),
    [spawn],
  )

  useFrame((_, delta) => {
    const { routine } = useRoutineStore.getState()
    const wanted = routine.doorOpen ? DOOR_OPEN_ANGLE : 0
    doorAngle.current += (wanted - doorAngle.current) * (1 - Math.exp(-5 * Math.min(delta, 0.1)))
    home.frontDoor.rotation.y = doorAngle.current
    home.notebook.visible = !routine.done.includes('pack')
  })

  return (
    <>
      <color attach="background" args={[PALETTE.sky]} />
      <fog attach="fog" args={[PALETTE.haze, 25, 90]} />
      <hemisphereLight args={['#f3efe6', '#b9a98c', 0.75]} />
      <ambientLight intensity={0.28} color="#fff3df" />
      {/* the three warm fittings seen in the photographs: chandelier, bedside lamp, dining pendant */}
      <pointLight position={[1.7, 2.1, -3.2]} intensity={9} distance={9} decay={2} color="#ffd9a0" />
      <pointLight position={[5.6, 2.3, -4.6]} intensity={7} distance={8} decay={2} color="#ffd2c0" />
      <pointLight position={[3.9, 2.5, -8.0]} intensity={6} distance={8} decay={2} color="#ffe6c4" />
      <primitive object={home.group} />
      <PlayerRig config={rig} />
    </>
  )
}
