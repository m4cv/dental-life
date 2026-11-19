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
  FACE_PATCH,
  HEAD,
  LAPEL_POLY,
  V_NECK_POLY,
  coatMesh,
  coatNormal,
  coatRing,
  decalMesh,
  eyeLidMesh,
  eyePoint,
  facePatchMesh,
  hijabDrapeMesh,
  hijabShellMesh,
  irisCapMesh,
  lashLine,
  mirrorPoly,
  rectPoly,
  ribbonMesh,
  shellPoint,
  skinZ,
  strapPath,
  taperTubeMesh,
  tuckCoatMesh,
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
  brow: '#2b1b15',
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
/** How far each coat piece continues past the torso/hem seam (metres). */
const SEAM_NEST = 0.09

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

/** Eyelid sheet: closed shape plus a "relaxed open" morph target (influence 1 = open). */
function withRestMorph(): BufferGeometry {
  const { mesh, rest } = eyeLidMesh()
  const g = toGeometry(mesh)
  g.morphAttributes.position = [new Float32BufferAttribute(rest, 3)]
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


/** Soft painted face detail on a transparent sheet: blush, eyeshadow, brows, lips (see facePatchMesh). */
function faceTexture() {
  const { xMin, xMax, yMin, yMax } = FACE_PATCH
  const W = 640
  const sx = W / (xMax - xMin)
  const H = Math.round((yMax - yMin) * sx)
  const X = (x: number) => (x - xMin) * sx
  const Y = (y: number) => (yMax - y) * sx
  return canvasTexture(W, H, (ctx) => {
    ctx.clearRect(0, 0, W, H)
    const glow = (cx: number, cy: number, rx: number, ry: number, rgb: string, a: number, mid = 0.55) => {
      ctx.save()
      ctx.translate(X(cx), Y(cy))
      ctx.scale(rx * sx, ry * sx)
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
      g.addColorStop(0, `rgba(${rgb},${a})`)
      g.addColorStop(mid, `rgba(${rgb},${a * 0.5})`)
      g.addColorStop(1, `rgba(${rgb},0)`)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(0, 0, 1, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    const smooth = (pts: [number, number][], close: boolean) => {
      const P = pts.map(([x, y]) => [X(x), Y(y)] as [number, number])
      const n = P.length
      const mid = (i: number): [number, number] => {
        const a = P[i % n]
        const b = P[(i + 1) % n]
        return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      }
      ctx.beginPath()
      if (close) {
        const m0 = mid(n - 1)
        ctx.moveTo(m0[0], m0[1])
        for (let i = 0; i < n; i++) {
          const m = mid(i)
          ctx.quadraticCurveTo(P[i][0], P[i][1], m[0], m[1])
        }
        ctx.closePath()
      } else {
        ctx.moveTo(P[0][0], P[0][1])
        for (let i = 1; i < n - 1; i++) {
          const m = mid(i)
          ctx.quadraticCurveTo(P[i][0], P[i][1], m[0], m[1])
        }
        ctx.lineTo(P[n - 1][0], P[n - 1][1])
      }
    }

    // soft shading that settles the face into the hijab frame
    {
      const w = HEAD.window
      ctx.save()
      ctx.translate(X(0), Y(w.cy))
      ctx.scale(w.ax * sx, w.ay * sx)
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
      g.addColorStop(0, 'rgba(120,68,52,0)')
      g.addColorStop(0.7, 'rgba(120,68,52,0)')
      g.addColorStop(1, 'rgba(120,68,52,0.2)')
      ctx.fillStyle = g
      ctx.fillRect(-1.4, -1.4, 2.8, 2.8)
      ctx.restore()
    }
    // light on forehead, nose bridge, cheekbones, chin
    glow(0, 0.054, 0.032, 0.017, '255,244,232', 0.12)
    glow(0, -0.008, 0.0045, 0.016, '255,244,232', 0.12)
    glow(0.044, -0.004, 0.017, 0.012, '255,244,232', 0.08)
    glow(-0.044, -0.004, 0.017, 0.012, '255,244,232', 0.08)
    glow(0, -0.09, 0.015, 0.008, '255,244,232', 0.08)
    // cheeks
    for (const k of [1, -1]) {
      glow(k * 0.041, -0.02, 0.031, 0.022, '226,104,116', 0.44)
      glow(k * 0.04, -0.018, 0.016, 0.012, '232,92,108', 0.22)
      // eyeshadow on the lid, and a soft shade under the eye
      const [lx, ly] = eyePoint(0.001, 0.0135, k as 1 | -1)
      glow(lx, ly, 0.0205, 0.0085, '150,92,84', 0.34)
      const [ux, uy] = eyePoint(0.001, -0.0125, k as 1 | -1)
      glow(ux, uy, 0.017, 0.0042, '160,100,90', 0.14)
      // alar shadow beside the nose
      glow(k * 0.0108, -0.0285, 0.006, 0.0055, '130,75,62', 0.16)
      // smile-corner shade
      glow(k * 0.0275, -0.0512, 0.0045, 0.0045, '130,75,62', 0.12)
    }
    for (const k of [1, -1]) glow(k * 0.0052, -0.01, 0.0032, 0.0135, '130,75,62', 0.1)
    glow(0, -0.0325, 0.011, 0.004, '130,75,62', 0.14)
    glow(0, -0.0668, 0.016, 0.0045, '130,75,62', 0.16)

    // eye crease and a thin lower lash line
    for (const k of [1, -1] as const) {
      ctx.save()
      ctx.lineCap = 'round'
      ctx.shadowColor = 'rgba(110,65,55,0.5)'
      ctx.shadowBlur = 2.5
      ctx.strokeStyle = 'rgba(112,66,56,0.42)'
      ctx.lineWidth = 1.7
      smooth([eyePoint(-0.0115, 0.0182, k), eyePoint(0.002, 0.0218, k), eyePoint(0.0145, 0.0192, k), eyePoint(0.0225, 0.0125, k)], false)
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.strokeStyle = 'rgba(70,42,34,0.5)'
      ctx.lineWidth = 1.2
      const low: [number, number][] = []
      for (let i = 0; i <= 8; i++) {
        const u = -0.0158 + (0.0316 * i) / 8
        low.push(eyePoint(u, -0.0099 * Math.sqrt(Math.max(1 - (u / 0.0168) ** 2, 0)) - 0.0002, k))
      }
      smooth(low, false)
      ctx.stroke()
      ctx.restore()
    }

    // eyebrows: soft arches, fuller at the inner end, tapering to a fine tail
    for (const k of [1, -1]) {
      const inner: [number, number] = [0.012, 0.0402]
      const peak: [number, number] = [0.03, 0.0482]
      const outer: [number, number] = [0.0418, 0.0386]
      const path: [number, number][] = []
      const N = 22
      for (let i = 0; i <= N; i++) {
        const t = i / N
        const px = (1 - t) * (1 - t) * inner[0] + 2 * (1 - t) * t * peak[0] + t * t * outer[0]
        const py = (1 - t) * (1 - t) * inner[1] + 2 * (1 - t) * t * peak[1] + t * t * outer[1]
        path.push([k * px, py])
      }
      const half = (t: number) => 0.0021 * Math.pow(1 - t, 0.75) * (0.62 + 0.38 * Math.min(1, t / 0.2))
      const up: [number, number][] = []
      const dn: [number, number][] = []
      for (let i = 0; i <= N; i++) {
        const t = i / N
        const a = path[Math.max(i - 1, 0)]
        const b = path[Math.min(i + 1, N)]
        let tx = b[0] - a[0]
        let ty = b[1] - a[1]
        const tl = Math.hypot(tx, ty) || 1
        tx /= tl
        ty /= tl
        const h = half(t)
        up.push([path[i][0] - ty * h, path[i][1] + tx * h])
        dn.push([path[i][0] + ty * h, path[i][1] - tx * h])
      }
      const outline = [...up, ...dn.reverse()]
      ctx.save()
      ctx.shadowColor = 'rgba(70,44,34,0.55)'
      ctx.shadowBlur = 2.2
      ctx.fillStyle = 'rgba(66,42,32,0.93)'
      ctx.beginPath()
      outline.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(X(x), Y(y)) : ctx.lineTo(X(x), Y(y))))
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    // lips: rose lipstick, a touch fuller below, with a gentle smile
    {
      const y0 = -0.0535
      const upper: [number, number][] = [
        [-0.0245, y0 + 0.0032], [-0.0185, y0 + 0.0066], [-0.0105, y0 + 0.0084], [-0.004, y0 + 0.0068], [0, y0 + 0.0062],
        [0.004, y0 + 0.0068], [0.0105, y0 + 0.0084], [0.0185, y0 + 0.0066], [0.0245, y0 + 0.0032],
        [0.012, y0 + 0.0004], [0, y0 + 0.0001], [-0.012, y0 + 0.0004],
      ]
      const lower: [number, number][] = [
        [-0.0245, y0 + 0.0032], [-0.012, y0 + 0.0004], [0, y0 + 0.0001], [0.012, y0 + 0.0004], [0.0245, y0 + 0.0032],
        [0.02, y0 - 0.0026], [0.0125, y0 - 0.0078], [0, y0 - 0.0098], [-0.0125, y0 - 0.0078], [-0.02, y0 - 0.0026],
      ]
      ctx.save()
      ctx.shadowColor = 'rgba(190,90,110,0.5)'
      ctx.shadowBlur = 3
      let g = ctx.createLinearGradient(0, Y(y0 + 0.0085), 0, Y(y0))
      g.addColorStop(0, '#c0697a')
      g.addColorStop(1, '#a9505f')
      ctx.fillStyle = g
      smooth(upper, true)
      ctx.fill()
      g = ctx.createLinearGradient(0, Y(y0), 0, Y(y0 - 0.01))
      g.addColorStop(0, '#cc6e84')
      g.addColorStop(1, '#df8a9d')
      ctx.fillStyle = g
      smooth(lower, true)
      ctx.fill()
      ctx.restore()
      // parting line
      ctx.save()
      ctx.lineCap = 'round'
      ctx.strokeStyle = 'rgba(100,38,52,0.85)'
      ctx.lineWidth = 1.5
      smooth([[-0.0245, y0 + 0.0032], [-0.012, y0 + 0.0004], [0, y0 + 0.0001], [0.012, y0 + 0.0004], [0.0245, y0 + 0.0032]], false)
      ctx.stroke()
      ctx.restore()
      glow(0, y0 - 0.0052, 0.0075, 0.0018, '255,255,255', 0.3)
      glow(0, y0 + 0.0072, 0.005, 0.0009, '255,255,255', 0.14)
    }

    // fade the sheet out at its borders so there is never a hard edge on the skin
    ctx.globalCompositeOperation = 'destination-in'
    const fade = 0.07
    let m = ctx.createLinearGradient(0, 0, W, 0)
    m.addColorStop(0, 'rgba(0,0,0,0)')
    m.addColorStop(fade, 'rgba(0,0,0,1)')
    m.addColorStop(1 - fade, 'rgba(0,0,0,1)')
    m.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = m
    ctx.fillRect(0, 0, W, H)
    m = ctx.createLinearGradient(0, 0, 0, H)
    m.addColorStop(0, 'rgba(0,0,0,0)')
    m.addColorStop(fade, 'rgba(0,0,0,1)')
    m.addColorStop(1 - fade, 'rgba(0,0,0,1)')
    m.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = m
    ctx.fillRect(0, 0, W, H)
  })
}

/** Brown iris with a dark rim, fine radial fibres and a black pupil (disc, mapped by irisCapMesh). */
function irisTexture() {
  return canvasTexture(256, 256, (ctx) => {
    const c = 128
    ctx.clearRect(0, 0, 256, 256)
    const g = ctx.createRadialGradient(c, c, 0, c, c, c)
    g.addColorStop(0, '#2a180e')
    g.addColorStop(0.3, '#46281a')
    g.addColorStop(0.62, '#7a4a2c')
    g.addColorStop(0.88, '#43271a')
    g.addColorStop(1, '#1d110c')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(c, c, c - 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 1.6
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * Math.PI * 2 + (i % 3) * 0.04
      ctx.strokeStyle = i % 2 ? 'rgba(190,135,88,0.20)' : 'rgba(30,16,10,0.22)'
      ctx.beginPath()
      ctx.moveTo(c + Math.cos(a) * c * 0.36, c + Math.sin(a) * c * 0.36)
      ctx.lineTo(c + Math.cos(a) * c * 0.86, c + Math.sin(a) * c * 0.86)
      ctx.stroke()
    }
    ctx.fillStyle = '#0b0605'
    ctx.beginPath()
    ctx.arc(c, c, c * 0.34, 0, Math.PI * 2)
    ctx.fill()
  })
}
const std = (color: string, roughness: number, extra: MeshStandardMaterialParameters = {}) =>
  new MeshStandardMaterial({ color, roughness, ...extra })

function buildAssets() {
  const C = CHAR_COLORS

  // ---- eyeliner: the left-eye lash line, mirrored for the right eye ----
  const lashL: [number, number][] = lashLine()
  const lashR = lashL.map(([x, y]) => [-x, y] as [number, number])
  const linerZ = 0.0048
  const liner = (curve: [number, number][]) =>
    toGeometry(
      taperTubeMesh(
        curve.map(([x, y]) => [x, y, skinZ(x, y) + linerZ] as Vec3),
        (t) => 0.0007 + 0.0024 * Math.pow(Math.sin(Math.PI * Math.min(Math.pow(t, 0.8), 1)), 0.9),
        28,
        6,
      ),
    )

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
    // both pieces continue past the seam, a little smaller, so the swinging hem never shows a hole
    coatTorso: toGeometry(tuckCoatMesh(coatMesh(COAT_SPLIT_Y - SEAM_NEST, COAT_COLLAR_Y), COAT_SPLIT_Y, -1, SEAM_NEST, 0.045)),
    coatSkirt: withFlareMorph(
      toGeometry(tuckCoatMesh(coatMesh(COAT_HEM_Y, COAT_SPLIT_Y + SEAM_NEST), COAT_SPLIT_Y, 1, SEAM_NEST, 0.045)),
    ),
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
    lash: [liner(lashL), liner(lashR)],
    facePatch: toGeometry(facePatchMesh()),
    irisCap: toGeometry(irisCapMesh()),
    eyeLid: withRestMorph(),
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

  const faceMap = faceTexture()
  const irisMap = irisTexture()
  const pinMap = pinTexture()
  const badgeMap = badgeTexture()

  const mat = {
    skin: std(C.skin, 0.62),
    brow: std(C.brow, 0.6),
    sclera: std('#f4eee8', 0.35),
    iris: std('#ffffff', 0.22, { map: irisMap, transparent: true }),
    nostril: std('#6a4038', 0.7),
    lid: std('#d2a38b', 0.62, { side: DoubleSide }),
    glint: new MeshBasicMaterial({ color: '#ffffff' }),
    faceArt: std('#ffffff', 0.6, {
      map: faceMap,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
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
