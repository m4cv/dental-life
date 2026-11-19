# Dental Life

A mobile-first 3D life simulation of a fourth-year dental student living in Yemen.
Runs in the phone's browser from a web link — no install, no second device.

**Current status: Stage 4 — The Home (v0.4.0).**
The game is played **with the phone held sideways (landscape)**. Tap **New Game** and you wake up in the bedroom of a single-storey home built from the photographs: the living room (dark glossy tiles with white lace pattern, grey velvet sofa, black marble television wall), the dining area (white marble table, blue-grey chairs), the bedroom (white beams, champagne curtains, sage-green bed), the dressing table with its round lit mirror, and a plain bathroom. A **morning routine** has five steps — brush your teeth, check the mirror, straighten your coat, have breakfast, pack your notebook — each done with the **Interact** button that appears when you stand at the right place. The front door stays shut until all five are done; then it opens onto a small porch (the street comes in Stage 5).

**What is real and what is estimated.** The furniture, colours and materials follow the photographs. The room sizes, the door positions and the whole bathroom are **estimates** (no floor plan and no bathroom photo yet); the kitchen and the outside are not built. Nothing here is a 3D scan of the photographs. The Stage 3 courtyard test set is kept at `?scene=courtyard`, the Stage 2 character inspector at `?preview=1`, and `?at=x,z,deg` starts the home at a chosen spot (0° faces south, 90° east, 180° north, 270° west). See `docs/ARCHITECTURE.md` for the plan.

### Controls
| Input | Touch | Keyboard / mouse |
| --- | --- | --- |
| Move | Left half of the screen: touch and drag (the joystick appears under your thumb) | WASD or arrow keys |
| Look | Right half of the screen: drag | Drag with the mouse |
| Zoom | Pinch with two fingers on the right half | Mouse wheel |
| Run | **Run** button (toggle) | Hold Shift |
| Re-centre camera behind her | Round arrow button | C |
| Interact (brush teeth, mirror, door…) | **Interact** button, left of Run, shown only when something can be done where you stand | E |

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
