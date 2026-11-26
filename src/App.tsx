import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { FormsDashboard } from './components/FormsDashboard.tsx';
import { FormBuilderModal } from './components/FormBuilderModal.tsx';
import { AnalyticsView } from './components/AnalyticsView.tsx';
import { FormTaker } from './components/FormTaker.tsx';
import { RespondentProgressDashboard } from './components/RespondentProgressDashboard.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { StudyFlowRunner } from './components/StudyFlowRunner.tsx';
import {
  STUDYFLOW_ORIGIN,
  StudyFlowStofPayload,
  isInsideIframe,
  isEmbeddedInStudyFlow,
  postToStudyFlowReady,
} from './lib/studyflow.ts';
import { FormModel } from './types/index.ts';

function MainApp() {
  const { user, getToken, loading: authLoading, openAuthModal } = useAuth();
  const [activeView, setActiveView] = useState<'dashboard' | 'builder' | 'analytics' | 'taker' | 'progress'>('dashboard');
  
  const [forms, setForms] = useState<FormModel[]>([]);
  const [loadingForms, setLoadingForms] = useState(false);
  const [selectedFormUid, setSelectedFormUid] = useState<string | null>(null);
  const [formToEdit, setFormToEdit] = useState<FormModel | null>(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  // StudyFlow iframe state
  const [inIframe] = useState<boolean>(() => isInsideIframe());
  const [studyFlowEmbedded] = useState<boolean>(() => isEmbeddedInStudyFlow());
  const [studyFlowStof, setStudyFlowStof] = useState<StudyFlowStofPayload | null>(null);

  // StudyFlow postMessage integration (runs only inside iframe)
  useEffect(() => {
    if (!inIframe) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== STUDYFLOW_ORIGIN) return;
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'STUDYFLOW_STOF' && msg.payload && typeof msg.payload === 'object') {
        const vak = typeof msg.payload.vak === 'string' ? msg.payload.vak.trim() : '';
        const titel = typeof msg.payload.titel === 'string' ? msg.payload.titel.trim() : '';
        const tekst = typeof msg.payload.tekst === 'string' ? msg.payload.tekst.trim() : '';

        if (tekst) {
          const nextStof: StudyFlowStofPayload = {
            vak: vak || 'Algemeen',
            titel: titel || 'Lesstof',
            tekst,
          };
          setStudyFlowStof(nextStof);
          try {
            window.localStorage.setItem('formulierpro_studyflow_stof', JSON.stringify(nextStof));
          } catch {
            // Ignore localStorage quota errors
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    postToStudyFlowReady();

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [inIframe]);

  // Check URL query parameters for ?form=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const formParam = params.get('form');
    if (formParam) {
      setSelectedFormUid(formParam);
      setActiveView('taker');
    }
  }, []);

  // Fetch user forms
  const fetchForms = async () => {
    if (!user) {
      setForms([]);
      return;
    }
    setLoadingForms(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/forms', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const data = await res.json();
        setForms(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch forms:', err);
    } finally {
      setLoadingForms(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchForms();
    } else {
      setForms([]);
    }
  }, [user]);

  const handleOpenNewForm = () => {
    if (!user) {
      openAuthModal('login');
      return;
    }
    setFormToEdit(null);
    setIsBuilderOpen(true);
  };

  // Save or update form
  const handleSaveForm = async (formData: any) => {
    const token = await getToken();
    if (formToEdit && formToEdit.formUid) {
      // Update
      const res = await fetch(`/api/forms/${formToEdit.formUid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Bijwerken mislukt');
      }
    } else {
      // Create
      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Aanmaken mislukt');
      }
    }
    await fetchForms();
  };

  // Delete form
  const handleDeleteForm = async (formUid: string) => {
    const token = await getToken();
    try {
      const res = await fetch(`/api/forms/${formUid}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        setForms(forms.filter((f) => f.formUid !== formUid));
      }
    } catch (err) {
      console.error('Failed to delete form:', err);
    }
  };

  // Seed sample form with rich questions and categories
  const handleSeedSample = async () => {
    if (!user) {
      openAuthModal('login');
      return;
    }
    const samplePayload = {
      title: 'Centraal Examen Natuur & Techniek 2026',
      description: 'Officiële oefen- en toetssessie over Celbiologie, Fysica en Klimaat. Let op: fullscreen toetsstand is ingeschakeld.',
      mode: 'exam',
      isExamSecure: 1,
      securityPasscode: '1234',
      timerMinutes: 25,
      shuffleQuestions: 1,
      maxQuestionsTotal: null,
      categoryQuotas: {
        Biologie: 2,
        Natuurkunde: 2,
        Klimaat: 1,
      },
      submissionPolicy: 'multiple_email',
      allowReview: 1,
      aiGradingEnabled: 1,
      themeColor: '#4f46e5',
      questions: [
        {
          category: 'Biologie',
          questionType: 'multiple_choice',
          questionText: 'Welk organel is primair verantwoordelijk voor de productie van ATP via celademhaling?',
          options: ['Mitochondrium', 'Ribosoom', 'Endoplasmatisch reticulum', 'Golgi-apparaat'],
          correctAnswer: 'Mitochondrium',
          points: 1,
          rubric: 'Mitochondriën verwerken glucose en zuurstof tot ATP in aerobe omstandigheden.',
        },
        {
          category: 'Biologie',
          questionType: 'open',
          questionText: 'Leg uit waarom fotosynthese van cruciaal belang is voor het behoud van de aardse zuurstofkringloop en voedselketen.',
          correctAnswer: 'Planten zetten CO2 en water met zonlicht om in glucose en zuurstof. Dit levert de primaire biomassa voor herbivoren en herstelt de atmosferische O2.',
          points: 3,
          rubric: 'Benoem omzetting van CO2 naar zuurstof (O2), vorming van glucose/biomassa als basis voor voedselketen en de rol van zonlicht.',
        },
        {
          category: 'Natuurkunde',
          questionType: 'multiple_choice',
          questionText: 'Wat luidt de tweede wet van Newton voor een resulterende kracht F?',
          options: ['F = m · a', 'F = m / a', 'F = 0.5 · m · v²', 'F = m · g · h'],
          correctAnswer: 'F = m · a',
          points: 1,
          rubric: 'Kracht is gelijk aan massa maal versnelling.',
        },
        {
          category: 'Natuurkunde',
          questionType: 'open',
          questionText: 'Beschrijf het verschil tussen kinetische energie en potentiële zwaartekrachtenergie aan de hand van een vallende bal.',
          correctAnswer: 'Bovenin bezit de bal maximale potentiële energie (E = mgh) en nul kinetische energie. Tijdens de val wordt de potentiële energie omgezet in bewegingsenergie (E = 0.5mv²), waardoor de snelheid toeneemt.',
          points: 3,
          rubric: 'Vermeld omzetting van potentiële zwaartekrachtenergie naar kinetische bewegingsenergie en behoud van totale mechanische energie.',
        },
        {
          category: 'Klimaat',
          questionType: 'multiple_choice',
          questionText: 'Welk gas levert momenteel de grootste bijdrage aan het versterkte antropogene broeikaseffect?',
          options: ['Kooldioxide (CO2)', 'Argon (Ar)', 'Helium (He)', 'Stikstofgas (N2)'],
          correctAnswer: 'Kooldioxide (CO2)',
          points: 1,
          rubric: 'CO2 uit fossiele brandstoffen en ontbossing is het voornaamste antropogene broeikasgas.',
        },
      ],
    };

    await handleSaveForm(samplePayload);
  };

  const handleEditForm = async (form: FormModel) => {
    try {
      const token = await getToken();
      const res = await fetch(`/api/forms/${form.formUid}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const fullForm = await res.json();
        setFormToEdit(fullForm);
      } else {
        setFormToEdit(form);
      }
    } catch {
      setFormToEdit(form);
    }
    setIsBuilderOpen(true);
  };

  // When embedded in StudyFlow (or after receiving STUDYFLOW_STOF), render compact iframe view without duplicate header/nav
  const isStudyFlowView = inIframe && (studyFlowEmbedded || studyFlowStof !== null);
  if (isStudyFlowView) {
    return (
      <div className="w-full bg-slate-50 font-['Plus_Jakarta_Sans',sans-serif]">
        <StudyFlowRunner stof={studyFlowStof} inIframe={inIframe} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Navbar is visible unless currently taking a fullscreen test */}
      {activeView !== 'taker' && (
        <Navbar
          activeView={activeView}
          setActiveView={setActiveView}
          onNewFormClick={handleOpenNewForm}
        />
      )}

      {/* Main View Container */}
      <div className="flex-1">
        {activeView === 'dashboard' && (
          <FormsDashboard
            forms={forms}
            loading={loadingForms || authLoading}
            onNewForm={handleOpenNewForm}
            onEditForm={handleEditForm}
            onDeleteForm={handleDeleteForm}
            onTakeForm={(uid) => {
              setSelectedFormUid(uid);
              setActiveView('taker');
            }}
            onViewAnalytics={(uid) => {
              setSelectedFormUid(uid);
              setActiveView('analytics');
            }}
            onSeedSample={handleSeedSample}
          />
        )}

        {activeView === 'analytics' && selectedFormUid && (
          <AnalyticsView
            formUid={selectedFormUid}
            onBack={() => setActiveView('dashboard')}
            getToken={getToken}
          />
        )}

        {activeView === 'taker' && selectedFormUid && (
          <FormTaker
            formUid={selectedFormUid}
            onExit={() => {
              // Clean URL param
              window.history.pushState({}, '', window.location.pathname);
              setActiveView('dashboard');
            }}
          />
        )}

        {activeView === 'progress' && (
          <RespondentProgressDashboard />
        )}
      </div>

      {/* Form Builder Modal */}
      <FormBuilderModal
        isOpen={isBuilderOpen}
        onClose={() => {
          setIsBuilderOpen(false);
          setFormToEdit(null);
        }}
        formToEdit={formToEdit}
        onSave={handleSaveForm}
        getToken={getToken}
      />

      {/* Auth Modal (Google + Email/Password) */}
      <AuthModal />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
