export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: 'teacher' | 'student';
}

export interface Class {
  id: string;
  name: string;
  description: string;
  teacherId: string;
  studentIds: string[];
  inviteCode: string;
}

export type RubricMode = 'default' | 'custom';

export interface RubricCriterion {
  name: string;
  description: string;
  maxPoints: number;
}

export interface Rubric {
  /** How AI grading should use the rubric. Older assessments omit this and are treated as custom if they have criteria. */
  mode?: RubricMode;
  /** Maximum score (holistic cap for default; should equal sum of criterion maxPoints for custom). */
  totalPoints?: number;
  criteria?: RubricCriterion[];
}

export interface Assessment {
  id: string;
  classId: string;
  /** Denormalized from class.teacherId — used by Firestore rules + queries without chained reads. */
  teacherId?: string;
  title: string;
  prompt: string;
  rubric: Rubric;
  dueDate: string;
}

export interface Submission {
  id: string;
  assessmentId: string;
  /** Denormalized — must match query filter for teacher list reads. */
  teacherId?: string;
  studentId: string;
  content: string;
  score: number;
  feedback: string;
  status: 'pending' | 'graded' | 'revised';
  submittedAt: string;
  aiRawResponse?: string;
  /** Snapshot of AI output at grade time; unchanged when teacher revises (research / comparison). */
  aiScore?: number;
  aiFeedback?: string;
  /** Set when a teacher saves a revision over AI output. */
  teacherRevisedAt?: string;
}
