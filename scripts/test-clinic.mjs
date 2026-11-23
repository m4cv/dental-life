// Clinic checks (plain Node 22.18+, no browser, no dependencies): the dental clinic of Stage 10 — its layout and its door, the
// dental units and counters, the way in, the order of washing hands, putting on a mask and then gloves, what her stool offers across
// the week, the guidance, and a pilot that follows it with the real movement and interaction code.
import { buildGrid, queryGrid } from '../src/controls/spatial.ts'
import { PLAYER_RADIUS, createPlayer, pointBlocked, stepPlayer, wrapAngle } from '../src/controls/movement.ts'
import { ARRIVE_DIST, startAction, stepAction, worldToStick } from '../src/controls/interaction.ts'
import { GESTURES } from '../src/character/animations/pose.ts'
import { ROUTE_BOUNDS, WORLD_COLLIDERS, worldZoneAt } from '../src/streets/routeLayout.ts'
import { ZONE_NAMES } from '../src/street/streetLayout.ts'
import { nearestSpot } from '../src/home/routine.ts'
import {
  BUILDING_WALLS, CEILING_PANELS, CEIL_Y, CHAIR_H, CLINIC, CLINIC_BEHIND, CLINIC_COLLIDERS, CLINIC_FURNITURE, CLINIC_PASSAGE, CLINIC_PREP, CLINIC_SEAT, CLINIC_UPPER, CLINIC_WALLS,
  DENTAL_UNITS, DOORS, FLOOR_Y, FL, HER_UNIT, STOOL_H, STOOL_R, TRAY_H, UNIT_COLS, UNIT_ROWS, UNI, UNI_CAMERA_COLLIDERS, UNI_COLLIDERS, UNI_PEOPLE, UNI_ROOMS, campusZoneAt,
  floorHeightAt, inClinic, insideBuilding, wallPieces,
} from '../src/university/uniLayout.ts'
import { SESSIONS, attendableOn, clinicSessionsOn, isAttendable, sessionsFor, formatTime } from '../src/academics/timetable.ts'
import { beginLecture, finishLecture, lectureClock, lectureSeconds, markFor, nextSession, sessionCounts } from '../src/academics/attendance.ts'
import { PREP_STEPS, clinicSeatOffer, completePrep, nextPrepStep, prepComplete, prepPrompt, prepSummary, stepOf } from '../src/academics/clinic.ts'
import { clinicPathFromDoor, guideToClinic } from '../src/academics/guide.ts'

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures += 1
}
const hm = (h, m = 0) => h * 60 + m
const EPS = 1e-6
const overlap = (a, b) => a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.z0 < b.z1 - EPS && b.z0 < a.z1 - EPS
const within = (inner, outer, margin = 0) => inner.x0 >= outer.x0 + margin - EPS && inner.x1 <= outer.x1 - margin + EPS && inner.z0 >= outer.z0 + margin - EPS && inner.z1 <= outer.z1 - margin + EPS
const inRect = (r, x, z) => x >= r.x0 - EPS && x <= r.x1 + EPS && z >= r.z0 - EPS && z <= r.z1 + EPS
const stoolRect = (u) => ({ x0: u.stool.x - STOOL_R, x1: u.stool.x + STOOL_R, z0: u.stool.z - STOOL_R, z1: u.stool.z + STOOL_R })
const blockedAt = (x, z, r = PLAYER_RADIUS) => UNI_COLLIDERS.some((c) => pointBlocked(x, z, FLOOR_Y + 0.5, c, r - 1e-6))

console.log(`      (${DENTAL_UNITS.length} dental units, ${CLINIC_COLLIDERS.length} clinic colliders, ${CLINIC_FURNITURE.length} counters)`)

