This project is called Dining and it is a web app that allows users to view
and search for cafeteria menus at the Redmond campus of Microsoft. The app is
build using React and TypeScript on the frontend, with a Node.js backend running Koa.

The project is made up of three packages:
- Common: maps to the npm `@msdining/common` package. This package contains shared helpers and models used by frontend + backend. Run `npx tsc` in the common folder each time you make changes so that the symlink is updated.
- Client: the react frontend
- Server: the Koa backend, with a Prisma database.

# Code Change Guidance

Always make a checklist with your plan before making changes.

## Mandatory Plan Review

**Every implementation plan must be reviewed by the `plan-critic` agent before any code is written.** This includes:
- New plans for features, refactors, or bug fixes
- Non-trivial updates to existing plans (e.g. changing architecture, adding/removing steps, altering data models, reworking the approach)

Trivial plan edits like fixing a typo or renaming a todo do not require re-review.

To run the review, invoke the plan-critic agent (via `/agent`, referencing it in a prompt, or `--agent=plan-critic`) and provide it with the plan. Address or explicitly acknowledge every issue it raises before proceeding to implementation. Do not skip this step.

If you find important learnings during development, consider documenting them in this file for future reference.

## General Guidance

- Avoid duplicating code wherever possible. If two functions or components differ only in one parameter (e.g., an entity type like "station" vs "menu item"), merge them into a single implementation that takes the variation as an input — typically via a discriminated union type. Do NOT create parallel `fooForMenuItem()` / `fooForStation()` methods. Parameterize, don't duplicate.
- When multiple API endpoints, store methods, or components share the same logic, extract the shared logic into a helper and call it from both places. The goal is zero copy-paste.
- Try to avoid huge multi-purpose functions where possible. Try to move out individual logical parts into helpers so that the big functions are more readable
- No obvious self-evident comments

## General JavaScript Guidance

- No "any"
- No "as" casts unless absolutely necessary
- const to declare functions instead of the function keyword
- { type } instead of { type: type } in objects
- No abbreviated variable or function names. Always use full words:
  - `index` not `idx` (but `i` is acceptable for loop indices)
  - `button` not `btn`
  - `event` not `e` or `evt`
  - `value` not `val`
  - `element` not `el` or `elem`
  - `result` not `res`
  - `error` not `err`
  - `response` not `resp` or `res`
  - `callback` not `cb`
  - `parameter` not `param`

## Project Structure & Dependencies

This is a **Microsoft dining application** built with:
- **Frontend**: React + TypeScript + Vite, Material-UI (@mui/material) for UI components, React Router for routing
- **Backend**: Koa.js + TypeScript + Prisma ORM (SQLite database)
- **Maps**: Leaflet and React-Leaflet for interactive maps
- **Charts**: Chart.js with React-Chart.js-2 for data visualization
- **AI**: OpenAI API integration for search and recommendations
- **Authentication**: Microsoft/Google OAuth via Passport.js
- **Custom libraries**: Uses @arcticzeroo packages for promise hooks, duration handling, and type guards

## TypeScript Patterns

### Nullable Type
Use `Nullable<T> = T | null | undefined` from common/src/models/util.ts for optional values.

### Interface Naming
- All interface names start with `I` (e.g., `IMyComponentProps`, `IClientUserDTO`)
- Server models use `IServer*` prefix (e.g., `IServerUser`, `IServerSearchResult`)
- Client DTOs use `IClient*` prefix

## Build & Development

### Workspace Structure
This is a **monorepo** with workspace dependencies:
- Common package must be built (`npx tsc`) before client/server
- Client build: `npx tsc --project ../common/tsconfig.json && tsc && vite build`
- Server build: `npx tsc --project ../common/tsconfig.json && npx tsc`

### Environment
- Server runs on **port 3002** (Koa backend). If the server is running, you can test API endpoints directly via `http://localhost:3002/api/dining/...`
- Client dev server runs on **port 5173** (Vite) and proxies `/api` and `/static` to the backend
- Use `NODE_ENV=dev` for development mode

When working on this codebase, always consider these patterns and use the established conventions rather than creating new approaches.