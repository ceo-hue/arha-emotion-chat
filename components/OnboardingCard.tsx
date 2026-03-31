// ═══════════════════════════════════════════════════════════
//  OnboardingCard — 첫 로그인 감성 프로필 수집 동의 카드
//  사용자가 동의/거절 선택 → profile/info.emotionConsent 저장
// ═══════════════════════════════════════════════════════════

import React from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Brain, Heart, TrendingUp, Shield, X } from 'lucide-react';

interface OnboardingCardProps {
  uid: string;
  onConsent: (consented: boolean) => void;
}

const COLLECT_ITEMS = [
  { icon: Heart,      label: '감정 공명 패턴',  desc: '대화에서 자주 나타나는 감정의 흐름' },
  { icon: TrendingUp, label: '친밀도 (κ)',      desc: 'ARHA와의 대화 깊이 지수' },
  { icon: Brain,      label: '관심 가치사슬',    desc: '진정성, 호기심, 창의성 등 공명하는 가치' },
];

export default function OnboardingCard({ uid, onConsent }: OnboardingCardProps) {
  const handleChoice = async (consent: boolean) => {
    try {
      await setDoc(
        doc(db, 'users', uid, 'profile', 'info'),
        { emotionConsent: consent },
        { merge: true },
      );
    } catch (_) { /* Firestore 저장 실패 시도 UX는 계속 진행 */ }
    onConsent(consent);
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-[420px] rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl">

        {/* 헤더 */}
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <Brain size={20} className="text-amber-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-base leading-snug">
              ARHA가 당신을 기억할게요
            </h2>
            <p className="text-white/50 text-xs mt-0.5">
              대화가 쌓일수록 더 깊이 이해해요
            </p>
          </div>
        </div>

        {/* 수집 항목 */}
        <div className="space-y-3 mb-5">
          {COLLECT_ITEMS.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
              <Icon size={16} className="text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-white/80 text-xs font-medium">{label}</p>
                <p className="text-white/40 text-[11px]">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 프라이버시 안내 */}
        <div className="flex items-start gap-2 mb-5 p-2.5 rounded-lg bg-teal-500/10 border border-teal-500/20">
          <Shield size={13} className="text-teal-400 flex-shrink-0 mt-0.5" />
          <p className="text-teal-300/80 text-[11px] leading-relaxed">
            데이터는 당신의 계정에만 저장되며, 언제든 계정 설정에서 초기화할 수 있어요.
          </p>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2">
          <button
            onClick={() => handleChoice(false)}
            className="flex-1 py-2.5 rounded-xl text-white/40 text-sm border border-white/10 hover:border-white/20 hover:text-white/60 transition-all"
          >
            나중에
          </button>
          <button
            onClick={() => handleChoice(true)}
            className="flex-[2] py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium transition-all"
          >
            좋아요, 기억해줘
          </button>
        </div>
      </div>
    </div>
  );
}
