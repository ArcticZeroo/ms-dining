# Client (React Frontend) Conventions

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

### Promise Handling

#### Server state — TanStack Query (preferred)

Anything fetched from the API lives in `client/src/store/queries/` as a TanStack Query hook. Query keys are centralized in `client/src/store/queries/keys.ts` as a typed factory:

```ts
// keys.ts
export const queryKeys = {
    groups: {
        list: ['groups', 'list'] as const,
    },
} as const;

// store/queries/groups.ts
export const useGroups = () =>
    useQuery({
        queryKey: queryKeys.groups.list,
        queryFn:  () => GroupClient.retrieveGroupList().then(toGroupMap),
    });
```

Consumers:

```tsx
import { useGroups } from '../../../store/queries/groups.ts';

export const GroupList = () => {
    const { data, isPending, isError, refetch } = useGroups();

    if (isError) {
        return <RetryButton onClick={() => refetch()}/>;
    }
    if (isPending) {
        return <HourglassLoadingSpinner/>;
    }
    return <GroupListWithData groups={Array.from(data.values())}/>;
};
```

Mutations follow the same module convention; they patch affected caches in `onSuccess` via `QUERY_CLIENT.setQueryData`. **Always `await QUERY_CLIENT.cancelQueries({ queryKey })` before `setQueryData`** so an in-flight refetch can't clobber the post-mutation state. See `client/src/store/queries/groups.ts` (`patchQueryData` helper) for the pattern.

Extract pure projection / patch helpers to module scope and unit-test them under `client/test/store/queries/`. The mutation hooks themselves are not unit-tested (would require RTL); the cache patches are.

#### Client state — Zustand (with `zustand-mutative`)

Durable client state — anything not from the server — lives in `client/src/store/zustand/`. Use `zustand-mutative` middleware so actions can write to a draft:

```ts
import { create } from 'zustand';
import { mutative } from 'zustand-mutative';

export const useCartStore = create<ICartStore>()(mutative((set) => ({
    items: new Map(),
    addOrEditItem: (item) => set((state) => {
        // draft mutations — no manual cloning
        let bucket = state.items.get(item.cafeId);
        if (!bucket) {
            bucket = new Map();
            state.items.set(item.cafeId, bucket);
        }
        bucket.set(item.id, item);
    }),
})));
```

**Watch out**: inside a mutative draft callback, array/object entries reached from the draft are proxies. Identity comparisons (`other === item`) against an externally-passed object will fail. Identify entries by id or index, not reference.

### Error Handling in Components
Follow the pattern in `app.tsx` for error boundaries:
- Check for `HttpException` with specific status codes
- Provide specific error messages for server errors (500) vs network errors
- Always include retry buttons

### API Client
API clients are in `src/api/`:
- `DiningClient` - main data retrieval
- Each client method should handle errors and return appropriate types

## CSS Utility Classes

Use the utility classes defined in `index.css` where possible instead of writing `display: flex` in component CSS files. Apply them via `className` in JSX.

| Class | Effect |
|---|---|
| `flex` | `display: flex; align-items: center; gap: var(--default-padding);` (row direction) |
| `flex-col` | `display: flex; flex-direction: column; gap: var(--default-padding);` |
| `flex-center` | `align-items: center; justify-content: center;` |
| `centered-content` | `display: flex; justify-content: center; align-items: center;` |
| `flex-inline` | `display: inline-flex; align-items: center; gap: var(--default-padding);` |
| `flex-wrap` | `flex-wrap: wrap;` |
| `flex-between` | `justify-content: space-between;` |
| `flex-around` | `justify-content: space-around;` |
| `flex-start` | `justify-content: flex-start;` |
| `flex-end` | `justify-content: flex-end;` |
| `flex-justify-center` | `justify-content: center;` |
| `flex-grow` | `flex-grow: 1;` |

Combine them as needed: `className="flex flex-center"`, `className="flex-col flex-wrap"`, etc.

Use `constant-padding` as a modifier: `className="flex constant-padding"` gives `gap: var(--constant-padding)` instead of the default gap.

## CSS Colors

All colors must come from CSS custom properties defined in `index.css`. Never use hardcoded hex colors (like `#3a3a3a`) or raw `rgba()` values for theme-relevant colors.

