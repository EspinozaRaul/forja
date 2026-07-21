# Fitness Tracker

A native mobile fitness tracking app built with Expo SDK 57, React Native, and SQLite.

## Features

- **Exercise Library** — Create and organize exercises by category (Strength, Cardio, Flexibility, HIIT)
- **Routines** — Build custom workout routines with target sets, reps, and weights
- **Active Sessions** — Track workouts in real-time with a timer, set logger, and exercise management
- **Progress Tracking** — View weekly volume and session count charts for any exercise
- **Session History** — Review past sessions with detailed stats and notes
- **Offline-First** — All data stored locally in SQLite; works without network

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 57 + Expo Router |
| Database | SQLite via `expo-sqlite` + Drizzle ORM |
| State | TanStack Query (React Query) |
| Styling | NativeWind (Tailwind CSS for RN) |
| Animations | React Native Reanimated |
| Language | TypeScript (strict) |

## Project Structure

```
fitness-tracker/
├── app/                          # Expo Router screens
│   ├── _layout.tsx               # Root layout (ErrorBoundary, QueryClient, DB init)
│   ├── (tabs)/                   # Tab navigator
│   │   ├── _layout.tsx           # Tab config (Home, Exercises, Routines, Progress)
│   │   ├── index.tsx             # Dashboard — stats, recent sessions, quick start
│   │   ├── exercises.tsx         # Exercise library — search, filter, grouped by category
│   │   ├── routines.tsx          # Routine list
│   │   └── progress.tsx          # Progress charts — volume & session frequency
│   ├── exercise/
│   │   ├── [id].tsx              # Exercise detail — history, progress chart
│   │   └── create.tsx            # Create exercise form
│   ├── routine/
│   │   ├── [id].tsx              # Routine detail — edit, manage exercises, start session
│   │   └── create.tsx            # Create routine form
│   └── session/
│       ├── new.tsx               # Start new session (empty or from routine)
│       ├── [id].tsx              # Active session — timer, sets, add exercises
│       └── history/
│           ├── index.tsx         # Session history list
│           └── [id].tsx          # Session summary — stats, sets, notes
├── components/                   # Reusable UI components
│   ├── ui/                       # Generic UI primitives
│   │   ├── AnimatedListItem.tsx  # Fade-in list item wrapper (Reanimated)
│   │   ├── Badge.tsx
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── EmptyState.tsx
│   │   ├── Input.tsx
│   │   └── LoadingSpinner.tsx
│   ├── ErrorBoundary.tsx         # React error boundary
│   ├── ExerciseCard.tsx
│   ├── ExercisePicker.tsx
│   ├── ProgressChart.tsx
│   ├── RestTimer.tsx
│   ├── RoutineCard.tsx
│   ├── SessionCard.tsx
│   ├── SetLogger.tsx
│   └── Timer.tsx
├── lib/                          # Data layer
│   ├── db/
│   │   ├── schema.ts             # Drizzle schema (7 tables)
│   │   ├── index.ts              # DB singleton, init, seed
│   │   ├── queries.ts            # CRUD functions
│   │   └── migrations/           # Generated SQL migrations
│   ├── hooks/                    # TanStack Query hooks
│   │   ├── useDatabase.ts
│   │   ├── useCategories.ts
│   │   ├── useExercises.ts
│   │   ├── useRoutines.ts
│   │   ├── useSessions.ts
│   │   ├── useSets.ts
│   │   └── useProgress.ts
│   ├── types/                    # TypeScript interfaces
│   │   └── index.ts
│   └── utils/
│       └── haptics.ts            # Haptic feedback helpers
├── global.css                    # Tailwind directives
├── tailwind.config.js            # NativeWind config
├── drizzle.config.ts             # Drizzle Kit config
├── app.json                      # Expo config
└── tsconfig.json                 # TypeScript config (strict)
```

## Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator or Android Emulator (or Expo Go for development)

### Installation

```bash
# Clone and install dependencies
cd fitness-tracker
npm install

# Start the development server
npx expo start
```

### Running

```bash
# iOS
npx expo start --ios

# Android
npx expo start --android

# Web
npx expo start --web
```

### Database

The app uses SQLite with Drizzle ORM. The database initializes automatically on first launch and seeds 4 default categories:

- **Strength** — 💪
- **Cardio** — 🏃
- **Flexibility** — 🧘
- **HIIT** — ⚡

To regenerate migrations after schema changes:

```bash
npx drizzle-kit generate
```

## Data Model

| Table | Description |
|-------|-------------|
| `categories` | Exercise categories (Strength, Cardio, etc.) |
| `exercises` | Individual exercises linked to categories |
| `routines` | Workout routines with name/description |
| `routineExercises` | Exercises within routines (with target sets/reps) |
| `sessions` | Workout sessions (with duration, notes, routine link) |
| `sessionExercises` | Exercises within a session |
| `sets` | Individual sets (reps, weight, completion status) |

## UX Features

- **Haptic Feedback** — Light, medium, and heavy feedback for key actions
- **Animated List Items** — Fade-in animations on all list screens
- **Error Boundaries** — Graceful error handling with retry option
- **Empty States** — Meaningful messages when lists are empty
- **Loading States** — Spinners during async operations
- **Confirmation Dialogs** — For destructive actions (remove exercise, end session)
- **Input Validation** — Proper error messages for invalid data

## License

MIT
