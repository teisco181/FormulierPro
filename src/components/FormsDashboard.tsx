import React, { useState } from 'react';
import { 
  PlusCircle, 
  FileText, 
  BarChart3, 
  Edit3, 
  Trash2, 
  Play, 
  Copy, 
  Check, 
  Clock, 
  ShieldAlert, 
  Sparkles,
  Layers,
  FolderOpen,
  LogIn,
  UserPlus
} from 'lucide-react';
import { FormModel } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';

interface FormsDashboardProps {
  forms: FormModel[];
  loading: boolean;
  onNewForm: () => void;
  onEditForm: (form: FormModel) => void;
  onDeleteForm: (formUid: string) => Promise<void>;
  onTakeForm: (formUid: string) => void;
  onViewAnalytics: (formUid: string) => void;
  onSeedSample: () => Promise<void>;
}

export const FormsDashboard: React.FC<FormsDashboardProps> = ({
  forms,
  loading,
  onNewForm,
  onEditForm,
  onDeleteForm,
  onTakeForm,
  onViewAnalytics,
  onSeedSample,
}) => {
  const { user, openAuthModal } = useAuth();
  const [copiedUid, setCopiedUid] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const handleCopyLink = (formUid: string) => {
    const url = `${window.location.origin}?form=${formUid}`;
    navigator.clipboard.writeText(url);
    setCopiedUid(formUid);
    setTimeout(() => setCopiedUid(null), 2500);
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await onSeedSample();
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-200">
      {/* Hero Welcome Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
              FormulierPro Maker Studio
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Vragenlijsten, Toetsen & Voortgangsanalyses
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl leading-relaxed">
            Beheer interactieve toetsen met beveiligde fullscreen toetsstand, AI automatische beoordeling van open vragen, shuffling binnen categorieën en Cloud SQL voortgangsstatistieken.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {user ? (
            <button
              onClick={onNewForm}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-100 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              Nieuw Formulier / Toets
            </button>
          ) : (
            <>
              <button
                onClick={() => openAuthModal('login')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-100 transition-all"
              >
                <LogIn className="w-4 h-4" />
                Inloggen (Google of E-mail)
              </button>
              <button
                onClick={() => openAuthModal('register')}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all"
              >
                <UserPlus className="w-4 h-4" />
                Registreren
              </button>
            </>
          )}
        </div>
      </div>

      {/* Forms Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-indigo-600" />
            Mijn Aangemaakte Toetsen & Formulieren ({forms.length})
          </h2>

          {user && forms.length === 0 && (
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200 flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {seeding ? 'Voorbeeldtoets aanmaken...' : 'Laad kant-en-klaar voorbeeld'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-3xl p-6 border border-slate-200 h-56 animate-pulse" />
            ))}
          </div>
        ) : !user ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-10 sm:p-12 text-center max-w-lg mx-auto space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <LogIn className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Log in om uw toetsen te beheren</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                U kunt inloggen met uw Google-account of u registreren en inloggen met een e-mailadres (ook Gmail) en wachtwoord.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => openAuthModal('login')}
                className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                Inloggen
              </button>
              <button
                onClick={() => openAuthModal('register')}
                className="px-4 py-2.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold hover:bg-indigo-100 transition-all flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Nieuw account registreren
              </button>
            </div>
          </div>
        ) : forms.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center max-w-lg mx-auto space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Nog geen formulieren aangemaakt</h3>
              <p className="text-xs text-slate-500 mt-1">
                Begin direct met een nieuwe toets of laad ons complete demonstratie-examen met categorieën en AI beoordeling.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={handleSeed}
                disabled={seeding}
                className="px-4 py-2.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold hover:bg-indigo-100 transition-all flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Voorbeeldtoets Inladen
              </button>
              <button
                onClick={onNewForm}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Zelf Toets Maken
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {forms.map((form) => {
              const isExam = form.mode === 'exam';
              const isSecure = form.isExamSecure === 1;

              return (
                <div
                  key={form.formUid}
                  className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    {/* Header tags */}
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: form.themeColor || '#4f46e5' }}
                      >
                        {form.mode === 'exam' ? 'Toetsstand' : form.mode === 'practice' ? 'Oefentoets' : 'Enquête'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {isSecure && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200"
                            title="Fullscreen vergrendeling actief"
                          >
                            <ShieldAlert className="w-3 h-3" /> Beveiligd
                          </span>
                        )}
                        {form.timerMinutes > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            <Clock className="w-3 h-3" /> {form.timerMinutes}m
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3 className="font-bold text-slate-900 text-base leading-snug group-hover:text-indigo-600 transition-colors line-clamp-2">
                        {form.title}
                      </h3>
                      {form.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                          {form.description}
                        </p>
                      )}
                    </div>

                    {/* Attributes */}
                    <div className="flex items-center gap-3 text-[11px] font-medium text-slate-400 pt-1">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" />
                        {form.shuffleQuestions === 1 ? 'Shuffling aan' : 'Vaste volgorde'}
                      </span>
                      <span>•</span>
                      <span>
                        {form.submissionPolicy === 'single_email'
                          ? '1x invullen'
                          : form.submissionPolicy === 'multiple_email'
                          ? 'Meerdere pogingen'
                          : 'Anoniem'}
                      </span>
                    </div>
                  </div>

                  {/* Actions Bottom Bar */}
                  <div className="pt-5 mt-5 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onTakeForm(form.formUid)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-2xs transition-all"
                        title="Start deze toets als kandidaat"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Toetsen
                      </button>

                      <button
                        onClick={() => onViewAnalytics(form.formUid)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-colors"
                        title="Bekijk SQL resultaten, grafieken en rapporten"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        Analyses
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopyLink(form.formUid)}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                        title="Kopieer kandidaat-deelnamelink"
                      >
                        {copiedUid === form.formUid ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        onClick={() => onEditForm(form)}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                        title="Toets bewerken"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          if (confirm('Weet u zeker dat u dit formulier en alle opgeslagen resultaten wilt verwijderen?')) {
                            onDeleteForm(form.formUid);
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                        title="Formulier verwijderen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
