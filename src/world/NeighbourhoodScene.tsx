import { useEffect, useMemo } from 'react'
import { PALETTE } from '@/config/palette'
import { buildGrid, queryGrid } from '@/controls/spatial'
import { buildHome } from '@/home/buildHome'
import { CAMERA_ONLY_COLLIDERS, CEILING_Y, FRONT_DOOR_COLLIDER, HOME_COLLIDERS, HOME_SPAWN } from '@/home/homeLayout'
import { spawnFromQuery } from '@/home/spawn'
import { useRoutineStore } from '@/state/useRoutineStore'
import { buildStreet } from '@/street/buildStreet'
import { STREET_COLLIDERS, WORLD_BOUNDS, insideHome } from '@/street/streetLayout'
import { HomeLights, INTERACTION, useHomeAnimation } from './homeShared'
import { PlayerRig, type RigConfig } from './PlayerRig'

/**
 * Colliders are kept in a coarse grid, so the 130-odd colliders of the street cost a handful of
 * tests per frame. One grid per state of the front door; the camera's grids reach further because
 * the camera can sit several metres behind her, and also include the things hanging from ceilings.
 */
const WORLD = [...HOME_COLLIDERS, ...STREET_COLLIDERS]
const GRIDS = {
  moveShut: buildGrid([...WORLD, FRONT_DOOR_COLLIDER], WORLD_BOUNDS, 12, 2),
  moveOpen: buildGrid(WORLD, WORLD_BOUNDS, 12, 2),
  camShut: buildGrid([...WORLD, FRONT_DOOR_COLLIDER, ...CAMERA_ONLY_COLLIDERS], WORLD_BOUNDS, 12, 10.5),
  camOpen: buildGrid([...WORLD, ...CAMERA_ONLY_COLLIDERS], WORLD_BOUNDS, 12, 10.5),
}

/** Indoors the sun is mostly overhead (soft shadows under the furniture); outdoors it is a low morning sun from the east. */
const SUN_INDOORS = { offset: [2, 14, 3], intensity: 0.9 } as const
const SUN_OUTDOORS = { offset: [20, 16, 8], intensity: 2.3 } as const

/**
 * Stage 5: the home, its walled yard and the neighbourhood around it as ONE world, so she walks out
 * of the front door and down the lane without a loading screen. The camera and the light switch
 * between indoors and outdoors by where she stands (see PlayerRig).
 *
 * Add ?routine=done to skip the morning routine (the front door starts open), and ?at=x,z,deg to
 * start anywhere in the neighbourhood (for testing and for looking around).
 */
export function NeighbourhoodScene() {
  const home = useMemo(() => buildHome(), [])
  const street = useMemo(() => buildStreet(), [])
  const spawn = useMemo(() => spawnFromQuery(window.location.search, WORLD_BOUNDS, HOME_SPAWN), [])

  useEffect(() => {
    const store = useRoutineStore.getState()
    store.reset()
    if (new URLSearchParams(window.location.search).get('routine') === 'done') store.skipToDoor()
    return () => {
      home.dispose()
      street.dispose()
    }
  }, [home, street])

  const rig = useMemo<RigConfig>(
    () => ({
      spawn,
      groundY: 0,
      bounds: WORLD_BOUNDS,
      colliders: (x, z) => queryGrid(useRoutineStore.getState().routine.doorOpen ? GRIDS.moveOpen : GRIDS.moveShut, x, z),
      cameraColliders: (x, z) => queryGrid(useRoutineStore.getState().routine.doorOpen ? GRIDS.camOpen : GRIDS.camShut, x, z),
      ceilingY: (x, z) => (insideHome(x, z) ? CEILING_Y : Infinity),
      camDist: 3.6,
      sun: { ...SUN_INDOORS, half: 12, far: 80 },
      sunAt: (x, z) => (insideHome(x, z) ? SUN_INDOORS : SUN_OUTDOORS),
      interaction: INTERACTION,
    }),
    [spawn],
  )

  useHomeAnimation(home)

  return (
    <>
      <color attach="background" args={[PALETTE.sky]} />
      <fog attach="fog" args={[PALETTE.haze, 45, 190]} />
      <hemisphereLight args={['#f3efe6', '#b9a98c', 0.75]} />
      <ambientLight intensity={0.28} color="#fff3df" />
      <HomeLights />
      <primitive object={home.group} />
      <primitive object={street.group} />
      <PlayerRig config={rig} />
    </>
  )
}
