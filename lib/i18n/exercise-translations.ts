/**
 * Exercise name translations (English → Spanish)
 * Maps exercise names from the dataset to Spanish equivalents.
 * Used when the app language is set to Spanish.
 */

export const EXERCISE_NAME_TRANSLATIONS: Record<string, string> = {
  // ─── CHEST ──────────────────────────────────────────────
  '3/4 sit-up': 'Abdominal 3/4',
  '45° side bend': 'Inclinación lateral 45°',
  'assisted sit-up': 'Abdominal asistido',
  'archer push up': 'Flexión de brazos tipo arquero',
  'all fours squad stretch': 'Estiramiento en cuatro patas',
  'barbell bench press': 'Press de banca con barra',
  'barbell guillotine bench press': 'Press de banca guillotina con barra',
  'barbell incline bench press': 'Press de banca inclinado con barra',
  'barbell decline bench press': 'Press de banca declinado con barra',
  'dumbbell bench press': 'Press de banca con mancuernas',
  'incline dumbbell bench press': 'Press de banca inclinado con mancuernas',
  'decline dumbbell bench press': 'Press de banca declinado con mancuernas',
  'dumbbell flyes': 'Aperturas con mancuernas',
  'incline dumbbell flyes': 'Aperturas inclinadas con mancuernas',
  'cable crossover (high)': 'Cruce de poleas alto',
  'cable crossover (low)': 'Cruce de poleas bajo',
  'cable crossover (middle)': 'Cruce de poleas medio',
  'push-ups': 'Flexiones de brazos',
  'incline push-ups': 'Flexiones inclinadas',
  'decline push-ups': 'Flexiones declinadas',
  'diamond push-ups': 'Flexiones diamante',
  'wide-grip push-ups': 'Flexiones de agarre ancho',
  'chest dips': 'Fondos para pecho',
  'chest press machine': 'Máquina de press para pecho',
  'pec deck machine': 'Máquina de mariposa',
  'cable chest fly': 'Aperturas en polea para pecho',

  // ─── BACK ───────────────────────────────────────────────
  'conventional deadlift': 'Peso muerto convencional',
  'romanian deadlift': 'Peso muerto rumano',
  'sumo deadlift': 'Peso muerto sumo',
  'wide-grip pull-ups': 'Dominadas de agarre ancho',
  'close-grip pull-ups': 'Dominadas de agarre cerrado',
  'neutral-grip pull-ups': 'Dominadas de agarre neutro',
  'chin-ups': 'Dominadas supinas',
  'bent-over barbell row': 'Remo con barra inclinado',
  'pendlay row': 'Remo Pendlay',
  't-bar row': 'Remo con barra T',
  'seated cable row': 'Remo en polea sentado',
  'lat pulldown': 'Jalón al pecho',
  'wide-grip lat pulldown': 'Jalón al pecho de agarre ancho',
  'close-grip lat pulldown': 'Jalón al pecho de agarre cerrado',
  'barbell pullover': 'Pullover con barra',
  'dumbbell pullover': 'Pullover con mancuerna',
  'hyperextensions': 'Hiperextensiones',
  'back extensions': 'Extensiones de espalda',

  // ─── SHOULDERS ──────────────────────────────────────────
  'overhead press': 'Press militar',
  'barbell overhead press': 'Press militar con barra',
  'dumbbell shoulder press': 'Press de hombros con mancuernas',
  'seated dumbbell press': 'Press sentado con mancuernas',
  'arnold press': 'Press Arnold',
  'lateral raises': 'Elevaciones laterales',
  'dumbbell lateral raises': 'Elevaciones laterales con mancuernas',
  'front raises': 'Elevaciones frontales',
  'dumbbell front raises': 'Elevaciones frontales con mancuernas',
  'rear delt raises': 'Elevaciones posteriores',
  'face pulls': 'Jalones a la cara',
  'upright rows': 'Remo vertical',
  'barbell upright row': 'Remo vertical con barra',
  'shrugs': 'Encogimientos',
  'dumbbell shrugs': 'Encogimientos con mancuernas',
  'barbell shrugs': 'Encogimientos con barra',

  // ─── BICEPS ─────────────────────────────────────────────
  'barbell curl': 'Curl de bíceps con barra',
  'dumbbell curl': 'Curl de bíceps con mancuernas',
  'hammer curl': 'Curl martillo',
  'preacher curl': 'Curl en banco predicador',
  'barbell preacher curl': 'Curl en banco predicador con barra',
  'dumbbell preacher curl': 'Curl en banco predicador con mancuernas',
  'concentration curl': 'Curl concentrado',
  'cable curl': 'Curl en polea',
  'incline dumbbell curl': 'Curl inclinado con mancuernas',
  'drag curl': 'Curl arrastrado',
  'spider curl': 'Curl araña',

  // ─── TRICEPS ────────────────────────────────────────────
  'tricep pushdown': 'Extensiones en polea',
  'close-grip bench press': 'Press de banca agarre cerrado',
  'skull crushers': 'Extensión de tríceps acostado',
  'lying triceps extension': 'Extensión de tríceps acostado',
  'overhead triceps extension': 'Extensión de tríceps por encima de la cabeza',
  'dips': 'Fondos',
  'tricep dips': 'Fondos para tríceps',
  'cable tricep pushdown': 'Extensiones en polea para tríceps',
  'dumbbell kickback': 'Extensiones de tríceps con mancuerna',
  'tricep rope pushdown': 'Extensiones en polea con cuerda',

  // ─── LEGS ───────────────────────────────────────────────
  'barbell squat': 'Sentadilla con barra',
  'back squat': 'Sentadilla trasera',
  'front squat': 'Sentadilla frontal',
  'goblet squat': 'Sentadilla copa',
  'hack squat': 'Sentadilla hack',
  'barbell hack squat': 'Sentadilla hack con barra',
  'leg press': 'Prensa de piernas',
  'leg extensions': 'Extensiones de cuádriceps',
  'leg curls': 'Curl femoral',
  'lying leg curls': 'Curl femoral acostado',
  'seated leg curls': 'Curl femoral sentado',
  'calf raises': 'Elevaciones de talones',
  'standing calf raises': 'Elevaciones de talones de pie',
  'seated calf raises': 'Elevaciones de talones sentado',
  'lunges': 'Zancadas',
  'barbell lunges': 'Zancadas con barra',
  'dumbbell lunges': 'Zancadas con mancuernas',
  'walking lunges': 'Zancadas caminando',
  'reverse lunges': 'Zancadas inversas',
  'bulgarian split squat': 'Sentadilla búlgara',
  'step-ups': 'Subidas al cajón',
  'wall sits': 'Sentadilla isométrica en pared',
  'glute bridges': 'Puente de glúteos',
  'hip thrusts': 'Empuje de cadera',
  'barbell hip thrust': 'Empuje de cadera con barra',

  // ─── ABS / CORE ─────────────────────────────────────────
  'sit-ups': 'Abdominales',
  'crunches': 'Curl abdominal',
  'hanging leg raises': 'Elevaciones de piernas colgado',
  'hanging knee raises': 'Elevaciones de rodillas colgado',
  'plank': 'Plancha',
  'side plank': 'Plancha lateral',
  'russian twists': 'Giros rusos',
  'bicycle crunches': 'Abdominales bicicleta',
  'dead bug': 'Bicho muerto',
  'bird dog': 'Pájaro perro',
  'ab wheel rollout': 'Rueda abdominal',
  'cable woodchops': 'Taladros en polea',
  'flutter kicks': 'Patadas de aleteo',
  'leg raises': 'Elevaciones de piernas',
  'toe touches': 'Tocar los dedos de los pies',
  'v-ups': 'Abdominales en V',
  'reverse crunches': 'Abdominales inversos',
  'mountain climbers': 'Escaladores',

  // ─── CARDIO ─────────────────────────────────────────────
  'running': 'Correr',
  'cycling': 'Ciclismo',
  'swimming': 'Natación',
  'jumping jacks': 'Saltos de tijera',
  'burpees': 'Burpees',
  'high knees': 'Rodillas altas',
  'butt kicks': 'Talones al glúteo',
  'jump rope': 'Cuerda saltar',
  'stair climbing': 'Subir escaleras',
  'rowing': 'Remo',
  'elliptical': 'Elíptica',
  'treadmill': 'Cinta de correr',
};

