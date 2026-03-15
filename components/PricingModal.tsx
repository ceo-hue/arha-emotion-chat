import React, { useState } from 'react';
import { X, Crown, Check, Zap, CreditCard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UserProfile } from '../types';

interface PricingModalProps {
  userProfile: UserProfile | null;
  onClose: () => void;
}

const MONTHLY_KRW = 14900;
const YEARLY_KRW  = 149000;
const MONTHLY_FROM_YEARLY = Math.floor(YEARLY_KRW / 12); // 12,416

const FREE_FEATURES = [
  '30회/월 대화',
  '기본 페르소나 5종',
  '대화 기록 저장',
];

const PRO_FEATURES = [
  '무제한 대화',
  '모든 페르소나 + 향후 추가',
  '이미지 · 영상 생성',
  '인터넷 검색 (Tavily)',
  'PRO 모드 전문가 패널',
  '전체 대화 이력',
];

export default function PricingModal({ userProfile, onClose }: PricingModalProps) {
  const { getIdToken } = useAuth();
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPaid = userProfile?.tier === 'paid' || userProfile?.tier === 'admin';

  const handleUpgrade = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('로그인이 필요합니다');

      const priceId = cycle === 'monthly'
        ? import.meta.env.VITE_STRIPE_PRICE_MONTHLY
        : import.meta.env.VITE_STRIPE_PRICE_YEARLY;

      if (!priceId) throw new Error('결제 설정이 준비되지 않았습니다');

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ priceId, billingCycle: cycle }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '결제 페이지를 열 수 없습니다');

      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다');
      setIsLoading(false);
    }
  };

  const handleManage = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('로그인이 필요합니다');

      const res = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '포털을 열 수 없습니다');

      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다');
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center backdrop-blur-sm bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative glass-panel rounded-[2rem] w-[480px] max-w-[96vw] max-h-[90dvh] overflow-y-auto flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/10 bg-inherit backdrop-blur-sm z-10">
          <div className="flex items-center gap-2">
            <Crown size={14} className="text-amber-400" />
            <h2 className="text-sm font-black text-slate-800 dark:text-white tracking-tight uppercase">ARHA Pro</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-xl flex items-center justify-center text-slate-400 dark:text-white/30 hover:text-slate-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-all"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-6 py-6">

          {/* 이미 Pro인 경우 */}
          {isPaid ? (
            <section className="text-center flex flex-col gap-3">
              <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mx-auto">
                <Crown size={22} className="text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-white mb-1">현재 Pro 플랜 이용 중</p>
                {userProfile?.currentPeriodEnd && (
                  <p className="text-[11px] text-slate-400 dark:text-white/40">
                    다음 갱신일: {new Date(userProfile.currentPeriodEnd * 1000).toLocaleDateString('ko-KR')}
                  </p>
                )}
                {userProfile?.subscriptionStatus === 'past_due' && (
                  <p className="text-[11px] text-amber-400 font-bold mt-1">결제 실패 — 카드를 업데이트해주세요</p>
                )}
              </div>
              {error && <p className="text-[11px] text-red-400">{error}</p>}
              <button
                onClick={handleManage}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-[12px] font-bold bg-white/5 border border-white/10 text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
              >
                <CreditCard size={13} />
                {isLoading ? '로딩 중...' : '구독 관리 / 결제 수단 변경'}
              </button>
            </section>
          ) : (
            <>
              {/* 월간 / 연간 토글 */}
              <section>
                <div className="flex items-center p-1 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 gap-1">
                  <button
                    onClick={() => setCycle('monthly')}
                    className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-all ${
                      cycle === 'monthly'
                        ? 'bg-white dark:bg-white/15 text-slate-800 dark:text-white shadow-sm'
                        : 'text-slate-400 dark:text-white/40 hover:text-slate-600 dark:hover:text-white/60'
                    }`}
                  >
                    월간
                  </button>
                  <button
                    onClick={() => setCycle('annual')}
                    className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                      cycle === 'annual'
                        ? 'bg-white dark:bg-white/15 text-slate-800 dark:text-white shadow-sm'
                        : 'text-slate-400 dark:text-white/40 hover:text-slate-600 dark:hover:text-white/60'
                    }`}
                  >
                    연간
                    <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black bg-emerald-500/20 text-emerald-500">
                      2개월 무료
                    </span>
                  </button>
                </div>
              </section>

              {/* 가격 표시 */}
              <section className="text-center">
                <div className="text-4xl font-black text-slate-800 dark:text-white">
                  ₩{(cycle === 'monthly' ? MONTHLY_KRW : MONTHLY_FROM_YEARLY).toLocaleString()}
                  <span className="text-base font-bold text-slate-400 dark:text-white/40">/월</span>
                </div>
                {cycle === 'annual' && (
                  <p className="text-[11px] text-slate-400 dark:text-white/40 mt-1">
                    연간 ₩{YEARLY_KRW.toLocaleString()} 청구 · 월간 대비 ₩{(MONTHLY_KRW * 12 - YEARLY_KRW).toLocaleString()} 절약
                  </p>
                )}
              </section>

              {/* 기능 비교표 */}
              <section className="rounded-2xl overflow-hidden border border-white/10">
                {/* Free */}
                <div className="px-4 py-3 bg-black/5 dark:bg-white/5 border-b border-white/10">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30 mb-2">Free</p>
                  {FREE_FEATURES.map(f => (
                    <div key={f} className="flex items-center gap-2 py-0.5">
                      <Check size={10} className="text-slate-300 dark:text-white/25 shrink-0" />
                      <span className="text-[11px] text-slate-400 dark:text-white/40">{f}</span>
                    </div>
                  ))}
                </div>
                {/* Pro */}
                <div className="px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Crown size={10} className="text-amber-400" />
                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-400">Pro</p>
                  </div>
                  {PRO_FEATURES.map(f => (
                    <div key={f} className="flex items-center gap-2 py-0.5">
                      <Zap size={10} className="text-amber-400 shrink-0" />
                      <span className="text-[11px] text-slate-700 dark:text-white/80">{f}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* 에러 메시지 */}
              {error && <p className="text-[11px] text-red-400 text-center">{error}</p>}

              {/* CTA */}
              {userProfile ? (
                <button
                  onClick={handleUpgrade}
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-2xl text-[13px] font-black text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:scale-[0.98] transition-all shadow-lg shadow-amber-500/20 disabled:opacity-60"
                >
                  {isLoading ? '결제 페이지 열기...' : '지금 업그레이드'}
                </button>
              ) : (
                <p className="text-center text-[11px] text-slate-400 dark:text-white/40">
                  업그레이드하려면 먼저 로그인해주세요
                </p>
              )}

              <p className="text-center text-[10px] text-slate-400 dark:text-white/30 pb-1">
                언제든지 취소 가능 · 카드 정보는 Stripe에서 안전하게 처리됩니다
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
