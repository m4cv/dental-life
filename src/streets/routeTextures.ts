// Canvas-drawn textures of the university's front (Stage 7): the cream stone with arched windows, the
// grand entrance and the sign over the gate. Generated in code like the rest of the street; they follow
// the character of the user's photographs (cream stone, arches, blue accents, a red carpet on the
// steps) and are NOT a survey of the real building: its exact proportions are still an estimate.
import type { CanvasTexture } from 'three'
import { finish, make, plaster, rng } from '../street/streetTextures.ts'

const STONE = '#e7dbbd'
const FRAME = '#cdbf9c'
const GLASS_TOP = '#46688f'
const GLASS_BOTTOM = '#27415f'

/** An arched window (frame, glass, a crossbar and a sill) in the middle of x = cx; `top` is the top of the arch. */
function archedWindow(g: CanvasRenderingContext2D, cx: number, top: number, bottom: number, w: number, bars: boolean): void {
  const half = w / 2
  const rim = 8
  const arc = (r: number, base: number) => {
    g.beginPath()
    g.moveTo(cx - r, base)
    g.lineTo(cx - r, top + half)
    g.arc(cx, top + half, r, Math.PI, 0)
    g.lineTo(cx + r, base)
    g.closePath()
  }
  arc(half + rim, bottom + 6)
  g.fillStyle = FRAME
  g.fill()
  arc(half, bottom)
  const grad = g.createLinearGradient(0, top, 0, bottom)
  grad.addColorStop(0, GLASS_TOP)
  grad.addColorStop(1, GLASS_BOTTOM)
  g.fillStyle = grad
  g.fill()
  g.strokeStyle = 'rgba(235,225,200,0.85)'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(cx, top)
  g.lineTo(cx, bottom)
  g.moveTo(cx - half, top + half + (bottom - top - half) * 0.4)
  g.lineTo(cx + half, top + half + (bottom - top - half) * 0.4)
  g.stroke()
  if (bars) {
    g.strokeStyle = 'rgba(30,30,34,0.75)'
    g.lineWidth = 2
    for (let x = cx - half + 10; x < cx + half; x += 12) {
      g.beginPath()
      g.moveTo(x, top + half)
      g.lineTo(x, bottom)
      g.stroke()
    }
  }
  g.fillStyle = '#bfae85'
  g.fillRect(cx - half - rim - 6, bottom + 6, w + 2 * rim + 12, 9)
}

/** One bay (4.4 m wide, 4.2 m high) of the main building: stone courses, pilasters, an arched window. */
export function uniBayTexture(ground: boolean): CanvasTexture {
  const [c, g] = make(256, 256)
  plaster(g, 256, 256, STONE, ground ? 61 : 67)
  g.strokeStyle = 'rgba(120,100,70,0.14)'
  g.lineWidth = 2
  for (let y = 16; y < 256; y += 32) {
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(256, y)
    g.stroke()
  }
  const r = rng(ground ? 5 : 9)
  for (let i = 0; i < 90; i++) {
    g.fillStyle = 'rgba(110,90,60,0.07)'
    g.fillRect(r() * 256, r() * 256, 10 + r() * 22, 2)
  }
  // pilasters at both edges of the bay
  g.fillStyle = 'rgba(120,100,70,0.2)'
  g.fillRect(0, 0, 9, 256)
  g.fillRect(247, 0, 9, 256)
  if (ground) archedWindow(g, 128, 92, 214, 104, true)
  else archedWindow(g, 128, 66, 196, 88, false)
  // shadow under the floor above, lighter slab edge along the bottom
  g.fillStyle = 'rgba(0,0,0,0.11)'
  g.fillRect(0, 0, 256, 12)
  g.fillStyle = 'rgba(255,255,255,0.2)'
  g.fillRect(0, 238, 256, 18)
  return finish(c)
}

/**
 * The middle of the entrance block (9.2 m × 18.2 m): a pediment band on top, two floors of arched windows,
 * and a grand arch two floors high with the closed double door at its foot. The door opens in Stage 8.
 */
export function uniEntranceTexture(): CanvasTexture {
  const [c, g] = make(256, 512)
  plaster(g, 256, 512, STONE, 71)
  g.strokeStyle = 'rgba(120,100,70,0.14)'
  g.lineWidth = 2
  for (let y = 16; y < 512; y += 32) {
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(256, y)
    g.stroke()
  }
  // pediment band (the top 1.4 m): a darker stone line with a blue stripe
  g.fillStyle = '#d6c8a4'
  g.fillRect(0, 0, 256, 39)
  g.fillStyle = '#2b4f98'
  g.fillRect(0, 30, 256, 7)
  // two floors of windows (118 px each), one pair per floor
  for (const top of [56, 174]) {
    archedWindow(g, 70, top, top + 78, 56, false)
    archedWindow(g, 186, top, top + 78, 56, false)
  }
  // the grand arch: from y 290 to the ground, 176 px wide
  const cx = 128
  const half = 88
  const arch = (r: number, base: number, top: number) => {
    g.beginPath()
    g.moveTo(cx - r, base)
    g.lineTo(cx - r, top + half)
    g.arc(cx, top + half, r, Math.PI, 0)
    g.lineTo(cx + r, base)
    g.closePath()
  }
  arch(half + 12, 512, 282)
  g.fillStyle = FRAME
  g.fill()
  arch(half, 512, 294)
  const grad = g.createLinearGradient(0, 294, 0, 512)
  grad.addColorStop(0, GLASS_TOP)
  grad.addColorStop(1, GLASS_BOTTOM)
  g.fillStyle = grad
  g.fill()
  // mullions and the transom above the doors
  g.strokeStyle = 'rgba(235,225,200,0.9)'
  g.lineWidth = 4
  g.beginPath()
  for (const x of [cx - 44, cx, cx + 44]) {
    g.moveTo(x, 330)
    g.lineTo(x, 440)
  }
  g.moveTo(cx - half, 440)
  g.lineTo(cx + half, 440)
  g.moveTo(cx - half + 6, 382)
  g.lineTo(cx + half - 6, 382)
  g.stroke()
  // the closed double door: two leaves of dark wood with a pane each
  g.fillStyle = '#4a3226'
  g.fillRect(cx - half + 4, 440, half - 6, 72)
  g.fillRect(cx + 2, 440, half - 6, 72)
  g.fillStyle = 'rgba(90,130,170,0.55)'
  g.fillRect(cx - half + 16, 452, half - 30, 40)
  g.fillRect(cx + 14, 452, half - 30, 40)
  g.fillStyle = '#d9c9a0'
  g.fillRect(cx - 5, 440, 10, 72)
  return finish(c)
}

/** The sign over the gate: the university's name in English and Arabic on a dark blue board. */
export function uniSignTexture(): CanvasTexture {
  const [c, g] = make(1024, 140)
  g.fillStyle = '#1f3d78'
  g.fillRect(0, 0, 1024, 140)
  g.strokeStyle = '#e9e2cf'
  g.lineWidth = 5
  g.strokeRect(8, 8, 1008, 124)
  g.fillStyle = '#f4efe0'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.direction = 'rtl'
  g.font = 'bold 58px "Noto Naskh Arabic","Noto Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif'
  g.fillText('جامعة العلوم والتكنولوجيا', 512, 44)
  g.direction = 'ltr'
  g.font = 'bold 42px "Segoe UI",Arial,Helvetica,sans-serif'
  g.fillText('UNIVERSITY OF SCIENCE & TECHNOLOGY', 512, 102)
  return finish(c)
}
