import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import * as XLSX from 'xlsx';
import { db } from './src/db/index.ts';
import { forms, questions, submissions, submissionAnswers, users } from './src/db/schema.ts';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { requireAuth, optionalAuth, AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser } from './src/db/users.ts';
import { gradeOpenQuestion } from './src/services/ai-grader.ts';
import { generateQuestionsWithAI, generateStudyFlowQuiz } from './src/services/ai-generator.ts';

dotenv.config();

const app = express();
const port = 3000;

app.use(express.json({ limit: '10mb' }));

// Helper: generate random slug/uid
function generateUid(prefix = 'form'): string {
  const randomStr = Math.random().toString(36).substring(2, 9);
  return `${prefix}-${Date.now().toString(36)}-${randomStr}`;
}

// 1. Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 2. Auth sync route
app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.uid;
    const email = req.user!.email || `${uid}@guest.local`;
    const name = req.body.name || req.user!.name || email.split('@')[0];
    const user = await getOrCreateUser(uid, email, name);
    res.json({ success: true, user });
  } catch (error: any) {
    console.error('Failed to sync user:', error);
    res.status(500).json({ error: error.message || 'Kon gebruiker niet synchroniseren.' });
  }
});

// 3. Maker Forms Management
app.get('/api/forms', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.uid;
    const userForms = await db.select().from(forms).where(eq(forms.creatorUid, uid)).orderBy(desc(forms.createdAt));
    res.json(userForms);
  } catch (error: any) {
    console.error('Error fetching forms:', error);
    res.status(500).json({ error: 'Kon formulieren niet ophalen.' });
  }
});

// Get single form (for taking or editing)
app.get('/api/forms/:formUid', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { formUid } = req.params;
    const formList = await db.select().from(forms).where(eq(forms.formUid, formUid)).limit(1);
    if (!formList.length) {
      return res.status(404).json({ error: 'Formulier niet gevonden.' });
    }

    const form = formList[0];
    const isCreator = req.user && req.user.uid === form.creatorUid;

    const allQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.formId, form.id))
      .orderBy(questions.orderIndex);

    // If respondent is taking it, sanitize secret fields like securityPasscode and correctAnswer
    if (!isCreator) {
      const sanitizedQuestions = allQuestions.map((q) => {
        let optionsArr: string[] = [];
        try {
          if (q.options) optionsArr = JSON.parse(q.options);
        } catch {
          optionsArr = [];
        }
        return {
          id: q.id,
          category: q.category,
          questionType: q.questionType,
          questionText: q.questionText,
          options: optionsArr,
          points: q.points,
          orderIndex: q.orderIndex,
        };
      });

      return res.json({
        ...form,
        securityPasscode: undefined,
        openAiKey: undefined,
        questions: sanitizedQuestions,
        isCreator: false,
      });
    }

    // For creator, return complete form with questions
    const formattedQuestions = allQuestions.map((q) => {
      let optionsArr: string[] = [];
      try {
        if (q.options) optionsArr = JSON.parse(q.options);
      } catch {
        optionsArr = [];
      }
      return {
        ...q,
        options: optionsArr,
      };
    });

    res.json({
      ...form,
      questions: formattedQuestions,
      isCreator: true,
    });
  } catch (error: any) {
    console.error('Error fetching form:', error);
    res.status(500).json({ error: 'Fout bij het ophalen van het formulier.' });
  }
});

// Create new form
app.post('/api/forms', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.uid;
    const {
      title,
      description,
      mode = 'exam',
      isExamSecure = 1,
      securityPasscode = '1234',
      timerMinutes = 0,
      shuffleQuestions = 1,
      maxQuestionsTotal = null,
      categoryQuotas = null,
      allowReview = 1,
      submissionPolicy = 'multiple_email',
      openAiKey = null,
      aiGradingEnabled = 1,
      themeColor = '#4f46e5',
      questions: newQuestions = [],
    } = req.body;

    const formUid = generateUid('form');

    const [newForm] = await db
      .insert(forms)
      .values({
        formUid,
        creatorUid: uid,
        title: title || 'Nieuw Formulier',
        description: description || '',
        mode,
        isExamSecure: isExamSecure ? 1 : 0,
        securityPasscode: securityPasscode || '1234',
        timerMinutes: Number(timerMinutes) || 0,
        shuffleQuestions: shuffleQuestions ? 1 : 0,
        maxQuestionsTotal: maxQuestionsTotal ? Number(maxQuestionsTotal) : null,
        categoryQuotas: typeof categoryQuotas === 'object' ? JSON.stringify(categoryQuotas) : categoryQuotas,
        allowReview: allowReview ? 1 : 0,
        submissionPolicy,
        openAiKey: openAiKey || null,
        aiGradingEnabled: aiGradingEnabled ? 1 : 0,
        themeColor,
      })
      .returning();

    if (Array.isArray(newQuestions) && newQuestions.length > 0) {
      const qValues = newQuestions.map((q: any, idx: number) => ({
        formId: newForm.id,
        category: q.category || 'Algemeen',
        questionType: q.questionType || 'multiple_choice',
        questionText: q.questionText || '',
        options: Array.isArray(q.options) ? JSON.stringify(q.options) : q.options || '[]',
        correctAnswer: q.correctAnswer || '',
        points: Number(q.points) || 1,
        rubric: q.rubric || '',
        orderIndex: idx,
      }));

      await db.insert(questions).values(qValues);
    }

    res.json({ success: true, form: newForm });
  } catch (error: any) {
    console.error('Error creating form:', error);
    res.status(500).json({ error: error.message || 'Kon formulier niet aanmaken.' });
  }
});

