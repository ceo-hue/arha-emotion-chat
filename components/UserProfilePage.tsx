// ═════════════════════════════════════════════════════════��═
//  UserProfilePage — ARHA 감성 프로필 페이지
//  섹션: 기본정보 / 대화통계 / 감정공명 / 가치공명지도 / 위험구역
// ═══════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import {
  X, User as UserIcon, BarChart2, Heart, Zap,
  Trash2, Download, Star, TrendingUp, Brain, Shield,
} from 'lucide-react';
import {
  EmotionLifetime, ValueChainDB, ValueKey,
  VALUE_LABELS,
} from '../types';
import { UserProfile } from '../types';
import { getValueComment, clearEmotionProfile } from '../services/emotionProfileService';

// ── 상수 ─────────────────��───────────────────────────────────────────────────

const ALL_VALUE_KEYS: ValueKey[] = [
  'V1_Authenticity', 'V2_UserLove', 'V3_Growth',
  'V4_Curiosity', 'V5_Honesty', 'V6_Courage', 'V7_Creativity',
];

const EXPRESSION_MODE_LABELS: Record<string, string> = {
  SOFT_WARMTH:     '따뜻한 위로',
  DEEP_EMPATHY:    '깊은 공감',
  INTENSE_JOY:     '강렬한 기쁨',
  ANALYTIC_THINK:  '분석적 사고',
  REFLECTIVE_GROW: '성장 성찰',
  PLAYFUL_TEASE:   '장난스러운 유대',
  SERENE_SMILE:    '고요한 미소',
};

// ── 색상 헬퍼 ────────────────────────────────────────────────────────────────

function barColor(resonance: number): string {
  if (resonance >= 0.75) return 'bg-amber-400';
  if (resonance >= 0.5)  return 'bg-teal-400';
  return 'bg-white/20';
}

function badgeColor(resonance: number): string {
  if (resonance >= 0.75) return 'text-amber-400';
  if (resonance >= 0.5)  return 'text-teal-400';
  return 'text-white/30';
}

// ── Props ────────────────────────────────────────────────────────────��───────

