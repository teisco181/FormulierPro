import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ArrowRight,
  Send,
  Award,
  BookOpen,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import {
  StudyFlowStofPayload,
  StudyFlowResultaatVraag,
  postToStudyFlowResult,
} from '../lib/studyflow.ts';

interface StudyFlowRunnerProps {
  stof: StudyFlowStofPayload | null;
  inIframe: boolean;
}

interface GeneratedQuizQuestion {
  id: number;
  category: string;
  questionType: 'multiple_choice' | 'open';
  questionText: string;
  options?: string[];
  correctAnswer: string;
  rubric: string;
  points: number;
}

interface GradedAnswerDetail {
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
}

interface StudyFlowResultState {
  totalScore: number;
  maxScore: number;
  percentage: number;
  vragen: StudyFlowResultaatVraag[];
  answers: GradedAnswerDetail[];
  savedToStudyFlow: boolean;
}

export const StudyFlowRunner: React.FC<StudyFlowRunnerProps> = ({ stof, inIframe }) => {
  const [phase, setPhase] = useState<'configure' | 'taking' | 'result'>('configure');

  // Quiz configuration
  const [count, setCount] = useState<5 | 10 | 15>(5);
  const [questionType, setQuestionType] = useState<'meerkeuze' | 'open' | 'gemengd'>('gemengd');
  const [difficulty, setDifficulty] = useState<'makkelijk' | 'gemiddeld' | 'moeilijk'>('gemiddeld');
  const [showSourceText, setShowSourceText] = useState(false);

  // Generation & taking state
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<GeneratedQuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  // Grading & result state
  const [grading, setGrading] = useState(false);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [result, setResult] = useState<StudyFlowResultState | null>(null);
  const sentResultRef = useRef(false);

  // Reset to configure screen when new STUDYFLOW_STOF arrives
  useEffect(() => {
    if (stof) {
      setPhase('configure');
      setQuestions([]);
      setAnswers({});
      setCurrentIdx(0);
      setResult(null);
      setGenerateError(null);
      setGradeError(null);
      sentResultRef.current = false;
    }
  }, [stof]);

  if (!stof) {
    return (
      <div className="w-full max-w-2xl mx-auto px-3 sm:px-6 py-8">
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6 animate-pulse" />
          </div>
          <h1 className="text-lg font-extrabold text-slate-900">
            Verbonden met StudyFlow
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            Wachten op lesstof vanuit StudyFlow. Zodra een onderwerp is gekozen, kun je hier direct een toets genereren.
          </p>
        </div>
      </div>
    );
  }

  const handleGenerateQuiz = async () => {
    setGenerating(true);
    setGenerateError(null);
    setGradeError(null);
    sentResultRef.current = false;

    try {
      const res = await fetch('/api/studyflow/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vak: stof.vak,
          titel: stof.titel,
          tekst: stof.tekst,
          count,
          questionType,
          difficulty,
        }),
      });

      const data = await res.json();
      if (!res.ok || !Array.isArray(data.questions) || data.questions.length === 0) {
        throw new Error(data.error || 'Kon geen toets genereren uit de ontvangen lesstof.');
      }

      setQuestions(data.questions);
      setAnswers({});
      setCurrentIdx(0);
      setResult(null);
      setPhase('taking');
    } catch (err: any) {
      setGenerateError(err.message || 'Fout bij het genereren van de toets.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmitQuiz = async () => {
    if (grading) return;
    setGrading(true);
    setGradeError(null);

    try {
      const res = await fetch('/api/studyflow/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions,
          answers,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Fout bij het nakijken van de toets.');
      }

      const payload = {
        vak: stof.vak,
        titel: stof.titel,
        score: Number(data.totalScore) || 0,
        maxScore: Number(data.maxScore) || 0,
        datum: new Date().toISOString(),
        vragen: Array.isArray(data.vragen) ? data.vragen : [],
      };

      let savedToStudyFlow = false;
      if (inIframe && !sentResultRef.current) {
        savedToStudyFlow = postToStudyFlowResult(payload);
        sentResultRef.current = true;
      }

      try {
        window.localStorage.setItem('formulierpro_studyflow_last_result', JSON.stringify(payload));
      } catch {
        // Ignore storage quota errors
      }

      setResult({
        totalScore: payload.score,
        maxScore: payload.maxScore,
        percentage: Number(data.percentage) || 0,
        vragen: payload.vragen,
        answers: Array.isArray(data.answers) ? data.answers : [],
        savedToStudyFlow,
      });
      setPhase('result');
    } catch (err: any) {
      setGradeError(err.message || 'Kon antwoorden niet nakijken.');
    } finally {
      setGrading(false);
    }
  };

  // Phase 1: Configuration screen ("Toets maken van: [titel] ([vak])")
  if (phase === 'configure') {
    const wordCount = stof.tekst.trim().split(/\s+/).filter(Boolean).length;

    return (
      <div className="w-full max-w-2xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {stof.vak || 'Vak'}
              </span>
              <span className="text-[11px] font-medium text-slate-400">
                {wordCount} woorden lesstof ontvangen
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-snug">
              Toets maken van: {stof.titel} ({stof.vak})
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              Kies het aantal vragen, het vraagtype en de moeilijkheidsgraad. Alle vragen worden in het Nederlands gegenereerd op basis van jouw lesstof.
            </p>
          </div>

          {/* Collapsible source text preview */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSourceText((prev) => !prev)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-700 hover:bg-slate-100/70 transition-colors"
            >
              <span className="flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                Ontvangen lesstof bekijken
              </span>
              {showSourceText ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showSourceText && (
              <div className="px-4 pb-3 pt-1 text-xs text-slate-600 leading-relaxed whitespace-pre-wrap border-t border-slate-200/70">
                {stof.tekst}
              </div>
            )}
          </div>

          {/* Option 1: Aantal vragen (5 / 10 / 15) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Aantal vragen
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {([5, 10, 15] as const).map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCount(num)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                    count === num
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {num} vragen
                </button>
              ))}
            </div>
          </div>

          {/* Option 2: Vraagtype (meerkeuze / open / gemengd) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Vraagtype
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {(
                [
                  { id: 'meerkeuze', label: 'Meerkeuze' },
                  { id: 'open', label: 'Open' },
                  { id: 'gemengd', label: 'Gemengd' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setQuestionType(opt.id)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                    questionType === opt.id
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Option 3: Moeilijkheid (makkelijk / gemiddeld / moeilijk) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Moeilijkheid
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {(
                [
                  { id: 'makkelijk', label: 'Makkelijk' },
                  { id: 'gemiddeld', label: 'Gemiddeld' },
                  { id: 'moeilijk', label: 'Moeilijk' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDifficulty(opt.id)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                    difficulty === opt.id
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {generateError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{generateError}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleGenerateQuiz}
            disabled={generating}
            className="w-full py-3 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm shadow-md shadow-indigo-100 flex items-center justify-center gap-2 transition-all"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Toets wordt gegenereerd...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Toets genereren
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Phase 2: Taking the quiz
  if (phase === 'taking' && questions.length > 0) {
    const currentQ = questions[currentIdx];
    const total = questions.length;
    const answeredCount = questions.filter((q) => Boolean(answers[q.id]?.trim())).length;

    return (
      <div className="w-full max-w-3xl mx-auto px-3 sm:px-6 py-4 space-y-4">
        {/* Compact Quiz Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-4 shadow-2xs space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 mr-2">
                {stof.vak}
              </span>
              <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                {stof.titel}
              </span>
            </div>

            <button
              type="button"
              onClick={handleSubmitQuiz}
              disabled={grading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold shadow-xs transition-all"
            >
              {grading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Nakijken ({answeredCount}/{total})
            </button>
          </div>

          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 h-1.5 transition-all duration-300"
              style={{ width: `${((currentIdx + 1) / total) * 100}%` }}
            />
          </div>
        </div>

        {gradeError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{gradeError}</span>
          </div>
        )}

        {/* Question Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-7 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                {currentIdx + 1}
              </span>
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                {currentQ.questionType === 'multiple_choice' ? 'Meerkeuze' : 'Open vraag'}
              </span>
            </div>
            <div className="text-xs font-semibold text-slate-500 font-mono">
              {currentQ.points} pt • Vraag {currentIdx + 1} van {total}
            </div>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug whitespace-pre-line">
              {currentQ.questionText}
            </h2>
            {currentQ.questionType === 'open' && (
              <p className="text-xs text-violet-600 font-medium flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Automatische AI-beoordeling na afronden
              </p>
            )}
          </div>

          {currentQ.questionType === 'multiple_choice' ? (
            <div className="space-y-2.5">
              {(currentQ.options || []).map((option, optIdx) => {
                const isSelected = answers[currentQ.id] === option;
                return (
                  <label
                    key={optIdx}
                    className={`flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 shadow-xs ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`sf-q-${currentQ.id}`}
                      value={option}
                      checked={isSelected}
                      onChange={() => setAnswers({ ...answers, [currentQ.id]: option })}
                      className="sr-only"
                    />
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                        isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <span className="text-sm font-semibold text-slate-800">{option}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                rows={5}
                value={answers[currentQ.id] || ''}
                onChange={(e) => setAnswers({ ...answers, [currentQ.id]: e.target.value })}
                placeholder="Typ hier jouw antwoord op basis van de lesstof..."
                className="w-full text-sm rounded-2xl border border-slate-200 p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 leading-relaxed"
              />
              <div className="text-[11px] text-slate-400 px-1">
                {(answers[currentQ.id] || '').length} tekens
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-xs disabled:opacity-30 hover:bg-slate-50 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Vorige
          </button>

          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {questions.map((q, idx) => {
              const isAns = Boolean(answers[q.id]?.trim());
              const isCurr = idx === currentIdx;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIdx(idx)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                    isCurr
                      ? 'bg-slate-900 text-white shadow-xs'
                      : isAns
                      ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                      : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {currentIdx < total - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentIdx((prev) => Math.min(total - 1, prev + 1))}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-all"
            >
              Volgende
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmitQuiz}
              disabled={grading}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold text-xs shadow-sm transition-all"
            >
              {grading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Afronden & Nakijken
            </button>
          )}
        </div>
      </div>
    );
  }

  // Phase 3: Results screen + StudyFlow confirmation
  if (phase === 'result' && result) {
    const isPassed = result.percentage >= 55;

    return (
      <div className="w-full max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5">
        {/* Hero Score Card */}
        <div
          className={`p-6 sm:p-8 rounded-3xl border text-center shadow-sm ${
            isPassed
              ? 'bg-gradient-to-b from-emerald-500/10 via-white to-white border-emerald-200'
              : 'bg-gradient-to-b from-amber-500/10 via-white to-white border-amber-200'
          }`}
        >
          <div className="flex justify-center mb-3">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md ${
                isPassed ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
              }`}
            >
              <Award className="w-8 h-8" />
            </div>
          </div>

          <span
            className={`inline-block text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-2 ${
              isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {isPassed ? '✓ Voldoende' : 'Blijf oefenen'}
          </span>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Toets Afgerond: {stof.titel}
          </h1>
          <p className="text-xs text-slate-500 mt-1">{stof.vak}</p>

          {result.savedToStudyFlow && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Resultaat is opgeslagen in StudyFlow</span>
            </div>
          )}

          <div className="flex items-center justify-center gap-8 my-6">
            <div>
              <p className="text-3xl sm:text-4xl font-extrabold text-slate-900">{result.percentage}%</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase mt-0.5">Score</p>
            </div>
            <div className="w-px h-10 bg-slate-200" />
            <div>
              <p className="text-3xl sm:text-4xl font-extrabold text-slate-900">
                {result.totalScore}{' '}
                <span className="text-lg font-bold text-slate-400">/ {result.maxScore}</span>
              </p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase mt-0.5">Punten</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setPhase('configure');
              setResult(null);
              sentResultRef.current = false;
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            Nog een toets maken van deze stof
          </button>
        </div>

        {/* Question-by-question feedback */}
        <div className="space-y-3">
          {result.answers.map((ans, idx) => {
            const ok = ans.isCorrect === 1;
            return (
              <div
                key={idx}
                className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-2xs space-y-3 ${
                  ok ? 'border-emerald-200' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-700">Vraag {idx + 1}</span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {ans.scoreAwarded} / {ans.maxPoints} pt
                  </span>
                </div>

                <p className="text-sm font-bold text-slate-900 whitespace-pre-line">{ans.questionText}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      Jouw antwoord
                    </span>
                    <span className="font-medium text-slate-800">
                      {ans.answerValue || <span className="italic text-slate-400">Geen antwoord ingevuld</span>}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 block mb-1">
                      Juiste antwoord
                    </span>
                    <span className="font-medium text-emerald-950">{ans.correctAnswer}</span>
                  </div>
                </div>

                {ans.aiFeedback && (
                  <div className="p-3 rounded-xl bg-violet-50/70 border border-violet-200 text-xs text-violet-900 flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
                    <span>{ans.aiFeedback}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
};