// Update form
app.put('/api/forms/:formUid', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.uid;
    const { formUid } = req.params;

    const existing = await db.select().from(forms).where(eq(forms.formUid, formUid)).limit(1);
    if (!existing.length) {
      return res.status(404).json({ error: 'Formulier niet gevonden.' });
    }
    if (existing[0].creatorUid !== uid) {
      return res.status(403).json({ error: 'Geen toestemming om dit formulier te bewerken.' });
    }

    const {
      title,
      description,
      mode,
      isExamSecure,
      securityPasscode,
      timerMinutes,
      shuffleQuestions,
      maxQuestionsTotal,
      categoryQuotas,
      allowReview,
      submissionPolicy,
      openAiKey,
      aiGradingEnabled,
      themeColor,
      questions: updatedQuestions,
    } = req.body;

    const [updatedForm] = await db
      .update(forms)
      .set({
        title,
        description,
        mode,
        isExamSecure: isExamSecure ? 1 : 0,
        securityPasscode: securityPasscode || '1234',
        timerMinutes: Number(timerMinutes) || 0,
        shuffleQuestions: shuffleQuestions ? 1 : 0,
        maxQuestionsTotal: maxQuestionsTotal ? Number(maxQuestionsTotal) : null,
        categoryQuotas: typeof categoryQuotas === 'object' ? JSON.stringify(categoryQuotas) : categoryQuotas,
        allowReview: allowReview ? 1 : 0,
        submissionPolicy,
        openAiKey,
        aiGradingEnabled: aiGradingEnabled ? 1 : 0,
        themeColor,
        updatedAt: new Date(),
      })
      .where(eq(forms.id, existing[0].id))
      .returning();

    if (Array.isArray(updatedQuestions)) {
      // Delete old questions and re-insert
      await db.delete(questions).where(eq(questions.formId, existing[0].id));

      if (updatedQuestions.length > 0) {
        const qValues = updatedQuestions.map((q: any, idx: number) => ({
          formId: existing[0].id,
          category: q.category || 'Algemeen',
          questionType: q.questionType || 'multiple_choice',
          questionText: q.questionText || '',
          options: Array.isArray(q.options) ? JSON.stringify(q.options) : q.options || '[]',
          correctAnswer: q.correctAnswer || '',
          points: Number(q.points) || 1,
          rubric: q.rubric || '',
          orderIndex: idx,
        }));
        await db.insert(questions).values(qValues);
      }
    }

    res.json({ success: true, form: updatedForm });
  } catch (error: any) {
    console.error('Error updating form:', error);
    res.status(500).json({ error: error.message || 'Kon formulier niet bijwerken.' });
  }
});

// Delete form
app.delete('/api/forms/:formUid', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.uid;
    const { formUid } = req.params;

    const existing = await db.select().from(forms).where(eq(forms.formUid, formUid)).limit(1);
    if (!existing.length) {
      return res.status(404).json({ error: 'Formulier niet gevonden.' });
    }
    if (existing[0].creatorUid !== uid) {
      return res.status(403).json({ error: 'Geen toestemming om dit formulier te verwijderen.' });
    }

    const formId = existing[0].id;

    // Delete submission answers, submissions, questions, then form
    const subs = await db.select({ id: submissions.id }).from(submissions).where(eq(submissions.formId, formId));
    const subIds = subs.map((s) => s.id);
    if (subIds.length > 0) {
      await db.delete(submissionAnswers).where(inArray(submissionAnswers.submissionId, subIds));
      await db.delete(submissions).where(eq(submissions.formId, formId));
    }
    await db.delete(questions).where(eq(questions.formId, formId));
    await db.delete(forms).where(eq(forms.id, formId));

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting form:', error);
    res.status(500).json({ error: error.message || 'Kon formulier niet verwijderen.' });
  }
});

// 4. AI Question Generation & Key Testing
app.post('/api/ai/generate-questions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { prompt, count = 5, openAiKey } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Voer een onderwerp of instructie in.' });
    }

    const generated = await generateQuestionsWithAI(prompt, Number(count) || 5, openAiKey);
    res.json({ success: true, questions: generated });
  } catch (error: any) {
    console.error('AI Question Gen error:', error);
    res.status(500).json({ error: error.message || 'Fout bij genereren van vragen.' });
  }
});

