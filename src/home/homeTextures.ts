// Canvas-drawn textures for the home. Everything is generated in code (no downloads) and made
// small: 256–512 px, repeated. They approximate what is in the photographs; they are not scans.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

function make(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  if (!g) throw new Error('2D canvas is not available')
  return [c, g]
}

function finish(c: HTMLCanvasElement, repeat = true): CanvasTexture {
  const t = new CanvasTexture(c)
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

/**
 * Living-room floor: glossy dark brown tiles with a white lace ornament (fans in the corners,
 * scallops along the edges, a four-petal flower in the middle). 512 px = 2 × 2 tiles = 1.2 m.
 */
export function floorTileTexture(): CanvasTexture {
  const [c, g] = make(512, 512)
  for (let ty = 0; ty < 2; ty++) {
    for (let tx = 0; tx < 2; tx++) {
      const ox = tx * 256
      const oy = ty * 256
      const grad = g.createRadialGradient(ox + 128, oy + 128, 10, ox + 128, oy + 128, 190)
      grad.addColorStop(0, '#3b2a21')
      grad.addColorStop(1, '#221712')
      g.fillStyle = grad
      g.fillRect(ox, oy, 256, 256)

      g.strokeStyle = 'rgba(238,230,214,0.9)'
      g.lineWidth = 2.4
      // fans in the four corners
      for (const [cx, cy, a0] of [
        [0, 0, 0],
        [256, 0, Math.PI / 2],
        [256, 256, Math.PI],
        [0, 256, (3 * Math.PI) / 2],
      ] as const) {
        for (const r of [26, 40, 54, 68]) {
          g.beginPath()
          g.arc(ox + cx, oy + cy, r, a0, a0 + Math.PI / 2)
          g.stroke()
        }
      }
      // scallops along each edge
      for (let k = 0; k < 5; k++) {
        const t = 92 + k * 18
        for (const [x, y, a] of [
          [t, 16, 0],
          [t, 240, Math.PI],
          [16, t, -Math.PI / 2],
          [240, t, Math.PI / 2],
        ] as const) {
          g.beginPath()
          g.arc(ox + x, oy + y, 8, a, a + Math.PI)
          g.stroke()
        }
      }
      // four-petal flower in the middle
      for (const [dx, dy] of [
        [0, -20],
        [20, 0],
        [0, 20],
        [-20, 0],
      ] as const) {
        g.beginPath()
        g.arc(ox + 128 + dx, oy + 128 + dy, 20, 0, Math.PI * 2)
        g.stroke()
      }
      g.beginPath()
      g.arc(ox + 128, oy + 128, 5, 0, Math.PI * 2)
      g.stroke()

      g.strokeStyle = '#0e0907'
      g.lineWidth = 5
      g.strokeRect(ox + 1, oy + 1, 254, 254)
    }
  }
  return finish(c)
}

/** Glossy black stone with a few pale veins: the television wall. */
export function blackMarbleTexture(): CanvasTexture {
  const [c, g] = make(256, 256)
  g.fillStyle = '#0d0d10'
  g.fillRect(0, 0, 256, 256)
  const veins: [number, number, number, number, number, number, number][] = [
    [0, 40, 80, 10, 150, 90, 256],
    [0, 150, 70, 190, 160, 120, 256],
    [30, 256, 90, 190, 200, 210, 256],
    [120, 0, 150, 60, 110, 130, 190],
  ]
  for (const [x0, y0, cx, cy, cx2, cy2, x1] of veins) {
    g.strokeStyle = 'rgba(150,150,160,0.35)'
    g.lineWidth = 1.5
    g.beginPath()
    g.moveTo(x0, y0)
    g.bezierCurveTo(cx, cy, cx2, cy2, x1, y0 + 60)
    g.stroke()
    g.strokeStyle = 'rgba(210,210,220,0.18)'
    g.lineWidth = 0.8
    g.beginPath()
    g.moveTo(x0 + 6, y0 + 6)
    g.bezierCurveTo(cx + 8, cy + 8, cx2 + 8, cy2 + 8, x1, y0 + 66)
    g.stroke()
  }
  return finish(c)
}

/** Dark brown wood with horizontal grain: doors and the window frame. */
export function darkWoodTexture(): CanvasTexture {
  const [c, g] = make(128, 256)
  g.fillStyle = '#3b2519'
  g.fillRect(0, 0, 128, 256)
  for (let i = 0; i < 60; i++) {
    const y = Math.random() * 256
    g.strokeStyle = `rgba(${20 + Math.random() * 30},${10 + Math.random() * 14},6,${0.25 + Math.random() * 0.3})`
    g.lineWidth = 1 + Math.random() * 2
    g.beginPath()
    g.moveTo(0, y)
    g.bezierCurveTo(40, y + Math.random() * 6 - 3, 90, y + Math.random() * 6 - 3, 128, y)
    g.stroke()
  }
  return finish(c)
}

/** Sage-green quilted cover with a small floral lace pattern: the bed. */
export function comforterTexture(): CanvasTexture {
  const [c, g] = make(256, 256)
  g.fillStyle = '#9db8a8'
  g.fillRect(0, 0, 256, 256)
  g.strokeStyle = 'rgba(214,230,220,0.85)'
  g.lineWidth = 2
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const cx = 32 + x * 64 + (y % 2) * 32
      const cy = 32 + y * 64
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2
        g.beginPath()
        g.arc(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11, 8, 0, Math.PI * 2)
        g.stroke()
      }
      g.beginPath()
      g.arc(cx, cy, 4, 0, Math.PI * 2)
      g.stroke()
    }
  }
  return finish(c)
}

/** A warm, colourful evening scene for the television screen. */
export function tvScreenTexture(): CanvasTexture {
  const [c, g] = make(256, 144)
  const grad = g.createLinearGradient(0, 0, 256, 144)
  grad.addColorStop(0, '#3b2b55')
  grad.addColorStop(0.5, '#c9674a')
  grad.addColorStop(1, '#e8b25a')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 144)
  g.fillStyle = 'rgba(20,12,24,0.55)'
  g.beginPath()
  g.arc(90, 80, 34, 0, Math.PI * 2)
  g.fill()
  g.beginPath()
  g.arc(160, 84, 30, 0, Math.PI * 2)
  g.fill()
  return finish(c, false)
}

/** Faint white marble for the dining table and the bathroom. */
export function whiteMarbleTexture(): CanvasTexture {
  const [c, g] = make(256, 256)
  g.fillStyle = '#f2efe8'
  g.fillRect(0, 0, 256, 256)
  g.strokeStyle = 'rgba(160,150,135,0.28)'
  g.lineWidth = 1.2
  for (const [x0, y0, x1, y1] of [
    [0, 30, 256, 90],
    [0, 150, 256, 120],
    [60, 0, 120, 256],
  ] as const) {
    g.beginPath()
    g.moveTo(x0, y0)
    g.bezierCurveTo(x0 + 80, y0 + 30, x1 - 80, y1 - 30, x1, y1)
    g.stroke()
  }
  return finish(c)
}
