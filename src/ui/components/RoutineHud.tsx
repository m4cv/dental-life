import { useEffect, useState } from 'react'
import { ROUTINE_STEPS, formatClock } from '@/home/routine'
import { usePlayerStore } from '@/state/usePlayerStore'
import { usePromptStore } from '@/state/usePromptStore'
import { useRoutineStore } from '@/state/useRoutineStore'
import { ZONE_NAMES, zoneAt } from '@/street/streetLayout'

/** Where she is, by name (home, yard, lane, Ninety Street). Reads the 4 Hz position the rig publishes. */
function PlaceChip() {
  const zone = usePlayerStore((s) => zoneAt(s.x, s.z))
  return (
    <div data-testid="place" data-zone={zone} className="rounded-full bg-black/45 px-3 py-1 text-sm text-white backdrop-blur">
      {ZONE_NAMES[zone]}
    </div>
  )
}

/** Morning checklist, clock, a short message after each step and a progress bar while she acts. */
export function RoutineHud({ showPlace = false }: { showPlace?: boolean }) {
  const routine = useRoutineStore((s) => s.routine)
  const toast = useRoutineStore((s) => s.toast)
  const busy = usePromptStore((s) => s.busy)
  const [shownToast, setShownToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) {
      setShownToast(null)
      return
    }
    setShownToast(toast.text)
    const t = window.setTimeout(() => setShownToast(null), 4200)
    return () => window.clearTimeout(t)
  }, [toast])

  return (
    <>
      <div className="hud-top-safe pointer-events-none absolute inset-x-0 top-0 flex justify-center gap-2">
        <div data-testid="clock" className="rounded-full bg-black/45 px-4 py-1 font-mono text-sm text-white backdrop-blur">
          ☀ {formatClock(routine.minutes)}
        </div>
        {showPlace && <PlaceChip />}
      </div>

      <ul
        data-testid="routine-hud"
        className="pointer-events-none absolute left-0 rounded-xl bg-black/45 px-3 py-2 text-xs leading-5 text-white backdrop-blur"
        style={{ top: 'calc(max(env(safe-area-inset-top), 0.75rem) + 2.75rem)', marginLeft: 'max(env(safe-area-inset-left), 0.75rem)' }}
      >
        {ROUTINE_STEPS.map((s) => {
          const done = routine.done.includes(s.id)
          return (
            <li key={s.id} data-testid={`routine-step-${s.id}`} data-done={done} className={done ? 'text-emerald-300 line-through' : ''}>
              {done ? '✓' : '○'} {s.label}
            </li>
          )
        })}
        <li data-testid="routine-step-door" data-done={routine.doorOpen} className={routine.doorOpen ? 'text-emerald-300 line-through' : 'text-amber-200'}>
          {routine.doorOpen ? '✓' : '○'} Leave for university
        </li>
      </ul>

      {shownToast && (
        <p
          data-testid="toast"
          className="pointer-events-none absolute inset-x-0 mx-auto w-fit max-w-[70%] rounded-full bg-black/60 px-4 py-2 text-center text-sm text-white"
          style={{ top: 'calc(max(env(safe-area-inset-top), 0.75rem) + 2.5rem)' }}
        >
          {shownToast}
        </p>
      )}

      {busy && (
        <div
          data-testid="action-progress"
          data-progress={busy.progress}
          className="pointer-events-none absolute inset-x-0 mx-auto w-48 rounded-full bg-black/55 px-3 py-2 text-center text-xs text-white"
          style={{ bottom: 'calc(max(env(safe-area-inset-bottom), 1rem) + 0.75rem)' }}
        >
          {busy.label}…
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/25">
            <div className="h-full bg-amber-300" style={{ width: `${Math.round(busy.progress * 100)}%` }} />
          </div>
        </div>
      )}
    </>
  )
}
