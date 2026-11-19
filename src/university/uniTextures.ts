// Canvas-drawn textures of the university's courtyard and inside (Stage 8): the courtyard facades with their
// black-framed windows and balcony rails, the zigzag frieze, floors, the lawn, signs, the emblem and the
// boards. Generated in code like the rest of the world; they follow the character of the user's photographs
// (cream stone, black ironwork, blue awnings, pink-and-cream paving) and are NOT a survey of the real building.
import type { CanvasTexture } from 'three'
import { finish, make, plaster, rng } from '../street/streetTextures.ts'

const STONE = '#e3d6b6'
const BRICK = '#d3bf93'
const IRON = '#25272b'

/** Course lines of a stone facade. */
function courses(g: CanvasRenderingContext2D, w: number, h: number, step: number): void {
  g.strokeStyle = 'rgba(120,100,70,0.16)'
  g.lineWidth = 2
  for (let y = step / 2; y < h; y += step) {
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(w, y)
    g.stroke()
  }
}

/**
 * One bay (4.4 m wide, 4.2 m high) of a courtyard facade: a black-framed window with a balcony rail on the upper
 * floors, a barred window on the ground floor and a blue awning on the top floor.
 */
export function courtBayTexture(kind: 'ground' | 'mid' | 'top'): CanvasTexture {
  const [c, g] = make(256, 256)
  plaster(g, 256, 256, STONE, kind === 'ground' ? 21 : kind === 'mid' ? 23 : 27)
  courses(g, 256, 256, 32)
  // the brick-coloured pilaster between bays
  g.fillStyle = BRICK
  g.fillRect(0, 0, 14, 256)
  g.fillRect(242, 0, 14, 256)
  if (kind === 'ground') {
    // a barred window, high on the wall
    g.fillStyle = IRON
    g.fillRect(52, 86, 152, 110)
    g.fillStyle = '#9db3c4'
    g.fillRect(58, 92, 140, 98)
    g.strokeStyle = IRON
    g.lineWidth = 3
    for (let x = 70; x < 198; x += 17) {
      g.beginPath()
      g.moveTo(x, 92)
      g.lineTo(x, 190)
      g.stroke()
    }
    g.beginPath()
    g.moveTo(58, 141)
    g.lineTo(198, 141)
    g.stroke()
  } else {
    // a tall window split into panes, and a balcony rail across the lower part
    g.fillStyle = IRON
    g.fillRect(44, 46, 168, 150)
    g.fillStyle = '#b6c8d6'
    g.fillRect(50, 52, 156, 138)
    g.strokeStyle = '#eef2f4'
    g.lineWidth = 3
    for (const x of [89, 128, 167]) {
      g.beginPath()
      g.moveTo(x, 52)
      g.lineTo(x, 190)
      g.stroke()
    }
    g.beginPath()
    g.moveTo(50, 100)
    g.lineTo(206, 100)
    g.stroke()
    // the balcony rail: a black top bar and vertical bars with a few scrolls
    g.strokeStyle = IRON
    g.lineWidth = 5
    g.beginPath()
    g.moveTo(30, 158)
    g.lineTo(226, 158)
    g.moveTo(30, 232)
    g.lineTo(226, 232)
    g.stroke()
    g.lineWidth = 3
    for (let x = 36; x < 226; x += 14) {
      g.beginPath()
      g.moveTo(x, 158)
      g.lineTo(x, 232)
      g.stroke()
    }
    g.beginPath()
    g.arc(128, 195, 22, 0, Math.PI * 2)
    g.stroke()
    if (kind === 'top') {
      // a blue awning over the window
      g.fillStyle = '#2f6bb8'
      g.fillRect(24, 22, 208, 22)
      g.fillStyle = '#244f8a'
      g.fillRect(24, 40, 208, 6)
    }
  }
  g.fillStyle = 'rgba(0,0,0,0.1)'
  g.fillRect(0, 0, 256, 10)
  g.fillStyle = 'rgba(255,255,255,0.18)'
  g.fillRect(0, 244, 256, 12)
  return finish(c)
}

