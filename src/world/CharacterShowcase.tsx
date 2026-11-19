import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { PlayerCharacter } from '@/character/PlayerCharacter'
import { RUN_SPEED, WALK_SPEED } from '@/character/animations/pose'
import { DEFAULT_QUALITY, GRAPHICS_PROFILES } from '@/config/graphics'
import { PALETTE } from '@/config/palette'
import { usePreviewStore, type PreviewAnim, type PreviewView } from '@/state/usePreviewStore'
import { CourtyardBackdrop } from './TestScene'

const ANIM_SPEED: Record<PreviewAnim, number> = { idle: 0, walk: WALK_SPEED, run: RUN_SPEED }

/** The courtyard paving is 4 cm thick, so the character stands on top of it. */
const GROUND_Y = 0.04

interface Shot {
  azimuth: number
  radius: number
  height: number
  lookY: number
}

/** Camera placements around the character (azimuth 0 = in front of her, π/2 = her left). */
const SHOTS: Record<Exclude<PreviewView, 'orbit'>, Shot> = {
  front: { azimuth: 0, radius: 2.7, height: 1.05, lookY: 0.68 },
  side: { azimuth: Math.PI / 2, radius: 2.7, height: 1.05, lookY: 0.68 },
  back: { azimuth: Math.PI, radius: 2.7, height: 1.05, lookY: 0.68 },
  face: { azimuth: 0.3, radius: 0.9, height: 1.58, lookY: 1.54 },
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

/** Glides between shots without ever cutting through the character, or slowly orbits her. */
function ShowcaseCamera() {
  const view = usePreviewStore((s) => s.view)
  const cam = useRef({ azimuth: 0.6, radius: 2.7, height: 1.05, lookY: 0.68 })

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.1)
    const c = cam.current
    const k = 1 - Math.exp(-5 * dt)
    if (view === 'orbit') {
      c.azimuth = wrap(c.azimuth + dt * 0.35)
      c.radius += (2.7 - c.radius) * k
      c.height += (1.05 - c.height) * k
      c.lookY += (0.68 - c.lookY) * k
    } else {
      const shot = SHOTS[view]
      c.azimuth = wrap(c.azimuth + wrap(shot.azimuth - c.azimuth) * k)
      c.radius += (shot.radius - c.radius) * k
      c.height += (shot.height - c.height) * k
      c.lookY += (shot.lookY - c.lookY) * k
    }
    camera.position.set(Math.sin(c.azimuth) * c.radius, GROUND_Y + c.height, Math.cos(c.azimuth) * c.radius)
    camera.lookAt(0, GROUND_Y + c.lookY, 0)
  })

  return null
}

/**
 * Stage 2 scene: the main character standing in the courtyard test set, with lighting and
 * shadows tuned for a person-sized subject. Idle / walk / run play in place.
 */
export function CharacterShowcase() {
  const anim = usePreviewStore((s) => s.anim)
  const { shadowMapSize } = GRAPHICS_PROFILES[DEFAULT_QUALITY]

  return (
    <>
      <color attach="background" args={[PALETTE.sky]} />
      <fog attach="fog" args={[PALETTE.haze, 30, 120]} />

      <hemisphereLight args={[PALETTE.skyLight, PALETTE.sand, 1.05]} />
      <directionalLight
        position={[3.5, 6, 4.5]}
        intensity={2.5}
        color={PALETTE.sun}
        castShadow
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-camera-near={1}
        shadow-camera-far={16}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
      />

      <CourtyardBackdrop />
      <PlayerCharacter speed={ANIM_SPEED[anim]} position={[0, GROUND_Y, 0]} />
      <ShowcaseCamera />
    </>
  )
}
