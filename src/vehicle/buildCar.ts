// The 3D car (Stage 6): a small five-door hatchback built from code, in the spirit of the two reference
// photographs (a tall, short-nosed city car in light blue with silver wheels). It is NOT a copy of either
// car and carries no badge: the body is one extruded side silhouette with rounded edges, the windows are
// painted dark panels, and the rest is boxes and cylinders. Everything static is merged into a handful of
// meshes (one per material); only the wheels, the lights and a seated driver move.
//
// Local axes: the car faces +z (so `rotation.y = heading` is right), up is +y, and the driver's side
// (the left) is +x. The origin is on the ground halfway between the axles.
import {
  BoxGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  type BufferGeometry,
} from 'three'
import { Batch, disposeGroup, type V3 } from '../home/sceneBuilder.ts'
import { CAR, type CarState } from './carPhysics.ts'

export interface CarModel {
  group: Group
  /** Moves the car to `car` and animates the wheels, the lean and the lights. `dt` is the frame time. */
  place: (car: CarState, dt: number) => void
  /** Shows the figure at the wheel (while she drives). */
  setDriverVisible: (visible: boolean) => void
  dispose: () => void
}

/** The paint: a light blue between the two reference cars (the older one sky blue, the newer one periwinkle). */
export const CAR_PAINT = '#7fa8e8'

const HALF = CAR.length / 2
const WHEEL_X = CAR.track / 2
const AXLE_Z = CAR.wheelbase / 2
const ARCH_R = 0.46
const ARCH_V = 0.3
const BODY_BOTTOM = 0.26
const BEVEL = 0.07

/** The side silhouette of the body as (forward, up) points, clockwise from the rear bottom, with the two wheel arches cut out. */
function bodyShape(): Shape {
  const u = HALF - BEVEL // the bevel adds BEVEL on every side
  const pts: Array<[number, number]> = [
    [-u, 0.3],
    [-u - 0.02, 0.62],
    [-u, 0.98], // tail: the hatch is nearly upright at the bottom…
    [-1.3, 1.42], // …and slopes forward up to the roof
    [-0.2, 1.43],
    [0.28, 1.43], // roof
    [0.88, 1.0], // windscreen
    [1.45, 0.9], // bonnet
    [u, 0.78],
    [u + 0.03, 0.56],
    [u - 0.04, 0.3],
  ]
  const shape = new Shape()
  shape.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1])
  // along the bottom from the front to the rear, over the two arches
  const arch = (uc: number) => {
    const end = Math.asin((BODY_BOTTOM - ARCH_V) / ARCH_R) // negative: the arch ends are a little below its centre
    const a0 = end
    const a1 = Math.PI - end
    shape.lineTo(uc + ARCH_R * Math.cos(a0), BODY_BOTTOM)
    const steps = 14
    for (let i = 1; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps
      shape.lineTo(uc + ARCH_R * Math.cos(a), ARCH_V + ARCH_R * Math.sin(a))
    }
  }
  arch(AXLE_Z)
  arch(-AXLE_Z)
  shape.lineTo(-u + 0.04, BODY_BOTTOM)
  shape.closePath()
  return shape
}

/** The shell: the silhouette extruded across the width, edges rounded, turned so that it faces +z. */
function bodyGeometry(): BufferGeometry {
  const depth = CAR.width - 2 * 0.1
  const g = new ExtrudeGeometry(bodyShape(), { depth, bevelEnabled: true, bevelThickness: 0.1, bevelSize: BEVEL, bevelSegments: 3, curveSegments: 1, steps: 1 })
  g.translate(0, 0, -depth / 2)
  g.rotateY(-Math.PI / 2)
  return g
}

/** A flat window panel from a polygon of (forward, up) points, standing on a side of the car (facing -x). */
function windowPanel(points: Array<[number, number]>): BufferGeometry {
  const s = new Shape()
  s.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1])
  s.closePath()
  const g = new ShapeGeometry(s)
  g.rotateY(-Math.PI / 2)
  return g
}

