import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { DirectionalLight, Group, PerspectiveCamera } from 'three'
import { CAM, applyLook, cameraOffset, createCam, easeArm, fovForAspect, safeDistance } from '@/camera/followCamera'
import { PlayerCharacter } from '@/character/PlayerCharacter'
import { RUN_SPEED, WALK_SPEED } from '@/character/animations/pose'
import { DEFAULT_QUALITY, GRAPHICS_PROFILES } from '@/config/graphics'
import { PALETTE } from '@/config/palette'
import { input, readStick, resetInput, takeLook } from '@/controls/input'
import { createPlayer, stepPlayer, wrapAngle } from '@/controls/movement'
import { useControlStore } from '@/state/useControlStore'
import { usePlayerStore } from '@/state/usePlayerStore'
import { COURTYARD_COLLIDERS, SPAWN, WORLD_BOUNDS } from './courtyardLayout'
import { CourtyardBackdrop } from './TestScene'

/** The courtyard paving is 4 cm thick, so the character stands on top of it. */
const GROUND_Y = 0.04

/** Sun direction, kept fixed relative to the player so her shadow always lands on screen. */
const SUN_OFFSET: [number, number, number] = [7, 13, 9]

/**
 * The player, her controller and the follow camera in one component, so the order inside a
 * frame is always: read input → move → place the character → place the camera.
 */
function PlayerRig() {
  const group = useRef<Group>(null)
  const sun = useRef<DirectionalLight>(null)
  const speed = useRef(0)
  const player = useRef(createPlayer(SPAWN.x, SPAWN.z, SPAWN.heading))
  const cam = useRef(createCam(SPAWN.heading))
  const recenterTo = useRef<number | null>(null)
  const readoutClock = useRef(0)
  const { shadowMapSize } = GRAPHICS_PROFILES[DEFAULT_QUALITY]

  useEffect(() => {
    resetInput()
    useControlStore.getState().setRun(false)
    usePlayerStore.setState({ active: true })
    return () => {
      resetInput()
      usePlayerStore.setState({ active: false })
    }
  }, [])

  useFrame(({ camera }, delta) => {
    const p = player.current
    const c = cam.current
    const dt = Math.min(delta, 0.1)

    // ---- camera input: drag / pinch / wheel, and the recenter button ----
    const look = takeLook()
    if (look.dx !== 0 || look.dy !== 0 || look.zoom !== 0) {
      applyLook(c, look.dx, look.dy, look.zoom)
      if (look.dx !== 0) recenterTo.current = null
    }
    if (input.recenter) {
      input.recenter = false
      recenterTo.current = p.heading
    }
    if (recenterTo.current !== null) {
      const diff = wrapAngle(recenterTo.current - c.yaw)
      c.yaw = wrapAngle(c.yaw + diff * (1 - Math.exp(-8 * dt)))
      if (Math.abs(diff) < 0.01) recenterTo.current = null
    }

    // ---- move ----
    const [sx, sy] = readStick()
    const running = useControlStore.getState().run || input.keyRun
    stepPlayer(p, sx, sy, c.yaw, running ? RUN_SPEED : WALK_SPEED, delta, COURTYARD_COLLIDERS, WORLD_BOUNDS)

    // ---- place the character ----
    group.current?.position.set(p.x, GROUND_Y, p.z)
    if (group.current) group.current.rotation.y = p.heading
    speed.current = p.speed

    // ---- sun follows the player so shadows stay sharp wherever she walks ----
    const light = sun.current
    if (light) {
      light.position.set(p.x + SUN_OFFSET[0], GROUND_Y + SUN_OFFSET[1], p.z + SUN_OFFSET[2])
      light.target.position.set(p.x, GROUND_Y, p.z)
      light.target.updateMatrixWorld()
    }

    // ---- place the camera (spring-arm keeps it out of walls and above the ground) ----
    const pivot: [number, number, number] = [p.x, GROUND_Y + CAM.pivotY, p.z]
    c.arm = easeArm(c.arm, safeDistance(pivot, c.yaw, c.pitch, c.dist, COURTYARD_COLLIDERS), dt)
    const o = cameraOffset(c.yaw, c.pitch, c.arm)
    camera.position.set(pivot[0] + o[0], pivot[1] + o[1], pivot[2] + o[2])
    camera.lookAt(pivot[0], pivot[1], pivot[2])
    const lens = camera as PerspectiveCamera
    const fov = fovForAspect(lens.aspect)
    if (lens.fov !== fov) {
      lens.fov = fov
      lens.updateProjectionMatrix()
    }

    // ---- low-rate read-out for the diagnostics panel ----
    readoutClock.current += delta
    if (readoutClock.current >= 0.25) {
      readoutClock.current = 0
      const deg = Math.round(((c.yaw * 180) / Math.PI + 360) % 360)
      usePlayerStore.setState({ x: p.x, z: p.z, speed: p.speed, camDeg: deg, camDist: c.dist })
    }
  })

  return (
    <>
      <directionalLight
        ref={sun}
        intensity={2.5}
        color={PALETTE.sun}
        castShadow
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
      />
      <group ref={group} position={[SPAWN.x, GROUND_Y, SPAWN.z]} rotation={[0, SPAWN.heading, 0]}>
        <PlayerCharacter speed={speed} />
      </group>
    </>
  )
}

/**
 * Stage 3 scene: the player walks and runs around the courtyard test set with touch controls.
 * The set is still the Stage 1 stand-in; real locations start in Stage 4.
 */
export function PlayableScene() {
  return (
    <>
      <color attach="background" args={[PALETTE.sky]} />
      <fog attach="fog" args={[PALETTE.haze, 30, 120]} />
      <hemisphereLight args={[PALETTE.skyLight, PALETTE.sand, 1.05]} />
      <CourtyardBackdrop />
      <PlayerRig />
    </>
  )
}
