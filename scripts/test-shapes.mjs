// Geometry sanity checks for the character shapes (runs on plain Node 22.18+).
import {
  HEAD, COAT_RINGS, COAT_SPLIT_Y, coatMesh, coatImplicit, coatFrontZ, hijabShellMesh, hijabDrapeMesh,
  drapeRing, drapeHem, decalMesh, rectPoly, LAPEL_POLY, V_NECK_POLY, mirrorPoly, strapPath, ribbonMesh, coatNormal,
  skinZ, shellZ, EYE, FACE_PATCH, eyePoint, lashLine, irisCapMesh, taperTubeMesh, facePatchMesh,
} from '../src/character/charShapes.ts'

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures += 1
}

const finite = (m) => m.positions.every(Number.isFinite) && m.indices.every((i) => i >= 0 && i < m.positions.length / 3)

/** Share of triangles whose normal points away from `center(p)`. */
function outwardShare(m, center) {
  let good = 0, total = 0
  const P = m.positions
  for (let t = 0; t < m.indices.length; t += 3) {
    const [a, b, c] = [m.indices[t], m.indices[t + 1], m.indices[t + 2]].map((i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]])
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    const len = Math.hypot(...n)
    if (len < 1e-12) continue
    const g = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]
    const o = center(g)
    total++
    if (n[0] * (g[0] - o[0]) + n[1] * (g[1] - o[1]) + n[2] * (g[2] - o[2]) > 0) good++
  }
  return total ? good / total : 0
}

// --- coat -------------------------------------------------------------------------------------
const torso = coatMesh(COAT_SPLIT_Y, COAT_RINGS.at(-1).y)
const skirt = coatMesh(COAT_RINGS[0].y, COAT_SPLIT_Y)
check('coat meshes are well-formed', finite(torso) && finite(skirt))
const coatCenter = (g) => { const r = COAT_RINGS.reduce((p, q) => (Math.abs(q.y - g[1]) < Math.abs(p.y - g[1]) ? q : p)); return [0, g[1], r.cz] }
check('coat faces outward', outwardShare(torso, coatCenter) > 0.99 && outwardShare(skirt, coatCenter) > 0.99,
  `${(outwardShare(torso, coatCenter) * 100).toFixed(1)} % / ${(outwardShare(skirt, coatCenter) * 100).toFixed(1)} %`)
{
  // analytic normals: unit length, outward, and identical on both halves at the waist ring
  const nOk = (m) => m.normals && m.normals.length === (m.positions.length) && Array.from({ length: m.normals.length / 3 }, (_, k) => Math.hypot(m.normals[k * 3], m.normals[k * 3 + 1], m.normals[k * 3 + 2])).every((l) => Math.abs(l - 1) < 1e-6)
  check('coat normals are unit length', nOk(torso) && nOk(skirt))
  const cols = 48
  let worst = 0
  for (let j = 0; j < cols; j++) {
    const a = torso.normals.slice(j * 3, j * 3 + 3)
    const rows = skirt.positions.length / 3 / cols - 1
    const b = skirt.normals.slice((rows * cols + j) * 3, (rows * cols + j) * 3 + 3)
    worst = Math.max(worst, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]))
  }
  check('torso and hem normals match at the waist (no seam)', worst < 1e-9, `max diff ${worst.toExponential(1)}`)
}
check('coat parts meet at the waist', Math.abs(torso.positions[1] - COAT_SPLIT_Y) < 1e-9 && Math.abs(skirt.positions[skirt.positions.length - 2] - COAT_SPLIT_Y) < 1e-9)

// --- hijab shell ------------------------------------------------------------------------------
const shell = hijabShellMesh()
check('hijab shell is well-formed', finite(shell))
check('hijab shell faces outward', outwardShare(shell, () => [0, 0, 0]) > 0.98, `${(outwardShare(shell, () => [0, 0, 0]) * 100).toFixed(1)} %`)
{
  // Every vertex must sit on the shell ellipsoid, and the rim must be the window oval.
  const { rx, ry, rz } = HEAD.shell
  let worst = 0
  for (let i = 0; i < shell.positions.length; i += 3) {
    const [x, y, z] = shell.positions.slice(i, i + 3)
    worst = Math.max(worst, Math.abs((x / rx) ** 2 + (y / ry) ** 2 + (z / rz) ** 2 - 1))
  }
  check('shell vertices lie on the ellipsoid', worst < 1e-6, `max error ${worst.toExponential(1)}`)
  const w = HEAD.window
  let rimErr = 0
  for (let j = 0; j < 64; j++) {
    const [x, y] = shell.positions.slice(j * 3, j * 3 + 2)
    rimErr = Math.max(rimErr, Math.abs((x / w.ax) ** 2 + ((y - w.cy) / w.ay) ** 2 - 1))
  }
  check('rim row is the face window oval', rimErr < 1e-6)
  const wx = HEAD.window.ax
  check('window stays inside the skin silhouette width', wx < HEAD.skin.rx)
}

