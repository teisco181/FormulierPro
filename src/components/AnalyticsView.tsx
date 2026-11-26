import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Download, 
  ArrowLeft, 
  Users, 
  Award, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Lock, 
  Unlock, 
  Search, 
  Filter, 
  Loader2, 
  AlertTriangle,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import { AnalyticsData, Submission } from '../types/index.ts';

interface AnalyticsViewProps {
  formUid: string;
  onBack: () => void;
  getToken: () => Promise<string | null>;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ formUid, onBack, getToken }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'locked'>('all');
  const [scoreFilter, setScoreFilter] = useState<'all' | 'passed' | 'failed'>('all');

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/forms/${formUid}/analytics`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Kon analyses niet laden');
      }

      const resData = await res.json();
      setData(resData);
    } catch (err: any) {
      setError(err.message || 'Fout bij het ophalen van resultaten.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [formUid]);

  // Export handlers
  const handleExport = async (format: 'xlsx' | 'csv') => {
    try {
      const token = await getToken();
      const res = await fetch(`/api/forms/${formUid}/export/${format === 'xlsx' ? 'excel' : 'csv'}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        throw new Error('Export mislukt');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data?.form.title || 'formulier'}_resultaten.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert('Kon bestand niet downloaden: ' + err.message);
    }
  };

  // Remote unlock by maker
  const handleUnlockStudent = async (subUid: string) => {
    try {
      const token = await getToken();
      const res = await fetch(`/api/submissions/${subUid}/unlock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ passcode: data?.form.securityPasscode }),
      });

      if (!res.ok) {
        throw new Error('Ontgrendelen mislukt');
      }

      alert('De leerling is succesvol ontgrendeld en kan weer verder met de toets!');
      fetchAnalytics();
    } catch (err: any) {
      alert('Fout bij ontgrendelen: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
        <p className="text-sm font-semibold text-slate-600">SQL Analyses & Grafieken ophalen...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-2xl border border-rose-200 shadow-sm text-center">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900 mb-1">Fout bij Laden</h3>
        <p className="text-xs text-slate-600 mb-4">{error || 'Geen gegevens beschikbaar.'}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors"
        >
          Terug naar Formulieren
        </button>
      </div>
    );
  }

  // Filter submissions
  const filteredSubmissions = data.submissions.filter((sub) => {
    // Search
    const searchLower = searchTerm.toLowerCase();
    const matchSearch =
      !searchTerm ||
      (sub.respondentName && sub.respondentName.toLowerCase().includes(searchLower)) ||
      (sub.respondentEmail && sub.respondentEmail.toLowerCase().includes(searchLower)) ||
      sub.submissionUid.toLowerCase().includes(searchLower);

    // Status
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'submitted' && sub.status === 'submitted') ||
      (statusFilter === 'locked' && sub.status === 'locked');

    // Score
    const matchScore =
      scoreFilter === 'all' ||
      (scoreFilter === 'passed' && sub.percentage >= 55) ||
      (scoreFilter === 'failed' && sub.percentage < 55);

    return matchSearch && matchStatus && matchScore;
  });

  const formatSeconds = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}m ${remainder}s`;
  };

  const lockedSubmissions = data.submissions.filter((sub) => sub.status === 'locked');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-200">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                SQL Analyses & Rapportage
              </span>
              <span className="text-xs text-slate-400">Docentenpaneel</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
              {data.form.title}
            </h1>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('xlsx')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Exporteer Excel (.xlsx)
          </button>

          <button
            onClick={() => handleExport('csv')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all"
          >
            <FileText className="w-4 h-4" />
            Exporteer CSV (.csv)
          </button>
        </div>
      </div>

      {/* Prominent Remote Re-Admission Banner for Locked Students */}
      {lockedSubmissions.length > 0 && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 shadow-xs animate-pulse-once">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-950 flex items-center gap-2">
                  <span>{lockedSubmissions.length} leerling(en) vergrendeld wegens verlaten van toetsscherm</span>
                  <span className="px-2 py-0.5 bg-rose-200 text-rose-800 text-[10px] font-extrabold uppercase rounded-full">
                    Actie Vereist
                  </span>
                </h3>
                <p className="text-xs text-rose-800 mt-0.5">
                  Als maker kunt u deze personen hier <strong>op afstand weer toevoegen</strong> zodat hun scherm automatisch ontgrendelt en ze direct kunnen doorgaan met de toets.
                </p>
              </div>
            </div>
            
            <button
              onClick={() => {
                // Unlock all currently locked students at once
                lockedSubmissions.forEach(sub => handleUnlockStudent(sub.submissionUid));
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all whitespace-nowrap self-start md:self-auto flex items-center gap-1.5"
            >
              <Unlock className="w-3.5 h-3.5" />
              Alles Op Afstand Deblokkeren
            </button>
          </div>

          <div className="mt-4 pt-3 border-t border-rose-200/80 flex flex-wrap gap-2">
            {lockedSubmissions.map((sub) => (
              <div key={sub.id} className="bg-white border border-rose-200 rounded-xl px-3 py-2 flex items-center gap-3 text-xs shadow-2xs">
                <div>
                  <span className="font-bold text-slate-900 block">{sub.respondentName || 'Anonieme Leerling'}</span>
                  <span className="text-[11px] text-slate-500 font-mono">{sub.respondentEmail || sub.submissionUid.slice(0, 10)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnlockStudent(sub.submissionUid)}
                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-2xs transition-all flex items-center gap-1"
                >
                  <Unlock className="w-3 h-3" />
                  Weer toevoegen
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-900">{data.totalSubmissions}</p>
            <p className="text-xs font-semibold text-slate-400 uppercase">Inzendingen</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-900">{data.avgPercentage}%</p>
            <p className="text-xs font-semibold text-slate-400 uppercase">Gemiddelde Score</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-900">{data.passRate}%</p>
            <p className="text-xs font-semibold text-slate-400 uppercase">Slagingspercentage (≥55%)</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-900">{formatSeconds(data.avgTimeSeconds)}</p>
            <p className="text-xs font-semibold text-slate-400 uppercase">Gem. Toetsduur</p>
          </div>
        </div>
      </div>

      {/* Advanced Visualizations Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Score Distribution Histogram */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Scoreverdeling Histogram</h3>
              <p className="text-xs text-slate-500">Aantal kandidaten per scorebereik</p>
            </div>
            <BarChart3 className="w-5 h-5 text-indigo-600" />
          </div>

          <div className="h-48 flex items-end justify-between gap-3 pt-6 pb-2 px-2">
            {data.scoreDistribution.map((item, idx) => {
              const maxCount = Math.max(1, ...data.scoreDistribution.map((d) => d.count));
              const heightPct = Math.round((item.count / maxCount) * 100);

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                  <span className="text-[11px] font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.count}
                  </span>
                  <div
                    className="w-full rounded-t-lg bg-indigo-500 group-hover:bg-indigo-600 transition-all shadow-2xs"
                    style={{ height: `${Math.max(6, heightPct)}%` }}
                  />
                  <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">
                    {item.range}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Performance Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Prestaties per Categorie</h3>
              <p className="text-xs text-slate-500">Gemiddelde beheersing en aantal beantwoordingen</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {data.categoryBreakdown.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Nog geen categoriegegevens beschikbaar.</p>
            ) : (
              data.categoryBreakdown.map((cat, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-800">{cat.category}</span>
                    <span className="text-indigo-600 font-bold">{cat.percentage}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Question Accuracy & Difficulty Ranking */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">Vraaganalyse & Moeilijkheidsgraad</h3>
          <p className="text-xs text-slate-500">Inzicht in welke vragen het vaakst goed of fout worden beantwoord</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Vraag</th>
                <th className="py-2.5 px-3">Categorie</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3 text-center">Inzendingen</th>
                <th className="py-2.5 px-3 text-center">Juistheid / Beheersing</th>
                <th className="py-2.5 px-3 text-right">Gem. Punten</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.questionAnalysis.map((q) => (
                <tr key={q.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-3 font-medium text-slate-900 max-w-sm truncate">
                    {q.questionText}
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[10px]">
                      {q.category}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-500 font-medium">
                    {q.questionType === 'multiple_choice' ? 'Meerkeuze' : 'Open vraag (AI)'}
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-slate-700">
                    {q.answeredCount}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`inline-block font-bold px-2 py-0.5 rounded ${
                      q.accuracyRate >= 70
                        ? 'bg-emerald-50 text-emerald-700'
                        : q.accuracyRate >= 45
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}>
                      {q.accuracyRate}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-800">
                    {q.averagePoints} / {q.points} pt
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Submissions Table with Live Filters & Admin Unlock */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Gedetailleerde Inzendingen ({filteredSubmissions.length})</h3>
            <p className="text-xs text-slate-500">Filter, bekijk antwoorden of deblokkeer leerlingen direct</p>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Zoek op naam of e-mail..."
                className="text-xs rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-44 sm:w-56"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-xs rounded-xl border border-slate-200 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Alle statussen</option>
              <option value="submitted">Ingediend</option>
              <option value="locked">Vergrendeld</option>
            </select>

            {/* Score Filter */}
            <select
              value={scoreFilter}
              onChange={(e) => setScoreFilter(e.target.value as any)}
              className="text-xs rounded-xl border border-slate-200 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">Alle scores</option>
              <option value="passed">Geslaagd (≥55%)</option>
              <option value="failed">Gezakt (&lt;55%)</option>
            </select>
          </div>
        </div>

        {/* Submissions List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Kandidaat</th>
                <th className="py-3 px-4">E-mail</th>
                <th className="py-3 px-4">Datum</th>
                <th className="py-3 px-4 text-center">Score</th>
                <th className="py-3 px-4 text-center">Percentage</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Geen inzendingen gevonden voor deze filters.
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub) => {
                  const isLocked = sub.status === 'locked';
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {sub.respondentName || 'Anoniem'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                        {sub.respondentEmail || 'Geen (Anoniem)'}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(sub.createdAt).toLocaleDateString('nl-NL', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800">
                        {sub.totalScore} / {sub.maxScore}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`font-bold px-2 py-0.5 rounded ${
                          sub.percentage >= 55 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {sub.percentage}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isLocked ? (
                          <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            <Lock className="w-3 h-3" /> Vergrendeld
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            <CheckCircle2 className="w-3 h-3" /> Ingediend
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isLocked ? (
                          <button
                            type="button"
                            onClick={() => handleUnlockStudent(sub.submissionUid)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] shadow-2xs transition-all"
                            title="Deblokkeer deze leerling zodat deze de toets kan afmaken"
                          >
                            <Unlock className="w-3 h-3" />
                            Deblokkeren
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">Voltooid</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
