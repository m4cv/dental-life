// Builds the whole home as a handful of merged meshes (see sceneBuilder.ts). Three.js only.
// What it draws follows the photographs; where the photographs say nothing (the bathroom, the
// bedroom floor, the porch) it uses plain, neutral stand-ins, and the report says so.
import { BoxGeometry, DoubleSide, Group, Material, Mesh, MeshStandardMaterial, PlaneGeometry, SphereGeometry, Texture } from 'three'
import { Batch, pleatedSheet, type V3 } from './sceneBuilder'
import {
  blackMarbleTexture, comforterTexture, darkWoodTexture, floorTileTexture, tvScreenTexture, whiteMarbleTexture,
} from './homeTextures'
import { CEILING_Y, FRONT_DOOR, PORCH, ROOMS, WALL_PIECES } from './homeLayout'

/** Where the pink notebook lies on the dining table (it disappears when it is packed). */
export const NOTEBOOK: { pos: V3; rotY: number } = { pos: [3.15, 0.785, -8.5], rotY: 0.25 }

function std(color: string, roughness = 0.9, metalness = 0): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness, metalness })
}
function glow(color: string, emissive: string, intensity: number): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, roughness: 0.6 })
}

function materials() {
  const marbleWhite = whiteMarbleTexture()
  const screen = tvScreenTexture()
  return {
    plaster: std('#e0dacd', 0.95),
    greyWall: std('#8b8684', 0.95),
    ceiling: std('#f1eee6', 1),
    beam: std('#e8e4da', 0.95),
    trim: std('#efece6', 0.7),
    tileDark: new MeshStandardMaterial({ map: floorTileTexture(), roughness: 0.3, metalness: 0.05 }),
    floorBed: std('#cdc3b3', 0.55),
    floorBath: std('#d9dede', 0.3),
    concrete: std('#bdb5a6', 0.95),
    sand: std('#cdbb94', 1),
    doorWood: new MeshStandardMaterial({ map: darkWoodTexture(), roughness: 0.6 }),
    marbleBlack: new MeshStandardMaterial({ map: blackMarbleTexture(), roughness: 0.18, metalness: 0.1 }),
    marbleWhite: new MeshStandardMaterial({ map: marbleWhite, roughness: 0.2 }),
    tv: new MeshStandardMaterial({ color: '#111113', roughness: 0.4 }),
    tvScreen: new MeshStandardMaterial({ map: screen, emissive: '#ffffff', emissiveMap: screen, emissiveIntensity: 0.85, roughness: 0.3 }),
    sofa: std('#b4b3b8', 0.95),
    burgundy: std('#6a1d2b', 0.9),
    cushionBlack: std('#1b191c', 0.9),
    cream: std('#e9e2d2', 0.8),
    glassDark: std('#15181b', 0.12, 0.2),
    black: std('#17171a', 0.45, 0.5),
    whiteGloss: std('#f1efe9', 0.25),
    chair: std('#a4b3bf', 0.9),
    curtainTaupe: new MeshStandardMaterial({ color: '#9c9189', roughness: 0.95, side: DoubleSide }),
    curtainChampagne: new MeshStandardMaterial({ color: '#b9a98c', roughness: 0.6, side: DoubleSide }),
    camel: std('#c6a273', 0.95),
    camelDark: std('#b38d5c', 0.95),
    comforter: new MeshStandardMaterial({ map: comforterTexture(), roughness: 0.95 }),
    sheet: std('#e6ebe6', 0.95),
    pillowPurple: std('#8c7aa0', 0.95),
    pillowGrey: std('#a9a5a8', 0.95),
    pink: std('#e9a9b8', 0.7),
    pinkDeep: std('#d77f9a', 0.7),
    pampas: std('#f0c9d0', 1),
    teddy: std('#8a5a3a', 1),
    mint: glow('#58c2b2', '#58c2b2', 0.35),
    led: glow('#fff6e6', '#fff1d6', 1.6),
    warm: glow('#ffe2b0', '#ffc878', 1.4),
    shade: glow('#f6c7d3', '#f4a9bf', 0.55),
    crystal: glow('#fff4d6', '#ffe6b0', 1.1),
    gold: std('#c9a24a', 0.35, 0.8),
    ac: std('#f4f4f2', 0.5),
    fan: std('#f1efe9', 0.6),
    mirror: std('#b7c5cc', 0.06, 0.6),
    chrome: std('#c9ced2', 0.2, 0.9),
    rose: std('#b3243a', 0.8),
    foliage: std('#5d7a45', 0.95),
    trunk: std('#6b4f35', 0.95),
    brass: std('#b99a54', 0.4, 0.7),
    blue: std('#7f9bc2', 0.7),
    perfumeA: std('#e4b86a', 0.2),
    perfumeB: std('#e8a1b4', 0.2),
    perfumeC: std('#9d89c4', 0.2),
    perfumeD: std('#f1ecd8', 0.2),
    glassPane: new MeshStandardMaterial({ color: '#bfe3f5', transparent: true, opacity: 0.28, roughness: 0.05, side: DoubleSide }),
    doorPanel: std('#4b3022', 0.55),
    glassShelf: new MeshStandardMaterial({ color: '#d7efe9', transparent: true, opacity: 0.4, roughness: 0.05 }),
  }
}
type Mats = ReturnType<typeof materials>

