export type FormMode = 'exam' | 'practice' | 'survey';
export type SubmissionPolicy = 'single_email' | 'multiple_email' | 'anonymous';
export type QuestionType = 'multiple_choice' | 'open' | 'checkbox' | 'rating';

export interface Question {
  id?: number;
  category: string;
  questionType: QuestionType;
  questionText: string;
  options?: string[];
  correctAnswer?: string;
  points: number;
  rubric?: string;
  orderIndex?: number;
}

export interface FormModel {
  id?: number;
  formUid: string;
  creatorUid: string;
  title: string;
  description?: string;
  mode: FormMode;
  isExamSecure: number; // 1 or 0
  securityPasscode: string;
  timerMinutes: number; // 0 = unlimited
  shuffleQuestions: number; // 1 or 0
  maxQuestionsTotal?: number | null;
  categoryQuotas?: string | null; // JSON string: { [category: string]: number }
  allowReview: number; // 1 or 0
  submissionPolicy: SubmissionPolicy;
  openAiKey?: string | null;
  aiGradingEnabled: number; // 1 or 0
  themeColor: string;
  createdAt?: string;
  updatedAt?: string;
  questions?: Question[];
  isCreator?: boolean;
}

export interface SubmissionAnswer {
  id?: number;
  submissionId: number;
  questionId?: number;
  questionText: string;
  questionCategory: string;
  questionType: string;
  answerValue?: string;
  isCorrect: number;
  scoreAwarded: number;
  maxPoints: number;
  aiFeedback?: string;
  manualFeedback?: string;
}

export interface Submission {
  id: number;
  formId: number;
  submissionUid: string;
  respondentEmail?: string | null;
  respondentName?: string | null;
  totalScore: number;
  maxScore: number;
  percentage: number;
  timeSpentSeconds: number;
  status: 'in_progress' | 'submitted' | 'locked' | 'unlocked';
  lockReason?: string | null;
  isUnlockedByMaker: number;
  completedAt?: string | null;
  createdAt: string;
}

export interface AnalyticsData {
  form: FormModel;
  totalSubmissions: number;
  avgPercentage: number;
  avgTimeSeconds: number;
  passRate: number;
  scoreDistribution: { range: string; count: number }[];
  categoryBreakdown: { category: string; percentage: number; attempts: number }[];
  questionAnalysis: {
    id: number;
    category: string;
    questionType: string;
    questionText: string;
    points: number;
    answeredCount: number;
    accuracyRate: number;
    averagePoints: number;
  }[];
  submissions: Submission[];
}
