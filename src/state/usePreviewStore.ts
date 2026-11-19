import { create } from 'zustand'

export type PreviewAnim = 'idle' | 'walk' | 'run'
export type PreviewView = 'front' | 'side' | 'back' | 'face' | 'orbit'

interface PreviewState {
  anim: PreviewAnim
  view: PreviewView
  setAnim: (anim: PreviewAnim) => void
  setView: (view: PreviewView) => void
}

/** Stage 2 character-preview controls. Replaced by real player input in Stage 3. */
export const usePreviewStore = create<PreviewState>((set) => ({
  anim: 'walk',
  view: 'orbit',
  setAnim: (anim) => set({ anim }),
  setView: (view) => set({ view }),
}))
