import {
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type MeshStandardMaterialParameters,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { SKIRT_FLARE_MAX } from './animations/pose'
import {
  COAT_COLLAR_Y,
  COAT_HEM_Y,
  COAT_SPLIT_Y,
  HEAD,
  LAPEL_POLY,
  V_NECK_POLY,
  coatMesh,
  coatNormal,
  coatRing,
  decalMesh,
  hijabDrapeMesh,
  hijabShellMesh,
  mirrorPoly,
  rectPoly,
  ribbonMesh,
  shellPoint,
  skinZ,
  strapPath,
  type MeshData,
  type Vec3,
} from './charShapes'

/**
 * Colours sampled by eye from the reference photographs (reference/photos/character):
 * dusty-rose chiffon hijab, bright white coat, blush-pink strap and handbag, hot-pink flower.
 * The trousers and shoes are NOT visible in the photos — they are a neutral choice.
 */
export const CHAR_COLORS = {
  skin: '#dcae90',
  lip: '#b4636b',
  brow: '#2a1c17',
  iris: '#3a2418',
  hijab: '#cfb0ad',
  hijabFold: '#c2a19e',
  coat: '#f6f6f9',
  coatEdge: '#e3e5ec',
  lapel: '#fbfbfe',
  innerTop: '#e9cfc7',
  button: '#f3ede2',
  petalA: '#d94a7d',
  petalB: '#ec6f9e',
  petalCore: '#8f2348',
  strap: '#e6c4bb',
  bagBody: '#efe5d6',
  bagTrim: '#e8c6bc',
  metal: '#b9bcc4',
  gold: '#c9a35a',
  trousers: '#37343c',
  shoe: '#e3d3c6',
  sole: '#c9b5a4',
} as const

export function toGeometry(m: MeshData): BufferGeometry {
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(m.positions, 3))
  if (m.uvs) g.setAttribute('uv', new Float32BufferAttribute(m.uvs, 2))
  g.setIndex(m.indices)
  if (m.normals) g.setAttribute('normal', new Float32BufferAttribute(m.normals, 3))
  else g.computeVertexNormals()
  return g
}

/**
 * Adds a "flare" morph target: the lower coat gets deeper (z) towards the hem, and is untouched
 * at the waist, so the hem can open up when running without a step where it meets the torso.
 * Morph influence 1 = full flare (1 + SKIRT_FLARE_MAX at the hem).
 */
function withFlareMorph(g: BufferGeometry): BufferGeometry {
  const pos = g.getAttribute('position')
  const out = new Float32Array(pos.count * 3)
  const span = COAT_SPLIT_Y - COAT_HEM_Y
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const t = Math.min(Math.max((COAT_SPLIT_Y - y) / span, 0), 1)
    const w = t * t * (3 - 2 * t)
    const cz = coatRing(y).cz
    out[i * 3] = x
    out[i * 3 + 1] = y
    out[i * 3 + 2] = cz + (z - cz) * (1 + SKIRT_FLARE_MAX * w)
  }
  g.morphAttributes.position = [new Float32BufferAttribute(out, 3)]
  g.morphTargetsRelative = false
  return g
}

function tube(points: Vec3[], radius: number, closed = false, segments = 48): TubeGeometry {
  const curve = new CatmullRomCurve3(
    points.map((p) => new Vector3(p[0], p[1], p[2])),
    closed,
    'centripetal',
  )
  return new TubeGeometry(curve, segments, radius, 6, closed)
}

/** Points along a face curve, lying `out` metres in front of the skin (head-centre coordinates). */
function onSkin(curve: [number, number][], out: number): Vec3[] {
  return curve.map(([x, y]) => [x, y, skinZ(x, y) + out] as Vec3)
}

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (ctx) draw(ctx)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Black enamel pin with pink lettering (like the pins on the coat pocket in the photos). */
function pinTexture() {
  return canvasTexture(256, 140, (ctx) => {
    ctx.fillStyle = '#17101a'
    roundedRect(ctx, 6, 6, 244, 128, 34)
    ctx.fill()
    ctx.lineWidth = 6
    ctx.strokeStyle = '#ff5fa2'
    ctx.stroke()
    ctx.fillStyle = '#ff6fae'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'italic bold 54px Georgia, serif'
    ctx.fillText('Dental', 128, 52)
    ctx.fillText('Life', 128, 100)
  })
}

