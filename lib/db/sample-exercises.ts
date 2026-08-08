// Sample exercises from the dataset to test new fields
// Full dataset will be loaded from Supabase after auth setup

export interface SampleExercise {
  name: string;
  category: 'Strength' | 'Cardio' | 'Flexibility' | 'HIIT';
  muscleGroup: string;
  description: string;
  equipment: string;
  targetMuscle: string;
  instructionsEs: string;
  imageUrl: string;
  gifUrl: string;
}

export const SAMPLE_EXERCISES: SampleExercise[] = [
  // Chest exercises
  {
    name: 'Barbell Bench Press',
    category: 'Strength',
    muscleGroup: 'Chest',
    description: 'Lie on a flat bench and press a barbell upward from chest level to full arm extension.',
    equipment: 'barbell',
    targetMuscle: 'pectorals',
    instructionsEs: 'Acuéstate en un banco plano y presiona una barra hacia arriba desde el nivel del pecho hasta la extensión completa de los brazos.',
    imageUrl: 'assets/exercises/images/0025-EIeI8Vf.jpg',
    gifUrl: 'assets/exercises/gifs/0025-EIeI8Vf.gif',
  },
  {
    name: 'Dumbbell Bench Press',
    category: 'Strength',
    muscleGroup: 'Chest',
    description: 'Lie on a flat bench and press two dumbbells upward from chest level.',
    equipment: 'dumbbell',
    targetMuscle: 'pectorals',
    instructionsEs: 'Acuéstate en un banco plano y presiona dos mancuernas hacia arriba desde el nivel del pecho.',
    imageUrl: 'assets/exercises/images/0026-8K0w2yA.jpg',
    gifUrl: 'assets/exercises/gifs/0026-8K0w2yA.gif',
  },
  {
    name: 'Push-ups',
    category: 'Strength',
    muscleGroup: 'Chest',
    description: 'Lower and raise your body using your arms while maintaining a straight plank position.',
    equipment: 'body weight',
    targetMuscle: 'pectorals',
    instructionsEs: 'Baja y sube tu cuerpo usando los brazos mientras mantienes una posición de plancha recta.',
    imageUrl: 'assets/exercises/images/0007-4IKbhHV.jpg',
    gifUrl: 'assets/exercises/gifs/0007-4IKbhHV.gif',
  },
  // Back exercises
  {
    name: 'Pull-up',
    category: 'Strength',
    muscleGroup: 'Back',
    description: 'Pull your chin above a bar using your back and arm muscles.',
    equipment: 'body weight',
    targetMuscle: 'latissimus dorsi',
    instructionsEs: 'Levanta tu barbilla por encima de una barra usando los músculos de la espalda y los brazos.',
    imageUrl: 'assets/exercises/images/0652-lBDjFxJ.jpg',
    gifUrl: 'assets/exercises/gifs/0652-lBDjFxJ.gif',
  },
  {
    name: 'Bent-Over Barbell Row',
    category: 'Strength',
    muscleGroup: 'Back',
    description: 'Row a barbell toward your lower chest while bent at the hips with a flat back.',
    equipment: 'barbell',
    targetMuscle: 'latissimus dorsi',
    instructionsEs: 'Rema una barra hacia el pecho inferior mientras estás inclinado desde las caderas con la espalda recta.',
    imageUrl: 'assets/exercises/images/0032-ila4NZS.jpg',
    gifUrl: 'assets/exercises/gifs/0032-ila4NZS.gif',
  },
  // Leg exercises
  {
    name: 'Barbell Full Squat',
    category: 'Strength',
    muscleGroup: 'Upper Legs',
    description: 'Squat with a barbell on your upper back, going as deep as possible.',
    equipment: 'barbell',
    targetMuscle: 'glutes',
    instructionsEs: 'Haz sentadillas con una barra en la parte superior de la espalda, bajando lo más profundo posible.',
    imageUrl: 'assets/exercises/images/0043-qXTaZnJ.jpg',
    gifUrl: 'assets/exercises/gifs/0043-qXTaZnJ.gif',
  },
  {
    name: 'Dumbbell Lunges',
    category: 'Strength',
    muscleGroup: 'Upper Legs',
    description: 'Step forward into a lunge position holding dumbbells, then push back to starting position.',
    equipment: 'dumbbell',
    targetMuscle: 'quadriceps',
    instructionsEs: 'Da un paso adelante hacia una posición de zancada sosteniendo mancuernas, luego empuja de regreso a la posición inicial.',
    imageUrl: 'assets/exercises/images/0050-9K0w2yA.jpg',
    gifUrl: 'assets/exercises/gifs/0050-9K0w2yA.gif',
  },
  // Shoulder exercises
  {
    name: 'Dumbbell Lateral Raise',
    category: 'Strength',
    muscleGroup: 'Shoulders',
    description: 'Raise dumbbells out to the sides until arms are parallel to the floor.',
    equipment: 'dumbbell',
    targetMuscle: 'deltoids',
    instructionsEs: 'Levanta las mancuernas hacia los lados hasta que los brazos estén paralelos al suelo.',
    imageUrl: 'assets/exercises/images/0334-DsgkuIt.jpg',
    gifUrl: 'assets/exercises/gifs/0334-DsgkuIt.gif',
  },
  // Arm exercises
  {
    name: 'Dumbbell Biceps Curl',
    category: 'Strength',
    muscleGroup: 'Upper Arms',
    description: 'Curl dumbbells up toward your shoulders, squeezing your biceps at the top.',
    equipment: 'dumbbell',
    targetMuscle: 'biceps',
    instructionsEs: 'Enrosca las mancuernas hacia los hombros, apretando los bíceps en la parte superior.',
    imageUrl: 'assets/exercises/images/0294-NbVPDMW.jpg',
    gifUrl: 'assets/exercises/gifs/0294-NbVPDMW.gif',
  },
  // Core exercises
  {
    name: 'Plank',
    category: 'Strength',
    muscleGroup: 'Waist',
    description: 'Hold a push-up position with arms extended, keeping your body straight.',
    equipment: 'body weight',
    targetMuscle: 'abs',
    instructionsEs: 'Mantén una posición de flexión con los brazos extendidos, manteniendo el cuerpo recto.',
    imageUrl: 'assets/exercises/images/0001-2gPfomN.jpg',
    gifUrl: 'assets/exercises/gifs/0001-2gPfomN.gif',
  },
];
