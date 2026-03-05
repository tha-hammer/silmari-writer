# Plan Review Report: intro.js Walkthrough Tours

## Review Summary

| Category | Status | Issues Found |
|----------|--------|--------------|
| Contracts | ❌ | 3 critical — intro.js v8 API mismatch |
| Interfaces | ⚠️ | 2 warnings — type import doesn't exist, test syntax error |
| Promises | ⚠️ | 1 warning — `start()` is async in v8 |
| Data Models | ✅ | 0 issues |
| APIs | ❌ | 2 critical — DOM targets behind conditional gates |

---

### Contract Review

#### Well-Defined:
- ✅ `walkthrough-persistence.ts` — Clean contract, matches existing `image-streaming.ts` localStorage pattern
- ✅ `WalkthroughStep` interface — `element`, `intro`, `position` fields correctly typed
- ✅ Tour provider components — Clean separation, auto-start + manual replay contract is clear

#### Critical — intro.js v8 API Breaking Changes:

The plan was written against **intro.js v7** API. The current version is **v8.3.2** (July 2025) with breaking changes:

- ❌ **`introJs()` is deprecated** — v8 uses `introJs.tour()` instead. Calling `introJs()` returns a `LegacyIntroJs` with a deprecation warning.
  - Plan code (`useWalkthrough.ts:438`): `const intro = introJs()`
  - Should be: `const tour = introJs.tour()`

- ❌ **`oncomplete()` / `onexit()` are legacy lowercase names** — v8 `Tour` class uses **camelCase**: `onComplete()` / `onExit()`
  - Plan code (`useWalkthrough.ts:449`): `intro.oncomplete(() => { ... })`
  - Plan code (`useWalkthrough.ts:454`): `intro.onexit(() => { ... })`
  - Should be: `tour.onComplete(...)` / `tour.onExit(...)`

- ❌ **`import type { IntroJs } from 'intro.js'` does not exist** — v8 ships its own types but does NOT export a named `IntroJs` type
  - Plan code (`useWalkthrough.ts:418`): `import type { IntroJs } from 'intro.js'`
  - Should use: `type TourInstance = ReturnType<typeof introJs.tour>` or just `let` with inference

#### Recommendations:
```diff
- import introJs from 'intro.js'
- import type { IntroJs } from 'intro.js'
+ import introJs from 'intro.js'

- const introRef = useRef<IntroJs | null>(null)
+ const tourRef = useRef<ReturnType<typeof introJs.tour> | null>(null)

- const intro = introJs()
+ const tour = introJs.tour()

- intro.oncomplete(() => { ... })
- intro.onexit(() => { ... })
+ tour.onComplete(() => { ... })
+ tour.onExit(() => { ... })
```

---

### Interface Review

#### Well-Defined:
- ✅ `useWalkthrough` return type `{ startTour, isCompleted, resetTour }` — clear, minimal
- ✅ Persistence functions `isTourCompleted / setTourCompleted / resetTourCompleted` — clean public API
- ✅ Tour provider components render a `<Button>` with `aria-label="Take the tour"` — testable

#### Warnings:

- ⚠️ **Test syntax error in `WriterTour.test.tsx:532-534`** — uses `await import(...)` inside a non-async `it()` callback:
  ```typescript
  it('does not auto-start when already completed', () => {  // ← not async
    const { useWalkthrough } = await import('@/hooks/useWalkthrough')  // ← await outside async
  ```
  Fix: Make the callback `async` or restructure the mock override using `vi.mocked()` before render instead of dynamic import.

- ⚠️ **intro.js mock structure doesn't match v8 API** — The mock in `useWalkthrough.test.ts:349-357` mocks the default export as a function returning `{ setOptions, start, onexit, oncomplete, exit }`. In v8, the default export is an object with a `.tour()` method that returns those. The mock needs restructuring:
  ```typescript
  vi.mock('intro.js', () => ({
    default: {
      tour: vi.fn(() => ({
        setOptions: mockSetOptions,
        start: mockStart,
        onComplete: mockOnComplete,
        onExit: mockOnExit,
        exit: mockExit,
      })),
    },
  }))
  ```

