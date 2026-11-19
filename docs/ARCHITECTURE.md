# Architecture

One rule: every game system lives in its own folder under `src/` and talks to the rest through
small, typed interfaces. Folders marked *(empty)* hold only a `.gitkeep` until their stage.

## Module map

| Folder | Responsibility | Filled in |
| --- | --- | --- |
| `config/` | Constants: game info, graphics profiles, colour palette | Stage 1 |
| `engine/` | WebGL renderer (`GameCanvas`), WebGL2 detection, mobile touch guards | Stage 1 |
| `state/` | Zustand stores. `useAppStore` = which screen is showing + FPS | Stage 1 (grows each stage) |
| `world/` | Scene composition. `CourtyardBackdrop` (stand-in courtyard), `CharacterShowcase` (Stage 2 preview scene), `TestScene` (Stage 1 scene, kept) | Stages 1–2 → replaced Stage 4+ |
| `ui/` | React overlay UI: screens (`MainMenu`, `GameScreen`, …) and components | Stage 1 → ongoing |
| `character/` + `character/animations/` | Player model (`PlayerCharacter`), shapes (`charShapes.ts`), materials/geometry (`assets.ts`), locomotion maths (`animations/pose.ts`) | Stage 2 |
| `camera/` | Third-person follow camera, collision avoidance | Stage 3 *(empty)* |
| `controls/` | Virtual joystick, touch camera, interact / run buttons | Stage 3 *(empty)* |
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
                                                    │    ├─ <CharacterShowcase /> (world/): lights, backdrop, <PlayerCharacter />, preview camera
                                                    │    └─ <FpsMeter />
                                                    └─ HUD overlay (DOM): Menu button, Diagnostics, CharacterPreviewPanel
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
* Controllers (Stage 3) only need `<PlayerCharacter speed={…} position={…} rotationY={…} />`.
* `npm test` runs `scripts/test-pose.mjs` and `scripts/test-shapes.mjs` on plain Node.
* Colours come from the reference photos; **trousers and shoes are not visible in them** and are a
  neutral choice.
