// Attending lectures and (Stage 10) clinic sessions, as pure functions (no React, no three.js): which lecture a seat offers, how late she may come,
// how the clock runs through the lecture and what is written in the attendance record.
//
// The rules (kept simple, all in this file):
//  * she attends a lecture by sitting at her seat in its hall and pressing the button (a clinic session: at her dental unit, once she
//    has washed her hands and put on a mask and gloves, see clinic.ts; the same rules of time apply); the lecture then runs to its end
//    with the clock moving on (she waits if it has not started yet);
//  * she is "present" when she sits down up to 10 minutes after the start, "late" up to 30 minutes after it; later the
//    door is closed and the lecture counts as missed;
//  * a lecture whose end has passed without her attending is "absent" (nothing is stored for it: it is worked out from the clock).
import { attendableOn, lecturesOn, sessionTitle, formatTime, type DayId, type GroupId, type LectureRoom, type Session, PLACE_ROOM, PLAYER_GROUP } from './timetable.ts'

export type Attendance = 'present' | 'late'
/** What is stored: the attendance of the lectures she has attended, by session id. */
export type AttendanceRecord = Readonly<Record<string, Attendance>>

/** Minutes after the start up to which she still counts as present. */
export const PRESENT_UNTIL = 10
/** Minutes after the start up to which she may still come in (late). */
export const LATE_UNTIL = 30

export type LectureState = 'upcoming' | 'open' | 'closed' | 'present' | 'late' | 'absent'

/**
 * Where a lecture stands at `now` (minutes from midnight):
 * upcoming (not started), open (started, she may still come in), closed (the door is shut: missed, not over yet),
 * present, late (attended) or absent (over, not attended).
 */
export function lectureState(s: Session, now: number, record: AttendanceRecord): LectureState {
  const done = record[s.id]
  if (done) return done
  if (now >= s.end) return 'absent'
  if (now >= s.start + LATE_UNTIL) return 'closed'
  if (now >= s.start) return 'open'
  return 'upcoming'
}

/** How she is marked when she sits down at `now`; null when the door is already shut. */
export function markFor(s: Session, now: number): Attendance | null {
  if (now >= s.start + LATE_UNTIL) return null
  return now <= s.start + PRESENT_UNTIL ? 'present' : 'late'
}

/** Real seconds a lecture takes in the game: about ten game minutes per second, between 5 and 18 seconds. */
export function lectureSeconds(from: number, end: number): number {
  return Math.min(18, Math.max(5, (end - from) / 10))
}

/** The lecture a seat in `room` offers: the first one of the day in that room that she can still attend. */
export function nextLectureIn(room: LectureRoom, day: DayId, now: number, record: AttendanceRecord, group: GroupId = PLAYER_GROUP): Session | null {
  for (const s of lecturesOn(day, group)) {
    if (PLACE_ROOM[s.place] !== room) continue
    const st = lectureState(s, now, record)
    if (st === 'upcoming' || st === 'open') return s
  }
  return null
}

/** The next lecture of the day anywhere (for the "next class" card); null when none is left to attend. */
export function nextLecture(day: DayId, now: number, record: AttendanceRecord, group: GroupId = PLAYER_GROUP): Session | null {
  for (const s of lecturesOn(day, group)) {
    const st = lectureState(s, now, record)
    if (st === 'upcoming' || st === 'open') return s
  }
  return null
}

/** The next session of the day she can attend anywhere (a lecture or a clinic session), for the "next class" card; null when none is left. */
export function nextSession(day: DayId, now: number, record: AttendanceRecord, group: GroupId = PLAYER_GROUP): Session | null {
  for (const s of attendableOn(day, group)) {
    const st = lectureState(s, now, record)
    if (st === 'upcoming' || st === 'open') return s
  }
  return null
}

export interface SeatOffer {
  /** The button text. */
  label: string
  enabled: boolean
  /** Shown above the button when there is something to say. */
  note?: string
  /** The lecture that pressing it attends (null when disabled). */
  session: Session | null
}