// ---- the room and its door ------------------------------------------------------------------------------------------------
check('the clinic is the south end of the west wing\'s ground floor: 15.2 m by 27 m between its walls, inside the wing', (() => {
  const wing = { x0: -198, x1: -182, z0: -527, z1: -480 }
  return within(CLINIC, wing) && Math.abs(CLINIC.x1 - CLINIC.x0 - 15.2) < EPS && Math.abs(CLINIC.z1 - CLINIC.z0 - 27) < EPS
})())
check('its three walls are 40 cm thick, as high as the ceiling, and the rest of the wing behind it is solid', CLINIC_WALLS.length === 3 && CLINIC_WALLS.every((w) => Math.abs(w.t - 0.4) < EPS && w.top === CEIL_Y) && CLINIC_BEHIND.z1 === CLINIC.z0 && CLINIC_UPPER.y0 === FL && CLINIC_UPPER.rect.z0 === CLINIC.z0)
check('the door is a 1.6 m double door in the west end of the corridor, on its centre line, at least 90 cm wide and 2.3 m high', (() => {
  const main = BUILDING_WALLS.find((w) => w.id === 'west')
  const inner = CLINIC_WALLS.find((w) => w.id === 'clinic-east')
  const corridor = UNI_ROOMS.find((r) => r.id === 'corridor').rect
  const a = main.openings[0]
  const b = inner.openings[0]
  return main.openings.length === 1 && inner.openings.length === 1 && a.at === DOORS.clinicZ && b.at === DOORS.clinicZ && a.w === 1.6 && b.w === 1.6 && a.h >= 2.3 && b.h >= 2.3
    && DOORS.clinicZ > corridor.z0 && DOORS.clinicZ < corridor.z1 && Math.abs(DOORS.clinicZ - (corridor.z0 + corridor.z1) / 2) < 1.5
})())
check('the passage through the two walls is 80 cm long and as wide as the door, between the clinic and the corridor', Math.abs(CLINIC_PASSAGE.x1 - CLINIC_PASSAGE.x0 - 0.8) < EPS && Math.abs(CLINIC_PASSAGE.z1 - CLINIC_PASSAGE.z0 - 1.6) < EPS && CLINIC_PASSAGE.x0 === CLINIC.x1 && UNI_ROOMS.find((r) => r.id === 'corridor').rect.x0 === CLINIC_PASSAGE.x1)
check('the clinic\'s walls have a doorway where the door is and are solid everywhere else (no gap a person could slip through)', (() => {
  const w = CLINIC_WALLS.find((q) => q.id === 'clinic-east')
  const solid = wallPieces(w).filter((p) => p.part === 'solid')
  const gap = solid.every((p) => !(p.rect.z0 < DOORS.clinicZ + 0.8 - EPS && p.rect.z1 > DOORS.clinicZ - 0.8 + EPS))
  const total = solid.reduce((n, p) => n + (p.rect.z1 - p.rect.z0), 0)
  return gap && Math.abs(total - ((w.s1 - w.s0) - 1.6)) < 1e-6
})())
check('the floor is 45 cm in the clinic and its passage, she is "inside the building" there, and the place chip says Dental clinic', (() => {
  return floorHeightAt(-190, -490) === FLOOR_Y && floorHeightAt(-182.2, DOORS.clinicZ) === FLOOR_Y && insideBuilding(-190, -490) && insideBuilding(-182.2, DOORS.clinicZ)
    && inClinic(-190, -490) && campusZoneAt(-190, -490) === 'clinic' && ZONE_NAMES.clinic === 'Dental clinic' && worldZoneAt(-190, -490) === 'clinic' && campusZoneAt(-190, -515) === null
})())
check('the upper floors of the wing over the clinic only block the camera, above the ceiling, like the main building\'s', UNI_CAMERA_COLLIDERS.length === 3 && UNI_CAMERA_COLLIDERS[2].bottom === FL && FL >= CEIL_Y && !UNI_COLLIDERS.some((c) => c.kind === 'box' && c.height > 5 && inRect(CLINIC, c.x, c.z)))

