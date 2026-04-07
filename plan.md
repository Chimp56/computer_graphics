Build Plan: Island Obstacle Speedrun

     Context

     The project is completely greenfield — spec.md and plan.md exist but there is zero source code, no configs, and no dependencies. The goal is a 3D   
     browser-based obstacle-course speedrun game for a computer graphics course, built with Three.js + TypeScript + Vite, containerized with Docker, and 
     deployed to Vercel.

     This plan resolves five key design decisions upfront, then lays out 10 phases with exact files, implementation notes, and verification steps.       

     ---
     Design Decisions

     1. Terrain — Heightmap displacement

     Use a THREE.PlaneGeometry(200, 200, 127, 127) with vertices displaced by a hand-painted 128x128 grayscale PNG. The same heightmap doubles as the    
     collision heightfield — sample at player XZ via bilinear interpolation for O(1) ground checks. No raycasting needed for terrain.

     2. Collision — Heightmap lookup + AABB

     Two layers: heightmap lookup for terrain ground, AABB intersection tests for obstacles/walls/gates. Resolve penetrations via minimum translation    
     vector, up to 3 iterations per frame. No physics engine.

     3. Event dispatch — Typed EventBus

     A ~25-line generic EventBus<T> class in src/core/EventBus.ts. A single GameEvents type map defines all events (leverFlipped, buttonPressed,
     targetHit, respawn, runStarted, runWon). Decouples interactions from world effects.

     4. Basketball throw — Real projectile physics

     position += velocity * dt, velocity.y -= GRAVITY * dt. Charge time (capped 2s) scales initial speed. Camera pitch controls arc angle. Hit detection 
     via AABB test against target each frame.

     5. Physics timing — Fixed timestep (1/60s) with accumulator

     Prevents tunneling and frame-rate-dependent jump heights. Accumulator clamps at 0.1s to avoid spiral of death. Render runs once per rAF after       
     physics ticks.

     ---
     Phase 1 — Scaffold & Loading Screen

     Goal: Runnable app in Docker showing animated loader → blank Three.js scene on click.

     Files to create:
     Dockerfile                     Node LTS Alpine, npm ci, expose 5173, CMD npm run dev -- --host 0.0.0.0
     docker-compose.yml             Volume-mount source, anonymous volume for node_modules, port 5173:5173
     .dockerignore                  node_modules, dist, .git
     package.json                   three, typescript, vite, @types/three
     tsconfig.json                  strict, ES2022, bundler resolution
     vite.config.ts                 server.host: '0.0.0.0'
     index.html                     #app div, #loader-overlay with canvas/progress/error/start/aria-live
     src/style.css                  Loader overlay styles, .hidden, .sr-only, progress bar
     src/main.ts                    Bootstrap: Loader → AssetManifest.loadAll() → showReady → onClick hide + start render loop
     src/core/Renderer.ts           WebGLRenderer, append to #app, resize handler
     src/core/Scene.ts              Scene + AmbientLight(0.3) + sky-blue background + fog
     src/core/Clock.ts              Fixed-timestep accumulator wrapping THREE.Clock
     src/core/EventBus.ts           Generic typed event emitter + GameEvents type map
     src/ui/Loader.ts               2D canvas island animation, setProgress, showError+retry, 1.5s min → showReady → click-to-start + pointer lock,      
     aria-live
     src/assets/AssetManifest.ts    Shared THREE.LoadingManager, loadAll() → Promise, onProgress/onError hooks

     Loader spec details:
     - Canvas draws animated island scene using Canvas 2D API (no Three.js) — ocean gradient, ripple rings, sandy oval, swaying palm tree, sun glow, wave
      crests
     - setProgress(0-1) updates bar + aria-live (throttled to every 10%)
     - showError(msg) hides progress, shows error text + Retry button
     - After load + 1.5s minimum elapsed → showReady() shows "Click to Start"
     - Click → requestPointerLock() → fade overlay → start render loop
     - onRetry(cb) resets UI and re-attempts load

     Verify:
     - docker compose up --build → localhost:5173 shows animated loader
     - Progress reaches 100%, waits 1.5s, "Click to Start" appears
     - Click fades to sky-blue Three.js canvas
     - Screen reader announces progress updates
     - docker compose run app npm run build produces clean output

     ---
     Phase 2 — World: Island, Water, Sky, Lighting

     Goal: Visible island terrain with Phong lighting and water.

     Files to create:
     src/world/Island.ts            PlaneGeometry + heightmap displacement + getHeightAt(x,z), MeshPhongMaterial with sand texture
     src/world/Water.ts             Flat plane at y=0.5, translucent blue MeshPhongMaterial, shininess=100 for specular glints
     src/world/Sky.ts               HemisphereLight(sky,ground,0.6) + DirectionalLight(0.8) positioned as sun
     public/textures/heightmap.png  128x128 grayscale island shape
     public/textures/sand.jpg       Tiled sand texture for terrain
     public/textures/grass.jpg      Grass for higher elevations (optional blend)
     public/textures/water.jpg      Water surface texture

     Key: Island.getHeightAt(x, z) does bilinear interpolation of the heightfield — this is the collision ground for Phase 4. Register all textures in   
     AssetManifest so they load through the manager.

     Verify:
     - Textured island terrain visible, elevated in center
     - Water plane around island with specular highlights
     - Directional light creates visible diffuse shading
     - Loader progress reflects actual texture load count

     ---
     Phase 3 — Player Controller & Camera

     Goal: Walk around the island, jump, toggle FP/TP camera.

     Files to create:
     src/player/InputManager.ts     Key/mouse state, poll(), edge-detected jump/interact/cameraToggle/mouseRelease
     src/player/PlayerController.ts Position, velocity, yaw, pitch; MOVE_SPEED=8, JUMP_IMPULSE=10, GRAVITY=25; update(dt, input, heightfield)
     src/player/CameraRig.ts        FP mode: camera at head. TP mode: offset behind+above with lerp follow + collision raycast. V toggles.

     Key: Movement direction derived from input.getMovement() rotated by yaw. Ground check: if position.y < heightfield(x,z) + PLAYER_HEIGHT/2 → snap +  
     zero vertical velocity + grounded=true. CameraRig.toggle() does not affect RunContext.

     Verify:
     - WASD moves on terrain, follows slopes
     - Space jumps, lands back
     - Mouse rotates view
     - V toggles FP↔TP
     - No falling through terrain

     ---
     Phase 4 — Collision & Respawn

     Goal: AABB collision with world objects. Water/OOB triggers respawn.

     Files to create:
     src/core/CollisionSystem.ts    Register/unregister AABBs, resolve(player) with MTV pushback, 3 iterations
     src/world/TriggerVolumes.ts    Start zone, finish zone (Box3), water (Y threshold), OOB (world bounds). Edge-detected enter events.

     Key: Water and OOB both emit the same respawn event (single code path per spec). Trigger checks run after collision resolution (step 4 in update    
     order). Check water/OOB before win to prevent race. Include debug wireframe rendering toggle (F3) for collision boxes.

     Verify:
     - Player cannot walk through walls
     - Water → teleport to start
     - OOB → teleport to start
     - No vibration or getting stuck
     - Respawn is instant, no camera jerk

     ---
     Phase 5 — Game State & Timer (parallelizable with 6, 7)

     Files to create:
     src/game/RunContext.ts          elapsedTime, checkpoint, interactionFlags map, reset(), setCompleted(), allRequired()
     src/game/GameStateManager.ts    States: idle→running→won→respawning. Timer ticks in running. restart() resets without re-triggering loader.

     Place finish bell mesh (cone+cylinder primitives, brass material). On runWon, animate wobble.

     Verify: Idle=no timer, enter start zone=timer starts, water=timer resets, reach bell=timer freezes.

     ---
     Phase 6 — Moving Obstacles (parallelizable with 5, 7)

     Files to create:
     src/world/Obstacles.ts         ObstacleManager + Spinner: horizontal beam rotating on Y axis, recalculated AABB per frame
     public/textures/metal.jpg      Metal texture for obstacles

     Spinner: BoxGeometry beam + CylinderGeometry post, rotates at π/2 rad/s. On player collision: pushback impulse (15 units/s). Consider adding        
     rising/falling platform or swinging pendulum for route variety.

     Verify: Spinner rotates, pushes player on contact, timing window exists to pass.

     ---
     Phase 7 — Interactions (parallelizable with 5, 6)

     Files to create:
     src/interactions/Interactable.ts       Interface: canInteract, interact, getPrompt, update?
     src/interactions/InteractionSystem.ts  Find nearest in range, show prompt, handle E press, call update on all
     src/interactions/Lever.ts              Flip animation, emit leverFlipped → gate opens (remove collider)
     src/interactions/Button.ts             Depress animation, emit buttonPressed → platform extends (add collider)
     src/interactions/Basketball.ts         States: onGround→held→flying. Charge (hold LMB, 0-2s), throw (release), projectile physics, AABB hit vs      
     target, emit targetHit → final path opens. Missed ball resets.
     public/textures/wood.jpg              Wood texture for lever/button
     public/textures/basketball.jpg        Orange rubber texture

     Level layout: Lever early (opens gate) → Button mid (extends platform) → Basketball late (opens path to bell). All three gate progression.

     Verify: E prompts appear/disappear, lever flips+gate opens, button presses+platform extends, basketball pickup→charge→arc→hit→path opens. All three 
     required to reach bell.

     ---
     Phase 8 — HUD & UI

     Files to create:
     src/ui/HUD.ts        Timer (MM:SS.ms, top center), interaction prompt (bottom center), camera mode (top right). Pre-created DOM, toggle visibility. 
     src/ui/WinPanel.ts   "You Win!" + final time + Restart button. Restart calls GameStateManager.restart(), no loader re-trigger.

     Add HUD/win-panel container divs to index.html. UI reads state, never writes.

     Verify: Timer shows during running, prompts near interactables, camera mode updates on V, win panel shows final time, restart works.

     ---
     Phase 9 — Textures, Lighting, Level Tuning

     Goal: Meet rubric thresholds (5 textured objects, 5 unique objects, Phong specular visible) and tune run to ~2 minutes.

     Add decorative objects if needed (palm trees, rocks, crates with bark/stone/wood textures). Verify shininess values (water=100+, metal=60, wood=10).
      Walk the course, time it, adjust distances and obstacle speeds.

     Verify: 5+ textured objects, 5+ unique objects, specular visible, ~2-minute timed run.

     ---
     Phase 10 — Validation & Deploy

     Walk every acceptance criterion in spec.md. Write README (controls, local run, Docker run, rubric mapping, deployed URL). docker compose run app npm
      run build clean. Connect repo to Vercel, verify deployed build is playable with preview deploys on PRs.

     Verify: All 14 checklist items checked, README complete, Vercel live.

     ---
     Dependency Graph

     Phase 1 (scaffold + loader)
       └→ Phase 2 (world)
            └→ Phase 3 (player + camera)
                 └→ Phase 4 (collision + respawn)
                      ├→ Phase 5 (game state + timer)  ─┐
                      ├→ Phase 6 (obstacles)            ├─ parallel
                      └→ Phase 7 (interactions)         ─┘
                           └→ Phase 8 (HUD + UI)
                                └→ Phase 9 (polish + tuning)
                                     └→ Phase 10 (validate + deploy)

     Solo recommended order: 1 → 2 → 3 → 4 → 5 → 7 → 6 → 8 → 9 → 10
     (Game state before interactions so you can test end-to-end; interactions before obstacles because basketball is higher risk.)

     Risk Summary

     ┌───────────┬────────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
     │   Phase   │  Risk  │                                                           Concern                                                           │
     ├───────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ 4         │ High   │ Collision bugs block all gameplay. Mitigate: debug wireframes, simple shapes, extensive edge testing.                       │
     ├───────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ 7         │ High   │ Basketball charge→throw→arc→hit is the most complex single feature. Mitigate: build pickup first, add throw second, add hit │
     │           │        │  detection last.                                                                                                            │
     ├───────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ 3         │ Medium │ Movement feel is subjective, camera toggle edge cases.                                                                      │
     ├───────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ 6         │ Medium │ Moving colliders need per-frame AABB recalculation.                                                                         │
     ├───────────┼────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
     │ All       │ Low    │ Straightforward implementation.                                                                                             │
     │ others    │        │                                                                                                                             │
     └───────────┴────────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
---

Phase 1 Amendment (2026-03-31) — Full-Screen Tropical Start UX

This amendment updates Phase 1 behavior and visuals:

- Start interaction: replace "Click to Start" button requirement with "Click anywhere to Start" on the loader overlay.
- Immersive entry: first start click should attempt `requestPointerLock()` and `requestFullscreen()` before gameplay begins (best effort, continue if denied).
- Loader art direction: change to a side-view tropical composition with a visibly rising sun and multiple palm trees.
- Files affected in implementation: `src/main.ts`, `src/ui/Loader.ts`, `src/style.css`, and `index.html`.

Phase 1 verification additions:
- Ready prompt reads "Click anywhere to Start".
- Clicking anywhere on the loader starts gameplay.
- Browser enters fullscreen when permitted and pointer lock is requested on start.
- Loader scene clearly shows a tropical side-view island with sunrise motion and several trees.
