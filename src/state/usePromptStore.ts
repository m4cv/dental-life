import { create } from 'zustand'
import type { Prompt } from '@/home/routine'

interface PromptStore {
  /** What the Interact button offers right now (null = nothing in reach). */
  prompt: Prompt | null
  /** While an action runs: its label and 0..1 progress (rounded, so the UI updates a few times a second). */
  busy: { label: string; progress: number } | null
}

/** Written by the player rig, read by the Interact button and the progress bar. */
export const usePromptStore = create<PromptStore>()(() => ({ prompt: null, busy: null }))
