// Academic-life checks (plain Node 22.18+, no browser, no dependencies): the real timetable of Group B (Stage 9),
// the attendance rules, her seat in each lecture hall, the sitting pose, and a pilot that follows the guidance from
// many places inside the university all the way to the seat using the real movement and interaction code.
import { buildGrid, queryGrid } from '../src/controls/spatial.ts'
import { PLAYER_RADIUS, createPlayer, pointBlocked, stepPlayer, wrapAngle } from '../src/controls/movement.ts'
import { ARRIVE_DIST, APPROACH_TIMEOUT, startAction, stepAction, worldToStick } from '../src/controls/interaction.ts'
import { RIG, SIT_HIP_Y, SIT_LEG, GESTURES, ankleHeight, applyGesture, createPose, solvePose } from '../src/character/animations/pose.ts'
import { ROUTE_BOUNDS, WORLD_COLLIDERS, worldZoneAt } from '../src/streets/routeLayout.ts'
import { ZONE_NAMES } from '../src/street/streetLayout.ts'
import { FLOOR_Y, LECTURE_SEATS, UNI_COLLIDERS, UNI_PEOPLE, UNI_ROOMS, roomById, FURNITURE } from '../src/university/uniLayout.ts'
import {
  DAYS, GROUPS, PLAYER_GROUP, PLACE_NAMES, PLACE_ROOM, SESSIONS, SUBJECT_NAMES, dayFromQuery, formatTime, lecturesOn, sessionDoctors, sessionTimes, sessionTitle, sessionsFor,
} from '../src/academics/timetable.ts'
import {
  LATE_UNTIL, PRESENT_UNTIL, beginLecture, dayCounts, finishLecture, lectureClock, lectureSeconds, lectureState, markFor, nextLecture, nextLectureIn, seatOffer,
} from '../src/academics/attendance.ts'
import { bearingDegrees, guideToSeat } from '../src/academics/guide.ts'

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures += 1
}
const hm = (h, m = 0) => h * 60 + m
const by = (id) => SESSIONS.find((s) => s.id === id)

