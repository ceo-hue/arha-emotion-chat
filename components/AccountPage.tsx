import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { X, LogOut, Download, Trash2, Crown, Shield, User as UserIcon } from 'lucide-react';
import { UserProfile, DailyUsage, TIER_LIMITS, ChatSession } from '../types';
import { ValueProfile, getTopKeywords } from '../services/firestoreService';
import { remainingMessages } from '../services/usageService';

interface AccountPageProps {
  user: User;
  userProfile: UserProfile | null;
  dailyUsage: DailyUsage;
  valueProfile: ValueProfile;
  sessions: ChatSession[];
  onClose: () => void;
  onSignOut: () => Promise<void>;
}

const TIER_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  admin: { label: 'Admin', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20', icon: <Shield size={10} /> },
  paid:  { label: 'Pro',   color: 'text-amber-400 bg-amber-400/10 border-amber-400/20',   icon: <Crown size={10} /> },
  free:  { label: 'Free',  color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', icon: <UserIcon size={10} /> },
  guest: { label: 'Guest', color: 'text-slate-400 bg-slate-400/10 border-slate-400/20',   icon: <UserIcon size={10} /> },
};

export default function AccountPage({
  user,
  userProfile,
  dailyUsage,
  valueProfile,
  sessions,
  onClose,
  onSignOut,
}: AccountPageProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const tier = userProfile?.tier ?? 'free';
  const tierMeta = TIER_LABELS[tier];
  const limit = TIER_LIMITS[tier];
  const isLimited = isFinite(limit);
  const remaining = remainingMessages(tier, dailyUsage.count);
  const topKeywords = getTopKeywords(valueProfile, 20);

  const handleExport = () => {
    const data = JSON.stringify(sessions, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arha-conversations-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center backdrop-blur-sm bg-black/50">
      <div
        className="relative glass-panel rounded-[2rem] w-[420px] max-w-[96vw] max-h-[90dvh] overflow-y-auto flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/10 bg-inherit backdrop-blur-sm z-10">
          <h2 className="text-sm font-black text-slate-800 dark:text-white tracking-tight uppercase">Account</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-400 dark:text-white/30 hover:text-slate-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-all"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-6 py-5">

          {/* Profile */}
          <section className="flex items-center gap-4">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName ?? 'avatar'}
                className="w-14 h-14 rounded-2xl border border-slate-300 dark:border-white/20 object-cover shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <span className="text-xl font-black text-emerald-400">
                  {user.displayName?.[0] ?? user.email?.[0] ?? 'A'}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                {user.displayName ?? 'ARHA User'}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-white/40 truncate mt-0.5">
                {user.email}
              </p>
              <span className={`mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${tierMeta.color}`}>
                {tierMeta.icon}
                {tierMeta.label}
              </span>
            </div>
          </section>

          {/* Usage (limited tiers only) */}
          {isLimited && (
            <section className="rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30 mb-3">오늘 사용량</p>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      remaining === 0 ? 'bg-red-400' : remaining <= 2 ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                    style={{ width: `${Math.min((dailyUsage.count / limit) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-[11px] font-bold text-slate-600 dark:text-white/60 shrink-0">
                  {dailyUsage.count}/{limit}회
                </span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-white/30">
                {remaining === 0
                  ? '오늘 한도를 모두 사용했습니다. 내일 KST 자정에 초기화됩니다.'
                  : `${remaining}회 남음 · 매일 KST 자정 초기화`}
              </p>
            </section>
          )}

          {/* Keywords */}
          {topKeywords.length > 0 && (
            <section>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30 mb-2">관심 키워드</p>
              <div className="flex flex-wrap gap-1.5">
                {topKeywords.map(({ keyword, weight }) => (
                  <span
                    key={keyword}
                    className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    title={`weight: ${weight}`}
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Export */}
          {sessions.length > 0 && (
            <section>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30 mb-2">대화 기록</p>
              <button
                onClick={handleExport}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[12px] font-bold bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-slate-600 dark:text-white/60 hover:text-emerald-500 hover:border-emerald-500/30 transition-all"
              >
                <Download size={13} className="shrink-0" />
                대화 기록 내보내기 ({sessions.length}개)
              </button>
            </section>
          )}

          {/* Danger zone */}
          <section className="border-t border-white/10 pt-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-red-400/50 mb-3">Danger Zone</p>
            <button
              onClick={onSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[12px] font-bold text-slate-400 dark:text-white/40 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all mb-2"
            >
              <LogOut size={13} className="shrink-0" />
              로그아웃
            </button>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[12px] font-bold text-slate-400 dark:text-white/30 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
              >
                <Trash2 size={13} className="shrink-0" />
                계정 삭제
              </button>
            ) : (
              <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4">
                <p className="text-[11px] text-red-400 font-bold mb-3">계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다. 계속할까요?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2 rounded-xl text-[11px] font-bold bg-white/10 text-slate-600 dark:text-white/60 hover:bg-white/20 transition-all"
                  >
                    취소
                  </button>
                  <button
                    onClick={async () => {
                      try { await user.delete(); } catch (_) {}
                    }}
                    className="flex-1 py-2 rounded-xl text-[11px] font-bold bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                  >
                    삭제 확인
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
