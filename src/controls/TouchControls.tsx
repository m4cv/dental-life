import { useEffect, useRef, useState } from 'react'
import { useControlStore } from '@/state/useControlStore'
import { input, resetInput } from './input'

/** Finger travel (CSS px) for a fully pushed stick. */
const STICK_RADIUS = 56
const BASE = 128
const KNOB = 56

/**
 * On-screen controls, drawn over the 3D canvas:
 *  - left half of the screen: floating joystick (appears under the thumb, anywhere on the left)
 *  - right half: drag to look around, two fingers to pinch-zoom
 *  - buttons: Run (toggle) and Recenter camera
 * Desktop: WASD / arrows move, Shift runs, mouse drag looks, wheel zooms, C recenters.
 * Everything writes into the shared `input` object; nothing here re-renders while you play.
 */
export function TouchControls() {
  const rootRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const baseRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const run = useControlStore((s) => s.run)
  const toggleRun = useControlStore((s) => s.toggleRun)
  const [hint, setHint] = useState(true)

  useEffect(() => {
    const root = rootRef.current
    const anchor = anchorRef.current
    const base = baseRef.current
    const knob = knobRef.current
    if (!root || !anchor || !base || !knob) return

    const placeBase = (cx: number, cy: number, active: boolean) => {
      base.style.transform = `translate(${cx - BASE / 2}px, ${cy - BASE / 2}px)`
      base.style.opacity = active ? '1' : '0.5'
      base.dataset.active = active ? 'true' : 'false'
    }
    const home = () => {
      const r = anchor.getBoundingClientRect()
      placeBase(r.left + r.width / 2, r.top + r.height / 2, false)
      knob.style.transform = 'translate(0px, 0px)'
    }
    home()

    let stickId = -1
    let originX = 0
    let originY = 0
    const looks = new Map<number, { x: number; y: number }>()
    let pinch = 0

    const setStick = (clientX: number, clientY: number) => {
      let dx = clientX - originX
      let dy = clientY - originY
      const len = Math.hypot(dx, dy)
      if (len > STICK_RADIUS) {
        dx = (dx / len) * STICK_RADIUS
        dy = (dy / len) * STICK_RADIUS
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`
      input.stickX = dx / STICK_RADIUS
      input.stickY = -dy / STICK_RADIUS
    }
    const releaseStick = () => {
      stickId = -1
      input.stickX = 0
      input.stickY = 0
      home()
    }
    const pinchDistance = () => {
      const [a, b] = [...looks.values()]
      return Math.hypot(a.x - b.x, a.y - b.y)
    }

    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('[data-touch-button]')) return
      e.preventDefault()
      root.setPointerCapture(e.pointerId)
      setHint(false)
      const leftSide = e.clientX < window.innerWidth / 2
      if (e.pointerType !== 'mouse' && leftSide && stickId === -1) {
        stickId = e.pointerId
        originX = Math.min(Math.max(e.clientX, BASE / 2 + 8), window.innerWidth - BASE / 2 - 8)
        originY = Math.min(Math.max(e.clientY, BASE / 2 + 8), window.innerHeight - BASE / 2 - 8)
        placeBase(originX, originY, true)
        setStick(e.clientX, e.clientY)
      } else {
        looks.set(e.pointerId, { x: e.clientX, y: e.clientY })
        if (looks.size === 2) pinch = pinchDistance()
      }
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerId === stickId) {
        setStick(e.clientX, e.clientY)
        return
      }
      const last = looks.get(e.pointerId)
      if (!last) return
      const dx = e.clientX - last.x
      const dy = e.clientY - last.y
      last.x = e.clientX
      last.y = e.clientY
      if (looks.size === 1) {
        input.lookDX += dx
        input.lookDY += dy
      } else if (looks.size === 2) {
        const d = pinchDistance()
        input.zoom += pinch - d // fingers closer together = zoom out
        pinch = d
      }
    }

    const onUp = (e: PointerEvent) => {
      if (e.pointerId === stickId) releaseStick()
      if (looks.delete(e.pointerId) && looks.size === 2) pinch = pinchDistance()
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      input.zoom += Math.sign(e.deltaY) * 30
    }

    const keys = new Set<string>()
    const KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'])
    const recompute = () => {
      const up = keys.has('KeyW') || keys.has('ArrowUp')
      const down = keys.has('KeyS') || keys.has('ArrowDown')
      const left = keys.has('KeyA') || keys.has('ArrowLeft')
      const right = keys.has('KeyD') || keys.has('ArrowRight')
      input.keyY = (up ? 1 : 0) - (down ? 1 : 0)
      input.keyX = (right ? 1 : 0) - (left ? 1 : 0)
      input.keyRun = keys.has('ShiftLeft') || keys.has('ShiftRight')
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyC') {
        input.recenter = true
        return
      }
      if (!KEYS.has(e.code)) return
      e.preventDefault()
      keys.add(e.code)
      recompute()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (keys.delete(e.code)) recompute()
    }
    const onBlur = () => {
      keys.clear()
      recompute()
      if (stickId !== -1) releaseStick()
      looks.clear()
    }

    const onResize = () => {
      if (stickId === -1) home()
    }

    root.addEventListener('pointerdown', onDown, { passive: false })
    root.addEventListener('pointermove', onMove)
    root.addEventListener('pointerup', onUp)
    root.addEventListener('pointercancel', onUp)
    root.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    const hintTimer = window.setTimeout(() => setHint(false), 9000)

    return () => {
      window.clearTimeout(hintTimer)
      root.removeEventListener('pointerdown', onDown)
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerup', onUp)
      root.removeEventListener('pointercancel', onUp)
      root.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      resetInput()
    }
  }, [])

  return (
    <div ref={rootRef} data-testid="touch-controls" className="absolute inset-0 select-none" style={{ touchAction: 'none' }}>
      {/* where the joystick rests when nobody is touching it */}
      <div
        ref={anchorRef}
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left: 'max(env(safe-area-inset-left), 1rem)',
          bottom: 'max(env(safe-area-inset-bottom), 1.25rem)',
          width: BASE,
          height: BASE,
          marginLeft: '0.75rem',
        }}
      />
      <div
        ref={baseRef}
        data-testid="joystick"
        data-active="false"
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 rounded-full border-2 border-white/60 bg-black/25"
        style={{ width: BASE, height: BASE, opacity: 0.5, willChange: 'transform' }}
      >
        <div
          ref={knobRef}
          data-testid="joystick-knob"
          className="absolute rounded-full bg-white/85 shadow-lg"
          style={{ width: KNOB, height: KNOB, left: '50%', top: '50%', margin: -KNOB / 2, willChange: 'transform' }}
        />
      </div>

      {hint && (
        <p
          data-testid="controls-hint"
          className="pointer-events-none absolute inset-x-0 mx-auto w-fit max-w-[90%] rounded-full bg-black/45 px-3 py-1.5 text-center text-xs text-white"
          style={{ bottom: 'calc(max(env(safe-area-inset-bottom), 1.25rem) + 9rem)' }}
        >
          Left thumb: move · Right thumb: look · Pinch: zoom
        </p>
      )}

      <div className="hud-bottom-safe pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-end gap-3 pb-1">
        <button
          type="button"
          data-touch-button
          data-testid="btn-recenter"
          aria-label="Recenter camera behind the character"
          onClick={() => {
            input.recenter = true
          }}
          className="pointer-events-auto grid h-12 w-12 place-items-center rounded-full border border-white/50 bg-black/45 text-xl text-white active:bg-white/40"
        >
          ⟲
        </button>
        <button
          type="button"
          data-touch-button
          data-testid="btn-run"
          aria-pressed={run}
          onClick={toggleRun}
          className={
            'pointer-events-auto grid h-16 w-16 place-items-center rounded-full border text-sm font-bold ' +
            (run ? 'border-white bg-white text-slate-900' : 'border-white/50 bg-black/45 text-white active:bg-white/40')
          }
        >
          Run
        </button>
      </div>
    </div>
  )
}