// ---- the timetable ---------------------------------------------------------------------------------
check('the teaching week is Saturday to Thursday and the player is in Group B', DAYS.map((d) => d.id).join() === 'sat,sun,mon,tue,wed,thu' && PLAYER_GROUP === 'B' && GROUPS.length === 5)
check('every session has a positive length, lies between 08:00 and 16:00 and names real subjects', SESSIONS.every((s) => s.end > s.start && s.start >= hm(8) && s.end <= hm(16) && s.subjects.length >= 1 && s.subjects.every((id) => SUBJECT_NAMES[id])))
check('session ids are unique', new Set(SESSIONS.map((s) => s.id)).size === SESSIONS.length)
check('every lecture is for all groups, in the Grand Hall or Hall 313, with exactly one named doctor', SESSIONS.filter((s) => s.kind === 'lecture').every((s) => s.groups === 'all' && PLACE_ROOM[s.place] && s.doctors.length === 1))
check('clinic and lab sessions are never in a lecture hall and name their groups', SESSIONS.filter((s) => s.kind !== 'lecture').every((s) => !PLACE_ROOM[s.place] && Array.isArray(s.groups) && s.groups.length >= 1))
check('every lab is for exactly one group and names two doctors', SESSIONS.filter((s) => s.kind === 'lab').every((s) => s.groups.length === 1 && s.doctors.length === 2))
for (const g of GROUPS) {
  const clashes = []
  for (const d of DAYS) {
    const list = sessionsFor(d.id, g)
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (list[i].start < list[j].end && list[j].start < list[i].end) clashes.push(`${d.id} ${list[i].id}/${list[j].id}`)
  }
  check(`Group ${g} never has two sessions at the same time`, clashes.length === 0, clashes.join(', '))
}
const week = Object.fromEntries(DAYS.map((d) => [d.id, sessionsFor(d.id).map((s) => `${sessionTimes(s)} ${sessionTitle(s)}`)]))
check('Group B on Saturday: Periodontology 1 8–10 and Fixed Prosthodontics 3 10–12, both lectures in the Grand Hall', JSON.stringify(week.sat) === JSON.stringify(['08:00–10:00 Periodontology 1', '10:00–12:00 Fixed Prosthodontics 3']) && lecturesOn('sat').length === 2 && lecturesOn('sat').every((s) => s.place === 'grand-hall'))
check('Group B on Sunday: only clinic and lab sessions (Endodontics 3, Operative Dentistry 4, the Orthodontics 1 lab)', sessionsFor('sun').length === 3 && lecturesOn('sun').length === 0)
check('Group B on Monday: four lectures in a row in the Grand Hall, 08:00 to 14:00', lecturesOn('mon').length === 4 && lecturesOn('mon')[0].start === hm(8) && lecturesOn('mon')[3].end === hm(14) && lecturesOn('mon').every((s, i, a) => i === 0 || s.start === a[i - 1].end))
check('Group B on Tuesday: one clinic block 08:00–12:00 (Fixed and Removable Prosthodontics) and no lecture', sessionsFor('tue').length === 1 && sessionsFor('tue')[0].kind === 'clinic' && sessionsFor('tue')[0].subjects.length === 2 && lecturesOn('tue').length === 0)
check('Group B on Wednesday: two lectures in Hall 313 (Oral Medicine 1, Oral Surgery 1) and no clinic block (that is for A, C and E)', sessionsFor('wed').length === 2 && lecturesOn('wed').every((s) => s.place === 'hall-313'))
check('Group B on Thursday: Oral Surgery 1 and Periodontology 1 in the clinic, then Research Methodology in Hall 313', sessionsFor('thu').length === 3 && lecturesOn('thu').length === 1 && lecturesOn('thu')[0].subjects[0] === 'research' && lecturesOn('thu')[0].start === hm(12))
check('nine lectures in the week for Group B', DAYS.reduce((n, d) => n + lecturesOn(d.id).length, 0) === 9)
check('doctor names and times read well', sessionDoctors(by('sat-perio1')) === 'Dr. Abeer Barehim' && sessionDoctors(by('sun-endo3')) === 'Department Staff' && formatTime(hm(8, 5)) === '08:05' && PLACE_NAMES['hall-313'] === 'Hall 313')
check('?day= picks a day by its first three letters, case-blind; nonsense gives null', dayFromQuery('?day=mon') === 'mon' && dayFromQuery('?day=Thursday') === 'thu' && dayFromQuery('?day=fri') === null && dayFromQuery('') === null)
check('the two halls are named on the map like the timetable: Grand Hall and Hall 313', ZONE_NAMES.hall1 === 'Grand Hall' && ZONE_NAMES.hall2 === 'Hall 313' && roomById('hall1').name === 'Grand Hall' && roomById('hall2').name === 'Hall 313')

