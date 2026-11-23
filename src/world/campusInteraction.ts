import { clinicSeatOffer, prepPrompt, prepSummary, stepOf } from '@/academics/clinic'
import { lectureClock, lectureSeconds, seatOffer } from '@/academics/attendance'
import { PLACE_NAMES, formatTime, sessionById, sessionTitle, type LectureRoom } from '@/academics/timetable'
import { SPOTS, type HallSeatId, type SeatId, type Spot } from '@/home/homeLayout'
import { actionFor, isClinicStepId, isSeatId, type Prompt } from '@/home/routine'
import { useAcademicStore } from '@/state/useAcademicStore'
import { useClinicStore } from '@/state/useClinicStore'
import { useRoutineStore } from '@/state/useRoutineStore'
import { CLINIC_PREP, CLINIC_SEAT, LECTURE_SEATS } from '@/university/uniLayout'
import { INTERACTION } from './homeShared'
import type { RigInteraction } from './PlayerRig'

// Stage 9: the morning's spots plus a seat in each lecture hall. Pressing the button at a seat sits her down for the
// next lecture of that hall; the clock runs on to the end of the lecture and the attendance is written down.
// Stage 10: the dental clinic. By the hand-wash counter she washes her hands, puts on a mask and then gloves (each moves
// the clock on a little); with that done, the stool at her dental unit sits her down for the next clinic session, which
// runs like a lecture. When the session is over the mask and gloves come off: the next session starts from the sink again.

const ROOM_OF: Record<HallSeatId, LectureRoom> = { 'seat-hall1': 'hall1', 'seat-hall2': 'hall2' }
/** How close she must be to a seat for the button to appear. */
export const SEAT_REACH = 0.8
/** How close she must be to the sink or a dispenser. */
export const PREP_REACH = 0.85

export const SEAT_SPOTS: Spot[] = (['hall1', 'hall2'] as const).map((room) => ({
  id: `seat-${room}` as HallSeatId,
  x: LECTURE_SEATS[room].x,
  z: LECTURE_SEATS[room].z,
  heading: LECTURE_SEATS[room].heading,
  radius: SEAT_REACH,
}))

/** The stool at her dental unit and the three places where she gets ready, in the clinic. */
export const CLINIC_SPOTS: Spot[] = [
  { id: 'seat-clinic', x: CLINIC_SEAT.x, z: CLINIC_SEAT.z, heading: CLINIC_SEAT.heading, radius: SEAT_REACH },
  ...(['wash', 'mask', 'gloves'] as const).map((id) => ({ id, x: CLINIC_PREP[id].x, z: CLINIC_PREP[id].z, heading: CLINIC_PREP[id].heading, radius: PREP_REACH })),
]

/** What the seat offers at this moment (the clock, the day, the record and the getting-ready are read from the stores). */
function offerAt(id: SeatId) {
  const { day, record } = useAcademicStore.getState()
  const now = useRoutineStore.getState().routine.minutes
  if (id === 'seat-clinic') return clinicSeatOffer(day, now, record, useClinicStore.getState().prep)
  return seatOffer(ROOM_OF[id], day, now, record)
}

const endOf = (sessionId: string): number => sessionById(sessionId)?.end ?? 0

export const CAMPUS_INTERACTION: RigInteraction = {
  spots: [...SPOTS, ...SEAT_SPOTS, ...CLINIC_SPOTS],
  promptAt: (spot) => {
    if (isClinicStepId(spot.id)) {
      const p = prepPrompt(spot.id, useClinicStore.getState().prep)
      return p ? { id: spot.id, label: p.label, enabled: p.enabled, note: p.note } : null
    }
    if (!isSeatId(spot.id)) return INTERACTION.promptAt(spot)
    const offer = offerAt(spot.id)
    const prompt: Prompt = { id: spot.id, label: offer.label, enabled: offer.enabled, note: offer.note }
    return prompt
  },
  actionAt: (spot) => {
    if (isClinicStepId(spot.id)) {
      const step = stepOf(spot.id)
      return { seconds: step.seconds, gesture: step.gesture }
    }
    if (!isSeatId(spot.id)) return actionFor(spot)
    // the whole session, from now (or its start, if she is early) to its end, takes a few real seconds
    const s = offerAt(spot.id).session
    const now = useRoutineStore.getState().routine.minutes
    return { seconds: s ? lectureSeconds(Math.max(now, s.start), s.end) : 1, gesture: 'sit' }
  },
  onStart: (spot) => {
    if (!isSeatId(spot.id)) return
    const s = offerAt(spot.id).session
    if (s) useAcademicStore.getState().begin(s.id, useRoutineStore.getState().routine.minutes)
  },
  onProgress: (spot, progress) => {
    if (!isSeatId(spot.id)) return
    const pending = useAcademicStore.getState().pending
    if (pending) useRoutineStore.getState().advanceTo(lectureClock(pending, endOf(pending.sessionId), progress))
  },
  onDone: (spot) => {
    if (isClinicStepId(spot.id)) {
      const step = stepOf(spot.id)
      const routine = useRoutineStore.getState()
      useClinicStore.getState().complete(spot.id)
      routine.advanceTo(routine.routine.minutes + step.minutes)
      routine.say(`${step.label} — done. ${prepSummary(useClinicStore.getState().prep)}`)
      return
    }
    if (!isSeatId(spot.id)) {
      INTERACTION.onDone(spot)
      return
    }
    const pending = useAcademicStore.getState().pending
    const s = pending ? sessionById(pending.sessionId) : undefined
    if (!pending || !s) return
    useRoutineStore.getState().advanceTo(s.end)
    useAcademicStore.getState().finish()
    // the session is over: the gloves and the mask come off, the next one starts from the sink again
    if (spot.id === 'seat-clinic') useClinicStore.getState().reset()
    const mark = pending.mark === 'present' ? 'marked present' : 'marked late'
    useRoutineStore.getState().say(`${sessionTitle(s)} · ${PLACE_NAMES[s.place]} · until ${formatTime(s.end)} · ${mark}`)
  },
}
