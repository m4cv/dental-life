import { create } from 'zustand'

interface PlayerReadout {
  /** True while the playable scene is mounted (the Stage 2 preview does not publish). */
  active: boolean
  x: number
  z: number
  /** The height of her feet above the street (0, up to 0.45 on the university's steps and floor). */
  y: number
  speed: number
  /** Camera heading in degrees, 0–359. */
  camDeg: number
  /** Wanted camera distance in metres (before the spring-arm). */
  camDist: number
}

/** Low-rate read-out of the player for the diagnostics panel and the CI tests. */
export const usePlayerStore = create<PlayerReadout>()(() => ({ active: false, x: 0, z: 0, y: 0, speed: 0, camDeg: 0, camDist: 0 }))
