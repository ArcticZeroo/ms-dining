---
name: reduce-component-complexity
description: Refactor a React component that violates the msdining/no-overloaded-component lint rule (or is otherwise "doing too many things"). Use when that rule errors, or when asked to decompose/simplify a bloated client component.
---

# Reducing Component Complexity

The `msdining/no-overloaded-component` rule (client/eslint-plugin-msdining) scores a component's
render complexity as **raw host elements (`<div>`/`<span>`/…) + conditionally-rendered branches**,
and errors above `maxJsxElements` (currently 12). Clean, flat composition of child *components* is
cheap; raw markup and `{cond && …}` / ternary / `.map()` branching is what accrues cost.

## Mindset

The threshold is a **signal that the component is doing too many things**, not a number to game.
**Do not do the bare minimum to get under the limit** (e.g. arbitrarily moving half the JSX into one
child). Refactor for genuine readability. If a component is only trivially over, a small targeted
split is fine; if it's badly over, it usually needs real decomposition plus logic extraction.

While you're in there, actively look for:
- **Cohesive sections** that don't need to live next to each other — extract each into its own component.
- **A "mountain of hooks"** at the top (many `useValueNotifier`/`useContext`/`useMemo`) — a smell that
  logic belongs in child sections or a hook.
- **Abstractions/simplifications** — fold a single-use derived value into the one memo that uses it;
  drop a pass-through wrapper that just forwards a pile of props.
- **Helpers to add** and **duplication to remove** — if several `.map()`/branches share a
  transformation or near-identical markup, extract ONE shared component/helper and reuse it.

## The pattern (composition root)

Turn the parent into a thin **composition root** that mostly wires children together; push logic and
detail into cohesive pieces. Reference example:
`client/src/components/cafes/station/menu-items/menu-item.tsx` (root) with its siblings
`menu-item-card.tsx` (a shell that renders `{children}`), `menu-item-header.tsx`,
`menu-item-image-section.tsx` (self-gating), `menu-item-price.tsx`, `menu-item-stats.tsx`, and the
extracted hook `client/src/hooks/menu-item.ts` (`useMenuItemHighlightTag`).

1. **Thin composition root.** The parent renders a shell + a short list of child sections.
2. **Self-serving children.** A child section reads its OWN settings/context
   (`useValueNotifier(...)`, `useContext(...)`) and self-gates (returns `null` when hidden) rather
   than receiving a pile of props. Pass props only for genuinely per-instance data. This is what
   dissolves the parent's hook mountain and avoids prop-drilling.
3. **Extract non-render logic into hooks.** Move memoized derivations, handlers, mutations, and view-
   model computation into a hook (e.g. `useThingCard`, `useThingSelection`). For a large form/table
   with lots of derived state, a single hook returning a view-model object that sections destructure
   works well.
4. **Extract a "shell" component** for the clickable/container wrapper (owns onClick/modal/title/etc.)
   that renders `{children}`, when the root's outer element carries behavior.
5. **De-duplicate.** Repeated member/row/chip markup across branches → one shared component reused
   with a prop for the difference (e.g. a `className`), not copy-paste.

## Guardrails (avoid over-fragmentation)

The reviewer will push back on these:
- **No React Context for shallow trees** (~1-2 levels) — thread explicit props instead. Context +
  throw-if-missing guards for a small card is harder to read than the original.
- **No file for a single-element `.map()` body or a trivial one-liner** — keep simple map bodies
  (≤3 JSX elements) inline UNLESS extracting removes real duplication. (`msdining/no-complex-inline-map`
  independently forces extraction only above 3 elements.)
- **Aim for the minimum number of cohesive files** that genuinely improves readability, not the maximum.

## Conventions (all lint-enforced — see client/AGENTS.md)

- `export const X: React.FC<IXProps> = ({ ... }) => { ... }` with a named `IXProps` interface above;
  prop-less components may omit the annotation (`export const X = () => (...)`).
- One component per file (`react/no-multi-comp`). No `function` components, no inline/anonymous prop
  types, no IIFEs. 4-space indent, single quotes, semicolons.
- Reuse existing CSS classes and helpers (`formatPrice`, `classNames`, `normalizeNameForSearch`, …);
  never hardcode colors/spacing. Match the surrounding import-path extension style (`.ts`/`.tsx`/`.js`).

## It is a PURE REFACTOR

Preserve exact runtime behavior: identical DOM structure, CSS classes, text, and logic (every
conditional, key, handler, and memo). If you spot a real preexisting bug, call it out separately —
don't silently change behavior inside the refactor.

## Verify (from `client/`)

1. `npx eslint <every file you created or modified>` — zero problems, including
   `msdining/no-overloaded-component` (score ≤ 12), `react/no-multi-comp`,
   `msdining/functional-component-style`.
2. `npx tsc --noEmit` — no error lines referencing files you touched (ignore unrelated preexisting
   errors from concurrent work).
