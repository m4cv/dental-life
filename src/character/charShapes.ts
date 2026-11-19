/**
 * Pure shape data for the main character: coat profile, hijab, decals and the strap ribbon.
 * No three.js and no React here, so every function can be checked in Node
 * (scripts/test-shapes.mjs). geometry.ts turns the MeshData into BufferGeometry.
 *
 * Character local space: +y up, +z forward, +x = the character's LEFT. Metres.
 * Heights are absolute (floor = 0); the renderer re-parents them to the right rig joint.
 */

const TAU = Math.PI * 2

export interface MeshData {
  positions: number[]
  indices: number[]
  uvs?: number[]
  /** Analytic vertex normals (used where neighbouring meshes must shade identically). */
  normals?: number[]
}

export type Vec3 = [number, number, number]
export type Vec2 = [number, number]

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (t: number) => {
  const c = clamp(t, 0, 1)
  return c * c * (3 - 2 * c)
}

// ---------------------------------------------------------------------------------------------
// Head
// ---------------------------------------------------------------------------------------------

export const HEAD = {
  centerY: 1.52,
  centerZ: 0.012,
  /** Skin ellipsoid half-axes. */
  skin: { rx: 0.086, ry: 0.106, rz: 0.098 },
  /** Hijab shell half-axes (the shell sits ~1 cm outside the skin: fabric + hair volume). */
  shell: { rx: 0.098, ry: 0.118, rz: 0.11 },
  /** The oval of face left open by the hijab, in head-centre coordinates. */
  window: { cy: -0.02, ax: 0.066, ay: 0.088 },
} as const

/** Forward (+z) distance of the skin surface at (x, y) in head-centre coordinates. */
export function skinZ(x: number, y: number): number {
  const { rx, ry, rz } = HEAD.skin
  return rz * Math.sqrt(Math.max(1 - (x / rx) ** 2 - (y / ry) ** 2, 0))
}

/** Forward (+z) distance of the hijab shell at (x, y) in head-centre coordinates. */
export function shellZ(x: number, y: number): number {
  const { rx, ry, rz } = HEAD.shell
  return rz * Math.sqrt(Math.max(1 - (x / rx) ** 2 - (y / ry) ** 2, 0))
}

// ---------------------------------------------------------------------------------------------
// Cubic interpolation helpers
// ---------------------------------------------------------------------------------------------

/** Cubic Hermite through (ys, vs) with finite-difference tangents; clamps outside the range. */
function hermite(ys: readonly number[], vs: readonly number[], y: number): number {
  const n = ys.length
  if (y <= ys[0]) return vs[0]
  if (y >= ys[n - 1]) return vs[n - 1]
  let i = 0
  while (y > ys[i + 1]) i++
  const tangent = (k: number) =>
    k === 0
      ? (vs[1] - vs[0]) / (ys[1] - ys[0])
      : k === n - 1
        ? (vs[n - 1] - vs[n - 2]) / (ys[n - 1] - ys[n - 2])
        : (vs[k + 1] - vs[k - 1]) / (ys[k + 1] - ys[k - 1])
  const h = ys[i + 1] - ys[i]
  const t = (y - ys[i]) / h
  const t2 = t * t
  const t3 = t2 * t
  return (
    (2 * t3 - 3 * t2 + 1) * vs[i] +
    (t3 - 2 * t2 + t) * tangent(i) * h +
    (-2 * t3 + 3 * t2) * vs[i + 1] +
    (t3 - t2) * tangent(i + 1) * h
  )
}

/** Closed Catmull-Rom through equally spaced knots; u is in [0, 1) around the loop. */
function periodic(vals: readonly number[], u: number): number {
  const n = vals.length
  const f = (((u % 1) + 1) % 1) * n
  const i = Math.floor(f)
  const t = f - i
  const p0 = vals[(i - 1 + n) % n]
  const p1 = vals[i % n]
  const p2 = vals[(i + 1) % n]
  const p3 = vals[(i + 2) % n]
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
  )
}

// ---------------------------------------------------------------------------------------------
// Lab coat
// ---------------------------------------------------------------------------------------------

