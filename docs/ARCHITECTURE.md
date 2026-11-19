# Architecture

One rule: every game system lives in its own folder under `src/` and talks to the rest through
small, typed interfaces. Folders marked *(empty)* hold only a `.gitkeep` until their stage.

## Module map

| Folder | Responsibility | Filled in |
| --- | --- | --- |
| `config/` | Constants: game info, graphics profiles, colour palette | Stage 1 |
| `engine/` | WebGL renderer (`GameCanvas`), WebGL2 detection, mobile touch guards | Stage 1 |
| `state/` | Zustand stores. `useAppStore` = which screen is showing + FPS; `useControlStore` = Run toggle; `usePlayerStore` = throttled position / speed read-out | Stage 1 (grows each stage) |
| `world/` | Scene composition. `PlayableScene` (Stage 3: player rig + follow camera), `courtyardLayout.ts` (collider data), `CourtyardBackdrop` (stand-in courtyard), `CharacterShowcase` (Stage 2 preview scene), `TestScene` (Stage 1 scene, kept) | Stages 1–3 → replaced Stage 4+ |
| `ui/` | React overlay UI: screens (`MainMenu`, `GameScreen`, …) and components | Stage 1 → ongoing |
| `character/` + `character/animations/` | Player model (`PlayerCharacter`), shapes (`charShapes.ts`), materials/geometry (`assets.ts`), locomotion maths (`animations/pose.ts`) | Stage 2 |
| `camera/` | `followCamera.ts`: orbit rig (yaw / pitch / distance) and the spring-arm that pulls the camera in front of walls | Stage 3 |
| `controls/` | `movement.ts` (pure walking + collision maths), `input.ts` (mutable input state), `TouchControls.tsx` (joystick, look drag, pinch, Run / Recentre buttons, keyboard) | Stage 3 |
| `home/` | Interior and morning routine | Stage 4 *(empty)* |
| `streets/` | Neighbourhood and the home-to-university route | Stages 5 & 7 *(empty)* |
| `vehicle/` | Car model and arcade driving | Stage 6 *(empty)* |
| `university/` | Campus, hallways, classrooms | Stage 8 *(empty)* |
| `npcs/` | Students, instructors, patients, shopkeepers | Stages 8–12 *(empty)* |
| `missions/` | Lectures, exams, assignments, daily missions | Stages 9 & 12 *(empty)* |
| `clinic/` | Dental clinic, equipment, cases | Stages 10 & 11 *(empty)* |
| `environment/` | Shared sky, lighting, weather, time of day | as needed *(empty)* |
| `save/` | Save / load, persistence | Stage 13 *(empty)* |
| `assets/` | Typed manifest of asset paths | as needed *(empty)* |

## Rendering flow

```
main.tsx → App ──(screen = menu)──▶ MainMenu
              └─(screen = game)──▶ [WebGL2 ok?] ─▶ lazy GameScreen
                                                    ├─ GameCanvas (R3F <Canvas>, graphics profile)
                                                    │    ├─ <PlayableScene /> (world/): lights, backdrop, <PlayerRig> (character + follow camera)
                                                    │    │    (with ?preview=1: <CharacterShowcase /> instead)
                                                    │    └─ <FpsMeter />
                                                    └─ HUD overlay (DOM): TouchControls, Menu button, Diagnostics
                                                         (with ?preview=1: CharacterPreviewPanel instead of TouchControls)
```

* 3D lives inside `<GameCanvas>`; HUD / menus are ordinary DOM on top of it.
* Per-frame values never go through React state. FPS is the one exception and is throttled to 2 Hz.
* Performance knobs (pixel-ratio cap, shadows, MSAA) are in `config/graphics.ts`.

## Assets

* `reference/photos/**` — the original photographs. Read-only, and kept local (git-ignored: the GitHub repository is public). `reference/MANIFEST.sha256` lets
  anyone verify they are unchanged: `cd reference/photos && sha256sum -c ../MANIFEST.sha256`.
* `public/assets/<category>/` — anything generated or modelled for the game (GLB, textures,
  audio), loaded lazily at runtime. Categories: character, car, home, streets, university,
  clinic, npcs, environment, audio, ui.
* Where a photo cannot be turned into an accurate model, the stage will build a simplified
  hand-modelled approximation and say so explicitly.

## Dependencies deliberately not added yet
* **react-router-dom** — the menu ↔ game switch is a single store value; routes arrive when
  there are enough real screens to justify them.
* **@dimforge/rapier3d-compat** — physics arrives with character collision (Stage 2/3) or
  driving (Stage 6), whichever needs it first.
* IndexedDB / LocalStorage — Stage 13 (save system).

## Character (Stage 2)

