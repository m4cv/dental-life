import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { DirectionalLight, Group, PerspectiveCamera } from 'three'
import { CAM, CAM_INDOOR, applyLook, cameraOffset, createCam, easeArm, fovForAspect, indoorPitch, safeDistance } from '@/camera/followCamera'
import { PlayerCharacter } from '@/character/PlayerCharacter'
import { RUN_SPEED, WALK_SPEED, type Gesture } from '@/character/animations/pose'
import { DEFAULT_QUALITY, GRAPHICS_PROFILES } from '@/config/graphics'
import { PALETTE } from '@/config/palette'
import { startAction, stepAction, turnToward, type Action } from '@/controls/interaction'
import { input, readStick, resetInput, takeLook } from '@/controls/input'
import { createPlayer, stepPlayer, wrapAngle, type Bounds, type Collider } from '@/controls/movement'
import type { Spot } from '@/home/homeLayout'
import { nearestSpot, type Prompt } from '@/home/routine'
import { useControlStore } from '@/state/useControlStore'
import { usePlayerStore } from '@/state/usePlayerStore'
import { usePromptStore } from '@/state/usePromptStore'

/** Something to do at fixed spots: walk close, tap Interact, she walks in and plays a gesture. */
export interface RigInteraction {
  spots: readonly Spot[]
  /** What the button offers at a spot (null = nothing left to do there). */
  promptAt: (spot: Spot) => Prompt | null
  /** How long the action takes and which gesture it plays. */
  actionAt: (spot: Spot) => { seconds: number; gesture: Gesture }
  /** Called when the gesture finishes. */
  onDone: (spot: Spot) => void
}

export interface RigConfig {
  spawn: { x: number; z: number; heading: number }
  /** Height of the floor the character stands on. */
  groundY: number
  bounds: Bounds
  /**
   * Read every frame, so a door can add or remove its collider while the game runs. Gets the
   * player's position, so a big world can hand back only the colliders near her.
   */
  colliders: (x: number, z: number) => readonly Collider[]
  /** What the camera avoids: the colliders above plus things she can walk under (default: just the colliders). */
  cameraColliders?: (x: number, z: number) => readonly Collider[]
  /**
   * Indoors: the camera stays under the ceiling, may come close and climbs to a bird's-eye view when
   * the way back is blocked. A function lets one world have inside and outside (return Infinity to
   * keep the tight-space camera without a ceiling, or undefined for the open-air camera).
   */
  ceilingY?: number | ((x: number, z: number) => number | undefined)
  /** Wanted camera distance when a game starts (the player can pinch to change it). */
  camDist?: number
  sun: { offset: readonly [number, number, number]; intensity: number; half: number; far?: number }
  /** The sun can change with where she is (indoors / outdoors); the change is eased. */
  sunAt?: (x: number, z: number) => { offset: readonly [number, number, number]; intensity: number }
  interaction?: RigInteraction
}

const promptKey = (p: Prompt | null) => (p ? `${p.id}|${p.label}|${p.enabled}|${p.note ?? ''}` : '')

/**
 * The player, her controller and the follow camera in one component, so the order inside a
 * frame is always: read input → (action or move) → place the character → place the camera.
 */
