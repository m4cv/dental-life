// Builds the university of Stage 8 as merged meshes: the shell of the main building (hollow on the ground
// floor, with the doorway open), the rooms inside it, the courtyard behind it and the people. Three.js only;
// no React. Positions come from uniLayout.ts, the same data the physics uses.
//
// Everything is drawn with a handful of materials and four batches (shell, inside, courtyard, people), so the
// whole campus costs a few dozen draw calls. All of it is stylised and ESTIMATED: see the note in uniLayout.ts.
import { Group, Material, MeshStandardMaterial } from 'three'
import { Batch, disposeGroup, type V3 } from '../home/sceneBuilder.ts'
import { cx, cz, std, sx, sz, tex } from '../street/buildStreet.ts'
import { uniBayTexture } from '../streets/routeTextures.ts'
import {
  BUILDING_WALLS, CEILING_PANELS, CEIL_Y, DOORS, FLOOR_Y, FL, FURNITURE, HEDGE_T, KIOSK_H, UNI,
  UNI_BLOCKS, UNI_COURT, UNI_COURT_PALM, UNI_ENTRANCE_TOP, UNI_KIOSKS, UNI_LAWNS, UNI_MAIN, UNI_MAIN_UPPER, UNI_PEOPLE, UNI_ROOMS, UNI_ROUND, UNI_VESTIBULE,
  chairCentres, roomById, wallPieces, type Furn, type Person, type UniWall, type WallPiece,
} from './uniLayout.ts'
import {
  corridorTileTexture, courtBayTexture, courtPavingTexture, emblemTexture, entranceTopTexture, friezeTexture, graniteTexture, lawnTexture, noticeBoardTexture, signTexture,
  vinylTexture, whiteboardTexture,
} from './uniTextures.ts'

export interface Campus {
  group: Group
  dispose: () => void
}

function campusMaterials() {
  return {
    ground: tex(uniBayTexture(true)),
    upper: tex(uniBayTexture(false)),
    courtG: tex(courtBayTexture('ground')),
    courtM: tex(courtBayTexture('mid')),
    courtT: tex(courtBayTexture('top')),
    frieze: tex(friezeTexture()),
    entTop: tex(entranceTopTexture(), 0.9),
    blue: std('#2b9ad0', 0.8),
    banner: std('#2a58b0', 0.9),
    stone: std('#e2d6b8', 0.9),
    cap: std('#e9e1cf', 0.85),
    wallPaint: std('#ece5d4', 0.95),
    ceiling: std('#f1eee6', 1),
    panel: new MeshStandardMaterial({ color: '#fff8e4', emissive: '#fff2cf', emissiveIntensity: 0.9, roughness: 0.5 }),
    granite: tex(graniteTexture(), 0.35),
    tile: tex(corridorTileTexture(), 0.5),
    vinyl: tex(vinylTexture(), 0.6),
    paving: tex(courtPavingTexture(), 0.9),
    lawn: tex(lawnTexture(), 1),
    hedge: std('#3f7a34', 1),
    carpet: std('#a82424', 0.95),
    wood: std('#8a5a36', 0.7),
    woodDark: std('#4a3022', 0.7),
    metal: std('#4b5159', 0.5, 0.5),
    cabinet: std('#8f979f', 0.55, 0.3),
    chair: std('#3b5c91', 0.7),
    bench: std('#2a5fb8', 0.6),
    benchLeg: std('#2a2d31', 0.6, 0.3),
    canopyRoof: std('#cdb078', 0.9),
    canopyPole: std('#2f55a8', 0.6, 0.2),
    brick: std('#b98b6a', 0.9),
    soil: std('#5b4630', 1),
    leaf: std('#3f8a3a', 0.9),
    trunk: std('#8b6e4e', 1),
    frond: std('#4d8a3a', 0.9),
    iron: std('#222428', 0.5, 0.4),
    boardWhite: tex(whiteboardTexture(), 0.5),
    emblem: tex(emblemTexture(), 0.5),
    notice: tex(noticeBoardTexture(), 0.9),
    signHall1: tex(signTexture('Lecture Hall 1', '#1f4e8c'), 0.6),
    signHall2: tex(signTexture('Lecture Hall 2', '#1f4e8c'), 0.6),
    signOffice: tex(signTexture('Student Affairs', '#2e6b4a'), 0.6),
    signCourt: tex(signTexture('Courtyard', '#7a4a1e', 'Cafeteria · benches'), 0.6),
    roofTank: std('#2a2d31', 0.5),
    roofLeg: std('#6b6b6e', 0.6, 0.4),
    looks: [
      { skin: std('#b9825c', 0.8), coat: std('#2d3f5e', 0.9), legs: std('#2a2d35', 0.9), hijab: null, hair: std('#1c1c1c', 0.9), long: false },
      { skin: std('#c28b62', 0.8), coat: std('#e8e4da', 0.9), legs: std('#3a3d45', 0.9), hijab: null, hair: std('#2a2420', 0.9), long: false },
      { skin: std('#e0b08a', 0.8), coat: std('#f3f3f0', 0.9), legs: std('#2b2e35', 0.9), hijab: std('#c99a98', 0.9), hair: null, long: true },
      { skin: std('#d9a27a', 0.8), coat: std('#2e3036', 0.9), legs: std('#2e3036', 0.9), hijab: std('#3b3b44', 0.9), hair: null, long: true },
      { skin: std('#e6b98f', 0.8), coat: std('#f3f3f0', 0.9), legs: std('#2b2e35', 0.9), hijab: std('#5b7fb0', 0.9), hair: null, long: true },
      { skin: std('#b9825c', 0.8), coat: std('#5b7a99', 0.9), legs: std('#33363e', 0.9), hijab: null, hair: std('#1d1b19', 0.9), long: false },
      { skin: std('#d9a27a', 0.8), coat: std('#f3f3f0', 0.9), legs: std('#2b2e35', 0.9), hijab: std('#8e8e96', 0.9), hair: null, long: true },
    ],
  }
}
type Mats = ReturnType<typeof campusMaterials>

