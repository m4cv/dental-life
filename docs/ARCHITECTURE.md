# Architecture

One rule: every game system lives in its own folder under `src/` and talks to the rest through
small, typed interfaces. Folders marked *(empty)* hold only a `.gitkeep` until their stage.

## Module map

| Folder | Responsibility | Filled in |
| --- | --- | --- |
| `config/` | Constants: game info, graphics profiles, colour palette | Stage 1 |
| `engine/` | WebGL renderer (`GameCanvas`), WebGL2 detection, mobile touch guards, `orientation.ts` (full screen + landscape lock, best effort) | Stages 1, 3 |
| `state/` | Zustand stores. `useAppStore` = which screen is showing + FPS; `useControlStore` = Run toggle; `usePlayerStore` = throttled position / speed read-out; `useRoutineStore` = the morning routine and the toast; `usePromptStore` = what the Interact button offers and the action progress | Stage 1 (grows each stage) |
| `world/` | Scene composition. `PlayerRig` (the player, her controller, the follow camera and the interaction loop, configured per scene), `HomeScene` (Stage 4, the default), `PlayableScene` (the Stage 3 courtyard, `?scene=courtyard`), `courtyardLayout.ts`, `CourtyardBackdrop`, `CharacterShowcase` (Stage 2 preview scene), `TestScene` (Stage 1 scene, kept) | Stages 1–4 |
| `ui/` | React overlay UI: screens (`MainMenu`, `GameScreen`, …) and components | Stage 1 → ongoing |
| `character/` + `character/animations/` | Player model (`PlayerCharacter`), shapes (`charShapes.ts`), materials/geometry (`assets.ts`), locomotion maths (`animations/pose.ts`) | Stage 2 |
| `camera/` | `followCamera.ts`: orbit rig (yaw / pitch / distance) and the spring-arm that pulls the camera in front of walls | Stage 3 |
| `controls/` | `movement.ts` (pure walking + collision maths), `layout.ts` (pure screen-size maths: control sizes, "needs rotating"), `input.ts` (mutable input state), `interaction.ts` (pure: walk to a spot, face it, act), `TouchControls.tsx` (joystick, look drag, pinch, Run / Recentre / Interact buttons, keyboard) | Stages 3, 4 |
| `home/` | `homeLayout.ts` (pure: rooms, walls with openings, furniture footprints, spots, colliders), `routine.ts` (pure: steps, clock, what the button offers), `spawn.ts` (`?at=`), `sceneBuilder.ts` (merges shapes per material), `homeTextures.ts` (canvas textures), `buildHome.ts` (the 3D home) | Stage 4 |
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
* **Camera** (`camera/followCamera.ts`). Orbit around a pivot 1.45 m above the ground: default pitch 0.26 rad (−0.05 … 1.15), distance 4.6 m (2.2 … 9). The spring-arm marches from the pivot outwards and stops at a tall collider or just above the floor; the arm shortens instantly and lengthens smoothly. Dragging works like turning your head: right turns the view to the right, left to the left, down looks down (the camera rises), spreading two fingers zooms in.
* **Landscape first.** The game is designed for a phone held sideways. `controls/layout.ts` sizes the controls from the *short* side of the screen: joystick base = 31 % of it (96–150 px, so 121 px on an 844×390 phone), Run 17 % (56–72 px), Recentre 78 % of Run (48–56 px). Run sits in the bottom-right corner with Recentre stacked above it; the joystick rests in the bottom-left corner. Left/right safe-area insets keep controls off a notch. `ui/components/RotatePrompt.tsx` covers the game while the screen is narrow portrait (`needsRotate`: height > width and width < 820 px), so tablets and desktop windows are left alone. The Stage 2 inspector (`?preview=1`) has no prompt.
* **Full screen + lock.** `engine/orientation.ts`, called from the New Game tap on touch devices only (`pointer: coarse`): `requestFullscreen` then `screen.orientation.lock('landscape')`. Both are allowed to fail silently (iPhone Safari refuses both); the rotate prompt covers that case. The camera's vertical field of view is 46° on wide screens and 50° on tall ones (`fovForAspect`).
* **Touch UI** (`controls/TouchControls.tsx`). Pointer events on one full-screen layer with `touch-action: none`. The floating joystick appears wherever the left thumb lands (left half of the screen); the right half looks, and two fingers on the right half pinch. The buttons stay out of the stick's way and are excluded from the look drag. Rotating the phone lets go of any touch and re-seats the resting joystick. A hint pill fades after 9 s or the first touch.
* **Testing.** `scripts/test-controls.mjs` (about 60 checks, including layout sizes and the rotate rule: shaping, camera-relative direction, acceleration, turning, frame-rate independence at 120 / 60 / 20 FPS, collisions, camera rig). `scripts/smoke-test.mjs` drives the real page at 844×390 landscape with synthetic multi-touch (CDP `Input.dispatchTouchEvent`) in headless Chrome and checks the menu fit, control placement (no overlaps), the portrait prompt and rotating back, walking, running, wall collision, camera drag, recentre, pinch zoom, no page scroll, keyboard fallback and new-game reset.
* **Preview.** `?preview=1` opens the Stage 2 character inspector instead of the playable scene.

