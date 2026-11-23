// The weekly timetable of the fourth level (Faculty of Medicine and Health Sciences, Dentistry, Bachelor of Dental
// Surgery, semester 1, academic year 2026/2027), copied from the paper timetable the player sent, as plain data and
// pure functions (no React, no three.js). To change the timetable change the SESSIONS table below; nothing else
// has to follow.
//
// Reading the paper: the columns are 8–10, 10–12, 12–2 and 2–4; a cell split in two halves is two one-hour sessions
// (Monday 8–10, Wednesday 10–12); a cell that runs across several columns is one long session. Sessions in the
// "Grand Hall" or "313" are lectures for everybody; sessions in the "Clinic", the "Phantom" labs and the
// "Prosthodontic Lab" are clinical or lab sessions for the groups named in brackets (A to E) — Orthodontics 1 lab
// has one group per slot.

export type DayId = 'sat' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu'
/** The teaching week runs from Saturday to Thursday; Friday is the weekend. */
export const DAYS: readonly { id: DayId; name: string; short: string }[] = [
  { id: 'sat', name: 'Saturday', short: 'Sat' },
  { id: 'sun', name: 'Sunday', short: 'Sun' },
  { id: 'mon', name: 'Monday', short: 'Mon' },
  { id: 'tue', name: 'Tuesday', short: 'Tue' },
  { id: 'wed', name: 'Wednesday', short: 'Wed' },
  { id: 'thu', name: 'Thursday', short: 'Thu' },
]

export type GroupId = 'A' | 'B' | 'C' | 'D' | 'E'
export const GROUPS: readonly GroupId[] = ['A', 'B', 'C', 'D', 'E']
/** The player's group (she said B). */
export const PLAYER_GROUP: GroupId = 'B'

export type SubjectId = 'perio1' | 'fixedPros3' | 'endo3' | 'opDent4' | 'ortho1' | 'remPros3' | 'oralMed1' | 'oralSurg1' | 'research'
export const SUBJECT_NAMES: Record<SubjectId, string> = {
  perio1: 'Periodontology 1',
  fixedPros3: 'Fixed Prosthodontics 3',
  endo3: 'Endodontics 3',
  opDent4: 'Operative Dentistry 4',
  ortho1: 'Orthodontics 1',
  remPros3: 'Removable Prosthodontics 3',
  oralMed1: 'Oral Medicine 1',
  oralSurg1: 'Oral Surgery 1',
  research: 'Research Methodology',
}

export type PlaceId = 'grand-hall' | 'hall-313' | 'clinic' | 'phantom-1' | 'phantom-2' | 'prosth-lab-2'
export const PLACE_NAMES: Record<PlaceId, string> = {
  'grand-hall': 'Grand Hall',
  'hall-313': 'Hall 313',
  clinic: 'Clinic',
  'phantom-1': 'Phantom (1)',
  'phantom-2': 'Phantom (2)',
  'prosth-lab-2': 'Prosthodontic Lab (2)',
}

/** The two lecture places and the room of the university they are built as (see university/uniLayout.ts). */
export type LectureRoom = 'hall1' | 'hall2'
export const PLACE_ROOM: Partial<Record<PlaceId, LectureRoom>> = { 'grand-hall': 'hall1', 'hall-313': 'hall2' }

export type SessionKind = 'lecture' | 'clinic' | 'lab'

export interface Session {
  id: string
  day: DayId
  /** Minutes from midnight. */
  start: number
  end: number
  /** One subject, or two taught together (the Wednesday clinic sessions). */
  subjects: SubjectId[]
  kind: SessionKind
  place: PlaceId
  /** Empty: "Department Staff". */
  doctors: string[]
  /** The groups it is for, or every group. */
  groups: GroupId[] | 'all'
}

const hm = (h: number, m = 0) => h * 60 + m

const lecture = (id: string, day: DayId, start: number, end: number, subject: SubjectId, doctor: string, place: PlaceId): Session => ({
  id,
  day,
  start,
  end,
  subjects: [subject],
  kind: 'lecture',
  place,
  doctors: [doctor],
  groups: 'all',
})
const clinic = (id: string, day: DayId, start: number, end: number, subjects: SubjectId[], groups: GroupId[]): Session => ({
  id,
  day,
  start,
  end,
  subjects,
  kind: 'clinic',
  place: 'clinic',
  doctors: [],
  groups,
})
const lab = (id: string, day: DayId, start: number, end: number, group: GroupId, doctors: string[], place: PlaceId): Session => ({
  id,
  day,
  start,
  end,
  subjects: ['ortho1'],
  kind: 'lab',
  place,
  doctors,
  groups: [group],
})