// ---- the dental units and the counters -------------------------------------------------------------------------------
check('there are twelve dental units in three columns of four, with unique ids, and exactly one is hers', DENTAL_UNITS.length === 12 && UNIT_COLS.length === 3 && UNIT_ROWS.length === 4 && new Set(DENTAL_UNITS.map((u) => u.id)).size === 12 && DENTAL_UNITS.filter((u) => u.hers).length === 1)
check('her unit is the one next to the door: the first row, the column on the east aisle', HER_UNIT.x === Math.max(...UNIT_COLS) && HER_UNIT.z === Math.max(...UNIT_ROWS) && Math.abs(HER_UNIT.stool.x - CLINIC_SEAT.x) < EPS && Math.abs(HER_UNIT.stool.z - CLINIC_SEAT.z) < EPS && CLINIC_SEAT.heading === 0)
check('everything of every unit and every counter lies inside the clinic, 30 cm or more from the walls (the counters touch their wall)', (() => {
  const bad = []
  for (const u of DENTAL_UNITS) for (const [name, r] of [['chair', u.chair], ['tray', u.tray], ['stool', stoolRect(u)]]) if (!within(r, CLINIC, 0.3)) bad.push(`${u.id} ${name}`)
  for (const f of CLINIC_FURNITURE) if (!within(f.rect, CLINIC, 0)) bad.push(f.id)
  return bad.length === 0 ? true : bad.join(', ')
})() === true)
check('no two things overlap: chairs, trays, stools and counters', (() => {
  const items = [...DENTAL_UNITS.flatMap((u) => [[`${u.id} chair`, u.chair], [`${u.id} tray`, u.tray], [`${u.id} stool`, stoolRect(u)]]), ...CLINIC_FURNITURE.map((f) => [f.id, f.rect])]
  const bad = []
  items.forEach(([a, ra], i) => items.forEach(([b, rb], j) => i < j && overlap(ra, rb) && bad.push(`${a}/${b}`)))
  return bad.length === 0 ? true : bad.join(', ')
})() === true)
check('there is room to walk: 1.2 m between the columns, 1.0 m between a row\'s chair and the next row\'s stool, and 2.5 m in the east aisle', (() => {
  const east = CLINIC.x1 - Math.max(...DENTAL_UNITS.map((u) => u.chair.x1))
  const cols = [...UNIT_COLS].sort((a, b) => a - b)
  const between = []
  for (let i = 0; i + 1 < cols.length; i++) between.push(DENTAL_UNITS.find((u) => u.x === cols[i + 1]).tray.x0 - DENTAL_UNITS.find((u) => u.x === cols[i]).chair.x1)
  const rows = [...UNIT_ROWS].sort((a, b) => b - a)
  const lanes = []
  // rows[i] is south of rows[i + 1]: the lane runs between the feet of the northern row's chair and the northern edge of the southern row's stool
  for (let i = 0; i + 1 < rows.length; i++) lanes.push(DENTAL_UNITS.find((u) => u.z === rows[i]).stool.z - STOOL_R - DENTAL_UNITS.find((u) => u.z === rows[i + 1]).chair.z1)
  return east >= 2.5 && between.every((g) => g >= 1.2) && lanes.every((g) => g >= 1.0)
})())
check('the heights make sense: chairs and trays are below the ceiling, a stool is at the height of a lecture chair (47.5 cm)', CHAIR_H < CEIL_Y - FLOOR_Y - 1 && TRAY_H < CHAIR_H && STOOL_H === 0.475)
check('the patient chairs and the trays are solid; every stool is solid except hers (a student on it makes it solid)', (() => {
  const solid = (x, z) => CLINIC_COLLIDERS.some((c) => pointBlocked(x, z, FLOOR_Y + 0.3, c, 0))
  const chairs = DENTAL_UNITS.every((u) => solid(u.x, u.z + 0.3) && solid((u.tray.x0 + u.tray.x1) / 2, (u.tray.z0 + u.tray.z1) / 2))
  const stools = DENTAL_UNITS.filter((u) => !u.hers).every((u) => solid(u.stool.x, u.stool.z) || UNI_PEOPLE.some((p) => Math.hypot(p.x - u.stool.x, p.z - u.stool.z) < 0.05))
  return chairs && stools && !CLINIC_COLLIDERS.some((c) => pointBlocked(CLINIC_SEAT.x, CLINIC_SEAT.z, FLOOR_Y + 0.3, c, PLAYER_RADIUS - 1e-6)) && !blockedAt(CLINIC_SEAT.x, CLINIC_SEAT.z)
})())
check('there is a light over every dental unit and three over the hand-wash end, all inside the clinic', (() => {
  const mine = CEILING_PANELS.filter((p) => inRect(CLINIC, p.x, p.z))
  return mine.length === 15 && DENTAL_UNITS.every((u) => mine.some((p) => Math.abs(p.x - u.x) < 0.01 && p.z > u.z - 0.5 && p.z < u.z + 1.2))
})())
check('the clinic has people: the doctor standing, two students seated on stools of their units and one standing in the aisle', (() => {
  const mine = UNI_PEOPLE.filter((p) => p.where === 'clinic')
  const onStool = mine.filter((p) => p.pose === 'sit').every((p) => DENTAL_UNITS.some((u) => !u.hers && Math.hypot(u.stool.x - p.x, u.stool.z - p.z) < 0.05))
  return mine.length === 4 && mine.filter((p) => p.pose === 'sit').length === 2 && onStool && mine.every((p) => inRect(CLINIC, p.x, p.z))
})())

