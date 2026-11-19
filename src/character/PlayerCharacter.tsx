import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, Material, Mesh } from 'three'
import { getCharacterAssets } from './assets'
import { COAT_HEM_Y, COAT_SPLIT_Y, EYE, HEAD, coatFrontZ, coatRing, skinZ } from './charShapes'
import { RIG, SKIRT_FLARE_MAX, advancePhase, createPose, solvePose } from './animations/pose'

type V3 = [number, number, number]

/** Flattened sphere helper: every soft body part in the character is an ellipsoid. */
function Ell({
  mat,
  p = [0, 0, 0],
  s,
  r,
  shadow = true,
  hi = false,
}: {
  mat: Material
  p?: V3
  s: V3
  r?: V3
  shadow?: boolean
  /** Use the finer sphere (only the head, which is seen up close). */
  hi?: boolean
}) {
  const { geo } = getCharacterAssets()
  return (
    <mesh geometry={hi ? geo.unitSphere : geo.unitSphereLo} material={mat} position={p} scale={s} rotation={r} castShadow={shadow} />
  )
}

/** Five-petal fabric flower (hijab accessory and the small pin on the coat). Faces +z. */
function Flower({ position, yaw, scale = 1 }: { position: V3; yaw: number; scale?: number }) {
  const { mat } = getCharacterAssets()
  return (
    <group position={position} rotation={[0, yaw, 0]} scale={scale}>
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2 + 0.3
        return (
          <Ell
            key={i}
            mat={i % 2 === 0 ? mat.petalA : mat.petalB}
            p={[Math.cos(a) * 0.0105, Math.sin(a) * 0.0105, 0.002 * (i % 2)]}
            s={[0.0165, 0.0105, 0.0048]}
            r={[0.25, 0, a]}
          />
        )
      })}
      <Ell mat={mat.petalCore} p={[0, 0, 0.004]} s={[0.0062, 0.0062, 0.005]} />
    </group>
  )
}

function Eye({ side, lidRef }: { side: 1 | -1; lidRef: RefObject<Group | null> }) {
  const { geo, mat } = getCharacterAssets()
  const { x, y, a, b, c } = EYE
  const lidTop = b + 0.0006
  return (
    <group position={[side * x, y, skinZ(x, y) - 0.002]} rotation={[0, side * 0.12, side * EYE.tilt]}>
      <Ell mat={mat.sclera} s={[a, b, c]} shadow={false} />
      <mesh geometry={geo.irisCap} material={mat.iris} />
      <Ell mat={mat.glint} p={[0.003, 0.0033, c * 1.1]} s={[0.0017, 0.0017, 0.001]} shadow={false} />
      <Ell mat={mat.glint} p={[-0.0028, -0.0029, c * 1.06]} s={[0.0008, 0.0008, 0.0006]} shadow={false} />
      <group ref={lidRef} position={[0, lidTop, 0.0016]} scale={[1, 0.001, 1]}>
        <Ell mat={mat.skin} p={[0, -lidTop, 0]} s={[a + 0.0012, b + 0.001, 0.0068]} shadow={false} />
      </group>
    </group>
  )
}

function Head({ lidL, lidR }: { lidL: RefObject<Group | null>; lidR: RefObject<Group | null> }) {
  const { geo, mat } = getCharacterAssets()
  const s = HEAD.skin

  // Flower on the hijab beside the character's right temple, tilted to follow the shell.
  const fx = -0.087
  const fy = 0.014
  const fz = HEAD.shell.rz * Math.sqrt(1 - (fx / HEAD.shell.rx) ** 2 - (fy / HEAD.shell.ry) ** 2)
  const fyaw = Math.atan2(fx / HEAD.shell.rx ** 2, fz / HEAD.shell.rz ** 2)

  return (
    <>
      <Ell mat={mat.skin} s={[s.rx, s.ry, s.rz]} hi />
      {/* painted detail: blush, eyeshadow, brows, lips */}
      <mesh geometry={geo.facePatch} material={mat.faceArt} renderOrder={2} />
      {/* nose: a low soft bridge blending into a small rounded tip, with wings and nostrils */}
      <Ell mat={mat.skin} p={[0, -0.0115, skinZ(0, -0.0115) - 0.0003]} s={[0.0032, 0.0125, 0.002]} shadow={false} />
      <Ell mat={mat.skin} p={[0, -0.0238, skinZ(0, -0.0238) + 0.002]} s={[0.007, 0.006, 0.0066]} shadow={false} />
      {[1, -1].map((k) => (
        <group key={k}>
          <Ell mat={mat.skin} p={[k * 0.0066, -0.0252, skinZ(0.0066, -0.0252) + 0.0004]} s={[0.0042, 0.0038, 0.004]} shadow={false} />
          <Ell mat={mat.nostril} p={[k * 0.0038, -0.0292, skinZ(0.0038, -0.0292) + 0.0024]} s={[0.0016, 0.001, 0.0013]} shadow={false} />
        </group>
      ))}
      <Eye side={1} lidRef={lidL} />
      <Eye side={-1} lidRef={lidR} />
      {geo.lash.map((g, i) => <mesh key={`l${i}`} geometry={g} material={mat.brow} />)}

      {/* hijab: shell with the face window, soft rim, forehead fold, flower */}
      <mesh geometry={geo.hijabShell} material={mat.hijab} castShadow receiveShadow />
      <mesh geometry={geo.hijabRim} material={mat.hijabFold} castShadow />
      <mesh geometry={geo.hijabFold} material={mat.hijabFold} castShadow />
      <Flower position={[fx - 0.006, fy, fz + 0.0034]} yaw={fyaw} />
    </>
  )
}

