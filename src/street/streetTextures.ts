// Canvas-drawn textures for the neighbourhood: building bays, shopfronts, asphalt, paving, plaster
// and the red-and-white barrier. Generated in code (no downloads), small and tiled. They follow the
// character of the satellite screenshots (sand, cream, pink and grey paint, flat roofs, many
// windows); they are not photographs of any real building.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

/** Paint colours of the buildings, sampled by eye from the screenshots. */
export const TINTS = ['#d9c7a3', '#e6d5b8', '#cdb48c', '#d8b6a6', '#bdb7ab', '#e9e2d1', '#c8a98b'] as const
/** Door colours of the lane buildings (one per paint colour, wrapping). */
export const DOORS = ['#5b3a29', '#2f4f6f', '#3d5d3f', '#6b6e72', '#7a2f2f'] as const
/** Sign colours of the shops (the last two are open shops with a lit interior). */
export const SIGNS = ['#2d5aa8', '#b8352f', '#2f8a4b', '#d98a1f', '#6b4a9a'] as const

function make(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  if (!g) throw new Error('2D canvas is not available')
  return [c, g]
}

function finish(c: HTMLCanvasElement): CanvasTexture {
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Tiny deterministic generator so every run draws the same speckles. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0
    return a / 4294967296
  }
}

/** Plaster: the base colour plus faint speckles and a darker streak under the roof edge. */
function plaster(g: CanvasRenderingContext2D, w: number, h: number, color: string, seed: number): void {
  g.fillStyle = color
  g.fillRect(0, 0, w, h)
  const r = rng(seed)
  for (let i = 0; i < 160; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(90,70,40,0.05)' : 'rgba(255,255,255,0.06)'
    const s = 1 + r() * 3
    g.fillRect(r() * w, r() * h, s, s)
  }
}

/** One bay (3.2 m) of one upper floor: a window, a sill, and the slab edge along the bottom. */
export function upperBayTexture(tint: number, variant: number): CanvasTexture {
  const [c, g] = make(128, 128)
  plaster(g, 128, 128, TINTS[tint % TINTS.length], 11 + tint * 7 + variant)
  // shadow under the slab above, lighter slab edge along the bottom
  g.fillStyle = 'rgba(0,0,0,0.10)'
  g.fillRect(0, 0, 128, 7)
  g.fillStyle = 'rgba(255,255,255,0.16)'
  g.fillRect(0, 118, 128, 10)
  g.fillStyle = 'rgba(0,0,0,0.12)'
  g.fillRect(0, 128 - 11, 128, 1.5)

  const wx = 38
  const wy = 24
  const ww = 52
  const wh = 64
  if (variant === 1) {
    // wooden shutters standing open on both sides of the window
    for (const [sx, dir] of [[wx - 20, 1], [wx + ww, 1]] as const) {
      g.fillStyle = '#5c4636'
      g.fillRect(sx, wy - 2, 20, wh + 4)
      g.strokeStyle = 'rgba(0,0,0,0.35)'
      g.lineWidth = 1
      for (let y = wy + 2; y < wy + wh; y += 5) {
        g.beginPath()
        g.moveTo(sx + 2, y + dir)
        g.lineTo(sx + 18, y)
        g.stroke()
      }
    }
  }
  // frame and glass
  g.fillStyle = '#efece4'
  g.fillRect(wx - 3, wy - 3, ww + 6, wh + 6)
  const glass = g.createLinearGradient(wx, wy, wx + ww, wy + wh)
  glass.addColorStop(0, '#41566a')
  glass.addColorStop(0.5, '#2b3b4a')
  glass.addColorStop(1, '#1d2833')
  g.fillStyle = glass
  g.fillRect(wx, wy, ww, wh)
  g.fillStyle = 'rgba(255,255,255,0.16)'
  g.beginPath()
  g.moveTo(wx, wy + 40)
  g.lineTo(wx + 26, wy)
  g.lineTo(wx + 40, wy)
  g.lineTo(wx, wy + 58)
  g.closePath()
  g.fill()
  g.fillStyle = '#efece4'
  g.fillRect(wx + ww / 2 - 1.5, wy, 3, wh)
  if (variant === 0) g.fillRect(wx, wy + wh * 0.45, ww, 3)
  // sill
  g.fillStyle = 'rgba(255,255,255,0.45)'
  g.fillRect(wx - 6, wy + wh + 3, ww + 12, 5)
  g.fillStyle = 'rgba(0,0,0,0.16)'
  g.fillRect(wx - 6, wy + wh + 8, ww + 12, 3)
  return finish(c)
}