/** A thin slab lying along the line from `lower` to `upper` (forward, up), pushed out of the body by `out`. */
function slab(width: number, lower: [number, number], upper: [number, number], thickness: number, out: number, outward: [number, number]): { geo: BufferGeometry; pos: V3; rot: V3 } {
  const du = upper[0] - lower[0]
  const dv = upper[1] - lower[1]
  const len = Math.hypot(du, dv)
  const phi = -Math.atan2(dv, du)
  let ny = Math.cos(phi)
  let nz = Math.sin(phi)
  if (ny * outward[0] + nz * outward[1] < 0) {
    ny = -ny
    nz = -nz
  }
  const mid: [number, number] = [(lower[0] + upper[0]) / 2, (lower[1] + upper[1]) / 2]
  return {
    geo: new BoxGeometry(width, thickness, len),
    pos: [0, mid[1] + ny * out, mid[0] + nz * out],
    rot: [phi, 0, 0],
  }
}

function wheel(rim: MeshStandardMaterial, tyre: MeshStandardMaterial, dark: MeshStandardMaterial): Group {
  const b = new Batch()
  const r = CAR.wheelRadius
  const side: V3 = [0, 0, Math.PI / 2] // cylinders stand along y: lay them along x
  b.cyl(tyre, r, r, 0.2, [0, 0, 0], 20, side)
  b.cyl(dark, 0.19, 0.19, 0.205, [0, 0, 0], 20, side, false)
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5
    // a spoke: a slim box from the hub toward the rim, turned about the axle (x)
    b.box(rim, [0.215, 0.03, 0.17], [0, Math.cos(a) * 0.095, Math.sin(a) * 0.095], [a + Math.PI / 2, 0, 0], false)
  }
  b.cyl(rim, 0.06, 0.06, 0.22, [0, 0, 0], 12, side, false)
  b.cyl(rim, 0.2, 0.2, 0.17, [0, 0, 0], 20, side, false)
  return b.build()
}

