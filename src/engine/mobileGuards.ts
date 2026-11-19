/**
 * Stops the browser from hijacking touch gestures that the game will use itself:
 * pinch-zoom, long-press menus and multi-finger scrolling. CSS (touch-action,
 * overscroll-behavior) covers the rest; these listeners cover iOS Safari quirks.
 */
export function installMobileGuards(): void {
  const prevent = (event: Event) => {
    if (event.cancelable) event.preventDefault()
  }

  // iOS Safari pinch-zoom gesture events (non-standard, ignored elsewhere).
  document.addEventListener('gesturestart', prevent, { passive: false })
  document.addEventListener('gesturechange', prevent, { passive: false })
  document.addEventListener('gestureend', prevent, { passive: false })

  // Long-press / right-click context menu.
  document.addEventListener('contextmenu', prevent)

  // Two-finger drags must never scroll or zoom the page.
  document.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length > 1) prevent(event)
    },
    { passive: false },
  )
}