const FLAT: V3 = [-Math.PI / 2, 0, 0]
const CEIL_FACE: V3 = [Math.PI / 2, 0, 0]
const face = (yaw: number): V3 => [0, yaw, 0]
const tiles = (len: number, per: number) => Math.max(1, Math.round(len / per))

// ---------------------------------------------------------------------------------------------
// The shell
// ---------------------------------------------------------------------------------------------

/** A flat sheet on a vertical face of a building: `facing` is the way the face looks (a yaw: 0 = +z, π = -z, π/2 = +x, -π/2 = -x). */
function skin(b: Batch, mat: Material, w: number, y0: number, y1: number, at: V3, yaw: number, uv: [number, number]): void {
  b.plane(mat, w, y1 - y0, [at[0], (y0 + y1) / 2, at[2]], face(yaw), uv)
}

/** The plain lining on the inside of an exterior wall piece, so the painted windows of the facade do not show indoors. */
function lining(b: Batch, m: Mats, w: UniWall, p: WallPiece): void {
  const y0 = Math.max(p.y0, FLOOR_Y)
  const y1 = Math.min(p.y1, CEIL_Y)
  if (y1 - y0 < 0.01) return
  const r = p.rect
  if (w.axis === 'x') {
    const south = w.c < -484
    skin(b, m.wallPaint, sx(r), y0, y1, [cx(r), 0, south ? r.z1 + 0.004 : r.z0 - 0.004], south ? 0 : Math.PI, [1, 1])
  } else {
    const east = w.c < -160
    skin(b, m.wallPaint, sz(r), y0, y1, [east ? r.x1 + 0.004 : r.x0 - 0.004, 0, cz(r)], east ? Math.PI / 2 : -Math.PI / 2, [1, 1])
  }
}

