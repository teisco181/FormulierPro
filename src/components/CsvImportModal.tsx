import React, { useState } from 'react';
import { FileSpreadsheet, X, Upload, Download, Check, AlertCircle } from 'lucide-react';
import { Question } from '../types/index.ts';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportQuestions: (questions: Question[]) => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({ isOpen, onClose, onImportQuestions }) => {
  const [csvText, setCsvText] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState<Question[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  if (!isOpen) return null;

  const sampleCsv = `Categorie,Type,Vraag,Opties,JuisteAntwoord,Rubriek,Punten
Geschiedenis,meerkeuze,Wat was het startjaar van de Eerste Wereldoorlog?,1914;1918;1939;1945,1914,Officiële datum van Sarajevo incident,1
Geschiedenis,open,Wat waren twee belangrijke oorzaken van de industriële revolutie in Engeland?,,Beschikbaarheid van steenkool en ijzererts; kapitaal en uitvinding stoommachine,Noem minstens twee plausibele economische of technologische factoren,2
Biologie,meerkeuze,Wat is de functie van mitochondriën in de cel?,Eiwitsynthese;Energieproductie (ATP);DNA opslag;Celwandvorming,Energieproductie (ATP),Mitochondriën zijn de energiecentrales van de cel,1
Biologie,open,Leg in eigen woorden uit wat osmose is.,,Verplaatsing van water door een semi-permeabel membraan van lage naar hoge osmotische waarde,Let op de vermelding van semi-permeabel membraan en concentratieverschil,3`;

  const handleDownloadSample = () => {
    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'toetsvragen_voorbeeld.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        setCsvText(text);
        parseCsv(text);
      }
    };
    reader.readAsText(file);
  };

  const parseCsv = (content: string) => {
    setParseError(null);
    try {
      const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '');
      if (lines.length < 2) {
        setParseError('Het bestand moet minimaal een kopregel en één vraag bevatten.');
        return;
      }

      // Check header
      const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const catIdx = header.findIndex((h) => h.includes('cat'));
      const typeIdx = header.findIndex((h) => h.includes('type'));
      const textIdx = header.findIndex((h) => h.includes('vraag') || h.includes('question'));
      const optIdx = header.findIndex((h) => h.includes('optie') || h.includes('option'));
      const ansIdx = header.findIndex((h) => h.includes('antwoord') || h.includes('answer') || h.includes('juist'));
      const rubIdx = header.findIndex((h) => h.includes('rubriek') || h.includes('feedback') || h.includes('toelichting'));
      const ptsIdx = header.findIndex((h) => h.includes('punt') || h.includes('point'));

      const results: Question[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        // Split by comma taking into account quoted strings
        const cols = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
        const cleanCols = cols.map((c) => c.replace(/^"|"$/g, '').trim());

        const qText = textIdx !== -1 ? cleanCols[textIdx] : cleanCols[2];
        if (!qText) continue;

        const rawType = (typeIdx !== -1 ? cleanCols[typeIdx] : cleanCols[1] || '').toLowerCase();
        const questionType = rawType.includes('open') ? 'open' : 'multiple_choice';

        const rawOptions = optIdx !== -1 ? cleanCols[optIdx] : cleanCols[3];
        const options = rawOptions ? rawOptions.split(';').map((o) => o.trim()).filter(Boolean) : [];

        results.push({
          category: (catIdx !== -1 ? cleanCols[catIdx] : cleanCols[0]) || 'Algemeen',
          questionType,
          questionText: qText,
          options: questionType === 'multiple_choice' ? (options.length > 0 ? options : ['Optie 1', 'Optie 2']) : [],
          correctAnswer: (ansIdx !== -1 ? cleanCols[ansIdx] : cleanCols[4]) || '',
          rubric: (rubIdx !== -1 ? cleanCols[rubIdx] : cleanCols[5]) || '',
          points: Number(ptsIdx !== -1 ? cleanCols[ptsIdx] : cleanCols[6]) || 1,
        });
      }

      if (results.length === 0) {
        setParseError('Geen geldige vragen kunnen inlezen uit de ingevoerde tekst.');
      } else {
        setParsedQuestions(results);
      }
    } catch (err: any) {
      setParseError('Fout bij het parseren van het CSV-bestand: ' + err.message);
    }
  };

  const handleApply = () => {
    if (parsedQuestions.length > 0) {
      onImportQuestions(parsedQuestions);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">CSV / Excel Vragen Importeren</h3>
              <p className="text-xs text-slate-500">Migreer direct vragenlijsten vanuit spreadsheets of CSV</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="py-4 space-y-4 overflow-y-auto flex-1">
          <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <p className="text-xs font-semibold text-slate-800">Voorbeeld CSV downloaden</p>
              <p className="text-[11px] text-slate-500">Kolommen: Categorie, Type, Vraag, Opties (met ;), JuisteAntwoord, Rubriek, Punten</p>
            </div>
            <button
              onClick={handleDownloadSample}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium text-xs shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              Download Voorbeeld
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Upload CSV-bestand
            </label>
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-xl cursor-pointer bg-slate-50/50 hover:bg-emerald-50/20 transition-all">
                <div className="flex flex-col items-center justify-center pt-2">
                  <Upload className="w-6 h-6 text-slate-400 mb-1" />
                  <p className="text-xs text-slate-600 font-medium">Klik om een .csv bestand te selecteren</p>
                </div>
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Of plak CSV-tekst direct hier
            </label>
            <textarea
              rows={4}
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                parseCsv(e.target.value);
              }}
              placeholder={`Categorie,Type,Vraag,Opties,JuisteAntwoord,Rubriek,Punten\nGeschiedenis,meerkeuze,In welk jaar viel de Berlijnse muur?,1985;1989;1991,1989,Val van Berlijnse muur,1`}
              className="w-full text-xs font-mono rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          {parseError && (
            <div className="flex items-center gap-2 p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {parsedQuestions.length > 0 && (
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  {parsedQuestions.length} vragen succesvol herkend!
                </span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {parsedQuestions.map((q, idx) => (
                  <div key={idx} className="text-[11px] text-emerald-800 bg-white/80 p-2 rounded-lg border border-emerald-100">
                    <span className="font-semibold text-slate-700">[{q.category}]</span> {q.questionText} ({q.questionType}, {q.points} pt)
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50"
          >
            Annuleren
          </button>
          <button
            onClick={handleApply}
            disabled={parsedQuestions.length === 0}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            Importeer {parsedQuestions.length} Vragen
          </button>
        </div>
      </div>
    </div>
  );
};
