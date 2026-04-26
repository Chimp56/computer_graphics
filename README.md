# Island Obstacle Speedrun

A 3D browser-based obstacle-course speedrun game built with Three.js, TypeScript, and Vite. Navigate a tropical island, trigger the start zone to begin a timer, complete obstacles and interaction challenges, and ring the finish bell to stop the timer.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- npm (included with Node.js)

## Getting Started

```bash
# Install dependencies
npm install

# Start the development server (hot reload)
npm run dev
```

The dev server will open at `http://localhost:5173`.

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

- **WASD** — Move
- **Space** — Jump
- **E** — Interact
- **V** — Toggle first-person / third-person camera

## Tech Stack

- [Three.js](https://threejs.org/) — 3D rendering
- [TypeScript](https://www.typescriptlang.org/) — Type safety
- [Vite](https://vitejs.dev/) — Build tooling and dev server