// 4b. StudyFlow iframe quiz generation (uses Gemini with supplied source text)
app.post('/api/studyflow/generate', async (req: Request, res: Response) => {
  try {
    const rawVak = typeof req.body?.vak === 'string' ? req.body.vak.trim() : 'Algemeen';
    const rawTitel = typeof req.body?.titel === 'string' ? req.body.titel.trim() : 'Lesstof';
    const rawTekst = typeof req.body?.tekst === 'string' ? req.body.tekst.trim() : '';

    if (!rawTekst) {
      return res.status(400).json({ error: 'Er is geen lesstof ontvangen vanuit StudyFlow.' });
    }

    const allowedCounts = [5, 10, 15] as const;
    const rawCount = Number(req.body?.count);
    const count: 5 | 10 | 15 = allowedCounts.includes(rawCount as 5 | 10 | 15)
      ? (rawCount as 5 | 10 | 15)
      : 5;

    const rawType = req.body?.questionType;
    const questionType: 'meerkeuze' | 'open' | 'gemengd' =
      rawType === 'meerkeuze' || rawType === 'open' || rawType === 'gemengd'
        ? rawType
        : 'gemengd';

    const rawDifficulty = req.body?.difficulty;
    const difficulty: 'makkelijk' | 'gemiddeld' | 'moeilijk' =
      rawDifficulty === 'makkelijk' || rawDifficulty === 'gemiddeld' || rawDifficulty === 'moeilijk'
        ? rawDifficulty
        : 'gemiddeld';

    const generated = await generateStudyFlowQuiz({
      vak: rawVak.slice(0, 120),
      titel: rawTitel.slice(0, 200),
      tekst: rawTekst.slice(0, 40000),
      count,
      questionType,
      difficulty,
    });

    const formatted = generated.map((q, idx) => ({
      id: idx + 1,
      ...q,
    }));

    res.json({ success: true, questions: formatted });
  } catch (error: any) {
    console.error('StudyFlow AI generation error:', error);
    res.status(500).json({ error: error.message || 'Kon geen toets genereren uit de lesstof.' });
  }
});

// 4c. StudyFlow iframe quiz grading (uses Gemini for open questions)
app.post('/api/studyflow/grade', async (req: Request, res: Response) => {
  try {
    const questionsList = Array.isArray(req.body?.questions) ? req.body.questions.slice(0, 50) : [];
    const answersMap: Record<string, string> =
      req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};

    if (questionsList.length === 0) {
      return res.status(400).json({ error: 'Geen vragen om na te kijken.' });
    }

    let totalScore = 0;
    let maxScore = 0;
    const vragen: Array<{
      vraag: string;
      gegevenAntwoord: string;
      juistAntwoord: string;
      goed: boolean;
    }> = [];
    const detailedAnswers: Array<{
      questionId: number;
      questionText: string;
      questionCategory: string;
      questionType: string;
      answerValue: string;
      correctAnswer: string;
      isCorrect: number;
      scoreAwarded: number;
      maxPoints: number;
      aiFeedback: string;
    }> = [];

    for (let i = 0; i < questionsList.length; i++) {
      const q = questionsList[i];
      const qId = Number(q?.id ?? i + 1);
      const qText = String(q?.questionText || '');
      const qType = q?.questionType === 'open' ? 'open' : 'multiple_choice';
      const qCategory = String(q?.category || 'Algemeen');
      const qPoints = Math.max(1, Number(q?.points) || 1);
      const correctAns = String(q?.correctAnswer || '');
      const rubric = String(q?.rubric || correctAns);
      const studentAns = String(answersMap[String(qId)] || '').trim();

      maxScore += qPoints;

      let scoreAwarded = 0;
      let isCorrect = false;
      let feedback = '';

      if (qType === 'multiple_choice') {
        if (studentAns && studentAns.toLowerCase() === correctAns.trim().toLowerCase()) {
          scoreAwarded = qPoints;
          isCorrect = true;
          feedback = rubric ? `Correct! ${rubric}` : 'Correct beantwoord!';
        } else {
          scoreAwarded = 0;
          isCorrect = false;
          feedback = rubric
            ? `Juiste antwoord: ${correctAns}. Toelichting: ${rubric}`
            : `Juiste antwoord: ${correctAns}`;
        }
      } else {
        const grading = await gradeOpenQuestion({
          questionText: qText,
          category: qCategory,
          rubric,
          studentAnswer: studentAns,
          maxPoints: qPoints,
        });
        scoreAwarded = grading.scoreAwarded;
        isCorrect = grading.isCorrect;
        feedback = grading.feedback;
      }

      totalScore += scoreAwarded;

      vragen.push({
        vraag: qText,
        gegevenAntwoord: studentAns,
        juistAntwoord: correctAns,
        goed: isCorrect,
      });

      detailedAnswers.push({
        questionId: qId,
        questionText: qText,
        questionCategory: qCategory,
        questionType: qType,
        answerValue: studentAns,
        correctAnswer: correctAns,
        isCorrect: isCorrect ? 1 : 0,
        scoreAwarded,
        maxPoints: qPoints,
        aiFeedback: feedback,
      });
    }

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 100;

    res.json({
      success: true,
      totalScore,
      maxScore,
      percentage,
      vragen,
      answers: detailedAnswers,
    });
  } catch (error: any) {
    console.error('StudyFlow grading error:', error);
    res.status(500).json({ error: error.message || 'Fout bij nakijken van de toets.' });
  }
});