/** The geometric frieze under the roofline of the courtyard: a row of dark triangles on a cream band (3 m per tile). */
export function friezeTexture(): CanvasTexture {
  const [c, g] = make(256, 48)
  g.fillStyle = '#e8dcbc'
  g.fillRect(0, 0, 256, 48)
  g.fillStyle = '#6b5236'
  g.fillRect(0, 0, 256, 6)
  g.fillRect(0, 42, 256, 6)
  for (let x = 0; x < 256; x += 64) {
    g.beginPath()
    g.moveTo(x + 6, 40)
    g.lineTo(x + 32, 10)
    g.lineTo(x + 58, 40)
    g.closePath()
    g.fill()
    g.fillStyle = '#e8dcbc'
    g.beginPath()
    g.moveTo(x + 20, 40)
    g.lineTo(x + 32, 24)
    g.lineTo(x + 44, 40)
    g.closePath()
    g.fill()
    g.fillStyle = '#6b5236'
  }
  return finish(c)
}

/** The lobby floor: polished warm-grey granite in 1 m squares (one tile of the texture is 2 m). */
export function graniteTexture(): CanvasTexture {
  const [c, g] = make(256, 256)
  g.fillStyle = '#b9b3a6'
  g.fillRect(0, 0, 256, 256)
  const r = rng(31)
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(60,55,50,0.22)' : 'rgba(255,255,255,0.28)'
    const s = 1 + r() * 2.4
    g.fillRect(r() * 256, r() * 256, s, s)
  }
  g.strokeStyle = 'rgba(70,64,56,0.55)'
  g.lineWidth = 3
  for (const p of [0, 128]) {
    g.beginPath()
    g.moveTo(p, 0)
    g.lineTo(p, 256)
    g.moveTo(0, p)
    g.lineTo(256, p)
    g.stroke()
  }
  return finish(c)
}

/** The corridor floor: cream ceramic tiles with a dark joint (one tile of the texture is 2 m, four tiles). */
export function corridorTileTexture(): CanvasTexture {
  const [c, g] = make(256, 256)
  g.fillStyle = '#d8cdb3'
  g.fillRect(0, 0, 256, 256)
  const r = rng(37)
  for (let i = 0; i < 500; i++) {
    g.fillStyle = 'rgba(120,100,70,0.09)'
    g.fillRect(r() * 256, r() * 256, 2 + r() * 4, 2)
  }
  g.strokeStyle = 'rgba(110,96,72,0.6)'
  g.lineWidth = 2
  for (const p of [0, 128]) {
    g.beginPath()
    g.moveTo(p, 0)
    g.lineTo(p, 256)
    g.moveTo(0, p)
    g.lineTo(256, p)
    g.stroke()
  }
  return finish(c)
}

/** The classroom floor: grey-blue speckled vinyl (one tile of the texture is 2 m). */
export function vinylTexture(): CanvasTexture {
  const [c, g] = make(128, 128)
  g.fillStyle = '#8b97a3'
  g.fillRect(0, 0, 128, 128)
  const r = rng(41)
  for (let i = 0; i < 700; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(40,50,60,0.18)'
    g.fillRect(r() * 128, r() * 128, 1 + r() * 2, 1 + r() * 2)
  }
  return finish(c)
}

/** The courtyard paving: pink and cream tiles in a diamond pattern (one tile of the texture is 2 m, 4 × 4 tiles). */
export function courtPavingTexture(): CanvasTexture {
  const [c, g] = make(256, 256)
  g.fillStyle = '#d9c8aa'
  g.fillRect(0, 0, 256, 256)
  for (let j = 0; j < 8; j++) {
    for (let i = 0; i < 8; i++) {
      const pink = (i + j) % 2 === 0
      g.fillStyle = pink ? '#c9998a' : '#e4d6b8'
      g.fillRect(i * 32 + 2, j * 32 + 2, 28, 28)
      if (pink) {
        g.fillStyle = 'rgba(255,255,255,0.18)'
        g.fillRect(i * 32 + 12, j * 32 + 12, 8, 8)
      }
    }
  }
  const r = rng(43)
  for (let i = 0; i < 300; i++) {
    g.fillStyle = 'rgba(80,60,40,0.08)'
    g.fillRect(r() * 256, r() * 256, 2, 2)
  }
  return finish(c)
}

