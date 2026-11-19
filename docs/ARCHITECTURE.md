# Architecture

One rule: every game system lives in its own folder under `src/` and talks to the rest through
small, typed interfaces. Folders marked *(empty)* hold only a `.gitkeep` until their stage.

## Module map

| Folder | Responsibility | Filled in |
| --- | --- | --- |
| `config/` | Constants: game info, graphics profiles, colour palette | Stage 1 |
| `engine/` | WebGL renderer (`GameCanvas`), WebGL2 detection, mobile touch guards | Stage 1 |
| `state/` | Zustand stores. `useAppStore` = which screen is showing + FPS | Stage 1 (grows each stage) |
| `world/` | Scene composition. `TestScene` is a throw-away proof-of-render scene | Stage 1 → replaced Stage 4+ |
| `ui/` | React overlay UI: screens (`MainMenu`, `GameScreen`, …) and components | Stage 1 → ongoing |
| `character/` + `character/animations/` | Player model, outfits, idle / walk / run … | Stage 2 *(empty)* |
| `camera/` | Third-person follow camera, collision avoidance | Stage 2 *(empty)* |
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
                                                    │    ├─ <TestScene />   (world/)
                                                    │    └─ <FpsMeter />
                                                    └─ HUD overlay (DOM): Menu button, Diagnostics
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