---

### Promise Review

#### Well-Defined:
- ✅ `useEffect` cleanup calls `introRef.current?.exit(true)` — resource cleanup specified
- ✅ Timer cleanup via `clearTimeout` in tour providers — no leaked timers

#### Warning:

- ⚠️ **`start()` and `exit()` are async in v8** — They return `Promise<Tour>`. The plan calls them synchronously (`intro.start()`, `introRef.current?.exit(true)`). While this works (promises are fire-and-forget here), the cleanup function in `useEffect` should handle the async nature:
  ```typescript
  // Current (works but may log unhandled rejection on fast unmount):
  introRef.current?.exit(true)

  // Safer:
  introRef.current?.exit(true).catch(() => {})
  ```

---

### Data Model Review

#### Well-Defined:
- ✅ `WalkthroughStep` interface — `element: string`, `intro: string`, `position?: string` matches intro.js `TourStep`
- ✅ localStorage schema — simple `walkthrough_<key>` → `"true"` string, no serialization needed
- ✅ Step configs are static arrays — no runtime construction, no data fetching

**Note on `position` values:** The plan uses `position?: 'top' | 'bottom' | 'left' | 'right'`. intro.js v8 also supports `'auto'`, `'floating'`, `'top-left-aligned'`, `'top-middle-aligned'`, `'top-right-aligned'`, and equivalent bottom variants. The subset used is fine but the type could be narrower than reality.

---

### API Review — DOM Target Availability

#### Critical — Home page tour targets behind `activeProjectId` gate:

- ❌ **All 4 home tour targets are inside `{activeProjectId ? (...) : fallback}`** (`page.tsx:222`). On first load, `activeProjectId` starts as `null` until:
  1. `_hasHydrated` becomes true (async rehydration from localStorage)
  2. `createProject('My First Project')` fires (if `projects.length === 0`)
  3. The new project's ID is set as `activeProjectId`

  During this window (potentially 1-2 render cycles), none of the tour targets exist in the DOM. The 500ms `setTimeout` in `HomeTourProvider` may fire before `activeProjectId` is set, causing intro.js to skip/fail on missing elements.

  **Recommendation:** The home tour auto-start should wait for `activeProjectId` to be truthy, not just a fixed 500ms delay. Pass `activeProjectId` as a dependency or check it before starting:
  ```typescript
  // In page.tsx, pass a "ready" prop:
  <HomeTourProvider ready={!!activeProjectId} />

  // In HomeTourProvider:
  useEffect(() => {
    if (!isCompleted && ready) {
      const timer = setTimeout(startTour, 300)
      return () => clearTimeout(timer)
    }
  }, [isCompleted, ready, startTour])
  ```

#### Warning — Writer page tour targets behind `RequireAuth`:

- ⚠️ **Writer tour targets are inside `<RequireAuth>`** (`StartVoiceSessionModule.tsx:163`). If the user is unauthenticated, `RequireAuth` may not render children, and the `data-testid` selectors won't be in the DOM. The tour provider mounts at the page level (outside `RequireAuth`), so it could fire `startTour()` before auth resolves.

  **Recommendation:** Mount `WriterTourProvider` inside `StartVoiceSessionModule` (after `RequireAuth` renders its children), or pass a `ready` prop gated on auth state.

---

### License Consideration

- ⚠️ **intro.js is AGPL-3.0** — This is a strong copyleft license. If Silmari Writer is proprietary/closed-source SaaS, using intro.js requires either:
  - Making the entire application source available under AGPL-3.0, OR
  - Purchasing a commercial license from introjs.com

  This is a business decision, not a code issue, but should be acknowledged before implementation.

---

### Critical Issues (Must Address Before Implementation)

