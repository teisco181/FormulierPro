import React from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Award, 
  Clock, 
  Sparkles, 
  ArrowLeft, 
  Eye, 
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { SubmissionAnswer } from '../types/index.ts';

interface SubmissionReviewProps {
  submissionResult: {
    submissionUid: string;
    totalScore: number;
    maxScore: number;
    percentage: number;
    timeSpentSeconds: number;
    allowReview: boolean;
    answers?: SubmissionAnswer[];
  };
  allowReview: boolean;
  onExit: () => void;
}

export const SubmissionReview: React.FC<SubmissionReviewProps> = ({
  submissionResult,
  allowReview,
  onExit,
}) => {
  const { totalScore, maxScore, percentage, timeSpentSeconds, answers } = submissionResult;
  const isPassed = percentage >= 55;

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    if (mins === 0) return `${remainder} seconden`;
    return `${mins} min ${remainder} sec`;
  };

  return (
    <div className="max-w-3xl mx-auto my-8 p-4 sm:p-6 space-y-6">
      {/* Result Hero Card */}
      <div className={`p-8 rounded-3xl border text-center shadow-lg relative overflow-hidden ${
        isPassed
          ? 'bg-gradient-to-b from-emerald-500/10 via-white to-white border-emerald-200'
          : 'bg-gradient-to-b from-amber-500/10 via-white to-white border-amber-200'
      }`}>
        <div className="flex justify-center mb-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-md ${
            isPassed ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
          }`}>
            <Award className="w-9 h-9" />
          </div>
        </div>

        <span className={`inline-block text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-2 ${
          isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
        }`}>
          {isPassed ? '✓ Geslaagd' : 'Aandacht vereist'}
        </span>

        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Toets Succesvol Ingediend
        </h1>

        <p className="text-xs text-slate-500 mt-1">
          Uw antwoorden zijn veilig opgeslagen in de SQL-database en beoordeeld.
        </p>

        {/* Big Score Numbers */}
        <div className="flex items-center justify-center gap-8 my-6">
          <div>
            <p className="text-4xl font-extrabold text-slate-900 tracking-tight">{percentage}%</p>
            <p className="text-xs font-semibold text-slate-400 uppercase mt-0.5">Eindpercentage</p>
          </div>
          <div className="w-px h-10 bg-slate-200" />
          <div>
            <p className="text-4xl font-extrabold text-slate-900 tracking-tight">
              {totalScore} <span className="text-lg font-bold text-slate-400">/ {maxScore}</span>
            </p>
            <p className="text-xs font-semibold text-slate-400 uppercase mt-0.5">Totaal Punten</p>
          </div>
          <div className="w-px h-10 bg-slate-200" />
          <div>
            <p className="text-2xl font-bold text-slate-800 flex items-center justify-center gap-1.5 pt-1.5">
              <Clock className="w-5 h-5 text-slate-400" />
              {formatTime(timeSpentSeconds)}
            </p>
            <p className="text-xs font-semibold text-slate-400 uppercase mt-0.5">Tijdsduur</p>
          </div>
        </div>

        <button
          onClick={onExit}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Terug naar Startpagina
        </button>
      </div>

      {/* Review Mode Section */}
      {allowReview && answers && answers.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Eye className="w-5 h-5 text-indigo-600" />
              Overzicht van Ingevulde Antwoorden & AI Beoordeling
            </h3>
            <span className="text-xs font-semibold text-slate-500">
              {answers.filter((a) => a.isCorrect === 1).length} van {answers.length} correct
            </span>
          </div>

          <div className="space-y-4">
            {answers.map((ans, idx) => {
              const isCorrect = ans.isCorrect === 1;
              const isPartial = !isCorrect && ans.scoreAwarded > 0;

              return (
                <div
                  key={idx}
                  className={`bg-white rounded-2xl border p-5 shadow-xs transition-all ${
                    isCorrect
                      ? 'border-emerald-200'
                      : isPartial
                      ? 'border-amber-200'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Top Bar */}
                  <div className="flex items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                        {idx + 1}
                      </span>
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {ans.questionCategory || 'Algemeen'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        isCorrect
                          ? 'bg-emerald-100 text-emerald-800'
                          : isPartial
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {ans.scoreAwarded} / {ans.maxPoints} pt
                      </span>
                    </div>
                  </div>

                  {/* Question Prompt */}
                  <p className="text-sm font-bold text-slate-900 mb-3">{ans.questionText}</p>

                  {/* Student Answer */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Uw ingevulde antwoord:
                    </p>
                    <p className="text-xs font-medium text-slate-800">
                      {ans.answerValue || <span className="italic text-slate-400">Geen antwoord ingevuld</span>}
                    </p>
                  </div>

                  {/* AI Feedback or Explanation */}
                  {ans.aiFeedback && (
                    <div className="p-3 bg-violet-50/70 border border-violet-200 rounded-xl flex items-start gap-2.5 text-xs text-violet-900">
                      <Sparkles className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-violet-950">AI Feedback & Toelichting: </span>
                        <span>{ans.aiFeedback}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-xs text-slate-500">
          <HelpCircle className="w-6 h-6 text-slate-400 mx-auto mb-2" />
          De maker van dit formulier heeft ingesteld dat ingevulde antwoorden en AI-evaluaties niet direct getoond worden na inlevering.
        </div>
      )}
    </div>
  );
};