export interface Ring {
  y: number
  /** Half-width (x) of the elliptical cross-section. */
  rx: number
  /** Half-depth (z) of the cross-section. */
  rz: number
  /** Forward shift of the ellipse centre (bust and chest sit ahead of the spine). */
  cz: number
}

/** Cross-sections of the knee-length white coat, hem to collar. */
export const COAT_RINGS: readonly Ring[] = [
  { y: 0.56, rx: 0.245, rz: 0.185, cz: 0.0 },
  { y: 0.62, rx: 0.236, rz: 0.178, cz: 0.0 },
  { y: 0.7, rx: 0.224, rz: 0.17, cz: 0.002 },
  { y: 0.8, rx: 0.208, rz: 0.16, cz: 0.005 },
  { y: 0.88, rx: 0.19, rz: 0.146, cz: 0.007 },
  { y: 0.95, rx: 0.17, rz: 0.128, cz: 0.008 },
  { y: 1.05, rx: 0.176, rz: 0.13, cz: 0.012 },
  { y: 1.15, rx: 0.188, rz: 0.138, cz: 0.018 },
  { y: 1.25, rx: 0.19, rz: 0.134, cz: 0.012 },
  { y: 1.3, rx: 0.192, rz: 0.128, cz: 0.006 },
  { y: 1.335, rx: 0.178, rz: 0.118, cz: 0.002 },
  { y: 1.36, rx: 0.15, rz: 0.104, cz: 0.0 },
  { y: 1.382, rx: 0.112, rz: 0.084, cz: 0.0 },
  { y: 1.4, rx: 0.082, rz: 0.066, cz: 0.0 },
  { y: 1.412, rx: 0.064, rz: 0.056, cz: 0.0 },
]

/** Height where the coat splits into the torso part (above) and the swinging hem part (below). */
export const COAT_SPLIT_Y = 0.95
export const COAT_HEM_Y = COAT_RINGS[0].y
export const COAT_COLLAR_Y = COAT_RINGS[COAT_RINGS.length - 1].y

const RING_Y = COAT_RINGS.map((r) => r.y)
const RING_RX = COAT_RINGS.map((r) => r.rx)
const RING_RZ = COAT_RINGS.map((r) => r.rz)
const RING_CZ = COAT_RINGS.map((r) => r.cz)

export function coatRing(y: number): Ring {
  return {
    y,
    rx: hermite(RING_Y, RING_RX, y),
    rz: hermite(RING_Y, RING_RZ, y),
    cz: hermite(RING_Y, RING_CZ, y),
  }
}

/** Implicit ellipse value of a point against the coat: < 1 inside the coat, > 1 outside. */
export function coatImplicit(x: number, y: number, z: number): number {
  const r = coatRing(y)
  return (x / r.rx) ** 2 + ((z - r.cz) / r.rz) ** 2
}

/** Z of the coat's front surface at (x, y). x is clamped just inside the silhouette. */
export function coatFrontZ(x: number, y: number): number {
  const r = coatRing(y)
  const t = clamp(x / r.rx, -0.995, 0.995)
  return r.cz + r.rz * Math.sqrt(1 - t * t)
}

/** Z of the coat's back surface at (x, y) (negative). */
export function coatBackZ(x: number, y: number): number {
  const r = coatRing(y)
  const t = clamp(x / r.rx, -0.995, 0.995)
  return r.cz - r.rz * Math.sqrt(1 - t * t)
}

// ---------------------------------------------------------------------------------------------
// Generic grid builder
// ---------------------------------------------------------------------------------------------

function buildGrid(
  rows: number,
  cols: number,
  wrap: boolean,
  at: (i: number, j: number) => Vec3,
  flip: boolean,
): MeshData {
  const stride = wrap ? cols : cols + 1
  const positions: number[] = []
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j < stride; j++) {
      const p = at(i, j)
      positions.push(p[0], p[1], p[2])
    }
  }
  const indices: number[] = []
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * stride + j
      const b = i * stride + (wrap ? (j + 1) % cols : j + 1)
      const c = (i + 1) * stride + j
      const d = (i + 1) * stride + (wrap ? (j + 1) % cols : j + 1)
      if (flip) indices.push(a, c, b, b, c, d)
      else indices.push(a, b, c, b, d, c)
    }
  }
  return { positions, indices }
}

