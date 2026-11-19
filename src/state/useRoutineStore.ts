import { create } from 'zustand'
import { ROUTINE_STEPS, completeStep, initialRoutine, openDoor, routineComplete, stepById, type RoutineState } from '@/home/routine'
import type { Spot } from '@/home/homeLayout'

interface Toast {
  /** Changes with every toast so the HUD can restart its fade timer. */
  id: number
  text: string
}

interface RoutineStore {
  routine: RoutineState
  toast: Toast | null
  /** Starts the morning again (a new game). */
  reset: () => void
  /** Called when an action at `spot` has finished. */
  finish: (spot: Spot['id']) => void
  /** Testing aid (?routine=done): the whole morning already done and the front door open. */
  skipToDoor: () => void
}

let toastId = 0
const toast = (text: string): Toast => ({ id: ++toastId, text })

export const useRoutineStore = create<RoutineStore>()((set, get) => ({
  routine: initialRoutine(),
  toast: null,
  reset: () => set({ routine: initialRoutine(), toast: null }),
  skipToDoor: () => {
    const all = ROUTINE_STEPS.reduce((r, s) => completeStep(r, s.id), initialRoutine())
    set({ routine: openDoor(all), toast: null })
  },
  finish: (spot) => {
    const { routine } = get()
    if (spot === 'door') {
      set({ routine: openDoor(routine), toast: toast('The door is open. The neighbourhood is waiting.') })
      return
    }
    const next = completeStep(routine, spot)
    if (next === routine) return
    const step = stepById(spot)
    const left = ROUTINE_STEPS.length - next.done.length
    set({
      routine: next,
      toast: toast(routineComplete(next) ? `${step.label} — done. Head for the front door.` : `${step.label} — done. ${left} to go.`),
    })
  },
}))
