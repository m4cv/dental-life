import { useEffect, useRef } from 'react'
import { formatClock } from '@/home/routine'
import { usePlayerStore } from '@/state/usePlayerStore'
import { useRouteStore } from '@/state/useRouteStore'
import { useRoutineStore } from '@/state/useRoutineStore'
import { arrowDegrees, instructionAt, projectOnRoute, remainingFrom } from '@/streets/routeLayout'

/** Keeps the turning arrow on the shortest way round: 179° then −179° is a 2° turn, not a spin. */
function useUnwrapped(deg: number): number {
  const shown = useRef(deg)
  const diff = ((((deg - shown.current) % 360) + 540) % 360) - 180
  const next = shown.current + diff
  useEffect(() => {
    shown.current = next
  }, [next])
  return next
}

/**
 * The way to the university (Stage 7): an arrow that points along the route whichever way the camera looks,
 * the distance left along the road and what to do next. Only once the front door is open; after she arrives it
 * becomes a plain card saying so. Worked out from the 4 Hz position the rig publishes.
 */
export function RouteHud() {
  const doorOpen = useRoutineStore((s) => s.routine.doorOpen)
  const arrivedAt = useRouteStore((s) => s.arrivedAt)
  const x = usePlayerStore((s) => s.x)
  const z = usePlayerStore((s) => s.z)
  const camDeg = usePlayerStore((s) => s.camDeg)
  const arrow = useUnwrapped(Math.round(arrowDegrees(x, z, (camDeg * Math.PI) / 180)))
  if (!doorOpen) return null
  const style = { top: 'calc(max(env(safe-area-inset-top), 0.75rem) + 5rem)' }
  if (arrivedAt !== null) {
    return (
      <div
        data-testid="route-hud"
        data-phase="arrived"
        className="pointer-events-none absolute inset-x-0 mx-auto w-fit max-w-[60%] rounded-2xl bg-emerald-900/70 px-4 py-2 text-center text-xs text-white backdrop-blur"
        style={style}
      >
        <p className="text-sm font-bold">You arrived at the university · {formatClock(arrivedAt)}</p>
        <p className="opacity-80">The campus opens in the next stage.</p>
      </div>
    )
  }
  const left = Math.round(remainingFrom(x, z))
  const step = instructionAt(projectOnRoute(x, z).s)
  return (
    <div
      data-testid="route-hud"
      data-phase="navigating"
      data-remaining={left}
      data-arrow={arrow}
      data-step={step}
      className="pointer-events-none absolute inset-x-0 mx-auto flex w-fit max-w-[56%] items-center gap-3 rounded-2xl bg-black/50 px-3 py-1.5 text-white backdrop-blur"
      style={style}
    >
      <svg viewBox="0 0 40 40" className="h-9 w-9 shrink-0" style={{ transform: `rotate(${arrow}deg)`, transition: 'transform 0.25s linear' }} aria-hidden>
        <circle cx="20" cy="20" r="19" fill="rgba(255,255,255,0.14)" />
        <path d="M20 5 L30 27 L20 22 L10 27 Z" fill="#fcd34d" stroke="#1f2937" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <div className="min-w-0 leading-tight">
        <p className="font-mono text-sm font-bold">University · {left} m</p>
        <p className="text-[11px] opacity-90">{step}</p>
      </div>
    </div>
  )
}