* **No model file.** The player is built from primitives and procedural meshes, and posed every
  frame from code, so nothing is downloaded and the look is tunable. Heights are metres, +z forward,
  +x the character's left. Standing ankle height = hip − thigh − shin (`RIG` in `animations/pose.ts`).
* `animations/pose.ts` — pure maths (no three.js): `solvePose(pose, speed, phase, time)` blends idle →
  walk → run from a speed in m/s, solves foot contact so feet never sink below the ground, and adds
  blinking and breathing. `advancePhase` advances the gait cycle.
* `charShapes.ts` — pure shape data (coat rings, hijab shell/drape, decals, strap). `assets.ts` turns
  it into three.js geometry/materials once and shares them. `PlayerCharacter.tsx` assembles the rig.
* **Face:** the eyes are 3D (eyeball, textured iris cap, glints, a morph-driven eyelid that rests over the
  top of the iris and closes on blink, tapered eyeliner). Blush, eyeshadow, brows and lips are painted on a thin
  skin-shaped sheet (`facePatchMesh` + `faceTexture` in `assets.ts`). Eye and face proportions are in `charShapes.ts` (`EYE`, `FACE_PATCH`).
* The controller drives it with `<PlayerCharacter speed={…} position={…} rotationY={…} />`; `speed` may be a number or a `{ current }` ref so the rig can update it every frame without re-rendering.
* `npm test` runs `scripts/test-pose.mjs`, `scripts/test-shapes.mjs` and `scripts/test-controls.mjs` on plain Node.
* The coat is two pieces (torso and a hem that swings with the hips). Each continues a few centimetres past their seam, a little smaller (`tuckCoatMesh`), so the hem can tilt while running without showing a hole.
* Colours come from the reference photos; **trousers and shoes are not visible in them** and are a
  neutral choice.

## Controls (Stage 3)

* **Conventions.** The ground plane is (x, z). The camera yaw is the compass heading: forward = (sin yaw, cos yaw), right = (−cos yaw, sin yaw). Stick input is x = right, y = forward, and is turned into a world direction relative to the camera (`stickToWorld`). The character's `heading` is a rotation about +y.
* **Input is not React state.** `controls/input.ts` is a mutable object written by pointer / key events and read once per frame, so touching the screen never re-renders anything. The Run toggle is the one Zustand value because the button has to light up.
* **One frame loop.** `PlayerRig` has the only `useFrame`, so the order is fixed: look / recentre → `stepPlayer` → move the character → move the sun (its shadow box follows her) → spring-arm camera → throttled read-out.
* **Movement** (`controls/movement.ts`, pure and unit-tested). Dead-zone 0.12 with a smooth ramp, acceleration 9 and braking 14 m/s², the character turns toward her motion at up to 12 rad/s, walk 1.45 / run 3.6 m/s. Time is sub-stepped at 1/30 s and one frame is capped at 0.5 s, so slow phones move at the same real speed as fast ones. Speed is measured from the actual displacement after collisions, so pushing into a wall brings the walk animation to a stop.
* **Collision.** Axis-aligned boxes and circles with a height, a 0.28 m player radius, iterative push-out (slides along walls) and a world boundary. The courtyard's colliders live in `world/courtyardLayout.ts`; later stages add their own lists. Rapier is still deliberately not used.
* **Camera** (`camera/followCamera.ts`). Orbit around a pivot 1.45 m above the ground: default pitch 0.26 rad (−0.05 … 1.15), distance 4.6 m (2.2 … 9). The spring-arm marches from the pivot outwards and stops at a tall collider or just above the floor; the arm shortens instantly and lengthens smoothly. Dragging right turns the view left, dragging down tilts it up, spreading two fingers zooms in.
* **Touch UI** (`controls/TouchControls.tsx`). Pointer events on one full-screen layer with `touch-action: none`. The floating joystick (128 px base, 56 px travel) appears wherever the left thumb lands; the right half looks, and two fingers on the right half pinch. Buttons are 64 px (Run) and 48 px (Recentre), stay out of the stick's way and are excluded from the look drag. A hint pill fades after 9 s or the first touch.
* **Testing.** `scripts/test-controls.mjs` (about 50 checks: shaping, camera-relative direction, acceleration, turning, frame-rate independence at 120 / 60 / 20 FPS, collisions, camera rig). `scripts/smoke-test.mjs` drives the real page with synthetic multi-touch (CDP `Input.dispatchTouchEvent`) in headless Chrome and checks walking, running, wall collision, camera drag, recentre, pinch zoom, no page scroll, keyboard fallback and new-game reset.
* **Preview.** `?preview=1` opens the Stage 2 character inspector instead of the playable scene.
