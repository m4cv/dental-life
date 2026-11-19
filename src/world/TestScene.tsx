import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import { DEFAULT_QUALITY, GRAPHICS_PROFILES } from '@/config/graphics'
import { PALETTE } from '@/config/palette'
import { BENCH_SIZE, BENCH_X, BENCH_Z, BUILDINGS, PALM } from './courtyardLayout'

type Vec3 = [number, number, number]

/** Paving with a faint 2 m tile grid, so walking across it is visible. */
function usePavingTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const ctx = c.getContext('2d')
    if (ctx) {
      ctx.fillStyle = PALETTE.paving
      ctx.fillRect(0, 0, 128, 128)
      ctx.strokeStyle = 'rgba(120,84,76,0.35)'
      ctx.lineWidth = 4
      ctx.strokeRect(0, 0, 128, 128)
      ctx.strokeStyle = 'rgba(120,84,76,0.12)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(64, 0)
      ctx.lineTo(64, 128)
      ctx.moveTo(0, 64)
      ctx.lineTo(128, 64)
      ctx.stroke()
    }
    const t = new CanvasTexture(c)
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(12, 11)
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 4
    return t
  }, [])
}

/** Beige block with a blue trim band — echoes the campus facade in the reference photos. */
function Block({ position, size }: { position: Vec3; size: Vec3 }) {
  const [w, h, d] = size
  return (
    <group position={position}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={PALETTE.limestone} roughness={0.95} />
      </mesh>
      <mesh position={[0, h - 0.6, 0]}>
        <boxGeometry args={[w + 0.1, 0.5, d + 0.1]} />
        <meshStandardMaterial color={PALETTE.blue} roughness={0.7} />
      </mesh>
    </group>
  )
}

function Palm({ position }: { position: Vec3 }) {
  return (
    <group position={position}>
      <mesh position={[0, 2.5, 0]} castShadow>
        <cylinderGeometry args={[0.22, PALM.trunkRadius, PALM.height, 8]} />
        <meshStandardMaterial color={PALETTE.trunk} roughness={1} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <group key={i} position={[0, 5, 0]} rotation={[0, (i / 9) * Math.PI * 2, 0]}>
          <mesh position={[0, 0, 1.5]} rotation={[0.45, 0, 0]} castShadow>
            <boxGeometry args={[0.9, 0.05, 3.2]} />
            <meshStandardMaterial color={PALETTE.frond} roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Bench({ position }: { position: Vec3 }) {
  return (
    <mesh position={[position[0], BENCH_SIZE[1] / 2 + 0.025, position[2]]} castShadow>
      <boxGeometry args={BENCH_SIZE} />
      <meshStandardMaterial color={PALETTE.blue} roughness={0.6} />
    </mesh>
  )
}

/**
 * Ground, paving, lawns, enclosing buildings, palm and benches. Shared by the Stage 1 test scene
 * and the Stage 2 character showcase so the character is judged in the same light and setting.
 */
export function CourtyardBackdrop() {
  const paving = usePavingTexture()
  return (
    <>
      {/* ground, paving and lawns */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color={PALETTE.sand} roughness={1} />
      </mesh>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[24, 0.04, 22]} />
        <meshStandardMaterial map={paving} roughness={1} />
      </mesh>
      <mesh position={[-6, 0.06, 4]} receiveShadow>
        <boxGeometry args={[9, 0.06, 8]} />
        <meshStandardMaterial color={PALETTE.lawn} roughness={1} />
      </mesh>
      <mesh position={[6, 0.06, 4]} receiveShadow>
        <boxGeometry args={[9, 0.06, 8]} />
        <meshStandardMaterial color={PALETTE.lawn} roughness={1} />
      </mesh>

      {/* enclosing buildings (open to the south, like a courtyard) */}
      {BUILDINGS.map((b, i) => (
        <Block key={i} position={b.position} size={b.size} />
      ))}

      <Palm position={PALM.position} />
      {BENCH_Z.map((z) => (
        <Bench key={z} position={[BENCH_X, 0, z]} />
      ))}
    </>
  )
}

/** Slowly circles the scene so the 3D depth, lighting and shadows are visible without input. */
function OrbitDemoCamera() {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime * 0.12
    camera.position.set(Math.sin(t) * 34, 12, Math.cos(t) * 34)
    camera.lookAt(0, 3, 0)
  })
  return null
}

/**
 * Stage 1 proof-of-render scene: a tiny stand-in for the university courtyard
 * (see reference/photos/university). It exists only to prove that the renderer, lighting,
 * shadows, fog and animation loop work on a phone. It is replaced in later stages.
 */
export function TestScene() {
  const { shadowMapSize } = GRAPHICS_PROFILES[DEFAULT_QUALITY]

  return (
    <>
      <color attach="background" args={[PALETTE.sky]} />
      <fog attach="fog" args={[PALETTE.haze, 45, 150]} />

      <hemisphereLight args={[PALETTE.skyLight, PALETTE.sand, 1]} />
      <directionalLight
        position={[22, 30, 16]}
        intensity={2.4}
        color={PALETTE.sun}
        castShadow
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-camera-left={-32}
        shadow-camera-right={32}
        shadow-camera-top={32}
        shadow-camera-bottom={-32}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-bias={-0.0004}
      />

      <CourtyardBackdrop />

      <OrbitDemoCamera />
    </>
  )
}
