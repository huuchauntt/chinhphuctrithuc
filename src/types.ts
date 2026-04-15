export interface Student {
  id: string;
  name: string;
}

export interface Class {
  id?: string;
  name: string;
  students: Student[];
  teacherId: string;
  createdAt: any;
}

export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_blank' | 'matching';

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface Question {
  id?: number | string;
  type?: QuestionType;
  timeLimit?: number;
  question: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctAnswer?: string;
  matchingPairs?: MatchingPair[];
  topic?: string;
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
}

export interface PlayerScore {
  id?: string;
  sessionId: string;
  timestamp?: string | any;
  playerName: string;
  deviceId: string;
  score: number;
  topic?: string;
}

export interface Quiz {
  id?: string;
  title: string;
  topic?: string;
  questions: Question[];
  teacherId: string;
  createdAt: any;
  timeLimit?: number;
}

export interface Session {
  id?: string;
  name?: string;
  pin: string;
  quizId: string;
  quizTitle: string;
  teacherId: string;
  status: 'waiting' | 'active' | 'finished';
  createdAt: any;
  startTime?: any;
  endTime?: any;
  timeLimit?: number;
  currentQuestionIdx?: number;
  scannedAnswers?: Record<string, string>;
  classId?: string;
}

