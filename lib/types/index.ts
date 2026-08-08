// ─── Database Entity Types ─────────────────────────────

export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
  createdAt: Date;
}

export interface Exercise {
  id: number;
  name: string;
  categoryId: number | null;
  description: string | null;
  equipment: string | null;
  targetMuscle: string | null;
  muscleGroup: string | null;
  bodyPart: string | null;
  secondaryMuscles: string | null;
  instructionsEs: string | null;
  imageUrl: string | null;
  gifUrl: string | null;
  originalId: string | null;
  unit: string | null; // kg or lbs
  createdAt: Date;
}

export interface Routine {
  id: number;
  name: string;
  description: string | null;
  categoryId: number | null;
  folderId: number | null;
  createdAt: Date;
}

export interface RoutineFolder {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  createdAt: Date;
}

export interface RoutineExercise {
  id: number;
  routineId: number;
  exerciseId: number;
  order: number;
  targetSets: number | null;
  targetReps: number | null;
}

export interface Session {
  id: number;
  routineId: number | null;
  startedAt: Date;
  completedAt: Date | null;
  duration: number | null;
  notes: string | null;
}

export interface SessionExercise {
  id: number;
  sessionId: number;
  exerciseId: number;
  order: number;
  restTime: number | null; // seconds
  notes: string | null;
}

export type SetMethod = 'linear' | 'dropset' | 'superset' | 'pyramid_up' | 'pyramid_down';

export interface Set {
  id: number;
  sessionExerciseId: number;
  setNumber: number;
  reps: number | null;
  weight: number | null;
  completed: boolean;
  method: string | null; // SetMethod values, but DB returns string
  dropOrder: number | null;
  isDropGroup: boolean | null;
  createdAt: Date;
}

export interface DropSetGroup {
  parentSet: Set;
  drops: Set[];
}

// ─── Composite Types ───────────────────────────────────

export interface ExerciseWithCategory extends Exercise {
  category?: Category;
}

export interface RoutineWithExercises extends Routine {
  exercises: RoutineExercise[];
}

export interface SessionWithExercises extends Session {
  exercises: Array<{
    id: number;
    exerciseName: string;
    sets: Set[];
  }>;
}

export interface ActiveSession {
  id: number;
  routineId: number | null;
  name: string;
  startedAt: Date;
  exercises: Array<{
    id: number;
    exerciseName: string;
    sets: Set[];
  }>;
}

// ─── Progress / Chart Types ────────────────────────────

export interface ProgressDataPoint {
  date: string;
  value: number;
}

export interface WeeklyVolume {
  week: string;
  exerciseId: number;
  exerciseName: string;
  totalVolume: number;
}

// ─── Input Types ───────────────────────────────────────

export interface CreateExerciseInput {
  name: string;
  categoryId: number;
  description?: string;
}

export interface CreateRoutineInput {
  name: string;
  description?: string;
  categoryId?: number;
  folderId?: number;
}

export interface CreateFolderInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface CreateSessionInput {
  routineId?: number;
}

export interface CreateSetInput {
  sessionExerciseId: number;
  setNumber: number;
  reps?: number;
  weight?: number;
}
