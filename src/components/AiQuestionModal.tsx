import React, { useState } from 'react';
import { Sparkles, Loader2, X, Plus, Check } from 'lucide-react';
import { Question } from '../types/index.ts';

interface AiQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddQuestions: (questions: Question[]) => void;
  openAiKey?: string | null;
  getToken: () => Promise<string | null>;
}

export const AiQuestionModal: React.FC<AiQuestionModalProps> = ({
  isOpen,
  onClose,
  onAddQuestions,
  openAiKey,
  getToken,
}) => {
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      const res = await fetch('/api/ai/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          prompt,
          count,
          openAiKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Genereren mislukt');
      }

      setGeneratedQuestions(data.questions || []);
      setSelectedIndices(data.questions.map((_: any, i: number) => i));
    } catch (err: any) {
      setError(err.message || 'Kon geen vragen genereren met AI.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (index: number) => {
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter((i) => i !== index));
    } else {
      setSelectedIndices([...selectedIndices, index]);
    }
  };

  const handleApply = () => {
    const toAdd = generatedQuestions.filter((_, idx) => selectedIndices.includes(idx));
    onAddQuestions(toAdd);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">AI Vragen Generator</h3>
              <p className="text-xs text-slate-500">Genereer automatisch meerkeuze- en open vragen met antwoorden & rubrieken</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="py-4 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Onderwerp of instructie
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Bijv. Maak een toets over de Nederlandse Gouden Eeuw, met vragen over de VOC, Rembrandt en de wereldeconomie. Geschikt voor 4 VWO."
              className="w-full text-sm rounded-xl border border-slate-200 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Aantal vragen
              </label>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
              >
                <option value={3}>3 vragen</option>
                <option value={5}>5 vragen</option>
                <option value={8}>8 vragen</option>
                <option value={10}>10 vragen</option>
              </select>
            </div>

            <div className="flex-1 text-xs text-slate-500 pt-5">
              {openAiKey ? (
                <span className="text-emerald-600 font-medium">✓ OpenAI API Key actief</span>
              ) : (
                <span className="text-indigo-600 font-medium">✓ Gemini 2.5 Flash ingebouwd & direct beschikbaar</span>
              )}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Vragen genereren met AI...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Genereer Vragen
              </>
            )}
          </button>

          {/* Generated Questions List Preview */}
          {generatedQuestions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Gegenereerde Vragen ({selectedIndices.length}/{generatedQuestions.length} geselecteerd)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedIndices.length === generatedQuestions.length) {
                      setSelectedIndices([]);
                    } else {
                      setSelectedIndices(generatedQuestions.map((_, i) => i));
                    }
                  }}
                  className="text-xs text-indigo-600 font-semibold hover:underline"
                >
                  {selectedIndices.length === generatedQuestions.length ? 'Deselecteer alles' : 'Selecteer alles'}
                </button>
              </div>

              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {generatedQuestions.map((q, idx) => {
                  const isSelected = selectedIndices.includes(idx);
                  return (
                    <div
                      key={idx}
                      onClick={() => toggleSelect(idx)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'border-indigo-400 bg-indigo-50/50 shadow-xs'
                          : 'border-slate-200 bg-slate-50 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                              {q.category || 'Algemeen'}
                            </span>
                            <span className="text-[10px] font-semibold text-indigo-600">
                              {q.questionType === 'multiple_choice' ? 'Meerkeuze' : 'Open vraag'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {q.points} pt
                            </span>
                          </div>
                          <p className="text-xs font-medium text-slate-900 leading-snug">{q.questionText}</p>
                          {q.correctAnswer && (
                            <p className="text-[11px] text-slate-500 mt-1">
                              <span className="font-semibold text-emerald-600">Juist antwoord:</span> {q.correctAnswer}
                            </p>
                          )}
                          {q.rubric && (
                            <p className="text-[11px] text-slate-400 mt-0.5 italic">
                              Rubriek: {q.rubric}
                            </p>
                          )}
                        </div>

                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                            isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {generatedQuestions.length > 0 && (
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50"
            >
              Annuleren
            </button>
            <button
              onClick={handleApply}
              disabled={selectedIndices.length === 0}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Voeg {selectedIndices.length} Vragen Toe aan Formulier
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
