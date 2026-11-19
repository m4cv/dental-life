// Shared, mutable input state. The touch UI and the keyboard write into it; the player
// controller reads it once per frame. It is deliberately NOT React state: input changes dozens
// of times a second and must never trigger a re-render.

export const input = {
  /** Virtual joystick, x right / y forward, each -1..1 (before the dead-zone). */
  stickX: 0,
  stickY: 0,
  /** Keyboard arrows / WASD, same convention. */
  keyX: 0,
  keyY: 0,
  keyRun: false,
  /** Camera drag in CSS pixels since the last frame, and pinch / wheel zoom (positive = out). */
  lookDX: 0,
  lookDY: 0,
  zoom: 0,
  /** Set by the recenter button; the controller clears it. */
  recenter: false,
}

export function resetInput(): void {
  input.stickX = 0
  input.stickY = 0
  input.keyX = 0
  input.keyY = 0
  input.keyRun = false
  input.lookDX = 0
  input.lookDY = 0
  input.zoom = 0
  input.recenter = false
}

/** The joystick wins while it is being held; otherwise the keyboard. */
export function readStick(): [number, number] {
  if (input.stickX !== 0 || input.stickY !== 0) return [input.stickX, input.stickY]
  return [input.keyX, input.keyY]
}

/** Returns the camera drag / zoom collected since the last call and clears it. */
export function takeLook(): { dx: number; dy: number; zoom: number } {
  const out = { dx: input.lookDX, dy: input.lookDY, zoom: input.zoom }
  input.lookDX = 0
  input.lookDY = 0
  input.zoom = 0
  return out
}