// ---- the three places where she gets ready -------------------------------------------------------------------------------
const PREP_SPOTS = Object.entries(CLINIC_PREP).map(([id, p]) => ({ id, x: p.x, z: p.z, heading: p.heading, radius: 0.85 }))
const SEAT_SPOT = { id: 'seat-clinic', x: CLINIC_SEAT.x, z: CLINIC_SEAT.z, heading: CLINIC_SEAT.heading, radius: 0.8 }
const ALL_SPOTS = [SEAT_SPOT, ...PREP_SPOTS]
const wash = CLINIC.z1
check('she washes at the hand-wash counter on the south wall: wash, mask and gloves stand in that order away from the door, facing the wall, 1.5 m or more apart', (() => {
  const counter = CLINIC_FURNITURE.find((f) => f.id === 'cl-counter-wash').rect
  const ok = PREP_SPOTS.every((s) => s.x > counter.x0 && s.x < counter.x1 + 0.5 && Math.abs(s.heading) < EPS && s.z - counter.z0 >= -1.2 && s.z - counter.z0 <= -0.5)
  return ok && CLINIC_PREP.wash.x > CLINIC_PREP.mask.x + 1.5 && CLINIC_PREP.mask.x > CLINIC_PREP.gloves.x + 1.5 && wash > CLINIC_PREP.wash.z
})())
check('she can stand at each of the three spots and at her stool (nothing solid within her radius), and the three are far enough from her stool', ALL_SPOTS.every((s) => !blockedAt(s.x, s.z)) && PREP_SPOTS.every((s) => Math.hypot(s.x - SEAT_SPOT.x, s.z - SEAT_SPOT.z) > 4))
check('standing at a spot, that spot (and no other) is the one in reach; at the seat too', ALL_SPOTS.every((s) => nearestSpot(s.x, s.z, ALL_SPOTS)?.id === s.id) && ALL_SPOTS.every((a) => ALL_SPOTS.every((b) => a === b || Math.hypot(a.x - b.x, a.z - b.z) > Math.max(a.radius, b.radius))))
check('the three new gestures exist: wash, mask and gloves', ['wash', 'mask', 'gloves'].every((k) => GESTURES[k]) && PREP_STEPS.every((s) => GESTURES[s.gesture]))

