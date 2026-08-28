# Tasks: i18n ES/EN Bilingual Support

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1700–2200 (incl. ~800 lines of JSON translation files) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 → PR 5 → PR 6 |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | i18n infrastructure + settings toggle | PR 1 | `npx tsc --noEmit` | Toggle language in Settings → verify i18n.language changes | lib/i18n/*, settings.ts, _layout.tsx, settings.tsx |
| 2 | Auth screens + Home + Tab layout | PR 2 | `npx tsc --noEmit` | Navigate login/signup/home → verify translated text | app/auth/*, app/(tabs)/_layout.tsx, app/(tabs)/index.tsx |
| 3 | Routines (all 4 screens) | PR 3 | `npx tsc --noEmit` | Navigate routines/create/folder → verify translated text | app/(tabs)/routines.tsx, app/routine/* |
| 4 | Progress screen | PR 4 | `npx tsc --noEmit` | Navigate progress → verify all 50+ strings, day/month names | app/(tabs)/progress.tsx |
| 5 | Session screens (the beast) | PR 5 | `npx tsc --noEmit` | Start session → complete flow → verify all 80+ strings | app/session/* |
| 6 | Components + Exercise resolver + Final check | PR 6 | `npx tsc --noEmit && grep -r "Confirmar\|Cancelar" --include="*.tsx" components/` | Exercise name toggle, ConfirmDialog defaults, full grep sweep | components/*, lib/i18n/exercise-names.ts |

## Phase 1: Infrastructure (PR 1)

- [ ] 1.1 Install packages: `npx expo install i18next react-i18next expo-localization`
- [ ] 1.2 Create `lib/i18n/index.ts` — i18next config: ES default, EN fallback, `expo-localization` detection, AsyncStorage persistence via `getSettings()`/`setSettings()`
- [ ] 1.3 Create `lib/i18n/es.json` — skeleton with `auth.login.*` and `settings.*` keys only (~25 keys)
- [ ] 1.4 Create `lib/i18n/en.json` — skeleton with `auth.login.*` and `settings.*` keys only (~25 keys)
- [ ] 1.5 Add `language: 'es' | 'en'` to `AppSettings` interface and `DEFAULT_SETTINGS` in `lib/utils/settings.ts`
- [ ] 1.6 Wrap app tree in `I18nextProvider` in `app/_layout.tsx` — import i18n config, add provider inside `QueryClientProvider`
- [ ] 1.7 Add language SegmentedControl to `app/settings.tsx` — "General" section, two options: Español / English, calls `i18n.changeLanguage()` + `update({ language })`
- [ ] 1.8 Verify: `npx tsc --noEmit` passes; toggle language in Settings → app text changes immediately

## Phase 2: Auth Screens (PR 2)

- [ ] 2.1 Extract strings from `app/auth/login.tsx` — identify all ~8 hardcoded strings (title, subtitle, placeholders, button, errors)
- [ ] 2.2 Replace strings in `app/auth/login.tsx` with `t()` calls — add `useTranslation()` hook, replace each hardcoded string
- [ ] 2.3 Extract strings from `app/auth/signup.tsx` — identify all ~10 hardcoded strings (title, subtitle, placeholders, button, validation, toggle)
- [ ] 2.4 Replace strings in `app/auth/signup.tsx` with `t()` calls
- [ ] 2.5 Add auth keys to `lib/i18n/es.json` and `lib/i18n/en.json` — all auth.login.* and auth.signup.* keys
- [ ] 2.6 Extract strings from `app/(tabs)/_layout.tsx` — tab titles: "Home", "Routines", "Progress"
- [ ] 2.7 Replace tab titles with `t('tabs.home')` etc. in `_layout.tsx`
- [ ] 2.8 Extract strings from `app/(tabs)/index.tsx` — identify ~25 strings (Stats, Workouts, Streak, session labels, loading messages, error messages)
- [ ] 2.9 Replace strings in `app/(tabs)/index.tsx` with `t()` calls — add `useTranslation()`
- [ ] 2.10 Add home + tabs keys to `lib/i18n/es.json` and `lib/i18n/en.json`
- [ ] 2.11 Verify: navigate login → signup → home; switch language; all text updates

## Phase 3: Routines (PR 3)

- [ ] 3.1 Extract strings from `app/(tabs)/routines.tsx` — identify ~30 strings (headers, buttons, folder modal, move-to-folder)
- [ ] 3.2 Replace strings in `app/(tabs)/routines.tsx` with `t()` calls
- [ ] 3.3 Extract strings from `app/routine/[id].tsx` — identify ~20 strings (edit, delete, save, exercise list, start session options)
- [ ] 3.4 Replace strings in `app/routine/[id].tsx` with `t()` calls
- [ ] 3.5 Extract strings from `app/routine/create.tsx` — identify ~15 strings (form labels, validation, button)
- [ ] 3.6 Replace strings in `app/routine/create.tsx` with `t()` calls
- [ ] 3.7 Extract strings from `app/routine/folder/[id].tsx` — identify ~15 strings (empty state, edit modal, delete)
- [ ] 3.8 Replace strings in `app/routine/folder/[id].tsx` with `t()` calls
- [ ] 3.9 Add routines keys to `lib/i18n/es.json` and `lib/i18n/en.json`
- [ ] 3.10 Verify: navigate routines list → routine detail → create routine → folder; switch language; all text updates

## Phase 4: Progress (PR 4)

- [ ] 4.1 Extract strings from `app/(tabs)/progress.tsx` — identify all ~50+ strings (section headers, stat labels, date labels, comparison labels, calendar labels, loading messages, empty states)
- [ ] 4.2 Identify date arrays: `DAYS_ES`, `MONTHS_ES_SHORT`, `WEEKDAY_HEADER` — plan locale-aware replacements using i18n keys
- [ ] 4.3 Replace all strings in `app/(tabs)/progress.tsx` with `t()` calls — add `useTranslation()`
- [ ] 4.4 Replace `DAYS_ES`/`MONTHS_ES_SHORT`/`WEEKDAY_HEADER` arrays with locale-aware alternatives (use `t()` for each element or a function returning arrays)
- [ ] 4.5 Add progress keys to `lib/i18n/es.json` and `lib/i18n/en.json` — all progress.* keys including day/month name keys
- [ ] 4.6 Verify: navigate progress → verify Summary/Sets/Time labels, day abbreviations, comparison labels all translate correctly; switch language mid-screen

## Phase 5: Session Screens (PR 5)

- [ ] 5.1 Extract strings from `app/session/[id].tsx` — identify all ~80+ strings (headers, buttons, exercise picker, rest timer, save/discard modals, super set labels, drop set labels, series labels, swipe actions, loading messages)
- [ ] 5.2 Replace strings in `app/session/[id].tsx` with `t()` calls — add `useTranslation()`, work top-to-bottom through the file
- [ ] 5.3 Extract strings from `app/session/new.tsx` — identify ~5 strings (title, loading)
- [ ] 5.4 Replace strings in `app/session/new.tsx` with `t()` calls
- [ ] 5.5 Extract strings from `app/session/history/[id].tsx` — identify ~15 strings (title, notes, save as routine, empty state)
- [ ] 5.6 Replace strings in `app/session/history/[id].tsx` with `t()` calls
- [ ] 5.7 Add session keys to `lib/i18n/es.json` and `lib/i18n/en.json` — all session.* keys
- [ ] 5.8 Verify: start new session → add exercises → complete flow → save → view history; switch language; all 80+ strings translate

## Phase 6: Components + Exercise Resolver (PR 6)

- [ ] 6.1 Extract strings from `components/IntensityMethodPicker.tsx` — ~8 strings (title, method labels/descriptions, cancel)
- [ ] 6.2 Replace strings in `IntensityMethodPicker.tsx` with `t()` calls
- [ ] 6.3 Extract strings from `components/DropSetLogger.tsx` — segment labels ("Drop", "Parcial", "Segmento"), swipe delete
- [ ] 6.4 Replace strings in `DropSetLogger.tsx` with `t()` calls
- [ ] 6.5 Extract strings from `components/SetLogger.tsx` — swipe delete label
- [ ] 6.6 Replace strings in `SetLogger.tsx` with `t()` calls
- [ ] 6.7 Extract strings from `components/ExercisePicker.tsx` — ~15 strings (cancel, save, search placeholder, muscle filters, empty state, exercise count)
- [ ] 6.8 Replace strings in `ExercisePicker.tsx` with `t()` calls; ensure search matches both ES and EN names
- [ ] 6.9 Extract strings from `components/ExerciseNotes.tsx` — placeholder text
- [ ] 6.10 Replace strings in `ExerciseNotes.tsx` with `t()` calls
- [ ] 6.11 Extract strings from `components/NewRecordBanner.tsx`, `components/ProgressChart.tsx`, `components/SessionCard.tsx`, `components/RoutineCard.tsx` — ~5 strings total
- [ ] 6.12 Replace strings in those components with `t()` calls
- [ ] 6.13 Update `components/ui/ConfirmDialog.tsx` — remove hardcoded "Confirmar"/"Cancelar" defaults; callers must always pass translated labels (or use `t('common.confirm')`/`t('common.cancel')` as defaults)
- [ ] 6.14 Extract exercise-screen strings from `app/exercise/[id].tsx` and `app/exercise/create.tsx` — ~25 strings total
- [ ] 6.15 Replace strings in exercise screens with `t()` calls
- [ ] 6.16 Create `lib/i18n/exercise-names.ts` — `getExerciseName(name, lang)` function using `EXERCISE_NAMES_ES`
- [ ] 6.17 Replace all 19 `EXERCISE_NAMES_ES[name] || name` call sites with `getExerciseName(name, language)`
- [ ] 6.18 Add component + exercise + common + error keys to `lib/i18n/es.json` and `lib/i18n/en.json`
- [ ] 6.19 Verify: `npx tsc --noEmit` passes
- [ ] 6.20 Verify: grep for common Spanish words (`Confirmar`, `Cancelar`, `Guardar`, `Eliminar`) — no hits outside JSON files
- [ ] 6.21 Verify: exercise names display correctly in both languages; ConfirmDialog works with both languages
- [ ] 6.22 Verify: full app navigation in both languages — no raw key paths visible