// 5. Test Session & Submission Handling
app.post('/api/forms/:formUid/start', async (req: Request, res: Response) => {
  try {
    const { formUid } = req.params;
    const { respondentEmail, respondentName } = req.body;

    const formList = await db.select().from(forms).where(eq(forms.formUid, formUid)).limit(1);
    if (!formList.length) {
      return res.status(404).json({ error: 'Formulier niet gevonden.' });
    }
    const form = formList[0];

    // Check submission policy
    if (form.submissionPolicy === 'single_email') {
      if (!respondentEmail || !respondentEmail.includes('@')) {
        return res.status(400).json({ error: 'Een geldig e-mailadres is verplicht voor deze toets.' });
      }

      const existingSubs = await db
        .select()
        .from(submissions)
        .where(
          and(
            eq(submissions.formId, form.id),
            eq(submissions.respondentEmail, respondentEmail.toLowerCase().trim()),
            eq(submissions.status, 'submitted')
          )
        );

      if (existingSubs.length > 0) {
        return res.status(403).json({
          error: 'U heeft deze vragenlijst/toets al eerder ingevuld. Meerdere pogingen zijn niet toegestaan.',
          alreadySubmitted: true,
        });
      }
    } else if (form.submissionPolicy === 'multiple_email') {
      if (!respondentEmail || !respondentEmail.includes('@')) {
        return res.status(400).json({ error: 'Een geldig e-mailadres is verplicht voor voortgangsregistratie.' });
      }
    }

    // Retrieve questions pool
    const allQuestions = await db.select().from(questions).where(eq(questions.formId, form.id));
    if (!allQuestions.length) {
      return res.status(400).json({ error: 'Dit formulier bevat nog geen vragen.' });
    }

    // Group by category
    const byCategory: Record<string, typeof allQuestions> = {};
    for (const q of allQuestions) {
      const cat = q.category || 'Algemeen';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(q);
    }

    let quotas: Record<string, number> = {};
    if (form.categoryQuotas) {
      try {
        quotas = JSON.parse(form.categoryQuotas);
      } catch {
        quotas = {};
      }
    }

    let selectedQuestions: typeof allQuestions = [];

    // Category shuffling & quotas
    for (const cat of Object.keys(byCategory)) {
      let catQuestions = [...byCategory[cat]];
      if (form.shuffleQuestions === 1) {
        catQuestions.sort(() => Math.random() - 0.5);
      }

      if (quotas[cat] && quotas[cat] > 0) {
        catQuestions = catQuestions.slice(0, quotas[cat]);
      }
      selectedQuestions.push(...catQuestions);
    }

    // Global shuffle if enabled
    if (form.shuffleQuestions === 1) {
      selectedQuestions.sort(() => Math.random() - 0.5);
    }

    // Total questions limit
    if (form.maxQuestionsTotal && form.maxQuestionsTotal > 0) {
      selectedQuestions = selectedQuestions.slice(0, form.maxQuestionsTotal);
    }

    const submissionUid = generateUid('sub');
    const [sub] = await db
      .insert(submissions)
      .values({
        formId: form.id,
        submissionUid,
        respondentEmail: form.submissionPolicy === 'anonymous' ? null : respondentEmail?.toLowerCase().trim() || null,
        respondentName: respondentName || (respondentEmail ? respondentEmail.split('@')[0] : 'Anoniem'),
        status: 'in_progress',
      })
      .returning();

    // Prepare questions for respondent (hide correct answers & rubrics)
    const clientQuestions = selectedQuestions.map((q) => {
      let optionsArr: string[] = [];
      try {
        if (q.options) optionsArr = JSON.parse(q.options);
      } catch {
        optionsArr = [];
      }
      return {
        id: q.id,
        category: q.category,
        questionType: q.questionType,
        questionText: q.questionText,
        options: optionsArr,
        points: q.points,
      };
    });

    res.json({
      submissionUid: sub.submissionUid,
      formTitle: form.title,
      formDescription: form.description,
      mode: form.mode,
      isExamSecure: form.isExamSecure === 1,
      timerMinutes: form.timerMinutes,
      themeColor: form.themeColor,
      allowReview: form.allowReview === 1,
      questions: clientQuestions,
    });
  } catch (error: any) {
    console.error('Error starting form session:', error);
    res.status(500).json({ error: error.message || 'Kon toets/sessie niet starten.' });
  }
});