/** A trimmed lawn with a few bare patches (one tile of the texture is 4 m). */
export function lawnTexture(): CanvasTexture {
  const [c, g] = make(128, 128)
  g.fillStyle = '#5c8f3e'
  g.fillRect(0, 0, 128, 128)
  const r = rng(47)
  for (let i = 0; i < 900; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(30,70,20,0.28)' : 'rgba(150,190,80,0.28)'
    g.fillRect(r() * 128, r() * 128, 1, 2 + r() * 3)
  }
  for (let i = 0; i < 5; i++) {
    g.fillStyle = 'rgba(176,160,90,0.35)'
    g.beginPath()
    g.ellipse(r() * 128, r() * 128, 8 + r() * 10, 4 + r() * 6, r() * 3, 0, Math.PI * 2)
    g.fill()
  }
  return finish(c)
}

/**
 * The part of the entrance above the doorway (5 m × 14.15 m): a pediment band, three tall wrought-iron grilles
 * on dark glass, and a crenellated stone arch trim over the door, after the photographs.
 */
export function entranceTopTexture(): CanvasTexture {
  const W = 256
  const H = 720
  const [c, g] = make(W, H)
  plaster(g, W, H, STONE, 71)
  courses(g, W, H, 32)
  // the pediment: a darker band with a blue stripe (the top 1.4 m)
  g.fillStyle = '#d6c8a4'
  g.fillRect(0, 0, W, 71)
  g.fillStyle = '#2b4f98'
  g.fillRect(0, 56, W, 9)
  // three grilles, one per floor (each 204 px = 4 m tall, the window itself 3.4 m)
  for (let i = 0; i < 3; i++) {
    const top = 71 + i * 204 + 12
    g.fillStyle = '#1d2024'
    g.fillRect(24, top, 208, 172)
    g.fillStyle = '#41505e'
    g.fillRect(32, top + 8, 192, 156)
    g.strokeStyle = IRON
    g.lineWidth = 3
    for (let x = 44; x < 224; x += 14) {
      g.beginPath()
      g.moveTo(x, top + 8)
      g.lineTo(x, top + 164)
      g.stroke()
    }
    // scrolls and a central ring
    g.lineWidth = 3
    for (const y of [top + 46, top + 126]) {
      g.beginPath()
      g.arc(80, y, 16, 0, Math.PI * 2)
      g.arc(176, y, 16, 0, Math.PI * 2)
      g.stroke()
    }
    g.beginPath()
    g.arc(128, top + 86, 24, 0, Math.PI * 2)
    g.stroke()
    g.beginPath()
    g.moveTo(32, top + 86)
    g.lineTo(224, top + 86)
    g.stroke()
  }
  // the crenellated trim over the door: a dark band with merlons along its top edge (the bottom 0.75 m)
  g.fillStyle = '#2b2d31'
  g.fillRect(0, H - 37, W, 37)
  for (let x = 0; x < W; x += 32) g.fillRect(x + 4, H - 49, 20, 14)
  return finish(c)
}

/** A sign: text on a coloured board (the name in English, and a line under it when given). */
export function signTexture(title: string, bg: string, sub = ''): CanvasTexture {
  const [c, g] = make(512, 128)
  g.fillStyle = bg
  g.fillRect(0, 0, 512, 128)
  g.strokeStyle = 'rgba(255,255,255,0.85)'
  g.lineWidth = 5
  g.strokeRect(6, 6, 500, 116)
  g.fillStyle = '#ffffff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = 'bold 54px "Segoe UI",Arial,Helvetica,sans-serif'
  g.fillText(title, 256, sub ? 46 : 64)
  if (sub) {
    g.font = '32px "Segoe UI",Arial,Helvetica,sans-serif'
    g.fillText(sub, 256, 96)
  }
  return finish(c)
}

