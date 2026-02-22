import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';

interface LoginScreenProps {
  onClose?: () => void; // callback to close when used as a modal
}

export default function LoginScreen({ onClose }: LoginScreenProps) {
  const { signInWithGoogle } = useAuth();
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      onClose?.(); // close modal on successful login
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError(null);
      } else if (err.code === 'auth/popup-blocked') {
        setError(t.errPopupBlocked);
      } else if (err.code === 'auth/unauthorized-domain') {
        setError(t.errUnauthorized);
      } else {
        setError(`${t.errLoginFailed}${err.code ?? err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Modal mode: card only (no full-screen overlay)
  if (onClose) {
    return (
      <div className="relative glass-panel rounded-[2.5rem] px-10 py-10 flex flex-col items-center gap-6 w-[340px] max-w-[90vw]">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all"
        >
          <X size={16} />
        </button>

        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500/40 to-emerald-500/40 border border-white/20 flex items-center justify-center">
            <span className="text-lg font-black text-white">A</span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">{t.loginTitle}</h2>
          <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">
            {t.loginSubtitle}
          </p>
        </div>

        {/* Google sign-in button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-2xl bg-white/15 border border-white/30 hover:bg-white/25 active:scale-[0.98] transition-all text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <GoogleSVG />
          )}
          {isLoading ? t.loginConnecting : t.loginContinue}
        </button>

        {error && (
          <p className="text-[11px] text-red-400/80 text-center font-medium leading-relaxed">
            {error}
          </p>
        )}

        <p className="text-[9px] text-white/20 text-center font-bold uppercase tracking-widest leading-relaxed whitespace-pre-line">
          {t.loginNote}
        </p>
      </div>
    );
  }

  // Full-screen mode (currently unused, can be re-enabled if needed)
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm" style={{ height: '100dvh' }}>
      <div className="glass-panel rounded-[2.5rem] px-10 py-12 flex flex-col items-center gap-8 w-[340px] max-w-[90vw]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/40 to-emerald-500/40 border border-white/20 flex items-center justify-center mb-1">
            <span className="text-xl font-black text-white">A</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">ARHA</h1>
          <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.25em]">Emotional Vector System</p>
        </div>
        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-2xl bg-white/15 border border-white/30 hover:bg-white/25 active:scale-[0.98] transition-all text-white font-bold text-sm disabled:opacity-50"
        >
          {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <GoogleSVG />}
          {isLoading ? t.loginConnecting : t.loginContinue}
        </button>
        {error && <p className="text-[11px] text-red-400/80 text-center">{error}</p>}
      </div>
    </div>
  );
}

function GoogleSVG() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.96L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