/** One bay of a lane building's ground floor: a door, a small barred window, a dark plinth. */
export function groundBayTexture(tint: number): CanvasTexture {
  const [c, g] = make(128, 128)
  plaster(g, 128, 128, TINTS[tint % TINTS.length], 101 + tint * 13)
  g.fillStyle = 'rgba(0,0,0,0.10)'
  g.fillRect(0, 0, 128, 6)
  g.fillStyle = 'rgba(70,60,48,0.55)'
  g.fillRect(0, 112, 128, 16)
  // door
  const door = DOORS[tint % DOORS.length]
  g.fillStyle = '#efece4'
  g.fillRect(12, 38, 44, 90)
  g.fillStyle = door
  g.fillRect(15, 41, 38, 87)
  g.fillStyle = 'rgba(0,0,0,0.2)'
  g.fillRect(15, 41, 38, 3)
  g.strokeStyle = 'rgba(255,255,255,0.18)'
  g.lineWidth = 1
  g.strokeRect(21, 52, 26, 30)
  g.strokeRect(21, 88, 26, 24)
  g.fillStyle = '#d6c27a'
  g.beginPath()
  g.arc(47, 92, 2.2, 0, Math.PI * 2)
  g.fill()
  // small window with a grille
  g.fillStyle = '#efece4'
  g.fillRect(78, 46, 40, 40)
  g.fillStyle = '#26323d'
  g.fillRect(81, 49, 34, 34)
  g.strokeStyle = '#3a3a3c'
  g.lineWidth = 2
  for (let x = 87; x < 115; x += 9) {
    g.beginPath()
    g.moveTo(x, 49)
    g.lineTo(x, 83)
    g.stroke()
  }
  g.beginPath()
  g.moveTo(81, 66)
  g.lineTo(115, 66)
  g.stroke()
  return finish(c)
}

/** One bay (3.2 m × 4 m) of a shopfront on Ninety Street: a sign, then a shutter or a lit window. */
export function shopBayTexture(accent: number): CanvasTexture {
  const [c, g] = make(128, 160)
  plaster(g, 128, 160, '#e6dec9', 211 + accent)
  g.fillStyle = 'rgba(0,0,0,0.10)'
  g.fillRect(0, 0, 128, 6)
  // sign board with abstract lettering
  const sign = SIGNS[accent % SIGNS.length]
  g.fillStyle = sign
  g.fillRect(6, 10, 116, 30)
  g.fillStyle = 'rgba(255,255,255,0.88)'
  const r = rng(301 + accent * 17)
  let x = 14
  while (x < 108) {
    const w = 8 + r() * 16
    g.fillRect(x, 20, Math.min(w, 112 - x), 10)
    x += w + 5
  }
  g.fillStyle = 'rgba(0,0,0,0.25)'
  g.fillRect(6, 40, 116, 3)
  const open = accent >= 3
  if (open) {
    // an open shop: a glass front glowing warm, shelves inside
    const glow = g.createLinearGradient(0, 48, 0, 148)
    glow.addColorStop(0, '#e9c98a')
    glow.addColorStop(1, '#a97f45')
    g.fillStyle = '#5a5249'
    g.fillRect(8, 46, 112, 104)
    g.fillStyle = glow
    g.fillRect(12, 50, 104, 96)
    g.fillStyle = 'rgba(70,44,20,0.55)'
    for (const y of [74, 98, 122]) g.fillRect(12, y, 104, 3)
    for (let i = 0; i < 14; i++) {
      g.fillStyle = ['#c9423a', '#3a6fb0', '#e8e4d8', '#3a8a4a', '#e0a02f'][i % 5]
      g.fillRect(16 + (i % 7) * 14, i < 7 ? 62 : 86, 9, 11)
    }
    g.fillStyle = 'rgba(255,255,255,0.14)'
    g.fillRect(12, 50, 30, 96)
  } else {
    // a rolling shutter, closed
    const base = ['#9aa0a4', '#7e9fbf', '#7da386'][accent % 3]
    g.fillStyle = '#5a5249'
    g.fillRect(8, 46, 112, 106)
    g.fillStyle = base
    g.fillRect(11, 49, 106, 100)
    g.strokeStyle = 'rgba(0,0,0,0.22)'
    g.lineWidth = 1.5
    for (let y = 53; y < 148; y += 5) {
      g.beginPath()
      g.moveTo(11, y)
      g.lineTo(117, y)
      g.stroke()
    }
    g.fillStyle = 'rgba(0,0,0,0.28)'
    g.fillRect(60, 138, 8, 5)
  }
  g.fillStyle = 'rgba(70,60,48,0.55)'
  g.fillRect(0, 150, 128, 10)
  return finish(c)
}

