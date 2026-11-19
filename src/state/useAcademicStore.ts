import { create } from 'zustand'
import { beginLecture, finishLecture, type AttendanceRecord, type PendingLecture } from '@/academics/attendance'
import { sessionById, type DayId } from '@/academics/timetable'

interface AcademicStore {
  /** The day of the week she plays (chosen at New Game; it does not advance in this stage). */
  day: DayId
  /** The lectures she has attended today. */
  record: AttendanceRecord
  /** Set while a lecture runs. */
  pending: PendingLecture | null
  setDay: (day: DayId) => void
  /** A new game: nothing attended yet (the day stays as chosen). */
  reset: () => void
  /** She sat down for a session at game minute `now`; false when the door was already shut. */
  begin: (sessionId: string, now: number) => boolean
  /** The lecture ran to its end: the attendance is written down. */
  finish: () => void
}

export const useAcademicStore = create<AcademicStore>()((set, get) => ({
  day: 'sat',
  record: {},
  pending: null,
  setDay: (day) => set({ day }),
  reset: () => set({ record: {}, pending: null }),
  begin: (sessionId, now) => {
    const s = sessionById(sessionId)
    const pending = s ? beginLecture(s, now) : null
    if (!pending) return false
    set({ pending })
    return true
  },
  finish: () => {
    const { pending, record } = get()
    if (pending) set({ record: finishLecture(record, pending), pending: null })
  },
}))
