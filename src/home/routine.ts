// The morning routine, as plain data and pure functions (no React, no three.js).
import type { Gesture } from '../character/animations/pose.ts'
import { SPOTS, type Spot, type StepId } from './homeLayout.ts'

export interface RoutineStep {
  id: StepId
  /** Checklist wording. */
  label: string
  /** Text on the Interact button. */
  prompt: string
  /** How long the action takes. */
  seconds: number
  /** Minutes the clock advances when it is done. */
  minutes: number
  gesture: Gesture
}

export const ROUTINE_STEPS: RoutineStep[] = [
  { id: 'brush', label: 'Brush your teeth', prompt: 'Brush teeth', seconds: 2.8, minutes: 4, gesture: 'brush' },
  { id: 'mirror', label: 'Check your look', prompt: 'Check mirror', seconds: 2.2, minutes: 6, gesture: 'mirror' },
  { id: 'dress', label: 'Straighten your coat', prompt: 'Get dressed', seconds: 2.2, minutes: 5, gesture: 'dress' },
  { id: 'eat', label: 'Have breakfast', prompt: 'Have breakfast', seconds: 3.2, minutes: 12, gesture: 'eat' },
  { id: 'pack', label: 'Pack your notebook', prompt: 'Pack notebook', seconds: 2.2, minutes: 3, gesture: 'pack' },
]

/** What opening the front door looks like. */
export const DOOR_ACTION = { seconds: 1.6, gesture: 'open' as Gesture }

/** How long the action at a spot lasts and which gesture it plays. */
export function actionFor(spot: Spot): { seconds: number; gesture: Gesture } {
  return spot.id === 'door' ? DOOR_ACTION : stepById(spot.id)
}

/** 06:30. */
export const START_MINUTES = 6 * 60 + 30

export interface RoutineState {
  done: StepId[]
  minutes: number
  doorOpen: boolean
}

export function initialRoutine(): RoutineState {
  return { done: [], minutes: START_MINUTES, doorOpen: false }
}

export function stepById(id: StepId): RoutineStep {
  const s = ROUTINE_STEPS.find((x) => x.id === id)
  if (!s) throw new Error(`unknown step ${id}`)
  return s
}

export function completeStep(s: RoutineState, id: StepId): RoutineState {
  if (s.done.includes(id)) return s
  return { ...s, done: [...s.done, id], minutes: s.minutes + stepById(id).minutes }
}

export function routineComplete(s: RoutineState): boolean {
  return ROUTINE_STEPS.every((step) => s.done.includes(step.id))
}

/** The door only opens once everything is done. */
export function openDoor(s: RoutineState): RoutineState {
  return routineComplete(s) ? { ...s, doorOpen: true } : s
}

export function formatClock(minutes: number): string {
  const m = Math.floor(minutes) % (24 * 60)
  const hh = String(Math.floor(m / 60)).padStart(2, '0')
  const mm = String(m % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

// ---------------------------------------------------------------------------------------------
// What the Interact button offers at a spot.
// ---------------------------------------------------------------------------------------------

export interface Prompt {
  id: Spot['id']
  label: string
  /** False = shown greyed out with `note` (the front door before the routine is finished). */
  enabled: boolean
  note?: string
}

/** The spot whose reach contains (x, z); the nearest one wins. */
export function nearestSpot(x: number, z: number, spots: readonly Spot[] = SPOTS): Spot | null {
  let best: Spot | null = null
  let bestD = Infinity
  for (const s of spots) {
    const d = Math.hypot(s.x - x, s.z - z)
    if (d <= s.radius && d < bestD) {
      best = s
      bestD = d
    }
  }
  return best
}

/** The button for a spot, or null when there is nothing left to do there. */
export function promptFor(spot: Spot, s: RoutineState): Prompt | null {
  if (spot.id === 'door') {
    if (s.doorOpen) return null
    if (routineComplete(s)) return { id: 'door', label: 'Leave home', enabled: true }
    return {
      id: 'door',
      label: 'Leave home',
      enabled: false,
      note: `Finish your morning routine first (${s.done.length} of ${ROUTINE_STEPS.length})`,
    }
  }
  if (s.done.includes(spot.id)) return null
  return { id: spot.id, label: stepById(spot.id).prompt, enabled: true }
}