Common color variables:
- `--color-theme` / `--color-theme-dark` / `--color-theme-light` — primary blue theme
- `--color-background` / `--color-background-raised` / `--color-background-raised-2` / `--color-background-raised-3` — background layers
- `--color-foreground` / `--color-almost-white` — text/foreground colors
- `--color-error` / `--color-error-light` / `--color-error-dark` — error states
- `--color-theme-green` / `--color-theme-green-light` / `--color-theme-green-dark` — green accents
- `--color-theme-purple` / `--color-theme-purple-light` — purple accents
- `--color-button-cta` — call-to-action buttons
- `--color-search-entity-*` — search entity type colors

Use `var(--color-background-hover, #<fallback color>)` is NOT acceptable — if a var doesn't exist, define it in `index.css` or use one that does.

## CSS Measurements

Use CSS custom properties for padding, gap, and border-radius:

- `var(--default-padding)` — **responsive** padding that changes with screen size breakpoints. Use by default for most spacing.
- `var(--constant-padding)` — **fixed** at `0.5rem`. Use for tighter, size-independent spacing.

Never hardcode `rem`/`px` values for standard spacing. These vars ensure consistent spacing that adapts to responsive layouts.
You should almost never be changing the font size from default. Be sure the user knows you're doing this.

Breakpoints that change `--default-padding`:
- Desktop (>1200px): `1rem`
- Tablet (900–1200px): `0.75rem`
- Mobile (<900px): `0.5rem`
- Small mobile (<600px): `0.25rem`

## Mobile Responsiveness

Always consider how components look and behave on mobile.

### In Code
Use the `useDeviceType` hook from `hooks/media-query.ts`:
```tsx
import { DeviceType, useDeviceType } from '../../hooks/media-query.ts';

const deviceType = useDeviceType();
if (deviceType === DeviceType.Mobile) {
    // mobile-specific behavior
}
```
The breakpoint is **800px** (≤800px = mobile).

### In CSS
Use media queries with the same breakpoint:
```css
@media (max-width: 800px) {
    /* mobile styles */
}
```

## Card System

Use the `.card` class and its variants from `index.css` for card-like containers:
- `.card` — standard card with padding, border-radius, background
- `.card.horizontal` — horizontal flex layout
- `.card.blue` / `.card.dark-blue` / `.card.yellow` / `.card.theme` — colored variants
- `.card.error` / `.error-card` — error state cards

## Code Reuse & DRY

**Do not duplicate code.** When adding a feature that parallels an existing one (e.g., station reviews alongside menu item reviews), do NOT create separate methods, components, types, or API endpoints that are nearly identical with only a parameter difference. Instead:

- **Use discriminated unions or a shared type** (like `IReviewLookup`) to represent the variation, then write one implementation that handles both cases.
- **Use helper functions** to derive entity-specific values (paths, IDs, names) from the shared type, rather than branching with `if (isStation) { ... } else { ... }` throughout the codebase.
- **Parameterize, don't duplicate.** If two functions differ only in which map they access or which API path they hit, merge them into one function that derives the difference from its input.
- **Components should be entity-agnostic** wherever possible. A review form, review list, or review summary should not know or care whether it's for a menu item or a station — it should receive a lookup type and operate generically.
- **Stores and API clients** should expose one method per operation (e.g., `createReview`, not `createReview` + `createStationReview`). The entity type should be encoded in the input, not the method name.
- **Search for existing helpers before creating new ones.** Common utilities already exist:
  - `formatPrice()` in `util/cart.ts` — don't create local `formatPrice` functions
  - `normalizeNameForSearch()` — for name normalization
  - `classNames()` — for conditional CSS classes
  - `getEntityKey()` — for cross-cafe entity deduplication
- When writing `.map()`, `.filter()`, or similar callbacks that appear more than once with the same transformation, extract a named helper function.

If you find yourself copying a function/component and changing one word, stop and refactor instead.

## Code Style
- Use descriptive variable names in callbacks: `snapshot => snapshot.price`, not `s => s.price`
- Component and type names should be generic where possible — `PaymentFrame` not `RguestPaymentIframe`, since the implementation detail may change

## Styling Approach

- Avoid inline styles; use CSS classes
- Use the `classNames()` utility for conditional classes:
  ```tsx
  className={classNames('always-applied-class', isActive && 'active', isDark && 'dark')}
  ```
- Component-specific CSS goes in a `.css` file next to the component
- If a flex layout needs custom gap/padding beyond what utility classes provide, still use the utility class and override the specific property in component CSS