/**
 * Coat body between two heights (use COAT_SPLIT_Y to split torso part and hem part).
 * Normals come from the ring profile, not from the triangles, so the two halves shade
 * identically where they meet at the waist (no visible seam).
 */
export function coatMesh(yMin: number, yMax: number, cols = 48): MeshData {
  const rows = Math.max(2, Math.ceil((yMax - yMin) / 0.02))
  const mesh = buildGrid(
    rows,
    cols,
    true,
    (i, j) => {
      const y = yMin + ((yMax - yMin) * i) / rows
      const r = coatRing(y)
      const th = (j / cols) * TAU
      return [r.rx * Math.sin(th), y, r.cz + r.rz * Math.cos(th)]
    },
    false,
  )
  const normals: number[] = []
  const e = 0.002
  for (let i = 0; i <= rows; i++) {
    const y = yMin + ((yMax - yMin) * i) / rows
    const a = coatRing(y - e)
    const b = coatRing(y + e)
    const r = coatRing(y)
    const drx = (b.rx - a.rx) / (2 * e)
    const drz = (b.rz - a.rz) / (2 * e)
    const dcz = (b.cz - a.cz) / (2 * e)
    for (let j = 0; j < cols; j++) {
      const th = (j / cols) * TAU
      const st = Math.sin(th)
      const ct = Math.cos(th)
      const tth: Vec3 = [r.rx * ct, 0, -r.rz * st]
      const ty: Vec3 = [drx * st, 1, dcz + drz * ct]
      const n: Vec3 = [
        tth[1] * ty[2] - tth[2] * ty[1],
        tth[2] * ty[0] - tth[0] * ty[2],
        tth[0] * ty[1] - tth[1] * ty[0],
      ]
      const l = Math.hypot(n[0], n[1], n[2]) || 1
      normals.push(n[0] / l, n[1] / l, n[2] / l)
    }
  }
  return { ...mesh, normals }
}

// ---------------------------------------------------------------------------------------------
// Hijab
// ---------------------------------------------------------------------------------------------

/** Point on the shell ellipsoid at head-centre (x, y), pushed `out` metres forward. */
export function shellPoint(x: number, y: number, out = 0): Vec3 {
  return [x, y, shellZ(x, y) + out]
}

/**
 * Head covering: the shell ellipsoid with an oval face window. The grid fans out from the
 * window rim along great circles to the back of the head, so the rim is an exact grid line
 * (no jagged cut-out edge). Head-centre coordinates.
 */
export function hijabShellMesh(cols = 64, rows = 22): MeshData {
  const { rx, ry, rz } = HEAD.shell
  const w = HEAD.window
  return buildGrid(
    rows,
    cols,
    true,
    (i, j) => {
      const beta = (j / cols) * TAU
      const x = w.ax * Math.cos(beta)
      const y = w.cy + w.ay * Math.sin(beta)
      const z = rz * Math.sqrt(Math.max(1 - (x / rx) ** 2 - (y / ry) ** 2, 1e-6))
      const d0: Vec3 = [x / rx, y / ry, z / rz]
      const dot = clamp(-d0[2], -1, 1) // d0 · (0,0,-1)
      const omega = Math.acos(dot)
      const t = i / rows
      const s = Math.sin(omega)
      const k0 = s < 1e-6 ? 1 - t : Math.sin((1 - t) * omega) / s
      const k1 = s < 1e-6 ? t : Math.sin(t * omega) / s
      const d: Vec3 = [k0 * d0[0], k0 * d0[1], k0 * d0[2] - k1]
      return [rx * d[0], ry * d[1], rz * d[2]]
    },
    true,
  )
}

/** Hem height of the shoulder drape around the loop; θ = 0 is the front, +π/2 the left side. */
const DRAPE_HEM = [1.235, 1.15, 1.2, 1.19, 1.17, 1.2, 1.27, 1.25]
export function drapeHem(theta: number): number {
  return periodic(DRAPE_HEM, theta / TAU)
}

const DRAPE_TOP_Y = 1.5

