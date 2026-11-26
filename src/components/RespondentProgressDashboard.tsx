import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Award, 
  Clock, 
  CheckCircle2, 
  Search, 
  Loader2, 
  Sparkles, 
  BookOpen, 
  Calendar,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

export const RespondentProgressDashboard: React.FC = () => {
  const { user } = useAuth();
  const [emailInput, setEmailInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [categoryMastery, setCategoryMastery] = useState<any[]>([]);

  useEffect(() => {
    if (user?.email) {
      setEmailInput(user.email);
      fetchProgress(user.email);
    }
  }, [user]);

  const fetchProgress = async (emailToFetch: string) => {
    if (!emailToFetch.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/respondent/progress?email=${encodeURIComponent(emailToFetch.trim().toLowerCase())}`);
      const data = await res.json();
      setHistory(data.history || []);
      setCategoryMastery(data.categoryMastery || []);
    } catch (err) {
      console.error('Failed to fetch progress:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProgress(emailInput);
  };

  const avgScore = history.length > 0
    ? Math.round(history.reduce((acc, h) => acc + h.percentage, 0) / history.length)
    : 0;

  const highestScore = history.length > 0
    ? Math.max(...history.map((h) => h.percentage))
    : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="max-w-2xl space-y-3 relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/20">
              Persoonlijke Ontwikkeling
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Leerling Voortgangs Dashboard
          </h1>
          <p className="text-xs text-indigo-200 leading-relaxed">
            Bekijk uw historische toetsscores, analyseer uw beheersing per leercategorie en volg uw groei over tijd opgeslagen in de Cloud SQL database.
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex items-center gap-2 pt-2 max-w-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="Voer e-mailadres van leerling in..."
                required
                className="w-full text-xs rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-indigo-300/60 pl-9 pr-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs shadow-sm transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Zoek Voortgang'}
            </button>
          </form>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500 font-medium">Voortgangsgegevens ophalen...</p>
        </div>
      ) : searched && history.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto space-y-3">
          <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">Geen toetshistorie gevonden</h3>
          <p className="text-xs text-slate-500">
            Er zijn nog geen ingediende toetsen geregistreerd voor het e-mailadres <span className="font-semibold text-slate-700">{emailInput}</span>.
          </p>
        </div>
      ) : history.length > 0 ? (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-2xl font-extrabold text-slate-900">{history.length}</p>
              <p className="text-xs font-semibold text-slate-400 uppercase mt-0.5">Voltooide Toetsen</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-2xl font-extrabold text-indigo-600">{avgScore}%</p>
              <p className="text-xs font-semibold text-slate-400 uppercase mt-0.5">Gemiddelde Score</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-2xl font-extrabold text-emerald-600">{highestScore}%</p>
              <p className="text-xs font-semibold text-slate-400 uppercase mt-0.5">Hoogste Score</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-2xl font-extrabold text-violet-600">
                {history.filter((h) => h.percentage >= 55).length}
              </p>
              <p className="text-xs font-semibold text-slate-400 uppercase mt-0.5">Geslaagde Toetsen</p>
            </div>
          </div>

          {/* Visual Progress Graph (Timeline) */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Scoreverloop over de Tijd</h3>
                <p className="text-xs text-slate-500">Volg uw progressie per afgeronde toets</p>
              </div>
              <TrendingUp className="w-5 h-5 text-indigo-600" />
            </div>

            <div className="h-56 flex items-end justify-between gap-4 pt-8 pb-3 px-2 border-b border-slate-100">
              {history.map((h, idx) => {
                const isPassed = h.percentage >= 55;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                    <span className="text-[10px] font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      {h.percentage}%
                    </span>
                    <div
                      className={`w-full max-w-[40px] rounded-t-xl transition-all shadow-xs ${
                        isPassed ? 'bg-indigo-600 group-hover:bg-indigo-700' : 'bg-amber-500 group-hover:bg-amber-600'
                      }`}
                      style={{ height: `${Math.max(8, h.percentage)}%` }}
                    />
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-700 truncate max-w-[80px]">
                        {h.formTitle}
                      </p>
                      <p className="text-[9px] text-slate-400">
                        {new Date(h.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category Mastery */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Categorie Beheersing & Sterke Punten</h3>
                <p className="text-xs text-slate-500">Inzicht in welke onderwerpen al goed beheerst worden</p>
              </div>
              <Sparkles className="w-5 h-5 text-violet-600" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {categoryMastery.map((cat, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{cat.category}</span>
                    <span className={`text-xs font-extrabold ${
                      cat.percentage >= 75
                        ? 'text-emerald-600'
                        : cat.percentage >= 55
                        ? 'text-amber-600'
                        : 'text-rose-600'
                    }`}>
                      {cat.percentage}%
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        cat.percentage >= 75
                          ? 'bg-emerald-500'
                          : cat.percentage >= 55
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>

                  <p className="text-[10px] text-slate-400">
                    {cat.percentage >= 75 ? 'Uitstekende beheersing' : cat.percentage >= 55 ? 'Voldoende niveau' : 'Extra oefening aanbevolen'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
