// Layout of the neighbourhood around the home (Stage 5), shared by the scene (what is drawn) and
// the physics (what the player bumps into) so the two can never drift apart. Pure data and pure
// functions: no three.js, no React, so scripts/test-street.mjs can check it on plain Node.
//
// Ground plane (x, z) in metres, like the rest of the game: +x is east, -z is north. The home keeps
// the coordinates it had in Stage 4 (its front door is at x 2.5, z 0.1 on the south wall).
//
// WHAT IS REAL AND WHAT IS ESTIMATED. The only references for the outdoors are satellite
// screenshots of Ninety Street (شارع التسعين): a wide divided road, and east and west of it blocks
// of tightly packed, flat-roofed buildings of two to six floors in sand, cream, pink and grey,
// cut by narrow lanes. Everything here follows that general character; the exact position of the
// home on the map, the lane widths, the building sizes and the yard are ESTIMATES until the user
// sends the home's location and street-level photographs. Moving something later is a data edit.
import type { Bounds, Collider } from '../controls/movement.ts'
import { FRONT_DOOR, PORCH, WALL_T } from '../home/homeLayout.ts'

export interface Rect {
  x0: number
  x1: number
  z0: number
  z1: number
}

export type Face = 'N' | 'S' | 'E' | 'W'

// ---------------------------------------------------------------------------------------------
// The home's plot: a walled yard around the house, with a gate onto the lane.
// ---------------------------------------------------------------------------------------------

export const PLOT = { x0: -1.8, x1: 8.8, z0: -10.6, z1: 4.6, wallT: 0.25, wallH: 2.2 }
/** The gate opening in the south wall (leaves stand open against the inside of the wall). */
export const GATE = { x0: 1.5, x1: 3.5, h: 1.9 }

/** The house seen from above: outer faces of its walls, as three rectangles that do not overlap. */
export const HOUSE_RECTS: Rect[] = [
  { x0: -0.2, x1: 3.6, z0: -6.6, z1: 0.2 }, // living room
  { x0: 3.6, x1: 7.2, z0: -6.6, z1: -2.6 }, // bedroom
  { x0: 1.8, x1: 7.2, z0: -9.2, z1: -6.6 }, // dining area and bathroom
]
export const ROOF = { y0: 2.9, y1: 3.06, parapetH: 0.45, parapetT: 0.2 }
/** Parapet along the outline of the roof: [x0, z0, x1, z1] centre lines, outline walked once. */
export const PARAPET_LINES: [number, number, number, number][] = [
  [-0.2, 0.2, 3.6, 0.2],
  [3.6, 0.2, 3.6, -2.6],
  [3.6, -2.6, 7.2, -2.6],
  [7.2, -2.6, 7.2, -9.2],
  [7.2, -9.2, 1.8, -9.2],
  [1.8, -9.2, 1.8, -6.6],
  [1.8, -6.6, -0.2, -6.6],
  [-0.2, -6.6, -0.2, 0.2],
]
/** The water tank on the roof, over the bedroom. */
export const ROOF_TANK = { x: 5.4, z: -4.6, r: 0.6, h: 1.2 }

// ---------------------------------------------------------------------------------------------
// Roads. Lanes run east-west (and two cross lanes north-south); Ninety Street runs north-south.
// ---------------------------------------------------------------------------------------------

export const LANE_W = 6
export const LANES: { id: string; rect: Rect }[] = [
  { id: 'lane-north', rect: { x0: -56, x1: 64, z0: -30, z1: -24 } },
  { id: 'lane-home', rect: { x0: -56, x1: 64, z0: PLOT.z1, z1: PLOT.z1 + LANE_W } },
  { id: 'lane-south', rect: { x0: -56, x1: 64, z0: 26.6, z1: 32.6 } },
  { id: 'cross-west', rect: { x0: -26, x1: -20, z0: -30, z1: 32.6 } },
  { id: 'cross-east', rect: { x0: 28, x1: 34, z0: -30, z1: 32.6 } },
]

/** Ninety Street: pavement, carriageway, median, carriageway, pavement (west to east). */
export const BOULEVARD = {
  x0: 64,
  x1: 94,
  z0: -70,
  z1: 70,
  pavementW: [64, 67] as [number, number],
  carriageW: [67, 77.5] as [number, number],
  median: [77.5, 80.5] as [number, number],
  carriageE: [80.5, 91] as [number, number],
  pavementE: [91, 94] as [number, number],
}

