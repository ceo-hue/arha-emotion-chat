
// ═══════════════════════════════════════════════════════════
//  EmotionHUD — 함수언어 미들웨어 감성 상태 실시간 표시 바
//  헤더 바로 아래 항상 보이는 슬림 HUD
//  currentAnalysis + lastEquation → Ψ값·수식·mode·앵커 모드
// ═══════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react'
import { Activity, ChevronRight } from 'lucide-react'
import type { AnalysisData } from '../types'

// ── 타입 ──────────────────────────────────────────────────

interface Props {
  analysis:      AnalysisData | null
  lastEquation?: string        // pipeline.ts에서 마지막으로 생성된 수식
  lastNarrative?: string       // Layer 3 narrative
  temperature?:  number
  onOpenDashboard?: () => void // 오른쪽 [→] 버튼
}

// ── 상수 ──────────────────────────────────────────────────

const EXPRESSION_LABEL: Record<string, { ko: string; color: string }> = {
  DEEP_EMPATHY:      { ko: '깊은 공감',    color: 'text-violet-400' },
  SOFT_WARMTH:       { ko: '부드러운 온기', color: 'text-amber-400'  },
  COOL_CLARITY:      { ko: '서늘한 명료함', color: 'text-cyan-400'   },
  SURGE_OVERRIDE:    { ko: '감성 급등',    color: 'text-red-400'    },
  STABLE_NEUTRAL:    { ko: '안정 중립',    color: 'text-slate-400'  },
  CREATIVE_FLOW:     { ko: '창의 흐름',    color: 'text-emerald-400'},
  MELANCHOLIC_DEPTH: { ko: '우울한 깊이',  color: 'text-indigo-400' },
}

const ANCHOR_BADGE: Record<string, string> = {
  triangle: '△',
  square:   '□',
  pentagon: '⬠',
  equation: '∑',
}

// ── 컴포넌트 ───────────────────────────────────────────────

const EmotionHUD: React.FC<Props> = ({
  analysis, lastEquation, lastNarrative, temperature, onOpenDashboard,
}) => {
  const [displayEq, setDisplayEq] = useState(lastEquation ?? '')
  const [isSwapping, setIsSwapping] = useState(false)

  // 수식 바뀔 때 fade-swap 애니메이션
  useEffect(() => {
    if (!lastEquation) return
    setIsSwapping(true)
    const t = setTimeout(() => {
      setDisplayEq(lastEquation)
      setIsSwapping(false)
    }, 200)
    return () => clearTimeout(t)
  }, [lastEquation])

  const expInfo = analysis?.expression_mode
    ? EXPRESSION_LABEL[analysis.expression_mode] ?? { ko: analysis.expression_mode, color: 'text-slate-400' }
    : null

  // ψ 값 포맷
  const psiStr = analysis?.psi
    ? `Ψ(${analysis.psi.x.toFixed(2)}, ${analysis.psi.y.toFixed(2)}, ${analysis.psi.z.toFixed(2)})`
    : null

  const hasData = !!(analysis || lastEquation)

  return (
    <div className={`
      shrink-0 border-b border-black/8 dark:border-white/8
      bg-white/30 dark:bg-black/20 backdrop-blur-sm
      transition-all duration-500
      ${hasData ? 'py-2 px-4 md:px-6' : 'py-1.5 px-4 md:px-6 opacity-60'}
    `}>
      {hasData ? (
        <div className="flex items-center gap-3 min-w-0">

          {/* 수식 — 왼쪽 주역 */}
          <div className="flex-1 min-w-0">
            <div
              className={`font-mono text-[11px] md:text-[12px] text-purple-500 dark:text-purple-300 truncate transition-opacity duration-200 ${
                isSwapping ? 'opacity-0' : 'opacity-100'
              }`}
              title={displayEq || ''}
            >
              {displayEq || '—'}
            </div>
            {lastNarrative && (
              <div className="text-[9px] text-slate-400 dark:text-white/30 truncate mt-0.5 hidden md:block">
                {lastNarrative}
              </div>
            )}
          </div>

          {/* 배지 그룹 */}
          <div className="flex items-center gap-1.5 shrink-0">

            {/* expressionMode */}
            {expInfo && (
              <span className={`text-[9px] font-black uppercase tracking-widest ${expInfo.color} hidden sm:block`}>
                {expInfo.ko}
              </span>
            )}

            {/* Ψ 수치 */}
            {psiStr && (
              <span className="text-[9px] font-mono text-slate-400 dark:text-white/30 hidden md:block">
                {psiStr}
              </span>
            )}

            {/* anchor mode 배지 */}
            {analysis?.anchor_mode && (
              <span className="text-[10px] font-black text-slate-400 dark:text-white/25">
                {ANCHOR_BADGE[analysis.anchor_mode as string] ?? '○'}
              </span>
            )}

            {/* Temperature */}
            {temperature !== undefined && (
              <span className="text-[9px] font-mono text-slate-300 dark:text-white/20">
                T={temperature.toFixed(2)}
              </span>
            )}

            {/* 대시보드 열기 버튼 */}
            {onOpenDashboard && (
              <button
                onClick={onOpenDashboard}
                className="w-5 h-5 flex items-center justify-center rounded-lg hover:bg-black/8 dark:hover:bg-white/8 transition-all text-slate-400 dark:text-white/25 hover:text-slate-600 dark:hover:text-white/50"
                title="감성 대시보드 열기"
              >
                <ChevronRight size={11} />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* 대화 전 placeholder */
        <div className="flex items-center gap-2">
          <Activity size={9} className="text-slate-300 dark:text-white/20" />
          <span className="text-[9px] font-bold text-slate-300 dark:text-white/20 uppercase tracking-widest">
            대화를 시작하면 감성이 측정돼요
          </span>
        </div>
      )}
    </div>
  )
}

export default EmotionHUD
