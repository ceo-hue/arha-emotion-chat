
// ═══════════════════════════════════════════════════════════
//  ModalityStrip — 모달리티 퀵 선택 스트립
//  입력바 바로 위에 위치, 6개 모달리티 탭
//  현재 감성 상태 기반으로 "추천" 모달리티 glow 강조
// ═══════════════════════════════════════════════════════════

import React from 'react'
import { Film, ImageIcon, Music, Code2, Palette, ClipboardList } from 'lucide-react'
import type { AnalysisData } from '../types'
import type { ContentModality } from '../services/middleware/types'

// ── 타입 ──────────────────────────────────────────────────

interface Props {
  analysis?:        AnalysisData | null
  onSelect:         (modality: ContentModality) => void
  disabled?:        boolean
}

// ── 상수 ──────────────────────────────────────────────────

const MODALITIES: ReadonlyArray<{
  id:      ContentModality
  label:   string
  icon:    React.ReactNode
  color:   string
  glow:    string
  active:  string
}> = [
  {
    id: 'video', label: '영상',
    icon:   <Film      size={13} />,
    color:  'text-orange-400',
    glow:   'shadow-orange-500/30',
    active: 'bg-orange-500/15 text-orange-400 border-orange-400/30',
  },
  {
    id: 'image', label: '이미지',
    icon:   <ImageIcon size={13} />,
    color:  'text-violet-400',
    glow:   'shadow-violet-500/30',
    active: 'bg-violet-500/15 text-violet-400 border-violet-400/30',
  },
  {
    id: 'music', label: '음악',
    icon:   <Music     size={13} />,
    color:  'text-cyan-400',
    glow:   'shadow-cyan-500/30',
    active: 'bg-cyan-500/15 text-cyan-400 border-cyan-400/30',
  },
  {
    id: 'code', label: '코드',
    icon:   <Code2     size={13} />,
    color:  'text-emerald-400',
    glow:   'shadow-emerald-500/30',
    active: 'bg-emerald-500/15 text-emerald-400 border-emerald-400/30',
  },
  {
    id: 'design', label: '디자인',
    icon:   <Palette   size={13} />,
    color:  'text-pink-400',
    glow:   'shadow-pink-500/30',
    active: 'bg-pink-500/15 text-pink-400 border-pink-400/30',
  },
  {
    id: 'plan', label: '기획',
    icon:   <ClipboardList size={13} />,
    color:  'text-amber-400',
    glow:   'shadow-amber-500/30',
    active: 'bg-amber-500/15 text-amber-400 border-amber-400/30',
  },
]

// 감성 모드 → 추천 모달리티 매핑
const EXPRESSION_RECOMMEND: Record<string, ContentModality[]> = {
  DEEP_EMPATHY:      ['music', 'video'],
  SOFT_WARMTH:       ['image', 'music'],
  COOL_CLARITY:      ['code', 'plan'],
  SURGE_OVERRIDE:    ['video', 'music'],
  STABLE_NEUTRAL:    ['plan', 'code'],
  CREATIVE_FLOW:     ['design', 'image'],
  MELANCHOLIC_DEPTH: ['music', 'video'],
}

// ── 컴포넌트 ───────────────────────────────────────────────

const ModalityStrip: React.FC<Props> = ({ analysis, onSelect, disabled }) => {
  const recommended = analysis?.expression_mode
    ? EXPRESSION_RECOMMEND[analysis.expression_mode] ?? []
    : []

  return (
    <div className="flex items-center gap-1 px-3 md:px-6 py-1.5 border-t border-black/6 dark:border-white/6 overflow-x-auto scrollbar-none shrink-0">
      {/* 라벨 */}
      <span className="text-[8px] font-black text-slate-300 dark:text-white/20 uppercase tracking-widest shrink-0 mr-1 hidden sm:block">
        생성
      </span>

      {MODALITIES.map(mod => {
        const isRecommended = recommended.includes(mod.id)

        return (
          <button
            key={mod.id}
            onClick={() => !disabled && onSelect(mod.id)}
            disabled={disabled}
            title={`${mod.label} 콘텐츠 생성`}
            className={`
              flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-black
              border whitespace-nowrap transition-all duration-200
              disabled:opacity-30 disabled:cursor-not-allowed
              ${isRecommended
                ? `${mod.active} border shadow-md ${mod.glow} scale-105`
                : `border-transparent text-slate-400 dark:text-white/30
                   hover:${mod.active} hover:border active:scale-95`
              }
            `}
          >
            <span className={isRecommended ? mod.color : undefined}>{mod.icon}</span>
            <span>{mod.label}</span>
            {isRecommended && (
              <span className={`text-[7px] font-black ${mod.color} opacity-70`}>●</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default ModalityStrip
