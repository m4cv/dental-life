import { useDriveStore } from '@/state/useDriveStore'

/** The dashboard: speed in km/h and the gear (D drive, R reverse). Only shown while she is in the car. */
export function DriveHud() {
  const driving = useDriveStore((s) => s.driving)
  const kmh = useDriveStore((s) => s.kmh)
  const gear = useDriveStore((s) => s.gear)
  if (!driving) return null
  return (
    <div
      data-testid="speedometer"
      data-kmh={kmh}
      data-gear={gear}
      className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-baseline gap-1 rounded-2xl bg-black/50 px-4 py-1.5 text-white backdrop-blur"
      style={{ bottom: 'calc(max(env(safe-area-inset-bottom), 1rem) + 0.5rem)' }}
    >
      <span className="font-mono text-3xl font-bold leading-none">{kmh}</span>
      <span className="text-xs">km/h</span>
      <span className="ml-2 rounded bg-white/25 px-2 text-sm font-bold">{gear}</span>
    </div>
  )
}
