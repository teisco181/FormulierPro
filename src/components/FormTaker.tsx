import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldAlert, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Send, 
  Maximize2, 
  Lock, 
  Unlock, 
  Sparkles, 
  ArrowRight, 
  ArrowLeft,
  Loader2,
  HelpCircle,
  Home,
  Radio
} from 'lucide-react';
import { Question } from '../types/index.ts';
import { SubmissionReview } from './SubmissionReview.tsx';

interface FormTakerProps {
  formUid: string;
  onExit: () => void;
}

export const FormTaker: React.FC<FormTakerProps> = ({ formUid, onExit }) => {
  // Session data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>(null);
  const [submissionUid, setSubmissionUid] = useState<string | null>(null);

  // Student registration input
  const [respondentEmail, setRespondentEmail] = useState('');
  const [respondentName, setRespondentName] = useState('');
  const [sessionStarted, setSessionStarted] = useState(false);

  // Exam runtime state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any>(null);

  // Security Lockout state
  const [isLocked, setIsLocked] = useState(false);
  const [lockReason, setLockReason] = useState<string>('');
  const [unlockPasscode, setUnlockPasscode] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [remoteUnlockNotice, setRemoteUnlockNotice] = useState<string | null>(null);

  // Exit & Delete answers confirmation modal
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const startTimeRef = useRef<number>(Date.now());
  const timerIntervalRef = useRef<any>(null);

  // Fetch form meta
  useEffect(() => {
    const fetchFormMeta = async () => {
      try {
        const res = await fetch(`/api/forms/${formUid}`);
        if (!res.ok) {
          throw new Error('Formulier niet gevonden of niet beschikbaar.');
        }
        const data = await res.json();
        setFormData(data);
      } catch (err: any) {
        setError(err.message || 'Kon formulier niet laden.');
      } finally {
        setLoading(false);
      }
    };
    fetchFormMeta();
  }, [formUid]);

  // Handle Fullscreen & Anti-Cheat detection
  useEffect(() => {
    if (!sessionStarted || !formData?.isExamSecure || !submissionUid || isLocked || submissionResult) {
      return;
    }

    const handleViolation = async (reason: string) => {
      if (isLocked) return;
      setIsLocked(true);
      setLockReason(reason);

      try {
        await fetch(`/api/submissions/${submissionUid}/lock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        });
      } catch (err) {
        console.error('Failed to notify server of lock:', err);
      }
    };

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        handleViolation('Volledig scherm verlaten door de kandidaat.');
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        handleViolation('Tabblad verlaten of venster geminimaliseerd.');
      }
    };

    const onBlur = () => {
      // Short delay to avoid accidental triggers
      setTimeout(() => {
        if (!document.hasFocus() && !document.fullscreenElement) {
          handleViolation('Vensterfocus verloren (mogelijk andere app geopend).');
        }
      }, 300);
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
    };
  }, [sessionStarted, formData?.isExamSecure, submissionUid, isLocked, submissionResult]);

  // Remote unlock polling when locked
  useEffect(() => {
    if (!isLocked || !submissionUid || submissionResult) return;

    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`/api/submissions/${submissionUid}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'unlocked' || data.isUnlockedByMaker) {
            setIsLocked(false);
            setUnlockError(null);
            setRemoteUnlockNotice('De maker heeft u op afstand weer toegevoegd aan de toets!');
            if (formData?.isExamSecure) {
              await enterFullscreen();
            }
            setTimeout(() => setRemoteUnlockNotice(null), 7000);
          }
        }
      } catch (err) {
        console.warn('Status poll check failed:', err);
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [isLocked, submissionUid, submissionResult, formData?.isExamSecure]);

  // Timer countdown
  useEffect(() => {
    if (!sessionStarted || timeRemainingSeconds === null || isLocked || submissionResult) {
      return;
    }

    if (timeRemainingSeconds <= 0) {
      // Time is up -> Auto submit
      handleFinalSubmit();
      return;
    }

    timerIntervalRef.current = setInterval(() => {
      setTimeRemainingSeconds((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timerIntervalRef.current);
  }, [sessionStarted, timeRemainingSeconds, isLocked, submissionResult]);

  // Request fullscreen utility
  const enterFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn('Could not activate fullscreen automatically:', err);
    }
  };

  // Start Exam
  const handleStartExam = async () => {
    setError(null);
    if (formData.submissionPolicy !== 'anonymous' && !respondentEmail.includes('@')) {
      setError('Vul een geldig e-mailadres in om te starten.');
      return;
    }

    try {
      if (formData.isExamSecure) {
        await enterFullscreen();
      }

      const res = await fetch(`/api/forms/${formUid}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          respondentEmail: respondentEmail.trim(),
          respondentName: respondentName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Kon toets niet starten.');
      }

      setSubmissionUid(data.submissionUid);
      setFormData({
        ...formData,
        questions: data.questions,
      });

      if (data.timerMinutes > 0) {
        setTimeRemainingSeconds(data.timerMinutes * 60);
      }

      startTimeRef.current = Date.now();
      setSessionStarted(true);
    } catch (err: any) {
      setError(err.message || 'Kon toetssessie niet starten.');
    }
  };

  // Unlock by maker passcode (local code entry)
  const handleUnlock = async () => {
    if (!unlockPasscode.trim()) return;
    setUnlocking(true);
    setUnlockError(null);

    try {
      const res = await fetch(`/api/submissions/${submissionUid}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: unlockPasscode.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Onjuiste code');
      }

      // Re-enter fullscreen and resume
      setIsLocked(false);
      setUnlockPasscode('');
      setRemoteUnlockNotice('Toets ontgrendeld met beveiligingscode.');
      if (formData.isExamSecure) {
        await enterFullscreen();
      }
      setTimeout(() => setRemoteUnlockNotice(null), 5000);
    } catch (err: any) {
      setUnlockError(err.message || 'Kon toets niet ontgrendelen.');
    } finally {
      setUnlocking(false);
    }
  };

  // Exit to Homepage and delete all entered answers
  const handleConfirmExitToHome = async () => {
    setIsExiting(true);
    try {
      if (submissionUid && !submissionResult) {
        await fetch(`/api/submissions/${submissionUid}`, {
          method: 'DELETE',
        });
      }
    } catch (err) {
      console.error('Error discarding submission:', err);
    } finally {
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {}
      }
      setIsExiting(false);
      setShowExitConfirm(false);
      onExit();
    }
  };

  // Final submit
  const handleFinalSubmit = async () => {
    if (submitting || submissionResult) return;
    setSubmitting(true);

    const timeSpentSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
    const answersPayload = (formData.questions || []).map((q: Question) => ({
      questionId: q.id,
      answerValue: answers[q.id!] || '',
    }));

    try {
      const res = await fetch(`/api/submissions/${submissionUid}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: answersPayload,
          timeSpentSeconds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Fout bij inleveren');
      }

      // Exit fullscreen if active
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {}
      }

      setSubmissionResult(data);
    } catch (err: any) {
      alert('Fout bij inleveren: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
        <p className="text-sm font-semibold text-slate-600">Formulier laden...</p>
      </div>
    );
  }

  if (error && !sessionStarted) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-2xl border border-rose-200 shadow-sm text-center">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900 mb-1">Toegang Geweigerd of Fout</h3>
        <p className="text-xs text-slate-600 mb-4">{error}</p>
        <button
          onClick={onExit}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors"
        >
          Terug naar Homepage
        </button>
      </div>
    );
  }

  // 1. If result submitted -> Render Review
  if (submissionResult) {
    return (
      <SubmissionReview
        submissionResult={submissionResult}
        allowReview={formData.allowReview}
        onExit={onExit}
      />
    );
  }

  // 2. If Locked Out -> Render Fullscreen Lock Screen
  if (isLocked) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col items-center justify-center p-4 sm:p-6 select-none">
        
        {/* Top bar on locked screen with Homepage exit button */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <span className="text-xs font-mono text-slate-500">{formData.title}</span>
          <button
            type="button"
            onClick={() => setShowExitConfirm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/80 hover:text-rose-200 text-slate-400 font-semibold text-xs border border-slate-800 hover:border-rose-800 transition-all"
            title="Toets definitief verlaten en antwoorden wissen"
          >
            <Home className="w-3.5 h-3.5" />
            Homepage (Wis antwoorden)
          </button>
        </div>

        <div className="max-w-md w-full bg-slate-900 border border-rose-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-200">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Toets Vergrendeld
            </span>
            <h2 className="text-xl font-bold text-white mt-2">Onbevoegde Onderbreking</h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {lockReason || 'Het volledige scherm is verlaten of u bent naar een ander tabblad gewisseld.'}
            </p>
          </div>

          {/* Remote unlock waiting badge */}
          <div className="p-3 bg-indigo-950/60 border border-indigo-500/30 rounded-2xl flex items-center gap-3 text-left">
            <div className="relative flex items-center justify-center shrink-0 w-3 h-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-indigo-200">Docent kan u op afstand weer toevoegen</p>
              <p className="text-[10px] text-slate-400 leading-tight">
                De maker kan u direct via het docentendashboard weer toelaten. Zodra dit gebeurt, hervat deze pagina automatisch!
              </p>
            </div>
          </div>

          {/* Local passcode entry (behou de code) */}
          <div className="pt-2 border-t border-slate-800 space-y-2.5">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider text-left">
              Of voer ter plekke de docentcode in:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={unlockPasscode}
                onChange={(e) => setUnlockPasscode(e.target.value)}
                placeholder="Code invoeren..."
                className="flex-1 text-sm bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-center font-mono font-bold tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-rose-500/50"
              />
              <button
                type="button"
                onClick={handleUnlock}
                disabled={unlocking || !unlockPasscode.trim()}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
              >
                {unlocking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                Ontgrendel
              </button>
            </div>
            {unlockError && (
              <p className="text-xs text-rose-400 font-medium text-left">{unlockError}</p>
            )}
          </div>

          {/* Homepage Button on locked card */}
          <div className="pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowExitConfirm(true)}
              className="text-xs text-slate-400 hover:text-rose-400 transition-colors flex items-center justify-center gap-1.5 mx-auto"
            >
              <Home className="w-3.5 h-3.5" />
              Toets verlaten & terug naar Homepage
            </button>
          </div>
        </div>

        {/* Exit Confirmation Modal */}
        {showExitConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Toets verlaten & antwoorden wissen?
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Let op: als u nu terugkeert naar de homepage worden al uw tot nu toe ingevulde toetsantwoorden en deze toetssessie <strong>direct en definitief verwijderd</strong>!
                </p>
              </div>

              <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200 text-xs text-rose-800 text-left font-medium">
                ⚠️ Uw antwoorden gaan verloren en er wordt geen score geregistreerd.
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExitConfirm(false)}
                  disabled={isExiting}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors"
                >
                  Blijf in de Toets
                </button>
                <button
                  type="button"
                  onClick={handleConfirmExitToHome}
                  disabled={isExiting}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
                >
                  {isExiting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Home className="w-4 h-4" />}
                  Ja, wis antwoorden & naar homepage
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. Pre-Exam Start Screen
  if (!sessionStarted) {
    return (
      <div className="max-w-xl mx-auto my-8 p-6 sm:p-8 bg-white rounded-3xl border border-slate-200 shadow-xl space-y-6">
        <div className="flex items-center justify-between pb-2">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            Homepage
          </button>
          <span 
            className="inline-block text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full text-white"
            style={{ backgroundColor: formData.themeColor || '#4f46e5' }}
          >
            {formData.mode === 'exam' ? 'Examentoets' : formData.mode === 'practice' ? 'Oefentoets' : 'Vragenlijst'}
          </span>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{formData.title}</h1>
          {formData.description && (
            <p className="text-xs text-slate-600 leading-relaxed">{formData.description}</p>
          )}
        </div>

        {/* Exam Conditions & Security Notice */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                {formData.timerMinutes > 0 ? `${formData.timerMinutes} minuten` : 'Geen tijdslimiet'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <Sparkles className="w-4 h-4 text-violet-600 shrink-0" />
              <span>AI Beoordeling: {formData.aiGradingEnabled ? 'Actief' : 'Handmatig'}</span>
            </div>
          </div>

          {formData.isExamSecure && (
            <div className="pt-2 border-t border-slate-200/60 flex items-start gap-2.5 text-amber-800 bg-amber-50/80 p-3 rounded-xl border border-amber-200">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <p className="font-bold">Beveiligde Toetsstand van toepassing:</p>
                <p>
                  Bij het starten wordt het volledige scherm geactiveerd. Het verlaten van het scherm of schakelen tussen applicaties vergrendelt direct uw toets. De maker kan u met een code of op afstand weer toelaten.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Identity Inputs based on submissionPolicy */}
        {formData.submissionPolicy !== 'anonymous' ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                E-mailadres <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                value={respondentEmail}
                onChange={(e) => setRespondentEmail(e.target.value)}
                placeholder="naam@school.nl"
                required
                className="w-full text-sm rounded-xl border border-slate-200 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Volledige Naam (Optioneel)
              </label>
              <input
                type="text"
                value={respondentName}
                onChange={(e) => setRespondentName(e.target.value)}
                placeholder="Voornaam Achternaam"
                className="w-full text-sm rounded-xl border border-slate-200 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>
          </div>
        ) : (
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span>U vult deze vragenlijst volledig anoniem in. Er wordt geen e-mailadres opgeslagen.</span>
          </div>
        )}

        {error && (
          <p className="text-xs text-rose-600 font-semibold text-center">{error}</p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onExit}
            className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
          >
            <Home className="w-4 h-4" />
            Homepage
          </button>
          <button
            type="button"
            onClick={handleStartExam}
            className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-100 flex items-center justify-center gap-2 transition-all"
          >
            {formData.isExamSecure ? <Maximize2 className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            {formData.isExamSecure ? 'Start Toets in Volledig Scherm' : 'Start Toets / Vragenlijst'}
          </button>
        </div>
      </div>
    );
  }

  // 4. In-Progress Exam Question Runner
  const currentQ: Question = formData.questions[currentQuestionIndex];
  const totalQuestions = formData.questions.length;
  const answeredCount = Object.keys(answers).filter((k) => answers[Number(k)]?.trim()).length;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Sticky Test Header Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Homepage button with warning */}
            <button
              type="button"
              onClick={() => setShowExitConfirm(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 text-slate-600 font-semibold text-xs shadow-2xs transition-all"
              title="Toets verlaten & antwoorden wissen"
            >
              <Home className="w-3.5 h-3.5 text-rose-500" />
              <span className="font-bold">Homepage</span>
            </button>

            <span className="font-bold text-sm text-slate-900 truncate max-w-xs sm:max-w-md">
              {formData.title}
            </span>
            {formData.isExamSecure && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Maximize2 className="w-3 h-3" /> Fullscreen Beveiligd
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {timeRemainingSeconds !== null && (
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-mono text-xs font-bold border transition-colors ${
                timeRemainingSeconds < 120
                  ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                <Clock className="w-3.5 h-3.5" />
                <span>{formatTimer(timeRemainingSeconds)}</span>
              </div>
            )}

            <button
              onClick={handleFinalSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Inleveren ({answeredCount}/{totalQuestions})
            </button>
          </div>
        </div>

        {/* Remote unlock notification banner */}
        {remoteUnlockNotice && (
          <div className="max-w-4xl mx-auto mt-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between animate-in fade-in duration-200">
            <span>✓ {remoteUnlockNotice}</span>
            <button onClick={() => setRemoteUnlockNotice(null)} className="text-emerald-600 font-bold ml-2">×</button>
          </div>
        )}

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 h-1 mt-2.5 rounded-full overflow-hidden">
          <div
            className="bg-indigo-600 h-1 transition-all duration-300"
            style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
          />
        </div>
      </header>

      {/* Main Question Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 my-4 flex flex-col justify-between">
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          {/* Question Metadata Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                {currentQuestionIndex + 1}
              </span>
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                {currentQ.category || 'Algemeen'}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 font-mono">
              <span>{currentQ.points || 1} pt</span>
              <span>•</span>
              <span>Vraag {currentQuestionIndex + 1} van {totalQuestions}</span>
            </div>
          </div>

          {/* Question Prompt */}
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              {currentQ.questionText}
            </h2>
            {currentQ.questionType === 'open' && (
              <p className="text-xs text-violet-600 font-medium flex items-center gap-1 pt-1">
                <Sparkles className="w-3.5 h-3.5" />
                Automatische AI-beoordeling na inlevering
              </p>
            )}
          </div>

          {/* Answer Inputs based on Question Type */}
          <div className="pt-2">
            {currentQ.questionType === 'multiple_choice' && (
              <div className="space-y-2.5">
                {(currentQ.options || []).map((option, optIdx) => {
                  const isSelected = answers[currentQ.id!] === option;
                  return (
                    <label
                      key={optIdx}
                      className={`flex items-center gap-3.5 p-4 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/70 shadow-xs ring-2 ring-indigo-500/20'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${currentQ.id}`}
                        value={option}
                        checked={isSelected}
                        onChange={() => setAnswers({ ...answers, [currentQ.id!]: option })}
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
            )}

            {currentQ.questionType === 'open' && (
              <div className="space-y-2">
                <textarea
                  rows={6}
                  value={answers[currentQ.id!] || ''}
                  onChange={(e) => setAnswers({ ...answers, [currentQ.id!]: e.target.value })}
                  placeholder="Typ hier uw antwoord. Wees zo volledig en nauwkeurig mogelijk..."
                  className="w-full text-sm rounded-2xl border border-slate-200 p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 leading-relaxed"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                  <span>{(answers[currentQ.id!] || '').length} tekens</span>
                  <span>Opbouwende feedback wordt berekend o.b.v. criteria</span>
                </div>
              </div>
            )}

            {currentQ.questionType === 'checkbox' && (
              <div className="space-y-2.5">
                {(currentQ.options || []).map((option, optIdx) => {
                  const currentSelected = (answers[currentQ.id!] || '').split(';').map((s) => s.trim()).filter(Boolean);
                  const isChecked = currentSelected.includes(option);

                  const toggleCheck = () => {
                    let updated: string[];
                    if (isChecked) {
                      updated = currentSelected.filter((s) => s !== option);
                    } else {
                      updated = [...currentSelected, option];
                    }
                    setAnswers({ ...answers, [currentQ.id!]: updated.join(';') });
                  };

                  return (
                    <label
                      key={optIdx}
                      onClick={toggleCheck}
                      className={`flex items-center gap-3.5 p-4 rounded-2xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'border-indigo-600 bg-indigo-50/70 shadow-xs ring-2 ring-indigo-500/20'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 bg-white'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                          isChecked ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                      <span className="text-sm font-semibold text-slate-800">{option}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Navigation Buttons */}
        <div className="flex items-center justify-between pt-6">
          <button
            type="button"
            disabled={currentQuestionIndex === 0}
            onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs disabled:opacity-30 hover:bg-white transition-all shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
            Vorige Vraag
          </button>

          {/* Quick jump dots */}
          <div className="hidden sm:flex items-center gap-1.5">
            {formData.questions.map((_: any, idx: number) => {
              const isAns = answers[formData.questions[idx].id!]?.trim();
              const isCurr = idx === currentQuestionIndex;
              return (
                <button
                  key={idx}
                  onClick={() => setCurrentQuestionIndex(idx)}
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

          {currentQuestionIndex < totalQuestions - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentQuestionIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs transition-all"
            >
              Volgende Vraag
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition-all"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Afronden & Inleveren
            </button>
          )}
        </div>
      </main>

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Toets verlaten & antwoorden wissen?
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Weet u zeker dat u wilt terugkeren naar de homepage? Als u bevestigt, worden al uw ingevulde toetsantwoorden en deze toetssessie <strong>direct en definitief verwijderd</strong>!
              </p>
            </div>

            <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-200 text-xs text-rose-800 text-left font-medium">
              ⚠️ Al uw ingevulde antwoorden gaan verloren en er wordt geen score geregistreerd.
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                disabled={isExiting}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors"
              >
                Blijf in de Toets
              </button>
              <button
                type="button"
                onClick={handleConfirmExitToHome}
                disabled={isExiting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
              >
                {isExiting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Home className="w-4 h-4" />}
                Ja, wis antwoorden & naar homepage
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
