// Builds the neighbourhood as a few dozen merged meshes (see home/sceneBuilder.ts): roads, the
// buildings of both lanes and Ninety Street, the walled yard around the home with its gate and roof,
// street lamps, palms, bins and the barriers. Three.js only; no React. Positions come from
// streetLayout.ts, the same data the physics uses.
import { Group, Material, MeshStandardMaterial } from 'three'
import { Batch, disposeGroup, type V3 } from '../home/sceneBuilder.ts'
import {
  ASPHALT, BARRIERS, BARRIER_H, BINS, BIN, BOULEVARD, CROSSING, GATE, HOUSE_RECTS, LAMPS, LAMP_R, LOTS, PALMS, PARAPET_H, PARAPET_LINES,
  PAVING, PLOT, PLOT_WALLS, ROOF, ROOF_TANK, FLOOR_H, type Lot, type Rect,
} from './streetLayout.ts'
import {
  TINTS, asphaltTexture, barrierTexture, groundBayTexture, pavingTexture, shopBayTexture, upperBayTexture, wallTexture,
} from './streetTextures.ts'

export interface Street {
  group: Group
  dispose: () => void
}

export const std = (color: string, roughness = 0.95, metalness = 0) => new MeshStandardMaterial({ color, roughness, metalness })
export const tex = (map: MeshStandardMaterial['map'], roughness = 0.95, color = '#ffffff') => new MeshStandardMaterial({ map, roughness, color })

export function materials() {
  const paving = pavingTexture()
  return {
    asphalt: tex(asphaltTexture(), 0.97),
    paving: tex(paving, 0.9),
    yard: tex(paving, 0.9, '#e2d2b4'),
    white: std('#f2f0ea', 0.8),
    wall: tex(wallTexture()),
    cap: std('#e9e1cf', 0.85),
    barrier: tex(barrierTexture(), 0.7),
    parapet: std('#e4dccb', 0.9),
    slab: std('#b9b3a6', 0.95),
    tank: std('#2a2d31', 0.5),
    leg: std('#6b6b6e', 0.6, 0.4),
    pole: std('#5c6168', 0.55, 0.5),
    lampHead: std('#8a9097', 0.5, 0.4),
    lampGlow: new MeshStandardMaterial({ color: '#fff4d2', emissive: '#ffe9b0', emissiveIntensity: 0.55, roughness: 0.5 }),
    trunk: std('#8b6e4e', 1),
    frond: std('#4d8a3a', 0.9),
    bin: std('#2f6e40', 0.7),
    binLid: std('#1f4a2b', 0.7),
    gate: std('#2f4a3a', 0.5, 0.35),
    plain: TINTS.map((c) => std(c, 0.95)),
    upper: TINTS.flatMap((_, t) => [0, 1].map((v) => tex(upperBayTexture(t, v)))),
    ground: TINTS.map((_, t) => tex(groundBayTexture(t))),
    shop: [0, 1, 2, 3, 4].map((a) => tex(shopBayTexture(a))),
  }
}
export type Mats = ReturnType<typeof materials>

export const cx = (r: Rect) => (r.x0 + r.x1) / 2
export const cz = (r: Rect) => (r.z0 + r.z1) / 2
export const sx = (r: Rect) => r.x1 - r.x0
export const sz = (r: Rect) => r.z1 - r.z0