/**
 * Muscle group translations
 */
export const MUSCLE_GROUP_TRANSLATIONS: Record<string, string> = {
  'chest': 'Pecho',
  'back': 'Espalda',
  'shoulders': 'Hombros',
  'biceps': 'Bíceps',
  'triceps': 'Tríceps',
  'forearms': 'Antebrazos',
  'upper arms': 'Brazos',
  'upper legs': 'Piernas',
  'lower legs': 'Pantorrillas',
  'waist': 'Cintura',
  'core': 'Core',
  'glutes': 'Glúteos',
  'hamstrings': 'Isquiotibiales',
  'quadriceps': 'Cuádriceps',
  'calves': 'Pantorrillas',
  'neck': 'Cuello',
  'full body': 'Cuerpo completo',
  'cardio': 'Cardio',
};

/**
 * Category translations
 */
export const CATEGORY_TRANSLATIONS: Record<string, string> = {
  'Strength': 'Fuerza',
  'Core': 'Core',
  'Cardio': 'Cardio',
  'HIIT': 'HIIT',
  'Flexibility': 'Flexibilidad',
};

/**
 * Equipment translations
 */
export const EQUIPMENT_TRANSLATIONS: Record<string, string> = {
  'barbell': 'Barra',
  'dumbbell': 'Mancuerna',
  'cable': 'Polea',
  'machine': 'Máquina',
  'body weight': 'Peso corporal',
  'kettlebell': 'Pesa rusa',
  'band': 'Banda elástica',
  'foam roller': 'Rodillo de espuma',
  'none': 'Ninguno',
};

/**
 * Get the Spanish name for an exercise
 * @param englishName - The English exercise name
 * @returns The Spanish name, or the original English name if no translation exists
 */
export function getExerciseNameEs(englishName: string): string {
  const lower = englishName.toLowerCase().trim();
  return EXERCISE_NAME_TRANSLATIONS[lower] || englishName;
}

/**
 * Get the Spanish name for a muscle group
 */
export function getMuscleGroupEs(english: string): string {
  const lower = english.toLowerCase().trim();
  return MUSCLE_GROUP_TRANSLATIONS[lower] || english;
}

/**
 * Get the Spanish name for a category
 */
export function getCategoryEs(english: string): string {
  return CATEGORY_TRANSLATIONS[english] || english;
}

/**
 * Get the Spanish name for equipment
 */
export function getEquipmentEs(english: string): string {
  const lower = english.toLowerCase().trim();
  return EQUIPMENT_TRANSLATIONS[lower] || english;
}
