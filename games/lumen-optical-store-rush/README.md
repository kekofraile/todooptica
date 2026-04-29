# Lumen Optical: Store Rush

Top-down browser management game set inside a modern optical boutique.

## Structure

- `app/`
  - Vite + TypeScript + Phaser source.
- `index.html` and `build/`
  - Static built output served by the parent website at `/games/lumen-optical-store-rush/`.

## Local development

1. Install the sub-app dependencies:
   - `cd games/lumen-optical-store-rush/app`
   - `npm install`
2. Start the Vite dev server for focused game work:
   - `npm run dev`
3. Rebuild the static site output used by the main website:
   - `cd /Users/kekofraile/Página web Todo Óptica`
   - `npm run build:store-rush`
4. Open the built route through the main site server:
   - `npm run dev`
   - Visit `http://127.0.0.1:5173/games/lumen-optical-store-rush/`

## Controls

- Move: `WASD` or arrow keys
- Interact: `E` or `Space`

## Core systems

- Visible optician movement in a persistent boutique layout
- Reception triage and station routing
- Background exam, browsing, and contact-lens timers
- Distinct pickup, frame, exam, lens, repair, checkout, and premium loops
- 18-day campaign, endless mode, upgrades, and localStorage progression
