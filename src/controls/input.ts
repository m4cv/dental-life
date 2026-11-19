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
  /** The two pedals while she drives (the on-screen buttons); the keyboard's up / down arrows work too. */
  gas: false,
  brake: false,
  /** Camera drag in CSS pixels since the last frame, and pinch / wheel zoom (positive = out). */
  lookDX: 0,
  lookDY: 0,
  zoom: 0,
  /** Set by the recenter button; the controller clears it. */
  recenter: false,
  /** Set by the Interact button (or the E key); the controller clears it. */
  interact: false,
}

export function resetInput(): void {
  input.stickX = 0
  input.stickY = 0
  input.keyX = 0
  input.keyY = 0
  input.keyRun = false
  input.gas = false
  input.brake = false
  input.lookDX = 0
  input.lookDY = 0
  input.zoom = 0
  input.recenter = false
  input.interact = false
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

/**
 * What the driver is asking of the car: the left stick steers (only its sideways part, with a small dead
 * zone and a gentle curve so small pushes are small turns), the pedals are the two buttons or up / down.
 */
export function readDrive(): { throttle: number; brake: number; steer: number } {
  const x = Math.abs(input.stickX) > 0.08 ? input.stickX : 0
  const steer = x !== 0 ? Math.sign(x) * Math.min(1, Math.abs(x) ** 1.25 * 1.1) : input.keyX
  return {
    throttle: input.gas || input.keyY > 0 ? 1 : 0,
    brake: input.brake || input.keyY < 0 ? 1 : 0,
    steer,
  }
}