// Lock submission (infraction during secure exam mode)
app.post('/api/submissions/:submissionUid/lock', async (req: Request, res: Response) => {
  try {
    const { submissionUid } = req.params;
    const { reason } = req.body;

    const subList = await db.select().from(submissions).where(eq(submissions.submissionUid, submissionUid)).limit(1);
    if (!subList.length) {
      return res.status(404).json({ error: 'Sessie niet gevonden.' });
    }

    const sub = subList[0];
    if (sub.status === 'submitted') {
      return res.json({ locked: false, message: 'Toets was al ingeleverd.' });
    }

    await db
      .update(submissions)
      .set({
        status: 'locked',
        lockReason: reason || 'Volledig scherm verlaten of tabblad gewisseld.',
      })
      .where(eq(submissions.id, sub.id));

    res.json({
      success: true,
      locked: true,
      reason: reason || 'Volledig scherm verlaten of tabblad gewisseld.',
    });
  } catch (error: any) {
    console.error('Error locking submission:', error);
    res.status(500).json({ error: 'Kon sessie niet vergrendelen.' });
  }
});

// Unlock submission by maker (passcode or maker token)
app.post('/api/submissions/:submissionUid/unlock', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { submissionUid } = req.params;
    const { passcode } = req.body;

    const subList = await db.select().from(submissions).where(eq(submissions.submissionUid, submissionUid)).limit(1);
    if (!subList.length) {
      return res.status(404).json({ error: 'Sessie niet gevonden.' });
    }

    const sub = subList[0];
    const formList = await db.select().from(forms).where(eq(forms.id, sub.formId)).limit(1);
    if (!formList.length) {
      return res.status(404).json({ error: 'Formulier niet gevonden.' });
    }
    const form = formList[0];

    const isCreator = req.user && req.user.uid === form.creatorUid;
    const isPasscodeValid = passcode && passcode.trim() === form.securityPasscode.trim();

    if (!isCreator && !isPasscodeValid) {
      return res.status(403).json({ error: 'Onjuiste docenten-ontgrendelcode.' });
    }

    await db
      .update(submissions)
      .set({
        status: 'unlocked',
        isUnlockedByMaker: 1,
      })
      .where(eq(submissions.id, sub.id));

    res.json({
      success: true,
      message: 'Toets succesvol ontgrendeld. Leerling kan doorgaan.',
    });
  } catch (error: any) {
    console.error('Error unlocking submission:', error);
    res.status(500).json({ error: 'Kon sessie niet ontgrendelen.' });
  }
});

// Check submission status (for live polling of lock/unlock status by student screen)
app.get('/api/submissions/:submissionUid/status', async (req: Request, res: Response) => {
  try {
    const { submissionUid } = req.params;
    const subList = await db.select().from(submissions).where(eq(submissions.submissionUid, submissionUid)).limit(1);
    if (!subList.length) {
      return res.status(404).json({ error: 'Sessie niet gevonden.' });
    }
    const sub = subList[0];
    res.json({
      submissionUid: sub.submissionUid,
      status: sub.status,
      isUnlockedByMaker: sub.isUnlockedByMaker === 1,
      lockReason: sub.lockReason,
    });
  } catch (error: any) {
    console.error('Error getting submission status:', error);
    res.status(500).json({ error: 'Kon status niet ophalen.' });
  }
});

// Delete in-progress submission & remove all entered answers when respondent returns to homepage
app.delete('/api/submissions/:submissionUid', async (req: Request, res: Response) => {
  try {
    const { submissionUid } = req.params;
    const subList = await db.select().from(submissions).where(eq(submissions.submissionUid, submissionUid)).limit(1);
    if (!subList.length) {
      return res.json({ success: true, message: 'Geen actieve sessie om te verwijderen.' });
    }
    const sub = subList[0];
    // Delete any answers saved for this submission
    await db.delete(submissionAnswers).where(eq(submissionAnswers.submissionId, sub.id));
    // Delete the submission
    await db.delete(submissions).where(eq(submissions.id, sub.id));
    res.json({ success: true, message: 'Toetsantwoorden en sessie zijn verwijderd.' });
  } catch (error: any) {
    console.error('Error deleting submission:', error);
    res.status(500).json({ error: 'Fout bij het verwijderen van de toetssessie.' });
  }
});

