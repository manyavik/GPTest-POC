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

export interface RubricCriterion {
  name: string;
  description: string;
  maxPoints: number;
}

export interface Rubric {
  criteria: RubricCriterion[];
}

export interface Assessment {
  id: string;
  classId: string;
  title: string;
  prompt: string;
  rubric: Rubric;
  dueDate: string;
}

export interface Submission {
  id: string;
  assessmentId: string;
  studentId: string;
  content: string;
  score: number;
  feedback: string;
  status: 'pending' | 'graded' | 'revised';
  submittedAt: string;
  aiRawResponse?: string;
}