export function PlayerRig({ config }: { config: RigConfig }) {
  const { spawn, groundY, bounds, ceilingY, sun: sunCfg, interaction } = config
  const group = useRef<Group>(null)
  const sun = useRef<DirectionalLight>(null)
  const speed = useRef(0)
  const gesture = useRef<Gesture | null>(null)
  const player = useRef(createPlayer(spawn.x, spawn.z, spawn.heading))
  const cam = useRef(createCam(spawn.heading, config.camDist))
  /** How far the camera is tipped over her own pitch when the space is tight (eased, so it never jumps). */
  const boost = useRef(0)
  const sunNow = useRef({ offset: [...sunCfg.offset] as [number, number, number], intensity: sunCfg.intensity })
  const recenterTo = useRef<number | null>(null)
  const readoutClock = useRef(0)
  const action = useRef<Action | null>(null)
  const shownPrompt = useRef('')
  const shownProgress = useRef(-1)
  const { shadowMapSize } = GRAPHICS_PROFILES[DEFAULT_QUALITY]

  useEffect(() => {
    resetInput()
    useControlStore.getState().setRun(false)
    usePlayerStore.setState({ active: true })
    usePromptStore.setState({ prompt: null, busy: null })
    return () => {
      resetInput()
      usePlayerStore.setState({ active: false })
      usePromptStore.setState({ prompt: null, busy: null })
    }
  }, [])

  useFrame(({ camera }, delta) => {
    const p = player.current
    const c = cam.current
    const dt = Math.min(delta, 0.1)
    const colliders = config.colliders(p.x, p.z)
    const camColliders = config.cameraColliders ? config.cameraColliders(p.x, p.z) : colliders

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

    // ---- interaction: offer a prompt, start an action when asked ----
    const wantsInteract = input.interact
    input.interact = false
    if (interaction && !action.current) {
      const spot = nearestSpot(p.x, p.z, interaction.spots)
      const prompt = spot ? interaction.promptAt(spot) : null
      const key = promptKey(prompt)
      if (key !== shownPrompt.current) {
        shownPrompt.current = key
        usePromptStore.setState({ prompt })
      }
      if (wantsInteract && spot && prompt?.enabled) {
        const a = interaction.actionAt(spot)
        action.current = startAction(spot, a.seconds, a.gesture)
        shownProgress.current = 0
        shownPrompt.current = ''
        usePromptStore.setState({ prompt: null, busy: { label: prompt.label, progress: 0 } })
      }
    }

    // ---- move (or run the action that has taken over the stick) ----
    let sx = 0
    let sy = 0
    let maxSpeed = WALK_SPEED
    let faceTo: number | null = null
    const act = action.current
    if (act) {
      const s = stepAction(act, p, dt, c.yaw)
      sx = s.stick[0]
      sy = s.stick[1]
      faceTo = s.faceTo
      gesture.current = act.phase === 'act' ? act.gesture : null
      const shown = Math.round(s.progress * 20) / 20
      if (shown !== shownProgress.current) {
        shownProgress.current = shown
        const busy = usePromptStore.getState().busy
        if (busy) usePromptStore.setState({ busy: { ...busy, progress: shown } })
      }
      if (s.done) {
        action.current = null
        gesture.current = null
        usePromptStore.setState({ busy: null })
        interaction?.onDone(act.spot)
      }
    } else {
      const stick = readStick()
      sx = stick[0]
      sy = stick[1]
      maxSpeed = useControlStore.getState().run || input.keyRun ? RUN_SPEED : WALK_SPEED
    }
    stepPlayer(p, sx, sy, c.yaw, maxSpeed, delta, colliders, bounds)
    if (faceTo !== null) p.heading = turnToward(p.heading, faceTo, dt)

    // ---- place the character ----
    group.current?.position.set(p.x, groundY, p.z)
    if (group.current) group.current.rotation.y = p.heading
    speed.current = p.speed

    // ---- sun follows the player so shadows stay sharp wherever she walks ----
    const light = sun.current
    if (light) {
      const goal = config.sunAt ? config.sunAt(p.x, p.z) : sunCfg
      const k = 1 - Math.exp(-3 * dt)
      const now = sunNow.current
      for (let i = 0; i < 3; i++) now.offset[i] += (goal.offset[i] - now.offset[i]) * k
      now.intensity += (goal.intensity - now.intensity) * k
      light.intensity = now.intensity
      light.position.set(p.x + now.offset[0], groundY + now.offset[1], p.z + now.offset[2])
      light.target.position.set(p.x, groundY, p.z)
      light.target.updateMatrixWorld()
    }

    // ---- place the camera (spring-arm keeps it out of walls, ceiling and ground) ----
    const pivot: [number, number, number] = [p.x, groundY + CAM.pivotY, p.z]
    const ceiling = typeof ceilingY === 'function' ? ceilingY(p.x, p.z) : ceilingY
    let pitch = c.pitch
    let wantedArm: number
    if (ceiling !== undefined) {
      // tight-space camera: the player's own pitch, raised only as far as needed for a decent arm
      const goal = indoorPitch(pivot, c.yaw, c.pitch, c.dist, camColliders, ceiling) - c.pitch
      boost.current += (goal - boost.current) * (1 - Math.exp(-(goal > boost.current ? 8 : 3) * dt))
      pitch = c.pitch + boost.current
      wantedArm = safeDistance(pivot, c.yaw, pitch, c.dist, camColliders, ceiling, CAM_INDOOR.armMin, CAM_INDOOR.margin)
    } else {
      boost.current = 0
      wantedArm = safeDistance(pivot, c.yaw, pitch, c.dist, camColliders)
    }
    c.arm = easeArm(c.arm, wantedArm, dt)
    const o = cameraOffset(c.yaw, pitch, c.arm)
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
        intensity={sunCfg.intensity}
        color={PALETTE.sun}
        castShadow
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-camera-left={-sunCfg.half}
        shadow-camera-right={sunCfg.half}
        shadow-camera-top={sunCfg.half}
        shadow-camera-bottom={-sunCfg.half}
        shadow-camera-near={1}
        shadow-camera-far={sunCfg.far ?? 40}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
      />
      <group ref={group} position={[spawn.x, groundY, spawn.z]} rotation={[0, spawn.heading, 0]}>
        <PlayerCharacter speed={speed} gesture={gesture} />
      </group>
    </>
  )
}
