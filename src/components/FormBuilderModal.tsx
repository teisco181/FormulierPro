import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Plus, 
  Trash2, 
  Sparkles, 
  FileSpreadsheet, 
  ShieldAlert, 
  Clock, 
  Shuffle, 
  Sliders, 
  CheckCircle2, 
  Eye, 
  Key, 
  Mail, 
  HelpCircle,
  FolderTree,
  ChevronDown
} from 'lucide-react';
import { FormModel, Question, QuestionType, FormMode, SubmissionPolicy } from '../types/index.ts';
import { AiQuestionModal } from './AiQuestionModal.tsx';
import { CsvImportModal } from './CsvImportModal.tsx';

interface FormBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  formToEdit: FormModel | null;
  onSave: (formData: any) => Promise<void>;
  getToken: () => Promise<string | null>;
}

export const FormBuilderModal: React.FC<FormBuilderModalProps> = ({
  isOpen,
  onClose,
  formToEdit,
  onSave,
  getToken,
}) => {
  const [activeTab, setActiveTab] = useState<'questions' | 'settings'>('questions');
  
  // Basic info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<FormMode>('exam');
  const [themeColor, setThemeColor] = useState('#4f46e5');
  
  // Security & Test mode
  const [isExamSecure, setIsExamSecure] = useState(true);
  const [securityPasscode, setSecurityPasscode] = useState('1234');
  const [timerMinutes, setTimerMinutes] = useState(0);

  // Category & Shuffling
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [maxQuestionsTotal, setMaxQuestionsTotal] = useState<number | ''>('');
  const [categoryQuotas, setCategoryQuotas] = useState<Record<string, number>>({});

  // Submission policy
  const [submissionPolicy, setSubmissionPolicy] = useState<SubmissionPolicy>('multiple_email');
  const [allowReview, setAllowReview] = useState(true);

  // AI & OpenAI Key
  const [aiGradingEnabled, setAiGradingEnabled] = useState(true);
  const [openAiKey, setOpenAiKey] = useState('');

  // Questions
  const [questionsList, setQuestionsList] = useState<Question[]>([]);

  // Modals
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (formToEdit) {
      setTitle(formToEdit.title || '');
      setDescription(formToEdit.description || '');
      setMode(formToEdit.mode || 'exam');
      setThemeColor(formToEdit.themeColor || '#4f46e5');
      setIsExamSecure(formToEdit.isExamSecure === 1);
      setSecurityPasscode(formToEdit.securityPasscode || '1234');
      setTimerMinutes(formToEdit.timerMinutes || 0);
      setShuffleQuestions(formToEdit.shuffleQuestions === 1);
      setMaxQuestionsTotal(formToEdit.maxQuestionsTotal ?? '');
      setSubmissionPolicy(formToEdit.submissionPolicy || 'multiple_email');
      setAllowReview(formToEdit.allowReview === 1);
      setAiGradingEnabled(formToEdit.aiGradingEnabled === 1);
      setOpenAiKey(formToEdit.openAiKey || '');
      setQuestionsList(formToEdit.questions || []);

      if (formToEdit.categoryQuotas) {
        try {
          setCategoryQuotas(JSON.parse(formToEdit.categoryQuotas));
        } catch {
          setCategoryQuotas({});
        }
      }
    } else {
      // Default new form
      setTitle('Nieuwe Toets');
      setDescription('Vul de onderstaande vragen in. Let op: beveiligde toetsstand is geactiveerd.');
      setMode('exam');
      setThemeColor('#4f46e5');
      setIsExamSecure(true);
      setSecurityPasscode('1234');
      setTimerMinutes(20);
      setShuffleQuestions(true);
      setMaxQuestionsTotal('');
      setCategoryQuotas({});
      setSubmissionPolicy('multiple_email');
      setAllowReview(true);
      setAiGradingEnabled(true);
      setOpenAiKey('');
      setQuestionsList([
        {
          category: 'Algemeen',
          questionType: 'multiple_choice',
          questionText: 'Wat is de hoofdstad van Nederland?',
          options: ['Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht'],
          correctAnswer: 'Amsterdam',
          points: 1,
          rubric: 'Amsterdam is de grondwettelijke hoofdstad van Nederland.',
        },
        {
          category: 'Aardrijkskunde',
          questionType: 'open',
          questionText: 'Leg kort uit waardoor aardbevingen in Groningen ontstaan en wat de gevolgen zijn voor bewoners.',
          correctAnswer: 'Gaswinning leidt tot bodemdaling en spanning in de aardlagen, waardoor geïnduceerde bevingen en schade aan woningen ontstaan.',
          points: 3,
          rubric: 'Benoem gaswinning als oorzaak en minstens één gevolg zoals schade aan gebouwen of emotionele stress.',
        },
      ]);
    }
  }, [formToEdit, isOpen]);

  if (!isOpen) return null;

  // Extract all categories from questions
  const distinctCategories = Array.from(new Set(questionsList.map((q) => q.category?.trim() || 'Algemeen')));

  const handleAddQuestion = (type: QuestionType = 'multiple_choice') => {
    const newQ: Question = {
      category: distinctCategories[0] || 'Algemeen',
      questionType: type,
      questionText: '',
      options: type === 'multiple_choice' ? ['Optie 1', 'Optie 2', 'Optie 3', 'Optie 4'] : undefined,
      correctAnswer: type === 'multiple_choice' ? 'Optie 1' : '',
      points: type === 'open' ? 2 : 1,
      rubric: '',
    };
    setQuestionsList([...questionsList, newQ]);
  };

  const handleUpdateQuestion = (index: number, field: keyof Question, value: any) => {
    const updated = [...questionsList];
    updated[index] = { ...updated[index], [field]: value };
    setQuestionsList(updated);
  };

  const handleDeleteQuestion = (index: number) => {
    setQuestionsList(questionsList.filter((_, i) => i !== index));
  };

  const handleAddOption = (qIndex: number) => {
    const updated = [...questionsList];
    const opts = [...(updated[qIndex].options || [])];
    opts.push(`Optie ${opts.length + 1}`);
    updated[qIndex].options = opts;
    setQuestionsList(updated);
  };

  const handleUpdateOption = (qIndex: number, optIndex: number, val: string) => {
    const updated = [...questionsList];
    const opts = [...(updated[qIndex].options || [])];
    const oldVal = opts[optIndex];
    opts[optIndex] = val;
    updated[qIndex].options = opts;
    if (updated[qIndex].correctAnswer === oldVal) {
      updated[qIndex].correctAnswer = val;
    }
    setQuestionsList(updated);
  };

  const handleDeleteOption = (qIndex: number, optIndex: number) => {
    const updated = [...questionsList];
    const opts = [...(updated[qIndex].options || [])];
    opts.splice(optIndex, 1);
    updated[qIndex].options = opts;
    if (opts.length > 0 && !opts.includes(updated[qIndex].correctAnswer || '')) {
      updated[qIndex].correctAnswer = opts[0];
    }
    setQuestionsList(updated);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert('Vul een titel in voor het formulier.');
      return;
    }
    if (questionsList.length === 0) {
      alert('Voeg minimaal één vraag toe.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        title,
        description,
        mode,
        isExamSecure: isExamSecure ? 1 : 0,
        securityPasscode,
        timerMinutes,
        shuffleQuestions: shuffleQuestions ? 1 : 0,
        maxQuestionsTotal: maxQuestionsTotal ? Number(maxQuestionsTotal) : null,
        categoryQuotas,
        submissionPolicy,
        allowReview: allowReview ? 1 : 0,
        aiGradingEnabled: aiGradingEnabled ? 1 : 0,
        openAiKey: openAiKey.trim() || null,
        themeColor,
        questions: questionsList,
      });
      onClose();
    } catch (err: any) {
      alert('Fout bij opslaan: ' + (err.message || 'Onbekende fout'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl max-w-5xl w-full h-[95vh] shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
          
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div 
                className="w-4 h-10 rounded-full"
                style={{ backgroundColor: themeColor }}
              />
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {formToEdit ? 'Formulier / Toets Bewerken' : 'Nieuw Formulier / Toets Aanmaken'}
                </h2>
                <p className="text-xs text-slate-500">
                  Beveiligde examenstand, categorieën, automatische AI beoordeling en SQL opslag
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center px-6 border-b border-slate-200 bg-white gap-6">
            <button
              onClick={() => setActiveTab('questions')}
              className={`py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'questions'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Vragen ({questionsList.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'settings'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Toets- & Beveiligingsinstellingen</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/60">
            {activeTab === 'questions' ? (
              <div className="space-y-6 max-w-4xl mx-auto">
                {/* General Title & Description Card */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Titel van de Toets / Vragenlijst
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Bijv. Eindexamentoets Moderne Geschiedenis"
                      className="w-full text-base font-bold rounded-xl border border-slate-200 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Omschrijving of Toelichting voor de leerling
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Instructies voor de kandidaat, toegestane hulpmiddelen, etc."
                      className="w-full text-sm rounded-xl border border-slate-200 px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
                        {mode === 'exam' ? 'Toetsstand (Beveiligd)' : mode === 'practice' ? 'Oefentoets' : 'Enquête'}
                      </span>
                      {timerMinutes > 0 && (
                        <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          <Clock className="w-3.5 h-3.5" /> {timerMinutes} min
                        </span>
                      )}
                      <span>Totaal punten: {questionsList.reduce((acc, q) => acc + (q.points || 1), 0)} pt</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAiModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 text-xs font-semibold shadow-2xs transition-all"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                        AI Vragen Maker
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsCsvModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-xs font-semibold shadow-2xs transition-all"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        CSV / Excel Importeren
                      </button>
                    </div>
                  </div>
                </div>

                {/* Questions List */}
                <div className="space-y-4">
                  {questionsList.map((q, qIndex) => (
                    <div
                      key={qIndex}
                      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs relative transition-all group"
                    >
                      {/* Top Bar of Question Card */}
                      <div className="flex items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                            {qIndex + 1}
                          </span>

                          {/* Category input */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-slate-400 uppercase">Categorie:</span>
                            <input
                              type="text"
                              value={q.category}
                              onChange={(e) => handleUpdateQuestion(qIndex, 'category', e.target.value)}
                              placeholder="Categorie (bijv. Wiskunde)"
                              className="text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200/80 focus:bg-white px-2.5 py-1 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Question Type selector */}
                          <select
                            value={q.questionType}
                            onChange={(e) => handleUpdateQuestion(qIndex, 'questionType', e.target.value as QuestionType)}
                            className="text-xs font-semibold rounded-lg border border-slate-200 px-2.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="multiple_choice">Meerkeuze</option>
                            <option value="open">Open Vraag (AI Beoordeling)</option>
                            <option value="checkbox">Selectievakjes (Meerdere antwoorden)</option>
                          </select>

                          {/* Points */}
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              max={20}
                              value={q.points}
                              onChange={(e) => handleUpdateQuestion(qIndex, 'points', Math.max(1, Number(e.target.value)))}
                              className="w-14 text-xs font-bold rounded-lg border border-slate-200 px-2 py-1 text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <span className="text-xs text-slate-400 font-semibold">pt</span>
                          </div>

                          {/* Delete question */}
                          <button
                            type="button"
                            onClick={() => handleDeleteQuestion(qIndex)}
                            className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg transition-colors"
                            title="Vraag verwijderen"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Question Text */}
                      <div className="mb-3">
                        <textarea
                          rows={2}
                          value={q.questionText}
                          onChange={(e) => handleUpdateQuestion(qIndex, 'questionText', e.target.value)}
                          placeholder="Typ hier de vraag..."
                          className="w-full text-sm font-medium rounded-xl border border-slate-200 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                        />
                      </div>

                      {/* Question Options / Rubric based on type */}
                      {q.questionType === 'multiple_choice' && (
                        <div className="space-y-2 pl-2 border-l-2 border-indigo-100">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Antwoordopties (klik op het rondje voor het juiste antwoord)
                          </p>
                          {(q.options || []).map((opt, optIndex) => {
                            const isCorrect = q.correctAnswer === opt;
                            return (
                              <div key={optIndex} className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQuestion(qIndex, 'correctAnswer', opt)}
                                  className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                                    isCorrect
                                      ? 'border-emerald-600 bg-emerald-600 text-white'
                                      : 'border-slate-300 hover:border-emerald-500 bg-white'
                                  }`}
                                  title="Markeer als juist antwoord"
                                >
                                  {isCorrect && <CheckCircle2 className="w-3.5 h-3.5" />}
                                </button>
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => handleUpdateOption(qIndex, optIndex, e.target.value)}
                                  className={`flex-1 text-xs rounded-lg border px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                                    isCorrect ? 'border-emerald-300 bg-emerald-50/40 font-medium' : 'border-slate-200'
                                  }`}
                                />
                                {(q.options?.length || 0) > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteOption(qIndex, optIndex)}
                                    className="p-1 text-slate-300 hover:text-rose-500"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => handleAddOption(qIndex)}
                            className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1 pt-1"
                          >
                            <Plus className="w-3 h-3" /> Optie toevoegen
                          </button>
                        </div>
                      )}

                      {q.questionType === 'open' && (
                        <div className="space-y-3 bg-violet-50/50 p-3.5 rounded-xl border border-violet-100">
                          <div className="flex items-center gap-1.5 text-violet-800 text-xs font-bold uppercase tracking-wider">
                            <Sparkles className="w-4 h-4 text-violet-600" />
                            AI Beoordelingsrubriek & Modelantwoord
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Ideaal modelantwoord / Kernbegrippen
                            </label>
                            <input
                              type="text"
                              value={q.correctAnswer || ''}
                              onChange={(e) => handleUpdateQuestion(qIndex, 'correctAnswer', e.target.value)}
                              placeholder="Het exacte antwoord of de belangrijkste feiten/kernbegrippen..."
                              className="w-full text-xs rounded-lg border border-slate-200 px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Beoordelingscriteria voor automatische AI feedback
                            </label>
                            <textarea
                              rows={2}
                              value={q.rubric || ''}
                              onChange={(e) => handleUpdateQuestion(qIndex, 'rubric', e.target.value)}
                              placeholder="Waar moet de AI op letten bij het toekennen van de score en het geven van opbouwende feedback?"
                              className="w-full text-xs rounded-lg border border-slate-200 px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                            />
                          </div>
                        </div>
                      )}

                      {q.questionType === 'checkbox' && (
                        <div className="space-y-2 pl-2 border-l-2 border-indigo-100">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Opties (scheid de juiste antwoorden met een puntkomma ';')
                          </p>
                          {(q.options || []).map((opt, optIndex) => (
                            <div key={optIndex} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => handleUpdateOption(qIndex, optIndex, e.target.value)}
                                className="flex-1 text-xs rounded-lg border border-slate-200 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                              {(q.options?.length || 0) > 2 && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteOption(qIndex, optIndex)}
                                  className="p-1 text-slate-300 hover:text-rose-500"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => handleAddOption(qIndex)}
                            className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1 pt-1"
                          >
                            <Plus className="w-3 h-3" /> Optie toevoegen
                          </button>
                          <div className="mt-2 pt-2 border-t border-slate-100">
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Juiste optie(s) gescheiden door puntkomma
                            </label>
                            <input
                              type="text"
                              value={q.correctAnswer || ''}
                              onChange={(e) => handleUpdateQuestion(qIndex, 'correctAnswer', e.target.value)}
                              placeholder="Bijv. Optie 1;Optie 3"
                              className="w-full text-xs rounded-lg border border-slate-200 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add Question Buttons */}
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handleAddQuestion('multiple_choice')}
                      className="px-4 py-2.5 rounded-xl border border-dashed border-indigo-300 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      + Meerkeuzevraag
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestion('open')}
                      className="px-4 py-2.5 rounded-xl border border-dashed border-violet-300 text-violet-700 bg-violet-50/50 hover:bg-violet-50 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                      + Open Vraag (AI)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestion('checkbox')}
                      className="px-4 py-2.5 rounded-xl border border-dashed border-slate-300 text-slate-700 bg-white hover:bg-slate-50 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      + Selectievakjes
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Settings Tab */
              <div className="space-y-6 max-w-3xl mx-auto">
                {/* 1. Mode & Fullscreen Toetsstand */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Toetsmodus & Beveiliging</h4>
                      <p className="text-xs text-slate-500">Kies het type formulier en schermbeveiliging</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setMode('exam')}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        mode === 'exam'
                          ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <p className="text-xs font-bold text-slate-900 mb-0.5">Toetsstand</p>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        Strikte fullscreen modus, puntentelling en docent-deblokkering.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode('practice')}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        mode === 'practice'
                          ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <p className="text-xs font-bold text-slate-900 mb-0.5">Oefentoets</p>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        Vrij oefenen met scores, zonder harde schermblokkade.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode('survey')}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        mode === 'survey'
                          ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <p className="text-xs font-bold text-slate-900 mb-0.5">Enquête / Survey</p>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        Informatie verzamelen zonder punten of examensfeer.
                      </p>
                    </button>
                  </div>

                  {mode === 'exam' && (
                    <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-amber-900">Beveiligde Toetsstand (Fullscreen Lock)</p>
                          <p className="text-[11px] text-amber-700">
                            Als een leerling fullscreen verlaat of naar een ander tabblad gaat, wordt de toets vergrendeld. Alleen de docent kan hen dan ontgrendelen voor de resterende toetsperiode.
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={isExamSecure}
                            onChange={(e) => setIsExamSecure(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                        </label>
                      </div>

                      {isExamSecure && (
                        <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-slate-800">Docenten Ontgrendelcode (Passcode)</p>
                            <p className="text-[11px] text-slate-500">
                              Voer deze code in op het scherm van de leerling om hem/haar direct terug te voegen.
                            </p>
                          </div>
                          <input
                            type="text"
                            value={securityPasscode}
                            onChange={(e) => setSecurityPasscode(e.target.value)}
                            placeholder="1234"
                            className="w-28 text-center text-sm font-mono font-bold rounded-lg border border-slate-300 bg-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Timer */}
                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <p className="text-xs font-bold text-slate-800">Optionele Toetstimer (in minuten)</p>
                      <p className="text-[11px] text-slate-500">0 = Onbeperkte tijd. Na afloop wordt de toets automatisch ingeleverd.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={300}
                        value={timerMinutes}
                        onChange={(e) => setTimerMinutes(Math.max(0, Number(e.target.value)))}
                        className="w-20 text-center text-xs font-bold rounded-lg border border-slate-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <span className="text-xs text-slate-500 font-medium">minuten</span>
                    </div>
                  </div>
                </div>

                {/* 2. Categorieën & Shuffling & Quota */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Shuffle className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Shuffelen & Categorie Quota's</h4>
                      <p className="text-xs text-slate-500">Willekeurige selectie en categorie-indeling</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800">Vragen automatisch shuffelen binnen categorieën</p>
                      <p className="text-[11px] text-slate-500">Elke kandidaat krijgt de vragen in een willekeurige volgorde.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={shuffleQuestions}
                        onChange={(e) => setShuffleQuestions(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div>
                      <p className="text-xs font-bold text-slate-800">Maximaal totaal aantal vragen</p>
                      <p className="text-[11px] text-slate-500">Leeg laten om alle beschikbare vragen te tonen.</p>
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={maxQuestionsTotal}
                      onChange={(e) => setMaxQuestionsTotal(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Alles"
                      className="w-24 text-center text-xs font-bold rounded-lg border border-slate-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {distinctCategories.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <p className="text-xs font-bold text-slate-800">Aantal vragen selecteren per categorie (optioneel):</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {distinctCategories.map((cat) => (
                          <div key={cat} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-200">
                            <span className="text-xs font-semibold text-slate-700">{cat}</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={0}
                                value={categoryQuotas[cat] ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? undefined : Number(e.target.value);
                                  const copy = { ...categoryQuotas };
                                  if (val === undefined || val <= 0) {
                                    delete copy[cat];
                                  } else {
                                    copy[cat] = val;
                                  }
                                  setCategoryQuotas(copy);
                                }}
                                placeholder="Alle"
                                className="w-16 text-center text-xs font-bold bg-white rounded border border-slate-200 py-1"
                              />
                              <span className="text-[11px] text-slate-400">vragen</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Inzendbeleid & E-mail opties */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Inzendbeleid & Privacy</h4>
                      <p className="text-xs text-slate-500">Stel in hoe vaak en met welke gegevens kandidaten kunnen deelnemen</p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      submissionPolicy === 'single_email' ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 hover:bg-slate-50'
                    }`}>
                      <input
                        type="radio"
                        name="submissionPolicy"
                        value="single_email"
                        checked={submissionPolicy === 'single_email'}
                        onChange={() => setSubmissionPolicy('single_email')}
                        className="mt-1 text-blue-600"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900">1 keer invullen (e-mail verplicht & opslaan)</p>
                        <p className="text-[11px] text-slate-500">Elke kandidaat kan slechts één keer een poging indienen. Voorkomt dubbele inzendingen.</p>
                      </div>
                    </label>

                    <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      submissionPolicy === 'multiple_email' ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 hover:bg-slate-50'
                    }`}>
                      <input
                        type="radio"
                        name="submissionPolicy"
                        value="multiple_email"
                        checked={submissionPolicy === 'multiple_email'}
                        onChange={() => setSubmissionPolicy('multiple_email')}
                        className="mt-1 text-blue-600"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900">Meerdere keren invullen (e-mail verplicht & opslaan)</p>
                        <p className="text-[11px] text-slate-500">Kandidaten kunnen vaker oefenen en zien hun individuele voortgangsgeschiedenis terug in het dashboard.</p>
                      </div>
                    </label>

                    <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      submissionPolicy === 'anonymous' ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 hover:bg-slate-50'
                    }`}>
                      <input
                        type="radio"
                        name="submissionPolicy"
                        value="anonymous"
                        checked={submissionPolicy === 'anonymous'}
                        onChange={() => setSubmissionPolicy('anonymous')}
                        className="mt-1 text-blue-600"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900">Geen e-mail opslaan & anoniem invullen</p>
                        <p className="text-[11px] text-slate-500">Geen enkele identificatie of e-mail vereist. Volledig anonieme en onbeperkte deelname.</p>
                      </div>
                    </label>
                  </div>

                  {/* Review Mode Toggle */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Laat respondenten formulier en AI-beoordeling nakijken na afloop
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Kandidaten zien na het inleveren direct hun gegeven antwoorden, de juiste antwoorden en opbouwende AI-feedback.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowReview}
                        onChange={(e) => setAllowReview(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>

                {/* 4. AI Nakijken & OpenAI Key */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">AI Nakijken & API Key Integratie</h4>
                      <p className="text-xs text-slate-500">Automatische beoordeling van open vragen op basis van rubrieken</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800">Automatisch nakijken met AI inschakelen</p>
                      <p className="text-[11px] text-slate-500">Evalueert open vragen direct na inlevering en genereert cijfers + feedback.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={aiGradingEnabled}
                        onChange={(e) => setAiGradingEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      OpenAI API Key (Optioneel)
                    </label>
                    <input
                      type="password"
                      value={openAiKey}
                      onChange={(e) => setOpenAiKey(e.target.value)}
                      placeholder="sk-..."
                      className="w-full text-xs font-mono rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Indien leeg gelaten, gebruikt het systeem automatisch de geïntegreerde Gemini 2.5 Flash engine.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-white">
            <div className="text-xs text-slate-500">
              <span className="font-semibold text-slate-800">{questionsList.length}</span> vragen geconfigureerd
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors"
              >
                Annuleren
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5 transition-all"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Opslaan in SQL...' : 'Formulier Opslaan'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Question Modal */}
      <AiQuestionModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onAddQuestions={(newQs) => setQuestionsList([...questionsList, ...newQs])}
        openAiKey={openAiKey}
        getToken={getToken}
      />

      {/* CSV Import Modal */}
      <CsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onImportQuestions={(newQs) => setQuestionsList([...questionsList, ...newQs])}
      />
    </>
  );
};
