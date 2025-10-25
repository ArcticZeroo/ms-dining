This project is called Dining and it is a web app that allows users to view
and search for cafeteria menus at the Redmond campus of Microsoft. The app is
build using React and TypeScript on the frontend, with a Node.js backend running Koa.

The project is made up of three packages:
- Common: maps to the npm `@msdining/common` package. This package contains shared helpers and models used by frontend + backend. Run `npx tsc` in the common folder each time you make changes so that the symlink is updated.
- Client: the react frontend
- Server: the Koa backend, with a Prisma database.

IMPORTANT: Before searching code always query memory. It will save you time. Make sure to ALWAYS ingest any new information you find out into memory as well.

# Code Change Guidance

Always make a checklist with your plan before making changes.

If you find important learnings during development, consider documenting them in this file for future reference.

## General JavaScript Guidance

- No "any"
- No "as" casts unless absolutely necessary
- const to declare functions instead of the function keyword
- { type } instead of { type: type } in objects

# Important Patterns and Context

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

## React Patterns

### Component Structure
Always use this exact pattern:
```tsx
// Note the I in front of the interface name
interface IMyComponentProps {
    prop1: string;
    prop2?: boolean; // optional props with ?
}

// Always define with React.FC as the type for components with types.
export const MyComponent: React.FC<IMyComponentProps> = ({ prop1, prop2 = false }) => {
    // component logic
    return <div />;
};
```

### Styling
- Avoid inline styles, use CSS classes where available
- Use the `classNames()` utility function for conditional classes:
```typescript
className={classNames("base-class", isActive && "active", isDarkMode && "dark")}
```

### Promise Handling
Use `@arcticzeroo/react-promise-hook` for async operations:
```typescript
const responseStatus = useImmediatePromiseState(asyncFunction);
// or
const { value, error, run } = useDelayedPromiseState(asyncFunction);
```

### Error Handling in Components
Follow the pattern in `app.tsx` for error boundaries:
- Check for `HttpException` with specific status codes
- Provide specific error messages for server errors (500) vs network errors
- Always include retry buttons and email contact for persistent issues

## Server Patterns

### Route Organization
- Routes are organized by feature under `/api` prefix
- Use `attachRouter(parent, child)` to mount routers
- Each route module exports a `register*Routes(parent: Router)` function

### Context Helpers
Always use these Koa context helpers from `util/koa.ts`:
- `getTrimmedQueryParam(ctx, key)` for query parameters
- `getMaybeNumberQueryParam(ctx, key)` for numeric query params
- `getUserIdOrThrow(ctx)` for authenticated user ID
- `getUserOrThrowAsync(ctx)` for full user object
- `supportsVersionTag(ctx, tag)` for API versioning

### Database Patterns
- Never use Prisma client directly - always use Storage Clients (e.g., `UserStorageClient`)
- Storage clients are static classes with async methods
- Use `usePrismaClient(callback)` wrapper for database operations (better performance for sqlite)
- Handle unique constraint violations with `isUniqueConstraintFailedError(err)`

### Response Serialization
- Use `jsonStringifyWithoutNull()` for JSON responses to remove null values
- Version responses using `supportsVersionTag()` for backwards compatibility

## API Client Patterns

### Client Organization
API clients are in `client/src/api/`:
- `DiningClient` - main data retrieval
- Each client method should handle errors and return appropriate types

## Build & Development

### Workspace Structure
This is a **monorepo** with workspace dependencies:
- Common package must be built (`npx tsc`) before client/server
- Client build: `npx tsc --project ../common/tsconfig.json && tsc && vite build`
- Server build: `npx tsc --project ../common/tsconfig.json && npx tsc`

### Environment
- Development server runs on port 3002 (Koa backend)
- Client dev server proxies `/api` and `/static` to backend
- Use `NODE_ENV=dev` for development mode

## Authentication & Permissions

### Auth Flow
- OAuth with Microsoft/Google via Passport.js
- Session-based authentication with Koa sessions
- Use `requireAuthenticated` and `requireNotAuthenticated` middleware
- User settings stored in database, synced with client

### Permission Patterns
- Dev endpoints protected with `requireDevKey` middleware
- User context available via `getUserIdOrThrow()` and `getUserOrThrowAsync()`
- Role-based access via user.role field

## Database Schema

### Key Models
- **Cafe**: Main venue with stations and menu items
- **MenuItem**: Food items with modifiers, pricing, reviews
- **Station**: Food service areas within cafes
- **User**: Authentication and preferences storage
- **Daily** models: Time-based data (DailyStation, DailyMenuItem, etc.)

### Important Relationships
- Menu items belong to cafes and can have multiple modifiers
- Daily data is time-scoped and links to base entities
- User preferences stored as delimited strings, deserialized by Storage Clients

When working on this codebase, always consider these patterns and use the established conventions rather than creating new approaches.