export function buildCar(paintColor: string = CAR_PAINT): CarModel {
  const paint = new MeshStandardMaterial({ color: paintColor, roughness: 0.38, metalness: 0.25 })
  const glass = new MeshStandardMaterial({ color: '#1a2531', roughness: 0.12, metalness: 0.55, transparent: true, opacity: 0.74, side: DoubleSide })
  const trim = new MeshStandardMaterial({ color: '#17181b', roughness: 0.7, metalness: 0.1 })
  const silver = new MeshStandardMaterial({ color: '#cfd3d9', roughness: 0.28, metalness: 0.8 })
  const tyre = new MeshStandardMaterial({ color: '#1b1b1e', roughness: 0.9, metalness: 0 })
  const lamp = new MeshStandardMaterial({ color: '#f1efe6', roughness: 0.25, metalness: 0.1, emissive: '#fff1c4', emissiveIntensity: 0.35 })
  const tail = new MeshStandardMaterial({ color: '#8c1319', roughness: 0.3, emissive: '#ff2b2b', emissiveIntensity: 0.7 })
  const reverse = new MeshStandardMaterial({ color: '#e9e9e9', roughness: 0.3, emissive: '#ffffff', emissiveIntensity: 0.1 })
  const plate = new MeshStandardMaterial({ color: '#f3f3f0', roughness: 0.5 })
  const interior = new MeshStandardMaterial({ color: '#25282d', roughness: 0.9 })
  const coat = new MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.8 })
  const veil = new MeshStandardMaterial({ color: '#c79a98', roughness: 0.8 })

  const b = new Batch()
  // ---- the shell ----
  b.add(paint, bodyGeometry(), [0, 0, 0])

  // ---- glass: side windows (two doors a side), windscreen, tailgate window ----
  const frontDoorGlass: Array<[number, number]> = [[0.7, 1.01], [0.3, 1.37], [-0.1, 1.38], [-0.1, 1.01]]
  const rearDoorGlass: Array<[number, number]> = [[-0.22, 1.01], [-0.22, 1.38], [-1.0, 1.36], [-1.2, 1.01]]
  const sideX = CAR.width / 2 + 0.006
  for (const panel of [frontDoorGlass, rearDoorGlass]) {
    b.add(glass, windowPanel(panel), [-sideX, 0, 0], [0, 0, 0], false)
    b.add(glass, windowPanel(panel), [sideX, 0, 0], [0, 0, 0], false, [-1, 1, 1])
  }
  const screen = slab(1.28, [0.9, 1.0], [0.3, 1.45], 0.02, 0.07, [1, 0.5])
  b.add(glass, screen.geo, screen.pos, screen.rot, false)
  const rearScreen = slab(1.18, [-1.68, 1.0], [-1.28, 1.4], 0.02, 0.075, [1, -0.5])
  b.add(glass, rearScreen.geo, rearScreen.pos, rearScreen.rot, false)

  // ---- door seams, handles, mirrors ----
  for (const sx of [-1, 1]) {
    for (const z of [0.76, -0.16, -1.1]) b.box(trim, [0.012, 0.62, 0.014], [sx * (sideX + 0.002), 0.64, z], undefined, false)
    b.box(silver, [0.02, 0.025, 0.14], [sx * (sideX + 0.01), 0.97, 0.28], undefined, false)
    b.box(silver, [0.02, 0.025, 0.14], [sx * (sideX + 0.01), 0.97, -0.62], undefined, false)
    b.box(paint, [0.14, 0.1, 0.16], [sx * (sideX + 0.1), 1.06, 0.66], [0, sx * -0.25, 0], false)
    b.box(trim, [0.04, 0.09, 0.14], [sx * (sideX + 0.1), 1.06, 0.58], [0, sx * -0.25, 0], false)
    b.box(trim, [0.02, 0.05, 2.1], [sx * (sideX + 0.004), 0.3, 0], undefined, false) // side sill
  }

  // ---- front: grille, intake, headlights, fog lights, plate ----
  const nose = HALF + 0.02
  b.box(trim, [0.84, 0.17, 0.05], [0, 0.6, nose], undefined, false)
  b.box(silver, [0.86, 0.02, 0.055], [0, 0.69, nose], undefined, false)
  b.box(trim, [1.1, 0.12, 0.06], [0, 0.4, nose - 0.01], undefined, false)
  b.box(trim, [1.46, 0.08, 0.1], [0, 0.31, nose - 0.04], undefined, false) // bumper lip
  b.box(plate, [0.44, 0.12, 0.012], [0, 0.4, nose + 0.025], undefined, false)
  for (const sx of [-1, 1]) {
    b.box(lamp, [0.4, 0.16, 0.08], [sx * 0.56, 0.77, nose - 0.03], [0, sx * 0.2, 0], false)
    b.box(lamp, [0.12, 0.08, 0.05], [sx * 0.62, 0.38, nose - 0.04], undefined, false)
  }
  // ---- rear: tail lights, reverse lights, bumper, plate ----
  const tailZ = -HALF - 0.04
  b.box(trim, [1.4, 0.2, 0.09], [0, 0.4, tailZ + 0.02], undefined, false)
  b.box(plate, [0.44, 0.12, 0.012], [0, 0.66, tailZ - 0.01], undefined, false)
  const tailLeft = new BoxGeometry(0.3, 0.26, 0.07)
  const tailRight = new BoxGeometry(0.3, 0.26, 0.07)
  b.add(tail, tailLeft, [0.62, 0.86, tailZ + 0.01], undefined, false)
  b.add(tail, tailRight, [-0.62, 0.86, tailZ + 0.01], undefined, false)
  b.box(reverse, [0.14, 0.06, 0.05], [0.66, 0.46, tailZ + 0.03], undefined, false)
  b.box(reverse, [0.14, 0.06, 0.05], [-0.66, 0.46, tailZ + 0.03], undefined, false)

  // ---- underneath and inside ----
  b.box(trim, [1.3, 0.1, 3.2], [0, 0.22, 0], undefined, false)
  for (const z of [AXLE_Z, -AXLE_Z]) b.cyl(trim, 0.4, 0.4, 1.3, [0, ARCH_V, z], 18, [0, 0, Math.PI / 2], false) // wheel wells
  b.box(interior, [1.3, 0.06, 2.3], [0, 0.42, -0.1], undefined, false) // floor
  b.box(interior, [1.3, 0.22, 0.42], [0, 0.93, 0.62], undefined, false) // dashboard
  b.box(interior, [0.42, 0.52, 0.4], [0.38, 0.6, -0.12], undefined, false) // driver's seat
  b.box(interior, [0.42, 0.52, 0.4], [-0.38, 0.6, -0.12], undefined, false)
  b.box(interior, [1.3, 0.5, 0.4], [0, 0.58, -0.95], undefined, false) // rear bench

  const bodyGroup = b.build()
  bodyGroup.name = 'car-body'

  // ---- the driver: simple, seen through the glass; shown only while she drives ----
  const driver = new Group()
  const torso = new Mesh(new BoxGeometry(0.36, 0.44, 0.2), coat)
  torso.position.set(0.38, 0.99, -0.12)
  const head = new Mesh(new SphereGeometry(0.125, 12, 9), veil)
  head.position.set(0.38, 1.3, -0.1)
  head.scale.set(1, 1.1, 1.05)
  const arm = new Mesh(new BoxGeometry(0.09, 0.09, 0.34), coat)
  arm.position.set(0.23, 1.0, 0.1)
  const arm2 = new Mesh(new BoxGeometry(0.09, 0.09, 0.34), coat)
  arm2.position.set(0.53, 1.0, 0.1)
  const wheelRing = new Mesh(new BoxGeometry(0.34, 0.03, 0.03), interior)
  wheelRing.position.set(0.38, 1.0, 0.3)
  driver.add(torso, head, arm, arm2, wheelRing)
  driver.visible = false

  // ---- the wheels: a pivot (steering) around a spinner (rolling) ----
  const rimMat = silver
  const wheels: Array<{ pivot: Group; spin: Group; front: boolean }> = []
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pivot = new Group()
      pivot.position.set(sx * WHEEL_X, CAR.wheelRadius, sz * AXLE_Z)
      const spin = new Group()
      const w = wheel(rimMat, tyre, trim)
      spin.add(w)
      pivot.add(spin)
      wheels.push({ pivot, spin, front: sz > 0 })
    }
  }

  const lean = new Group() // the body leans on its springs; the wheels stay on the road
  lean.add(bodyGroup, driver)
  const group = new Group()
  group.name = 'car'
  group.add(lean)
  for (const w of wheels) group.add(w.pivot)
  for (const m of [torso, head, arm, arm2, wheelRing]) m.castShadow = true

  let lastSpeed = 0
  const place = (car: CarState, dt: number): void => {
    group.position.set(car.x, 0, car.z)
    group.rotation.y = car.heading
    const angle = car.odometer / CAR.wheelRadius
    for (const w of wheels) {
      w.spin.rotation.x = angle
      w.pivot.rotation.y = w.front ? car.steer : 0
    }
    // lean: nose dips when braking, squats when accelerating, rolls outward in a bend
    const accel = dt > 1e-4 ? (car.speed - lastSpeed) / dt : 0
    lastSpeed = car.speed
    const pitchGoal = Math.max(-0.035, Math.min(0.035, accel * 0.004))
    const rollGoal = Math.max(-0.05, Math.min(0.05, car.yawRate * car.speed * 0.0035))
    const k = 1 - Math.exp(-8 * Math.min(dt, 0.1))
    lean.rotation.x += (pitchGoal - lean.rotation.x) * k
    lean.rotation.z += (rollGoal - lean.rotation.z) * k
    tail.emissiveIntensity = car.braking ? 3 : 0.7
    reverse.emissiveIntensity = car.speed < -0.1 ? 2.5 : 0.1
  }

  return {
    group,
    place,
    setDriverVisible: (visible) => {
      driver.visible = visible
    },
    dispose: () => disposeGroup(group),
  }
}