// ---- walking: the colliders ---------------------------------------------------------------------------------------------------
const B = ROUTE_BOUNDS
const walkGrid = buildGrid(WORLD_COLLIDERS, B, 12, PLAYER_RADIUS + 1)
const free = (x, z, r = PLAYER_RADIUS) => {
  for (const c of queryGrid(walkGrid, x, z)) if (pointBlocked(x, z, 0, c, r)) return false
  return true
}
{
  const CELL = 0.1
  const box = { x0: UNI.compound.x0 - 2, x1: UNI.compound.x1 + 2, z0: UNI.compound.z0 - 2, z1: UNI.compound.z1 + 2 }
  const NX = Math.round((box.x1 - box.x0) / CELL)
  const NZ = Math.round((box.z1 - box.z0) / CELL)
  const seen = new Uint8Array(NX * NZ)
  const stack = new Int32Array(NX * NZ)
  const idx = (x, z) => [Math.round((x - box.x0) / CELL), Math.round((z - box.z0) / CELL)]
  const start = idx(UNI.arrival.x, UNI.arrival.z)
  let sp = 0
  seen[start[1] * NX + start[0]] = 1
  stack[sp++] = start[1] * NX + start[0]
  while (sp) {
    const k = stack[--sp]
    const i = k % NX
    const j = (k - i) / NX
    for (let n = 0; n < 4; n++) {
      const ni = i + (n === 0 ? 1 : n === 1 ? -1 : 0)
      const nj = j + (n === 2 ? 1 : n === 3 ? -1 : 0)
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue
      const kk = nj * NX + ni
      if (seen[kk] || !free(box.x0 + ni * CELL, box.z0 + nj * CELL)) continue
      seen[kk] = 1
      stack[sp++] = kk
    }
  }
  const reach = (x, z) => {
    const [i, j] = idx(x, z)
    return i >= 0 && j >= 0 && i < NX && j < NZ && seen[j * NX + i] === 1
  }
  check('she can walk from the arrival spot through the corridor and the double door to each of the three spots and to her stool', ALL_SPOTS.every((s) => free(s.x, s.z) && reach(s.x, s.z)) && reach(-180, DOORS.clinicZ) && reach(-182.2, DOORS.clinicZ) && reach(-184, DOORS.clinicZ))
  check('the door is the only way in: the walls are solid beside it, along the clinic\'s west, south and east sides, and from the courtyard', (() => {
    for (const z of [-486.6, -489.6, -495, -503, -480.2]) if (reach(-182.2, z)) return false
    for (const x of [-197.8, -190, -185]) if (reach(x, -480.2)) return false
    for (const z of [-484, -495, -503]) if (reach(-197.8, z)) return false
    // the courtyard side of the wing's east wall
    for (const z of [-492, -500, -506]) if (reach(-182.2, z)) return false
    return true
  })())
  check('the rest of the west wing, behind the clinic, is solid: she cannot walk into it from the clinic or from the courtyard', !reach(-190, -516) && !reach(-190, -510) && !reach(-195, -520) && !reach(-190, -507.2))
  check('no free spot of the clinic is cut off: every free cell inside it can be walked to from the door (the pockets round the units are open)', (() => {
    const bad = []
    for (let x = CLINIC.x0 + 0.4; x < CLINIC.x1 - 0.3; x += 0.4) {
      for (let z = CLINIC.z0 + 0.4; z < CLINIC.z1 - 0.3; z += 0.4) if (free(x, z) && !reach(x, z)) bad.push(`${x.toFixed(2)},${z.toFixed(2)}`)
    }
    return bad.length === 0 ? true : bad.slice(0, 4).join('; ')
  })() === true)
  check('she cannot walk through a patient chair, a tray, a counter, a stool with a student on it or a standing person', DENTAL_UNITS.every((u) => !free(u.x, u.z + 0.3) && !free((u.tray.x0 + u.tray.x1) / 2, (u.tray.z0 + u.tray.z1) / 2)) && CLINIC_FURNITURE.every((f) => !free((f.rect.x0 + f.rect.x1) / 2, (f.rect.z0 + f.rect.z1) / 2)) && UNI_PEOPLE.filter((p) => p.where === 'clinic' && p.pose === 'stand').every((p) => !free(p.x, p.z)))
}