// Submit answers & trigger automatic AI evaluation
app.post('/api/submissions/:submissionUid/submit', async (req: Request, res: Response) => {
  try {
    const { submissionUid } = req.params;
    const { answers = [], timeSpentSeconds = 0 } = req.body;

    const subList = await db.select().from(submissions).where(eq(submissions.submissionUid, submissionUid)).limit(1);
    if (!subList.length) {
      return res.status(404).json({ error: 'Sessie niet gevonden.' });
    }

    const sub = subList[0];
    if (sub.status === 'submitted') {
      return res.status(400).json({ error: 'Deze toets is al ingediend.' });
    }

    const formList = await db.select().from(forms).where(eq(forms.id, sub.formId)).limit(1);
    if (!formList.length) {
      return res.status(404).json({ error: 'Formulier niet gevonden.' });
    }
    const form = formList[0];

    // Fetch all questions for this form to verify
    const dbQuestions = await db.select().from(questions).where(eq(questions.formId, form.id));
    const qMap = new Map(dbQuestions.map((q) => [q.id, q]));

    let totalScore = 0;
    let maxScore = 0;
    const answerRecords = [];

    for (const item of answers) {
      const q = qMap.get(item.questionId);
      if (!q) continue;

      const qPoints = q.points || 1;
      maxScore += qPoints;

      let isCorrect = 0;
      let scoreAwarded = 0;
      let feedback = '';

      const studentAns = (item.answerValue || '').toString().trim();

      if (q.questionType === 'multiple_choice') {
        const correctNorm = (q.correctAnswer || '').trim().toLowerCase();
        const studentNorm = studentAns.toLowerCase();
        if (studentNorm && correctNorm === studentNorm) {
          isCorrect = 1;
          scoreAwarded = qPoints;
          feedback = 'Correct beantwoord!';
        } else {
          isCorrect = 0;
          scoreAwarded = 0;
          feedback = q.rubric ? `Juiste antwoord: ${q.correctAnswer}. Toelichting: ${q.rubric}` : `Juiste antwoord: ${q.correctAnswer}`;
        }
      } else if (q.questionType === 'open') {
        if (form.aiGradingEnabled === 1) {
          // AI grading with openAiKey if set, else Gemini
          const grading = await gradeOpenQuestion(
            {
              questionText: q.questionText,
              category: q.category,
              rubric: q.rubric || q.correctAnswer,
              studentAnswer: studentAns,
              maxPoints: qPoints,
            },
            form.openAiKey
          );
          scoreAwarded = grading.scoreAwarded;
          isCorrect = grading.isCorrect ? 1 : 0;
          feedback = grading.feedback;
        } else {
          // Manual review required
          scoreAwarded = 0;
          isCorrect = 0;
          feedback = 'Open vraag ingeleverd ter handmatige beoordeling door de docent.';
        }
      } else if (q.questionType === 'checkbox') {
        // Multi-select comparison
        const correctList = (q.correctAnswer || '').split(';').map((s) => s.trim().toLowerCase()).filter(Boolean);
        const studentList = studentAns.split(';').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
        const matches = studentList.filter((s: string) => correctList.includes(s));
        if (matches.length === correctList.length && studentList.length === correctList.length) {
          isCorrect = 1;
          scoreAwarded = qPoints;
          feedback = 'Volledig correct!';
        } else if (matches.length > 0) {
          isCorrect = 0;
          scoreAwarded = Math.round((matches.length / Math.max(1, correctList.length)) * qPoints);
          feedback = `Gedeeltelijk juist (${matches.length}/${correctList.length} opties).`;
        } else {
          isCorrect = 0;
          scoreAwarded = 0;
          feedback = `Juiste opties waren: ${q.correctAnswer}`;
        }
      } else {
        // Rating/scale or general survey
        isCorrect = 1;
        scoreAwarded = qPoints;
        feedback = 'Antwoord opgeslagen.';
      }

      totalScore += scoreAwarded;

      answerRecords.push({
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
      });
    }

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 100;

    // Insert answers into SQL database
    if (answerRecords.length > 0) {
      await db.insert(submissionAnswers).values(answerRecords);
    }

    // Update submission record
    const [finalSub] = await db
      .update(submissions)
      .set({
        totalScore,
        maxScore,
        percentage,
        timeSpentSeconds: Number(timeSpentSeconds) || 0,
        status: 'submitted',
        completedAt: new Date(),
      })
      .where(eq(submissions.id, sub.id))
      .returning();

    // Prepare response
    res.json({
      success: true,
      submissionUid: finalSub.submissionUid,
      totalScore,
      maxScore,
      percentage,
      timeSpentSeconds: finalSub.timeSpentSeconds,
      allowReview: form.allowReview === 1,
      answers: form.allowReview === 1 ? answerRecords : undefined,
    });
  } catch (error: any) {
    console.error('Error submitting form:', error);
    res.status(500).json({ error: error.message || 'Fout bij het verwerken van antwoorden.' });
  }
});

// Get submission result review
app.get('/api/submissions/:submissionUid/review', async (req: Request, res: Response) => {
  try {
    const { submissionUid } = req.params;

    const subList = await db.select().from(submissions).where(eq(submissions.submissionUid, submissionUid)).limit(1);
    if (!subList.length) {
      return res.status(404).json({ error: 'Inzending niet gevonden.' });
    }
    const sub = subList[0];

    const formList = await db.select().from(forms).where(eq(forms.id, sub.formId)).limit(1);
    if (!formList.length) {
      return res.status(404).json({ error: 'Formulier niet gevonden.' });
    }
    const form = formList[0];

    const answersList = await db
      .select()
      .from(submissionAnswers)
      .where(eq(submissionAnswers.submissionId, sub.id))
      .orderBy(submissionAnswers.id);

    res.json({
      submission: sub,
      formTitle: form.title,
      allowReview: form.allowReview === 1,
      answers: answersList,
    });
  } catch (error: any) {
    console.error('Error fetching submission review:', error);
    res.status(500).json({ error: 'Kon inzending niet ophalen.' });
  }
});

