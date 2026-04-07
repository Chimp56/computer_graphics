# Repository Guidelines

## Project Structure & Module Organization
This project is a Vite + TypeScript WebGL game prototype using Three.js.

- `src/main.ts`: application entrypoint and boot flow.
- `src/core/`: engine/runtime pieces (`Renderer`, `Scene`, `Clock`, `EventBus`).
- `src/ui/`: UI state and loading experience (`Loader.ts`).
- `src/assets/`: asset declarations and loading (`AssetManifest.ts`).
- `src/style.css`: global styles.
- Root configs: `vite.config.ts`, `tsconfig.json`, `Dockerfile`, `docker-compose.yml`.

Keep new game systems in `src/core/`, UI-specific logic in `src/ui/`, and content/manifest data in `src/assets/`.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: start Vite dev server on port `5173`.
- `npm run check`: run strict TypeScript checks (`tsc --noEmit`).
- `npm run build`: type-check then build production bundle with Vite.
- `npm run preview`: serve the production build locally.
- `docker compose up --build`: run the app in a containerized dev environment.

Run `npm run check` before every commit.

## Coding Style & Naming Conventions
- Language: TypeScript (ES modules, strict mode enabled).
- Indentation: 2 spaces; include trailing commas in multiline literals/calls.
- Strings: prefer double quotes for consistency with existing code.
- Naming: `PascalCase` for classes/types, `camelCase` for functions/variables, descriptive nouns for modules (`Renderer.ts`, `AssetManifest.ts`).
- Keep files focused; avoid mixing rendering, UI, and asset concerns in one module.

## Testing Guidelines
There is currently no dedicated automated test framework configured.

- Minimum gate: `npm run check` must pass.
- For behavior changes, validate manually via `npm run dev` and document what you tested in the PR.
- If adding tests, place them near source modules (for example `src/core/__tests__/Clock.test.ts`) and add an `npm test` script in the same change.

## Commit & Pull Request Guidelines
Recent history uses short, imperative summaries (for example, `Added loader to spec`).

- Commit messages: one concise sentence describing intent.
- PRs should include:
  1. What changed.
  2. Why it changed.
  3. Verification steps/commands run.
  4. Screenshots or short clips for UI/visual changes.