/** What the seat in a hall offers right now. */
export function seatOffer(room: LectureRoom, day: DayId, now: number, record: AttendanceRecord, group: GroupId = PLAYER_GROUP): SeatOffer {
  const s = nextLectureIn(room, day, now, record, group)
  if (!s) {
    const here = lecturesOn(day, group).filter((x) => PLACE_ROOM[x.place] === room)
    const shut = here.find((x) => lectureState(x, now, record) === 'closed')
    if (shut) return { label: 'Take a seat', enabled: false, note: `The ${sessionTitle(shut)} lecture started at ${formatTime(shut.start)}: the door is shut`, session: null }
    return { label: 'Take a seat', enabled: false, note: here.length ? 'No more lectures in this hall today' : 'No lectures in this hall today', session: null }
  }
  const mark = markFor(s, now)
  if (mark === null) return { label: 'Take a seat', enabled: false, note: `The ${sessionTitle(s)} lecture has started: the door is shut`, session: null }
  const note =
    now < s.start ? `${sessionTitle(s)} starts at ${formatTime(s.start)}: you will wait for it` : mark === 'late' ? `${sessionTitle(s)} started at ${formatTime(s.start)}: you are late` : undefined
  return { label: `Attend: ${sessionTitle(s)}`, enabled: true, note, session: s }
}

export interface DayCounts {
  lectures: number
  present: number
  late: number
  absent: number
  /** Still to come (upcoming, open or closed but not over). */
  pending: number
}

/** The attendance of a day's lectures at `now`. */
export function dayCounts(day: DayId, now: number, record: AttendanceRecord, group: GroupId = PLAYER_GROUP): DayCounts {
  const c: DayCounts = { lectures: 0, present: 0, late: 0, absent: 0, pending: 0 }
  for (const s of lecturesOn(day, group)) {
    c.lectures++
    const st = lectureState(s, now, record)
    if (st === 'present') c.present++
    else if (st === 'late') c.late++
    else if (st === 'absent') c.absent++
    else c.pending++
  }
  return c
}

export interface SessionCounts extends DayCounts {
  /** All the sessions she can attend that day: lectures and clinic sessions. */
  sessions: number
}

/** The attendance of a day's lectures and clinic sessions at `now` (the labs are not playable yet and are left out). */
export function sessionCounts(day: DayId, now: number, record: AttendanceRecord, group: GroupId = PLAYER_GROUP): SessionCounts {
  const c: SessionCounts = { lectures: 0, sessions: 0, present: 0, late: 0, absent: 0, pending: 0 }
  for (const s of attendableOn(day, group)) {
    c.sessions++
    if (s.kind === 'lecture') c.lectures++
    const st = lectureState(s, now, record)
    if (st === 'present') c.present++
    else if (st === 'late') c.late++
    else if (st === 'absent') c.absent++
    else c.pending++
  }
  return c
}

/** The lecture she is sitting through: how she is marked and the game minute it began for her. */
export interface PendingLecture {
  sessionId: string
  mark: Attendance
  /** The game minute the clock had when she started (the lecture runs from here, or from its start if she is early, to its end). */
  from: number
}

/** She sits down for `s` at `now`: null when the door is shut. */
export function beginLecture(s: Session, now: number): PendingLecture | null {
  const mark = markFor(s, now)
  return mark === null ? null : { sessionId: s.id, mark, from: Math.max(now, s.start) }
}

/** The game minute at `progress` (0…1) of the lecture. */
export function lectureClock(p: PendingLecture, end: number, progress: number): number {
  return p.from + Math.min(1, Math.max(0, progress)) * (end - p.from)
}

/** The record with the finished lecture written into it. */
export function finishLecture(record: AttendanceRecord, p: PendingLecture): AttendanceRecord {
  return { ...record, [p.sessionId]: p.mark }
}