// ---------------------------------------------------------------------------------------------

function shell(b: Batch, m: Mats): void {
  // walls
  for (const p of WALL_PIECES) {
    b.box(m.plaster, [p.sx, p.y1 - p.y0, p.sz], [p.x, (p.y0 + p.y1) / 2, p.z], undefined, false)
  }
  // floors and ceilings, one per room
  for (const r of ROOMS) {
    const w = r.x1 - r.x0 + 0.2
    const d = r.z1 - r.z0 + 0.2
    const cx = (r.x0 + r.x1) / 2
    const cz = (r.z0 + r.z1) / 2
    const floor = r.id === 'living' || r.id === 'dining' ? m.tileDark : r.id === 'bedroom' ? m.floorBed : m.floorBath
    const tiled = floor === m.tileDark
    b.plane(floor, w, d, [cx, 0, cz], [-Math.PI / 2, 0, 0], tiled ? [w / 1.2, d / 1.2] : [1, 1])
    b.plane(m.ceiling, w, d, [cx, CEILING_Y, cz], [Math.PI / 2, 0, 0])
  }
  // exposed painted beams in the bedroom ceiling
  const bed = ROOMS.find((r) => r.id === 'bedroom')
  if (bed) for (const z of [-3.5, -4.7, -5.9]) b.box(m.beam, [bed.x1 - bed.x0, 0.3, 0.2], [(bed.x0 + bed.x1) / 2, CEILING_Y - 0.15, z], undefined, false)
  // plinth under the whole house, so no gap shows between the walls and the ground
  b.box(m.concrete, [7.2, 0.09, 9.2], [3.5, -0.055, -4.5], undefined, false)
  // porch and ground
  b.plane(m.sand, 300, 300, [2.5, -0.1, -4], [-Math.PI / 2, 0, 0])
  b.box(m.concrete, [PORCH.x1 - PORCH.x0, 0.1, PORCH.z1 - PORCH.z0], [(PORCH.x0 + PORCH.x1) / 2, -0.05, (PORCH.z0 + PORCH.z1) / 2], undefined, false)
  for (const x of [PORCH.x0, PORCH.x1]) b.box(m.plaster, [PORCH.wallT, PORCH.wallHeight, PORCH.z1 - PORCH.z0], [x, PORCH.wallHeight / 2, (PORCH.z0 + PORCH.z1) / 2])
}

