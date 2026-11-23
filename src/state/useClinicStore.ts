import { create } from 'zustand'
import { PREP_STEPS, completePrep, type Prep } from '@/academics/clinic'
import type { ClinicStepId } from '@/home/homeLayout'

interface ClinicStore {
  /** What she has done to get ready for the next clinic session: wash, mask, gloves, in that order. */
  prep: Prep
  /** A new game, or the session is over (gloves off, a new patient next time): nothing done. */
  reset: () => void
  /** A step is finished (a step out of order changes nothing). */
  complete: (id: ClinicStepId) => void
  /** Testing aid (?prep=done): ready for the session. */
  skip: () => void
}

export const useClinicStore = create<ClinicStore>()((set, get) => ({
  prep: [],
  reset: () => set({ prep: [] }),
  complete: (id) => {
    const next = completePrep(get().prep, id)
    if (next !== get().prep) set({ prep: next })
  },
  skip: () => set({ prep: PREP_STEPS.map((s) => s.id) }),
}))