// ---- the three steps of getting ready ---------------------------------------------------------------------------------------------
check('the three steps are wash, mask, gloves, in that order, each with a gesture, a time and the minutes it takes on the clock', PREP_STEPS.map((s) => s.id).join() === 'wash,mask,gloves' && PREP_STEPS.every((s) => s.seconds > 1 && s.minutes >= 1 && s.minutes <= 3 && s.label.length > 5) && PREP_STEPS[0].before === null && PREP_STEPS.slice(1).every((s) => s.before))
check('at the start only washing is offered; the mask and the gloves are greyed out and say what to do first', (() => {
  const w = prepPrompt('wash', [])
  const m = prepPrompt('mask', [])
  const g = prepPrompt('gloves', [])
  return w.enabled && !w.note && !m.enabled && m.note === 'Wash your hands first' && !g.enabled && g.note === 'Put on a mask first'
})())
check('after washing the mask is offered, and the wash button is gone; after the mask the gloves; when all three are done there is no button at all', (() => {
  const a = completePrep([], 'wash')
  const b = completePrep(a, 'mask')
  const c = completePrep(b, 'gloves')
  return prepPrompt('wash', a) === null && prepPrompt('mask', a).enabled && !prepPrompt('gloves', a).enabled && prepPrompt('gloves', b).enabled && c.join() === 'wash,mask,gloves' && prepComplete(c) && nextPrepStep(c) === null && [...'wash,mask,gloves'.split(',')].every((id) => prepPrompt(id, c) === null)
})())
check('a step out of order or repeated changes nothing', (() => {
  const a = completePrep([], 'gloves')
  const b = completePrep(completePrep([], 'wash'), 'wash')
  return a.length === 0 && b.length === 1 && completePrep(['wash'], 'gloves').length === 1
})())
check('the checklist says how far she is: none, one, two, ready', prepSummary([]) === '0 of 3 done · next: wash your hands' && prepSummary(['wash']) === '1 of 3 done · next: put on a mask' && prepSummary(['wash', 'mask']) === '2 of 3 done · next: put on gloves' && prepSummary(['wash', 'mask', 'gloves']) === 'Ready for the session' && stepOf('mask').gesture === 'mask')

// ---- the timetable: which sessions are clinic sessions in the clinic ----------------------------------------------------------------
check('Group B has clinic sessions in the clinic on Sunday (2), Tuesday (1) and Thursday (2) and none on the other days; the labs are not among them', ['sat', 'sun', 'mon', 'tue', 'wed', 'thu'].map((d) => clinicSessionsOn(d).length).join() === '0,2,0,1,0,2' && SESSIONS.filter((s) => s.kind === 'lab').every((s) => !isAttendable(s)) && sessionsFor('sun').filter((s) => s.kind === 'lab').length === 1)
check('what she can attend on a day: lectures and clinic sessions together, in time order (Thursday: two clinic sessions, then Research Methodology)', attendableOn('thu').map((s) => s.id).join() === 'thu-oralsurg1,thu-perio1,thu-research' && attendableOn('sun').map((s) => s.id).join() === 'sun-endo3,sun-opdent4' && attendableOn('mon').length === 4)
check('the day counts include the clinic sessions: Sunday is two sessions to come at 07:00, and none of them is a lecture; Thursday has three sessions of which one is a lecture', (() => {
  const sun = sessionCounts('sun', hm(7), {})
  const thu = sessionCounts('thu', hm(7), {})
  return sun.sessions === 2 && sun.lectures === 0 && sun.pending === 2 && thu.sessions === 3 && thu.lectures === 1 && sessionCounts('sun', hm(15), {}).absent === 2
})())
check('the next session of the day is the first clinic or lecture she can still attend', nextSession('sun', hm(7), {})?.id === 'sun-endo3' && nextSession('sun', hm(10, 5), { 'sun-endo3': 'present' })?.id === 'sun-opdent4' && nextSession('thu', hm(10, 5), { 'thu-oralsurg1': 'present' })?.id === 'thu-perio1' && nextSession('thu', hm(12, 10), { 'thu-oralsurg1': 'present', 'thu-perio1': 'present' })?.id === 'thu-research' && nextSession('sun', hm(13), {}) === null)

