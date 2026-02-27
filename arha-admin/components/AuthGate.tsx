import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { FlaskConical } from 'lucide-react';

export default function AuthGate() {
  const { signInWithGoogle, error } = useAuth();
  const { t } = useI18n();

  return (
    <div className="h-[100dvh] w-full bg-black flex items-center justify-center">
      <div className="glass-panel rounded-3xl p-8 w-[360px] text-center space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-2xl bg-violet-500/20 border border-violet-400/30 flex items-center justify-center">
            <FlaskConical size={28} className="text-violet-400" />
          </div>
          <h1 className="text-lg font-bold text-white mt-2">Persona Essence Builder</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-400/60">ADMIN</p>
        </div>

        {/* Login message */}
        <p className="text-sm text-white/50">{t.loginRequired}</p>

        {/* Google sign-in button */}
        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white/10 border border-white/20 hover:bg-white/15 active:scale-[0.98] transition-all text-sm font-bold text-white/80"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
            <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.96L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          {t.loginButton}
        </button>

        {error && (
          <p className="text-[10px] text-red-400 bg-red-500/10 rounded-lg px-3 py-2 break-all">
            {error}
          </p>
        )}
        <p className="text-[10px] text-white/30">{t.loginNote}</p>
      </div>
    </div>
  );
}
