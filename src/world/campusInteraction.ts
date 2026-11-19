import { lectureClock, lectureSeconds, seatOffer } from '@/academics/attendance'
import { PLACE_NAMES, formatTime, sessionById, sessionTitle, type LectureRoom } from '@/academics/timetable'
import { SPOTS, type SeatId, type Spot } from '@/home/homeLayout'
import { actionFor, isSeatId, type Prompt } from '@/home/routine'
import { useAcademicStore } from '@/state/useAcademicStore'
import { useRoutineStore } from '@/state/useRoutineStore'
import { LECTURE_SEATS } from '@/university/uniLayout'
import { INTERACTION } from './homeShared'
import type { RigInteraction } from './PlayerRig'

// Stage 9: the morning's spots plus a seat in each lecture hall. Pressing the button at a seat sits her down for the
// next lecture of that hall; the clock runs on to the end of the lecture and the attendance is written down.

const ROOM_OF: Record<SeatId, LectureRoom> = { 'seat-hall1': 'hall1', 'seat-hall2': 'hall2' }
/** How close she must be to a seat for the button to appear. */
export const SEAT_REACH = 0.8

export const SEAT_SPOTS: Spot[] = (['hall1', 'hall2'] as const).map((room) => ({
  id: `seat-${room}` as SeatId,
  x: LECTURE_SEATS[room].x,
  z: LECTURE_SEATS[room].z,
  heading: LECTURE_SEATS[room].heading,
  radius: SEAT_REACH,
}))

/** What the seat of a hall offers at this moment (the clock, the day and the record are read from the stores). */
function offerAt(id: SeatId) {
  const { day, record } = useAcademicStore.getState()
  return seatOffer(ROOM_OF[id], day, useRoutineStore.getState().routine.minutes, record)
}

const endOf = (sessionId: string): number => sessionById(sessionId)?.end ?? 0

export const CAMPUS_INTERACTION: RigInteraction = {
  spots: [...SPOTS, ...SEAT_SPOTS],
  promptAt: (spot) => {
    if (!isSeatId(spot.id)) return INTERACTION.promptAt(spot)
    const offer = offerAt(spot.id)
    const prompt: Prompt = { id: spot.id, label: offer.label, enabled: offer.enabled, note: offer.note }
    return prompt
  },
  actionAt: (spot) => {
    if (!isSeatId(spot.id)) return actionFor(spot)
    // the whole lecture, from now (or its start, if she is early) to its end, takes a few real seconds
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
    if (!isSeatId(spot.id)) {
      INTERACTION.onDone(spot)
      return
    }
    const pending = useAcademicStore.getState().pending
    const s = pending ? sessionById(pending.sessionId) : undefined
    if (!pending || !s) return
    useRoutineStore.getState().advanceTo(s.end)
    useAcademicStore.getState().finish()
    const mark = pending.mark === 'present' ? 'marked present' : 'marked late'
    useRoutineStore.getState().say(`${sessionTitle(s)} · ${PLACE_NAMES[s.place]} · until ${formatTime(s.end)} · ${mark}`)
  },
}