/** Door frames, leaves standing open against the wall, and window frames. */
function openings(b: Batch, m: Mats): void {
  const jambs = (cx: number, cz: number, alongX: boolean, w: number, h: number, mat: MeshStandardMaterial) => {
    const t = 0.06
    if (alongX) {
      b.box(mat, [t, h, 0.26], [cx - w / 2 - t / 2, h / 2, cz], undefined, false)
      b.box(mat, [t, h, 0.26], [cx + w / 2 + t / 2, h / 2, cz], undefined, false)
      b.box(mat, [w + 2 * t, t, 0.26], [cx, h + t / 2, cz], undefined, false)
    } else {
      b.box(mat, [0.26, h, t], [cx, h / 2, cz - w / 2 - t / 2], undefined, false)
      b.box(mat, [0.26, h, t], [cx, h / 2, cz + w / 2 + t / 2], undefined, false)
      b.box(mat, [0.26, t, w + 2 * t], [cx, h + t / 2, cz], undefined, false)
    }
  }
  jambs(FRONT_DOOR.x, FRONT_DOOR.z, true, FRONT_DOOR.w, FRONT_DOOR.h, m.doorWood)
  jambs(3.5, -4.9, false, 1.0, 2.2, m.doorWood)
  jambs(5.5, -8.0, false, 0.9, 2.1, m.doorWood)
  jambs(2.75, -6.5, true, 1.1, 2.3, m.trim)

  // interior door leaves, swung open flat against the wall (decoration: the doorway stays clear)
  b.box(m.doorWood, [0.045, 2.1, 0.92], [3.63, 1.05, -3.94])
  b.sphere(m.brass, 0.025, [3.67, 1.0, -4.3], 8)
  b.box(m.doorWood, [0.045, 2.0, 0.86], [5.63, 1.0, -7.1])
  b.sphere(m.brass, 0.025, [5.67, 1.0, -7.5], 8)

  // living-room window: dark wood frame with a mullion
  const fx = 1.1
  const fz = -6.5
  for (const [sx, sy, px, py] of [
    [0.9, 0.05, fx, 2.225],
    [0.9, 0.05, fx, 1.3],
    [0.05, 0.95, fx - 0.4, 1.76],
    [0.05, 0.95, fx + 0.4, 1.76],
    [0.03, 0.9, fx, 1.76],
  ] as const) b.box(m.doorWood, [sx, sy, 0.16], [px, py, fz], undefined, false)
  // bedroom and dining windows: white frames
  for (const [sx, sy, sz, px, py, pz] of [
    [0.06, 1.46, 0.16, 7.1, 1.6, -3.4],
    [0.06, 1.46, 0.16, 7.1, 1.6, -5.0],
    [0.06, 0.06, 1.66, 7.1, 0.9, -4.2],
    [0.06, 0.06, 1.66, 7.1, 2.3, -4.2],
    [0.06, 1.36, 0.16, 3.0, 1.55, -9.1],
    [0.06, 1.36, 0.16, 4.4, 1.55, -9.1],
  ] as const) b.box(m.trim, [sx, sy, sz], [px, py, pz], undefined, false)
  b.box(m.trim, [1.46, 0.06, 0.16], [3.7, 0.9, -9.1], undefined, false)
  b.box(m.trim, [1.46, 0.06, 0.16], [3.7, 2.2, -9.1], undefined, false)
}

