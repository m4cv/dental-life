import { GameCanvas } from '@/engine/GameCanvas'
import { useAppStore } from '@/state/useAppStore'
import { Diagnostics } from '@/ui/components/Diagnostics'
import { TestScene } from '@/world/TestScene'

/** Loaded lazily (see App.tsx) so the heavy 3D code is only fetched when a game starts. */
export default function GameScreen() {
  const returnToMenu = useAppStore((state) => state.returnToMenu)

  return (
    <div className="fixed inset-0 overflow-hidden bg-sky-200">
      <GameCanvas>
        <TestScene />
      </GameCanvas>

      <div className="hud-top-safe pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2">
        <button
          type="button"
          className="btn-hud pointer-events-auto"
          aria-label="Back to main menu"
          onClick={returnToMenu}
        >
          ☰ Menu
        </button>
        <Diagnostics />
      </div>

      <div className="hud-bottom-safe pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
        <p className="max-w-[92%] rounded-full bg-black/45 px-4 py-2 text-center text-xs text-white backdrop-blur">
          Foundation test scene — character and controls arrive in the next stages
        </p>
      </div>
    </div>
  )
}