1. **intro.js v8 API mismatch**: The entire hook implementation uses deprecated v7 method names. `oncomplete`→`onComplete`, `onexit`→`onExit`, `introJs()`→`introJs.tour()`, `IntroJs` type doesn't exist. All test mocks are structured for v7.
   - **Impact**: Code won't work correctly with current intro.js. Deprecation warnings in console at minimum, potential runtime errors.
   - **Recommendation**: Rewrite Behavior 3 (hook) and all test mocks for v8 API.

2. **Home tour targets not in DOM on first render**: All 4 selectors are behind `activeProjectId` conditional. The 500ms delay is a race condition, not a guarantee.
   - **Impact**: Tour silently skips steps or shows floating tooltips with no highlighted element.
   - **Recommendation**: Add a `ready` prop gated on `activeProjectId` being truthy.

3. **Test syntax error**: `WriterTour.test.tsx` line 534 uses `await` in a non-async callback.
   - **Impact**: Test file won't compile.
   - **Recommendation**: Make callback async or restructure mock.

### Suggested Plan Amendments

```diff
# Behavior 3: useWalkthrough Hook

## Implementation
- import introJs from 'intro.js'
- import type { IntroJs } from 'intro.js'
+ import introJs from 'intro.js'

- const introRef = useRef<IntroJs | null>(null)
+ const tourRef = useRef<ReturnType<typeof introJs.tour> | null>(null)

- const intro = introJs()
- introRef.current = intro
- intro.setOptions({ steps, ... })
- intro.oncomplete(() => { ... })
- intro.onexit(() => { ... })
- intro.start()
+ const tour = introJs.tour()
+ tourRef.current = tour
+ tour.setOptions({ steps, ... })
+ tour.onComplete(() => { ... })
+ tour.onExit(() => { ... })
+ tour.start()

## Cleanup
- introRef.current?.exit(true)
+ tourRef.current?.exit(true).catch(() => {})

# Behavior 4 & 5: Tour Providers

## HomeTourProvider
- export function HomeTourProvider() {
+ export function HomeTourProvider({ ready = true }: { ready?: boolean }) {

  useEffect(() => {
-   if (!isCompleted) {
+   if (!isCompleted && ready) {
      const timer = setTimeout(startTour, 300)
      return () => clearTimeout(timer)
    }
- }, [isCompleted, startTour])
+ }, [isCompleted, ready, startTour])

## page.tsx integration
- <HomeTourProvider />
+ <HomeTourProvider ready={!!activeProjectId} />

# Test mocks (all test files using intro.js)

- vi.mock('intro.js', () => ({
-   default: vi.fn(() => ({
-     setOptions: mockSetOptions,
-     start: mockStart,
-     onexit: mockOnExit,
-     oncomplete: mockOnComplete,
-     exit: mockExit,
-   })),
- }))
+ vi.mock('intro.js', () => ({
+   default: {
+     tour: vi.fn(() => ({
+       setOptions: mockSetOptions,
+       start: mockStart,
+       onComplete: mockOnComplete,
+       onExit: mockOnExit,
+       exit: mockExit,
+     })),
+   },
+ }))

# WriterTour.test.tsx — fix syntax error

- it('does not auto-start when already completed', () => {
-   const { useWalkthrough } = await import('@/hooks/useWalkthrough')
+ it('does not auto-start when already completed', async () => {
+   const { useWalkthrough } = vi.mocked(await import('@/hooks/useWalkthrough'))
```

### Approval Status

- [ ] **Ready for Implementation** - No critical issues
- [ ] **Needs Minor Revision** - Address warnings before proceeding
- [x] **Needs Major Revision** - 3 critical issues must be resolved first:
  1. Rewrite hook + tests for intro.js v8 API
  2. Add `ready` prop to HomeTourProvider gated on `activeProjectId`
  3. Fix test syntax error in WriterTour.test.tsx
