export const STUDYFLOW_ORIGIN = 'https://teisco181.github.io';
export const PENDING_STUDYFLOW_STORAGE_KEY = 'formulierpro_pending_studyflow_quizzes';

export interface StudyFlowStofPayload {
  vak: string;
  titel: string;
  tekst: string;
  email?: string;
  naam?: string;
}

export interface StudyFlowResultaatVraag {
  vraag: string;
  gegevenAntwoord: string;
  juistAntwoord: string;
  goed: boolean;
}

export interface StudyFlowResultaatPayload {
  vak: string;
  titel: string;
  score: number;
  maxScore: number;
  datum: string;
  vragen: StudyFlowResultaatVraag[];
}

export interface StudyFlowFormQuestionInput {
  id?: number;
  category: string;
  questionType: 'multiple_choice' | 'open';
  questionText: string;
  options?: string[];
  correctAnswer: string;
  rubric: string;
  points: number;
}

export interface StudyFlowAttemptPayload {
  totalScore: number;
  maxScore: number;
  percentage: number;
  timeSpentSeconds: number;
  answers: Array<{
    questionId?: number;
    questionText: string;
    questionCategory: string;
    questionType: string;
    answerValue: string;
    correctAnswer: string;
    isCorrect: number;
    scoreAwarded: number;
    maxPoints: number;
    aiFeedback: string;
  }>;
}

export interface PendingStudyFlowQuiz {
  clientQuizId: string;
  targetEmail: string | null;
  createdAt: string;
  formPayload: Record<string, unknown>;
  attempt?: StudyFlowAttemptPayload;
}

export function isInsideIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function isEmbeddedInStudyFlow(): boolean {
  if (!isInsideIframe()) return false;
  try {
    if (window.location.origin === STUDYFLOW_ORIGIN) return true;
    const ancestor = window.location.ancestorOrigins?.[0];
    if (ancestor === STUDYFLOW_ORIGIN) return true;
    if (document.referrer && document.referrer.startsWith(STUDYFLOW_ORIGIN)) return true;
  } catch {
    // Ignore cross-origin property access errors
  }
  return false;
}

export function postToStudyFlowReady(): void {
  if (!isInsideIframe()) return;
  try {
    window.parent.postMessage({ type: 'TOETS_READY' }, STUDYFLOW_ORIGIN);
  } catch {
    // Ignore if host rejects targetOrigin mismatch (e.g. non-StudyFlow preview frame)
  }
}

export function postToStudyFlowResult(payload: StudyFlowResultaatPayload): boolean {
  if (!isInsideIframe()) return false;
  window.parent.postMessage(
    {
      type: 'TOETS_RESULTAAT',
      payload,
    },
    STUDYFLOW_ORIGIN
  );
  return true;
}

export function buildStudyFlowFormPayload(params: {
  stof: StudyFlowStofPayload;
  questions: StudyFlowFormQuestionInput[];
  count: number;
  questionType: string;
  difficulty: string;
  creatorEmail?: string | null;
}) {
  const { stof, questions, count, questionType, difficulty, creatorEmail } = params;
  const normalizedEmail = (creatorEmail || stof.email || '').trim().toLowerCase() || null;

  return {
    title: `${stof.titel} (${stof.vak})`,
    description: `StudyFlow oefentoets voor ${stof.vak} • ${count} vragen (${questionType}, ${difficulty}).`,
    mode: 'practice',
    isExamSecure: 0,
    securityPasscode: '1234',
    timerMinutes: 0,
    shuffleQuestions: 0,
    maxQuestionsTotal: null,
    categoryQuotas: null,
    submissionPolicy: 'multiple_email',
    allowReview: 1,
    aiGradingEnabled: 1,
    themeColor: '#4f46e5',
    creatorEmail: normalizedEmail,
    questions: questions.map((q) => ({
      category: q.category || stof.vak || 'Algemeen',
      questionType: q.questionType === 'open' ? 'open' : 'multiple_choice',
      questionText: q.questionText,
      options: q.questionType === 'open' ? [] : q.options || [],
      correctAnswer: q.correctAnswer,
      points: Math.max(1, Number(q.points) || 1),
      rubric: q.rubric || '',
    })),
  };
}

function readPendingQueue(): PendingStudyFlowQuiz[] {
  try {
    const raw = window.localStorage.getItem(PENDING_STUDYFLOW_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePendingQueue(items: PendingStudyFlowQuiz[]): void {
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(PENDING_STUDYFLOW_STORAGE_KEY);
    } else {
      window.localStorage.setItem(PENDING_STUDYFLOW_STORAGE_KEY, JSON.stringify(items.slice(-25)));
    }
  } catch {
    // Ignore storage errors
  }
}

export function savePendingStudyFlowQuiz(entry: PendingStudyFlowQuiz): void {
  const queue = readPendingQueue();
  const filtered = queue.filter((item) => item.clientQuizId !== entry.clientQuizId);
  filtered.push(entry);
  writePendingQueue(filtered);
}

export function updatePendingStudyFlowAttempt(
  clientQuizId: string,
  attempt: StudyFlowAttemptPayload
): void {
  const queue = readPendingQueue();
  const idx = queue.findIndex((item) => item.clientQuizId === clientQuizId);
  if (idx === -1) return;
  queue[idx] = {
    ...queue[idx],
    attempt,
  };
  writePendingQueue(queue);
}

export async function syncPendingStudyFlowQuizzes(params: {
  userEmail?: string | null;
  getToken: () => Promise<string | null>;
}): Promise<{ syncedCount: number; savedFormUids: Record<string, string> }> {
  const { userEmail, getToken } = params;
  const queue = readPendingQueue();
  if (queue.length === 0) {
    return { syncedCount: 0, savedFormUids: {} };
  }

  const normalizedUserEmail = userEmail ? userEmail.trim().toLowerCase() : null;
  const token = await getToken();
  if (!token) {
    return { syncedCount: 0, savedFormUids: {} };
  }

  const remaining: PendingStudyFlowQuiz[] = [];
  const savedFormUids: Record<string, string> = {};
  let syncedCount = 0;

  for (const item of queue) {
    const targetEmail = item.targetEmail ? item.targetEmail.trim().toLowerCase() : null;
    if (targetEmail && normalizedUserEmail && targetEmail !== normalizedUserEmail) {
      remaining.push(item);
      continue;
    }

    try {
      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...item.formPayload,
          creatorEmail: normalizedUserEmail || targetEmail,
        }),
      });

      if (!res.ok) {
        remaining.push(item);
        continue;
      }

      const data = await res.json();
      const formUid: string | undefined = data?.form?.formUid;
      if (formUid) {
        savedFormUids[item.clientQuizId] = formUid;
        syncedCount += 1;

        if (item.attempt) {
          await fetch(`/api/forms/${encodeURIComponent(formUid)}/record-studyflow-attempt`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(item.attempt),
          }).catch(() => {});
        }
      } else {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  writePendingQueue(remaining);
  return { syncedCount, savedFormUids };
}