function livingRoom(b: Batch, m: Mats): void {
  // black stone television wall, the television, a console with flowers, a warm wall light
  b.box(m.marbleBlack, [0.04, CEILING_Y, 3.3], [3.38, CEILING_Y / 2, -2.65], undefined, false)
  b.box(m.tv, [0.05, 0.72, 1.25], [3.33, 1.45, -2.7])
  b.plane(m.tvScreen, 1.15, 0.64, [3.303, 1.45, -2.7], [0, -Math.PI / 2, 0])
  b.box(m.glassDark, [0.38, 0.45, 1.6], [3.2, 0.225, -2.7])
  b.box(m.whiteGloss, [0.2, 0.14, 0.14], [3.2, 0.52, -3.25], [0, 0.2, 0])
  b.cyl(m.cream, 0.06, 0.05, 0.2, [3.2, 0.55, -2.05], 12)
  for (const [dx, dy, dz] of [[0, 0.17, 0], [0.04, 0.14, 0.04], [-0.04, 0.15, -0.03], [0.02, 0.19, -0.04], [-0.03, 0.12, 0.05]] as const) {
    b.sphere(m.rose, 0.045, [3.2 + dx, 0.65 + dy, -2.05 + dz], 8)
  }
  b.box(m.black, [0.06, 0.14, 0.1], [3.34, 2.15, -4.1])
  b.sphere(m.warm, 0.05, [3.3, 2.15, -4.1], 8)

  // long grey velvet sofa on the west wall with bolster arms and burgundy / black cushions
  b.box(m.sofa, [0.95, 0.4, 4.3], [0.475, 0.22, -3.15])
  b.box(m.sofa, [0.72, 0.12, 4.12], [0.6, 0.46, -3.15])
  b.box(m.sofa, [0.22, 0.6, 4.3], [0.11, 0.78, -3.15])
  b.box(m.sofa, [0.8, 0.34, 0.3], [0.5, 0.62, -1.15])
  b.box(m.sofa, [0.8, 0.34, 0.3], [0.5, 0.62, -5.15])
  for (const [z, mat, ry] of [
    [-1.75, m.burgundy, 0.15],
    [-2.35, m.cushionBlack, -0.1],
    [-3.05, m.burgundy, 0.2],
    [-4.25, m.cushionBlack, -0.15],
    [-4.8, m.burgundy, 0.1],
  ] as const) b.box(mat, [0.16, 0.36, 0.42], [0.3, 0.74, z], [0, ry, 0])

  // armchair under the window
  b.box(m.sofa, [0.9, 0.4, 0.84], [1.3, 0.22, -5.95])
  b.box(m.sofa, [0.7, 0.12, 0.7], [1.3, 0.46, -5.88])
  b.box(m.sofa, [0.9, 0.55, 0.18], [1.3, 0.78, -6.28])
  b.box(m.sofa, [0.14, 0.3, 0.7], [0.88, 0.58, -5.9])
  b.box(m.sofa, [0.14, 0.3, 0.7], [1.72, 0.58, -5.9])
  b.box(m.cream, [0.38, 0.3, 0.1], [1.1, 0.75, -6.15], [0, 0.2, -0.2])
  b.box(m.burgundy, [0.3, 0.3, 0.1], [1.5, 0.74, -6.15], [0, -0.2, 0.15])

  // artificial olive plant
  b.cyl(m.cream, 0.17, 0.14, 0.35, [0.28, 0.175, -6.12], 14)
  b.cyl(m.trunk, 0.02, 0.025, 0.9, [0.28, 0.75, -6.12], 6)
  for (const [dx, dy, dz, r] of [[0, 1.25, 0, 0.22], [-0.12, 1.02, 0.06, 0.17], [0.13, 1.08, -0.05, 0.17], [0, 0.88, 0.1, 0.14]] as const) {
    b.sphere(m.foliage, r, [0.28 + dx, dy, -6.12 + dz], 10)
  }

  // glass coffee table on black legs with a couple of books
  b.box(m.glassDark, [0.9, 0.03, 0.6], [1.65, 0.42, -3.5])
  b.box(m.glassDark, [0.84, 0.02, 0.54], [1.65, 0.17, -3.5])
  for (const [dx, dz] of [[-0.4, -0.25], [0.4, -0.25], [-0.4, 0.25], [0.4, 0.25]] as const) b.cyl(m.black, 0.015, 0.015, 0.42, [1.65 + dx, 0.21, -3.5 + dz], 6)
  b.box(m.cream, [0.22, 0.03, 0.16], [1.5, 0.45, -3.5], [0, 0.3, 0])
  b.box(m.blue, [0.2, 0.025, 0.14], [1.5, 0.48, -3.5], [0, 0.1, 0])

  // chandelier and ceiling fan
  b.cyl(m.black, 0.008, 0.008, 0.45, [1.7, 2.675, -3.2], 5, undefined, false)
  b.cyl(m.crystal, 0.1, 0.24, 0.28, [1.7, 2.3, -3.2], 16, undefined, false)
  b.torus(m.gold, 0.25, 0.015, [1.7, 2.17, -3.2], [Math.PI / 2, 0, 0])
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2
    b.sphere(m.crystal, 0.03, [1.7 + Math.cos(a) * 0.27, 2.12, -3.2 + Math.sin(a) * 0.27], 6, undefined, false)
  }
  b.cyl(m.fan, 0.015, 0.015, 0.15, [1.7, 2.82, -4.9], 6, undefined, false)
  b.cyl(m.fan, 0.08, 0.08, 0.1, [1.7, 2.72, -4.9], 12, undefined, false)
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2
    b.box(m.fan, [0.6, 0.012, 0.13], [1.7 + Math.cos(a) * 0.38, 2.7, -4.9 - Math.sin(a) * 0.38], [0, a, 0], false)
  }
  // split air-conditioner above the window
  b.box(m.ac, [1.0, 0.3, 0.22], [1.1, 2.5, -6.29], undefined, false)
  b.box(m.trim, [1.0, 0.04, 0.2], [1.1, 2.38, -6.28], undefined, false)
}

