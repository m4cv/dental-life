// Builds the route of Stage 7 as merged meshes: Ninety Street north of the old end, the roundabout,
// Al-Shaab Street with its rows of buildings, and the university's walled compound with the gate, the
// sign, the forecourt and the steps. (The main building, its inside and the courtyard are built by
// university/buildCampus.ts since Stage 8.) Three.js only; no React. Positions come from
// routeLayout.ts, the same data the physics uses.
//
// The route is long (about 450 m from end to end), so everything is built in chunks of about 110 m:
// each chunk is its own set of merged meshes with its own bounding sphere, which lets three.js skip what
// is behind her or too far away to matter (the fog hides it anyway) instead of drawing the whole route
// every frame. The materials are shared by all chunks.
import { Group, Material, MeshStandardMaterial } from 'three'
import { Batch, disposeGroup, type V3 } from '../home/sceneBuilder.ts'
import { Y_PAINT, Y_ROAD, building, cx, cz, lamp, materials, palm, std, sx, sz, tex, type Mats } from '../street/buildStreet.ts'
import { BOULEVARD, LAMP_R } from '../street/streetLayout.ts'
import {
  ISLAND, NORTH, NORTH_LAMPS, NORTH_PALMS, PLAZA, ROUTE_ASPHALT, ROUTE_LOTS, ROUTE_PAVING, SHAAB, SHAAB_LAMPS, SHAAB_PALMS, UNI, UNI_BOOTH, UNI_BOOTH_H,
  UNI_CANOPY, UNI_CANOPY_POLES, UNI_FLOOR, UNI_LAMPS, UNI_PALMS, UNI_PILLARS, UNI_SIGN, UNI_STEPS, UNI_WALLS,
} from './routeLayout.ts'
import { UNI_STEP_WALLS } from '../university/uniLayout.ts'
import { uniSignTexture } from './routeTextures.ts'

export interface Route {
  group: Group
  dispose: () => void
}

function routeMaterials() {
  return {
    ...materials(),
    sand: std('#cdbb94', 1),
    grass: std('#5d8a45', 1),
    kerb: std('#e2d8c0', 0.9),
    uniSign: tex(uniSignTexture(), 0.6),
    uniBlue: std('#2b4f98', 0.8),
    uniStone: std('#e2d6b8', 0.9),
    carpet: std('#a82424', 0.95),
    door: std('#3a2a20', 0.7),
    canopy: std('#cdb078', 0.9),
    canopyPole: std('#2f55a8', 0.6, 0.2),
    glass: std('#2d4660', 0.3, 0.2),
    signBack: std('#1b3166', 0.7),
  }
}
type RouteMats = ReturnType<typeof routeMaterials>

// ---------------------------------------------------------------------------------------------

const CHUNK = 110

/** One batch of shapes per square of the map, so each square can be culled on its own. */
class Chunks {
  private map = new Map<string, Batch>()
  at(x: number, z: number): Batch {
    const key = `${Math.floor(x / CHUNK)}:${Math.floor(z / CHUNK)}`
    let b = this.map.get(key)
    if (!b) {
      b = new Batch()
      this.map.set(key, b)
    }
    return b
  }
  build(): Group {
    const group = new Group()
    for (const b of this.map.values()) group.add(b.build())
    this.map.clear()
    return group
  }
}

const FLAT: V3 = [-Math.PI / 2, 0, 0]

// ---------------------------------------------------------------------------------------------