function shell(b: Batch, m: Mats): void {
  // the hollow ground floor of the main building: exterior walls with their doorways
  for (const w of BUILDING_WALLS) {
    if (!w.exterior) continue
    for (const p of wallPieces(w)) {
      const r = p.rect
      const h = p.y1 - p.y0
      const mat = p.part === 'solid' ? (w.id === 'north' ? m.courtG : m.ground) : m.stone
      if (p.part === 'solid') b.facadeBox(mat, [sx(r), h, sz(r)], [cx(r), p.y0 + h / 2, cz(r)], 4.4, UNI.floorH)
      else b.box(mat, [sx(r), h, sz(r)], [cx(r), p.y0 + h / 2, cz(r)])
      if (p.part !== 'sill') lining(b, m, w, p)
    }
  }

  // the three upper floors of the main building, with a cornice, water tanks and a stair-room on the roof
  const mu = UNI_MAIN_UPPER
  const mr = mu.rect
  const upperH = mu.y1 - mu.y0
  b.facadeBox(m.upper, [sx(mr), upperH, sz(mr)], [cx(mr), mu.y0 + upperH / 2, cz(mr)], 4.4, FL)
  b.box(m.cap, [sx(mr) + 0.3, 0.7, sz(mr) + 0.3], [cx(mr), mu.y1 + 0.35, cz(mr)])
  for (const dx of [-14, 14]) {
    for (const [lx, lz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]] as const) b.box(m.roofLeg, [0.08, 0.35, 0.08], [cx(mr) + dx + lx, mu.y1 + 0.7 + 0.175, cz(mr) + lz])
    b.cyl(m.roofTank, 0.7, 0.7, 1.3, [cx(mr) + dx, mu.y1 + 0.7 + 0.35 + 0.65, cz(mr)], 12)
  }
  b.box(m.stone, [3.2, 2.4, 3.2], [cx(mr) + 8, mu.y1 + 0.7 + 1.2, cz(mr) - 2])
  // blue banners on both sides of the entrance
  for (const x of [cx(mr) - 14.5, cx(mr) - 11, cx(mr) + 11, cx(mr) + 14.5]) b.box(m.banner, [1.3, 6.2, 0.06], [x, 9.6, mr.z1 + 0.06], undefined, false)

  // the entrance: two blue shoulders, and over the doorway a cream block with the grilles and the crenellated trim
  for (const blk of UNI_BLOCKS) {
    if (!blk.id.startsWith('shoulder')) continue
    const r = blk.rect
    b.box(m.blue, [sx(r), blk.height, sz(r)], [cx(r), blk.height / 2, cz(r)])
    b.box(m.stone, [sx(r) + 0.3, 0.6, sz(r) + 0.3], [cx(r), blk.height + 0.3, cz(r)])
  }
  const top = UNI_ENTRANCE_TOP
  const th = top.y1 - top.y0
  b.box(m.stone, [sx(top.rect), th, sz(top.rect)], [cx(top.rect), top.y0 + th / 2, cz(top.rect)])
  b.box(m.stone, [sx(top.rect) + 0.3, 0.6, sz(top.rect) + 0.3], [cx(top.rect), top.y1 + 0.3, cz(top.rect)])
  b.plane(m.entTop, sx(top.rect), th, [cx(top.rect), top.y0 + th / 2, top.rect.z1 + 0.03], face(0), [1, 1])

  // the wings and the back wing: street texture outside, the courtyard texture on the faces that look into it
  for (const blk of UNI_BLOCKS) {
    if (blk.id.startsWith('shoulder')) continue
    const r = blk.rect
    if (blk.id === 'tower') {
      b.box(m.stone, [sx(r), blk.height, sz(r)], [cx(r), blk.height / 2, cz(r)])
      b.box(m.cap, [sx(r) + 0.3, 0.6, sz(r) + 0.3], [cx(r), blk.height + 0.3, cz(r)])
      // iron balconies on the courtyard face, one per floor
      for (let k = 1; k <= 4; k++) {
        const y = k * FL - 0.9
        b.box(m.iron, [sx(r) - 1, 0.12, 1.3], [cx(r), y, r.z1 + 0.65])
        b.box(m.iron, [sx(r) - 1, 0.9, 0.05], [cx(r), y + 0.5, r.z1 + 1.28])
        // a dark doorway behind each balcony
        b.box(m.iron, [2.2, 2.4, 0.06], [cx(r), y + 1.3, r.z1 + 0.03], undefined, false)
      }
      continue
    }
    const upper = blk.height - FL
    b.facadeBox(m.ground, [sx(r), FL, sz(r)], [cx(r), FL / 2, cz(r)], 4.4, FL)
    b.facadeBox(m.upper, [sx(r), upper, sz(r)], [cx(r), FL + upper / 2, cz(r)], 4.4, FL)
    b.box(m.cap, [sx(r) + 0.3, 0.7, sz(r) + 0.3], [cx(r), blk.height + 0.35, cz(r)])
  }
  const H = 4 * FL
  const court = UNI_COURT
  const bays = (len: number) => tiles(len, 4.4)
  const courtFace = (at: V3, w: number, yaw: number) => {
    skin(b, m.courtG, w, 0, FL, at, yaw, [bays(w), 1])
    skin(b, m.courtM, w, FL, 3 * FL, at, yaw, [bays(w), 2])
    skin(b, m.courtT, w, 3 * FL, H, at, yaw, [bays(w), 1])
    skin(b, m.frieze, w, H - 0.9, H, [at[0], 0, at[2]], yaw, [tiles(w, 3), 1])
  }
  const len = court.z1 - court.z0
  const wid = court.x1 - court.x0
  const off = 0.02
  courtFace([court.x0 + off, 0, (court.z0 + court.z1) / 2], len, Math.PI / 2)
  courtFace([court.x1 - off, 0, (court.z0 + court.z1) / 2], len, -Math.PI / 2)
  courtFace([(court.x0 + court.x1) / 2, 0, court.z0 + off], wid, 0)
  // the main building's north face above the ground floor (the ground floor is the wall itself)
  const nz = UNI_MAIN.z0 - off
  const nx = (UNI_MAIN.x0 + UNI_MAIN.x1) / 2
  skin(b, m.courtM, wid, FL, 3 * FL, [nx, 0, nz], Math.PI, [bays(wid), 2])
  skin(b, m.courtT, wid, 3 * FL, H, [nx, 0, nz], Math.PI, [bays(wid), 1])
  skin(b, m.frieze, wid, H - 0.9, H, [nx, 0, nz], Math.PI, [tiles(wid, 3), 1])
}

