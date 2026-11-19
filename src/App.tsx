import { lazy, Suspense, useState } from 'react'
import { detectWebGL2 } from '@/engine/webgl'
import { useAppStore } from '@/state/useAppStore'
import { ErrorBoundary } from '@/ui/components/ErrorBoundary'
import { LoadingScreen } from '@/ui/components/LoadingScreen'
import { MainMenu } from '@/ui/screens/MainMenu'
import { WebGLUnsupported } from '@/ui/screens/WebGLUnsupported'

// three.js + React Three Fiber are only downloaded when the player starts a game,
// which keeps the first paint of the menu fast on mobile connections.
const GameScreen = lazy(() => import('@/ui/screens/GameScreen'))

export default function App() {
  const screen = useAppStore((state) => state.screen)
  const returnToMenu = useAppStore((state) => state.returnToMenu)
  const [webgl2] = useState(detectWebGL2)

  if (screen === 'menu') return <MainMenu />
  if (!webgl2) return <WebGLUnsupported />

  return (
    <ErrorBoundary
      fallback={(error) => (
        <main
          className="menu-bg safe-y fixed inset-0 flex flex-col items-center justify-center gap-5 px-8 text-center text-slate-900"
          role="alert"
        >
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="max-w-xs text-sm text-slate-700">{error.message}</p>
          <button type="button" className="btn-primary w-full max-w-xs" onClick={returnToMenu}>
            Back to menu
          </button>
        </main>
      )}
    >
      <Suspense fallback={<LoadingScreen />}>
        <GameScreen />
      </Suspense>
    </ErrorBoundary>
  )
}
