// Pure screen-layout maths for the on-screen controls (no React, no DOM), so it can be unit-tested.
// The game is designed for a phone held sideways, so everything scales with the SHORT side of
// the screen (the height in landscape): a joystick sized for a tall portrait screen would eat half
// of a 390 px-high landscape one.

export interface ControlLayout {
  /** Joystick base diameter, CSS px. */
  base: number
  /** Joystick knob diameter. */
  knob: number
  /** Finger travel for a fully pushed stick. */
  stickRadius: number
  /** Run button diameter. */
  runSize: number
  /** Recentre button diameter. */
  recenterSize: number
  /** Gas and brake pedals while driving (width × height, CSS px). */
  gasW: number
  gasH: number
  brakeW: number
  brakeH: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

export function controlLayout(width: number, height: number): ControlLayout {
  const short = Math.min(width, height)
  const base = clamp(Math.round(short * 0.31), 96, 150)
  const runSize = clamp(Math.round(short * 0.17), 56, 72)
  return {
    base,
    knob: Math.round(base * 0.46),
    stickRadius: Math.round(base * 0.42),
    runSize,
    recenterSize: clamp(Math.round(runSize * 0.78), 48, 56),
    gasW: clamp(Math.round(short * 0.22), 72, 96),
    gasH: clamp(Math.round(short * 0.3), 96, 128),
    brakeW: clamp(Math.round(short * 0.22), 72, 96),
    brakeH: clamp(Math.round(short * 0.21), 68, 92),
  }
}

/**
 * True when the screen is a narrow portrait one: the game asks the player to turn the phone.
 * Wide portrait screens (tablets, 820 px and up) are left alone; so are desktop windows.
 */
export function needsRotate(width: number, height: number): boolean {
  return height > width && width < 820
}
