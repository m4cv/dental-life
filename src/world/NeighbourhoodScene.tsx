import { useEffect, useMemo, useRef } from 'react'
import type { PointLight } from 'three'
import { PALETTE } from '@/config/palette'
import { buildGrid, queryGrid } from '@/controls/spatial'
import { buildHome } from '@/home/buildHome'
import { CAMERA_ONLY_COLLIDERS, CEILING_Y, FRONT_DOOR_COLLIDER, HOME_SPAWN } from '@/home/homeLayout'
import { formatClock } from '@/home/routine'
import { spawnFromQuery } from '@/home/spawn'
import { dayFromQuery } from '@/academics/timetable'
import { useAcademicStore } from '@/state/useAcademicStore'
import { useRouteStore } from '@/state/useRouteStore'
import { useRoutineStore } from '@/state/useRoutineStore'
import { buildStreet } from '@/street/buildStreet'
import { insideHome } from '@/street/streetLayout'
import { buildRoute } from '@/streets/buildRoute'
import { ROUTE_BOUNDS, ROUTE_CAMERA_COLLIDERS, ROUTE_CAR_COLLIDERS, WORLD_COLLIDERS, atUniversity, minutesFor } from '@/streets/routeLayout'
import { buildCampus } from '@/university/buildCampus'
import { CEIL_Y, enteredBuilding, floorHeightAt, insideBuilding } from '@/university/uniLayout'
import { buildCar } from '@/vehicle/buildCar'
import { carFromQuery, startsDriving } from '@/vehicle/carLayout'
import { CAMPUS_INTERACTION } from './campusInteraction'
import { HomeLights, useHomeAnimation } from './homeShared'
import { PlayerRig, type RigConfig } from './PlayerRig'

/**
 * Colliders are kept in a coarse grid, so the 330-odd colliders of the world cost a handful of
 * tests per frame. One grid per state of the front door; the camera's grids reach further because
 * the camera can sit several metres behind her, and also include the things hanging from ceilings.
 */
const WORLD = WORLD_COLLIDERS
const BOUNDS = ROUTE_BOUNDS
const GRIDS = {
  moveShut: buildGrid([...WORLD, FRONT_DOOR_COLLIDER], BOUNDS, 12, 2),
  moveOpen: buildGrid(WORLD, BOUNDS, 12, 2),
  camShut: buildGrid([...WORLD, FRONT_DOOR_COLLIDER, ...CAMERA_ONLY_COLLIDERS, ...ROUTE_CAMERA_COLLIDERS], BOUNDS, 12, 10.5),
  camOpen: buildGrid([...WORLD, ...CAMERA_ONLY_COLLIDERS, ...ROUTE_CAMERA_COLLIDERS], BOUNDS, 12, 10.5),
  // the car is wider and longer than a person: its collision circles reach about 2 m from its centre; it cannot climb the university's steps
  carShut: buildGrid([...WORLD, FRONT_DOOR_COLLIDER, ...ROUTE_CAR_COLLIDERS], BOUNDS, 12, 3.2),
  carOpen: buildGrid([...WORLD, ...ROUTE_CAR_COLLIDERS], BOUNDS, 12, 3.2),
}

/** Indoors the sun is mostly overhead (soft shadows under the furniture); outdoors it is a low morning sun from the east. */
const SUN_INDOORS = { offset: [2, 14, 3], intensity: 0.9 } as const
const SUN_OUTDOORS = { offset: [20, 16, 8], intensity: 2.3 } as const

/**
 * Stage 5: the home, its walled yard and the neighbourhood around it as ONE world, so she walks out
 * of the front door and down the lane without a loading screen. The camera and the light switch
 * between indoors and outdoors by where she stands (see PlayerRig).
 * Stage 6: a car is parked in the lane; she can get in and drive anywhere the streets allow.
 * Stage 7: Ninety Street goes on north to a roundabout, Al-Shaab Street leads west to the university's
 * gate, and the clock runs with the distance once she has left home.
 * Stage 8: the university's main entrance is open. Up three steps she walks into the lobby, the corridor,
 * two lecture halls and an office, and out through the back door into the courtyard. Inside, the camera
 * stays under the ceiling and a light travels with her.
 *
 * Add ?routine=done to skip the morning routine (the front door starts open), ?at=x,z,deg to
 * start anywhere in the neighbourhood, ?car=x,z,deg to park the car somewhere else and ?drive=1 to
 * start in the driver's seat (all for testing and for looking around).
 */