/** Road surface pieces that do not overlap (so nothing flickers where roads meet). */
export const ASPHALT: Rect[] = [
  { x0: -56, x1: 64, z0: -30, z1: -24 },
  { x0: -56, x1: 64, z0: PLOT.z1, z1: PLOT.z1 + LANE_W },
  { x0: -56, x1: 64, z0: 26.6, z1: 32.6 },
  ...[
    [-26, -20],
    [28, 34],
  ].flatMap(([x0, x1]): Rect[] => [
    { x0, x1, z0: -24, z1: PLOT.z1 },
    { x0, x1, z0: PLOT.z1 + LANE_W, z1: 26.6 },
  ]),
  { x0: BOULEVARD.carriageW[0], x1: BOULEVARD.carriageW[1], z0: BOULEVARD.z0, z1: BOULEVARD.z1 },
  { x0: BOULEVARD.carriageE[0], x1: BOULEVARD.carriageE[1], z0: BOULEVARD.z0, z1: BOULEVARD.z1 },
]

/** Paved pieces of Ninety Street: both pavements and the median. */
export const PAVING: Rect[] = [
  { x0: BOULEVARD.pavementW[0], x1: BOULEVARD.pavementW[1], z0: BOULEVARD.z0, z1: BOULEVARD.z1 },
  { x0: BOULEVARD.median[0], x1: BOULEVARD.median[1], z0: BOULEVARD.z0, z1: BOULEVARD.z1 },
  { x0: BOULEVARD.pavementE[0], x1: BOULEVARD.pavementE[1], z0: BOULEVARD.z0, z1: BOULEVARD.z1 },
]

/** Where the lane in front of the home meets Ninety Street (a pedestrian crossing is painted here). */
export const CROSSING = { z0: 6.1, z1: 9.1 }

/** The playable area. Everything beyond is scenery that fades into the haze. */
export const WORLD_BOUNDS: Bounds = { minX: -56, maxX: 124, minZ: -31, maxZ: 33.2 }

/**
 * A road-works barrier closes Ninety Street at its south end. (Until Stage 6 there was one at the north end
 * too; since Stage 7 the road goes on north to the roundabout and the university, see streets/routeLayout.ts.)
 */
export const BARRIERS: Rect[] = [{ x0: BOULEVARD.x0, x1: BOULEVARD.x1, z0: 32.6, z1: 33.2 }]
export const BARRIER_H = 1.1

// ---------------------------------------------------------------------------------------------
// Buildings. Rows of lots along the roads, generated with a fixed seed so the street is always
// the same (and the tests can check it). Every lot is a solid block from the street line back.
// ---------------------------------------------------------------------------------------------

export type LotStyle = 'house' | 'lane' | 'shop' | 'closing'

export const FLOOR_H = 3.2
export const SHOP_H = 4
export const PARAPET_H = 0.6
export const TINT_COUNT = 7

export interface Lot {
  id: string
  rect: Rect
  /** The side that faces the road. */
  face: Face
  style: LotStyle
  floors: number
  /** Height of the ground floor (shops are taller). */
  groundH: number
  /** Height of the walls up to the roof edge (without the parapet). */
  height: number
  tint: number
  /** Window style: 0 sliding windows, 1 shuttered windows. */
  win: number
  /** Door colour (lane buildings) or shutter colour (shops). */
  accent: number
  tank: boolean
}

export interface Row {
  id: string
  rect: Rect
  axis: 'x' | 'z'
  face: Face
  style: LotStyle
}

const R = (x0: number, x1: number, z0: number, z1: number): Rect => ({ x0, x1, z0, z1 })

/** Home block and its neighbours: west, home and east segments between the cross lanes. */
const SEGMENTS: [number, number][] = [
  [-56, -26],
  [-20, 28],
  [34, 50],
]

