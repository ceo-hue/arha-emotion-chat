import React from 'react';
import { User } from 'firebase/auth';
import { Crown, Shield, User as UserIcon, LogIn, Crown as ProIcon, CreditCard, Settings } from 'lucide-react';
import { UserProfile, DailyUsage, MonthlyUsage, TIER_LIMITS, MONTHLY_LIMITS } from '../types';
import { remainingMessages } from '../services/usageService';

interface SidebarUserCardProps {
  user: User | null;
  userProfile: UserProfile | null;
  dailyUsage: DailyUsage;
  monthlyUsage: MonthlyUsage;
  onOpenLogin: () => void;
  onOpenAccount: () => void;
  onOpenPricing: () => void;
}

const TIER_META = {
  admin: { label: 'Admin', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20', icon: <Shield size={8} /> },
  paid:  { label: 'Pro',   color: 'text-amber-400 bg-amber-400/10 border-amber-400/20',   icon: <Crown size={8} /> },
  free:  { label: 'Free',  color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', icon: <UserIcon size={8} /> },
  guest: { label: 'Guest', color: 'text-slate-400 bg-slate-400/10 border-slate-400/20',   icon: <UserIcon size={8} /> },
};

export default function SidebarUserCard({
  user,
  userProfile,
  dailyUsage,
  monthlyUsage,
  onOpenLogin,
  onOpenAccount,
  onOpenPricing,
}: SidebarUserCardProps) {
  const tier = userProfile?.tier ?? 'guest';
  const meta = TIER_META[tier];

  // ── 사용량 계산 (전 티어 월간 통합) ────────────────────────────────────
  const usageCount = monthlyUsage.count;
  const usageLimit = MONTHLY_LIMITS[tier];
  const remaining  = remainingMessages(tier, 0, monthlyUsage.count);
  const showUsage  = isFinite(usageLimit);

  const usagePct = showUsage ? Math.min((usageCount / usageLimit) * 100, 100) : 0;
  const warningThreshold = tier === 'paid' ? 20 : 5;
  const barColor = remaining === 0
    ? 'bg-red-400'
    : remaining <= warningThreshold
      ? 'bg-amber-400'
      : 'bg-emerald-400';

  // ── 비로그인 ─────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="border-t border-black/10 dark:border-white/10 p-4">
        <p className="text-[10px] text-slate-400 dark:text-white/30 mb-2.5 leading-relaxed">
          로그인하면 대화가 저장되고<br />무료 30회/월 이용 가능
        </p>
        <button
          onClick={onOpenLogin}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-bold text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all"
        >
          <LogIn size={12} />
          Google로 로그인
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-black/10 dark:border-white/10 p-4 flex flex-col gap-3">

      {/* Profile row */}
      <div className="flex items-center gap-3">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt="avatar"
            className="w-9 h-9 rounded-xl border border-white/20 object-cover shrink-0"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <span className="text-sm font-black text-emerald-400">
              {user.displayName?.[0] ?? user.email?.[0] ?? 'A'}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold text-slate-800 dark:text-white truncate leading-tight">
            {user.displayName ?? 'ARHA User'}
          </p>
          <span className={`mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${meta.color}`}>
            {meta.icon}
            {meta.label}
          </span>
        </div>
      </div>

      {/* Usage bar */}
      {showUsage && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30">
              이번 달 사용량
            </span>
            <span className="text-[9px] font-bold text-slate-400 dark:text-white/40">
              {usageCount}/{usageLimit}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          <p className="mt-1 text-[9px] text-slate-400 dark:text-white/25">
            {remaining === 0
              ? '이번 달 한도 초과 · 다음 달 KST 1일 초기화'
              : `${remaining}회 남음`
            }
          </p>
        </div>
      )}

      {/* Subscription status (paid) */}
      {(tier === 'paid') && userProfile?.currentPeriodEnd && (
        <p className="text-[9px] text-slate-400 dark:text-white/30 leading-relaxed">
          {userProfile.subscriptionStatus === 'past_due'
            ? '⚠️ 결제 실패 — 카드를 업데이트해주세요'
            : `갱신일 ${new Date(userProfile.currentPeriodEnd * 1000).toLocaleDateString('ko-KR')}`
          }
        </p>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-1.5">
        {/* 계정 관리 */}
        <button
          onClick={onOpenAccount}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-transparent transition-all"
        >
          <Settings size={11} className="shrink-0" />
          계정 관리
        </button>

        {/* Pro 업그레이드 (free 전용) */}
        {tier === 'free' && (
          <button
            onClick={onOpenPricing}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold text-amber-500 border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 transition-all"
          >
            <ProIcon size={11} className="shrink-0" />
            Pro 업그레이드
          </button>
        )}

        {/* 구독 관리 (paid 전용, admin 제외) */}
        {tier === 'paid' && (
          <button
            onClick={onOpenAccount}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-transparent transition-all"
          >
            <CreditCard size={11} className="shrink-0" />
            구독 관리 / 해지
          </button>
        )}
      </div>

    </div>
  );
}
