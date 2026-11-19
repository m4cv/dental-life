import { useFrame } from '@react-three/fiber'
import { DEFAULT_QUALITY, GRAPHICS_PROFILES } from '@/config/graphics'
import { PALETTE } from '@/config/palette'

type Vec3 = [number, number, number]

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
        <cylinderGeometry args={[0.22, 0.34, 5, 8]} />
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
    <mesh position={[position[0], 0.25, position[2]]} castShadow>
      <boxGeometry args={[0.6, 0.45, 1.8]} />
      <meshStandardMaterial color={PALETTE.blue} roughness={0.6} />
    </mesh>
  )
}

/**
 * Ground, paving, lawns, enclosing buildings, palm and benches. Shared by the Stage 1 test scene
 * and the Stage 2 character showcase so the character is judged in the same light and setting.
 */
export function CourtyardBackdrop() {
  return (
    <>
      {/* ground, paving and lawns */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color={PALETTE.sand} roughness={1} />
      </mesh>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[24, 0.04, 22]} />
        <meshStandardMaterial color={PALETTE.paving} roughness={1} />
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
      <Block position={[0, 0, -14]} size={[36, 12, 6]} />
      <Block position={[-15, 0, 0]} size={[6, 12, 22]} />
      <Block position={[15, 0, 0]} size={[6, 12, 22]} />

      <Palm position={[-1.5, 0, -3]} />
      {[-7, -2.5, 2.5, 7].map((z) => (
        <Bench key={z} position={[11, 0, z]} />
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