// ---- attendance rules ------------------------------------------------------------------------------
{
  const s = by('mon-ortho1') // 08:00–09:00
  const st = (now, rec = {}) => lectureState(s, now, rec)
  check('a lecture is upcoming before it starts, open from its start, shut after 30 minutes and missed once over', st(hm(7, 30)) === 'upcoming' && st(hm(8)) === 'open' && st(hm(8, 29)) === 'open' && st(hm(8, 30)) === 'closed' && st(hm(9)) === 'absent')
  check('she is marked present up to 10 minutes after the start, late up to 30, and the door is shut after that', markFor(s, hm(7, 20)) === 'present' && markFor(s, hm(8, PRESENT_UNTIL)) === 'present' && markFor(s, hm(8, PRESENT_UNTIL + 1)) === 'late' && markFor(s, hm(8, LATE_UNTIL - 1)) === 'late' && markFor(s, hm(8, LATE_UNTIL)) === null)
  check('an attended lecture keeps its mark whatever the clock says', st(hm(11), { [s.id]: 'present' }) === 'present' && st(hm(8, 45), { [s.id]: 'late' }) === 'late')
  check('a lecture takes 5 to 18 real seconds, about ten game minutes per second', lectureSeconds(hm(8), hm(9)) === 6 && lectureSeconds(hm(8), hm(8, 20)) === 5 && lectureSeconds(hm(7, 19), hm(14)) === 18 && lectureSeconds(hm(8), hm(10)) === 12)
}
{
  const rec = {}
  check('Saturday, 07:19, Grand Hall: the seat offers Periodontology 1 and she will wait for it', (() => {
    const o = seatOffer('hall1', 'sat', hm(7, 19), rec)
    return o.enabled && o.session?.id === 'sat-perio1' && /wait/.test(o.note ?? '') && /Periodontology 1/.test(o.label)
  })())
  check('Saturday, Hall 313: no lectures there today, and the seat is greyed out', (() => {
    const o = seatOffer('hall2', 'sat', hm(7, 19), rec)
    return !o.enabled && o.session === null && /No lectures in this hall today/.test(o.note)
  })())
  check('Saturday, 08:20: she can still go in and is told she is late', (() => {
    const o = seatOffer('hall1', 'sat', hm(8, 20), rec)
    return o.enabled && /late/.test(o.note ?? '') && markFor(o.session, hm(8, 20)) === 'late'
  })())
  check('Saturday, 08:45: the first door is shut, so the seat offers the 10:00 lecture instead', (() => {
    const o = seatOffer('hall1', 'sat', hm(8, 45), rec)
    return o.enabled && o.session?.id === 'sat-fixedpros3' && /wait/.test(o.note ?? '')
  })())
  check('Thursday, 12:45: the only lecture in Hall 313 has shut its door and the note says so', (() => {
    const o = seatOffer('hall2', 'thu', hm(12, 45), rec)
    return !o.enabled && /door is shut/.test(o.note ?? '')
  })())
  check('Thursday, 14:00: no more lectures in Hall 313', (() => {
    const o = seatOffer('hall2', 'thu', hm(14), rec)
    return !o.enabled && /No more lectures/.test(o.note ?? '')
  })())
  check('Sunday has no lecture in either hall', !seatOffer('hall1', 'sun', hm(8), rec).enabled && !seatOffer('hall2', 'sun', hm(8), rec).enabled && nextLecture('sun', hm(8), rec) === null)
}
{
  // Monday, a whole day: arrive 07:19, attend the four lectures one after the other
  let rec = {}
  let now = hm(7, 19)
  const log = []
  for (let k = 0; k < 6; k++) {
    const o = seatOffer('hall1', 'mon', now, rec)
    if (!o.enabled) break
    const p = beginLecture(o.session, now)
    log.push(`${o.session.id}:${p.mark}@${formatTime(p.from)}`)
    check(`Monday lecture ${k + 1}: the clock runs from ${formatTime(p.from)} to the end of the lecture in even steps`, lectureClock(p, o.session.end, 0) === p.from && lectureClock(p, o.session.end, 1) === o.session.end && Math.abs(lectureClock(p, o.session.end, 0.5) - (p.from + o.session.end) / 2) < 1e-9 && lectureClock(p, o.session.end, 2) === o.session.end)
    rec = finishLecture(rec, p)
    now = o.session.end
  }
  check('Monday: four lectures attended in a row, all present, the clock ends at 14:00', Object.keys(rec).length === 4 && Object.values(rec).every((m) => m === 'present') && now === hm(14), log.join(' '))
  const c = dayCounts('mon', now, rec)
  check('the day counts add up: 4 lectures, 4 present, none late or missed, none to come', c.lectures === 4 && c.present === 4 && c.late === 0 && c.absent === 0 && c.pending === 0, JSON.stringify(c))
  const none = dayCounts('mon', hm(15), {})
  check('a Monday with no attendance is four missed lectures once the day is over, and four to come at 07:00', none.absent === 4 && dayCounts('mon', hm(7), {}).pending === 4)
  check('Monday, 08:25: she is late for the first lecture, present for the second', (() => {
    const o = seatOffer('hall1', 'mon', hm(8, 25), {})
    const p = beginLecture(o.session, hm(8, 25))
    const rec2 = finishLecture({}, p)
    const o2 = seatOffer('hall1', 'mon', hm(9), rec2)
    return p.mark === 'late' && o2.session.id === 'mon-opdent4' && markFor(o2.session, hm(9)) === 'present'
  })())
  check('nextLectureIn follows the room: on Wednesday Hall 313 has the lectures and the Grand Hall has none', nextLectureIn('hall2', 'wed', hm(7, 30), {})?.id === 'wed-oralmed1' && nextLectureIn('hall1', 'wed', hm(7, 30), {}) === null)
}