// ---------------------------------------------------------------------------------------------
// The inside
// ---------------------------------------------------------------------------------------------

const floorMat = (m: Mats, kind: 'granite' | 'tile' | 'vinyl'): Material => (kind === 'granite' ? m.granite : kind === 'tile' ? m.tile : m.vinyl)

function chair(b: Batch, m: Mats, x: number, z: number, yaw = 0): void {
  b.box(m.chair, [0.42, 0.05, 0.42], [x, FLOOR_Y + 0.45, z], face(yaw))
  const dz = -0.2 * Math.cos(yaw)
  const dx = -0.2 * Math.sin(yaw)
  b.box(m.chair, [0.42, 0.4, 0.05], [x + dx, FLOOR_Y + 0.7, z + dz], face(yaw))
  b.box(m.benchLeg, [0.05, 0.45, 0.05], [x, FLOOR_Y + 0.225, z])
}

function deskRow(b: Batch, m: Mats, f: Furn): void {
  const r = f.rect
  const len = sx(r)
  // the table is the south half of the block (towards the board), the chairs the north half
  b.box(m.wood, [len, 0.04, 0.5], [cx(r), FLOOR_Y + 0.76, r.z1 - 0.25])
  b.box(m.woodDark, [len, 0.3, 0.03], [cx(r), FLOOR_Y + 0.55, r.z1 - 0.46])
  for (const x of [r.x0 + 0.03, r.x1 - 0.03]) b.box(m.woodDark, [0.04, 0.74, 0.46], [x, FLOOR_Y + 0.37, r.z1 - 0.25])
  for (const x of chairCentres(r.x0, r.x1)) chair(b, m, x, r.z0 + 0.25)
}

