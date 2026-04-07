# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Island Obstacle Speedrun** — a 3D browser-based obstacle-course/speedrun game built with Three.js + TypeScript + Vite. The player navigates a tropical island, triggers a start zone to begin a timer, completes obstacle and interaction challenges, and rings a finish bell to stop the timer.

## Commands

```bash
npm install          # install dependencies
npm run dev          # start Vite dev server (hot reload)
npm run build        # TypeScript compile + Vite production build
npm run preview      # preview the production build locally
```

There is no test runner configured; validation is done via in-game playtesting against the acceptance checklist in `spec.md`.

## Architecture

The module layout follows `plan.md`:

- `src/main.ts` — app entry point, render loop, wires all systems together
- `src/core/` — renderer setup, scene, camera manager, clock/timestep
- `src/game/` — `GameStateManager` (states: `Idle → Running → Won → Respawning`), run timer, respawn logic; single authoritative `RunContext` holds current time, checkpoint, and active interaction flags
- `src/player/` — `PlayerController`, `InputMap`, movement/jump physics, camera follow data
- `src/world/` — island terrain, water plane, spawn/finish/water trigger volumes, obstacle placement
- `src/interactions/` — `Interactable` interface (`canInteract`, `interact`, `getPrompt`) + concrete handlers: lever, button, basketball throw/target
- `src/obstacles/` — moving obstacle behaviors and collision proxies
- `src/ui/` — HUD timer, win panel, interaction prompts ("Press E", camera mode indicator)
- `src/assets/` — texture/model loaders with fallback materials

**Per-frame update order (must be preserved):**
1. Read input
2. Update player physics
3. Resolve collisions
4. Process triggers and interactions
5. Update timer/game state
6. Render frame and UI

Interactions use an event-dispatch pattern (`onLeverFlipped`, `onButtonPressed`, `onTargetHit`) so gameplay logic stays decoupled from object scripts. All trigger checks are centralized to prevent race conditions (e.g., simultaneous win + respawn).

## Key Constraints

- Deliver MVP from `spec.md` before any stretch features (day/night cycle, extra routes, best-time persistence).
- At least five distinct textured objects and five unique world objects required for the rubric.
- Phong-style lighting (ambient + diffuse + specular) must be visible and meaningful.
- Camera toggle (first-person ↔ third-person, key `V`) must not reset run progress.
- Falling into water or leaving the playable area respawns at start checkpoint; this must use the same respawn path as all other respawn triggers.
