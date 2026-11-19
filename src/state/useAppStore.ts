import { create } from 'zustand'

export type Screen = 'menu' | 'game'

interface AppState {
  screen: Screen
  /** Smoothed frames-per-second, updated twice a second by the render loop. */
  fps: number
  startNewGame: () => void
  returnToMenu: () => void
  setFps: (fps: number) => void
}

export const useAppStore = create<AppState>()((set) => ({
  screen: 'menu',
  fps: 0,
  startNewGame: () => set({ screen: 'game', fps: 0 }),
  returnToMenu: () => set({ screen: 'menu' }),
  setFps: (fps) => set({ fps }),
}))
