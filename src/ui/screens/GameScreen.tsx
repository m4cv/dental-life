import { GameCanvas } from '@/engine/GameCanvas'
import { TouchControls } from '@/controls/TouchControls'
import { useAppStore } from '@/state/useAppStore'
import { CharacterPreviewPanel } from '@/ui/components/CharacterPreviewPanel'
import { Diagnostics } from '@/ui/components/Diagnostics'
import { RotatePrompt } from '@/ui/components/RotatePrompt'
import { RoutineHud } from '@/ui/components/RoutineHud'
import { CharacterShowcase } from '@/world/CharacterShowcase'
import { HomeScene } from '@/world/HomeScene'
import { PlayableScene } from '@/world/PlayableScene'

/**
 * Add ?preview=1 to the address to open the Stage 2 character inspector (idle / walk / run and
 * four camera angles) instead of the playable scene.
 */
const QUERY = new URLSearchParams(window.location.search)
const PREVIEW_MODE = QUERY.has('preview')
/**
 * The home is the default scene since Stage 4. ?scene=courtyard opens the Stage 3 test set (the
 * movement and camera tests run there); ?at=x,z,deg starts the home at that spot (for testing).
 */
const COURTYARD_MODE = QUERY.get('scene') === 'courtyard'

/** Loaded lazily (see App.tsx) so the heavy 3D code is only fetched when a game starts. */
export default function GameScreen() {
  const returnToMenu = useAppStore((state) => state.returnToMenu)

  return (
    <div className="fixed inset-0 overflow-hidden bg-sky-200">
      <GameCanvas>{PREVIEW_MODE ? <CharacterShowcase /> : COURTYARD_MODE ? <PlayableScene /> : <HomeScene />}</GameCanvas>

      {!PREVIEW_MODE && <TouchControls />}

      <div className="hud-top-safe pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2">
        <button
          type="button"
          className="btn-hud pointer-events-auto shrink-0 whitespace-nowrap"
          aria-label="Back to main menu"
          onClick={returnToMenu}
        >
          ☰ Menu
        </button>
        <Diagnostics />
      </div>

      {!PREVIEW_MODE && !COURTYARD_MODE && <RoutineHud />}

      {!PREVIEW_MODE && <RotatePrompt />}

      {PREVIEW_MODE && (
        <div className="hud-bottom-safe pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
          <CharacterPreviewPanel />
        </div>
      )}
    </div>
  )
}
