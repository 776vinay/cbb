export interface Exercise {
  id: string;
  name: string;
  category: string;
  muscle_groups: string[];
  instructions?: string;
  equipment?: string;
  created_by?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkoutSet {
  reps?: number;
  weight?: number;
  duration?: number; // in seconds
  distance?: number; // in meters
  rest_time?: number; // in seconds
  notes?: string;
}

export interface TemplateExercise {
  id: string;
  template_id: string;
  exercise_id: string;
  exercise: Exercise;
  order_index: number;
  sets_config: WorkoutSet[]; // Array of set configurations
  notes?: string;
  created_at: string;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  estimated_duration_minutes: number;
  created_by: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  exercises: TemplateExercise[];
  image_url?: string; // Added image_url property
}

export interface WorkoutPlan {
  id: string;
  client_id: string;
  trainer_id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  schedule_type: 'weekly' | 'monthly' | 'custom';
  schedule_data: any; // Flexible schedule configuration
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface PlanSession {
  id: string;
  plan_id: string;
  template_id?: string;
  scheduled_date: string;
  scheduled_time?: string;
  day_of_week?: string;
  week_number?: number;
  status: 'scheduled' | 'completed' | 'skipped' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TrainingSession {
  id: string;
  client_id: string;
  trainer_id: string;
  template_id?: string;
  plan_id?: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  type: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  location?: string;
  notes?: string;
  trainer_notes?: string;
  client_feedback?: string;
  session_rating?: number;
  exercises_completed?: any[];
  session_data: any; // Store workout details during session
  completion_data: any; // Store results after completion
  created_at: string;
  updated_at: string;
}

export interface WorkoutSession {
  id: string;
  client_id: string;
  template_id?: string;
  plan_id?: string;
  date: string;
  start_time?: string;
  end_time?: string;
  exercises: {
    exercise_id: string;
    sets: (WorkoutSet & { completed?: boolean; id?: string })[];
    notes?: string;
  }[];
  notes?: string;
  completed: boolean;
  synced: boolean;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  joinDate: string;
  trainerId?: string;
}

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface ClientProgress {
  id: string;
  client_id: string;
  trainer_id: string;
  date: string;
  weight_kg?: number;
  body_fat_percentage?: number;
  muscle_mass_kg?: number;
  measurements: any; // Store various body measurements
  photos?: string[]; // Array of photo URLs
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ClientGoal {
  id: string;
  client_id: string;
  trainer_id?: string;
  title: string;
  description?: string;
  category?: string;
  target_value?: number;
  target_unit?: string;
  current_value: number;
  target_date?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  created_at: string;
  updated_at: string;
}

// New interfaces for active session management
export interface ActiveSet {
  id: string;
  reps?: number;
  weight?: number;
  duration?: number;
  rest_time?: number; // Consistent with DB schema
  completed: boolean;
  notes?: string;
}

export interface ActiveExercise {
  exerciseId: string;
  exerciseName: string;
  sets: ActiveSet[];
  currentSetIndex: number;
  notes: string;
}
