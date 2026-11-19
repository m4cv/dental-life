# Dental Life

A mobile-first 3D life simulation of a fourth-year dental student living in Yemen.
Runs in the phone's browser from a web link — no install, no second device.

**Current status: Stage 8 — The University (v0.8.0).**
The game is played **with the phone held sideways (landscape)**. Tap **New Game** and you wake up in the bedroom of a single-storey home built from the photographs: the living room (dark glossy tiles with white lace pattern, grey velvet sofa, black marble television wall), the dining area (white marble table, blue-grey chairs), the bedroom (white beams, champagne curtains, sage-green bed), the dressing table with its round lit mirror, and a plain bathroom. A **morning routine** has five steps — brush your teeth, check the mirror, straighten your coat, have breakfast, pack your notebook — each done with the **Interact** button that appears when you stand at the right place. The front door stays shut until all five are done.

Since Stage 5 the door opens onto a **walled yard with a gate**, then a **narrow lane** between two- to four-storey flat-roofed buildings, side lanes, and **Ninety Street (شارع التسعين)**: a wide divided road with pavements, a median with palms and street lamps, a pedestrian crossing and shops on both sides. It is all one world — no loading screen between the bedroom and the street — and a chip at the top names where you are (At home, Home yard, Neighbourhood lane, Ninety Street). A road-works barrier closes the south end of Ninety Street; the north end is open since Stage 7.

Since Stage 6 a **small light-blue hatchback is parked in the home lane**. Walk up to it and tap **Get in car**: the character disappears into the driver's seat, the camera swings behind the car, the stick steers and two pedals appear under your right thumb — **Gas** and **Brake** (the brake also reverses once you have stopped). A speedometer (km/h, gear D or R) shows at the bottom. Drive along the lane, across Ninety Street, and stop the car to **Get out** again. The car is solid: it stops at walls, lamps, palms and the barriers, it cannot enter the house, and she cannot walk through it either.

Since Stage 7 **Ninety Street goes on north for 330 m** between rows of shops (with a few side streets), ends at a **roundabout**, and the third exit leads west along **Al-Shaab Street (شارع الشعب)** to the **gate of the university**: a walled compound with a guard booth, a sign in English and Arabic, a forecourt with a tan canopy and parked-car bays, and the cream stone main building (four floors, arched windows, a projecting entrance with steps and a red carpet). Once the front door is open a card at the top says **University · N m**, shows an arrow that points along the road whichever way the camera looks, and tells you what comes next ("Roundabout ahead: take the 3rd exit…"). The **clock now runs with the distance** you travel (a game minute for every 42 m, on foot or by car; about 19 minutes for the whole drive, so you arrive at about 07:19) and a message tells you the time when you reach the forecourt.

Since Stage 8 **the main entrance of the university is open**. From the forecourt you walk up three steps on the red carpet (you really climb 45 cm, the camera rises with you), through the 5 m doorway between the blue shoulders and into the **lobby** (granite floor, a guard at his desk, two benches, potted plants). An arch leads to the **ground-floor corridor**, which has doors to **Lecture Hall 1** (desks in rows, a lectern, a lecturer at the board and four students), **Lecture Hall 2**, the **Student Affairs office**, and at the back a door out to the **courtyard**: two lawns inside low hedges, blue benches along both wings, two canopied kiosks with tables and stools, and a date palm in a round planter. Eighteen people stand or sit about the place; they are still, they do not talk and there is nothing to interact with yet. Indoors the ceiling stays over you, the camera stays under it, and a light travels with you; the chip names the room (University lobby, Ground-floor corridor, Lecture Hall 1 or 2, Student Affairs office, University courtyard). The upper three floors, the stairs and the ground floors of the two wings are **not** open: they are closed blocks until a later stage needs them.