/** A number in 0..1 that depends only on the text and the index, so the street never changes. */
function hash01(text: string, k: number): number {
  let h = 2166136261 ^ (k * 977)
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

// ---------------------------------------------------------------------------------------------

/** Heights above the ground sheet (y = -0.1 in the home): asphalt and paving at -0.04, paint above. */
export const Y_ROAD = -0.04
export const Y_PAINT = -0.034

function roads(b: Batch, m: Mats): void {
  for (const r of ASPHALT) b.plane(m.asphalt, sx(r), sz(r), [cx(r), Y_ROAD, cz(r)], [-Math.PI / 2, 0, 0], [sx(r) / 4, sz(r) / 4])
  for (const r of PAVING) b.plane(m.paving, sx(r), sz(r), [cx(r), Y_ROAD, cz(r)], [-Math.PI / 2, 0, 0], [sx(r) / 2, sz(r) / 2])

  // lane markings of Ninety Street: continuous edge lines, dashed lines between the three lanes
  const len = BOULEVARD.z1 - BOULEVARD.z0
  const zMid = (BOULEVARD.z0 + BOULEVARD.z1) / 2
  const [w0, w1] = BOULEVARD.carriageW
  const [e0, e1] = BOULEVARD.carriageE
  for (const x of [w0 + 0.3, w1 - 0.3, e0 + 0.3, e1 - 0.3]) b.box(m.white, [0.12, 0.012, len], [x, Y_PAINT, zMid], undefined, false)
  const dashed = [w0 + (w1 - w0) / 3, w0 + (2 * (w1 - w0)) / 3, e0 + (e1 - e0) / 3, e0 + (2 * (e1 - e0)) / 3]
  for (let z = BOULEVARD.z0 + 2; z < BOULEVARD.z1 - 2; z += 6) {
    if (z + 2.2 > CROSSING.z0 - 1.2 && z < CROSSING.z1 + 1.2) continue
    for (const x of dashed) b.box(m.white, [0.12, 0.012, 2.2], [x, Y_PAINT, z + 1.1], undefined, false)
  }
  // the pedestrian crossing in front of the home lane: stripes along the traffic, one metre apart
  const zc = (CROSSING.z0 + CROSSING.z1) / 2
  const zebra = (from: number, to: number) => {
    for (let x = from + 0.5; x < to - 0.3; x += 1) b.box(m.white, [0.5, 0.012, CROSSING.z1 - CROSSING.z0], [x, Y_PAINT, zc], undefined, false)
  }
  zebra(w0, w1)
  zebra(e0, e1)
}

// ---------------------------------------------------------------------------------------------

export function building(b: Batch, m: Mats, lot: Lot): void {
  const r = lot.rect
  const w = sx(r)
  const d = sz(r)
  const upperH = lot.height - lot.groundH
  const ground = lot.style === 'shop' ? m.shop[lot.accent] : m.ground[lot.tint]
  b.facadeBox(ground, [w, lot.groundH, d], [cx(r), lot.groundH / 2, cz(r)], FLOOR_H, lot.groundH)
  if (upperH > 0.01) b.facadeBox(m.upper[lot.tint * 2 + lot.win], [w, upperH, d], [cx(r), lot.groundH + upperH / 2, cz(r)], FLOOR_H, FLOOR_H)
  // cornice / parapet, a few centimetres proud of the walls
  b.box(m.parapet, [w + 0.12, PARAPET_H, d + 0.12], [cx(r), lot.height + PARAPET_H / 2, cz(r)])
  const roofY = lot.height + PARAPET_H
  // rooftop water tank on short legs, and sometimes a stair-room box
  const a = hash01(lot.id, 1)
  const c = hash01(lot.id, 2)
  if (lot.tank) {
    const tx = cx(r) + (a - 0.5) * Math.max(0, w - 4)
    const tz = cz(r) + (c - 0.5) * Math.max(0, d - 4)
    for (const [dx, dz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]] as const) b.box(m.leg, [0.08, 0.35, 0.08], [tx + dx, roofY + 0.175, tz + dz])
    b.cyl(m.tank, 0.55, 0.55, 1.1, [tx, roofY + 0.35 + 0.55, tz], 12)
  }
  if (lot.floors >= 2 && hash01(lot.id, 3) < 0.35) {
    const mx = cx(r) - Math.sign(a - 0.5 || 1) * Math.max(0, w / 2 - 2.0)
    const mz = cz(r) - Math.sign(c - 0.5 || 1) * Math.max(0, d / 2 - 2.0)
    b.box(m.plain[lot.tint], [2.6, 2.3, 2.6], [mx, roofY + 1.15, mz])
  }
}

function buildings(b: Batch, m: Mats): void {
  for (const lot of LOTS) building(b, m, lot)
}

// ---------------------------------------------------------------------------------------------

