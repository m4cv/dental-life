import { useState } from 'react'
import { dayCounts, lectureState, nextLecture, type LectureState } from '@/academics/attendance'
import { bearingDegrees, guideToSeat } from '@/academics/guide'
import {
  DAYS,
  PLACE_NAMES,
  PLACE_ROOM,
  PLAYER_GROUP,
  dayById,
  formatTime,
  sessionDoctors,
  sessionTimes,
  sessionTitle,
  sessionsFor,
  type DayId,
  type Session,
} from '@/academics/timetable'
import { formatClock } from '@/home/routine'
import { useAcademicStore } from '@/state/useAcademicStore'
import { usePlayerStore } from '@/state/usePlayerStore'
import { useRouteStore } from '@/state/useRouteStore'
import { useRoutineStore } from '@/state/useRoutineStore'
import { worldZoneAt } from '@/streets/routeLayout'
import { useUnwrapped } from './RouteHud'

const CAMPUS_ZONES = new Set(['university', 'lobby', 'corridor', 'hall1', 'hall2', 'office', 'courtyard'])

const STATE_LABEL: Record<LectureState, string> = {
  upcoming: 'Not started',
  open: 'In progress: you can still go in',
  closed: 'The door is shut',
  present: 'Present',
  late: 'Late',
  absent: 'Missed',
}
const STATE_STYLE: Record<LectureState, string> = {
  upcoming: 'bg-slate-200 text-slate-800',
  open: 'bg-amber-200 text-amber-900',
  closed: 'bg-orange-200 text-orange-900',
  present: 'bg-emerald-200 text-emerald-900',
  late: 'bg-yellow-200 text-yellow-900',
  absent: 'bg-rose-200 text-rose-900',
}
const KIND_LABEL = { lecture: 'Lecture', clinic: 'Clinic session', lab: 'Lab session' } as const

/** The button next to Menu that opens the timetable. */
export function TimetableButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" data-testid="btn-timetable" className="btn-hud pointer-events-auto shrink-0 whitespace-nowrap" aria-label="Open the timetable" onClick={() => setOpen(true)}>
        🗓 Timetable
      </button>
      {open && <TimetablePanel onClose={() => setOpen(false)} />}
    </>
  )
}