## The home (Stage 4)

* **One layout, two readers.** `home/homeLayout.ts` is plain data and pure functions (no three.js, no React). The scene draws it and the movement code collides with it, so what you see and what stops you cannot drift apart. Walls are generated from centre lines (0.2 m thick, 2.9 m high); doors, windows and openings are cut into them (`wallPieces`). A window stays solid for the player, a door is a gap. Furniture has a collision footprint that is separate from its detailed look.
* **Estimated, not measured.** Room sizes, door positions and the bathroom are estimates from five photographs; each room is marked `photos` or `estimate` in `ROOMS`. Replace the numbers when a plan exists and everything follows.
* **Cheap to draw.** `home/sceneBuilder.ts` collects boxes, cylinders, spheres, rings and planes and merges them into one mesh per material, so the whole home is a few dozen draw calls. Textures (the lace-pattern floor tile, black marble, wood grain, the sage-green quilt, the television picture) are drawn on small canvases at start-up; there are no image downloads. Only the front-door leaf and the pink notebook are separate meshes because they move. Three warm point lights (chandelier, bedside lamp, dining pendant), a hemisphere light and a mostly overhead sun that only gives soft shadows indoors.
* **Doing things.** `world/HomeScene.tsx` gives `PlayerRig` a list of spots. When she stands inside a spot's reach and the step is not done, `PlayerRig` publishes a prompt (`usePromptStore`) and the **Interact** button (or E) appears. Tapping it starts an action (`controls/interaction.ts`): the stick is locked, she is walked to the exact spot through the normal collision code (2 s limit), turns to face the right way and plays a gesture (`character/animations/pose.ts` → `applyGesture`: brush, mirror, dress, eat, pack, open) for 1.6–3.2 s. When it ends, `useRoutineStore.finish` ticks the step, moves the clock on (06:30 → 07:00) and shows a message. The front door's collider is removed and the door swings open only once all five steps are done.
* **Indoor camera.** `PlayerRig` runs the camera in indoor mode when a ceiling height is given: the arm may come as close as 0.5 m, keeps 0.18 m from walls, stays under the ceiling, and when the way back is short it climbs and looks down from above (`indoorPitch`, up to 83° in a tight spot) instead of ending up behind a wall. Ceiling fixtures and wall air-conditioners are *camera-only* colliders (`CAMERA_ONLY_COLLIDERS`, with a `bottom` height): she walks under them, the camera stays out of them. `test-controls.mjs` checks every free position in every room at eight headings (never behind a wall, inside furniture or a fixture, above the ceiling, or closer than 0.8 m).
* **Testing.** `scripts/test-home.mjs` (58 checks): wall splitting, windows vs doors, a 10 cm flood fill with the real player radius proving every spot and room is reachable with the door shut (also with a fatter 0.36 m body, so thumbs do not have to be exact), the door and porch pen, spot logic, the routine, 64 simulated actions with the real movement code, the `?at=` parser. `test-pose.mjs` covers the gestures, `test-controls.mjs` the ceiling and the indoor camera. `scripts/smoke-test.mjs` drives the real page in headless Chrome: Stage 3 against `?scene=courtyard`, then Stage 4 — steering the on-screen stick from the read-out it walks bedroom → living room → dining → bathroom, presses Interact at each spot, checks the checklist, clock, locked stick, the greyed-out and shut front door, then the open door and the porch, and finally one picture per room.
