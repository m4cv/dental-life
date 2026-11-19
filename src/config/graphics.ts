export type GraphicsQuality = 'low' | 'medium' | 'high'

export interface GraphicsProfile {
  /** Upper bound for the renderer pixel ratio. Phones report 3+, which is too costly. */
  maxDpr: number
  /** Shadow technique, or false to disable shadows entirely. */
  shadows: false | 'basic' | 'percentage'
  shadowMapSize: number
  antialias: boolean
}

export const GRAPHICS_PROFILES: Record<GraphicsQuality, GraphicsProfile> = {
  low: { maxDpr: 1, shadows: false, shadowMapSize: 512, antialias: false },
  medium: { maxDpr: 1.5, shadows: 'percentage', shadowMapSize: 1024, antialias: true },
  high: { maxDpr: 2, shadows: 'percentage', shadowMapSize: 2048, antialias: true },
}

/**
 * Stage 1 always uses the default. A player-facing graphics setting
 * (Low / Medium / High) is added in the polish stage.
 */
export const DEFAULT_QUALITY: GraphicsQuality = 'medium'
