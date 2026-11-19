import { needsRotate } from '@/controls/layout'
import { useViewport } from '@/ui/useViewport'

/**
 * The game is played with the phone held sideways. While the screen is a narrow portrait one this
 * covers the game (and swallows touches) with a request to turn the phone; it disappears by itself
 * as soon as the phone is rotated.
 */
export function RotatePrompt() {
  const { w, h } = useViewport()
  if (!needsRotate(w, h)) return null

  return (
    <div
      data-testid="rotate-prompt"
      role="alert"
      className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-slate-900/92 px-8 text-center text-white"
      style={{ touchAction: 'none' }}
    >
      <svg viewBox="0 0 64 64" className="h-20 w-20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="21" y="8" width="22" height="40" rx="4" />
        <path d="M30 42h4" />
        <path d="M14 54c6 5 14 6 22 3" />
        <path d="M33 60l4-3-3-4" />
      </svg>
      <h2 className="text-2xl font-bold">Turn your phone sideways</h2>
      <p className="max-w-xs text-sm text-slate-300">
        Dental Life is played in landscape. If it does not turn by itself, switch off your phone&apos;s rotation lock.
      </p>
    </div>
  )
}