// ---- what her stool offers across the week ------------------------------------------------------------------------------------------------------
const READY = ['wash', 'mask', 'gloves']
check('Tuesday 07:40, not ready: the stool is greyed out, names the session and says what is left to do', (() => {
  const o = clinicSeatOffer('tue', hm(7, 40), {}, [])
  return !o.enabled && o.label === 'Attend: Fixed Prosthodontics 3 & Removable Prosthodontics 3' && /Get ready first: 0 of 3 done · next: wash your hands/.test(o.note) && o.session === null
})())
check('Tuesday 07:40, ready: the button is on, and says she will wait for 08:00', (() => {
  const o = clinicSeatOffer('tue', hm(7, 40), {}, READY)
  return o.enabled && o.session?.id === 'tue-fixedremovable' && /starts at 08:00: you will wait for it/.test(o.note)
})())
check('Tuesday: present within ten minutes of 08:00 (no note), late up to half past, then too late to join', (() => {
  const a = clinicSeatOffer('tue', hm(8, 5), {}, READY)
  const b = clinicSeatOffer('tue', hm(8, 20), {}, READY)
  const c = clinicSeatOffer('tue', hm(8, 31), {}, READY)
  return a.enabled && a.note === undefined && markFor(a.session, hm(8, 5)) === 'present' && b.enabled && /you are late/.test(b.note) && markFor(b.session, hm(8, 20)) === 'late' && !c.enabled && c.session === null && /too late to join/.test(c.note)
})())
check('days without a clinic session in the clinic say so: Saturday, Monday and Wednesday', ['sat', 'mon', 'wed'].every((d) => { const o = clinicSeatOffer(d, hm(9), {}, READY); return !o.enabled && o.note === 'No clinic session today' }))
check('after the last clinic session of the day the stool says there are no more; Group B\'s labs are not offered here', (() => {
  const o = clinicSeatOffer('sun', hm(13), { 'sun-endo3': 'present', 'sun-opdent4': 'present' }, READY)
  return !o.enabled && o.note === 'No more clinic sessions today' && clinicSeatOffer('sun', hm(12, 30), {}, READY).note !== undefined
})())
check('Sunday: endodontics at 08:00 first, then operative dentistry at 10:00 once the first is written in the record', (() => {
  const a = clinicSeatOffer('sun', hm(7, 30), {}, READY)
  const b = clinicSeatOffer('sun', hm(10, 0), { 'sun-endo3': 'present' }, READY)
  return a.label === 'Attend: Endodontics 3' && a.session.id === 'sun-endo3' && b.label === 'Attend: Operative Dentistry 4' && b.session.id === 'sun-opdent4' && b.note === undefined
})())
check('a whole Tuesday session: she sits at 07:50, the clock runs from 08:00 to 12:00 in even steps over 18 s, she is present, and the record shows it', (() => {
  const o = clinicSeatOffer('tue', hm(7, 50), {}, READY)
  const p = beginLecture(o.session, hm(7, 50))
  const rec = finishLecture({}, p)
  return p.mark === 'present' && p.from === hm(8) && lectureClock(p, o.session.end, 0.5) === hm(10) && lectureSeconds(p.from, o.session.end) === 18 && rec['tue-fixedremovable'] === 'present' && formatTime(o.session.end) === '12:00'
})())