/** A bench: the seat, a back on the side away from the view, and two legs. */
function bench(b: Batch, m: Mats, f: Furn): void {
  const r = f.rect
  const w = sx(r)
  const d = sz(r)
  b.box(m.bench, [w, 0.05, d], [cx(r), FLOOR_Y + 0.45, cz(r)])
  const alongZ = d >= w
  const back = alongZ
    ? { size: [0.05, 0.38, d] as V3, pos: [f.facing === 'E' ? r.x0 + 0.03 : r.x1 - 0.03, FLOOR_Y + 0.66, cz(r)] as V3 }
    : { size: [w, 0.38, 0.05] as V3, pos: [cx(r), FLOOR_Y + 0.66, f.facing === 'S' ? r.z0 + 0.03 : r.z1 - 0.03] as V3 }
  b.box(m.bench, back.size, back.pos)
  for (const t of [0.12, 0.88]) {
    b.box(m.benchLeg, alongZ ? [w, 0.45, 0.05] : [0.05, 0.45, d], alongZ ? [cx(r), FLOOR_Y + 0.225, r.z0 + (r.z1 - r.z0) * t] : [r.x0 + (r.x1 - r.x0) * t, FLOOR_Y + 0.225, cz(r)])
  }
}

function furniture(b: Batch, m: Mats, f: Furn): void {
  const r = f.rect
  switch (f.kind) {
    case 'deskrow':
      deskRow(b, m, f)
      break
    case 'lectern':
      b.box(m.woodDark, [sx(r), f.h, sz(r)], [cx(r), FLOOR_Y + f.h / 2, cz(r)])
      b.box(m.wood, [sx(r) + 0.1, 0.05, sz(r) + 0.1], [cx(r), FLOOR_Y + f.h + 0.025, cz(r)])
      break
    case 'guarddesk':
      b.box(m.wood, [sx(r), f.h - 0.05, sz(r)], [cx(r), FLOOR_Y + (f.h - 0.05) / 2, cz(r)])
      b.box(m.woodDark, [sx(r) + 0.12, 0.06, sz(r) + 0.12], [cx(r), FLOOR_Y + f.h, cz(r)])
      break
    case 'bench':
      bench(b, m, f)
      break
    case 'cabinet':
      b.box(m.cabinet, [sx(r), f.h, sz(r)], [cx(r), FLOOR_Y + f.h / 2, cz(r)])
      for (let z = r.z0 + 0.4; z < r.z1; z += 0.8) b.box(m.metal, [0.02, f.h - 0.3, 0.02], [r.x0 - 0.005, FLOOR_Y + f.h / 2, z], undefined, false)
      break
    case 'officedesk':
      b.box(m.wood, [sx(r), 0.04, sz(r)], [cx(r), FLOOR_Y + f.h, cz(r)])
      for (const x of [r.x0 + 0.04, r.x1 - 0.04]) b.box(m.woodDark, [0.05, f.h, sz(r) - 0.06], [x, FLOOR_Y + f.h / 2, cz(r)])
      break
    case 'table':
      b.box(m.wood, [sx(r), 0.05, sz(r)], [cx(r), FLOOR_Y + f.h, cz(r)])
      for (const x of [r.x0 + 0.15, r.x1 - 0.15]) b.box(m.benchLeg, [0.06, f.h, sz(r) - 0.2], [x, FLOOR_Y + f.h / 2, cz(r)])
      break
    case 'hedge':
      b.box(m.hedge, [sx(r), f.h, sz(r)], [cx(r), FLOOR_Y + f.h / 2, cz(r)])
      break
  }
}