// 6. Maker Analytics & Visualisations
app.get('/api/forms/:formUid/analytics', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.uid;
    const { formUid } = req.params;

    const formList = await db.select().from(forms).where(eq(forms.formUid, formUid)).limit(1);
    if (!formList.length) {
      return res.status(404).json({ error: 'Formulier niet gevonden.' });
    }
    const form = formList[0];
    if (form.creatorUid !== uid) {
      return res.status(403).json({ error: 'Geen toegang tot deze analyses.' });
    }

    const formQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.formId, form.id))
      .orderBy(questions.orderIndex);

    const formSubmissions = await db
      .select()
      .from(submissions)
      .where(eq(submissions.formId, form.id))
      .orderBy(desc(submissions.createdAt));

    const submittedOnly = formSubmissions.filter((s) => s.status === 'submitted');
    const totalSubmissions = submittedOnly.length;

    let avgPercentage = 0;
    let avgTimeSeconds = 0;
    let passCount = 0;

    if (totalSubmissions > 0) {
      const sumPercentage = submittedOnly.reduce((acc, s) => acc + s.percentage, 0);
      avgPercentage = Math.round(sumPercentage / totalSubmissions);

      const sumTime = submittedOnly.reduce((acc, s) => acc + s.timeSpentSeconds, 0);
      avgTimeSeconds = Math.round(sumTime / totalSubmissions);

      passCount = submittedOnly.filter((s) => s.percentage >= 55).length;
    }

    // Category performance analysis
    const subIds = submittedOnly.map((s) => s.id);
    let allAnswers: typeof submissionAnswers.$inferSelect[] = [];
    if (subIds.length > 0) {
      allAnswers = await db
        .select()
        .from(submissionAnswers)
        .where(inArray(submissionAnswers.submissionId, subIds));
    }

    const categoryStats: Record<string, { totalPointsAwarded: number; maxPossiblePoints: number; count: number }> = {};
    const questionAccuracy: Record<number, { correct: number; total: number; avgScore: number; maxPoints: number }> = {};

    for (const ans of allAnswers) {
      const cat = ans.questionCategory || 'Algemeen';
      if (!categoryStats[cat]) {
        categoryStats[cat] = { totalPointsAwarded: 0, maxPossiblePoints: 0, count: 0 };
      }
      categoryStats[cat].totalPointsAwarded += ans.scoreAwarded;
      categoryStats[cat].maxPossiblePoints += ans.maxPoints;
      categoryStats[cat].count += 1;

      if (ans.questionId) {
        if (!questionAccuracy[ans.questionId]) {
          questionAccuracy[ans.questionId] = { correct: 0, total: 0, avgScore: 0, maxPoints: ans.maxPoints };
        }
        if (ans.isCorrect === 1) questionAccuracy[ans.questionId].correct += 1;
        questionAccuracy[ans.questionId].total += 1;
        questionAccuracy[ans.questionId].avgScore += ans.scoreAwarded;
      }
    }

    const categoryBreakdown = Object.entries(categoryStats).map(([category, stats]) => ({
      category,
      percentage: stats.maxPossiblePoints > 0 ? Math.round((stats.totalPointsAwarded / stats.maxPossiblePoints) * 100) : 0,
      attempts: stats.count,
    }));

    // Score distribution buckets: 0-20, 21-40, 41-60, 61-80, 81-100
    const scoreDistribution = [
      { range: '0-20%', count: 0 },
      { range: '21-40%', count: 0 },
      { range: '41-60%', count: 0 },
      { range: '61-80%', count: 0 },
      { range: '81-100%', count: 0 },
    ];

    for (const s of submittedOnly) {
      if (s.percentage <= 20) scoreDistribution[0].count++;
      else if (s.percentage <= 40) scoreDistribution[1].count++;
      else if (s.percentage <= 60) scoreDistribution[2].count++;
      else if (s.percentage <= 80) scoreDistribution[3].count++;
      else scoreDistribution[4].count++;
    }

    // Question performance
    const questionAnalysis = formQuestions.map((q) => {
      const acc = questionAccuracy[q.id];
      const answeredCount = acc ? acc.total : 0;
      const accuracyRate = answeredCount > 0 ? Math.round((acc.correct / answeredCount) * 100) : 0;
      const averagePoints = answeredCount > 0 ? Number((acc.avgScore / answeredCount).toFixed(1)) : 0;

      return {
        id: q.id,
        category: q.category,
        questionType: q.questionType,
        questionText: q.questionText,
        points: q.points,
        answeredCount,
        accuracyRate,
        averagePoints,
      };
    });

    res.json({
      form,
      totalSubmissions,
      avgPercentage,
      avgTimeSeconds,
      passRate: totalSubmissions > 0 ? Math.round((passCount / totalSubmissions) * 100) : 0,
      scoreDistribution,
      categoryBreakdown,
      questionAnalysis,
      submissions: formSubmissions,
    });
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: error.message || 'Kon analyses niet laden.' });
  }
});

