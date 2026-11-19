import { useAppStore } from '@/state/useAppStore'

export function WebGLUnsupported() {
  const returnToMenu = useAppStore((state) => state.returnToMenu)

  return (
    <main
      className="menu-bg safe-y fixed inset-0 flex flex-col items-center justify-center gap-5 px-8 text-center text-slate-900"
      role="alert"
    >
      <h1 className="text-2xl font-bold">3D graphics aren’t available</h1>
      <p className="max-w-xs text-base text-slate-700">
        This browser can’t run WebGL 2, which the game needs. Try the latest Chrome, Safari or
        Edge, and make sure hardware acceleration is switched on.
      </p>
      <button type="button" className="btn-primary w-full max-w-xs" onClick={returnToMenu}>
        Back to menu
      </button>
    </main>
  )
}