function inside(b: Batch, m: Mats): void {
  // floors, one per room, and the granite of the doorway
  for (const room of UNI_ROOMS) {
    const r = room.rect
    b.plane(floorMat(m, room.floor), sx(r), sz(r), [cx(r), FLOOR_Y + 0.003, cz(r)], FLAT, [sx(r) / 2, sz(r) / 2])
  }
  const v = UNI_VESTIBULE
  b.plane(m.granite, sx(v), sz(v), [cx(v), FLOOR_Y + 0.003, cz(v)], FLAT, [sx(v) / 2, sz(v) / 2])
  // the red carpet runs from the door up the middle of the lobby to the corridor
  const lobby = roomById('lobby').rect
  b.plane(m.carpet, 2.4, v.z1 - lobby.z0, [-160, FLOOR_Y + 0.008, (lobby.z0 + v.z1) / 2], FLAT)

  // the ceiling over the whole ground floor, and the light panels
  const ceil = { x0: UNI_MAIN.x0 + 0.4, x1: UNI_MAIN.x1 - 0.4, z0: UNI_MAIN.z0 + 0.4, z1: UNI_MAIN.z1 - 0.4 }
  b.plane(m.ceiling, sx(ceil), sz(ceil), [cx(ceil), CEIL_Y, cz(ceil)], CEIL_FACE)
  b.plane(m.ceiling, sx(v), sz(v), [cx(v), CEIL_Y, cz(v)], CEIL_FACE)
  for (const p of CEILING_PANELS) b.plane(m.panel, p.w, p.d, [p.x, CEIL_Y - 0.01, p.z], CEIL_FACE)

  // interior partitions, with a door frame at each doorway
  for (const w of BUILDING_WALLS) {
    if (w.exterior) continue
    for (const p of wallPieces(w)) {
      const r = p.rect
      b.box(m.wallPaint, [sx(r), p.y1 - p.y0, sz(r)], [cx(r), (p.y0 + p.y1) / 2, cz(r)])
    }
    for (const o of w.openings) {
      if (o.w > 3) continue
      const jamb = (at: number) =>
        w.axis === 'x'
          ? b.box(m.woodDark, [0.07, o.h, w.t + 0.05], [at, FLOOR_Y + o.h / 2, w.c], undefined, false)
          : b.box(m.woodDark, [w.t + 0.05, o.h, 0.07], [w.c, FLOOR_Y + o.h / 2, at], undefined, false)
      jamb(o.at - o.w / 2)
      jamb(o.at + o.w / 2)
    }
  }
  // door signs on the corridor side of the partition, and the courtyard sign over the north door
  const sign = (mat: Material, x: number, y: number, z: number, yaw: number, w: number, h: number) => b.plane(mat, w, h, [x, y, z], face(yaw), [1, 1])
  const zc = -486.5 - 0.1 - 0.01
  const sy = FLOOR_Y + 2.5 + 0.55
  sign(m.signHall1, DOORS.hall1a, sy, zc, Math.PI, 1.5, 0.38)
  sign(m.signHall1, DOORS.hall1b, sy, zc, Math.PI, 1.5, 0.38)
  sign(m.signHall2, DOORS.hall2, sy, zc, Math.PI, 1.5, 0.38)
  sign(m.signOffice, DOORS.office, FLOOR_Y + 2.4 + 0.5, zc, Math.PI, 1.3, 0.33)
  sign(m.signCourt, DOORS.courtyard, FLOOR_Y + 3.25, UNI_MAIN.z0 + 0.4 + 0.01, 0, 2.4, 0.6)

  // the emblem and the notice board in the lobby
  b.plane(m.emblem, 1.8, 1.8, [roomById('lobby').rect.x0 + 0.01, FLOOR_Y + 2.5, -482.4], face(Math.PI / 2), [1, 1])
  b.plane(m.notice, 3.0, 1.5, [roomById('lobby').rect.x1 - 0.01, FLOOR_Y + 1.8, -484.2], face(-Math.PI / 2), [1, 1])

  // whiteboards on the south wall of the halls
  const board = (x: number, w: number) => {
    b.box(m.metal, [w + 0.12, 1.32, 0.03], [x, FLOOR_Y + 1.9, UNI_MAIN.z1 - 0.4 - 0.015])
    b.plane(m.boardWhite, w, 1.2, [x, FLOOR_Y + 1.9, UNI_MAIN.z1 - 0.4 - 0.032], face(Math.PI), [1, 1])
  }
  board(-175, 6)
  board(-147.75, 4.4)

  for (const f of FURNITURE) if (f.kind !== 'hedge' && f.kind !== 'table' && !f.id.startsWith('bench-')) furniture(b, m, f)

  // potted plants in the lobby, a chair for the guard and the clerk
  for (const r of UNI_ROUND) {
    if (r.kind !== 'planter') continue
    b.cyl(m.brick, r.r, r.r * 0.8, 0.5, [r.x, FLOOR_Y + 0.25, r.z], 12)
    b.sphere(m.leaf, r.r * 1.5, [r.x, FLOOR_Y + 0.5 + r.r * 1.5, r.z], 10, [1, 1.3, 1])
  }
  for (const p of UNI_PEOPLE) if (p.id === 'guard' || p.id === 'clerk') chair(b, m, p.x, p.z, p.heading)
}