function Arm({
  side,
  shoulderRef,
  elbowRef,
}: {
  side: 1 | -1
  shoulderRef: RefObject<Group | null>
  elbowRef: RefObject<Group | null>
}) {
  const { geo, mat } = getCharacterAssets()
  return (
    <group ref={shoulderRef} position={[side * RIG.shoulderX, RIG.shoulderY, 0]}>
      <mesh geometry={geo.upperArm} material={mat.coat} position={[0, -0.14, 0]} castShadow receiveShadow />
      <group ref={elbowRef} position={[0, -RIG.upperArm, 0]}>
        <mesh geometry={geo.foreArm} material={mat.coat} position={[0, -0.125, 0]} castShadow receiveShadow />
        <mesh geometry={geo.cuff} material={mat.coat} position={[0, -0.225, 0]} castShadow />
        <group position={[0, -RIG.foreArm, 0]}>
          {/* wrist, palm, fingers, thumb */}
          <mesh position={[0, -0.012, 0]} material={mat.skin}>
            <cylinderGeometry args={[0.024, 0.024, 0.06, 12]} />
          </mesh>
          <Ell mat={mat.skin} p={[0, -0.06, 0]} s={[0.03, 0.046, 0.015]} />
          <Ell mat={mat.skin} p={[0, -0.118, 0.003]} s={[0.027, 0.037, 0.012]} />
          <Ell mat={mat.skin} p={[-side * 0.027, -0.07, 0.012]} s={[0.0105, 0.026, 0.0105]} r={[0, 0, side * 0.25]} />
          {side === -1 && (
            <group position={[0, -0.015, 0]}>
              <mesh geometry={geo.watchBand} material={mat.gold} rotation={[Math.PI / 2, 0, 0]} />
              <mesh geometry={geo.watchFace} material={mat.gold} position={[-0.034, 0, 0]} rotation={[0, 0, Math.PI / 2]} />
            </group>
          )}
        </group>
      </group>
    </group>
  )
}

function Leg({
  side,
  thighRef,
  kneeRef,
  footRef,
}: {
  side: 1 | -1
  thighRef: RefObject<Group | null>
  kneeRef: RefObject<Group | null>
  footRef: RefObject<Group | null>
}) {
  const { geo, mat } = getCharacterAssets()
  return (
    <group ref={thighRef} position={[side * RIG.hipX, 0, 0]}>
      <mesh geometry={geo.thigh} material={mat.trousers} position={[0, -0.2, 0]} castShadow />
      <Ell mat={mat.trousers} p={[0, -RIG.thigh, 0]} s={[0.062, 0.062, 0.062]} />
      <group ref={kneeRef} position={[0, -RIG.thigh, 0]}>
        <mesh geometry={geo.shin} material={mat.trousers} position={[0, -0.185, 0]} castShadow />
        <group ref={footRef} position={[0, -RIG.shin, 0]}>
          <Ell mat={mat.shoe} p={[0, -0.04, 0.045]} s={[0.046, 0.04, 0.118]} />
          <mesh geometry={geo.sole} material={mat.sole} position={[0, -0.072, 0.045]} castShadow />
        </group>
      </group>
    </group>
  )
}

export interface PlayerCharacterProps {
  /** Target ground speed in m/s: 0 = idle, ~1.45 = walk, ~3.6 = run. Blended smoothly. */
  speed: number
  position?: V3
  /** Heading in radians about +y (0 faces +z). */
  rotationY?: number
}