/** Asphalt: dark grey with fine speckle. */
export function asphaltTexture(): CanvasTexture {
  const [c, g] = make(128, 128)
  g.fillStyle = '#505156'
  g.fillRect(0, 0, 128, 128)
  const r = rng(5)
  for (let i = 0; i < 700; i++) {
    const v = 60 + Math.floor(r() * 50)
    g.fillStyle = `rgba(${v},${v},${v + 3},0.35)`
    g.fillRect(r() * 128, r() * 128, 1 + r() * 2, 1 + r() * 2)
  }
  return finish(c)
}

/** Light-grey concrete paving, 2 m × 2 m in four slabs. */
export function pavingTexture(): CanvasTexture {
  const [c, g] = make(128, 128)
  g.fillStyle = '#bdbab1'
  g.fillRect(0, 0, 128, 128)
  const r = rng(9)
  for (let i = 0; i < 300; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(80,70,55,0.06)' : 'rgba(255,255,255,0.08)'
    g.fillRect(r() * 128, r() * 128, 2 + r() * 3, 2 + r() * 3)
  }
  g.strokeStyle = 'rgba(70,64,56,0.5)'
  g.lineWidth = 2
  g.strokeRect(0, 0, 128, 128)
  g.beginPath()
  g.moveTo(64, 0)
  g.lineTo(64, 128)
  g.moveTo(0, 64)
  g.lineTo(128, 64)
  g.stroke()
  return finish(c)
}

/** Plaster of the yard wall: cream, a darker band at the foot and a thin cap line. */
export function wallTexture(): CanvasTexture {
  const [c, g] = make(128, 128)
  plaster(g, 128, 128, '#e4dac3', 41)
  g.fillStyle = 'rgba(90,76,58,0.38)'
  g.fillRect(0, 100, 128, 28)
  g.fillStyle = 'rgba(255,255,255,0.22)'
  g.fillRect(0, 0, 128, 5)
  return finish(c)
}

/** Red and white diagonal stripes of a road-works barrier. */
export function barrierTexture(): CanvasTexture {
  const [c, g] = make(128, 128)
  g.fillStyle = '#f1efe9'
  g.fillRect(0, 0, 128, 128)
  g.fillStyle = '#c8322b'
  for (let k = -2; k < 4; k++) {
    g.beginPath()
    g.moveTo(k * 64, 128)
    g.lineTo(k * 64 + 32, 128)
    g.lineTo(k * 64 + 32 + 128, 0)
    g.lineTo(k * 64 + 128, 0)
    g.closePath()
    g.fill()
  }
  return finish(c)
}