// --- hijab drape ------------------------------------------------------------------------------
const drape = hijabDrapeMesh()
check('hijab drape is well-formed', finite(drape))
check('hijab drape faces outward', outwardShare(drape, (g) => { const r = drapeRing(g[1]); return [0, g[1], (r.front + r.back) / 2] }) > 0.97)
{
  // Clearance from the coat for every drape vertex below the neck: must be outside the coat.
  let minImplicit = Infinity, minY = Infinity
  for (let i = 0; i < drape.positions.length; i += 3) {
    const [x, y, z] = drape.positions.slice(i, i + 3)
    minY = Math.min(minY, y)
    if (y < 1.385) minImplicit = Math.min(minImplicit, coatImplicit(x, y, z))
  }
  check('drape never sinks into the coat', minImplicit > 1.05, `min ellipse value ${minImplicit.toFixed(3)}`)
  check('drape hem stays above the pocket', minY > 1.1, `lowest ${minY.toFixed(3)} m`)
  let hemMin = Infinity, hemMax = -Infinity
  for (let k = 0; k < 360; k++) { const h = drapeHem((k / 360) * Math.PI * 2); hemMin = Math.min(hemMin, h); hemMax = Math.max(hemMax, h) }
  check('hem varies 1.10–1.30 m', hemMin > 1.1 && hemMax < 1.3, `${hemMin.toFixed(3)}–${hemMax.toFixed(3)}`)
  // The chin must stay uncovered: drape front is behind the skin from just above the chin upward.
  let covers = 0
  for (const y of [1.44, 1.46, 1.48, 1.5]) {
    const skinFront = HEAD.centerZ + skinZ(0, y - HEAD.centerY)
    if (drapeRing(y).front >= skinFront) covers++
  }
  check('drape does not cover the lower face', covers === 0)
}

// --- decals -----------------------------------------------------------------------------------
{
  const polys = {
    pocket: rectPoly(-0.1, 1.135, 0.09, 0.095),
    lapelL: LAPEL_POLY, lapelR: mirrorPoly(LAPEL_POLY), vneck: V_NECK_POLY, placket: rectPoly(0, 0.87, 0.044, 0.6),
  }
  for (const [name, poly] of Object.entries(polys)) {
    const m = decalMesh(poly, 0.004)
    const used = new Set(m.indices)
    let minI = Infinity
    for (const i of used) minI = Math.min(minI, coatImplicit(m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]))
    check(`decal "${name}" has area and sits on the coat`, finite(m) && m.indices.length > 12 && minI > 1.0, `${m.indices.length / 3} tris, min ${minI.toFixed(3)}`)
    check(`decal "${name}" faces front`, outwardShare(m, (g) => [0, g[1], 0]) > 0.97)
  }
  check('coatFrontZ is increasing toward the centre', coatFrontZ(0, 1.2) > coatFrontZ(0.1, 1.2))
}

// --- strap ------------------------------------------------------------------------------------
{
  const path = strapPath()
  const ribbon = ribbonMesh(path, coatNormal, 0.028)
  check('strap ribbon is well-formed', finite(ribbon) && path.length > 50)
  let minI = Infinity
  for (const p of path.slice(4, -4)) if (p[1] < 1.34) minI = Math.min(minI, coatImplicit(...p))
  check('strap lies on or outside the coat', minI > 1.0, `min ${minI.toFixed(3)}`)
  let longest = 0
  for (let i = 1; i < path.length; i++) longest = Math.max(longest, Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1], path[i][2] - path[i - 1][2]))
  check('strap path has no jumps', longest < 0.05, `longest step ${(longest * 100).toFixed(1)} cm`)
}

