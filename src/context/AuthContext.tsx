import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  EmailAuthProvider,
  linkWithCredential,
  reauthenticateWithPopup,
  signOut,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';

export type AuthModalMode = 'login' | 'register' | 'link_password';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  token: string | null;
  hasPasswordProvider: boolean;
  hasGoogleProvider: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  linkPasswordToAccount: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
  isAuthModalOpen: boolean;
  authModalMode: AuthModalMode;
  openAuthModal: (mode?: AuthModalMode) => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  token: null,
  hasPasswordProvider: false,
  hasGoogleProvider: false,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  registerWithEmail: async () => {},
  sendPasswordReset: async () => {},
  linkPasswordToAccount: async () => {},
  logout: async () => {},
  getToken: async () => null,
  isAuthModalOpen: false,
  authModalMode: 'login',
  openAuthModal: () => {},
  closeAuthModal: () => {},
});

export function formatFirebaseAuthError(error: any): { message: string; code: string } {
  const code = error?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return {
        code,
        message:
          'Onjuist e-mailadres of wachtwoord. Hebt u dit account met Google aangemaakt? Log dan eerst in met Google en stel een wachtwoord in voor uw e-mailadres.',
      };
    case 'auth/email-already-in-use':
      return {
        code,
        message:
          'Dit e-mailadres is al in gebruik. Log in met uw wachtwoord of via Google (en stel daarna eventueel een wachtwoord in via uw account).',
      };
    case 'auth/weak-password':
      return {
        code,
        message: 'Het wachtwoord is te zwak. Gebruik minimaal 6 tekens.',
      };
    case 'auth/invalid-email':
      return {
        code,
        message: 'Voer een geldig e-mailadres in.',
      };
    case 'auth/too-many-requests':
      return {
        code,
        message: 'Te veel mislukte pogingen. Wacht even en probeer het daarna opnieuw.',
      };
    case 'auth/operation-not-allowed':
      return {
        code,
        message:
          'Inloggen met e-mailadres en wachtwoord is nog niet ingeschakeld in de Firebase Console.',
      };
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return {
        code,
        message: 'Het Google-inlogvenster is gesloten voordat het inloggen was voltooid.',
      };
    case 'auth/popup-blocked':
      return {
        code,
        message: 'De pop-up voor Google-login is geblokkeerd door de browser. Sta pop-ups toe voor deze site.',
      };
    case 'auth/provider-already-linked':
      return {
        code,
        message: 'Er is al een wachtwoord gekoppeld aan dit account.',
      };
    case 'auth/requires-recent-login':
      return {
        code,
        message: 'Log opnieuw in om deze beveiligingswijziging te bevestigen.',
      };
    default:
      return {
        code,
        message: error?.message || 'Er is een fout opgetreden bij het inloggen.',
      };
  }
}

async function syncUserWithBackend(currentUser: User, explicitName?: string) {
  const idToken = await currentUser.getIdToken();
  await fetch('/api/auth/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ name: explicitName || currentUser.displayName || undefined }),
  });
  return idToken;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [providerVersion, setProviderVersion] = useState(0);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('login');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const idToken = await syncUserWithBackend(currentUser);
          setToken(idToken);
        } catch (err) {
          console.error('Error getting auth token:', err);
        }
      } else {
        setToken(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const hasPasswordProvider = Boolean(
    (auth.currentUser || user)?.providerData?.some((p) => p.providerId === 'password')
  );
  const hasGoogleProvider = Boolean(
    (auth.currentUser || user)?.providerData?.some((p) => p.providerId === 'google.com')
  );
  void providerVersion;

  const openAuthModal = (mode: AuthModalMode = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await syncUserWithBackend(result.user);
    setUser(result.user);
    setToken(idToken);
    setProviderVersion((v) => v + 1);
  };

  const signInWithEmail = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email.trim(), password);
    const idToken = await syncUserWithBackend(result.user);
    setUser(result.user);
    setToken(idToken);
    setProviderVersion((v) => v + 1);
  };

  const registerWithEmail = async (email: string, password: string, name?: string) => {
    const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const cleanName = name?.trim();
    if (cleanName) {
      await updateProfile(result.user, { displayName: cleanName });
    }
    const idToken = await syncUserWithBackend(result.user, cleanName);
    setUser(auth.currentUser);
    setToken(idToken);
    setProviderVersion((v) => v + 1);
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const linkPasswordToAccount = async (password: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      throw new Error('U moet ingelogd zijn met een e-mailadres om een wachtwoord in te stellen.');
    }

    const credential = EmailAuthProvider.credential(currentUser.email, password);
    try {
      await linkWithCredential(currentUser, credential);
      setUser(auth.currentUser);
      setProviderVersion((v) => v + 1);
    } catch (error: any) {
      if (error?.code === 'auth/requires-recent-login') {
        await reauthenticateWithPopup(currentUser, googleAuthProvider);
        await linkWithCredential(currentUser, credential);
        setUser(auth.currentUser);
        setProviderVersion((v) => v + 1);
      } else {
        throw error;
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setToken(null);
  };

  const getToken = async (): Promise<string | null> => {
    if (auth.currentUser) {
      const freshToken = await auth.currentUser.getIdToken(true);
      setToken(freshToken);
      return freshToken;
    }
    return token;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        token,
        hasPasswordProvider,
        hasGoogleProvider,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        sendPasswordReset,
        linkPasswordToAccount,
        logout,
        getToken,
        isAuthModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