// Chin-tuck profile (absolute coordinates). The front stays behind the skin so the chin shows.
const TUCK_Y = [1.4, 1.42, 1.44, 1.47, 1.5]
const TUCK_RX = [0.108, 0.1, 0.096, 0.093, 0.092]
const TUCK_FRONT = [0.09, 0.06, 0.072, 0.08, 0.082]
const TUCK_BACK = [-0.085, -0.082, -0.09, -0.096, -0.098]

/** Cross-section of the hijab drape at height y. Always stands off the coat by 1.4–2 cm. */
export function drapeRing(y: number): { rx: number; front: number; back: number } {
  const c = coatRing(Math.min(y, COAT_COLLAR_Y))
  const gap = 0.014 + 0.006 * smooth((1.4 - y) / 0.12)
  const hug = { rx: c.rx + gap, front: c.cz + c.rz + gap, back: c.cz - c.rz - gap }
  const w = smooth((y - 1.39) / 0.03)
  return {
    rx: lerp(hug.rx, hermite(TUCK_Y, TUCK_RX, y), w),
    front: lerp(hug.front, hermite(TUCK_Y, TUCK_FRONT, y), w),
    back: lerp(hug.back, hermite(TUCK_Y, TUCK_BACK, y), w),
  }
}

/** Soft folds: only ever pushes outward so the fabric never sinks into the coat. */
function drapeFold(theta: number, t: number): number {
  return 1 + 0.014 * (0.5 + 0.5 * Math.sin(7 * theta + 3 * t)) * smooth(t * 1.5)
}

/** Fabric draped from under the chin over the shoulders and chest. Torso-frame absolute coords. */
export function hijabDrapeMesh(cols = 56, rows = 26): MeshData {
  return buildGrid(
    rows,
    cols,
    true,
    (i, j) => {
      const th = (j / cols) * TAU
      const hem = drapeHem(th) + 0.006 * Math.sin(5 * th)
      const t = i / rows
      const y = DRAPE_TOP_Y - (DRAPE_TOP_Y - hem) * t
      const r = drapeRing(y)
      const f = drapeFold(th, t)
      const cz = (r.front + r.back) / 2
      const rz = (r.front - r.back) / 2
      return [r.rx * f * Math.sin(th), y, cz + rz * f * Math.cos(th)]
    },
    true,
  )
}

// ---------------------------------------------------------------------------------------------
// Decals draped on the coat (lapels, pocket, badges, placket)
// ---------------------------------------------------------------------------------------------

function insidePolygon(poly: readonly Vec2[], x: number, y: number): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/**
 * Flat shape projected onto the coat's front surface, `offset` metres proud of it.
 * UVs map the polygon's bounding box to 0..1 so a texture can be applied.
 */
export function decalMesh(poly: readonly Vec2[], offset: number, step = 0.01): MeshData {
  const xs = poly.map((p) => p[0])
  const ys = poly.map((p) => p[1])
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  const cols = Math.max(1, Math.ceil((x1 - x0) / step))
  const rows = Math.max(1, Math.ceil((y1 - y0) / step))
  const positions: number[] = []
  const uvs: number[] = []
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= cols; j++) {
      const x = x0 + ((x1 - x0) * j) / cols
      const y = y0 + ((y1 - y0) * i) / rows
      positions.push(x, y, coatFrontZ(x, y) + offset)
      uvs.push(j / cols, i / rows)
    }
  }
  const indices: number[] = []
  const stride = cols + 1
  const px = (k: number) => positions[k * 3]
  const py = (k: number) => positions[k * 3 + 1]
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * stride + j
      const b = a + 1
      const c = a + stride
      const d = c + 1
      const t1 = [a, b, c] as const
      const t2 = [b, d, c] as const
      for (const t of [t1, t2]) {
        const cx = (px(t[0]) + px(t[1]) + px(t[2])) / 3
        const cy = (py(t[0]) + py(t[1]) + py(t[2])) / 3
        if (insidePolygon(poly, cx, cy)) indices.push(t[0], t[1], t[2])
      }
    }
  }
  return { positions, indices, uvs }
}

/** Axis-aligned rectangle polygon. */
export function rectPoly(cx: number, cy: number, w: number, h: number): Vec2[] {
  return [
    [cx - w / 2, cy - h / 2],
    [cx + w / 2, cy - h / 2],
    [cx + w / 2, cy + h / 2],
    [cx - w / 2, cy + h / 2],
  ]
}