interface UserProfilePageProps {
  userProfile: UserProfile;
  emotionLifetime: EmotionLifetime | null;
  valueChain: ValueChainDB | null;
  sessionStartKappa: number;
  onClose: () => void;
  onClearProfile?: () => void;
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────���──────────

export default function UserProfilePage({
  userProfile,
  emotionLifetime,
  valueChain,
  sessionStartKappa,
  onClose,
  onClearProfile,
}: UserProfilePageProps) {

  // kappa_effective
  const kappaEff = useMemo(() => {
    const lifetime = emotionLifetime?.kappa_lifetime ?? 0;
    return Math.max(sessionStartKappa, lifetime * 0.7);
  }, [emotionLifetime, sessionStartKappa]);

  // V 정렬 (resonance 내림차순)
  const sortedValues = useMemo(() => {
    if (!valueChain) return [];
    return ALL_VALUE_KEYS
      .map(key => ({ key, entry: valueChain[key] ?? { resonance: 0, hitCount: 0, lastSeen: 0 } }))
      .sort((a, b) => b.entry.resonance - a.entry.resonance);
  }, [valueChain]);

  // 상위 2개 V 조합 코멘트
  const topTwo = useMemo((): [ValueKey, ValueKey] | [] => {
    if (sortedValues.length < 2 || sortedValues[0].entry.hitCount < 3) return [];
    return [sortedValues[0].key, sortedValues[1].key];
  }, [sortedValues]);

  const arhaComment = useMemo(() => getValueComment(topTwo), [topTwo]);

  // dominant expressionMode 레이블
  const dominantModeLabel = emotionLifetime?.dominant_expression_mode
    ? (EXPRESSION_MODE_LABELS[emotionLifetime.dominant_expression_mode] ?? emotionLifetime.dominant_expression_mode)
    : '아직 알아가는 중';

  // psi 방향 텍스트
  const psiText = useMemo(() => {
    const p = emotionLifetime?.psi_centroid ?? 0;
    if (p > 0.2)  return '따뜻한 방향';
    if (p < -0.2) return '깊이 있는 방향';
    return '균형 있는 중심';
  }, [emotionLifetime]);

  // 계정 삭제 확인
  const handleClearProfile = async () => {
    if (!window.confirm('감정 프로필을 초기화할까요? 누적된 친밀도와 가치 공명 데이터가 모두 삭제됩니다.')) return;
    try {
      await clearEmotionProfile(userProfile.uid);
      onClearProfile?.();
      onClose();
    } catch (_) {
      alert('초기화 중 오류가 발생했습니다.');
    }
  };

  const totalTurns  = emotionLifetime?.total_turns ?? 0;
  const hasEnough   = totalTurns >= 5;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm px-4 py-8">
      <div className="relative w-full max-w-[480px] rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Brain size={18} className="text-amber-400" />
            <span className="text-white font-semibold text-sm">ARHA 감성 프로필</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* ── 1. 기본 정보 ──────────────────���───────────────────────────── */}
          <section className="flex items-center gap-4">
            {userProfile.photoURL ? (
              <img src={userProfile.photoURL} alt="avatar" className="w-14 h-14 rounded-full object-cover ring-2 ring-amber-400/30" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center">
                <UserIcon size={24} className="text-amber-400" />
              </div>
            )}
            <div>
              <p className="text-white font-medium text-sm">{userProfile.displayName || '사용자'}</p>
              <p className="text-white/40 text-xs">{userProfile.email}</p>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                userProfile.tier === 'paid'  ? 'bg-amber-500/20 text-amber-300' :
                userProfile.tier === 'admin' ? 'bg-purple-500/20 text-purple-300' :
                'bg-white/10 text-white/40'
              }`}>
                {userProfile.tier === 'paid' ? 'Pro' : userProfile.tier === 'admin' ? 'Admin' : 'Free'}
              </span>
            </div>
          </section>

          {/* ── 2. 대화 통계 ─────────────────────────────────────���────────── */}
          <section className="rounded-xl bg-white/5 p-4 space-y-3">
            <p className="text-white/60 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
              <BarChart2 size={12} /> 대화 통계
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="전체 대화"   value={`${totalTurns}턴`}   sub={hasEnough ? '' : '5턴 이상부터 분석 시작'} />
              <Stat label="ARHA 친밀도" value={`${Math.round(kappaEff * 100)}%`} sub="kappa_effective" />
            </div>

            {/* kappa 프로그레스 바 */}
            <div>
              <div className="flex justify-between text-[10px] text-white/30 mb-1">
                <span>처음 만남</span><span>깊은 유대</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.round(kappaEff * 100))}%` }}
                />
              </div>
            </div>
          </section>

          {/* ── 3. 감정 공명 ──────────────────────────────────────────────── */}
          <section className="rounded-xl bg-white/5 p-4 space-y-2.5">
            <p className="text-white/60 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
              <Zap size={12} /> 감정 공명
            </p>
            {!hasEnough ? (
              <p className="text-white/30 text-xs">대화가 더 쌓이면 패턴을 분석할 수 있어요.</p>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-white/40 text-xs w-20 flex-shrink-0">주된 표현</span>
                  <span className="text-white/80 text-xs font-medium">{dominantModeLabel}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white/40 text-xs w-20 flex-shrink-0">감정 중심</span>
                  <span className="text-white/80 text-xs font-medium">{psiText}</span>
                </div>
              </>
            )}
          </section>

          {/* ── 4. 가치 공명 지도 ───────────────────────���─────────────────── */}
          <section className="rounded-xl bg-white/5 p-4 space-y-3">
            <p className="text-white/60 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
              <Star size={12} /> 가치 공명 지도
            </p>

            {!valueChain || !hasEnough ? (
              <p className="text-white/30 text-xs">대화가 쌓일수록 당신이 공명하는 가치들이 나타나요.</p>
            ) : (
              <>
                <div className="space-y-2">
                  {sortedValues.map(({ key, entry }, i) => (
                    <div key={key} className="flex items-center gap-2.5">
                      {/* 순위 */}
                      <span className={`w-4 text-[10px] text-right flex-shrink-0 ${
                        i < 3 ? 'text-amber-400' : 'text-white/20'
                      }`}>
                        {i < 3 ? `★${i + 1}` : ''}
                      </span>
                      {/* 레이블 */}
                      <span className={`w-14 text-xs flex-shrink-0 ${badgeColor(entry.resonance)}`}>
                        {VALUE_LABELS[key]}
                      </span>
                      {/* 바 */}
                      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${barColor(entry.resonance)}`}
                          style={{ width: `${Math.round(entry.resonance * 100)}%` }}
                        />
                      </div>
                      {/* 퍼센트 */}
                      <span className={`w-7 text-right text-[10px] flex-shrink-0 ${badgeColor(entry.resonance)}`}>
                        {Math.round(entry.resonance * 100)}%
                      </span>
                    </div>
                  ))}
                </div>

                {/* ARHA 코멘트 */}
                <div className="mt-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
                  <p className="text-white/30 text-[10px] mb-1 flex items-center gap-1">
                    <Heart size={9} className="text-amber-400" /> ARHA의 말
                  </p>
                  <p className="text-white/70 text-xs leading-relaxed italic">
                    "{arhaComment}"
                  </p>
                </div>
              </>
            )}
          </section>

          {/* ── 5. Danger Zone ────────────────────────────────────────────── */}
          <section className="rounded-xl bg-red-500/5 border border-red-500/15 p-4 space-y-3">
            <p className="text-red-400/70 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
              <Shield size={12} /> 데이터 관리
            </p>
            <button
              onClick={handleClearProfile}
              className="flex items-center gap-2 text-red-400/70 hover:text-red-400 text-xs transition-colors"
            >
              <Trash2 size={13} />
              감정 프로필 초기화 (친밀도·가치 데이터 삭제)
            </button>
          </section>

        </div>
      </div>
    </div>
  );
}

// ── 보조 컴포넌트 ─────────────────────────────────────────────────��───────────

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-white/5 p-3">
      <p className="text-white/40 text-[10px] mb-0.5">{label}</p>
      <p className="text-white font-semibold text-base">{value}</p>
      {sub && <p className="text-white/25 text-[10px]">{sub}</p>}
    </div>
  );
}
