import * as XLSX from 'xlsx';
import { auth } from './firebase.ts';

const STORAGE_KEY = 'formulierpro_static_store_v1';

interface StoredQuestion {
  id: number;
  formId: number;
  category: string;
  questionType: string;
  questionText: string;
  options: string; // JSON string
  correctAnswer: string;
  points: number;
  rubric: string;
  orderIndex: number;
}

interface StoredForm {
  id: number;
  formUid: string;
  creatorUid: string;
  title: string;
  description: string;
  mode: string;
  isExamSecure: number;
  securityPasscode: string;
  timerMinutes: number;
  shuffleQuestions: number;
  maxQuestionsTotal: number | null;
  categoryQuotas: string | null;
  allowReview: number;
  submissionPolicy: string;
  openAiKey: string | null;
  aiGradingEnabled: number;
  themeColor: string;
  createdAt: string;
  updatedAt: string;
}

interface StoredSubmission {
  id: number;
  formId: number;
  submissionUid: string;
  respondentEmail: string | null;
  respondentName: string | null;
  totalScore: number;
  maxScore: number;
  percentage: number;
  timeSpentSeconds: number;
  status: string;
  lockReason: string | null;
  isUnlockedByMaker: number;
  completedAt: string | null;
  createdAt: string;
}

interface StoredAnswer {
  id: number;
  submissionId: number;
  questionId: number;
  questionText: string;
  questionCategory: string;
  questionType: string;
  answerValue: string;
  isCorrect: number;
  scoreAwarded: number;
  maxPoints: number;
  aiFeedback: string;
  manualFeedback: string | null;
}

interface StaticStore {
  nextId: number;
  forms: StoredForm[];
  questions: StoredQuestion[];
  submissions: StoredSubmission[];
  answers: StoredAnswer[];
}

function loadStore(): StaticStore {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as StaticStore;
    }
  } catch {
    // Ignore parse errors
  }
  return {
    nextId: 1,
    forms: [],
    questions: [],
    submissions: [],
    answers: [],
  };
}

function saveStore(store: StaticStore) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.warn('Could not persist static store to localStorage:', err);
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function generateUid(prefix = 'form'): string {
  const randomStr = Math.random().toString(36).substring(2, 9);
  return `${prefix}-${Date.now().toString(36)}-${randomStr}`;
}

function getCurrentUserFromContext() {
  const current = auth.currentUser;
  if (!current) return null;
  return {
    uid: current.uid,
    email: current.email || `${current.uid}@guest.local`,
    name: current.displayName || current.email?.split('@')[0] || 'Gebruiker',
  };
}

function parseJsonBody(init?: RequestInit): any {
  if (!init?.body || typeof init.body !== 'string') return {};
  try {
    return JSON.parse(init.body);
  } catch {
    return {};
  }
}

function gradeOpenLocal(question: StoredQuestion, studentAnswer: string) {
  const maxPoints = question.points || 1;
  const trimmed = studentAnswer.trim();
  if (!trimmed) {
    return {
      scoreAwarded: 0,
      isCorrect: 0,
      feedback: 'Geen antwoord ingevuld.',
    };
  }

  const reference = `${question.rubric || ''} ${question.correctAnswer || ''}`.toLowerCase();
  const keywords = Array.from(
    new Set(
      reference
        .split(/[^a-zA-Z0-9àáâäèéêëìíîïòóôöùúûü]+/)
        .filter((w) => w.length >= 4)
    )
  );

  if (keywords.length === 0) {
    return {
      scoreAwarded: maxPoints,
      isCorrect: 1,
      feedback: 'Antwoord opgeslagen (statische browsermodus).',
    };
  }

  const lowerAns = trimmed.toLowerCase();
  const matched = keywords.filter((kw) => lowerAns.includes(kw));
  const ratio = matched.length / keywords.length;
  const scoreAwarded = Math.min(maxPoints, Math.round(ratio * maxPoints));
  const isCorrect = scoreAwarded >= Math.ceil(maxPoints * 0.5) ? 1 : 0;

  return {
    scoreAwarded,
    isCorrect,
    feedback:
      isCorrect === 1
        ? `Goed beantwoord op basis van kernbegrippen (${scoreAwarded}/${maxPoints} pt).`
        : `Gedeeltelijk of onvolledig beantwoord (${scoreAwarded}/${maxPoints} pt). Modelantwoord: ${question.correctAnswer || question.rubric}`,
  };
}