/** Notch-collar lapel on the character's left (+x); mirror x for the other side. */
export const LAPEL_POLY: readonly Vec2[] = [
  [0.034, 1.405],
  [0.1, 1.392],
  [0.114, 1.318],
  [0.064, 1.205],
  [0.014, 1.172],
  [0.02, 1.285],
]

/** Blush inner top showing between the lapels. */
export const V_NECK_POLY: readonly Vec2[] = [
  [-0.04, 1.408],
  [0.04, 1.408],
  [0.0, 1.166],
]

export function mirrorPoly(poly: readonly Vec2[]): Vec2[] {
  return poly.map(([x, y]) => [-x, y] as Vec2).reverse()
}

// ---------------------------------------------------------------------------------------------
// Strap ribbon
// ---------------------------------------------------------------------------------------------

/** Uniform Catmull-Rom through 3D points. */
export function smoothPath(points: readonly Vec3[], perSegment = 8): Vec3[] {
  const out: Vec3[] = []
  const n = points.length
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(i + 2, n - 1)]
    for (let s = 0; s < perSegment; s++) {
      const t = s / perSegment
      const t2 = t * t
      const t3 = t2 * t
      const q = [0, 0, 0].map(
        (_, k) =>
          0.5 *
          (2 * p1[k] +
            (-p0[k] + p2[k]) * t +
            (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
            (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3),
      )
      out.push([q[0], q[1], q[2]])
    }
  }
  out.push([...points[n - 1]] as Vec3)
  return out
}

/** Flat ribbon lying on the coat: `normalAt` gives the outward surface normal for each point. */
export function ribbonMesh(
  path: readonly Vec3[],
  normalAt: (p: Vec3) => Vec3,
  width: number,
): MeshData {
  const positions: number[] = []
  const indices: number[] = []
  const uvs: number[] = []
  let run = 0
  for (let i = 0; i < path.length; i++) {
    const p = path[i]
    const a = path[Math.max(i - 1, 0)]
    const b = path[Math.min(i + 1, path.length - 1)]
    const t: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const tl = Math.hypot(t[0], t[1], t[2]) || 1
    t[0] /= tl
    t[1] /= tl
    t[2] /= tl
    const n = normalAt(p)
    // side = t × n
    let s: Vec3 = [t[1] * n[2] - t[2] * n[1], t[2] * n[0] - t[0] * n[2], t[0] * n[1] - t[1] * n[0]]
    const sl = Math.hypot(s[0], s[1], s[2]) || 1
    s = [s[0] / sl, s[1] / sl, s[2] / sl]
    const h = width / 2
    positions.push(p[0] - s[0] * h, p[1] - s[1] * h, p[2] - s[2] * h)
    positions.push(p[0] + s[0] * h, p[1] + s[1] * h, p[2] + s[2] * h)
    if (i > 0) {
      const q = path[i - 1]
      run += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
    }
    uvs.push(0, run, 1, run)
    if (i < path.length - 1) {
      const k = i * 2
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2)
    }
  }
  return { positions, indices, uvs }
}

