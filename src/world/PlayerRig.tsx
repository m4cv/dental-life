import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { DirectionalLight, Group, PerspectiveCamera } from 'three'
import { CAM, CAM_INDOOR, applyLook, cameraOffset, createCam, easeArm, fovForAspect, indoorPitch, safeDistance } from '@/camera/followCamera'
import { PlayerCharacter } from '@/character/PlayerCharacter'
import { RUN_SPEED, WALK_SPEED, type Gesture } from '@/character/animations/pose'
import { DEFAULT_QUALITY, GRAPHICS_PROFILES } from '@/config/graphics'
import { PALETTE } from '@/config/palette'
import { startAction, stepAction, turnToward, type Action } from '@/controls/interaction'
import { input, readDrive, readStick, resetInput, takeLook } from '@/controls/input'
import { createPlayer, stepPlayer, wrapAngle, type Bounds, type Collider } from '@/controls/movement'
import type { Spot } from '@/home/homeLayout'
import { nearestSpot, type Prompt } from '@/home/routine'
import { useControlStore } from '@/state/useControlStore'
import { useDriveStore } from '@/state/useDriveStore'
import { usePlayerStore } from '@/state/usePlayerStore'
import { usePromptStore } from '@/state/usePromptStore'
import type { CarModel } from '@/vehicle/buildCar'
import { CAR, ENTER_REACH, carColliders, createCar, distanceToCar, exitSpot, stepCar, type CarState } from '@/vehicle/carPhysics'

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

/** A car she can get into (Stage 6): where it stands, what it bumps into, and its 3D model. */
export interface RigVehicle {
  start: { x: number; z: number; heading: number }
  /** True: the game starts with her already sitting in it (?drive=1). */
  startsDriving: boolean
  /** The colliders near the car (a car needs a wider net than a person). */
  colliders: (x: number, z: number) => readonly Collider[]
  model: CarModel
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
  vehicle?: RigVehicle
}

/** The chase camera behind the car: further back and a little higher than behind a person. */
const DRIVE_CAM = { dist: 6.2, pitch: 0.3, pivotY: 1.15 } as const

const promptKey = (p: Prompt | null) => (p ? `${p.id}|${p.label}|${p.enabled}|${p.note ?? ''}` : '')

/**
 * The player, her controller and the follow camera in one component, so the order inside a
 * frame is always: read input → (action or move) → place the character → place the camera.
 * With a car (Stage 6) the same loop also drives it: while she sits in it the car takes the place of
 * the character (movement, camera, light and read-out all follow the car).
 */
