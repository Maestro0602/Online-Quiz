export type UserRole = 'instructor' | 'teacher' | 'student' | 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  password?: string;
  avatar?: string;
}

export interface Question {
  id: string;
  quiz_id?: string;
  prompt: string;
  options: string[]; // 2 to 4 options
  correct_option_index: number;
  base_points: number; // e.g. 1000
  time_limit_seconds: number; // e.g. 20
}

export interface Quiz {
  id: string;
  instructor_id: string;
  instructor_name?: string;
  title: string;
  description: string;
  is_published: boolean;
  questions: Question[];
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  user_id: string;
  user_name: string;
  team_id: string;
  individual_score: number;
  is_online: boolean;
  avatar?: string;
}

export interface Team {
  id: string;
  session_id: string;
  name: string;
  color: string;
  badge: string;
  total_score: number;
  members: TeamMember[];
}

export type SessionStatus = 'lobby' | 'question_active' | 'question_result' | 'ended';

export interface GameSession {
  id: string;
  quiz_id: string;
  quiz_title: string;
  room_code: string; // e.g. "739218"
  status: SessionStatus;
  team_count: number;
  teams: Team[];
  current_question_index: number;
  total_questions: number;
  host_user_id: string;
  created_at: string;
  current_question?: Question;
  time_remaining?: number;
}

export interface PlayerAnswerSubmission {
  room_code: string;
  question_id: string;
  selected_option_index: number;
  time_taken_seconds: number;
}

export interface PlayerAnswerResult {
  is_correct: boolean;
  correct_option_index: number;
  points_awarded: number;
  new_individual_score: number;
  new_team_score: number;
  team_name: string;
  team_id: string;
}

export interface TopContributor {
  user_id: string;
  user_name: string;
  team_name: string;
  team_color: string;
  score: number;
}

export interface GameSummary {
  session_id: string;
  room_code: string;
  quiz_title: string;
  teams: Team[];
  top_contributors: TopContributor[];
  total_participants: number;
}