// 7. Export to Excel (.xlsx) and CSV
app.get('/api/forms/:formUid/export/:format', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.uid;
    const { formUid, format } = req.params;

    const formList = await db.select().from(forms).where(eq(forms.formUid, formUid)).limit(1);
    if (!formList.length) {
      return res.status(404).json({ error: 'Formulier niet gevonden.' });
    }
    const form = formList[0];
    if (form.creatorUid !== uid) {
      return res.status(403).json({ error: 'Geen toegang tot exporteren.' });
    }

    const formSubs = await db
      .select()
      .from(submissions)
      .where(eq(submissions.formId, form.id))
      .orderBy(desc(submissions.createdAt));

    const subIds = formSubs.map((s) => s.id);
    let allAnswers: typeof submissionAnswers.$inferSelect[] = [];
    if (subIds.length > 0) {
      allAnswers = await db.select().from(submissionAnswers).where(inArray(submissionAnswers.submissionId, subIds));
    }

    // Map answers by submissionId
    const answersBySub: Record<number, Record<string, string>> = {};
    for (const a of allAnswers) {
      if (!answersBySub[a.submissionId]) answersBySub[a.submissionId] = {};
      const key = `${a.questionCategory}: ${a.questionText.slice(0, 30)}`;
      answersBySub[a.submissionId][key] = `${a.answerValue || ''} (${a.scoreAwarded}/${a.maxPoints} pt)`;
    }

    // Build tabular data
    const rows = formSubs.map((s, index) => {
      const row: Record<string, any> = {
        'Nr': index + 1,
        'Datum': s.createdAt ? new Date(s.createdAt).toLocaleString('nl-NL') : '',
        'Respondent Naam': s.respondentName || 'Anoniem',
        'E-mail': s.respondentEmail || 'N.v.t. (Anoniem)',
        'Score': `${s.totalScore} / ${s.maxScore}`,
        'Percentage': `${s.percentage}%`,
        'Tijd (sec)': s.timeSpentSeconds,
        'Status': s.status,
        'Docent Deblokkering': s.isUnlockedByMaker ? 'Ja' : 'Nee',
      };

      if (answersBySub[s.id]) {
        Object.assign(row, answersBySub[s.id]);
      }
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Resultaten');

    const cleanTitle = (form.title || 'Formulier').replace(/[^a-zA-Z0-9_-]/g, '_');

    if (format === 'csv') {
      const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${cleanTitle}_resultaten.csv"`);
      return res.send(csvOutput);
    } else {
      // Excel .xlsx
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${cleanTitle}_resultaten.xlsx"`);
      return res.send(buffer);
    }
  } catch (error: any) {
    console.error('Export error:', error);
    res.status(500).json({ error: error.message || 'Fout bij het exporteren van gegevens.' });
  }
});

// 8. Respondent Progress History (for student visual progress dashboard)
app.get('/api/respondent/progress', async (req: Request, res: Response) => {
  try {
    const email = req.query.email ? (req.query.email as string).toLowerCase().trim() : null;
    if (!email) {
      return res.json({ history: [], categoryMastery: [] });
    }

    const studentSubs = await db
      .select({
        id: submissions.id,
        formId: submissions.formId,
        formTitle: forms.title,
        percentage: submissions.percentage,
        totalScore: submissions.totalScore,
        maxScore: submissions.maxScore,
        timeSpentSeconds: submissions.timeSpentSeconds,
        status: submissions.status,
        completedAt: submissions.completedAt,
        createdAt: submissions.createdAt,
      })
      .from(submissions)
      .innerJoin(forms, eq(submissions.formId, forms.id))
      .where(and(eq(submissions.respondentEmail, email), eq(submissions.status, 'submitted')))
      .orderBy(submissions.createdAt);

    const subIds = studentSubs.map((s) => s.id);
    let categoryStats: Record<string, { totalPoints: number; maxPoints: number }> = {};

    if (subIds.length > 0) {
      const studentAnswers = await db
        .select()
        .from(submissionAnswers)
        .where(inArray(submissionAnswers.submissionId, subIds));

      for (const a of studentAnswers) {
        const cat = a.questionCategory || 'Algemeen';
        if (!categoryStats[cat]) {
          categoryStats[cat] = { totalPoints: 0, maxPoints: 0 };
        }
        categoryStats[cat].totalPoints += a.scoreAwarded;
        categoryStats[cat].maxPoints += a.maxPoints;
      }
    }

    const categoryMastery = Object.entries(categoryStats).map(([category, s]) => ({
      category,
      percentage: s.maxPoints > 0 ? Math.round((s.totalPoints / s.maxPoints) * 100) : 0,
      totalAnswered: s.maxPoints,
    }));

    res.json({
      history: studentSubs,
      categoryMastery,
    });
  } catch (error: any) {
    console.error('Error fetching respondent progress:', error);
    res.status(500).json({ error: 'Kon voortgangsgegevens niet ophalen.' });
  }
});

// Configure Vite integration
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`FormulierPro Server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
