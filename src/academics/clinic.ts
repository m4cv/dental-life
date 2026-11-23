// The clinic sessions of Stage 10, as pure functions (no React, no three.js): the three things she does before a session
// (wash her hands, put on a mask, put on gloves, in that order), what the stool at her dental unit offers, and how the
// clock moves. The attendance rules themselves (present within 10 minutes, late within 30, then too late) are the ones of
// the lectures, in attendance.ts; a clinic session is attended at the dental unit instead of a seat in a hall.
//
// The order is an estimate of a typical infection-control routine, not the faculty's own protocol: it can be changed here
// (PREP_STEPS) without touching anything else.
import type { Gesture } from '../character/animations/pose.ts'
import type { ClinicStepId } from '../home/homeLayout.ts'
import { lectureState, markFor, type AttendanceRecord, type SeatOffer } from './attendance.ts'
import { clinicSessionsOn, formatTime, sessionTitle, type DayId, type GroupId, type Session, PLAYER_GROUP } from './timetable.ts'

export interface PrepStep {
  id: ClinicStepId
  /** Checklist wording. */
  label: string
  /** Text on the Interact button. */
  prompt: string
  /** How long the action takes (real seconds). */
  seconds: number
  /** Game minutes the clock moves on when it is done. */
  minutes: number
  gesture: Gesture
  /** What to do first, shown greyed out on the button until it is done. */
  before: string | null
}

export const PREP_STEPS: PrepStep[] = [
  { id: 'wash', label: 'Wash your hands', prompt: 'Wash hands', seconds: 3.2, minutes: 2, gesture: 'wash', before: null },
  { id: 'mask', label: 'Put on a mask', prompt: 'Put on a mask', seconds: 1.8, minutes: 1, gesture: 'mask', before: 'Wash your hands first' },
  { id: 'gloves', label: 'Put on gloves', prompt: 'Put on gloves', seconds: 2.4, minutes: 1, gesture: 'gloves', before: 'Put on a mask first' },
]

/** The steps she has done so far for the next session, in the order she did them. */
export type Prep = readonly ClinicStepId[]

export const stepOf = (id: ClinicStepId): PrepStep => PREP_STEPS.find((s) => s.id === id) as PrepStep

/** The step she can do now, or null when all three are done. */
export function nextPrepStep(done: Prep): PrepStep | null {
  return PREP_STEPS.find((s) => !done.includes(s.id)) ?? null
}

export const prepComplete = (done: Prep): boolean => nextPrepStep(done) === null

/** Records a finished step; a step out of order or done twice changes nothing. */
export function completePrep(done: Prep, id: ClinicStepId): Prep {
  const next = nextPrepStep(done)
  return next && next.id === id ? [...done, id] : done
}

/** The button at a prep spot: null once the step is done, greyed out (with what to do first) when an earlier step is missing. */
export function prepPrompt(id: ClinicStepId, done: Prep): { label: string; enabled: boolean; note?: string } | null {
  if (done.includes(id)) return null
  const step = stepOf(id)
  const next = nextPrepStep(done)
  if (next && next.id === id) return { label: step.prompt, enabled: true }
  return { label: step.prompt, enabled: false, note: step.before ?? undefined }
}

/** What the checklist says in a few words: "2 of 3 done: next, put on gloves". */
export function prepSummary(done: Prep): string {
  const next = nextPrepStep(done)
  const n = PREP_STEPS.filter((s) => done.includes(s.id)).length
  return next ? `${n} of ${PREP_STEPS.length} done · next: ${next.label.toLowerCase()}` : 'Ready for the session'
}

/** The clinic session her stool offers right now: the first one of the day she can still attend, and whether she is ready for it. */
export function clinicSeatOffer(day: DayId, now: number, record: AttendanceRecord, done: Prep, group: GroupId = PLAYER_GROUP): SeatOffer {
  const today = clinicSessionsOn(day, group)
  const open = today.find((s) => {
    const st = lectureState(s, now, record)
    return st === 'upcoming' || st === 'open'
  })
  if (!open) {
    const shut = today.find((s) => lectureState(s, now, record) === 'closed')
    if (shut) return { label: 'Take your seat', enabled: false, note: `The ${sessionTitle(shut)} session started at ${formatTime(shut.start)}: it is too late to join`, session: null }
    return { label: 'Take your seat', enabled: false, note: today.length ? 'No more clinic sessions today' : 'No clinic session today', session: null }
  }
  const mark = markFor(open, now)
  if (mark === null) return { label: 'Take your seat', enabled: false, note: `The ${sessionTitle(open)} session has started: it is too late to join`, session: null }
  const label = `Attend: ${sessionTitle(open)}`
  if (!prepComplete(done)) return { label, enabled: false, note: `Get ready first: ${prepSummary(done)}`, session: null }
  const note =
    now < open.start ? `${sessionTitle(open)} starts at ${formatTime(open.start)}: you will wait for it` : mark === 'late' ? `${sessionTitle(open)} started at ${formatTime(open.start)}: you are late` : undefined
  return { label, enabled: true, note, session: open }
}

/** True when a session is a clinic session she attends at her dental unit. */
export const isClinicSession = (s: Session): boolean => s.kind === 'clinic' && s.place === 'clinic'