function diningArea(b: Batch, m: Mats): void {
  // white marble table on two slab legs, three blue-grey chairs on the near side
  b.box(m.marbleWhite, [1.6, 0.05, 0.86], [3.7, 0.74, -8.45])
  for (const x of [3.05, 4.35]) b.box(m.whiteGloss, [0.08, 0.72, 0.7], [x, 0.36, -8.45])
  for (const x of [3.1, 3.7, 4.3]) {
    b.box(m.chair, [0.42, 0.06, 0.42], [x, 0.46, -7.62])
    b.box(m.chair, [0.42, 0.44, 0.05], [x, 0.72, -7.42])
    for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]] as const) b.cyl(m.black, 0.014, 0.014, 0.44, [x + dx, 0.22, -7.62 + dz], 6)
  }
  // three white cups with a gold band on saucers, salt and oil bottles, a pink cloth
  for (const [x, z] of [[4.05, -8.3], [4.2, -8.5], [4.0, -8.65]] as const) {
    b.cyl(m.whiteGloss, 0.07, 0.07, 0.012, [x, 0.77, z], 14)
    b.cyl(m.whiteGloss, 0.04, 0.035, 0.09, [x, 0.82, z], 12)
    b.cyl(m.gold, 0.041, 0.041, 0.012, [x, 0.84, z], 12)
  }
  for (const x of [3.85, 4.0]) {
    b.cyl(m.sheet, 0.022, 0.022, 0.15, [x, 0.84, -8.8], 8)
    b.cyl(m.black, 0.024, 0.024, 0.03, [x, 0.93, -8.8], 8)
  }
  b.box(m.pink, [0.3, 0.008, 0.2], [3.5, 0.768, -8.75], [0, -0.2, 0])
  // pendant disc light and the window curtain
  b.cyl(m.led, 0.2, 0.2, 0.04, [3.7, 2.88, -7.8], 20, undefined, false)
  b.add(m.curtainTaupe, pleatedSheet(1.9, 2.75, 6, 0.045), [3.7, 1.4, -8.93], [0, 0, 0], false)
}