function rows(): Row[] {
  const out: Row[] = []
  // north of the north lane and south of the south lane: one continuous wall of buildings
  out.push({ id: 'north', rect: R(-70, 50, -44, -30), axis: 'x', face: 'S', style: 'lane' })
  out.push({ id: 'south', rect: R(-70, 50, 32.6, 44.6), axis: 'x', face: 'N', style: 'lane' })
  // the end of the lanes in the west
  out.push({ id: 'west-end', rect: R(-70, -56, -30, 32.6), axis: 'z', face: 'E', style: 'closing' })
  SEGMENTS.forEach(([x0, x1], i) => {
    const near = i === 1
    out.push({ id: `hn${i}`, rect: R(x0, x1, -24, PLOT.z0), axis: 'x', face: 'N', style: 'lane' })
    out.push({ id: `s1-${i}`, rect: R(x0, x1, PLOT.z1 + LANE_W, 26.6), axis: 'x', face: 'N', style: 'lane' })
    if (near) {
      // the home's own plot sits between these two rows of low houses
      out.push({ id: 'hs-west', rect: R(x0, PLOT.x0, PLOT.z0, PLOT.z1), axis: 'x', face: 'S', style: 'house' })
      out.push({ id: 'hs-east', rect: R(PLOT.x1, x1, PLOT.z0, PLOT.z1), axis: 'x', face: 'S', style: 'house' })
    } else {
      out.push({ id: `hs${i}`, rect: R(x0, x1, PLOT.z0, PLOT.z1), axis: 'x', face: 'S', style: 'lane' })
    }
  })
  // Ninety Street: shops and flats facing it on both sides, as far as the eye reaches
  const west: [number, number][] = [
    [-70, -30],
    [-24, PLOT.z1],
    [PLOT.z1 + LANE_W, 26.6],
    [32.6, 70],
  ]
  west.forEach(([z0, z1], i) => out.push({ id: `blvd-w${i}`, rect: R(50, 64, z0, z1), axis: 'z', face: 'E', style: 'shop' }))
  out.push({ id: 'blvd-e', rect: R(94, 124, -70, 70), axis: 'z', face: 'W', style: 'shop' })
  return out
}

/** Small fixed-seed random generator (mulberry32), so the street never changes between runs. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const AVG_WIDTH: Record<LotStyle, number> = { house: 9, lane: 10, shop: 13, closing: 12 }
const MIN_WIDTH = 6.5

function pickFloors(style: LotStyle, r: number): number {
  const table: Record<LotStyle, number[]> = {
    house: [1, 1, 2, 2],
    lane: [1, 2, 2, 2, 3, 3, 3, 4, 4],
    shop: [3, 3, 4, 4, 4, 5, 5, 6],
    closing: [3, 4, 4, 5],
  }
  const t = table[style]
  return t[Math.min(t.length - 1, Math.floor(r * t.length))]
}

/** Splits a row into lots of varied widths that exactly fill it. */
export function splitRow(row: Row, rng: () => number): Lot[] {
  const { rect, axis, style } = row
  const a0 = axis === 'x' ? rect.x0 : rect.z0
  const a1 = axis === 'x' ? rect.x1 : rect.z1
  const len = a1 - a0
  let n = Math.max(1, Math.round(len / AVG_WIDTH[style]))
  while (n > 1 && len / n < MIN_WIDTH) n--
  const weights = Array.from({ length: n }, () => 0.75 + rng() * 0.5)
  const sum = weights.reduce((p, q) => p + q, 0)
  const lots: Lot[] = []
  let cursor = a0
  weights.forEach((w, i) => {
    const next = i === n - 1 ? a1 : cursor + (w / sum) * len
    const r: Rect = axis === 'x' ? { x0: cursor, x1: next, z0: rect.z0, z1: rect.z1 } : { x0: rect.x0, x1: rect.x1, z0: cursor, z1: next }
    const floors = pickFloors(style, rng())
    const groundH = style === 'shop' ? SHOP_H : FLOOR_H
    lots.push({
      id: `${row.id}:${i}`,
      rect: r,
      face: row.face,
      style,
      floors,
      groundH,
      height: groundH + (floors - 1) * FLOOR_H,
      tint: Math.floor(rng() * TINT_COUNT),
      win: rng() < 0.5 ? 0 : 1,
      accent: Math.floor(rng() * 5),
      tank: floors >= 2 && rng() < 0.45,
    })
    cursor = next
  })
  return lots
}

export const LOTS: Lot[] = (() => {
  const rng = mulberry32(90)
  return rows().flatMap((row) => splitRow(row, rng))
})()

// ---------------------------------------------------------------------------------------------
// Props: street lamps and palms in the median, litter bins in the lanes, a palm in the yard.
// ---------------------------------------------------------------------------------------------

const MEDIAN_X = (BOULEVARD.median[0] + BOULEVARD.median[1]) / 2
const MEDIAN_ZS = [-27, -18, -9, 0, 9, 18, 27]
export const LAMPS: { x: number; z: number }[] = MEDIAN_ZS.filter((_, i) => i % 2 === 0).map((z) => ({ x: MEDIAN_X, z }))
export const PALMS: { x: number; z: number; h: number }[] = [
  ...MEDIAN_ZS.filter((_, i) => i % 2 === 1).map((z) => ({ x: MEDIAN_X, z, h: 5.2 })),
  { x: 7.9, z: 2.9, h: 4.4 },
]
/** Litter bins standing against the lane walls. */
export const BINS: { x: number; z: number }[] = [
  { x: -14, z: PLOT.z1 + 0.35 },
  { x: 20, z: PLOT.z1 + LANE_W - 0.35 },
  { x: 44, z: PLOT.z1 + 0.35 },
  { x: -38, z: PLOT.z1 + LANE_W - 0.35 },
  { x: 10, z: -24.35 },
  { x: -3, z: 26.95 },
  { x: 40, z: 26.95 },
  { x: -48, z: 4.95 },
]
export const BIN = { hw: 0.28, hd: 0.28, h: 0.95 }
export const LAMP_R = 0.12
export const PALM_R = 0.22

