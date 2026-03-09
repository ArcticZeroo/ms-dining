# Server (Koa Backend) Conventions

## Route Organization
- Routes are organized by feature under `/api` prefix
- Use `attachRouter(parent, child)` to mount routers
- Each route module exports a `register*Routes(parent: Router)` function

## Context Helpers
Always use these Koa context helpers from `util/koa.ts`:
- `getTrimmedQueryParam(ctx, key)` for query parameters
- `getMaybeNumberQueryParam(ctx, key)` for numeric query params
- `getUserIdOrThrow(ctx)` for authenticated user ID
- `getUserOrThrowAsync(ctx)` for full user object
- `supportsVersionTag(ctx, tag)` for API versioning

## Database Patterns
- Never use Prisma client directly — always use Storage Clients (e.g., `UserStorageClient`)
- Storage clients are static classes with async methods
- Use `usePrismaClient(callback)` wrapper for database operations (better performance for sqlite)
- Use `usePrismaTransaction(callback)` for multiple related writes that should be atomic
- **Never use `Promise.all()` for concurrent DB operations** — SQLite + Prisma performs worse with parallel queries. The `usePrismaClient` wrapper enforces single-threaded access via a semaphore. For multiple writes, use sequential `await` inside `usePrismaTransaction` instead.
- Handle unique constraint violations with `isUniqueConstraintFailedError(err)`
- Handle missing record errors (P2025) gracefully — e.g., when updating a record that may have been deleted, catch `PrismaClientKnownRequestError` with code `P2025` and skip instead of crashing
- **Keep in-memory caches in sync with DB writes** — when a storage client maintains an in-memory cache (e.g., maps, sets), any method that writes to the DB must also update the in-memory state. Don't rely on reboots to resync.

## Prisma CLI
- The Prisma schema uses multi-file schema in `prisma/` with `prisma.config.ts` for path configuration
- **Never pass `--schema prisma/schema`** to Prisma CLI commands — this causes migrations to be created in the wrong directory. The `prisma.config.ts` file handles schema discovery automatically.
- Run `npx prisma generate` (no flags) to regenerate the client
- Run `npx prisma generate --sql` to regenerate typed SQL queries
- Run `npx prisma migrate dev --name <name>` to create migrations

## Response Serialization
- Use `jsonStringifyWithoutNull()` for JSON responses to remove null values
- Version responses using `supportsVersionTag()` for backwards compatibility

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

## API Design Patterns
- **Additive-only changes** — browser JS caches may serve stale frontend code. Never break existing endpoints; add new ones or add optional fields.

## Code Style
- Use descriptive variable names in callbacks: `snapshot => snapshot.price`, not `s => s.price`
- Before creating a utility function, search the codebase for existing helpers (e.g., `formatPrice` in `util/cart.ts`, `normalizeNameForSearch`, etc.)
- Component and type names should be generic where possible — `PaymentIframe` not `RguestPaymentIframe`, since the implementation detail (rguest) may change