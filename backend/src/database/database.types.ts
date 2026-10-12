import { ColumnType, Generated } from 'kysely';

export type GoalStatus = 'active' | 'paused' | 'completed';
export type EnergyLevel = 'low' | 'medium' | 'high';
export type SessionStatus = 'planned' | 'in_progress' | 'completed' | 'skipped';

export interface Database {
  users: UserTable;
  goals: GoalTable;
  sessions: SessionTable;
  session_activities: SessionActivityTable;
  session_feedback: SessionFeedbackTable;
}

export interface UserTable {
  id: Generated<string>;
  name: string;
  email: string;
  preferences: ColumnType<Record<string, unknown>, string | undefined, string>;
  created_at: Generated<Date>;
}

export interface GoalTable {
  id: Generated<string>;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  context: ColumnType<Record<string, unknown>, string | undefined, string>;
  status: Generated<GoalStatus>;
  created_at: Generated<Date>;
}

export interface SessionTable {
  id: Generated<string>;
  user_id: string;
  title: string | null;
  requested_minutes: number;
  energy: EnergyLevel;
  status: Generated<SessionStatus>;
  created_at: Generated<Date>;
  completed_at: Date | null;
}

export interface SessionActivityTable {
  id: Generated<string>;
  session_id: string;
  goal_id: string | null;
  title: string;
  instructions: string | null;
  planned_minutes: number;
  sort_order: Generated<number>;
}

export interface SessionFeedbackTable {
  id: Generated<string>;
  session_id: string;
  completed: boolean;
  difficulty: 'easy' | 'okay' | 'hard' | null;
  notes: string | null;
  ai_analysis: ColumnType<Record<string, unknown>, string | undefined, string>;
  created_at: Generated<Date>;
}
