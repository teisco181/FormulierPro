import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const forms = pgTable('forms', {
  id: serial('id').primaryKey(),
  formUid: text('form_uid').notNull().unique(),
  creatorUid: text('creator_uid').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  mode: text('mode').notNull().default('exam'), // 'exam' | 'practice' | 'survey'
  isExamSecure: integer('is_exam_secure').notNull().default(1), // 1 = true, fullscreen lock & teacher unlock
  securityPasscode: text('security_passcode').notNull().default('1234'),
  timerMinutes: integer('timer_minutes').notNull().default(0), // 0 = unlimited
  shuffleQuestions: integer('shuffle_questions').notNull().default(1),
  maxQuestionsTotal: integer('max_questions_total'),
  categoryQuotas: text('category_quotas'), // JSON string: { "Cat A": 5, "Cat B": 3 }
  allowReview: integer('allow_review').notNull().default(1), // 1 = respondents can review answers & AI feedback
  submissionPolicy: text('submission_policy').notNull().default('multiple_email'), // 'single_email' | 'multiple_email' | 'anonymous'
  openAiKey: text('openai_key'),
  aiGradingEnabled: integer('ai_grading_enabled').notNull().default(1),
  themeColor: text('theme_color').notNull().default('#4f46e5'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const questions = pgTable('questions', {
  id: serial('id').primaryKey(),
  formId: integer('form_id')
    .references(() => forms.id)
    .notNull(),
  category: text('category').notNull().default('Algemeen'),
  questionType: text('question_type').notNull().default('multiple_choice'), // 'multiple_choice' | 'open' | 'checkbox' | 'rating'
  questionText: text('question_text').notNull(),
  options: text('options'), // JSON string: string[]
  correctAnswer: text('correct_answer'),
  points: integer('points').notNull().default(1),
  rubric: text('rubric'), // Model answer, grading criteria, explanation
  orderIndex: integer('order_index').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const submissions = pgTable('submissions', {
  id: serial('id').primaryKey(),
  formId: integer('form_id')
    .references(() => forms.id)
    .notNull(),
  submissionUid: text('submission_uid').notNull().unique(),
  respondentEmail: text('respondent_email'),
  respondentName: text('respondent_name'),
  totalScore: integer('total_score').notNull().default(0),
  maxScore: integer('max_score').notNull().default(0),
  percentage: integer('percentage').notNull().default(0),
  timeSpentSeconds: integer('time_spent_seconds').notNull().default(0),
  status: text('status').notNull().default('in_progress'), // 'in_progress' | 'submitted' | 'locked' | 'unlocked'
  lockReason: text('lock_reason'),
  isUnlockedByMaker: integer('is_unlocked_by_maker').notNull().default(0),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const submissionAnswers = pgTable('submission_answers', {
  id: serial('id').primaryKey(),
  submissionId: integer('submission_id')
    .references(() => submissions.id)
    .notNull(),
  questionId: integer('question_id').references(() => questions.id),
  questionText: text('question_text').notNull(),
  questionCategory: text('question_category').notNull().default('Algemeen'),
  questionType: text('question_type').notNull(),
  answerValue: text('answer_value'),
  isCorrect: integer('is_correct').notNull().default(0),
  scoreAwarded: integer('score_awarded').notNull().default(0),
  maxPoints: integer('max_points').notNull().default(1),
  aiFeedback: text('ai_feedback'),
  manualFeedback: text('manual_feedback'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  forms: many(forms),
}));

export const formsRelations = relations(forms, ({ one, many }) => ({
  author: one(users, {
    fields: [forms.creatorUid],
    references: [users.uid],
  }),
  questions: many(questions),
  submissions: many(submissions),
}));

export const questionsRelations = relations(questions, ({ one }) => ({
  form: one(forms, {
    fields: [questions.formId],
    references: [forms.id],
  }),
}));

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  form: one(forms, {
    fields: [submissions.formId],
    references: [forms.id],
  }),
  answers: many(submissionAnswers),
}));

export const submissionAnswersRelations = relations(submissionAnswers, ({ one }) => ({
  submission: one(submissions, {
    fields: [submissionAnswers.submissionId],
    references: [submissions.id],
  }),
  question: one(questions, {
    fields: [submissionAnswers.questionId],
    references: [questions.id],
  }),
}));