function roads(c: Chunks, m: RouteMats): void {
  // the ground itself: one big sheet of sand under everything the route adds (the home's own sheet sits just above it)
  c.at(-60, -260).plane(m.sand, 480, 620, [-60, -0.12, -260], FLAT)
  for (const r of ROUTE_ASPHALT) c.at(cx(r), cz(r)).plane(m.asphalt, sx(r), sz(r), [cx(r), Y_ROAD, cz(r)], FLAT, [sx(r) / 4, sz(r) / 4])
  for (const r of ROUTE_PAVING) c.at(cx(r), cz(r)).plane(m.paving, sx(r), sz(r), [cx(r), Y_ROAD, cz(r)], FLAT, [sx(r) / 2, sz(r) / 2])

  // Ninety Street: continuous edge lines (in pieces, one per chunk) and dashes between the three lanes of each carriageway
  const [w0, w1] = BOULEVARD.carriageW
  const [e0, e1] = BOULEVARD.carriageE
  for (const x of [w0 + 0.3, w1 - 0.3, e0 + 0.3, e1 - 0.3]) {
    for (let z = NORTH.z1; z > NORTH.z0; z -= CHUNK) {
      const len = Math.min(CHUNK, z - NORTH.z0)
      c.at(x, z - len / 2).box(m.white, [0.12, 0.012, len], [x, Y_PAINT, z - len / 2], undefined, false)
    }
  }
  const dashed = [w0 + (w1 - w0) / 3, w0 + (2 * (w1 - w0)) / 3, e0 + (e1 - e0) / 3, e0 + (2 * (e1 - e0)) / 3]
  for (let z = NORTH.z1 - 2; z - 2.2 > NORTH.z0 + 4; z -= 6) for (const x of dashed) c.at(x, z).box(m.white, [0.12, 0.012, 2.2], [x, Y_PAINT, z - 1.1], undefined, false)

  // the roundabout: a white line round the kerb of the island
  c.at(ISLAND.x, ISLAND.z).torus(m.white, ISLAND.r + 0.55, 0.06, [ISLAND.x, Y_PAINT + 0.004, ISLAND.z], [Math.PI / 2, 0, 0])
  // …and a stop line across each of the two lanes that enter it from the south
  for (const [a, b] of [BOULEVARD.carriageW, BOULEVARD.carriageE]) c.at((a + b) / 2, PLAZA.z1).box(m.white, [b - a - 1, 0.012, 0.35], [(a + b) / 2, Y_PAINT, PLAZA.z1 + 1.2], undefined, false)

  // Al-Shaab Street: edge lines, a dashed line down the middle, and a zebra crossing west of the gate
  for (const z of [SHAAB.z0 + 0.3, SHAAB.z1 - 0.3]) {
    for (let x = SHAAB.x1; x > SHAAB.x0; x -= CHUNK) {
      const l = Math.min(CHUNK, x - SHAAB.x0)
      c.at(x - l / 2, z).box(m.white, [l, 0.012, 0.12], [x - l / 2, Y_PAINT, z], undefined, false)
    }
  }
  const midZ = (SHAAB.z0 + SHAAB.z1) / 2
  for (let x = SHAAB.x1 - 3; x > SHAAB.x0 + 3; x -= 6) c.at(x, midZ).box(m.white, [2.4, 0.012, 0.14], [x - 1.2, Y_PAINT, midZ], undefined, false)
  for (let z = SHAAB.z0 + 0.8; z < SHAAB.z1 - 0.4; z += 1) c.at(-176, z).box(m.white, [3, 0.012, 0.5], [-176, Y_PAINT, z], undefined, false)
}

// ---------------------------------------------------------------------------------------------

function island(c: Chunks, m: RouteMats): void {
  const b = c.at(ISLAND.x, ISLAND.z)
  b.cyl(m.kerb, ISLAND.r, ISLAND.r, ISLAND.h, [ISLAND.x, ISLAND.h / 2 - 0.04, ISLAND.z], 36)
  b.cyl(m.grass, ISLAND.r - 0.4, ISLAND.r - 0.4, 0.04, [ISLAND.x, ISLAND.h - 0.04 + 0.02, ISLAND.z], 36, undefined, false)
  // a tall double lamp in the middle and a ring of palms
  lamp(b, m, ISLAND.x, ISLAND.z)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2
    palm(b, m, ISLAND.x + Math.sin(a) * 4.6, ISLAND.z + Math.cos(a) * 4.6, 4.8 + (i % 3) * 0.6)
  }
}

/** A lamp with one arm that reaches over the road (the median ones have two). */
function armLamp(b: Batch, m: Mats, x: number, z: number, armZ: number): void {
  b.cyl(m.pole, 0.15, 0.17, 0.5, [x, 0.25, z], 10)
  b.cyl(m.pole, LAMP_R * 0.55, LAMP_R * 0.75, 6.2, [x, 3.6, z], 10)
  b.box(m.pole, [0.09, 0.09, Math.abs(armZ)], [x, 6.65, z + armZ / 2])
  b.box(m.lampHead, [0.34, 0.12, 0.9], [x, 6.55, z + armZ])
  b.box(m.lampGlow, [0.28, 0.02, 0.78], [x, 6.48, z + armZ], undefined, false)
}

function props(c: Chunks, m: RouteMats): void {
  for (const l of NORTH_LAMPS) lamp(c.at(l.x, l.z), m, l.x, l.z)
  for (const p of NORTH_PALMS) palm(c.at(p.x, p.z), m, p.x, p.z, p.h)
  for (const p of SHAAB_PALMS) palm(c.at(p.x, p.z), m, p.x, p.z, p.h)
  for (const l of SHAAB_LAMPS) armLamp(c.at(l.x, l.z), m, l.x, l.z, 2.8)
}

// ---------------------------------------------------------------------------------------------