export function PlayerRig({ config }: { config: RigConfig }) {
  const { spawn, groundY, bounds, ceilingY, sun: sunCfg, interaction, vehicle } = config
  const group = useRef<Group>(null)
  const sun = useRef<DirectionalLight>(null)
  const speed = useRef(0)
  const gesture = useRef<Gesture | null>(null)
  const player = useRef(createPlayer(spawn.x, spawn.z, spawn.heading))
  const cam = useRef(createCam(spawn.heading, config.camDist))
  /** The car, when there is one: it stands where it was parked until she gets in. */
  const car = useRef<CarState | null>(vehicle ? createCar(vehicle.start.x, vehicle.start.z, vehicle.start.heading) : null)
  const driving = useRef(false)
  /** The camera settings of walking, put back when she gets out. */
  const walkCam = useRef({ dist: 0, pitch: 0 })
  /** Seconds of play so far, and when the camera was last dragged by hand (the chase camera waits after a drag). */
  const clock = useRef(0)
  const lastDrag = useRef(-10)
  const exitNote = useRef(-10)
  /** How far the camera is tipped over her own pitch when the space is tight (eased, so it never jumps). */
  const boost = useRef(0)
  const sunNow = useRef({ offset: [...sunCfg.offset] as [number, number, number], intensity: sunCfg.intensity })
  const recenterTo = useRef<number | null>(null)
  const readoutClock = useRef(0)
  const action = useRef<Action | null>(null)
  const shownPrompt = useRef('')
  const shownProgress = useRef(-1)
  const { shadowMapSize } = GRAPHICS_PROFILES[DEFAULT_QUALITY]

  /** She gets into the car: the character is hidden, the camera moves behind the car. */
  const enterCar = () => {
    const c = cam.current
    const k = car.current
    if (!vehicle || !k) return
    driving.current = true
    useDriveStore.setState({ driving: true, kmh: 0, gear: 'D' })
    walkCam.current = { dist: c.dist, pitch: c.pitch }
    c.dist = DRIVE_CAM.dist
    c.pitch = DRIVE_CAM.pitch
    recenterTo.current = k.heading
    input.gas = false
    input.brake = false
    useControlStore.getState().setRun(false)
    vehicle.model.setDriverVisible(true)
    if (group.current) group.current.visible = false
    shownPrompt.current = ''
    usePromptStore.setState({ prompt: null })
  }

  /** She steps out on the nearest free side; if there is no room anywhere she stays in. */
  const exitCar = (colliders: readonly Collider[]): boolean => {
    const k = car.current
    if (!vehicle || !k) return false
    const spot = exitSpot(k, colliders, bounds)
    if (!spot) return false
    const p = player.current
    p.x = spot.x
    p.z = spot.z
    p.vx = 0
    p.vz = 0
    p.speed = 0
    p.heading = spot.heading
    driving.current = false
    useDriveStore.setState({ driving: false, kmh: 0, gear: 'D' })
    const c = cam.current
    c.dist = walkCam.current.dist || c.dist
    c.pitch = walkCam.current.pitch || c.pitch
    recenterTo.current = p.heading
    input.gas = false
    input.brake = false
    vehicle.model.setDriverVisible(false)
    if (group.current) group.current.visible = true
    shownPrompt.current = ''
    usePromptStore.setState({ prompt: null })
    return true
  }

  useEffect(() => {
    resetInput()
    useControlStore.getState().setRun(false)
    usePlayerStore.setState({ active: true })
    usePromptStore.setState({ prompt: null, busy: null })
    useDriveStore.setState({ driving: false, kmh: 0, gear: 'D' })
    if (vehicle && car.current) {
      vehicle.model.place(car.current, 0)
      if (vehicle.startsDriving) enterCar()
    }
    return () => {
      resetInput()
      usePlayerStore.setState({ active: false })
      usePromptStore.setState({ prompt: null, busy: null })
      useDriveStore.setState({ driving: false, kmh: 0, gear: 'D' })
    }
  }, [])

  useFrame(({ camera }, delta) => {
    const p = player.current
    const c = cam.current
    const k = car.current
    const dt = Math.min(delta, 0.1)
    const isDriving = driving.current && !!k && !!vehicle
    clock.current += dt
    const footColliders = config.colliders(p.x, p.z)
    const camX = isDriving && k ? k.x : p.x
    const camZ = isDriving && k ? k.z : p.z
    const camColliders = config.cameraColliders ? config.cameraColliders(camX, camZ) : isDriving && vehicle && k ? vehicle.colliders(k.x, k.z) : footColliders

    // ---- camera input: drag / pinch / wheel, and the recenter button ----
    const look = takeLook()
    if (look.dx !== 0 || look.dy !== 0 || look.zoom !== 0) {
      applyLook(c, look.dx, look.dy, look.zoom)
      if (look.dx !== 0) recenterTo.current = null
      if (look.dx !== 0 || look.dy !== 0) lastDrag.current = clock.current
    }
    if (input.recenter) {
      input.recenter = false
      recenterTo.current = isDriving && k ? k.heading : p.heading
    }
    if (recenterTo.current !== null) {
      const diff = wrapAngle(recenterTo.current - c.yaw)
      c.yaw = wrapAngle(c.yaw + diff * (1 - Math.exp(-8 * dt)))
      if (Math.abs(diff) < 0.01) recenterTo.current = null
    }

    const wantsInteract = input.interact
    input.interact = false

    if (isDriving && k && vehicle) {
      // ================= in the car =================
      const drive = readDrive()
      const near = vehicle.colliders(k.x, k.z)
      stepCar(k, drive, delta, near, bounds)
      vehicle.model.place(k, dt)

      // Get out: only when (nearly) stopped
      const canExit = Math.abs(k.speed) < CAR.exitSpeed
      const noRoom = clock.current - exitNote.current < 2
      const prompt: Prompt = { id: 'car', label: 'Get out', enabled: canExit, note: !canExit ? 'Stop the car first' : noRoom ? 'No room to get out here' : undefined }
      const key = promptKey(prompt)
      if (key !== shownPrompt.current) {
        shownPrompt.current = key
        usePromptStore.setState({ prompt })
      }
      if (wantsInteract && canExit) {
        if (!exitCar(near)) exitNote.current = clock.current
      }

      // the chase camera swings in behind the car as it moves, unless she has just dragged it by hand
      if (driving.current && recenterTo.current === null && clock.current - lastDrag.current > 1.8 && Math.abs(k.speed) > 0.5) {
        const rate = 1.2 + Math.min(Math.abs(k.speed), CAR.maxSpeed) * 0.25
        c.yaw = wrapAngle(c.yaw + wrapAngle(k.heading - c.yaw) * (1 - Math.exp(-rate * dt)))
      }
      speed.current = 0
    } else {
      // ================= on foot =================
      // ---- interaction: offer a prompt, start an action when asked ----
      if ((interaction || vehicle) && !action.current) {
        const spot = interaction ? nearestSpot(p.x, p.z, interaction.spots) : null
        let prompt = spot && interaction ? interaction.promptAt(spot) : null
        let carPrompt = false
        if (!prompt && vehicle && k && distanceToCar(p.x, p.z, k) <= ENTER_REACH) {
          prompt = { id: 'car', label: 'Get in car', enabled: true }
          carPrompt = true
        }
        const key = promptKey(prompt)
        if (key !== shownPrompt.current) {
          shownPrompt.current = key
          usePromptStore.setState({ prompt })
        }
        if (wantsInteract && prompt?.enabled) {
          if (carPrompt) {
            enterCar()
          } else if (spot && interaction) {
            const a = interaction.actionAt(spot)
            action.current = startAction(spot, a.seconds, a.gesture)
            shownProgress.current = 0
            shownPrompt.current = ''
            usePromptStore.setState({ prompt: null, busy: { label: prompt.label, progress: 0 } })
          }
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
      // the parked car is in the way (a car she is not sitting in is an obstacle)
      const walkColliders = vehicle && k ? [...footColliders, ...carColliders(k)] : footColliders
      stepPlayer(p, sx, sy, c.yaw, maxSpeed, delta, walkColliders, bounds)
      if (faceTo !== null) p.heading = turnToward(p.heading, faceTo, dt)

      // ---- place the character ----
      group.current?.position.set(p.x, groundY, p.z)
      if (group.current) group.current.rotation.y = p.heading
      speed.current = p.speed
      if (vehicle && k) vehicle.model.place(k, dt)
    }

    // ---- sun follows what she is in or on, so shadows stay sharp wherever she goes ----
    const light = sun.current
    if (light) {
      const goal = config.sunAt ? config.sunAt(camX, camZ) : sunCfg
      const kk = 1 - Math.exp(-3 * dt)
      const now = sunNow.current
      for (let i = 0; i < 3; i++) now.offset[i] += (goal.offset[i] - now.offset[i]) * kk
      now.intensity += (goal.intensity - now.intensity) * kk
      light.intensity = now.intensity
      light.position.set(camX + now.offset[0], groundY + now.offset[1], camZ + now.offset[2])
      light.target.position.set(camX, groundY, camZ)
      light.target.updateMatrixWorld()
    }

    // ---- place the camera (spring-arm keeps it out of walls, ceiling and ground) ----
    const fx = isDriving && k ? k.x : p.x
    const fz = isDriving && k ? k.z : p.z
    const pivot: [number, number, number] = [fx, groundY + (isDriving ? DRIVE_CAM.pivotY : CAM.pivotY), fz]
    const ceiling = typeof ceilingY === 'function' ? ceilingY(fx, fz) : ceilingY
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
    // a little wider at speed: the road rushes past
    const fov = fovForAspect(lens.aspect) + (isDriving && k ? (Math.min(Math.abs(k.speed), CAR.maxSpeed) / CAR.maxSpeed) * 6 : 0)
    if (Math.abs(lens.fov - fov) > 0.01) {
      lens.fov = fov
      lens.updateProjectionMatrix()
    }

    // ---- low-rate read-out for the diagnostics panel, the speedometer and the CI tests ----
    readoutClock.current += delta
    if (readoutClock.current >= 0.25) {
      readoutClock.current = 0
      const deg = Math.round(((c.yaw * 180) / Math.PI + 360) % 360)
      if (isDriving && k) {
        usePlayerStore.setState({ x: k.x, z: k.z, speed: Math.abs(k.speed), camDeg: deg, camDist: c.dist })
        useDriveStore.setState({ kmh: Math.round(Math.abs(k.speed) * 3.6), gear: k.speed < -0.1 ? 'R' : 'D' })
      } else {
        usePlayerStore.setState({ x: p.x, z: p.z, speed: p.speed, camDeg: deg, camDist: c.dist })
      }
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
