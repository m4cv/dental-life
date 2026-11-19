import { useEffect, useRef, useState } from 'react'
import { useControlStore } from '@/state/useControlStore'
import { usePromptStore } from '@/state/usePromptStore'
import { useViewport } from '@/ui/useViewport'
import { input, resetInput } from './input'
import { controlLayout } from './layout'

/**
 * On-screen controls, drawn over the 3D canvas:
 *  - left half of the screen: floating joystick (appears under the thumb, anywhere on the left)
 *  - right half: drag to look around, two fingers to pinch-zoom
 *  - buttons: Run (toggle) and Recenter camera
 * Interact: a button that appears next to Run when something can be done where she stands.
 * Desktop: WASD / arrows move, Shift runs, mouse drag looks, wheel zooms, C recenters, E interacts.
 * Everything writes into the shared `input` object; nothing here re-renders while you play.
 */
export function TouchControls() {
  const rootRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const baseRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const run = useControlStore((s) => s.run)
  const toggleRun = useControlStore((s) => s.toggleRun)
  const prompt = usePromptStore((s) => s.prompt)
  const busy = usePromptStore((s) => s.busy)
  const [hint, setHint] = useState(true)
  // Sizes follow the screen (see layout.ts): the game is meant to be played in landscape.
  const { w, h } = useViewport()
  const L = controlLayout(w, h)
  const layoutRef = useRef(L)
  const homeRef = useRef<() => void>(() => {})

  useEffect(() => {
    const root = rootRef.current
    const anchor = anchorRef.current
    const base = baseRef.current
    const knob = knobRef.current
    if (!root || !anchor || !base || !knob) return

    const placeBase = (cx: number, cy: number, active: boolean) => {
      const half = layoutRef.current.base / 2
      base.style.transform = `translate(${cx - half}px, ${cy - half}px)`
      base.style.opacity = active ? '1' : '0.5'
      base.dataset.active = active ? 'true' : 'false'
    }
    const home = () => {
      const r = anchor.getBoundingClientRect()
      placeBase(r.left + r.width / 2, r.top + r.height / 2, false)
      knob.style.transform = 'translate(0px, 0px)'
    }
    home()
    homeRef.current = home

    let stickId = -1
    let originX = 0
    let originY = 0
    const looks = new Map<number, { x: number; y: number }>()
    let pinch = 0

    const setStick = (clientX: number, clientY: number) => {
      const radius = layoutRef.current.stickRadius
      let dx = clientX - originX
      let dy = clientY - originY
      const len = Math.hypot(dx, dy)
      if (len > radius) {
        dx = (dx / len) * radius
        dy = (dy / len) * radius
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`
      input.stickX = dx / radius
      input.stickY = -dy / radius
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
        const half = layoutRef.current.base / 2 + 8
        originX = Math.min(Math.max(e.clientX, half), window.innerWidth - half)
        originY = Math.min(Math.max(e.clientY, half), window.innerHeight - half)
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
      if (e.code === 'KeyE') {
        input.interact = true
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

    // Rotating the phone resizes everything: let go of any touch and rest the stick again.
    const onResize = () => {
      if (stickId !== -1) releaseStick()
      looks.clear()
      pinch = 0
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
      homeRef.current = () => {}
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

  // Re-seat the resting joystick whenever the screen size (and so the control sizes) change.
  useEffect(() => {
    layoutRef.current = L
    homeRef.current()
  }, [L.base, L.stickRadius, w, h])

  const edge = 'max(env(safe-area-inset-left), 1rem)'
  const edgeR = 'max(env(safe-area-inset-right), 1rem)'
  const floor = 'max(env(safe-area-inset-bottom), 1rem)'

  return (
    <div ref={rootRef} data-testid="touch-controls" className="absolute inset-0 select-none" style={{ touchAction: 'none' }}>
      {/* where the joystick rests when nobody is touching it: low in the left corner, under the thumb */}
      <div
        ref={anchorRef}
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left: `calc(${edge} + 1.5rem)`,
          bottom: `calc(${floor} + 0.5rem)`,
          width: L.base,
          height: L.base,
        }}
      />
      <div
        ref={baseRef}
        data-testid="joystick"
        data-active="false"
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 rounded-full border-2 border-white/60 bg-black/25"
        style={{ width: L.base, height: L.base, opacity: 0.5, willChange: 'transform' }}
      >
        <div
          ref={knobRef}
          data-testid="joystick-knob"
          className="absolute rounded-full bg-white/85 shadow-lg"
          style={{ width: L.knob, height: L.knob, left: '50%', top: '50%', margin: -L.knob / 2, willChange: 'transform' }}
        />
      </div>

      {hint && (
        <p
          data-testid="controls-hint"
          className="pointer-events-none absolute inset-x-0 mx-auto w-fit max-w-[60%] rounded-full bg-black/45 px-3 py-1.5 text-center text-xs text-white"
          style={{ bottom: `calc(${floor} + 0.25rem)` }}
        >
          Left thumb: move · Right thumb: look · Pinch: zoom
        </p>
      )}

      {/* contextual action, left of the Run stack so the right thumb reaches it without covering the look area */}
      {prompt && !busy && (
        <div
          className="pointer-events-none absolute flex flex-col items-end gap-1"
          style={{ right: `calc(${edgeR} + 0.5rem + ${L.runSize}px + 1rem)`, bottom: `calc(${floor} + 0.5rem)` }}
        >
          {prompt.note && (
            <p data-testid="interact-note" className="max-w-[22rem] rounded-xl bg-black/60 px-3 py-1.5 text-right text-xs text-white">
              {prompt.note}
            </p>
          )}
          <button
            type="button"
            data-touch-button
            data-testid="btn-interact"
            data-spot={prompt.id}
            disabled={!prompt.enabled}
            onClick={() => {
              input.interact = true
            }}
            style={{ height: L.runSize, minWidth: L.runSize * 2 }}
            className={
              'pointer-events-auto rounded-full border px-5 text-sm font-bold ' +
              (prompt.enabled ? 'border-amber-200 bg-amber-300 text-slate-900 shadow-lg active:bg-amber-200' : 'border-white/30 bg-black/35 text-white/60')
            }
          >
            {prompt.label}
          </button>
        </div>
      )}

      {/* right thumb's corner: Run (toggle) with Recentre above it; both stay out of the look drag */}
      <div
        className="pointer-events-none absolute flex flex-col items-center gap-3"
        style={{ right: `calc(${edgeR} + 0.5rem)`, bottom: `calc(${floor} + 0.5rem)` }}
      >
        <button
          type="button"
          data-touch-button
          data-testid="btn-recenter"
          aria-label="Recenter camera behind the character"
          onClick={() => {
            input.recenter = true
          }}
          style={{ width: L.recenterSize, height: L.recenterSize }}
          className="pointer-events-auto grid place-items-center rounded-full border border-white/50 bg-black/45 text-xl text-white active:bg-white/40"
        >
          ⟲
        </button>
        <button
          type="button"
          data-touch-button
          data-testid="btn-run"
          aria-pressed={run}
          onClick={toggleRun}
          style={{ width: L.runSize, height: L.runSize }}
          className={
            'pointer-events-auto grid place-items-center rounded-full border text-sm font-bold ' +
            (run ? 'border-white bg-white text-slate-900' : 'border-white/50 bg-black/45 text-white active:bg-white/40')
          }
        >
          Run
        </button>
      </div>
    </div>
  )
}