/** The compound's forecourt: floor, wall, gate pillars and sign, the booth, the canopy, the steps. */
function university(c: Chunks, m: RouteMats): void {
  const b = c.at(UNI.arrival.x, UNI.arrival.z)
  b.plane(m.paving, sx(UNI_FLOOR), sz(UNI_FLOOR), [cx(UNI_FLOOR), -0.03, cz(UNI_FLOOR)], FLAT, [sx(UNI_FLOOR) / 2, sz(UNI_FLOOR) / 2])

  for (const r of UNI_WALLS) {
    const w = c.at(cx(r), cz(r))
    w.facadeBox(m.wall, [sx(r), UNI.wallH, sz(r)], [cx(r), UNI.wallH / 2, cz(r)], 3, UNI.wallH)
    w.box(m.cap, [sx(r) + 0.06, 0.09, sz(r) + 0.06], [cx(r), UNI.wallH + 0.045, cz(r)])
  }

  // the two pillars of the gate carry the sign
  for (const r of UNI_PILLARS) {
    b.box(m.uniStone, [sx(r), UNI_SIGN.y1 + 0.3, sz(r)], [cx(r), (UNI_SIGN.y1 + 0.3) / 2, cz(r)])
    b.box(m.cap, [sx(r) + 0.2, 0.14, sz(r) + 0.2], [cx(r), UNI_SIGN.y1 + 0.37, cz(r)])
  }
  const signW = UNI_SIGN.x1 - UNI_SIGN.x0
  const signH = UNI_SIGN.y1 - UNI_SIGN.y0
  b.box(m.signBack, [signW, signH, 0.3], [(UNI_SIGN.x0 + UNI_SIGN.x1) / 2, (UNI_SIGN.y0 + UNI_SIGN.y1) / 2, UNI_SIGN.z])
  b.plane(m.uniSign, signW - 0.3, signH - 0.1, [(UNI_SIGN.x0 + UNI_SIGN.x1) / 2, (UNI_SIGN.y0 + UNI_SIGN.y1) / 2, UNI_SIGN.z + 0.16], [0, 0, 0], [1, 1])

  // the guard booth beside the gate
  b.box(m.uniStone, [sx(UNI_BOOTH), UNI_BOOTH_H, sz(UNI_BOOTH)], [cx(UNI_BOOTH), UNI_BOOTH_H / 2, cz(UNI_BOOTH)])
  b.box(m.uniBlue, [sx(UNI_BOOTH) + 0.5, 0.18, sz(UNI_BOOTH) + 0.5], [cx(UNI_BOOTH), UNI_BOOTH_H + 0.09, cz(UNI_BOOTH)])
  b.plane(m.glass, sx(UNI_BOOTH) - 0.5, 1.0, [cx(UNI_BOOTH), 1.7, UNI_BOOTH.z1 + 0.01], [0, 0, 0])
  b.plane(m.glass, sz(UNI_BOOTH) - 0.5, 1.0, [UNI_BOOTH.x0 - 0.01, 1.7, cz(UNI_BOOTH)], [0, -Math.PI / 2, 0])

  // the canopy over the parking bays: a tan roof on blue poles, and the bays marked on the paving
  const cr = UNI_CANOPY.rect
  b.box(m.canopy, [sx(cr), 0.16, sz(cr)], [cx(cr), UNI_CANOPY.h + 0.08, cz(cr)])
  for (const p of UNI_CANOPY_POLES) b.cyl(m.canopyPole, 0.1, 0.1, UNI_CANOPY.h, [p.x, UNI_CANOPY.h / 2, p.z], 8)
  for (let x = cr.x0 + 1; x <= cr.x1 - 0.9; x += 2.6) b.box(m.white, [0.1, 0.012, 5], [x, Y_PAINT, cz(cr)], undefined, false)

  // lamps and palms of the forecourt
  for (const l of UNI_LAMPS) lamp(b, m, l.x, l.z)
  for (const p of UNI_PALMS) palm(b, m, p.x, p.z, p.h)

  // three steps up to the doorway, the red carpet running up the middle of them; she can walk up them (Stage 8)
  const sr = UNI_STEPS.rect
  const treads = UNI_STEPS.treads
  for (let i = 0; i < treads; i++) {
    const h = UNI_STEPS.h * ((treads - i) / treads)
    const z0 = sr.z0 + (i * sz(sr)) / treads
    const z1 = sr.z0 + ((i + 1) * sz(sr)) / treads
    b.box(m.slab, [sx(sr), h, z1 - z0], [cx(sr), h / 2, (z0 + z1) / 2])
    b.box(m.carpet, [sx(UNI_STEPS.carpet), 0.03, z1 - z0], [cx(UNI_STEPS.carpet), h + 0.015, (z0 + z1) / 2], undefined, false)
  }
  // a low wall along each side of the steps
  for (const w of UNI_STEP_WALLS) b.box(m.slab, [sx(w), UNI_STEPS.h + 0.25, sz(w)], [cx(w), (UNI_STEPS.h + 0.25) / 2, cz(w)])
}

// ---------------------------------------------------------------------------------------------

/** Everything the route adds to the neighbourhood: call `dispose` when the scene goes away. */
export function buildRoute(): Route {
  const m = routeMaterials()
  const c = new Chunks()
  roads(c, m)
  island(c, m)
  for (const lot of ROUTE_LOTS) building(c.at(cx(lot.rect), cz(lot.rect)), m, lot)
  props(c, m)
  university(c, m)
  const group = c.build()
  const all: Material[] = []
  for (const v of Object.values(m)) for (const x of Array.isArray(v) ? v : [v]) all.push(x as MeshStandardMaterial)
  return {
    group,
    dispose: () => {
      disposeGroup(group)
      for (const x of all) x.dispose()
    },
  }
}