// ---- her seat in each lecture hall -------------------------------------------------------------------
const blockedAt = (x, z, r = PLAYER_RADIUS) => UNI_COLLIDERS.some((c) => pointBlocked(x, z, FLOOR_Y + 0.5, c, r - 1e-6))
for (const room of ['hall1', 'hall2']) {
  const seat = LECTURE_SEATS[room]
  const r = roomById(room).rect
  check(`${ZONE_NAMES[room]}: her seat is inside the hall, in the first row (the one nearest the corridor), at the end next to the aisle`, seat.x > r.x0 && seat.x < r.x1 && seat.z > r.z0 && seat.z < r.z0 + 2.4 && worldZoneAt(seat.x, seat.z) === room)
  check(`${ZONE_NAMES[room]}: her body fits at the seat (nothing solid within her radius) and she faces the board`, !blockedAt(seat.x, seat.z) && seat.heading === 0)
  check(`${ZONE_NAMES[room]}: the chair slot is open on the aisle side and on the corridor side, closed on the other three sides`, (() => {
    const s = seat.slot
    return !blockedAt(s.x1 + 0.4, seat.z) && !blockedAt(seat.x, s.z0 - 0.4) && blockedAt(s.x0 - 0.45, seat.z) && blockedAt(seat.x, s.z1 + 0.45)
  })())
  check(`${ZONE_NAMES[room]}: nobody else sits in her chair`, UNI_PEOPLE.every((p) => Math.hypot(p.x - seat.x, p.z - seat.z) > 0.5))
  check(`${ZONE_NAMES[room]}: the chair rows still block the way elsewhere (a point in the middle of another chair, and on a table)`, (() => {
    const row = FURNITURE.find((f) => f.kind === 'deskrow' && f.rect.x0 < seat.x && f.rect.x1 > seat.x - 0.01 && f.rect.z0 === seat.slot.z0)
    return !!row && blockedAt(row.rect.x0 + 0.6, seat.z) && blockedAt(seat.x, row.rect.z1 - 0.2)
  })())
}

