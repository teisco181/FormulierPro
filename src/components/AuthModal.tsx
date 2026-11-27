import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';
import { useAuth, formatFirebaseAuthError } from '../context/AuthContext.tsx';
import firebaseConfig from '../../firebase-applet-config.json';

type ModalTab = 'login' | 'register' | 'reset' | 'link_password';

export const AuthModal: React.FC = () => {
  const {
    user,
    isAuthModalOpen,
    authModalMode,
    prefilledEmail,
    closeAuthModal,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    sendPasswordReset,
    linkPasswordToAccount,
  } = useAuth();

  const [tab, setTab] = useState<ModalTab>(authModalMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthModalOpen) {
      setTab(authModalMode);
      setErrorMsg(null);
      setErrorCode(null);
      setSuccessMsg(null);
      setPassword('');
      setConfirmPassword('');
      if (authModalMode !== 'link_password') {
        setName('');
        if (prefilledEmail) {
          setEmail(prefilledEmail);
        }
      }
    }
  }, [isAuthModalOpen, authModalMode, prefilledEmail]);

  if (!isAuthModalOpen) return null;

  const switchTab = (nextTab: ModalTab) => {
    setTab(nextTab);
    setErrorMsg(null);
    setErrorCode(null);
    setSuccessMsg(null);
  };

  const handleGoogleClick = async () => {
    setErrorMsg(null);
    setErrorCode(null);
    setSuccessMsg(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle(email || prefilledEmail);
      closeAuthModal();
    } catch (err: any) {
      const formatted = formatFirebaseAuthError(err);
      setErrorMsg(formatted.message);
      setErrorCode(formatted.code);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setErrorCode(null);
    setSuccessMsg(null);

    if (tab === 'reset') {
      if (!email.trim()) {
        setErrorMsg('Vul uw e-mailadres in.');
        return;
      }
      setSubmitting(true);
      try {
        await sendPasswordReset(email);
        setSuccessMsg(
          'Als er een account met wachtwoord bestaat voor dit e-mailadres, ontvangt u binnen enkele minuten een herstellink.'
        );
      } catch (err: any) {
        const formatted = formatFirebaseAuthError(err);
        setErrorMsg(formatted.message);
        setErrorCode(formatted.code);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (tab === 'link_password') {
      if (password.length < 6) {
        setErrorMsg('Het wachtwoord moet minimaal 6 tekens lang zijn.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('De wachtwoorden komen niet overeen.');
        return;
      }
      setSubmitting(true);
      try {
        await linkPasswordToAccount(password);
        setSuccessMsg(
          'Wachtwoord ingesteld! U kunt voortaan zowel met Google als met uw e-mailadres en wachtwoord inloggen.'
        );
        setTimeout(() => {
          closeAuthModal();
        }, 1600);
      } catch (err: any) {
        const formatted = formatFirebaseAuthError(err);
        setErrorMsg(formatted.message);
        setErrorCode(formatted.code);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!email.trim() || !password) {
      setErrorMsg('Vul zowel uw e-mailadres als wachtwoord in.');
      return;
    }

    if (tab === 'register') {
      if (password.length < 6) {
        setErrorMsg('Het wachtwoord moet minimaal 6 tekens lang zijn.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('De wachtwoorden komen niet overeen.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (tab === 'login') {
        await signInWithEmail(email, password);
      } else {
        await registerWithEmail(email, password, name);
      }
      closeAuthModal();
    } catch (err: any) {
      const formatted = formatFirebaseAuthError(err);
      setErrorMsg(formatted.message);
      setErrorCode(formatted.code);
    } finally {
      setSubmitting(false);
    }
  };

  const firebaseProvidersUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
              FormulierPro Account
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 mt-1.5 tracking-tight">
              {tab === 'login' && 'Inloggen'}
              {tab === 'register' && 'Nieuw account registreren'}
              {tab === 'reset' && 'Wachtwoord herstellen'}
              {tab === 'link_password' && 'Wachtwoord koppelen'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {tab === 'link_password'
                ? 'Voeg een wachtwoord toe aan uw Google e-mailadres zodat u op beide manieren kunt inloggen.'
                : 'Log in met Google of met uw e-mailadres en wachtwoord.'}
            </p>
          </div>
          <button
            type="button"
            onClick={closeAuthModal}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Sluiten"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Google Login + Mode Tabs (when not in reset or link_password mode) */}
          {tab !== 'reset' && tab !== 'link_password' && (
            <>
              <button
                type="button"
                onClick={handleGoogleClick}
                disabled={googleLoading || submitting}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs shadow-2xs flex items-center justify-center gap-2.5 transition-all disabled:opacity-60"
              >
                {googleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                  </svg>
                )}
                <span>Doorgaan met Google</span>
              </button>

              <div className="relative flex items-center">
                <div className="flex-grow border-t border-slate-200" />
                <span className="shrink-0 mx-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  of met e-mail & wachtwoord
                </span>
                <div className="flex-grow border-t border-slate-200" />
              </div>

              {/* Login / Register Tab Switcher */}
              <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 border border-slate-200/70">
                <button
                  type="button"
                  onClick={() => switchTab('login')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    tab === 'login'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Inloggen
                </button>
                <button
                  type="button"
                  onClick={() => switchTab('register')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    tab === 'register'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Registreren
                </button>
              </div>
            </>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <p className="font-medium leading-relaxed">{errorMsg}</p>
                {errorCode === 'auth/operation-not-allowed' && (
                  <a
                    href={firebaseProvidersUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-rose-900 underline hover:text-rose-700"
                  >
                    Open Firebase Authentication Providers
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Success Banner */}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="font-medium leading-relaxed">{successMsg}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-3.5">
            {tab === 'register' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Volledige naam (Optioneel)
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Voornaam Achternaam"
                    autoComplete="name"
                    className="w-full text-sm rounded-xl border border-slate-200 pl-10 pr-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
              </div>
            )}

            {tab === 'link_password' ? (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5 text-xs">
                <Mail className="w-4 h-4 text-indigo-600 shrink-0" />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Gekoppeld e-mailadres
                  </span>
                  <span className="font-bold text-slate-900">{user?.email}</span>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  E-mailadres (ook Gmail mogelijk)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="naam@gmail.com"
                    required
                    autoComplete="email"
                    className="w-full text-sm rounded-xl border border-slate-200 pl-10 pr-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
              </div>
            )}

            {tab !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Wachtwoord
                  </label>
                  {tab === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchTab('reset')}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      Wachtwoord vergeten?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={tab === 'login' ? 'Uw wachtwoord' : 'Minimaal 6 tekens'}
                    required
                    minLength={tab === 'login' ? undefined : 6}
                    autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                    className="w-full text-sm rounded-xl border border-slate-200 pl-10 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Verberg wachtwoord' : 'Toon wachtwoord'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {(tab === 'register' || tab === 'link_password') && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Bevestig wachtwoord
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Herhaal wachtwoord"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="w-full text-sm rounded-xl border border-slate-200 pl-10 pr-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
              </div>
            )}

            <div className="pt-1 space-y-2">
              <button
                type="submit"
                disabled={submitting || googleLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {tab === 'login' && 'Inloggen met e-mail & wachtwoord'}
                {tab === 'register' && 'Account registreren'}
                {tab === 'reset' && 'Herstellink versturen'}
                {tab === 'link_password' && 'Wachtwoord instellen'}
              </button>

              {tab === 'reset' && (
                <button
                  type="button"
                  onClick={() => switchTab('login')}
                  className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Terug naar inloggen
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