/** Outward normal of the coat near (x, y, z); tips toward +y over the shoulder line. */
export function coatNormal(p: Vec3): Vec3 {
  const r = coatRing(p[1])
  const nx = p[0] / (r.rx * r.rx)
  const nz = (p[2] - r.cz) / (r.rz * r.rz)
  const up = smooth((p[1] - 1.335) / 0.03)
  const v: Vec3 = [nx * (1 - up), up, nz * (1 - up)]
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

/** Crossbody strap: a loop from the bag at the front-right hip, up over the chest, over the left shoulder, down the back and round the side. */
export function strapPath(offset = 0.012): Vec3[] {
  const front = (x: number, y: number): Vec3 => [x, y, coatFrontZ(x, y) + offset]
  const back = (x: number, y: number): Vec3 => [x, y, coatBackZ(x, y) - offset]
  const smoothed = smoothPath(
    [
      [-0.15, 0.905, 0.112],
      front(-0.16, 0.99),
      front(-0.085, 1.08),
      front(0.005, 1.17),
      front(0.09, 1.25),
      front(0.15, 1.31),
      [0.145, 1.352, 0.0],
      back(0.15, 1.31),
      back(0.08, 1.23),
      back(-0.01, 1.13),
      back(-0.1, 1.03),
      back(-0.17, 0.95),
      [-0.205, 0.93, 0.015],
      [-0.195, 0.915, 0.07],
      [-0.15, 0.905, 0.112],
    ],
    8,
  )
  // Spline corners can cut inside the coat; push any such point back out onto the surface.
  return smoothed.map((p) => {
    if (p[1] > 1.34) return p
    const v = coatImplicit(p[0], p[1], p[2])
    if (v >= 1.04) return p
    const r = coatRing(p[1])
    const k = Math.sqrt(1.04 / v)
    return [p[0] * k, p[1], r.cz + (p[2] - r.cz) * k] as Vec3
  })
}

// ---------------------------------------------------------------------------------------------
// Face (Stage 2 polish): eyes, lashes and the painted-detail patch
// ---------------------------------------------------------------------------------------------

/** Eye placement and size, head-centre coordinates. The left eye is at +x; the right is mirrored. */
export const EYE = {
  x: 0.0315,
  y: 0.012,
  /** Half-axes of the eyeball (sclera) ellipsoid. */
  a: 0.018,
  b: 0.0115,
  c: 0.0048,
  /** The outer corner sits a little higher than the inner one. */
  tilt: 0.1,
  /** Radius of the iris, measured across the face. */
  irisR: 0.0084,
} as const

/** A point in the eye's own frame (u outward along the eye, v up, metres) -> head-centre (x, y). */
export function eyePoint(u: number, v: number, side: 1 | -1 = 1): [number, number] {
  const c = Math.cos(EYE.tilt)
  const s = Math.sin(EYE.tilt)
  return [side * (EYE.x + u * c - v * s), EYE.y + u * s + v * c]
}

/** Upper lash line (eyeliner) of the left eye, inner corner to a small outer flick, in head-centre (x, y). */
export function lashLine(): [number, number][] {
  const a = 0.0172
  const b = 0.0106
  const pts: [number, number][] = []
  const n = 8
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const u = -a + 2 * a * t
    const v = b * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.85)), 0.75)
    pts.push(eyePoint(u, v))
  }
  pts.push(eyePoint(a + 0.0035, 0.0036))
  return pts
}

/**
 * Curved cap that follows the front of the eyeball ellipsoid, with planar UVs (a disc
 * texture maps straight onto it). Local to the eye centre, +z forward.
 */
export function irisCapMesh(rings = 6, segs = 24): MeshData {
  const { a, b, c, irisR } = EYE
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (let r = 0; r <= rings; r++) {
    const rho = r / rings
    for (let k = 0; k < segs; k++) {
      const psi = (k / segs) * TAU
      const X = irisR * rho * Math.cos(psi)
      const Y = irisR * rho * Math.sin(psi)
      const Z = c * Math.sqrt(Math.max(1 - (X / a) ** 2 - (Y / b) ** 2, 0)) * 1.012 + 0.0002
      let nx = X / (a * a)
      let ny = Y / (b * b)
      let nz = Z / (c * c)
      const nl = Math.hypot(nx, ny, nz)
      nx /= nl
      ny /= nl
      nz /= nl
      positions.push(X, Y, Z)
      normals.push(nx, ny, nz)
      uvs.push(0.5 + 0.5 * rho * Math.cos(psi), 0.5 + 0.5 * rho * Math.sin(psi))
    }
  }
  for (let r = 0; r < rings; r++) {
    for (let k = 0; k < segs; k++) {
      const k1 = (k + 1) % segs
      const a0 = r * segs + k
      const a1 = r * segs + k1
      const b0 = (r + 1) * segs + k
      const b1 = (r + 1) * segs + k1
      indices.push(a0, b1, a1, a0, b0, b1)
    }
  }
  return { positions, indices, uvs, normals }
}

/**
 * Round tube along a smooth curve whose radius changes along its length (thin ends, fuller
 * middle): used for the eyeliner. Open ends; the radius is small enough there not to need caps.
 */