// ---- the sitting pose --------------------------------------------------------------------------------
{
  const pose = createPose()
  solvePose(pose, 0, 0, 1.3)
  const standY = pose.bodyY
  applyGesture(pose, 'sit', 1, 1.3)
  const ankle = Math.min(ankleHeight(pose.legL.thigh, pose.legL.knee), ankleHeight(pose.legR.thigh, pose.legR.knee)) + pose.bodyY
  check('the sitting gesture exists, with both legs bent to the seated shape', 'sit' in GESTURES && pose.legL.thigh === SIT_LEG.thigh && pose.legR.knee === SIT_LEG.knee)
  check('seated, her feet stay on the floor (ankles at standing height) and she is lowered about 30 cm', Math.abs(ankle - RIG.ankleY) < 1e-6 && standY - pose.bodyY > 0.25 && standY - pose.bodyY < 0.38, `${(standY - pose.bodyY).toFixed(3)} m lower`)
  check('her hips rest on the chair: the hip joint sits 5 to 10 cm above the 47.5 cm seat', SIT_HIP_Y > 0.475 + 0.05 && SIT_HIP_Y < 0.475 + 0.1, `${SIT_HIP_Y.toFixed(3)} m`)
  check('the thighs reach about 40 cm forward, so the knees go under a desk 50 cm from the chair centre', (() => RIG.thigh * Math.sin(SIT_LEG.thigh) > 0.38 && RIG.thigh * Math.sin(SIT_LEG.thigh) < 0.41)())
  const half = createPose()
  solvePose(half, 0, 0, 1.3)
  applyGesture(half, 'sit', 0.5, 1.3)
  check('half way into the pose the body is half way down, so sitting down and standing up are smooth', Math.abs(half.bodyY - (standY + (pose.bodyY - standY) / 2)) < 1e-6)
  const none = createPose()
  solvePose(none, 0, 0, 1.3)
  const before = JSON.stringify(none)
  applyGesture(none, 'sit', 0, 1.3)
  check('with no weight the gesture changes nothing', JSON.stringify(none) === before)
  const brush = createPose()
  solvePose(brush, 0, 0, 1.3)
  applyGesture(brush, 'brush', 1, 1.3)
  check('the other gestures still leave the legs alone', brush.legL.thigh === 0 && brush.legL.knee === 0 && brush.bodyY === standY)
}

