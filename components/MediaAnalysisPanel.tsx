
import React from 'react'
import { Brain, Plus, Minus, Edit3, ChevronRight, Sparkles, Film, Zap } from 'lucide-react'
import type { PromptAnalysis, RefinementAnalysis } from '../services/promptAnalyzer'

// ── Props ────────────────────────────────────────────────

interface Props {
  mediaType:         'image' | 'video'
  analysis:          PromptAnalysis | null
  refinement:        RefinementAnalysis | null
  isAnalyzing:       boolean
  generationParams?: {
    model:       string
    aspectRatio: string
    style?:      string
  }
  className?:        string
}

// ── 서브 컴포넌트들 ───────────────────────────────────────

const ScoreBar: React.FC<{
  score: number
  colorClass: string
  label: string
  valueClass: string
}> = ({ score, colorClass, label, valueClass }) => (
  <div className="space-y-0.5">
    <div className="flex justify-between items-center">
      <span className="text-[8px] text-slate-400 dark:text-white/30">{label}</span>
      <span className={`text-[8px] font-black ${valueClass}`}>{score}%</span>
    </div>
    <div className="w-full h-1 bg-black/10 dark:bg-white/8 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${colorClass}`}
        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
      />
    </div>
  </div>
)

const TagChip: React.FC<{ label: string; dimmed?: boolean }> = ({ label, dimmed }) => (
  <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold border transition-colors ${
    dimmed
      ? 'bg-white/3 border-white/8 text-slate-400 dark:text-white/25'
      : 'bg-white/8 border-white/12 text-slate-600 dark:text-white/55'
  }`}>
    {label}
  </span>
)

const RefinementBadge: React.FC<{
  type:   'add' | 'remove' | 'modify'
  aspect: string
  detail: string
}> = ({ type, aspect, detail }) => {
  const cfg = {
    add:    { icon: <Plus size={7} />,   cls: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
    remove: { icon: <Minus size={7} />,  cls: 'bg-red-500/10    border-red-500/20    text-red-400'     },
    modify: { icon: <Edit3 size={7} />,  cls: 'bg-amber-500/10  border-amber-500/20  text-amber-400'   },
  }[type]

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[8px] font-bold ${cfg.cls}`}>
      {cfg.icon}
      <span className="shrink-0">{aspect}</span>
      <ChevronRight size={6} className="opacity-40 shrink-0" />
      <span className="opacity-65 truncate">{detail}</span>
    </div>
  )
}

// ── 스켈레톤 로딩 ─────────────────────────────────────────

const Skeleton: React.FC<{ width: string }> = ({ width }) => (
  <div
    className="h-2.5 bg-white/6 rounded animate-pulse"
    style={{ width }}
  />
)

// ── 메인 컴포넌트 ─────────────────────────────────────────

