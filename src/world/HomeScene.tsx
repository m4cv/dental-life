import { useEffect, useMemo } from 'react'
import { PALETTE } from '@/config/palette'
import { buildHome } from '@/home/buildHome'
import { CEILING_Y, HOME_BOUNDS } from '@/home/homeLayout'
import { spawnFromQuery } from '@/home/spawn'
import { useRoutineStore } from '@/state/useRoutineStore'
import { CAMERA_OPEN, CAMERA_SHUT, COLLIDERS_OPEN, COLLIDERS_SHUT, HomeLights, INTERACTION, useHomeAnimation } from './homeShared'
import { PlayerRig, type RigConfig } from './PlayerRig'

/**
 * Stage 4: the home alone, as a walkable interior with a morning routine. Since Stage 5 the default
 * scene is the whole neighbourhood (NeighbourhoodScene); this one stays reachable at ?scene=home so
 * the Stage 4 tests keep running against the same set. Rooms, furniture and colours follow the
 * photographs; the layout (room sizes, door positions) is estimated until a plan exists.
 */
export function HomeScene() {
  const home = useMemo(() => buildHome(), [])
  const spawn = useMemo(() => spawnFromQuery(window.location.search), [])

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
      cameraColliders: () => (useRoutineStore.getState().routine.doorOpen ? CAMERA_OPEN : CAMERA_SHUT),
      ceilingY: CEILING_Y,
      camDist: 3.2,
      // Mostly overhead: indoors the sun is only there to give her and the furniture soft shadows.
      sun: { offset: [2, 14, 3], intensity: 0.9, half: 6 },
      interaction: INTERACTION,
    }),
    [spawn],
  )

  useHomeAnimation(home)

  return (
    <>
      <color attach="background" args={[PALETTE.sky]} />
      <fog attach="fog" args={[PALETTE.haze, 25, 90]} />
      <hemisphereLight args={['#f3efe6', '#b9a98c', 0.75]} />
      <ambientLight intensity={0.28} color="#fff3df" />
      <HomeLights />
      <primitive object={home.group} />
      <PlayerRig config={rig} />
    </>
  )
}