// ---- walking the guidance to the seat ------------------------------------------------------------------
const GRID = buildGrid(WORLD_COLLIDERS, ROUTE_BOUNDS, 12, 2)
const walkOn = (p, sx, sy, camYaw, maxSpeed = 1.45) => stepPlayer(p, sx, sy, camYaw, maxSpeed, 1 / 60, queryGrid(GRID, p.x, p.z), ROUTE_BOUNDS)
const starts = {
  'the forecourt, far from the steps': [-150, -462],
  'the foot of the steps': [-160, -467],
  'the lobby': [-160, -482],
  'the corridor, west end': [-181, -488.1],
  'the corridor, east end': [-140, -488.1],
  'the Student Affairs office': [-141, -482.5],
  'the other lecture hall': [-176, -480],
  'the courtyard': [-160, -496],
}
for (const room of ['hall1', 'hall2']) {
  const seat = LECTURE_SEATS[room]
  const seatSpot = { id: `seat-${room}`, x: seat.x, z: seat.z, heading: seat.heading, radius: 0.8 }
  const otherHall = room === 'hall1' ? [-147, -480.5] : [-176, -480]
  for (const [where, at0] of Object.entries({ ...starts, 'the other lecture hall': otherHall })) {
    const p = createPlayer(at0[0], at0[1], 0)
    let t = 0
    let state = 'walk'
    let act = null
    let faultAt = null
    const camYaw = 1.2
    let dist0 = Infinity
    for (; t < 150 && state !== 'done'; t += 1 / 60) {
      if (state === 'walk') {
        const g = guideToSeat(p.x, p.z, room)
        const d = Math.hypot(seat.x - p.x, seat.z - p.z)
        if (d <= seatSpot.radius && worldZoneAt(p.x, p.z) === room) {
          state = 'act'
          dist0 = d
          act = startAction(seatSpot, 12, 'sit')
          continue
        }
        const dx = g.aim.x - p.x
        const dz = g.aim.z - p.z
        const m = Math.hypot(dx, dz) || 1
        const [sx, sy] = worldToStick(dx / m, dz / m, camYaw)
        walkOn(p, sx, sy, camYaw)
      } else {
        const s = stepAction(act, p, 1 / 60, camYaw)
        walkOn(p, s.stick[0], s.stick[1], camYaw)
        if (s.faceTo !== null) p.heading = wrapAngle(p.heading + wrapAngle(s.faceTo - p.heading) * (1 - Math.exp(-10 / 60)))
        if (s.done) state = 'done'
      }
    }
    const d = Math.hypot(seat.x - p.x, seat.z - p.z)
    check(`from ${where} the guidance leads to the seat in ${ZONE_NAMES[room]}, and she sits exactly on it`, state === 'done' && d <= ARRIVE_DIST + 0.03 && Math.abs(wrapAngle(p.heading - seat.heading)) < 0.35, `${t.toFixed(0)} s, ${d.toFixed(2)} m off, reached the seat radius from ${dist0.toFixed(2)} m`)
    if (faultAt !== null) failures += 1
  }
}
{
  // pressing the button from the places around the seat: the approach reaches the seat before the timeout
  let n = 0
  let ok = 0
  let worst = 0
  for (const room of ['hall1', 'hall2']) {
    const seat = LECTURE_SEATS[room]
    const seatSpot = { id: `seat-${room}`, x: seat.x, z: seat.z, heading: seat.heading, radius: 0.8 }
    for (let k = 0; k < 24; k++) {
      for (const dist of [0.35, 0.6, 0.78]) {
        const a = (k / 24) * Math.PI * 2
        const x = seat.x + Math.cos(a) * dist
        const z = seat.z + Math.sin(a) * dist
        if (blockedAt(x, z)) continue
        n += 1
        const p = createPlayer(x, z, 0)
        const act = startAction(seatSpot, 12, 'sit')
        let t = 0
        let arrived = null
        for (; t < APPROACH_TIMEOUT + 1 && arrived === null; t += 1 / 60) {
          const s = stepAction(act, p, 1 / 60, 0.7)
          walkOn(p, s.stick[0], s.stick[1], 0.7)
          if (s.faceTo !== null) arrived = Math.hypot(seat.x - p.x, seat.z - p.z)
        }
        worst = Math.max(worst, arrived ?? 9)
        if (arrived !== null && arrived <= ARRIVE_DIST + 0.03) ok += 1
      }
    }
  }
  check(`pressing the button from ${n} places within reach of a seat: she ends up on the seat (the ones cut off by a desk or the chair beside excepted)`, n >= 40 && ok >= n * 0.9, `${ok}/${n}, worst ${worst.toFixed(2)} m`)
}
check('the arrow: straight ahead is 0°, a point to her right is positive, behind is ±180°', (() => {
  const a = bearingDegrees(0, 0, { x: 0, z: 5 }, 0)
  const r = bearingDegrees(0, 0, { x: -5, z: 0 }, 0)
  const b = bearingDegrees(0, 0, { x: 0, z: -5 }, 0)
  const turned = bearingDegrees(0, 0, { x: 5, z: 0 }, Math.PI / 2)
  return Math.abs(a) < 1e-9 && Math.abs(r - 90) < 1e-9 && Math.abs(Math.abs(b) - 180) < 1e-9 && Math.abs(turned) < 1e-9
})())
check('the guidance text and distance make sense: far outside it says to go to the entrance; in the corridor, to follow it; the distance falls as she gets closer', (() => {
  const far = guideToSeat(-150, -440, 'hall1')
  const corr = guideToSeat(-181, -488.1, 'hall2')
  const near = guideToSeat(-160, -488.1, 'hall2')
  return /entrance/.test(far.text) && /corridor/i.test(corr.text) && far.remaining > guideToSeat(-160, -467, 'hall1').remaining && corr.remaining > near.remaining
})())
check('every room and zone on the campus has a name the guidance knows (no zone leaves her without an aim)', UNI_ROOMS.every((r) => { const c = { x: (r.rect.x0 + r.rect.x1) / 2, z: (r.rect.z0 + r.rect.z1) / 2 }; const g = guideToSeat(c.x, c.z, 'hall1'); return Number.isFinite(g.aim.x) && Number.isFinite(g.remaining) && g.text.length > 0 }))

console.log(failures === 0 ? '\nAll academic-life checks passed.' : `\n${failures} academic-life check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