**What is real and what is estimated.** *(Stage 8: there are no photographs of the inside of the university or of its courtyard layout, so every room, its size, the furniture, the people and the courtyard are **estimates** built from the three photographs of the front and the courtyard; the real rooms, the real timetable and the real lecture halls will replace them when you send photographs.)* The furniture, colours and materials of the home follow the photographs. The room sizes, the door positions and the whole bathroom are **estimates** (no floor plan and no bathroom photo yet); the kitchen is not built. The outdoors is built from satellite screenshots of Ninety Street only: the *character* (packed flat-roofed blocks in sand, cream, pink and grey, narrow lanes, a wide divided road) is taken from them, but the position of the home on the map, the lane widths, the individual buildings and the yard are **estimates**, generated by a fixed seed. Nothing here is a 3D scan of the photographs and no real building is reproduced. **The route is a compressed, stylised version of the real drive** (about 800 m instead of several kilometres): the university's address (Al-Shaab Street, east of Inma City, Aden) and the look of its front come from the photographs, but where the home is relative to it, the roundabout, the side streets and every other building along the way are **estimates** until you send the home's location and street-level photographs. The Stage 4 home alone is kept at `?scene=home`, the Stage 3 courtyard test set at `?scene=courtyard`, the Stage 2 character inspector at `?preview=1`. `?at=x,z,deg` starts anywhere in the neighbourhood (0° faces south, 90° east, 180° north, 270° west; the front door is at x 2.5, z 0.1) and `?routine=done` skips the morning routine, so the front door is already open. `?car=x,z,deg` parks the car somewhere else and `?drive=1` starts her in the driver's seat (for testing). See `docs/ARCHITECTURE.md` for the plan.

### Controls
| Input | Touch | Keyboard / mouse |
| --- | --- | --- |
| Move | Left half of the screen: touch and drag (the joystick appears under your thumb) | WASD or arrow keys |
| Look | Right half of the screen: drag | Drag with the mouse |
| Zoom | Pinch with two fingers on the right half | Mouse wheel |
| Run | **Run** button (toggle) | Hold Shift |
| Re-centre camera behind her | Round arrow button | C |
| Interact (brush teeth, mirror, door, get in / out of the car…) | **Interact** button, left of Run, shown only when something can be done where you stand | E |
| Steer (in the car) | Left thumb on the stick, sideways | A / D or left / right arrows |
| Gas / Brake (in the car) | **Gas** and **Brake** pedals under the right thumb (Brake also reverses) | W or up arrow / S or down arrow |

## Run it

Requires Node 20.19+ (Node 22 recommended).

```bash
npm install
npm run dev        # http://localhost:5173 — also prints a "Network" URL for your phone
npm run build      # type-checks, then builds to dist/
npm run preview    # serves dist/ at http://localhost:4173 (also on the LAN)
```

### Test on a phone
1. Put the phone and computer on the same Wi-Fi.
2. Run `npm run dev` and open the **Network** URL it prints (e.g. `http://192.168.1.20:5173`) in the phone's browser.

### Get a real web link
`npm run build`, then upload the `dist/` folder to any static host (Netlify Drop, Vercel,
Cloudflare Pages, GitHub Pages). The build uses a relative base path, so it works from any URL
or sub-folder.

### Automatic GitHub Pages build
`.github/workflows/deploy-pages.yml` runs `npm install` and `npm run build` on every push to
`main`, then publishes `dist/` to GitHub Pages. One-time setup in the repository:
**Settings → Pages → Build and deployment → Source: GitHub Actions**.

## What Stage 1 contains
- Vite + React 19 + TypeScript (strict) + Tailwind CSS 4 + Zustand.
- three.js through React Three Fiber (drei is installed for later stages).
- Mobile shell: no scrolling or pinch-zoom, safe-area padding for notches, 44px+ touch targets.
- Main menu → **New Game** → a 3D test scene (lights, shadows, fog, slow orbiting camera) with an
  FPS / pixel-ratio / viewport read-out for checking performance on a real phone.
- WebGL 2 check with a clear message on unsupported browsers, an error screen if the 3D canvas
  crashes, and a "graphics interrupted" notice if the phone drops the GL context.
- The 3D code is lazy-loaded: the menu appears fast, three.js downloads when you press New Game.

Not in Stage 1 (by design): character, camera controls, joystick, real locations, save system,
React Router, Rapier physics. They arrive in the stage that needs them.

## Folders

| Path | Purpose |
| --- | --- |
| `src/` | Game source (see `docs/ARCHITECTURE.md`) |
| `public/assets/<category>/` | Generated / modelled game assets loaded at runtime |
| `reference/photos/<category>/` | **Original photographs — never modified.** Kept local, not in the public repository |
| `reference/INDEX.md` | What each photo shows, and what is still missing (local only) |
| `docs/` | Architecture and planning notes |