function bedroom(b: Batch, m: Mats): void {
  // queen bed, headboard against the curtained east wall
  b.box(m.sheet, [1.88, 0.28, 1.64], [5.99, 0.14, -4.2])
  b.box(m.sheet, [1.86, 0.2, 1.6], [5.98, 0.38, -4.2])
  b.box(m.comforter, [1.45, 0.07, 1.66], [5.75, 0.51, -4.2])
  b.box(m.comforter, [1.45, 0.24, 0.04], [5.75, 0.39, -4.2 - 0.83])
  b.box(m.comforter, [1.45, 0.24, 0.04], [5.75, 0.39, -4.2 + 0.83])
  b.box(m.comforter, [0.04, 0.24, 1.66], [5.04, 0.39, -4.2])
  b.box(m.camel, [0.12, 1.2, 1.75], [6.94, 0.72, -4.2])
  for (const dz of [-0.57, 0, 0.57]) b.box(m.camelDark, [0.03, 1.02, 0.5], [6.865, 0.74, -4.2 + dz])
  b.box(m.pillowPurple, [0.3, 0.13, 0.52], [6.62, 0.6, -4.7], [0, 0.08, 0])
  b.box(m.pillowGrey, [0.3, 0.13, 0.5], [6.62, 0.6, -3.7], [0, -0.06, 0])
  // teddy bear
  b.sphere(m.teddy, 0.12, [6.45, 0.66, -3.35], 10)
  b.sphere(m.teddy, 0.085, [6.45, 0.82, -3.35], 10)
  for (const dz of [-0.06, 0.06]) b.sphere(m.teddy, 0.03, [6.45, 0.89, -3.35 + dz], 6)
  // white nightstand with a pink pleated lamp and tulips
  b.box(m.whiteGloss, [0.44, 0.5, 0.4], [6.7, 0.25, -5.25])
  b.box(m.black, [0.01, 0.05, 0.2], [6.48, 0.3, -5.25])
  b.cyl(m.pink, 0.05, 0.06, 0.18, [6.62, 0.59, -5.25], 10)
  b.cyl(m.shade, 0.08, 0.14, 0.17, [6.62, 0.78, -5.25], 14)
  b.cyl(m.whiteGloss, 0.04, 0.05, 0.1, [6.78, 0.55, -5.2], 10)
  for (const dz of [-0.02, 0.02]) b.sphere(m.pinkDeep, 0.03, [6.78, 0.66, -5.2 + dz], 8)
  // dresser with a round back-lit mirror and glass display cabinet of perfumes
  b.box(m.whiteGloss, [1.3, 0.78, 0.46], [5.2, 0.39, -6.17])
  for (const dx of [-0.32, 0.32]) b.box(m.black, [0.5, 0.01, 0.01], [5.2 + dx, 0.55, -5.93])
  b.cyl(m.mirror, 0.45, 0.45, 0.02, [5.2, 1.5, -6.385], 40, [Math.PI / 2, 0, 0], false)
  b.torus(m.led, 0.465, 0.014, [5.2, 1.5, -6.37], [0, 0, 0])
  b.cyl(m.pampas, 0.01, 0.02, 0.5, [4.7, 1.03, -6.25], 6)
  b.cyl(m.pampas, 0.01, 0.02, 0.4, [4.74, 0.98, -6.2], 6)
  b.cyl(m.pink, 0.02, 0.025, 0.3, [4.9, 0.93, -6.3], 6)
  b.cyl(m.pinkDeep, 0.05, 0.05, 0.07, [5.7, 0.82, -6.2], 10)
  b.cyl(m.pink, 0.1, 0.1, 0.012, [5.35, 0.79, -6.0], 14)
  b.box(m.ac, [1.0, 0.3, 0.22], [4.6, 2.5, -6.29], undefined, false)
  // glass cabinet: mint frame, light, shelves with perfume bottles
  b.box(m.mint, [0.6, 0.03, 0.3], [6.35, 1.7, -6.25])
  b.box(m.mint, [0.03, 1.7, 0.3], [6.065, 0.85, -6.25])
  b.box(m.mint, [0.03, 1.7, 0.3], [6.635, 0.85, -6.25])
  b.box(m.mint, [0.6, 0.03, 0.3], [6.35, 0.015, -6.25])
  b.box(m.led, [0.5, 0.02, 0.2], [6.35, 1.66, -6.25], undefined, false)
  for (const y of [0.5, 0.95, 1.4]) {
    b.box(m.glassShelf, [0.54, 0.015, 0.26], [6.35, y, -6.25], undefined, false)
    const set = [m.perfumeA, m.perfumeB, m.perfumeC, m.perfumeD, m.perfumeB]
    for (let k = 0; k < 5; k++) b.cyl(set[(k + Math.round(y * 10)) % set.length], 0.03, 0.03, 0.12 + (k % 2) * 0.05, [6.18 + k * 0.085, y + 0.07, -6.27], 8, undefined, false)
  }
  // white wardrobe on the south wall
  b.box(m.whiteGloss, [1.8, 2.2, 0.6], [4.6, 1.1, -3.1])
  for (const dx of [-0.9, -0.3, 0.3, 0.9]) b.box(m.black, [0.01, 2.1, 0.01], [4.6 + dx, 1.1, -3.4])
  for (const dx of [-0.35, -0.25, 0.25, 0.35]) b.box(m.chrome, [0.015, 0.22, 0.02], [4.6 + dx, 1.0, -3.41])
  // champagne curtains over the whole window wall, a grey accent wall, ceiling fan
  b.add(m.curtainChampagne, pleatedSheet(3.1, 2.8, 9, 0.05), [6.95, 1.4, -4.25], [0, -Math.PI / 2, 0], false)
  b.box(m.greyWall, [1.5, 2.9, 0.02], [6.25, 1.45, -2.81], undefined, false)
  b.cyl(m.fan, 0.015, 0.015, 0.15, [4.8, 2.82, -4.9], 6, undefined, false)
  b.cyl(m.fan, 0.08, 0.08, 0.1, [4.8, 2.72, -4.9], 12, undefined, false)
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2
    b.box(m.fan, [0.6, 0.012, 0.13], [4.8 + Math.cos(a) * 0.38, 2.7, -4.9 - Math.sin(a) * 0.38], [0, a, 0], false)
  }
}