/**
 * The player: a dental student in a white lab coat, dusty-rose hijab and blush-pink crossbody bag.
 * Built from primitives and posed every frame by animations/pose.ts (no skinned mesh, no model file),
 * so there is nothing to download and the look can be tuned from code.
 */
export function PlayerCharacter({ speed, position = [0, 0, 0], rotationY = 0 }: PlayerCharacterProps) {
  const { geo, mat } = getCharacterAssets()

  const bodyRef = useRef<Group>(null)
  const hipsRef = useRef<Group>(null)
  const torsoRef = useRef<Group>(null)
  const headRef = useRef<Group>(null)
  const skirtRef = useRef<Group>(null)
  const bagRef = useRef<Group>(null)
  const thighL = useRef<Group>(null)
  const kneeL = useRef<Group>(null)
  const footL = useRef<Group>(null)
  const thighR = useRef<Group>(null)
  const kneeR = useRef<Group>(null)
  const footR = useRef<Group>(null)
  const shoulderL = useRef<Group>(null)
  const elbowL = useRef<Group>(null)
  const shoulderR = useRef<Group>(null)
  const elbowR = useRef<Group>(null)
  const lidL = useRef<Group>(null)
  const lidR = useRef<Group>(null)
  const skirtMesh = useRef<Mesh | null>(null)
  const placketMesh = useRef<Mesh | null>(null)
  const lowerButtonRefs = useRef<(Mesh | null)[]>([])

  const state = useRef({ speed: 0, phase: 0, time: 0 })
  const pose = useMemo(() => createPose(), [])

  const upperButtons = [1.165, 1.045]
  const lowerButtonInfo = useMemo(
    () =>
      [0.925, 0.805, 0.685].map((y) => {
        const t = Math.min(Math.max((COAT_SPLIT_Y - y) / (COAT_SPLIT_Y - COAT_HEM_Y), 0), 1)
        return { y, cz: coatRing(y).cz, z: coatFrontZ(0, y) + 0.0075, w: t * t * (3 - 2 * t) }
      }),
    [],
  )

  // Surface yaw for the little flower pin on the coat.
  const pin = useMemo(() => {
    const x = -0.142
    const y = 1.098
    const r = coatRing(y)
    const z = coatFrontZ(x, y)
    return { x, y, z, yaw: Math.atan2(x / (r.rx * r.rx), (z - r.cz) / (r.rz * r.rz)) }
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const st = state.current
    st.speed += (speed - st.speed) * (1 - Math.exp(-6 * dt))
    if (Math.abs(speed - st.speed) < 0.005) st.speed = speed
    st.phase = advancePhase(st.phase, st.speed, dt)
    st.time += dt
    solvePose(pose, st.speed, st.phase, st.time)

    bodyRef.current?.position.set(pose.bodyX, pose.bodyY, 0)
    hipsRef.current?.rotation.set(0, pose.hipsYaw, 0)
    torsoRef.current?.rotation.set(pose.torsoPitch, pose.torsoYaw, pose.torsoRoll)
    headRef.current?.rotation.set(pose.headPitch, pose.headYaw, pose.headRoll)
    skirtRef.current?.rotation.set(-pose.skirtPitch, 0, pose.skirtRoll)

    // Hem flare is a morph target (see assets.ts); the lower buttons follow the same mapping.
    const flare = (pose.skirtFlare - 1) / SKIRT_FLARE_MAX
    for (const mesh of [skirtMesh.current, placketMesh.current]) {
      if (mesh?.morphTargetInfluences) mesh.morphTargetInfluences[0] = flare
    }
    lowerButtonRefs.current.forEach((button, i) => {
      const b = lowerButtonInfo[i]
      if (button && b) button.position.z = b.cz + (b.z - b.cz) * (1 + SKIRT_FLARE_MAX * flare * b.w)
    })
    bagRef.current?.rotation.set(pose.bagPitch, 0, pose.bagRoll)

    // Hanging segments swing "forward" with a negative x rotation.
    thighL.current?.rotation.set(-pose.legL.thigh, 0, 0)
    kneeL.current?.rotation.set(pose.legL.knee, 0, 0)
    footL.current?.rotation.set(pose.legL.foot, 0, 0)
    thighR.current?.rotation.set(-pose.legR.thigh, 0, 0)
    kneeR.current?.rotation.set(pose.legR.knee, 0, 0)
    footR.current?.rotation.set(pose.legR.foot, 0, 0)

    shoulderL.current?.rotation.set(-pose.armL.pitch, 0, pose.armL.abduct)
    elbowL.current?.rotation.set(-pose.armL.elbow, 0, 0)
    shoulderR.current?.rotation.set(-pose.armR.pitch, 0, -pose.armR.abduct)
    elbowR.current?.rotation.set(-pose.armR.elbow, 0, 0)

    // The upper lid always rests over the top of the eye a little (a relaxed, natural look).
    const lid = Math.max(pose.blink, 0.13)
    lidL.current?.scale.set(1, lid, 1)
    lidR.current?.scale.set(1, lid, 1)
  })


  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <group ref={bodyRef}>
        {/* ---------------- hips: legs, coat hem, handbag ---------------- */}
        <group ref={hipsRef} position={[0, RIG.hipY, 0]}>
          <Leg side={1} thighRef={thighL} kneeRef={kneeL} footRef={footL} />
          <Leg side={-1} thighRef={thighR} kneeRef={kneeR} footRef={footR} />

          <group ref={skirtRef}>
            <group position={[0, -RIG.hipY, 0]}>
              <mesh
                ref={(m) => {
                  skirtMesh.current = m
                  m?.updateMorphTargets()
                }}
                geometry={geo.coatSkirt}
                material={mat.coat}
                castShadow
              />
              <mesh
                ref={(m) => {
                  placketMesh.current = m
                  m?.updateMorphTargets()
                }}
                geometry={geo.placketLow}
                material={mat.coatEdge}
              />
              {lowerButtonInfo.map((b, i) => (
                <mesh
                  key={b.y}
                  ref={(m) => {
                    lowerButtonRefs.current[i] = m
                  }}
                  geometry={geo.button}
                  material={mat.button}
                  position={[0, b.y, b.z]}
                  castShadow
                />
              ))}
            </group>
          </group>

          <group ref={bagRef} position={[-0.15, 0.905 - RIG.hipY, 0.112]}>
            <mesh geometry={geo.ring} material={mat.metal} rotation={[0, 0.6, 0]} />
            <group position={[0, -0.085, 0.025]} rotation={[0, -0.6, 0]}>
              <mesh geometry={geo.bag} material={mat.bagBody} castShadow />
              <mesh geometry={geo.bagBand} material={mat.bagTrim} position={[0, 0.056, 0]} castShadow />
              {[0.024, -0.024].map((z) => (
                <mesh key={z} geometry={geo.bagHandle} material={mat.bagTrim} position={[0, 0.07, z]} castShadow />
              ))}
            </group>
          </group>
        </group>

        {/* ---------------- torso: coat, hijab drape, arms, head ---------------- */}
        <group ref={torsoRef} position={[0, RIG.waistY, 0]}>
          <group position={[0, -RIG.waistY, 0]}>
            <mesh geometry={geo.coatTorso} material={mat.coat} castShadow />
            <mesh geometry={geo.placketUp} material={mat.coatEdge} />
            <mesh geometry={geo.vNeck} material={mat.innerTop} />
            <mesh geometry={geo.lapelL} material={mat.lapel} />
            <mesh geometry={geo.lapelR} material={mat.lapel} />
            <mesh geometry={geo.pocketEdge} material={mat.coatEdge} />
            <mesh geometry={geo.pocket} material={mat.coat} />
            <mesh geometry={geo.pinBlack} material={mat.pin} />
            <mesh geometry={geo.badge} material={mat.badge} />
            <Flower position={[pin.x, pin.y, pin.z + 0.011]} yaw={pin.yaw} scale={0.55} />
            {upperButtons.map((y) => (
              <mesh key={y} geometry={geo.button} material={mat.button} position={[0, y, coatFrontZ(0, y) + 0.0075]} castShadow />
            ))}
            <mesh geometry={geo.strap} material={mat.strap} />
            <mesh geometry={geo.neck} material={mat.skin} position={[0, 1.4, 0.004]} />
            <mesh geometry={geo.hijabDrape} material={mat.hijab} castShadow receiveShadow />

            <Arm side={1} shoulderRef={shoulderL} elbowRef={elbowL} />
            <Arm side={-1} shoulderRef={shoulderR} elbowRef={elbowR} />

            <group ref={headRef} position={[0, RIG.neckY, 0]}>
              <group position={[0, RIG.headCenterY - RIG.neckY, HEAD.centerZ]}>
                <Head lidL={lidL} lidR={lidR} />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}