/** A round emblem: an open book under a rising sun inside a double ring, in blue and gold. It is an invented badge, not the university's own logo. */
export function emblemTexture(): CanvasTexture {
  const [c, g] = make(256, 256)
  g.fillStyle = '#16396f'
  g.beginPath()
  g.arc(128, 128, 124, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = '#e0b84a'
  g.lineWidth = 7
  g.beginPath()
  g.arc(128, 128, 112, 0, Math.PI * 2)
  g.stroke()
  g.lineWidth = 3
  g.beginPath()
  g.arc(128, 128, 98, 0, Math.PI * 2)
  g.stroke()
  // sun
  g.fillStyle = '#f2cf62'
  g.beginPath()
  g.arc(128, 118, 30, Math.PI, 0)
  g.fill()
  g.strokeStyle = '#f2cf62'
  g.lineWidth = 4
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i * Math.PI) / 6
    g.beginPath()
    g.moveTo(128 + Math.cos(a) * 38, 118 + Math.sin(a) * 38)
    g.lineTo(128 + Math.cos(a) * 54, 118 + Math.sin(a) * 54)
    g.stroke()
  }
  // open book
  g.fillStyle = '#f4efe0'
  g.beginPath()
  g.moveTo(128, 134)
  g.quadraticCurveTo(92, 120, 54, 134)
  g.lineTo(54, 176)
  g.quadraticCurveTo(92, 162, 128, 176)
  g.quadraticCurveTo(164, 162, 202, 176)
  g.lineTo(202, 134)
  g.quadraticCurveTo(164, 120, 128, 134)
  g.fill()
  g.strokeStyle = '#16396f'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(128, 134)
  g.lineTo(128, 176)
  g.stroke()
  return finish(c)
}

/** A cork notice board with a few pinned sheets. */
export function noticeBoardTexture(): CanvasTexture {
  const [c, g] = make(384, 192)
  g.fillStyle = '#7a5a3a'
  g.fillRect(0, 0, 384, 192)
  g.fillStyle = '#c4986a'
  g.fillRect(8, 8, 368, 176)
  const r = rng(53)
  for (let i = 0; i < 400; i++) {
    g.fillStyle = 'rgba(90,60,30,0.2)'
    g.fillRect(8 + r() * 368, 8 + r() * 176, 2, 2)
  }
  const sheets = ['#f4f1e8', '#e8f0f6', '#f6efd2', '#f4f1e8', '#efe3e3', '#e3efe3']
  sheets.forEach((col, i) => {
    const x = 22 + (i % 3) * 118 + r() * 10
    const y = 20 + Math.floor(i / 3) * 84 + r() * 8
    g.fillStyle = col
    g.fillRect(x, y, 92, 70)
    g.fillStyle = 'rgba(40,40,40,0.55)'
    for (let l = 0; l < 6; l++) g.fillRect(x + 8, y + 10 + l * 10, 52 + r() * 24, 3)
    g.fillStyle = '#b83030'
    g.beginPath()
    g.arc(x + 46, y + 4, 4, 0, Math.PI * 2)
    g.fill()
  })
  return finish(c)
}

/** A whiteboard: white, with a few lines of faint writing and a diagram. */
export function whiteboardTexture(): CanvasTexture {
  const [c, g] = make(512, 224)
  g.fillStyle = '#f5f6f4'
  g.fillRect(0, 0, 512, 224)
  g.strokeStyle = '#a7aaa8'
  g.lineWidth = 6
  g.strokeRect(3, 3, 506, 218)
  g.strokeStyle = 'rgba(34,70,150,0.55)'
  g.lineWidth = 3
  const r = rng(59)
  for (let l = 0; l < 4; l++) {
    g.beginPath()
    let x = 34
    const y = 44 + l * 30
    g.moveTo(x, y)
    while (x < 250 + r() * 120) {
      x += 8 + r() * 10
      g.lineTo(x, y + (r() - 0.5) * 9)
    }
    g.stroke()
  }
  g.strokeStyle = 'rgba(170,40,40,0.6)'
  g.beginPath()
  g.arc(420, 120, 44, 0, Math.PI * 2)
  g.moveTo(420, 76)
  g.lineTo(420, 164)
  g.stroke()
  return finish(c)
}