// ---------------------------------------------------------------------------------------------
// The courtyard
// ---------------------------------------------------------------------------------------------

/** The date palm of the courtyard: a taller version of the street's palms, standing on the raised floor. */
function courtPalm(b: Batch, m: Mats, x: number, z: number, h: number): void {
  const y0 = FLOOR_Y
  const trunkH = h * 0.82
  b.cyl(m.trunk, 0.2, 0.3, trunkH, [x, y0 + trunkH / 2, z], 10)
  const L = 3.3
  const count = 12
  for (let i = 0; i < count; i++) {
    const yaw = (i / count) * Math.PI * 2 + (i % 2) * 0.12
    const droop = 0.3 + (i % 3) * 0.22
    const ex = Math.sin(yaw) * Math.cos(droop) * (L / 2)
    const ey = -Math.sin(droop) * (L / 2)
    const ez = Math.cos(yaw) * Math.cos(droop) * (L / 2)
    b.box(m.frond, [0.55, 0.05, L], [x + ex, y0 + trunkH + ey, z + ez], [droop, yaw, 0])
  }
  b.sphere(m.frond, 0.3, [x, y0 + trunkH + 0.05, z], 8)
  // a few orange dates under the crown, as in the photograph
  for (let i = 0; i < 4; i++) b.sphere(m.carpet, 0.1, [x + Math.sin(i * 1.6) * 0.35, y0 + trunkH - 0.3, z + Math.cos(i * 1.6) * 0.35], 6)
}

function courtyard(b: Batch, m: Mats): void {
  const c = UNI_COURT
  b.plane(m.paving, sx(c), sz(c), [cx(c), FLOOR_Y, cz(c)], FLAT, [sx(c) / 2, sz(c) / 2])
  for (const l of UNI_LAWNS) {
    b.plane(m.lawn, sx(l), sz(l), [cx(l), FLOOR_Y + 0.03, cz(l)], FLAT, [sx(l) / 4, sz(l) / 4])
    // a low kerb under the hedge, and a small tree on each lawn
    b.box(m.stone, [sx(l) + HEDGE_T * 2 + 0.1, 0.03, sz(l) + HEDGE_T * 2 + 0.1], [cx(l), FLOOR_Y + 0.015, cz(l)], undefined, false)
    b.cyl(m.trunk, 0.07, 0.1, 2.2, [cx(l) + 2, FLOOR_Y + 1.1, cz(l) - 3], 6)
    b.sphere(m.leaf, 1.1, [cx(l) + 2, FLOOR_Y + 2.7, cz(l) - 3], 8, [1, 1.2, 1])
  }
  for (const f of FURNITURE) {
    if (f.kind === 'hedge' || f.kind === 'table' || f.id.startsWith('bench-')) furniture(b, m, f)
  }

  // the date palm in its brick planter
  const pl = UNI_ROUND.find((r) => r.kind === 'palm-planter')
  if (pl) {
    b.cyl(m.brick, pl.r, pl.r + 0.1, pl.h, [pl.x, FLOOR_Y + pl.h / 2, pl.z], 24)
    b.cyl(m.soil, pl.r - 0.15, pl.r - 0.15, 0.04, [pl.x, FLOOR_Y + pl.h + 0.0, pl.z], 24, undefined, false)
  }
  courtPalm(b, m, UNI_COURT_PALM.x, UNI_COURT_PALM.z, UNI_COURT_PALM.h)

  // the canopies of the cafeteria: a tan roof on blue poles
  for (const k of UNI_KIOSKS) {
    b.box(m.canopyRoof, [sx(k), 0.16, sz(k)], [cx(k), FLOOR_Y + KIOSK_H + 0.08, cz(k)])
    for (const x of [k.x0 + 0.3, k.x1 - 0.3]) for (const z of [k.z0 + 0.3, k.z1 - 0.3]) b.cyl(m.canopyPole, 0.08, 0.08, KIOSK_H, [x, FLOOR_Y + KIOSK_H / 2, z], 8)
  }
  // stools at the kiosk tables, where people sit
  for (const p of UNI_PEOPLE) if (p.id.startsWith('kiosk')) b.cyl(m.benchLeg, 0.2, 0.2, 0.45, [p.x, FLOOR_Y + 0.225, p.z], 10)
  // bins
  for (const r of UNI_ROUND) {
    if (r.kind !== 'bin') continue
    b.cyl(m.leaf, r.r, r.r, r.h, [r.x, FLOOR_Y + r.h / 2, r.z], 10)
  }
}