// --- face -------------------------------------------------------------------------------------
check('skin sits inside the shell at the rim', skinZ(0.04, 0.05) < shellZ(0.04, 0.05))
{
  const w = HEAD.window
  // eyes sit fully inside the face window, clear of the rim tube (radius 6.2 mm)
  const inside = (x, y) => (x / w.ax) ** 2 + ((y - w.cy) / w.ay) ** 2
  let worst = 0
  for (const u of [-EYE.a, EYE.a]) {
    for (const side of [1, -1]) {
      const [x, y] = eyePoint(u * 0.97, 0, side)
      worst = Math.max(worst, inside(x, y))
    }
  }
  check('eye corners clear the hijab rim', worst < 0.74, `corner at ${(Math.sqrt(worst) * 100).toFixed(0)} % of the window radius`)
  const lash = lashLine()
  const maxIn = Math.max(...lash.map(([x, y]) => inside(x, y)))
  check('eyeliner stays inside the window', maxIn < 0.85, `${(Math.sqrt(maxIn) * 100).toFixed(0)} %`)
  const [ix] = eyePoint(-EYE.a, 0, 1)
  check('eyes are apart by about one eye width', 2 * ix > 0.7 * 2 * EYE.a && 2 * ix < 1.3 * 2 * EYE.a, `gap ${(2 * ix * 1000).toFixed(0)} mm, eye ${(2 * EYE.a * 1000).toFixed(0)} mm`)
  check('outer eye corner is higher than the inner one', eyePoint(EYE.a, 0, 1)[1] > eyePoint(-EYE.a, 0, 1)[1])
}
{
  const cap = irisCapMesh()
  check('iris cap is well-formed', finite(cap) && cap.uvs.length / 2 === cap.positions.length / 3)
  let zOK = true, worstGap = 0
  for (let i = 0; i < cap.positions.length; i += 3) {
    const [x, y, z] = cap.positions.slice(i, i + 3)
    const surface = EYE.c * Math.sqrt(Math.max(1 - (x / EYE.a) ** 2 - (y / EYE.b) ** 2, 0))
    const gap = z - surface
    worstGap = Math.max(worstGap, gap)
    if (gap <= 0 || gap > 0.0004) zOK = false
  }
  check('iris cap sits 0–0.4 mm above the eyeball', zOK, `max ${(worstGap * 1000).toFixed(2)} mm`)
  let uvOK = true
  for (let i = 0; i < cap.uvs.length; i += 2) if (Math.hypot(cap.uvs[i] - 0.5, cap.uvs[i + 1] - 0.5) > 0.5001) uvOK = false
  check('iris uvs stay inside the disc', uvOK)
  let front = 0, tris = 0
  for (let q = 0; q < cap.indices.length; q += 3) {
    const [i, j, k] = [cap.indices[q], cap.indices[q + 1], cap.indices[q + 2]]
    const P = (n) => cap.positions.slice(n * 3, n * 3 + 3)
    const [A, B, C] = [P(i), P(j), P(k)]
    const nz = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0])
    if (Math.abs(nz) > 1e-15) { tris++; if (nz > 0) front++ }
  }
  check('iris cap triangles face the front (+z)', front === tris && tris > 100, `${front}/${tris}`)
  check('iris fits inside the visible eye opening', EYE.irisR < EYE.b * Math.sqrt(1 - (0.002 / EYE.c) ** 2) * 0.95)
}
{
  const pts = lashLine().map(([x, y]) => [x, y, 0.1])
  const tube = taperTubeMesh(pts, (t) => 0.001 + 0.002 * Math.sin(Math.PI * t), 28, 6)
  check('eyeliner tube is well-formed', finite(tube) && tube.normals.length === tube.positions.length)
  let unit = true
  for (let i = 0; i < tube.normals.length; i += 3) if (Math.abs(Math.hypot(tube.normals[i], tube.normals[i + 1], tube.normals[i + 2]) - 1) > 1e-6) unit = false
  check('eyeliner normals are unit length', unit)
}
{
  const patch = facePatchMesh()
  check('face patch is well-formed', finite(patch) && patch.uvs.length / 2 === patch.positions.length / 3)
  let minGap = Infinity, maxGap = -Infinity, inWin = true
  const { rx, ry, rz } = HEAD.skin
  for (let i = 0; i < patch.positions.length; i += 3) {
    const [x, y, z] = patch.positions.slice(i, i + 3)
    const e = Math.sqrt((x / rx) ** 2 + (y / ry) ** 2 + (z / rz) ** 2)
    // distance above the skin ellipsoid, approximated along the radial direction
    const gap = (e - 1) * Math.min(rx, ry, rz)
    minGap = Math.min(minGap, gap); maxGap = Math.max(maxGap, gap)
  }
  check('face patch floats 0.5–2.5 mm above the skin', minGap > 0.0004 && maxGap < 0.0025, `${(minGap * 1000).toFixed(2)}–${(maxGap * 1000).toFixed(2)} mm`)
  check('face patch uv covers the whole sheet', patch.uvs[0] === 0 && patch.uvs[patch.uvs.length - 1] === 1)
  check('face patch faces the camera', outwardShare(patch, () => [0, 0, 0]) > 0.97)
  check('face patch spans the face window', FACE_PATCH.xMax >= HEAD.window.ax && FACE_PATCH.yMax > HEAD.window.cy)
}

if (failures) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nAll shape checks passed')
