# Dental Life

A mobile-first 3D life simulation of a fourth-year dental student living in Yemen.
Runs in the phone's browser from a web link — no install, no second device.

**Current status: Stage 3 — Mobile Touch Controls (v0.3.1).**
The game is played **with the phone held sideways (landscape)**. Tap **New Game** and the character can be walked around the placeholder courtyard with a floating joystick (left thumb), a look-around drag (right thumb), pinch-to-zoom and a Run toggle, with a third-person camera that does not clip through walls. On a touch phone the tap also asks the browser for full screen and a landscape lock (Android Chrome allows it; iPhone Safari does not); a narrow portrait screen shows a "Turn your phone sideways" prompt that disappears when the phone is rotated. The environment is still a stand-in until Stage 4. The Stage 2 character inspector (idle / walk / run, four camera angles) is kept at `?preview=1`. See `docs/ARCHITECTURE.md` for the plan.

### Controls
| Input | Touch | Keyboard / mouse |
| --- | --- | --- |
| Move | Left half of the screen: touch and drag (the joystick appears under your thumb) | WASD or arrow keys |
| Look | Right half of the screen: drag | Drag with the mouse |
| Zoom | Pinch with two fingers on the right half | Mouse wheel |
| Run | **Run** button (toggle) | Hold Shift |
| Re-centre camera behind her | Round arrow button | C |

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
