import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { 
  FileText, 
  BarChart3, 
  LogIn, 
  LogOut, 
  PlusCircle, 
  GraduationCap,
  KeyRound,
  UserPlus
} from 'lucide-react';

interface NavbarProps {
  activeView: 'dashboard' | 'builder' | 'analytics' | 'taker' | 'progress';
  setActiveView: (view: 'dashboard' | 'builder' | 'analytics' | 'taker' | 'progress') => void;
  onNewFormClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeView, setActiveView, onNewFormClick }) => {
  const { user, openAuthModal, hasPasswordProvider, logout, loading } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setActiveView('dashboard')}
            className="flex items-center gap-2.5 text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-100 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg tracking-tight text-slate-900">Formulier<span className="text-indigo-600">Pro</span></span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">SQL & AI</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Toetsen, Formulieren & Voortgang</p>
            </div>
          </button>

          {/* Navigation links */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => setActiveView('dashboard')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                activeView === 'dashboard'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              Mijn Formulieren
            </button>

            <button
              onClick={() => setActiveView('progress')}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                activeView === 'progress'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Voortgangs Dashboard
            </button>
          </nav>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onNewFormClick}
            className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm hover:shadow transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            Nieuw Formulier
          </button>

          {loading ? (
            <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
          ) : user ? (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="flex items-center gap-2">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Maker'}
                    className="w-8 h-8 rounded-full border border-indigo-200"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                    {user.email ? user.email[0].toUpperCase() : 'U'}
                  </div>
                )}
                <div className="hidden lg:block text-left">
                  <p className="text-xs font-semibold text-slate-800 leading-tight">
                    {user.displayName || user.email?.split('@')[0]}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {user.email || 'Maker / Docent'}
                  </p>
                </div>
              </div>

              {!hasPasswordProvider && user.email && (
                <button
                  onClick={() => openAuthModal('link_password')}
                  title="Stel ook een wachtwoord in voor uw Google e-mailadres"
                  className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 text-[11px] font-semibold transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Wachtwoord instellen
                </button>
              )}

              <button
                onClick={logout}
                title="Uitloggen"
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => openAuthModal('register')}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Registreren
              </button>
              <button
                onClick={() => openAuthModal('login')}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold shadow-sm transition-all"
              >
                <LogIn className="w-4 h-4" />
                Inloggen
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
