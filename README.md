# Island Obstacle Speedrun

A 3D browser obstacle-course speedrun built with Three.js + TypeScript + Vite.

## Gameplay Flow

1. Spawn on the island hub.
2. Enter the **Level 1 portal** to start the run timer.
3. Complete levels to unlock later portals.
4. Enter the **Level 5 exit portal** to finish the run (win event + fireworks).

## Features

- 5 connected obstacle levels via portals
- Island hub with water and respawn logic
- Hazards: wipeouts, pistons, plungers, enemies
- Basketball interaction challenge (pickup/throw/trajectory preview)
- Day/night sky, animated water, lighting, shadows, HUD timer
- Final level checkpoint-based respawn support

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- npm

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Scripts

| Command           | Description                              |
| ----------------- | ---------------------------------------- |
| `npm run dev`     | Start Vite dev server with hot reload    |
| `npm run build`   | TypeScript check + Vite production build |
| `npm run preview` | Preview the production build locally     |
| `npm run check`   | Run TypeScript type checking             |

## Deployment

This project is deployed on [Vercel](https://vercel.com). Every pull request to `main` automatically generates a preview deployment.

To deploy manually:

```bash
npm run build   # outputs to dist/
```

The `dist/` directory contains the static production build ready for any hosting provider.

## Controls

### Core Movement

- **Click canvas** — Lock pointer
- **Mouse** — Look around
- **W / A / S / D** — Move
- **Space** — Jump
- **E** — Interact (for example, pick up basketball)

### Basketball

- **Hold Left Mouse Button** — Charge throw
- **Release Left Mouse Button** — Throw
- **T** — Toggle trajectory preview

### Dev Controls (`npm run dev` only)

- **F** — Toggle fly mode
- **Space** — Ascend while flying
- **Shift** — Descend while flying

## Tech Stack

- [Three.js](https://threejs.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
