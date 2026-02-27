import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  handleSignOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  signInWithGoogle: async () => {},
  handleSignOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check redirect result first
    getRedirectResult(auth).catch((e) => {
      console.error('Redirect result error:', e);
      setError(e.message);
    });

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) setError(null);
    });
    return unsub;
  }, []);

  const signInWithGoogle = async () => {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      console.error('Popup sign-in failed, trying redirect:', e);
      // Popup blocked or failed → fallback to redirect
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (e2: any) {
        console.error('Redirect sign-in also failed:', e2);
        setError(e2.message || 'Login failed');
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Sign-out failed:', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, signInWithGoogle, handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
