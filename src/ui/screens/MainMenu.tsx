import { GAME } from '@/config/game'
import { useAppStore } from '@/state/useAppStore'
import { ToothIcon } from '@/ui/components/ToothIcon'

export function MainMenu() {
  const startNewGame = useAppStore((state) => state.startNewGame)

  return (
    <main className="menu-bg safe-y fixed inset-0 flex flex-col items-center justify-between px-6 text-slate-900">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <ToothIcon className="h-20 w-20 text-white drop-shadow-lg" />
        <h1 className="text-5xl font-extrabold tracking-tight">{GAME.title}</h1>
        <p className="max-w-xs text-base text-slate-700">{GAME.tagline}</p>
      </div>

      <div className="w-full max-w-sm pb-4">
        <button type="button" className="btn-primary w-full" onClick={startNewGame}>
          New Game
        </button>
      </div>

      <footer className="text-xs text-slate-600">
        Stage {GAME.stage} · {GAME.stageName} · v{GAME.version}
      </footer>
    </main>
  )
}
