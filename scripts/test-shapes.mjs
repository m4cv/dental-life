// Geometry sanity checks for the character shapes (runs on plain Node 22.18+).
import {
  HEAD, COAT_RINGS, COAT_SPLIT_Y, coatMesh, coatImplicit, coatFrontZ, hijabShellMesh, hijabDrapeMesh,
  drapeRing, drapeHem, decalMesh, rectPoly, LAPEL_POLY, V_NECK_POLY, mirrorPoly, strapPath, ribbonMesh, coatNormal,
  skinZ, shellZ,
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

if (failures) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nAll shape checks passed')