function SessionRow({ s, today, now }: { s: Session; today: boolean; now: number }) {
  const record = useAcademicStore((a) => a.record)
  const state = today && s.kind === 'lecture' ? lectureState(s, now, record) : null
  return (
    <li data-testid={`session-${s.id}`} data-state={state ?? s.kind} className="flex items-start gap-3 rounded-xl bg-white/80 px-3 py-2 text-slate-900">
      <div className="w-24 shrink-0 font-mono text-sm font-bold">{sessionTimes(s)}</div>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-sm font-bold">{sessionTitle(s)}</p>
        <p className="text-xs text-slate-700">
          {KIND_LABEL[s.kind]} · {PLACE_NAMES[s.place]}
        </p>
        <p className="text-xs text-slate-600">{sessionDoctors(s)}</p>
      </div>
      <div className="shrink-0 text-right">
        {state ? (
          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${STATE_STYLE[state]}`}>{STATE_LABEL[state]}</span>
        ) : (
          <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{s.kind === 'lecture' ? 'Another day' : 'Opens in a later stage'}</span>
        )}
      </div>
    </li>
  )
}

/** The week's timetable for her group: pick a day, see its sessions; today's lectures show how they went. */
function TimetablePanel({ onClose }: { onClose: () => void }) {
  const today = useAcademicStore((s) => s.day)
  const record = useAcademicStore((s) => s.record)
  const now = useRoutineStore((s) => s.routine.minutes)
  const [shown, setShown] = useState<DayId>(today)
  const sessions = sessionsFor(shown)
  const c = dayCounts(today, now, record)
  return (
    <div data-testid="timetable-panel" className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/55 px-3 py-3" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-2xl flex-col rounded-2xl bg-sky-50/95 p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="leading-tight text-slate-900">
            <p className="text-base font-extrabold">Timetable · Level 4 · Group {PLAYER_GROUP}</p>
            <p data-testid="attendance-summary" className="text-xs text-slate-700">
              Today ({dayById(today).name}): {c.lectures} lectures · {c.present} present · {c.late} late · {c.absent} missed · {c.pending} to come
            </p>
          </div>
          <button type="button" data-testid="btn-timetable-close" className="btn-hud shrink-0 !bg-slate-800 !text-white" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mb-2 flex flex-wrap gap-1">
          {DAYS.map((d) => (
            <button
              key={d.id}
              type="button"
              data-testid={`tab-${d.id}`}
              data-active={shown === d.id}
              onClick={() => setShown(d.id)}
              className={'rounded-full px-3 py-1 text-xs font-bold ' + (shown === d.id ? 'bg-blue-700 text-white' : 'bg-white/80 text-slate-800')}
            >
              {d.short}
              {d.id === today ? ' · today' : ''}
            </button>
          ))}
        </div>
        <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
          {sessions.length === 0 && <li className="rounded-xl bg-white/80 px-3 py-2 text-sm text-slate-700">Nothing for Group {PLAYER_GROUP} on this day.</li>}
          {sessions.map((s) => (
            <SessionRow key={s.id} s={s} today={shown === today} now={now} />
          ))}
        </ul>
        <p className="mt-2 text-[11px] leading-tight text-slate-600">
          Clinic and lab sessions are listed as on the paper timetable but cannot be played yet. To attend a lecture, go to its hall and sit at your seat: the end chair of the first row, by the aisle.
        </p>
      </div>
    </div>
  )
}

/** The next lecture and the way to its seat, once she is inside the university grounds. */
export function ClassHud() {
  const entered = useRouteStore((s) => s.enteredAt !== null)
  const x = usePlayerStore((s) => s.x)
  const z = usePlayerStore((s) => s.z)
  const camDeg = usePlayerStore((s) => s.camDeg)
  const day = useAcademicStore((s) => s.day)
  const record = useAcademicStore((s) => s.record)
  const pending = useAcademicStore((s) => s.pending)
  const now = useRoutineStore((s) => s.routine.minutes)
  const next = nextLecture(day, now, record)
  const room = next ? PLACE_ROOM[next.place] : undefined
  const guide = next && room ? guideToSeat(x, z, room) : null
  const arrow = useUnwrapped(guide ? Math.round(bearingDegrees(x, z, guide.aim, (camDeg * Math.PI) / 180)) : 0)
  const zone = worldZoneAt(x, z)
  if (!entered || pending || !CAMPUS_ZONES.has(zone)) return null
  const style = { top: 'calc(max(env(safe-area-inset-top), 0.75rem) + 2.75rem)' }
  if (!next || !guide) {
    const left = sessionsFor(day).filter((s) => s.kind !== 'lecture').length
    return (
      <div
        data-testid="class-hud"
        data-phase="none"
        className="pointer-events-none absolute inset-x-0 mx-auto w-fit max-w-[50%] rounded-2xl bg-black/50 px-4 py-2 text-center text-xs text-white backdrop-blur"
        style={style}
      >
        <p className="text-sm font-bold">No more lectures today</p>
        {left > 0 && <p className="opacity-80">The clinic and lab sessions on your timetable open in a later stage.</p>}
      </div>
    )
  }
  const inHall = zone === room
  const wait = next.start - now
  const when = wait > 0 ? `starts ${formatTime(next.start)} (in ${Math.round(wait)} min)` : `started ${formatTime(next.start)}`
  return (
    <div
      data-testid="class-hud"
      data-phase={inHall ? 'seat' : 'walk'}
      data-session={next.id}
      data-remaining={Math.round(guide.remaining)}
      data-arrow={arrow}
      className="pointer-events-none absolute inset-x-0 mx-auto flex w-fit max-w-[50%] items-center gap-3 rounded-2xl bg-black/50 px-3 py-1.5 text-white backdrop-blur"
      style={style}
    >
      <svg viewBox="0 0 40 40" className="h-9 w-9 shrink-0" style={{ transform: `rotate(${arrow}deg)`, transition: 'transform 0.25s linear' }} aria-hidden>
        <circle cx="20" cy="20" r="19" fill="rgba(255,255,255,0.14)" />
        <path d="M20 5 L30 27 L20 22 L10 27 Z" fill="#7dd3fc" stroke="#1f2937" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-bold">
          {sessionTitle(next)} · {PLACE_NAMES[next.place]}
        </p>
        <p className="text-[11px] opacity-90">
          {when} · {Math.round(guide.remaining)} m · {guide.text}
        </p>
        <p className="text-[11px] opacity-70">{formatClock(now)} now · {sessionDoctors(next)}</p>
      </div>
    </div>
  )
}