// ---------------------------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------------------------

/** One simplified person, made of boxes and spheres: standing or seated, facing `heading`. */
function person(b: Batch, m: Mats, p: Person): void {
  const look = m.looks[p.look % m.looks.length]
  const h = p.heading
  const c = Math.cos(h)
  const s = Math.sin(h)
  // a local offset (lx to the side, lz forward) in world coordinates, rotated like the boxes are
  const at = (lx: number, y: number, lz: number): V3 => [p.x + lx * c + lz * s, FLOOR_Y + y, p.z - lx * s + lz * c]
  const rot = face(h)
  const sit = p.pose === 'sit'
  const hipY = sit ? 0.47 : 0.8
  if (sit) {
    for (const lx of [-0.1, 0.1]) {
      b.box(look.legs, [0.13, 0.13, 0.42], at(lx, hipY, 0.2), rot)
      b.box(look.legs, [0.12, 0.42, 0.12], at(lx, 0.21, 0.4), rot)
    }
  } else {
    for (const lx of [-0.1, 0.1]) b.box(look.legs, [0.13, hipY, 0.14], at(lx, hipY / 2, 0), rot)
  }
  const torsoH = 0.62
  const torsoY = hipY + torsoH / 2 - 0.02
  b.box(look.coat, [0.4, torsoH, 0.24], at(0, torsoY, 0), rot)
  if (look.long) b.box(look.coat, [0.44, sit ? 0.14 : 0.5, 0.28], at(0, sit ? hipY + 0.04 : hipY - 0.2, sit ? 0.06 : 0), rot)
  for (const lx of [-0.27, 0.27]) b.box(look.coat, [0.1, 0.58, 0.12], at(lx, torsoY, 0), rot)
  const headY = hipY + torsoH + 0.1
  b.sphere(look.skin, 0.11, at(0, headY, 0.01), 10, [1, 1.12, 1])
  if (look.hijab) {
    b.sphere(look.hijab, 0.145, at(0, headY + 0.015, -0.015), 10, [1, 1.1, 1.05])
    b.box(look.hijab, [0.34, 0.3, 0.2], at(0, headY - 0.2, -0.03), rot)
  } else if (look.hair) {
    b.sphere(look.hair, 0.118, at(0, headY + 0.03, -0.015), 10, [1, 1, 1.02])
  }
}

function people(b: Batch, m: Mats): void {
  for (const p of UNI_PEOPLE) person(b, m, p)
}

// ---------------------------------------------------------------------------------------------

/** Everything the university adds behind its gate: call `dispose` when the scene goes away. */
export function buildCampus(): Campus {
  const m = campusMaterials()
  const group = new Group()
  for (const fill of [shell, inside, courtyard, people]) {
    const b = new Batch()
    fill(b, m)
    group.add(b.build())
  }
  const all: Material[] = []
  for (const v of Object.values(m)) {
    if (Array.isArray(v)) {
      for (const look of v) for (const x of Object.values(look)) if (x && typeof x === 'object' && 'dispose' in x) all.push(x as Material)
    } else all.push(v as Material)
  }
  return {
    group,
    dispose: () => {
      disposeGroup(group)
      for (const x of all) x.dispose()
    },
  }
}