async function handleStaticApi(pathname: string, search: string, method: string, init?: RequestInit): Promise<Response> {
  const store = loadStore();
  const user = getCurrentUserFromContext();
  const body = parseJsonBody(init);

  // POST /api/auth/sync
  if (pathname === '/api/auth/sync' && method === 'POST') {
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);
    return jsonResponse({
      success: true,
      user: { uid: user.uid, email: user.email, name: body.name || user.name },
    });
  }

  // GET /api/forms
  if (pathname === '/api/forms' && method === 'GET') {
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);
    const list = store.forms
      .filter((f) => f.creatorUid === user.uid)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return jsonResponse(list);
  }

  // POST /api/forms
  if (pathname === '/api/forms' && method === 'POST') {
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);
    const formId = store.nextId++;
    const now = new Date().toISOString();
    const newForm: StoredForm = {
      id: formId,
      formUid: generateUid('form'),
      creatorUid: user.uid,
      title: body.title || 'Nieuw Formulier',
      description: body.description || '',
      mode: body.mode || 'exam',
      isExamSecure: body.isExamSecure ? 1 : 0,
      securityPasscode: body.securityPasscode || '1234',
      timerMinutes: Number(body.timerMinutes) || 0,
      shuffleQuestions: body.shuffleQuestions ? 1 : 0,
      maxQuestionsTotal: body.maxQuestionsTotal ? Number(body.maxQuestionsTotal) : null,
      categoryQuotas:
        typeof body.categoryQuotas === 'object' && body.categoryQuotas !== null
          ? JSON.stringify(body.categoryQuotas)
          : body.categoryQuotas || null,
      allowReview: body.allowReview ? 1 : 0,
      submissionPolicy: body.submissionPolicy || 'multiple_email',
      openAiKey: body.openAiKey || null,
      aiGradingEnabled: body.aiGradingEnabled ? 1 : 0,
      themeColor: body.themeColor || '#4f46e5',
      createdAt: now,
      updatedAt: now,
    };
    store.forms.push(newForm);

    if (Array.isArray(body.questions)) {
      body.questions.forEach((q: any, idx: number) => {
        store.questions.push({
          id: store.nextId++,
          formId,
          category: q.category || 'Algemeen',
          questionType: q.questionType || 'multiple_choice',
          questionText: q.questionText || '',
          options: Array.isArray(q.options) ? JSON.stringify(q.options) : q.options || '[]',
          correctAnswer: q.correctAnswer || '',
          points: Number(q.points) || 1,
          rubric: q.rubric || '',
          orderIndex: idx,
        });
      });
    }

    saveStore(store);
    return jsonResponse({ success: true, form: newForm });
  }

  // Match /api/forms/:formUid
  const formMatch = pathname.match(/^\/api\/forms\/([^/]+)$/);
  if (formMatch) {
    const formUid = decodeURIComponent(formMatch[1]);
    const form = store.forms.find((f) => f.formUid === formUid);
    if (!form) return jsonResponse({ error: 'Formulier niet gevonden.' }, 404);

    if (method === 'GET') {
      const isCreator = Boolean(user && user.uid === form.creatorUid);
      const qList = store.questions
        .filter((q) => q.formId === form.id)
        .sort((a, b) => a.orderIndex - b.orderIndex);

      if (!isCreator) {
        return jsonResponse({
          ...form,
          securityPasscode: undefined,
          openAiKey: undefined,
          questions: qList.map((q) => ({
            id: q.id,
            category: q.category,
            questionType: q.questionType,
            questionText: q.questionText,
            options: JSON.parse(q.options || '[]'),
            points: q.points,
            orderIndex: q.orderIndex,
          })),
          isCreator: false,
        });
      }

      return jsonResponse({
        ...form,
        questions: qList.map((q) => ({
          ...q,
          options: JSON.parse(q.options || '[]'),
        })),
        isCreator: true,
      });
    }

    if (method === 'PUT') {
      if (!user || user.uid !== form.creatorUid) {
        return jsonResponse({ error: 'Geen toegang.' }, 403);
      }
      form.title = body.title ?? form.title;
      form.description = body.description ?? form.description;
      form.mode = body.mode ?? form.mode;
      form.isExamSecure = body.isExamSecure ? 1 : 0;
      form.securityPasscode = body.securityPasscode || form.securityPasscode;
      form.timerMinutes = Number(body.timerMinutes) || 0;
      form.shuffleQuestions = body.shuffleQuestions ? 1 : 0;
      form.maxQuestionsTotal = body.maxQuestionsTotal ? Number(body.maxQuestionsTotal) : null;
      form.categoryQuotas =
        typeof body.categoryQuotas === 'object' && body.categoryQuotas !== null
          ? JSON.stringify(body.categoryQuotas)
          : body.categoryQuotas || null;
      form.allowReview = body.allowReview ? 1 : 0;
      form.submissionPolicy = body.submissionPolicy || form.submissionPolicy;
      form.aiGradingEnabled = body.aiGradingEnabled ? 1 : 0;
      form.themeColor = body.themeColor || form.themeColor;
      form.updatedAt = new Date().toISOString();

      if (Array.isArray(body.questions)) {
        store.questions = store.questions.filter((q) => q.formId !== form.id);
        body.questions.forEach((q: any, idx: number) => {
          store.questions.push({
            id: store.nextId++,
            formId: form.id,
            category: q.category || 'Algemeen',
            questionType: q.questionType || 'multiple_choice',
            questionText: q.questionText || '',
            options: Array.isArray(q.options) ? JSON.stringify(q.options) : q.options || '[]',
            correctAnswer: q.correctAnswer || '',
            points: Number(q.points) || 1,
            rubric: q.rubric || '',
            orderIndex: idx,
          });
        });
      }

      saveStore(store);
      return jsonResponse({ success: true, form });
    }

    if (method === 'DELETE') {
      if (!user || user.uid !== form.creatorUid) {
        return jsonResponse({ error: 'Geen toegang.' }, 403);
      }
      const subIds = store.submissions.filter((s) => s.formId === form.id).map((s) => s.id);
      store.answers = store.answers.filter((a) => !subIds.includes(a.submissionId));
      store.submissions = store.submissions.filter((s) => s.formId !== form.id);
      store.questions = store.questions.filter((q) => q.formId !== form.id);
      store.forms = store.forms.filter((f) => f.id !== form.id);
      saveStore(store);
      return jsonResponse({ success: true });
    }
  }

  // POST /api/forms/:formUid/start
  const startMatch = pathname.match(/^\/api\/forms\/([^/]+)\/start$/);
  if (startMatch && method === 'POST') {
    const formUid = decodeURIComponent(startMatch[1]);
    const form = store.forms.find((f) => f.formUid === formUid);
    if (!form) return jsonResponse({ error: 'Formulier niet gevonden.' }, 404);

    const email = body.respondentEmail ? String(body.respondentEmail).toLowerCase().trim() : null;
    if (form.submissionPolicy !== 'anonymous' && (!email || !email.includes('@'))) {
      return jsonResponse({ error: 'Vul een geldig e-mailadres in om te starten.' }, 400);
    }
    if (form.submissionPolicy === 'single_email' && email) {
      const existing = store.submissions.find(
        (s) => s.formId === form.id && s.respondentEmail === email && s.status === 'submitted'
      );
      if (existing) {
        return jsonResponse({ error: 'U hebt dit formulier al een keer ingevuld.' }, 400);
      }
    }

    let selected = store.questions
      .filter((q) => q.formId === form.id)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    if (form.shuffleQuestions === 1) {
      selected = [...selected].sort(() => Math.random() - 0.5);
    }
    if (form.maxQuestionsTotal && form.maxQuestionsTotal > 0) {
      selected = selected.slice(0, form.maxQuestionsTotal);
    }

    const submissionUid = generateUid('sub');
    const sub: StoredSubmission = {
      id: store.nextId++,
      formId: form.id,
      submissionUid,
      respondentEmail: form.submissionPolicy === 'anonymous' ? null : email,
      respondentName: body.respondentName || (email ? email.split('@')[0] : 'Anoniem'),
      totalScore: 0,
      maxScore: 0,
      percentage: 0,
      timeSpentSeconds: 0,
      status: 'in_progress',
      lockReason: null,
      isUnlockedByMaker: 0,
      completedAt: null,
      createdAt: new Date().toISOString(),
    };
    store.submissions.push(sub);
    saveStore(store);

    return jsonResponse({
      submissionUid,
      formTitle: form.title,
      formDescription: form.description,
      mode: form.mode,
      isExamSecure: form.isExamSecure === 1,
      timerMinutes: form.timerMinutes,
      themeColor: form.themeColor,
      allowReview: form.allowReview === 1,
      questions: selected.map((q) => ({
        id: q.id,
        category: q.category,
        questionType: q.questionType,
        questionText: q.questionText,
        options: JSON.parse(q.options || '[]'),
        points: q.points,
      })),
    });
  }

  // Submission routes
  const subLockMatch = pathname.match(/^\/api\/submissions\/([^/]+)\/lock$/);
  if (subLockMatch && method === 'POST') {
    const sub = store.submissions.find((s) => s.submissionUid === decodeURIComponent(subLockMatch[1]));
    if (!sub) return jsonResponse({ error: 'Sessie niet gevonden.' }, 404);
    if (sub.status !== 'submitted') {
      sub.status = 'locked';
      sub.lockReason = body.reason || 'Volledig scherm verlaten of tabblad gewisseld.';
      saveStore(store);
    }
    return jsonResponse({ success: true, locked: true, reason: sub.lockReason });
  }

  const subUnlockMatch = pathname.match(/^\/api\/submissions\/([^/]+)\/unlock$/);
  if (subUnlockMatch && method === 'POST') {
    const sub = store.submissions.find((s) => s.submissionUid === decodeURIComponent(subUnlockMatch[1]));
    if (!sub) return jsonResponse({ error: 'Sessie niet gevonden.' }, 404);
    const form = store.forms.find((f) => f.id === sub.formId);
    if (!form) return jsonResponse({ error: 'Formulier niet gevonden.' }, 404);
    const isCreator = Boolean(user && user.uid === form.creatorUid);
    const isPasscodeValid = body.passcode && String(body.passcode).trim() === form.securityPasscode.trim();
    if (!isCreator && !isPasscodeValid) {
      return jsonResponse({ error: 'Onjuiste docenten-ontgrendelcode.' }, 403);
    }
    sub.status = 'unlocked';
    sub.isUnlockedByMaker = 1;
    saveStore(store);
    return jsonResponse({ success: true, message: 'Toets succesvol ontgrendeld.' });
  }

  const subStatusMatch = pathname.match(/^\/api\/submissions\/([^/]+)\/status$/);
  if (subStatusMatch && method === 'GET') {
    const sub = store.submissions.find((s) => s.submissionUid === decodeURIComponent(subStatusMatch[1]));
    if (!sub) return jsonResponse({ error: 'Sessie niet gevonden.' }, 404);
    return jsonResponse({
      submissionUid: sub.submissionUid,
      status: sub.status,
      isUnlockedByMaker: sub.isUnlockedByMaker === 1,
      lockReason: sub.lockReason,
    });
  }

  const subDeleteMatch = pathname.match(/^\/api\/submissions\/([^/]+)$/);
  if (subDeleteMatch && method === 'DELETE') {
    const subUid = decodeURIComponent(subDeleteMatch[1]);
    const sub = store.submissions.find((s) => s.submissionUid === subUid);
    if (sub) {
      store.answers = store.answers.filter((a) => a.submissionId !== sub.id);
      store.submissions = store.submissions.filter((s) => s.id !== sub.id);
      saveStore(store);
    }
    return jsonResponse({ success: true });
  }

  const subSubmitMatch = pathname.match(/^\/api\/submissions\/([^/]+)\/submit$/);
  if (subSubmitMatch && method === 'POST') {
    const sub = store.submissions.find((s) => s.submissionUid === decodeURIComponent(subSubmitMatch[1]));
    if (!sub) return jsonResponse({ error: 'Sessie niet gevonden.' }, 404);
    const form = store.forms.find((f) => f.id === sub.formId);
    if (!form) return jsonResponse({ error: 'Formulier niet gevonden.' }, 404);

    const qMap = new Map(store.questions.filter((q) => q.formId === form.id).map((q) => [q.id, q]));
    let totalScore = 0;
    let maxScore = 0;
    const answerRecords: StoredAnswer[] = [];

    for (const item of body.answers || []) {
      const q = qMap.get(item.questionId);
      if (!q) continue;
      const qPoints = q.points || 1;
      maxScore += qPoints;
      const studentAns = String(item.answerValue || '').trim();
      let isCorrect = 0;
      let scoreAwarded = 0;
      let feedback = '';

      if (q.questionType === 'multiple_choice') {
        if (studentAns && studentAns.toLowerCase() === (q.correctAnswer || '').trim().toLowerCase()) {
          isCorrect = 1;
          scoreAwarded = qPoints;
          feedback = 'Correct beantwoord!';
        } else {
          feedback = q.rubric ? `Juiste antwoord: ${q.correctAnswer}. Toelichting: ${q.rubric}` : `Juiste antwoord: ${q.correctAnswer}`;
        }
      } else if (q.questionType === 'open') {
        const res = gradeOpenLocal(q, studentAns);
        isCorrect = res.isCorrect;
        scoreAwarded = res.scoreAwarded;
        feedback = res.feedback;
      } else if (q.questionType === 'checkbox') {
        const correctList = (q.correctAnswer || '').split(';').map((s) => s.trim().toLowerCase()).filter(Boolean);
        const studentList = studentAns.split(';').map((s) => s.trim().toLowerCase()).filter(Boolean);
        const matches = studentList.filter((s) => correctList.includes(s));
        if (matches.length === correctList.length && studentList.length === correctList.length) {
          isCorrect = 1;
          scoreAwarded = qPoints;
          feedback = 'Volledig correct!';
        } else if (matches.length > 0) {
          scoreAwarded = Math.round((matches.length / Math.max(1, correctList.length)) * qPoints);
          feedback = `Gedeeltelijk juist (${matches.length}/${correctList.length} opties).`;
        } else {
          feedback = `Juiste opties waren: ${q.correctAnswer}`;
        }
      } else {
        isCorrect = 1;
        scoreAwarded = qPoints;
        feedback = 'Antwoord opgeslagen.';
      }

      totalScore += scoreAwarded;
      const rec: StoredAnswer = {
        id: store.nextId++,
        submissionId: sub.id,
        questionId: q.id,
        questionText: q.questionText,
        questionCategory: q.category,
        questionType: q.questionType,
        answerValue: studentAns,
        isCorrect,
        scoreAwarded,
        maxPoints: qPoints,
        aiFeedback: feedback,
        manualFeedback: null,
      };
      answerRecords.push(rec);
    }

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 100;
    store.answers.push(...answerRecords);
    sub.totalScore = totalScore;
    sub.maxScore = maxScore;
    sub.percentage = percentage;
    sub.timeSpentSeconds = Number(body.timeSpentSeconds) || 0;
    sub.status = 'submitted';
    sub.completedAt = new Date().toISOString();
    saveStore(store);

    return jsonResponse({
      success: true,
      submissionUid: sub.submissionUid,
      totalScore,
      maxScore,
      percentage,
      timeSpentSeconds: sub.timeSpentSeconds,
      allowReview: form.allowReview === 1,
      answers: form.allowReview === 1 ? answerRecords : undefined,
    });
  }

  // Analytics
  const analyticsMatch = pathname.match(/^\/api\/forms\/([^/]+)\/analytics$/);
  if (analyticsMatch && method === 'GET') {
    const form = store.forms.find((f) => f.formUid === decodeURIComponent(analyticsMatch[1]));
    if (!form) return jsonResponse({ error: 'Formulier niet gevonden.' }, 404);
    if (!user || user.uid !== form.creatorUid) {
      return jsonResponse({ error: 'Geen toegang tot deze analyses.' }, 403);
    }

    const formQuestions = store.questions.filter((q) => q.formId === form.id);
    const formSubs = store.submissions
      .filter((s) => s.formId === form.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const submitted = formSubs.filter((s) => s.status === 'submitted');
    const totalSubmissions = submitted.length;
    const avgPercentage = totalSubmissions ? Math.round(submitted.reduce((a, s) => a + s.percentage, 0) / totalSubmissions) : 0;
    const avgTimeSeconds = totalSubmissions ? Math.round(submitted.reduce((a, s) => a + s.timeSpentSeconds, 0) / totalSubmissions) : 0;
    const passCount = submitted.filter((s) => s.percentage >= 55).length;

    const subIds = submitted.map((s) => s.id);
    const ansList = store.answers.filter((a) => subIds.includes(a.submissionId));
    const categoryStats: Record<string, { awarded: number; max: number; count: number }> = {};
    const qStats: Record<number, { correct: number; total: number; score: number }> = {};

    for (const a of ansList) {
      const cat = a.questionCategory || 'Algemeen';
      if (!categoryStats[cat]) categoryStats[cat] = { awarded: 0, max: 0, count: 0 };
      categoryStats[cat].awarded += a.scoreAwarded;
      categoryStats[cat].max += a.maxPoints;
      categoryStats[cat].count += 1;
      if (!qStats[a.questionId]) qStats[a.questionId] = { correct: 0, total: 0, score: 0 };
      if (a.isCorrect === 1) qStats[a.questionId].correct += 1;
      qStats[a.questionId].total += 1;
      qStats[a.questionId].score += a.scoreAwarded;
    }

    const scoreDistribution = [
      { range: '0-20%', count: submitted.filter((s) => s.percentage <= 20).length },
      { range: '21-40%', count: submitted.filter((s) => s.percentage > 20 && s.percentage <= 40).length },
      { range: '41-60%', count: submitted.filter((s) => s.percentage > 40 && s.percentage <= 60).length },
      { range: '61-80%', count: submitted.filter((s) => s.percentage > 60 && s.percentage <= 80).length },
      { range: '81-100%', count: submitted.filter((s) => s.percentage > 80).length },
    ];

    return jsonResponse({
      form,
      totalSubmissions,
      avgPercentage,
      avgTimeSeconds,
      passRate: totalSubmissions ? Math.round((passCount / totalSubmissions) * 100) : 0,
      scoreDistribution,
      categoryBreakdown: Object.entries(categoryStats).map(([category, s]) => ({
        category,
        percentage: s.max > 0 ? Math.round((s.awarded / s.max) * 100) : 0,
        attempts: s.count,
      })),
      questionAnalysis: formQuestions.map((q) => {
        const st = qStats[q.id];
        return {
          id: q.id,
          category: q.category,
          questionType: q.questionType,
          questionText: q.questionText,
          points: q.points,
          answeredCount: st ? st.total : 0,
          accuracyRate: st && st.total > 0 ? Math.round((st.correct / st.total) * 100) : 0,
          averagePoints: st && st.total > 0 ? Number((st.score / st.total).toFixed(1)) : 0,
        };
      }),
      submissions: formSubs,
    });
  }

  // Export
  const exportMatch = pathname.match(/^\/api\/forms\/([^/]+)\/export\/(excel|csv)$/);
  if (exportMatch && method === 'GET') {
    const form = store.forms.find((f) => f.formUid === decodeURIComponent(exportMatch[1]));
    if (!form) return jsonResponse({ error: 'Formulier niet gevonden.' }, 404);
    const formSubs = store.submissions.filter((s) => s.formId === form.id);
    const rows = formSubs.map((s, index) => ({
      Nr: index + 1,
      Datum: new Date(s.createdAt).toLocaleString('nl-NL'),
      'Respondent Naam': s.respondentName || 'Anoniem',
      'E-mail': s.respondentEmail || 'N.v.t.',
      Score: `${s.totalScore} / ${s.maxScore}`,
      Percentage: `${s.percentage}%`,
      'Tijd (sec)': s.timeSpentSeconds,
      Status: s.status,
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Resultaten');

    if (exportMatch[2] === 'csv') {
      const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
      return new Response(csvOutput, {
        status: 200,
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      });
    }
    const arrayBuf = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    return new Response(arrayBuf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
  }

  // Respondent progress
  if (pathname === '/api/respondent/progress' && method === 'GET') {
    const params = new URLSearchParams(search);
    const email = params.get('email')?.toLowerCase().trim();
    if (!email) return jsonResponse({ history: [], categoryMastery: [] });

    const formMap = new Map(store.forms.map((f) => [f.id, f]));
    const studentSubs = store.submissions
      .filter((s) => s.respondentEmail === email && s.status === 'submitted')
      .map((s) => ({
        ...s,
        formTitle: formMap.get(s.formId)?.title || 'Toets',
      }));
    const subIds = studentSubs.map((s) => s.id);
    const ans = store.answers.filter((a) => subIds.includes(a.submissionId));
    const catStats: Record<string, { pts: number; max: number }> = {};
    for (const a of ans) {
      const cat = a.questionCategory || 'Algemeen';
      if (!catStats[cat]) catStats[cat] = { pts: 0, max: 0 };
      catStats[cat].pts += a.scoreAwarded;
      catStats[cat].max += a.maxPoints;
    }

    return jsonResponse({
      history: studentSubs,
      categoryMastery: Object.entries(catStats).map(([category, s]) => ({
        category,
        percentage: s.max > 0 ? Math.round((s.pts / s.max) * 100) : 0,
        totalAnswered: s.max,
      })),
    });
  }

  // AI question generation is server-only
  if (pathname === '/api/ai/generate-questions') {
    return jsonResponse(
      {
        error:
          'AI-vragengeneratie vereist de Node.js backendserver. Op GitHub Pages kunt u vragen handmatig of via CSV toevoegen.',
      },
      501
    );
  }

  return jsonResponse({ error: 'Endpoint niet beschikbaar in statische modus.' }, 404);
}

let backendAvailablePromise: Promise<boolean> | null = null;

function checkBackendAvailable(originalFetch: typeof window.fetch): Promise<boolean> {
  if (!backendAvailablePromise) {
    backendAvailablePromise = originalFetch('/api/health', { method: 'GET' })
      .then((res) => {
        const ct = res.headers.get('content-type') || '';
        return res.ok && ct.includes('application/json');
      })
      .catch(() => false);
  }
  return backendAvailablePromise;
}

export function installStaticApiBridge() {
  if (typeof window === 'undefined' || (window as any).__staticApiBridgeInstalled) {
    return;
  }
  (window as any).__staticApiBridgeInstalled = true;

  const ownDesc = Object.getOwnPropertyDescriptor(window, 'fetch');
  if (ownDesc && ((ownDesc.get && !ownDesc.set) || (!ownDesc.writable && !ownDesc.configurable))) {
    // Host environment locks or proxies window.fetch (e.g. AI Studio preview); skip override
    return;
  }

  const originalFetch = window.fetch.bind(window);
  const wrappedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();

    let urlObj: URL;
    try {
      urlObj = new URL(rawUrl, window.location.href);
    } catch {
      return originalFetch(input, init);
    }

    if (urlObj.origin !== window.location.origin) {
      return originalFetch(input, init);
    }

    // Match /api/... regardless of GitHub Pages subpath if ever relative, or root /api/...
    const apiIdx = urlObj.pathname.indexOf('/api/');
    if (apiIdx === -1) {
      return originalFetch(input, init);
    }

    const apiPath = urlObj.pathname.slice(apiIdx);
    if (apiPath === '/api/health') {
      return originalFetch(input, init);
    }

    const hasBackend = await checkBackendAvailable(originalFetch);
    if (hasBackend) {
      return originalFetch(input, init);
    }

    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    return handleStaticApi(apiPath, urlObj.search, method, init);
  };

  try {
    Object.defineProperty(window, 'fetch', {
      value: wrappedFetch,
      configurable: true,
      writable: true,
      enumerable: true,
    });
  } catch {
    // Fallback ignored if host prevents redefining window.fetch
  }
}