export const SESSIONS: readonly Session[] = [
  // ---- Saturday ----
  lecture('sat-perio1', 'sat', hm(8), hm(10), 'perio1', 'Dr. Abeer Barehim', 'grand-hall'),
  lecture('sat-fixedpros3', 'sat', hm(10), hm(12), 'fixedPros3', 'Dr. Arwa Al-Humaikani', 'grand-hall'),
  // ---- Sunday: clinical sessions only ----
  clinic('sun-endo3', 'sun', hm(8), hm(10), ['endo3'], ['B', 'C', 'D', 'E']),
  clinic('sun-opdent4', 'sun', hm(10), hm(12), ['opDent4'], ['B', 'C', 'D', 'E']),
  lab('sun-ortho1-b', 'sun', hm(12), hm(14), 'B', ['Dr. Mahmoud Al-Yafei', 'Dr. Imad Satea'], 'prosth-lab-2'),
  // ---- Monday: four lectures in the Grand Hall (the 8–10 cell is split in two one-hour halves) ----
  lecture('mon-ortho1', 'mon', hm(8), hm(9), 'ortho1', 'Dr. Abdullah Al-Labani', 'grand-hall'),
  lecture('mon-opdent4', 'mon', hm(9), hm(10), 'opDent4', 'Dr. Bin Shahnah', 'grand-hall'),
  lecture('mon-endo3', 'mon', hm(10), hm(12), 'endo3', 'Dr. Nashwan Al-Afifi', 'grand-hall'),
  lecture('mon-rempros3', 'mon', hm(12), hm(14), 'remPros3', 'Dr. Mohammed Bahamss', 'grand-hall'),
  // ---- Tuesday ----
  clinic('tue-fixedremovable', 'tue', hm(8), hm(12), ['fixedPros3', 'remPros3'], ['A', 'B', 'D', 'E']),
  lab('tue-ortho1-c', 'tue', hm(8), hm(10), 'C', ['Dr. Asmaa Murad', 'Dr. Shaimaa Mahmoud'], 'phantom-1'),
  lab('tue-ortho1-a', 'tue', hm(12), hm(14), 'A', ['Dr. Mahmoud Al-Yafei', 'Dr. Mohammed Al-Yahri'], 'phantom-2'),
  lab('tue-ortho1-d', 'tue', hm(12), hm(14), 'D', ['Dr. Asmaa Murad', 'Dr. Imad Satea'], 'phantom-1'),
  // ---- Wednesday: two lectures in Hall 313, then a clinic block for groups A, E and C (it starts at 11:00 and runs to the end of the table, 16:00) ----
  lecture('wed-oralmed1', 'wed', hm(8), hm(10), 'oralMed1', 'Dr. Zuhoor Al-Tayeb', 'hall-313'),
  lecture('wed-oralsurg1', 'wed', hm(10), hm(11), 'oralSurg1', 'Dr. Sanaa Farea', 'hall-313'),
  clinic('wed-endo3-opdent4-a', 'wed', hm(11), hm(16), ['endo3', 'opDent4'], ['A']),
  clinic('wed-oralsurg1-perio1-e', 'wed', hm(11), hm(16), ['oralSurg1', 'perio1'], ['E']),
  clinic('wed-fixedpros3-rempros3-c', 'wed', hm(11), hm(16), ['fixedPros3', 'remPros3'], ['C']),
  // ---- Thursday ----
  clinic('thu-oralsurg1', 'thu', hm(8), hm(10), ['oralSurg1'], ['A', 'B', 'C', 'D']),
  lab('thu-ortho1-e', 'thu', hm(8), hm(10), 'E', ['Dr. Imad Satea', 'Dr. Sabaa Awad'], 'phantom-1'),
  clinic('thu-perio1', 'thu', hm(10), hm(12), ['perio1'], ['A', 'B', 'C', 'D']),
  lecture('thu-research', 'thu', hm(12), hm(14), 'research', 'Dr. Omar Rageh', 'hall-313'),
]

export const dayById = (id: DayId) => DAYS.find((d) => d.id === id) as (typeof DAYS)[number]

export function isDayId(v: unknown): v is DayId {
  return DAYS.some((d) => d.id === v)
}

/** The sessions of a day that are for a group (every lecture, plus the clinical and lab sessions that name the group), in time order. */
export function sessionsFor(day: DayId, group: GroupId = PLAYER_GROUP): Session[] {
  return SESSIONS.filter((s) => s.day === day && (s.groups === 'all' || s.groups.includes(group))).sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))
}

/** Only the lectures of a day. */
export const lecturesOn = (day: DayId, group: GroupId = PLAYER_GROUP): Session[] => sessionsFor(day, group).filter((s) => s.kind === 'lecture')

/** Only the clinic sessions of a day that take place in the dental clinic (Stage 10). The labs (Phantom, Prosthodontic Lab) are not built yet. */
export const clinicSessionsOn = (day: DayId, group: GroupId = PLAYER_GROUP): Session[] => sessionsFor(day, group).filter((s) => s.kind === 'clinic' && s.place === 'clinic')

/** A session she can attend in the game: a lecture in a hall (Stage 9) or a clinic session in the dental clinic (Stage 10). */
export const isAttendable = (s: Session): boolean => s.kind === 'lecture' || (s.kind === 'clinic' && s.place === 'clinic')

/** Everything she can attend on a day (lectures and clinic sessions), in time order. */
export const attendableOn = (day: DayId, group: GroupId = PLAYER_GROUP): Session[] => sessionsFor(day, group).filter(isAttendable)

export function sessionTitle(s: Session): string {
  const names = s.subjects.map((id) => SUBJECT_NAMES[id]).join(' & ')
  return s.kind === 'lab' ? `${names} Lab` : names
}

/** "Dr. A, Dr. B", or "Department Staff". */
export const sessionDoctors = (s: Session): string => (s.doctors.length ? s.doctors.join(', ') : 'Department Staff')

export function formatTime(minutes: number): string {
  const m = Math.floor(minutes) % (24 * 60)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export const sessionTimes = (s: Session): string => `${formatTime(s.start)}–${formatTime(s.end)}`

export const sessionById = (id: string): Session | undefined => SESSIONS.find((s) => s.id === id)

/** Reads ?day=sat|sun|… (a test aid and a shortcut); null when it is missing or wrong. */
export function dayFromQuery(search: string): DayId | null {
  const v = new URLSearchParams(search).get('day')?.toLowerCase().slice(0, 3)
  return isDayId(v) ? v : null
}