// ---- the guidance and a pilot that follows it ----------------------------------------------------------------------------------------------------
const GRID = buildGrid(WORLD_COLLIDERS, ROUTE_BOUNDS, 12, 2)
const walkOn = (p, sx, sy, camYaw, maxSpeed = 1.45) => stepPlayer(p, sx, sy, camYaw, maxSpeed, 1 / 60, queryGrid(GRID, p.x, p.z), ROUTE_BOUNDS)
check('the guidance gives a point and a distance from every room and zone, and says what to do', UNI_ROOMS.every((r) => {
  const c = { x: (r.rect.x0 + r.rect.x1) / 2, z: (r.rect.z0 + r.rect.z1) / 2 }
  return ['seat', 'wash'].every((t) => { const g = guideToClinic(c.x, c.z, t); return Number.isFinite(g.aim.x) && Number.isFinite(g.aim.z) && Number.isFinite(g.remaining) && g.remaining > 0 && g.text.length > 5 })
}))
check('far outside it says to go to the main entrance, in the corridor to follow it west, inside to wash hands at the counter', /entrance/.test(guideToClinic(-150, -440, 'wash').text) && /corridor/i.test(guideToClinic(-160, -488.1, 'wash').text) && /Wash your hands/.test(guideToClinic(-190, -486, 'wash').text) && /dental unit/i.test(guideToClinic(-190, -486, 'seat').text))
check('the distance falls as she gets closer: forecourt > steps > lobby > corridor > door > inside', (() => {
  const ds = [[-150, -440], [-160, -467], [-160, -482], [-160, -488.1], [-181, -488.1], [-186, -486]].map(([x, z]) => guideToClinic(x, z, 'seat').remaining)
  return ds.every((d, i) => i === 0 || d < ds[i - 1])
})(), '')
check('from just inside the door it is about 7 m to her stool, about 8 m to the sink and farther to the gloves', (() => {
  const s = clinicPathFromDoor('seat')
  const w = clinicPathFromDoor('wash')
  const g = clinicPathFromDoor('gloves')
  return s > 4 && s < 12 && w > 4 && w < 12 && g > w
})())
{
  const starts = {
    'the forecourt, far from the steps': [-150, -462],
    'the foot of the steps': [-160, -467],
    'the lobby': [-160, -482],
    'the corridor, east end': [-140, -488.1],
    'the corridor, by the clinic door': [-180, -488.1],
    'the Student Affairs office': [-141, -482.5],
    'a lecture hall': [-176, -480],
    'the courtyard': [-160, -496],
    'inside the clinic, by the door': [-183.2, -488.1],
    'inside the clinic, at the far north-west corner': [-196, -505.5],
    'inside the clinic, between two columns of units': [-192.8, -498.5],
    'inside the clinic, at the sterilising counter': [-195.5, -482.2],
    'inside the clinic, beside the doctor': [-190, -487],
  }
  const camYaw = 1.2
  let ran = 0
  let failed = 0
  for (const target of ['wash', 'mask', 'gloves', 'seat']) {
    const spot = target === 'seat' ? SEAT_SPOT : PREP_SPOTS.find((s) => s.id === target)
    for (const [where, at0] of Object.entries(starts)) {
      const p = createPlayer(at0[0], at0[1], 0)
      let t = 0
      let state = 'walk'
      let act = null
      for (; t < 200 && state !== 'done'; t += 1 / 60) {
        if (state === 'walk') {
          const d = Math.hypot(spot.x - p.x, spot.z - p.z)
          if (d <= spot.radius && worldZoneAt(p.x, p.z) === 'clinic') {
            state = 'act'
            act = startAction(spot, 6, spot.id === 'seat-clinic' ? 'sit' : target)
            continue
          }
          const g = guideToClinic(p.x, p.z, target)
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
      const d = Math.hypot(spot.x - p.x, spot.z - p.z)
      const ok = state === 'done' && d <= ARRIVE_DIST + 0.03 && Math.abs(wrapAngle(p.heading - spot.heading)) < 0.35
      ran += 1
      if (!ok) {
        failed += 1
        check(`from ${where} the guidance leads to the "${target}" spot and the action runs there`, false, `${state} after ${t.toFixed(0)} s, ${d.toFixed(2)} m off, at ${p.x.toFixed(2)}, ${p.z.toFixed(2)}`)
      }
    }
  }
  check(`following the guidance from ${Object.keys(starts).length} places (the street, the lobby, the corridor, a hall, the courtyard and all over the clinic) to each of the four spots: she gets there and the action runs on the spot`, failed === 0, `${ran - failed}/${ran}`)
}

console.log(failures ? `\n${failures} clinic checks FAILED` : '\nAll clinic checks passed.')
process.exit(failures ? 1 : 0)
