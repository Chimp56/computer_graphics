# Computer Graphics Project Spec

## Project Title
Island Obstacle Speedrun

## Overview
This project is a 3D obstacle-course game set on a tropical island. The player starts in a start zone, navigates moving hazards and jumps, interacts with objects to unlock progress, and reaches the finish bell as quickly as possible.

The level is designed to support repeat play and speedrunning. If the player falls into water or leaves the playable area, they respawn at the start checkpoint and try again.

## Core Gameplay Loop
1. Enter start zone to begin run timer.
2. Move through obstacles and platforming sections.
3. Use interactions (lever, button, throw) to open or activate path elements.
4. Reach and ring the finish bell to end timer and win.
5. Restart and attempt a faster completion time.

## Controls
- `WASD`: Move
- `Space`: Jump
- `Mouse`: Look around
- `E`: Interact with nearby object
- `V`: Toggle first-person and third-person camera
- Hold left mouse button: Charge and throw basketball

## Functional Requirements (MVP)
- At least one complete playable level with clear start and finish.
- A practiced player can complete one run in about 2 minutes.
- Timer starts when entering the start zone and stops when ringing the finish bell.
- Falling into water or out-of-bounds respawns player at start checkpoint.
- At least one moving obstacle with collision.
- At least three interactive mechanics:
  - Lever flip to unlock/open path
  - Button press to trigger an event
  - Basketball throw to hit a target or trigger
- Camera view can be toggled during gameplay without resetting progress.

## Graphics and Technical Coverage
- **3D Scene:** Navigable tropical island environment.
- **Transformations:** Translation, rotation, and scaling in gameplay and scene objects.
- **Collision Detection:** Player collisions with obstacles, environment, and trigger zones.
- **Lighting and Shading:** Phong-style materials with ambient, diffuse, and specular response; at least one directional or point light.
- **Texturing:** At least five distinct textured objects.
- **Interaction:** At least three runtime interactions.
- **Scene Complexity:** At least five unique objects in the world.
- **Meaningful Duration:** Supports at least two minutes of active gameplay.

## Planned Features
### MVP Features
- Loading screen:
  - Animated 2D island-and-ocean canvas scene with progress bar.
  - Minimum display time of 1.5 seconds so the loader is always visible even on fast or cached loads.
  - If any asset fails to load, show an error message and a "Retry" button; do not advance to gameplay.
  - Shown only on initial page load. In-game restarts and respawns do not re-trigger the loader.
  - All assets (textures, models, audio) are loaded upfront during this screen — no lazy loading after gameplay begins.
  - After loading completes and the minimum display time has elapsed, show a "Click to Start" prompt. Clicking it locks the pointer and fades into gameplay.
  - Include an `aria-live` region that announces loading progress and state changes for screen readers.
- Tropical island terrain and water
- Player movement and jump controls
- First-person / third-person camera toggle
- Spinning wipeout-style obstacle
- Start and finish zones with timer UI
- Respawn system
- Lever and button interaction system
- Basketball pickup and throw mechanic
- Bell ring win trigger

### Stretch Features
- Additional level or alternate route
- Coin pickup after level completion
- Day/night cycle (about 1-minute loop)
- Best-time persistence in local storage

## Technology Stack
- `Three.js` for rendering and scene management
- `TypeScript` for gameplay logic
- `Vite` for local development and build tooling
- `Vercel` for deployment

## Acceptance Criteria Checklist
- [ ] Player can complete at least one full level from start to finish.
- [ ] Timer starts and stops at the correct triggers and shows final time.
- [ ] Movement, jump, and camera controls are responsive and reliable.
- [ ] At least one moving obstacle affects gameplay through collisions.
- [ ] Falling into water or out-of-bounds respawns player correctly.
- [ ] At least three interactions are fully playable.
- [ ] Scene includes at least five unique objects and five textured objects.
- [ ] Lighting includes ambient, diffuse, and specular behavior.
- [ ] Gameplay supports at least two minutes of meaningful interaction.
- [ ] Loading screen is visible for at least 2 seconds and shows accurate progress.
- [ ] A failed asset shows an error message with a working retry button.
- [ ] After loading, a "Click to Start" prompt appears; clicking it locks the pointer and begins gameplay.
- [ ] Loading screen does not reappear on in-game restart or respawn.
- [ ] Screen reader can follow load progress via `aria-live` announcements.

## Risks and Mitigation
- **Collision bugs may block progression.** Build and test collision volumes early, and keep obstacle geometry simple.
- **Third-person camera may clip or disorient.** Add camera distance clamping and obstacle-aware camera offset.
- **Feature creep may threaten delivery.** Complete MVP checklist first, then add stretch features.