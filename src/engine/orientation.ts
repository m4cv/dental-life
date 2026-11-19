/**
 * Best-effort: on a touch phone, go full screen and lock the screen to landscape. Must be called
 * from a tap (browsers refuse it otherwise). Android Chrome allows it; iPhone Safari does not, and
 * neither does a desktop browser, so every step is allowed to fail quietly. The rotate prompt
 * (`RotatePrompt`) covers the cases where the lock is refused.
 */
export async function requestLandscapeFullscreen(): Promise<void> {
  const touchDevice = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  if (!touchDevice) return

  try {
    const root = document.documentElement
    if (!document.fullscreenElement && typeof root.requestFullscreen === 'function') {
      await root.requestFullscreen({ navigationUI: 'hide' })
    }
  } catch {
    /* refused: fine, the game still runs in the browser window */
  }

  try {
    const orientation = screen.orientation as (ScreenOrientation & { lock?: (type: string) => Promise<void> }) | undefined
    await orientation?.lock?.('landscape')
  } catch {
    /* not supported or not allowed outside full screen */
  }
}
