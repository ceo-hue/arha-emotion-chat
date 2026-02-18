import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const NASA_BG = 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1920&q=80';

export default function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setError(null);
      } else if (err.code === 'auth/popup-blocked') {
        setError('팝업이 차단되었어요. 브라우저 설정에서 팝업을 허용해주세요.');
      } else {
        setError('로그인에 실패했어요. 다시 시도해주세요.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-hidden bg-black"
      style={{ height: '100dvh' }}
    >
      {/* Background */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center opacity-80"
        style={{ backgroundImage: `url(${NASA_BG})`, transform: 'scale(1.05)' }}
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 z-[1] bg-black/30" />

      {/* Glass card */}
      <div className="relative z-10 glass-panel rounded-[2.5rem] px-10 py-12 flex flex-col items-center gap-8 w-[340px] max-w-[90vw]">

        {/* Logo / Wordmark */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/40 to-emerald-500/40 border border-white/20 flex items-center justify-center mb-1">
            <span className="text-xl font-black text-white tracking-tight">A</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">ARHA</h1>
          <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.25em]">
            Emotional Vector System
          </p>
        </div>

        {/* Tagline */}
        <p className="text-sm text-white/60 text-center leading-relaxed font-medium">
          감성 벡터 대화 시스템에<br />오신 것을 환영해요.
        </p>

        {/* Google Sign-in Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-2xl bg-white/15 border border-white/30 hover:bg-white/25 active:bg-white/20 active:scale-[0.98] transition-all duration-200 text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
              <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.96L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
          )}
          {isLoading ? '연결 중...' : 'Google로 계속하기'}
        </button>

        {/* Error message */}
        {error && (
          <p className="text-[11px] text-red-400/80 text-center font-medium leading-relaxed">
            {error}
          </p>
        )}

        {/* Privacy note */}
        <p className="text-[9px] text-white/20 text-center font-bold uppercase tracking-widest leading-relaxed">
          로그인 시 대화 기록이<br />안전하게 동기화됩니다
        </p>
      </div>
    </div>
  );
}
