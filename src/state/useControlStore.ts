import { create } from 'zustand'

interface ControlState {
  /** Run toggle (the on-screen Run button). Shift also runs on a keyboard. */
  run: boolean
  toggleRun: () => void
  setRun: (run: boolean) => void
}

export const useControlStore = create<ControlState>()((set) => ({
  run: false,
  toggleRun: () => set((s) => ({ run: !s.run })),
  setRun: (run) => set({ run }),
}))
