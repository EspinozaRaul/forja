# Exploration: Progression History Bubble

## Executive Summary

The Forja fitness tracker codebase has **strong foundations** for exercise progression visualization but lacks a dedicated multi-metric chart component. The database schema already stores weight, reps, and RIR per set — no schema changes needed. The main gap is: (1) a query that aggregates per-session metrics for a single exercise, and (2) a "bubble" visualization that shows multiple progression metrics over time.

## Current State

### Database Schema (lib/db/schema.ts)
The `sets` table already has all required fields:
- `weight` (real) — weight per set
- `reps` (integer) — reps per set  
- `rir` (integer) — Reps in Reserve (0 = failure, 1 = one rep left, etc.)
- `completed` (boolean) — whether set was completed
- `createdAt` (timestamp) — when set was logged

**No schema migration needed.**

### Existing Queries
- `getExerciseSessions(exerciseId)` — returns session history with volume, set count, completed sets (lib/db/queries.ts:1055-1080)
- `getSetsByExerciseId(exerciseId)` — returns all sets for an exercise with session info (lib/db/queries.ts:763-783)
- `useTotalVolumeByWeek(exerciseId)` — weekly volume aggregation (lib/hooks/useProgress.ts:82-106)
- `useSessionCountByWeek(exerciseId)` — weekly session count (lib/hooks/useProgress.ts:54-80)

### Existing Components
- `ProgressChart` — simple bar chart for single metric (components/ProgressChart.tsx)
- Progress screen has exercise selector with date range filters (4weeks, 12weeks, all)

### Design System
- Dark theme "Acero frío" with steel-blue accent (#4A6FA5)
- Ember accent (#C77B45) for achievements only
- Spanish UI labels, English code

## Affected Areas

- `lib/db/queries.ts` — needs new query for per-exercise progression metrics
- `lib/hooks/useProgress.ts` — needs new hook wrapping the query
- `components/ProgressChart.tsx` — may need extension or new component
- `app/(tabs)/progress.tsx` — will integrate new bubble component
- `lib/types/index.ts` — needs new type for progression data points

## What Data Already Exists vs What's Needed

### Already Available
| Metric | Source | Granularity |
|--------|--------|-------------|
| Weight per set | `sets.weight` | Per set |
| Reps per set | `sets.reps` | Per set |
| RIR per set | `sets.rir` | Per set |
| Session date | `sessions.startedAt` | Per session |
| Volume | `sum(reps * weight)` | Aggregated |

### Needs Aggregation
| Metric | What to Compute | Per Session |
|--------|-----------------|-------------|
| Max weight | `max(weight)` where completed | ✅ |
| Avg weight | `avg(weight)` where completed | ✅ |
| Max reps | `max(reps)` where completed | ✅ |
| Avg reps | `avg(reps)` where completed | ✅ |
| Avg RIR | `avg(rir)` where rir IS NOT NULL | ✅ |
| Total volume | `sum(reps * weight)` where completed | ✅ |

## Approaches

### Approach 1: New Dedicated Query + Custom Chart Component
**Description**: Create `getExerciseProgressionData(exerciseId)` that returns per-session metrics, then build a custom `ProgressionBubble` component using React Native primitives (View, Text, ScrollView) with animated dots/bubbles.

**Pros**:
- Full control over visualization
- Matches "Acero frío" design system perfectly
- No new dependencies
- Can show weight/reps/RIR as layered bubbles

**Cons**:
- More implementation effort
- Need to handle axis labels, tooltips manually
- Limited interactivity (no pinch-zoom, etc.)

**Effort**: Medium

### Approach 2: Use Victory Native or react-native-chart-kit
**Description**: Add a charting library that supports multi-metric line/scatter charts.

**Pros**:
- Rich interactivity (tooltips, animations)
- Less custom code for axes, grids
- Community-maintained

**Cons**:
- New dependency (~200-500KB)
- May not match "Acero frío" aesthetic without customization
- Libraries may not support all needed metrics
- Performance concerns on older devices

**Effort**: Low-Medium

### Approach 3: Hybrid — Custom Bubble with Simple Canvas
**Description**: Use `react-native-svg` for precise bubble rendering while keeping it lightweight.

**Pros**:
- SVG gives precise control for "bubble" aesthetic
- Still lightweight (~50KB)
- Can create truly unique visualization

**Cons**:
- New dependency (react-native-svg)
- SVG rendering can be complex
- Learning curve for SVG paths

**Effort**: Medium

## Recommendation

**Approach 1: New Dedicated Query + Custom Chart Component**

This is the best fit because:
1. The existing ProgressChart already uses React Native primitives — stay consistent
2. "Acero frío" design system is very specific — custom component ensures perfect match
3. No new dependencies keeps bundle size small
4. The bubble concept can be implemented with View components + Reanimated (already in deps)
5. Foundation for "Comparación por rutina" needs to be reusable

## Risks

1. **Data Density**: If user has many sessions, chart may become cluttered — need horizontal scroll or aggregation by week/month
2. **RIR Data Sparsity**: RIR is optional — some sessions may not have it, creating gaps in visualization
3. **Performance**: Calculating per-session metrics for exercises with 100+ sessions could be slow — need indexing or caching
4. **Multi-metric Overlay**: Showing weight/reps/RIR on same chart requires careful visual hierarchy — weight is primary, others are secondary

## Ready for Proposal

**Yes** — The orchestrator should:
1. Proceed to `sdd-propose` to formalize the feature spec
2. Key decisions to make in proposal:
   - Visualization style: bubbles vs line chart vs hybrid
   - Aggregation granularity: per-session vs per-week
   - Which metrics to show by default (weight primary, reps/RIR secondary)
   - Where in progress screen to place the component (below exercise selector)
3. No blocking dependencies or schema changes needed