/** The walled yard of the home: paving, the wall, the gate, the roof of the house and its tank. */
function plot(b: Batch, m: Mats): void {
  const w = PLOT.x1 - PLOT.x0
  const d = PLOT.z1 - PLOT.z0
  b.plane(m.yard, w, d, [(PLOT.x0 + PLOT.x1) / 2, -0.03, (PLOT.z0 + PLOT.z1) / 2], [-Math.PI / 2, 0, 0], [w / 2, d / 2])

  for (const r of PLOT_WALLS) {
    b.facadeBox(m.wall, [sx(r), PLOT.wallH, sz(r)], [cx(r), PLOT.wallH / 2, cz(r)], 3, PLOT.wallH)
    b.box(m.cap, [sx(r) + 0.06, 0.09, sz(r) + 0.06], [cx(r), PLOT.wallH + 0.045, cz(r)])
  }
  // gate pillars with a lantern each, and the two steel leaves swung open into the yard
  const zWall = PLOT.z1 - PLOT.wallT / 2
  for (const [x, dir] of [[GATE.x0 - 0.25, -1], [GATE.x1 + 0.25, 1]] as const) {
    b.box(m.cap, [0.5, 2.5, 0.5], [x, 1.25, zWall])
    b.box(m.cap, [0.62, 0.1, 0.62], [x, 2.55, zWall])
    b.box(m.lampHead, [0.22, 0.28, 0.22], [x, 2.74, zWall])
    b.sphere(m.lampGlow, 0.1, [x, 2.74, zWall], 8, undefined, false)
    // the leaf stands at right angles to the wall, against the pillar's inner face
    b.box(m.gate, [0.05, GATE.h, 1.0], [dir < 0 ? GATE.x0 + 0.03 : GATE.x1 - 0.03, GATE.h / 2 + 0.05, PLOT.z1 - PLOT.wallT - 0.5])
  }

  // the roof of the house: slab, parapet all round, water tank
  for (const r of HOUSE_RECTS) b.box(m.slab, [sx(r), ROOF.y1 - ROOF.y0 - 0.002, sz(r)], [cx(r), (ROOF.y0 + ROOF.y1) / 2 + 0.001, cz(r)], undefined, false)
  for (const [x0, z0, x1, z1] of PARAPET_LINES) {
    const alongX = Math.abs(z0 - z1) < 1e-9
    const len = Math.abs(alongX ? x1 - x0 : z1 - z0) + ROOF.parapetT
    const size: V3 = alongX ? [len, ROOF.parapetH, ROOF.parapetT] : [ROOF.parapetT, ROOF.parapetH, len]
    b.box(m.parapet, size, [(x0 + x1) / 2, ROOF.y1 + ROOF.parapetH / 2, (z0 + z1) / 2], undefined, false)
  }
  const { x, z, r, h } = ROOF_TANK
  for (const [dx, dz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]] as const) b.box(m.leg, [0.08, 0.3, 0.08], [x + dx, ROOF.y1 + 0.15, z + dz], undefined, false)
  b.cyl(m.tank, r, r, h, [x, ROOF.y1 + 0.3 + h / 2, z], 14, undefined, false)
}

// ---------------------------------------------------------------------------------------------

export function palm(b: Batch, m: Mats, x: number, z: number, h: number): void {
  const trunkH = h * 0.86
  b.cyl(m.trunk, 0.13, 0.2, trunkH, [x, trunkH / 2, z], 8)
  const top = trunkH
  const L = 2.5
  const count = 10
  for (let i = 0; i < count; i++) {
    const yaw = (i / count) * Math.PI * 2 + (i % 2) * 0.15
    const droop = 0.28 + (i % 3) * 0.2
    const ex = Math.sin(yaw) * Math.cos(droop) * (L / 2)
    const ey = -Math.sin(droop) * (L / 2)
    const ez = Math.cos(yaw) * Math.cos(droop) * (L / 2)
    b.box(m.frond, [0.42, 0.05, L], [x + ex, top + ey, z + ez], [droop, yaw, 0])
  }
  b.sphere(m.frond, 0.22, [x, top + 0.05, z], 8)
}

export function lamp(b: Batch, m: Mats, x: number, z: number): void {
  b.cyl(m.pole, 0.15, 0.17, 0.5, [x, 0.25, z], 10)
  b.cyl(m.pole, LAMP_R * 0.55, LAMP_R * 0.75, 6.2, [x, 3.6, z], 10)
  // a double arm over both carriageways, a lamp head at each end
  b.box(m.pole, [4.8, 0.09, 0.09], [x, 6.65, z])
  for (const dx of [-2.4, 2.4]) {
    b.box(m.lampHead, [0.9, 0.12, 0.34], [x + dx, 6.55, z])
    b.box(m.lampGlow, [0.78, 0.02, 0.28], [x + dx, 6.48, z], undefined, false)
  }
}

export function bin(b: Batch, m: Mats, x: number, z: number): void {
  b.box(m.bin, [BIN.hw * 2, BIN.h - 0.08, BIN.hd * 2], [x, (BIN.h - 0.08) / 2, z])
  b.box(m.binLid, [BIN.hw * 2 + 0.04, 0.08, BIN.hd * 2 + 0.04], [x, BIN.h - 0.04, z])
}

function props(b: Batch, m: Mats): void {
  for (const l of LAMPS) lamp(b, m, l.x, l.z)
  for (const p of PALMS) palm(b, m, p.x, p.z, p.h)
  for (const p of BINS) bin(b, m, p.x, p.z)
  for (const r of BARRIERS) {
    b.facadeBox(m.barrier, [sx(r), BARRIER_H, sz(r)], [cx(r), BARRIER_H / 2, cz(r)], 1.1, 1.1)
    // two posts per barrier segment are implied; the board itself is the solid thing
  }
}

// ---------------------------------------------------------------------------------------------

/** The whole neighbourhood outside the walls of the house: call `dispose` when the scene goes away. */
export function buildStreet(): Street {
  const m = materials()
  const b = new Batch()
  roads(b, m)
  buildings(b, m)
  plot(b, m)
  props(b, m)
  const group = b.build()
  const all: Material[] = []
  for (const v of Object.values(m)) for (const x of Array.isArray(v) ? v : [v]) all.push(x)
  return {
    group,
    dispose: () => {
      disposeGroup(group)
      for (const x of all) x.dispose()
    },
  }
}