export function NeighbourhoodScene() {
  const home = useMemo(() => buildHome(), [])
  const street = useMemo(() => buildStreet(), [])
  const route = useMemo(() => buildRoute(), [])
  const campus = useMemo(() => buildCampus(), [])
  const campusLight = useRef<PointLight>(null)
  const spawn = useMemo(() => spawnFromQuery(window.location.search, BOUNDS, HOME_SPAWN), [])
  const car = useMemo(() => buildCar(), [])
  const carStart = useMemo(() => carFromQuery(window.location.search, BOUNDS), [])

  useEffect(() => {
    const store = useRoutineStore.getState()
    store.reset()
    useRouteStore.getState().reset()
    const academic = useAcademicStore.getState()
    academic.reset()
    // ?day=sat|sun|mon|tue|wed|thu picks the day without the menu (a test aid)
    const queryDay = dayFromQuery(window.location.search)
    if (queryDay) academic.setDay(queryDay)
    if (new URLSearchParams(window.location.search).get('routine') === 'done') store.skipToDoor()
    return () => {
      home.dispose()
      street.dispose()
      route.dispose()
      campus.dispose()
      car.dispose()
    }
  }, [home, street, route, campus, car])

  const rig = useMemo<RigConfig>(
    () => ({
      spawn,
      groundY: 0,
      bounds: BOUNDS,
      colliders: (x, z) => queryGrid(useRoutineStore.getState().routine.doorOpen ? GRIDS.moveOpen : GRIDS.moveShut, x, z),
      cameraColliders: (x, z) => queryGrid(useRoutineStore.getState().routine.doorOpen ? GRIDS.camOpen : GRIDS.camShut, x, z),
      onTravel: (metres, x, z) => {
        const routine = useRoutineStore.getState()
        // the clock only moves with her once she has left (indoors the routine steps set the time)
        if (!routine.routine.doorOpen) return
        routine.advance(minutesFor(metres, x, z))
        if (useRouteStore.getState().arrivedAt === null && atUniversity(x, z)) {
          const now = useRoutineStore.getState().routine.minutes
          useRouteStore.getState().arrive(now)
          routine.say(`You have arrived at the university: ${formatClock(now)}`)
        }
        if (useRouteStore.getState().enteredAt === null && enteredBuilding(x, z)) {
          const now = useRoutineStore.getState().routine.minutes
          useRouteStore.getState().enter(now)
          routine.say('Welcome to the University of Science & Technology')
        }
      },
      groundAt: floorHeightAt,
      onFrame: (x, z) => {
        // the light inside the university travels with her and fades away outdoors
        const light = campusLight.current
        if (!light) return
        light.position.set(x, floorHeightAt(x, z) + 3.1, z)
        light.intensity += ((insideBuilding(x, z) ? 22 : 0) - light.intensity) * 0.2
      },
      ceilingY: (x, z) => (insideHome(x, z) ? CEILING_Y : insideBuilding(x, z) ? CEIL_Y : Infinity),
      camDist: 3.6,
      sun: { ...SUN_INDOORS, half: 12, far: 80 },
      sunAt: (x, z) => (insideHome(x, z) || insideBuilding(x, z) ? SUN_INDOORS : SUN_OUTDOORS),
      interaction: CAMPUS_INTERACTION,
      vehicle: {
        start: carStart,
        startsDriving: startsDriving(window.location.search),
        colliders: (x, z) => queryGrid(useRoutineStore.getState().routine.doorOpen ? GRIDS.carOpen : GRIDS.carShut, x, z),
        model: car,
      },
    }),
    [spawn, car, carStart],
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
      <primitive object={route.group} />
      <primitive object={campus.group} />
      <pointLight ref={campusLight} intensity={0} distance={15} decay={2} color="#fff1d6" />
      <primitive object={car.group} />
      <PlayerRig config={rig} />
    </>
  )
}
