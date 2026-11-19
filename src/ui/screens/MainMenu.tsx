import { DAYS } from '@/academics/timetable'
import { GAME } from '@/config/game'
import { requestLandscapeFullscreen } from '@/engine/orientation'
import { useAcademicStore } from '@/state/useAcademicStore'
import { useAppStore } from '@/state/useAppStore'
import { ToothIcon } from '@/ui/components/ToothIcon'

export function MainMenu() {
  const startNewGame = useAppStore((state) => state.startNewGame)
  const day = useAcademicStore((state) => state.day)
  const setDay = useAcademicStore((state) => state.setDay)

  const onNewGame = () => {
    // Called straight from the tap, as browsers require; never blocks the game if refused.
    void requestLandscapeFullscreen()
    startNewGame()
  }

  return (
    <main className="menu-bg safe-x safe-y fixed inset-0 flex flex-col items-center justify-between px-6 text-slate-900 landscape:flex-row landscape:justify-center landscape:gap-14">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center landscape:flex-none">
        <ToothIcon className="h-20 w-20 text-white drop-shadow-lg landscape:h-14 landscape:w-14" />
        <h1 className="text-5xl font-extrabold tracking-tight landscape:text-4xl">{GAME.title}</h1>
        <p className="max-w-xs text-base text-slate-700">{GAME.tagline}</p>
      </div>

      <div className="w-full max-w-sm pb-4 landscape:w-64 landscape:pb-0">
        <p className="mb-1 text-center text-xs font-semibold text-slate-700">Day of the week to start on</p>
        <div className="mb-3 grid grid-cols-6 gap-1" role="radiogroup" aria-label="Day of the week to start on">
          {DAYS.map((d) => (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={day === d.id}
              data-testid={`day-${d.id}`}
              data-active={day === d.id}
              onClick={() => setDay(d.id)}
              className={'min-h-11 rounded-lg text-xs font-bold ' + (day === d.id ? 'bg-blue-700 text-white shadow' : 'bg-white/70 text-slate-800')}
            >
              {d.short}
            </button>
          ))}
        </div>
        <button type="button" className="btn-primary w-full" onClick={onNewGame}>
          New Game
        </button>
      </div>

      <footer className="text-xs text-slate-600 landscape:absolute landscape:bottom-2">
        Stage {GAME.stage} · {GAME.stageName} · v{GAME.version}
      </footer>
    </main>
  )
}