// ---------------------------------------------------------------------------------------------
// Colliders
// ---------------------------------------------------------------------------------------------

const box = (r: Rect, height: number): Collider => ({
  kind: 'box',
  x: (r.x0 + r.x1) / 2,
  z: (r.z0 + r.z1) / 2,
  hw: (r.x1 - r.x0) / 2,
  hd: (r.z1 - r.z0) / 2,
  height,
})

/** The wall around the yard, as rectangles inside the plot edge (the south wall has the gate in it). */
export const PLOT_WALLS: Rect[] = (() => {
  const t = PLOT.wallT
  return [
    { x0: PLOT.x0, x1: PLOT.x0 + t, z0: PLOT.z0, z1: PLOT.z1 },
    { x0: PLOT.x1 - t, x1: PLOT.x1, z0: PLOT.z0, z1: PLOT.z1 },
    { x0: PLOT.x0 + t, x1: PLOT.x1 - t, z0: PLOT.z0, z1: PLOT.z0 + t },
    { x0: PLOT.x0 + t, x1: GATE.x0, z0: PLOT.z1 - t, z1: PLOT.z1 },
    { x0: GATE.x1, x1: PLOT.x1 - t, z0: PLOT.z1 - t, z1: PLOT.z1 },
  ]
})()

export const STREET_COLLIDERS: Collider[] = [
  ...LOTS.map((l) => box(l.rect, l.height + PARAPET_H)),
  ...PLOT_WALLS.map((w) => box(w, PLOT.wallH)),
  ...BARRIERS.map((b) => box(b, BARRIER_H)),
  ...LAMPS.map((l): Collider => ({ kind: 'circle', x: l.x, z: l.z, r: LAMP_R, height: 6.5 })),
  ...PALMS.map((p): Collider => ({ kind: 'circle', x: p.x, z: p.z, r: PALM_R, height: p.h })),
  ...BINS.map((b): Collider => ({ kind: 'box', x: b.x, z: b.z, hw: BIN.hw, hd: BIN.hd, height: BIN.h })),
]

// ---------------------------------------------------------------------------------------------
// Where she is: names for the HUD, and the indoor / outdoor switch for the camera and the light.
// ---------------------------------------------------------------------------------------------

export type ZoneId = 'home' | 'yard' | 'lane' | 'boulevard' | 'junction' | 'shaab' | 'university' | 'lobby' | 'corridor' | 'hall1' | 'hall2' | 'office' | 'courtyard'

export const ZONE_NAMES: Record<ZoneId, string> = {
  home: 'At home',
  yard: 'Home yard',
  lane: 'Neighbourhood lane',
  boulevard: 'Ninety Street',
  junction: 'Ninety Street roundabout',
  shaab: 'Al-Shaab Street',
  university: 'University of Science & Technology',
  lobby: 'University lobby',
  corridor: 'Ground-floor corridor',
  hall1: 'Grand Hall',
  hall2: 'Hall 313',
  office: 'Student Affairs office',
  courtyard: 'University courtyard',
}

const inRect = (r: Rect, x: number, z: number) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1

/** True inside the house (its outer wall faces), where the camera stays under the ceiling. */
export function insideHome(x: number, z: number): boolean {
  return HOUSE_RECTS.some((r) => inRect(r, x, z))
}

export function zoneAt(x: number, z: number): ZoneId {
  if (insideHome(x, z)) return 'home'
  if (inRect({ x0: PLOT.x0, x1: PLOT.x1, z0: PLOT.z0, z1: PLOT.z1 }, x, z)) return 'yard'
  if (x >= BOULEVARD.x0 && x <= BOULEVARD.x1) return 'boulevard'
  return 'lane'
}

/** Where she stands on the porch, just outside the open front door (used by tests and ?at=). */
export const PORCH_SPOT = { x: FRONT_DOOR.x, z: PORCH.z0 + 0.5, heading: 0 }

/** Wall thickness of the house, re-exported so the scene and the tests share one number. */
export const HOUSE_WALL_T = WALL_T