function bathroom(b: Batch, m: Mats): void {
  // plain stand-ins: no photograph of the bathroom exists yet
  b.box(m.whiteGloss, [0.36, 0.4, 0.5], [6.6, 0.2, -8.62])
  b.box(m.whiteGloss, [0.36, 0.34, 0.16], [6.6, 0.57, -8.9])
  b.box(m.whiteGloss, [0.34, 0.03, 0.42], [6.6, 0.42, -8.62])
  b.cyl(m.whiteGloss, 0.06, 0.07, 0.75, [6.82, 0.375, -7.7], 10)
  b.box(m.whiteGloss, [0.44, 0.14, 0.56], [6.78, 0.83, -7.7])
  b.cyl(m.chrome, 0.012, 0.012, 0.12, [6.92, 0.96, -7.7], 6)
  b.box(m.mirror, [0.03, 0.7, 0.5], [6.985, 1.5, -7.7], undefined, false)
  b.box(m.trim, [0.02, 0.76, 0.56], [6.99, 1.5, -7.7], undefined, false)
  b.box(m.pink, [0.03, 0.5, 0.28], [6.985, 1.15, -7.0])
  b.cyl(m.led, 0.18, 0.18, 0.04, [6.3, 2.88, -7.8], 20, undefined, false)
}

export interface Home {
  /** The whole home, including the door leaf and the notebook below. */
  group: Group
  /** Hinged at the west jamb of the doorway: rotate about y by about -π/2 to swing it out onto the porch. */
  frontDoor: Group
  /** The pink notebook on the dining table; hide it once it is packed. */
  notebook: Group
  /** Frees every geometry, material and texture the home created. */
  dispose: () => void
}