export const MediaAnalysisPanel: React.FC<Props> = ({
  mediaType,
  analysis,
  refinement,
  isAnalyzing,
  generationParams,
  className,
}) => {
  const isImage = mediaType === 'image'

  // 색상 클래스 (Tailwind CDN 동적 클래스 대신 조건식 사용)
  const accentText     = isImage ? 'text-fuchsia-400'      : 'text-orange-400'
  const accentTextMut  = isImage ? 'text-fuchsia-400/50'   : 'text-orange-400/50'
  const accentBg       = isImage ? 'bg-fuchsia-500/12'     : 'bg-orange-500/12'
  const accentBorder   = isImage ? 'border-fuchsia-500/20' : 'border-orange-500/20'
  const accentBar      = isImage ? 'bg-fuchsia-400'        : 'bg-orange-400'
  const accentIconBg   = isImage ? 'bg-fuchsia-500/15'     : 'bg-orange-500/15'
  const Icon           = isImage ? Sparkles : Film

  return (
    <aside className={className ?? 'w-56 shrink-0 flex flex-col gap-4 p-4 border-l border-black/8 dark:border-white/8 overflow-y-auto scroll-hide'}>

      {/* ── 헤더 ── */}
      <div className="flex items-center gap-2 shrink-0">
        <div className={`w-6 h-6 rounded-lg ${accentIconBg} flex items-center justify-center`}>
          <Brain size={11} className={accentText} />
        </div>
        <div>
          <p className={`text-[9px] font-black uppercase tracking-widest ${accentTextMut}`}>
            Analysis
          </p>
        </div>
      </div>

      {/* ── 로딩 스켈레톤 ── */}
      {isAnalyzing && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            {['80%', '65%', '75%', '55%', '70%'].map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton width="28px" />
                <Skeleton width={w} />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {['48px', '52px', '40px', '56px', '44px'].map((w, i) => (
              <div key={i} className="h-4 bg-white/6 rounded-full animate-pulse" style={{ width: w }} />
            ))}
          </div>
          <div className="space-y-2">
            <Skeleton width="100%" />
            <Skeleton width="100%" />
          </div>
        </div>
      )}

      {/* ── 분석 전 안내 ── */}
      {!isAnalyzing && !analysis && (
        <div className="flex flex-col items-center gap-3 py-6 opacity-40">
          <Icon size={28} className={accentText} />
          <p className="text-[9px] text-slate-400 dark:text-white/30 text-center leading-relaxed">
            프롬프트를 입력하면<br />자동으로 분석됩니다
          </p>
        </div>
      )}

      {/* ── 분석 결과 ── */}
      {!isAnalyzing && analysis && (
        <>
          {/* 장면 구성 */}
          <div className="space-y-2">
            <p className={`text-[7px] font-black uppercase tracking-widest ${accentTextMut}`}>
              장면 구성
            </p>
            <div className="space-y-1.5">
              {[
                { label: '피사체', value: analysis.subject },
                { label: '분위기', value: analysis.mood },
                { label: '조명',   value: analysis.lighting },
                { label: '구도',   value: analysis.composition },
                { label: '색조',   value: analysis.colorTone },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start gap-1.5">
                  <span className="text-[7px] text-slate-400 dark:text-white/25 w-9 shrink-0 mt-0.5">
                    {label}
                  </span>
                  <span className="text-[8px] font-semibold text-slate-600 dark:text-white/55 leading-tight">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 키워드 태그 */}
          <div className="space-y-1.5">
            <p className={`text-[7px] font-black uppercase tracking-widest ${accentTextMut}`}>
              키워드
            </p>
            <div className="flex flex-wrap gap-1">
              {analysis.tags.map(tag => (
                <TagChip key={tag} label={tag} />
              ))}
            </div>
          </div>

          {/* 품질 지표 */}
          <div className="space-y-2">
            <p className={`text-[7px] font-black uppercase tracking-widest ${accentTextMut}`}>
              품질 지표
            </p>
            <div className="space-y-2.5">
              <ScoreBar
                label="프롬프트 복잡도"
                score={analysis.complexity}
                colorClass={accentBar}
                valueClass={accentText}
              />
              <ScoreBar
                label="예측 생성 품질"
                score={analysis.promptScore}
                colorClass="bg-emerald-400"
                valueClass="text-emerald-400"
              />
            </div>
          </div>

          {/* 생성 파라미터 */}
          {generationParams && (
            <div className={`rounded-xl ${accentBg} border ${accentBorder} p-2.5 space-y-1.5`}>
              <div className="flex items-center gap-1.5">
                <Zap size={9} className={accentText} />
                <p className={`text-[7px] font-black uppercase tracking-widest ${accentTextMut}`}>
                  생성 파라미터
                </p>
              </div>
              {[
                { k: '모델',   v: generationParams.model },
                { k: '비율',   v: generationParams.aspectRatio },
                ...(generationParams.style ? [{ k: '스타일', v: generationParams.style }] : []),
              ].map(({ k, v }) => (
                <div key={k} className="flex items-center gap-1.5">
                  <span className="text-[7px] text-slate-400 dark:text-white/25 w-9 shrink-0">{k}</span>
                  <span className={`text-[8px] font-bold ${accentText} truncate`}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {/* 재요청 분석 */}
          {refinement && (
            <div className="space-y-2 border-t border-black/8 dark:border-white/8 pt-3">
              <p className={`text-[7px] font-black uppercase tracking-widest ${accentTextMut}`}>
                재요청 분석
              </p>

              <p className="text-[8px] text-slate-500 dark:text-white/40 leading-relaxed">
                {refinement.intent}
              </p>

              <div className="space-y-1">
                {refinement.changes.map((change, i) => (
                  <RefinementBadge
                    key={i}
                    type={change.type}
                    aspect={change.aspect}
                    detail={change.detail}
                  />
                ))}
              </div>

              {refinement.preserved.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[7px] text-slate-400 dark:text-white/25">유지됨</p>
                  <div className="flex flex-wrap gap-1">
                    {refinement.preserved.map(p => (
                      <TagChip key={p} label={p} dimmed />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </aside>
  )
}

export default MediaAnalysisPanel