/** Blue university badge with a white tooth. */
function badgeTexture() {
  return canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#2f78c4'
    roundedRect(ctx, 4, 4, 120, 120, 18)
    ctx.fill()
    ctx.lineWidth = 5
    ctx.strokeStyle = '#d9e8f8'
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(34, 44)
    ctx.bezierCurveTo(34, 26, 54, 28, 64, 36)
    ctx.bezierCurveTo(74, 28, 94, 26, 94, 44)
    ctx.bezierCurveTo(94, 64, 84, 70, 82, 100)
    ctx.bezierCurveTo(80, 110, 70, 110, 68, 96)
    ctx.bezierCurveTo(66, 84, 62, 84, 60, 96)
    ctx.bezierCurveTo(58, 110, 48, 110, 46, 100)
    ctx.bezierCurveTo(44, 70, 34, 64, 34, 44)
    ctx.closePath()
    ctx.fill()
  })
}

const std = (color: string, roughness: number, extra: MeshStandardMaterialParameters = {}) =>
  new MeshStandardMaterial({ color, roughness, ...extra })

function buildAssets() {
  const C = CHAR_COLORS

  // ---- face curves (head-centre coordinates) ----
  const browL: [number, number][] = [[0.013, 0.04], [0.031, 0.0475], [0.054, 0.038]]
  const browR = browL.map(([x, y]) => [-x, y] as [number, number])
  const lashL: [number, number][] = [[0.0165, 0.0105], [0.0335, 0.0225], [0.0495, 0.0135], [0.0555, 0.017]]
  const lashR = lashL.map(([x, y]) => [-x, y] as [number, number])
  const upperLip: [number, number][] = [[-0.025, -0.0505], [-0.011, -0.0565], [0, -0.0555], [0.011, -0.0565], [0.025, -0.0505]]
  const lowerLip: [number, number][] = [[-0.021, -0.0545], [-0.01, -0.0625], [0, -0.065], [0.01, -0.0625], [0.021, -0.0545]]
  const mouthLine: [number, number][] = [[-0.027, -0.0515], [-0.012, -0.0578], [0.012, -0.0578], [0.027, -0.0515]]

  // ---- hijab rim around the face window + forehead fold ----
  const w = HEAD.window
  const rim: Vec3[] = Array.from({ length: 48 }, (_, k) => {
    const b = (k / 48) * Math.PI * 2
    return shellPoint(w.ax * Math.cos(b), w.cy + w.ay * Math.sin(b), 0.0015)
  })
  const fold: Vec3[] = (
    [[-0.064, 0.056], [-0.036, 0.084], [0, 0.092], [0.036, 0.085], [0.064, 0.058]] as [number, number][]
  ).map(([x, y]) => shellPoint(x, y, 0.002))

  const geo = {
    unitSphere: new SphereGeometry(1, 32, 20),
    unitSphereLo: new SphereGeometry(1, 16, 10),
    coatTorso: toGeometry(coatMesh(COAT_SPLIT_Y, COAT_COLLAR_Y)),
    coatSkirt: withFlareMorph(toGeometry(coatMesh(COAT_HEM_Y, COAT_SPLIT_Y))),
    hijabShell: toGeometry(hijabShellMesh()),
    hijabDrape: toGeometry(hijabDrapeMesh()),
    hijabRim: tube(rim, 0.0062, true, 64),
    hijabFold: tube(fold, 0.011, false, 24),
    lapelL: toGeometry(decalMesh(LAPEL_POLY, 0.005)),
    lapelR: toGeometry(decalMesh(mirrorPoly(LAPEL_POLY), 0.005)),
    vNeck: toGeometry(decalMesh(V_NECK_POLY, 0.003)),
    pocketEdge: toGeometry(decalMesh(rectPoly(-0.1, 1.135, 0.098, 0.103), 0.003)),
    pocket: toGeometry(decalMesh(rectPoly(-0.1, 1.135, 0.09, 0.095), 0.0045)),
    pinBlack: toGeometry(decalMesh(rectPoly(-0.123, 1.163, 0.046, 0.025), 0.0075, 0.004)),
    badge: toGeometry(decalMesh(rectPoly(-0.078, 1.16, 0.03, 0.03), 0.0075, 0.004)),
    placketUp: toGeometry(decalMesh(rectPoly(0, (COAT_SPLIT_Y + 1.17) / 2, 0.046, 1.17 - COAT_SPLIT_Y), 0.003)),
    placketLow: withFlareMorph(
      toGeometry(decalMesh(rectPoly(0, (COAT_HEM_Y + COAT_SPLIT_Y) / 2, 0.046, COAT_SPLIT_Y - COAT_HEM_Y), 0.003)),
    ),
    strap: toGeometry(ribbonMesh(strapPath(), coatNormal, 0.03)),
    button: new CylinderGeometry(0.0125, 0.0125, 0.006, 18).rotateX(Math.PI / 2),
    brow: [tube(onSkin(browL, 0.003), 0.0033, false, 16), tube(onSkin(browR, 0.003), 0.0033, false, 16)],
    lash: [tube(onSkin(lashL, 0.0045), 0.0022, false, 16), tube(onSkin(lashR, 0.0045), 0.0022, false, 16)],
    upperLip: tube(onSkin(upperLip, 0.0015), 0.0032, false, 16),
    lowerLip: tube(onSkin(lowerLip, 0.0015), 0.0042, false, 16),
    mouthLine: tube(onSkin(mouthLine, 0.0018), 0.0012, false, 16),
    thigh: new CylinderGeometry(0.075, 0.062, 0.4, 18),
    shin: new CylinderGeometry(0.058, 0.043, 0.37, 18),
    upperArm: new CapsuleGeometry(0.05, 0.18, 6, 14),
    foreArm: new CapsuleGeometry(0.045, 0.16, 6, 14),
    cuff: new CylinderGeometry(0.05, 0.048, 0.03, 18),
    watchBand: new TorusGeometry(0.034, 0.0045, 8, 20),
    watchFace: new CylinderGeometry(0.014, 0.014, 0.006, 16),
    sole: new RoundedBoxGeometry(0.09, 0.016, 0.24, 2, 0.006),
    bag: new RoundedBoxGeometry(0.2, 0.15, 0.08, 4, 0.02),
    bagBand: new RoundedBoxGeometry(0.204, 0.04, 0.084, 3, 0.016),
    bagHandle: new TorusGeometry(0.055, 0.0075, 8, 24, Math.PI),
    ring: new TorusGeometry(0.012, 0.0025, 6, 14),
    neck: new CylinderGeometry(0.034, 0.038, 0.09, 14),
  }

  const pinMap = pinTexture()
  const badgeMap = badgeTexture()

  const mat = {
    skin: std(C.skin, 0.62),
    lip: std(C.lip, 0.5),
    brow: std(C.brow, 0.8),
    sclera: std('#f6f1ea', 0.35),
    iris: std(C.iris, 0.3),
    pupil: std('#0d0807', 0.2),
    glint: new MeshBasicMaterial({ color: '#ffffff' }),
    blush: new MeshBasicMaterial({ color: '#e0757a', transparent: true, opacity: 0.2, depthWrite: false }),
    hijab: std(C.hijab, 0.85, { side: DoubleSide }),
    hijabFold: std(C.hijabFold, 0.88),
    coat: std(C.coat, 0.9, { side: DoubleSide }),
    coatEdge: std(C.coatEdge, 0.9),
    lapel: std(C.lapel, 0.9),
    innerTop: std(C.innerTop, 0.85),
    button: std(C.button, 0.45),
    petalA: std(C.petalA, 0.7),
    petalB: std(C.petalB, 0.7),
    petalCore: std(C.petalCore, 0.6),
    strap: std(C.strap, 0.7, { side: DoubleSide }),
    bagBody: std(C.bagBody, 0.65),
    bagTrim: std(C.bagTrim, 0.6),
    metal: std(C.metal, 0.3, { metalness: 0.85 }),
    gold: std(C.gold, 0.3, { metalness: 0.85 }),
    trousers: std(C.trousers, 0.85),
    shoe: std(C.shoe, 0.6),
    sole: std(C.sole, 0.8),
    pin: std('#ffffff', 0.5, { map: pinMap, transparent: true, alphaTest: 0.5 }),
    badge: std('#ffffff', 0.5, { map: badgeMap, transparent: true, alphaTest: 0.5 }),
  }

  return { geo, mat }
}

export type CharacterAssets = ReturnType<typeof buildAssets>

let cache: CharacterAssets | null = null

/** Built once and shared for the whole session (the character never leaves the game). */
export function getCharacterAssets(): CharacterAssets {
  if (!cache) cache = buildAssets()
  return cache
}