export function taperTubeMesh(
  points: Vec3[],
  radiusAt: (t: number) => number,
  segs = 28,
  radial = 6,
): MeshData {
  const n = points.length
  const pt = (f: number): Vec3 => {
    const i = Math.min(Math.floor(f), n - 2)
    const t = f - i
    const p0 = points[Math.max(i - 1, 0)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(i + 2, n - 1)]
    const t2 = t * t
    const t3 = t2 * t
    return [0, 1, 2].map(
      (k) =>
        0.5 *
        (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3),
    ) as Vec3
  }
  const centre: Vec3[] = []
  for (let s = 0; s <= segs; s++) centre.push(pt((s / segs) * (n - 1 - 1e-9)))
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  for (let s = 0; s <= segs; s++) {
    const p = centre[s]
    const q = centre[Math.min(s + 1, segs)]
    const o = centre[Math.max(s - 1, 0)]
    let t: Vec3 = [q[0] - o[0], q[1] - o[1], q[2] - o[2]]
    const tl = Math.hypot(...t) || 1
    t = [t[0] / tl, t[1] / tl, t[2] / tl]
    // side = t x (0,0,1), up = side x t
    let side: Vec3 = [t[1], -t[0], 0]
    const sl = Math.hypot(...side) || 1
    side = [side[0] / sl, side[1] / sl, 0]
    const up: Vec3 = [
      side[1] * t[2] - side[2] * t[1],
      side[2] * t[0] - side[0] * t[2],
      side[0] * t[1] - side[1] * t[0],
    ]
    const r = radiusAt(s / segs)
    for (let k = 0; k < radial; k++) {
      const ang = (k / radial) * TAU
      const nx = Math.cos(ang) * side[0] + Math.sin(ang) * up[0]
      const ny = Math.cos(ang) * side[1] + Math.sin(ang) * up[1]
      const nz = Math.cos(ang) * side[2] + Math.sin(ang) * up[2]
      positions.push(p[0] + nx * r, p[1] + ny * r, p[2] + nz * r)
      normals.push(nx, ny, nz)
    }
  }
  for (let s = 0; s < segs; s++) {
    for (let k = 0; k < radial; k++) {
      const k1 = (k + 1) % radial
      const a0 = s * radial + k
      const a1 = s * radial + k1
      const b0 = (s + 1) * radial + k
      const b1 = (s + 1) * radial + k1
      indices.push(a0, b0, b1, a0, b1, a1)
    }
  }
  return { positions, indices, normals }
}

/** The part of the face covered by the painted-detail patch (head-centre coordinates). */
export const FACE_PATCH = { xMin: -0.066, xMax: 0.066, yMin: -0.1, yMax: 0.07, lift: 0.0012 } as const

/**
 * A thin skin-shaped sheet just in front of the face, UV-mapped as a plain rectangle in
 * (x, y). A transparent painted texture (blush, eyeshadow, brows, lips) goes on it, so the
 * face detail is soft and anti-aliased instead of being built from tubes.
 */
export function facePatchMesh(cols = 44, rows = 56): MeshData {
  const { xMin, xMax, yMin, yMax, lift } = FACE_PATCH
  const { rx, ry, rz } = HEAD.skin
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const u = i / cols
      const v = j / rows
      let x = xMin + u * (xMax - xMin)
      let y = yMin + v * (yMax - yMin)
      // Keep every vertex on the front of the skin ellipsoid (corners are transparent anyway).
      const e = Math.hypot(x / rx, y / ry)
      if (e > 0.96) {
        x *= 0.96 / e
        y *= 0.96 / e
      }
      const z = skinZ(x, y)
      let nx = x / (rx * rx)
      let ny = y / (ry * ry)
      let nz = z / (rz * rz)
      const nl = Math.hypot(nx, ny, nz)
      nx /= nl
      ny /= nl
      nz /= nl
      positions.push(x + nx * lift, y + ny * lift, z + nz * lift)
      normals.push(nx, ny, nz)
      uvs.push(u, v)
    }
  }
  const stride = cols + 1
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a0 = j * stride + i
      const a1 = a0 + 1
      const b0 = a0 + stride
      const b1 = b0 + 1
      indices.push(a0, a1, b1, a0, b1, b0)
    }
  }
  return { positions, indices, uvs, normals }
}