function frontDoorLeaf(m: Mats): Group {
  const hinge = new Group()
  hinge.position.set(FRONT_DOOR.x - FRONT_DOOR.w / 2, 0, FRONT_DOOR.z)
  const w = FRONT_DOOR.w - 0.03
  const h = FRONT_DOOR.h - 0.02
  const leaf = new Mesh(new BoxGeometry(w, h, 0.05), m.doorWood)
  leaf.position.set(w / 2 + 0.01, h / 2, 0)
  leaf.castShadow = true
  hinge.add(leaf)
  for (const side of [-1, 1]) {
    for (const [py, ph] of [[0.62, 0.8], [1.58, 0.8]] as const) {
      const panel = new Mesh(new BoxGeometry(w - 0.3, ph, 0.012), m.doorPanel)
      panel.position.set(w / 2 + 0.01, py, side * 0.028)
      hinge.add(panel)
    }
    const knob = new Mesh(new SphereGeometry(0.035, 10, 8), m.brass)
    knob.position.set(w - 0.1, 1.05, side * 0.06)
    hinge.add(knob)
  }
  return hinge
}

function notebookMesh(m: Mats): Group {
  const g = new Group()
  g.position.set(NOTEBOOK.pos[0], NOTEBOOK.pos[1], NOTEBOOK.pos[2])
  g.rotation.y = NOTEBOOK.rotY
  const cover = new Mesh(new BoxGeometry(0.2, 0.014, 0.15), m.pinkDeep)
  cover.castShadow = true
  g.add(cover)
  const pages = new Mesh(new BoxGeometry(0.19, 0.012, 0.14), m.sheet)
  pages.position.y = 0.011
  g.add(pages)
  const top = new Mesh(new BoxGeometry(0.2, 0.008, 0.15), m.pink)
  top.position.y = 0.021
  g.add(top)
  for (let k = 0; k < 7; k++) {
    const ring = new Mesh(new BoxGeometry(0.008, 0.03, 0.008), m.chrome)
    ring.position.set(-0.1, 0.012, -0.06 + k * 0.02)
    g.add(ring)
  }
  return g
}

function disposeAll(root: Group): void {
  const mats = new Set<Material>()
  root.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    mesh.geometry.dispose()
    const mm = mesh.material
    for (const x of Array.isArray(mm) ? mm : [mm]) mats.add(x)
  })
  const texs = new Set<Texture>()
  for (const mat of mats) {
    const std = mat as MeshStandardMaterial
    if (std.map) texs.add(std.map)
    if (std.emissiveMap) texs.add(std.emissiveMap)
    mat.dispose()
  }
  for (const t of texs) t.dispose()
}

/** The static home: walls, floors, furniture, lights' fittings, curtains, glass. */
export function buildHome(): Home {
  const m = materials()
  const b = new Batch()
  shell(b, m)
  openings(b, m)
  livingRoom(b, m)
  diningArea(b, m)
  bedroom(b, m)
  bathroom(b, m)
  const group = b.build()

  // window glass (transparent, so not merged)
  for (const [w, h, px, py, pz, ry] of [
    [0.8, 0.9, 1.1, 1.75, -6.5, 0],
    [1.6, 1.4, 7.1, 1.6, -4.2, -Math.PI / 2],
    [1.4, 1.3, 3.7, 1.55, -9.1, 0],
  ] as const) {
    const pane = new Mesh(new PlaneGeometry(w, h), m.glassPane)
    pane.position.set(px, py, pz)
    pane.rotation.y = ry
    group.add(pane)
  }

  const frontDoor = frontDoorLeaf(m)
  const notebook = notebookMesh(m)
  group.add(frontDoor, notebook)
  return { group, frontDoor, notebook, dispose: () => disposeAll(group) }
}
