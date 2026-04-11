
// ═══════════════════════════════════════════════════════════
//  ContentStudio — ARHA 함수언어 미들웨어 기반 통합 콘텐츠 생성 UI
//  AnalysisData → Middleware Pipeline → Modality API 분기
//  모달리티: 영상 | 이미지 | 음악 | 코드 | 디자인 | 기획
// ═══════════════════════════════════════════════════════════

import React, { useState, useCallback, useRef } from 'react'
import {
  X, Film, ImageIcon, Music, Code2, Palette, ClipboardList,
  Play, Download, RotateCcw, Sparkles, ChevronRight,
  Layers, Zap, Activity,
} from 'lucide-react'
import { buildMiddlewareConfig, type AnalysisData } from '../services/analysisToMiddleware'
import { executePipeline }                          from '../services/middleware/pipeline'
import { routeToContent, type ContentResult }       from '../services/contentRouter'
import type { ContentModality, MiddlewarePipelineResult } from '../services/middleware/types'

// ── 타입 ──────────────────────────────────────────────────

interface Props {
  onClose:          () => void
  currentAnalysis?: AnalysisData | null
  kappa?:           number
  harnessState?:    Parameters<typeof buildMiddlewareConfig>[3]
}

type PipelineStage =
  | 'idle'
  | 'layer0'   // 입력 정규화
  | 'layer1'   // 의미 분해 (Claude)
  | 'layer2'   // 벡터 필드
  | 'layer3'   // 수식 조립 (Claude)
  | 'layer4'   // 프롬프트 컴파일
  | 'routing'  // 콘텐츠 API 호출
  | 'done'
  | 'error'

interface PipelineProgress {
  stage:    PipelineStage
  equation: string
  narrative: string
  temperature: number
}

// ── 상수 ──────────────────────────────────────────────────

const MODALITY_CONFIG: ReadonlyArray<{
  id:      ContentModality
  label:   string
  labelKo: string
  icon:    React.ReactNode
  color:   string
  bgColor: string
}> = [
  { id: 'video',  label: 'Video',  labelKo: '영상',  icon: <Film      size={14} />, color: 'text-orange-400',  bgColor: 'bg-orange-500/15'  },
  { id: 'image',  label: 'Image',  labelKo: '이미지', icon: <ImageIcon size={14} />, color: 'text-violet-400',  bgColor: 'bg-violet-500/15'  },
  { id: 'music',  label: 'Music',  labelKo: '음악',  icon: <Music     size={14} />, color: 'text-cyan-400',    bgColor: 'bg-cyan-500/15'    },
  { id: 'code',   label: 'Code',   labelKo: '코드',  icon: <Code2     size={14} />, color: 'text-emerald-400', bgColor: 'bg-emerald-500/15' },
  { id: 'design', label: 'Design', labelKo: '디자인', icon: <Palette   size={14} />, color: 'text-pink-400',    bgColor: 'bg-pink-500/15'    },
  { id: 'plan',   label: 'Plan',   labelKo: '기획',  icon: <ClipboardList size={14} />, color: 'text-amber-400', bgColor: 'bg-amber-500/15' },
]

const PIPELINE_STAGES: ReadonlyArray<{ key: PipelineStage; label: string; isLLM: boolean }> = [
  { key: 'layer0',  label: 'L0 입력 정규화',    isLLM: false },
  { key: 'layer1',  label: 'L1 의미 분해',       isLLM: true  },
  { key: 'layer2',  label: 'L2 벡터 필드 구성', isLLM: false },
  { key: 'layer3',  label: 'L3 수식 조립',       isLLM: true  },
  { key: 'layer4',  label: 'L4 프롬프트 컴파일', isLLM: false },
  { key: 'routing', label: 'API 라우팅',          isLLM: false },
]

const EXPRESSION_MODE_LABEL: Record<string, string> = {
  DEEP_EMPATHY:    '깊은 공감',
  SOFT_WARMTH:     '부드러운 온기',
  COOL_CLARITY:    '서늘한 명료함',
  SURGE_OVERRIDE:  '감성 급등',
  STABLE_NEUTRAL:  '안정 중립',
  CREATIVE_FLOW:   '창의 흐름',
  MELANCHOLIC_DEPTH: '우울한 깊이',
}

// ── 헬퍼 ──────────────────────────────────────────────────

function stageIndex(stage: PipelineStage): number {
  const order: PipelineStage[] = ['layer0','layer1','layer2','layer3','layer4','routing','done']
  return order.indexOf(stage)
}

// ── 컴포넌트 ───────────────────────────────────────────────

const ContentStudio: React.FC<Props> = ({ onClose, currentAnalysis, kappa = 0.5, harnessState }) => {

  // ── 상태 ──────────────────────────────────────────────
  const [activeModality, setActiveModality] = useState<ContentModality>('image')
  const [prompt,         setPrompt]         = useState('')
  const [isGenerating,   setIsGenerating]   = useState(false)
  const [pipelineStage,  setPipelineStage]  = useState<PipelineStage>('idle')
  const [pipelineData,   setPipelineData]   = useState<PipelineProgress | null>(null)
  const [result,         setResult]         = useState<ContentResult | null>(null)
  const [error,          setError]          = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  // ── 생성 핸들러 ────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    const text = prompt.trim()
    if (!text || isGenerating) return

    setIsGenerating(true)
    setError(null)
    setResult(null)
    setPipelineData(null)

    try {
      // Layer 0
      setPipelineStage('layer0')
      const config = buildMiddlewareConfig(
        currentAnalysis,
        kappa,
        [activeModality],
        harnessState,
      )

      // Layer 1 → 3 (서버) + Layer 2, 4 (클라이언트)
      setPipelineStage('layer1')
      let pipelineResult: MiddlewarePipelineResult

      // executePipeline 내부에서 L0→L4 모두 처리되지만
      // 진행 상태를 단계별로 표시하기 위해 약간의 지연 시뮬레이션
      const pipelinePromise = executePipeline(text, config)

      // 레이어 진행 UI 시뮬레이션 (실제 서버 호출 병렬)
      const simulateStages = async () => {
        await new Promise(r => setTimeout(r, 600))
        setPipelineStage('layer2')
        await new Promise(r => setTimeout(r, 400))
        setPipelineStage('layer3')
        await new Promise(r => setTimeout(r, 800))
        setPipelineStage('layer4')
      }

      const [result] = await Promise.all([pipelinePromise, simulateStages()])
      pipelineResult = result

      setPipelineData({
        stage:       'layer4',
        equation:    pipelineResult.equation,
        narrative:   pipelineResult.narrative,
        temperature: pipelineResult.temperature,
      })

      // 콘텐츠 API 라우팅
      setPipelineStage('routing')
      const contentResult = await routeToContent({
        modality:    activeModality,
        prompts:     pipelineResult.modality_prompts,
        aspectRatio: '16:9',
        temperature: pipelineResult.temperature,
      })

      setResult(contentResult)
      setPipelineStage('done')

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setPipelineStage('error')
    } finally {
      setIsGenerating(false)
    }
  }, [prompt, isGenerating, activeModality, currentAnalysis, kappa, harnessState])

  // ── 다운로드 ───────────────────────────────────────────
  const handleDownload = () => {
    if (!result?.url) return
    const a = document.createElement('a')
    a.href     = result.url
    a.download = `arha-${activeModality}-${Date.now()}`
    a.click()
  }

  const handleReset = () => {
    setResult(null)
    setError(null)
    setPipelineStage('idle')
    setPipelineData(null)
    setPrompt('')
  }

  // ── 활성 모달리티 설정 ────────────────────────────────
  const activeMod = MODALITY_CONFIG.find(m => m.id === activeModality)!

  // ── JSX ───────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-panel w-full sm:max-w-5xl sm:mx-4 h-[92dvh] sm:h-[90vh] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col shadow-2xl">

        {/* ── 헤더 ── */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-black/10 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl ${activeMod.bgColor} flex items-center justify-center`}>
              <span className={activeMod.color}>{activeMod.icon}</span>
            </div>
            <div>
              <h2 className="text-[13px] font-black uppercase tracking-widest text-slate-700 dark:text-white/90">
                Content Studio
              </h2>
              <p className="text-[8px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-widest">
                ARHA × 함수언어 미들웨어
              </p>
            </div>
          </div>

          {/* 감성 상태 배지 */}
          {currentAnalysis?.expression_mode && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5">
              <Activity size={10} className="text-purple-400" />
              <span className="text-[9px] font-black text-slate-500 dark:text-white/40 uppercase tracking-wider">
                {EXPRESSION_MODE_LABEL[currentAnalysis.expression_mode] ?? currentAnalysis.expression_mode}
              </span>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-all text-slate-500 dark:text-white/50"
          >
            <X size={16} />
          </button>
        </header>

        {/* ── 모달리티 탭 ── */}
        <div className="flex items-center gap-1 px-4 sm:px-6 py-2 border-b border-black/10 dark:border-white/10 overflow-x-auto shrink-0 scrollbar-none">
          {MODALITY_CONFIG.map(mod => (
            <button
              key={mod.id}
              onClick={() => { setActiveModality(mod.id); handleReset() }}
              disabled={isGenerating}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black whitespace-nowrap transition-all disabled:opacity-40 ${
                activeModality === mod.id
                  ? `${mod.bgColor} ${mod.color}`
                  : 'text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/60 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              {mod.icon}
              <span>{mod.labelKo}</span>
            </button>
          ))}
        </div>

        {/* ── 본문 ── */}
        <div className="flex-1 overflow-y-auto flex flex-col sm:flex-row min-h-0">

          {/* ── 왼쪽: 입력 + 파이프라인 ── */}
          <div className="sm:w-80 sm:min-w-80 flex flex-col border-b sm:border-b-0 sm:border-r border-black/10 dark:border-white/10 shrink-0">

            {/* 감성 컨텍스트 */}
            {currentAnalysis && (
              <div className="mx-4 mt-4 p-3 rounded-xl bg-purple-500/8 border border-purple-500/20">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles size={9} className="text-purple-400" />
                  <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">감성 컨텍스트</span>
                </div>
                <div className="grid grid-cols-3 gap-x-3 gap-y-1">
                  {currentAnalysis.psi && (
                    <>
                      <div className="text-[8px] text-slate-400 dark:text-white/30">Ψ.x</div>
                      <div className="text-[8px] text-slate-400 dark:text-white/30">Ψ.y</div>
                      <div className="text-[8px] text-slate-400 dark:text-white/30">Ψ.z</div>
                      <div className="text-[9px] font-black text-purple-300">{currentAnalysis.psi.x.toFixed(2)}</div>
                      <div className="text-[9px] font-black text-purple-300">{currentAnalysis.psi.y.toFixed(2)}</div>
                      <div className="text-[9px] font-black text-purple-300">{currentAnalysis.psi.z.toFixed(2)}</div>
                    </>
                  )}
                  {currentAnalysis.resonance !== undefined && (
                    <>
                      <div className="text-[8px] text-slate-400 dark:text-white/30 col-span-2">공명도</div>
                      <div className="text-[9px] font-black text-cyan-300">{(currentAnalysis.resonance * 100).toFixed(0)}%</div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* 프롬프트 입력 */}
            <div className="mx-4 mt-3 flex flex-col gap-2">
              <label className="text-[9px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest">
                콘텐츠 요청
              </label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate() }}
                disabled={isGenerating}
                rows={4}
                placeholder={`${activeMod.labelKo} 콘텐츠를 묘사해 주세요...\n예: "새벽 빗소리, 혼자 걷는 기분"`}
                className="w-full resize-none rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 px-3 py-2.5 text-[12px] text-slate-700 dark:text-white/80 placeholder:text-slate-400 dark:placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 transition-all disabled:opacity-40"
              />
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-[11px] font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  activeMod.bgColor
                } ${activeMod.color} hover:brightness-110 active:scale-[0.98]`}
              >
                {isGenerating ? (
                  <>
                    <div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    생성 중...
                  </>
                ) : (
                  <>
                    <Zap size={12} />
                    생성하기
                    <span className="text-[8px] opacity-60">⌘↵</span>
                  </>
                )}
              </button>
            </div>

            {/* ── 파이프라인 진행 상태 ── */}
            <div className="mx-4 mt-4 mb-4">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Layers size={9} className="text-slate-400 dark:text-white/30" />
                <span className="text-[9px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest">
                  미들웨어 파이프라인
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {PIPELINE_STAGES.map((stage, idx) => {
                  const currentIdx = stageIndex(pipelineStage)
                  const stageIdx   = idx  // stage order matches PIPELINE_STAGES index
                  const isDone     = pipelineStage === 'done' || currentIdx > stageIdx + 1
                  const isActive   = !isDone && pipelineStage !== 'idle' && pipelineStage !== 'error'
                    && (
                      (stage.key === 'layer0' && ['layer0','layer1','layer2','layer3','layer4','routing'].includes(pipelineStage) && stageIdx === 0)
                      || stage.key === pipelineStage
                    )
                  const isCompleted = pipelineStage === 'done' || (
                    currentIdx > stageIdx + 1 && pipelineStage !== 'idle'
                  )

                  return (
                    <div key={stage.key} className="flex items-center gap-2">
                      {/* 상태 도트 */}
                      <div className={`w-2 h-2 rounded-full shrink-0 transition-all ${
                        isCompleted
                          ? 'bg-emerald-400'
                          : isActive
                            ? `${activeMod.color.replace('text-','bg-')} animate-pulse`
                            : pipelineStage === 'error'
                              ? 'bg-red-400/40'
                              : 'bg-black/10 dark:bg-white/10'
                      }`} />
                      <span className={`text-[9px] font-bold transition-all ${
                        isCompleted
                          ? 'text-emerald-400'
                          : isActive
                            ? activeMod.color
                            : 'text-slate-400 dark:text-white/25'
                      }`}>
                        {stage.label}
                      </span>
                      {stage.isLLM && (
                        <span className="text-[7px] font-black text-slate-300 dark:text-white/20 uppercase">AI</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* 수식 결과 */}
              {pipelineData && (
                <div className="mt-3 p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
                  <div className="text-[8px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest mb-1.5">
                    생성된 수식
                  </div>
                  <div className="text-[11px] font-mono text-purple-400 dark:text-purple-300 break-all leading-relaxed">
                    {pipelineData.equation}
                  </div>
                  {pipelineData.narrative && (
                    <p className="mt-1.5 text-[9px] text-slate-500 dark:text-white/40 leading-relaxed">
                      {pipelineData.narrative}
                    </p>
                  )}
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[8px] text-slate-400 dark:text-white/25">T={pipelineData.temperature.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── 오른쪽: 결과 영역 ── */}
          <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 min-h-[200px]">

            {/* 에러 */}
            {pipelineStage === 'error' && error && (
              <div className="w-full max-w-md p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
                <p className="text-[11px] text-red-400 font-medium leading-relaxed">{error}</p>
                <button
                  onClick={handleReset}
                  className="mt-3 flex items-center gap-1.5 mx-auto text-[10px] font-black text-red-400 hover:text-red-300 transition-all"
                >
                  <RotateCcw size={11} /> 다시 시도
                </button>
              </div>
            )}

            {/* 대기 상태 */}
            {pipelineStage === 'idle' && !result && (
              <div className="flex flex-col items-center gap-3 text-center opacity-40">
                <div className={`w-14 h-14 rounded-2xl ${activeMod.bgColor} flex items-center justify-center`}>
                  <span className={`${activeMod.color} scale-150`}>{activeMod.icon}</span>
                </div>
                <div>
                  <p className="text-[12px] font-black text-slate-600 dark:text-white/60">
                    {activeMod.labelKo} 생성 준비
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-white/30 mt-0.5">
                    왼쪽에서 요청을 입력하고 생성하기를 눌러주세요
                  </p>
                </div>
              </div>
            )}

            {/* 생성 중 애니메이션 */}
            {isGenerating && (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="relative w-16 h-16">
                  <div className={`absolute inset-0 rounded-full border-2 ${activeMod.color.replace('text-','border-')} opacity-20 animate-ping`} />
                  <div className={`absolute inset-2 rounded-full border-2 ${activeMod.color.replace('text-','border-')} border-t-transparent animate-spin`} />
                  <div className={`absolute inset-4 rounded-full ${activeMod.bgColor} flex items-center justify-center`}>
                    <span className={activeMod.color}>{activeMod.icon}</span>
                  </div>
                </div>
                <div>
                  <p className="text-[12px] font-black text-slate-600 dark:text-white/70">
                    {activeMod.labelKo} 생성 중
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-white/30 mt-0.5">
                    함수언어 미들웨어 처리 중...
                  </p>
                </div>
              </div>
            )}

            {/* ── 결과 표시 ── */}
            {result && !isGenerating && pipelineStage === 'done' && (
              <div className="w-full flex flex-col items-center gap-4">

                {/* 비디오 결과 */}
                {result.modality === 'video' && result.url && (
                  <div className="w-full max-w-xl rounded-2xl overflow-hidden bg-black shadow-xl">
                    <video
                      src={result.url}
                      controls
                      autoPlay
                      loop
                      className="w-full"
                    />
                  </div>
                )}

                {/* 이미지 결과 */}
                {result.modality === 'image' && result.url && (
                  <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-xl">
                    <img
                      src={result.url}
                      alt="Generated"
                      className="w-full object-contain"
                    />
                  </div>
                )}

                {/* 음악 결과 */}
                {result.modality === 'music' && (result.url || result.text) && (
                  <div className="w-full max-w-md p-4 rounded-2xl bg-cyan-500/8 border border-cyan-500/20">
                    <div className="flex items-center gap-2 mb-3">
                      <Music size={14} className="text-cyan-400" />
                      <span className="text-[11px] font-black text-cyan-400">음악 생성 완료</span>
                    </div>
                    {result.url ? (
                      <audio
                        ref={audioRef}
                        src={result.url}
                        controls
                        className="w-full"
                      />
                    ) : (
                      // 음악 프롬프트 텍스트 (Lyria 미연동 시)
                      <div className="p-3 rounded-xl bg-black/10 dark:bg-white/5">
                        <p className="text-[9px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest mb-1.5">
                          음악 프롬프트
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-white/60 leading-relaxed font-mono">
                          {result.text}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 코드/디자인/기획 텍스트 결과 */}
                {['code','design','plan'].includes(result.modality) && result.text && (
                  <div className="w-full max-w-2xl">
                    <div className={`flex items-center gap-2 mb-2 ${activeMod.color}`}>
                      {activeMod.icon}
                      <span className="text-[11px] font-black">{activeMod.labelKo} 프롬프트 컴파일 완료</span>
                    </div>
                    <pre className={`p-4 rounded-2xl ${activeMod.bgColor} border border-black/10 dark:border-white/10 text-[11px] text-slate-700 dark:text-white/70 font-mono leading-relaxed whitespace-pre-wrap break-words overflow-auto max-h-80`}>
                      {result.text}
                    </pre>
                  </div>
                )}

                {/* 오류 메시지 (result level) */}
                {result.error && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <p className="text-[11px] text-red-400">{result.error}</p>
                  </div>
                )}

                {/* 액션 버튼 */}
                <div className="flex items-center gap-2">
                  {result.url && (
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 text-[10px] font-black text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/60 transition-all"
                    >
                      <Download size={11} /> 다운로드
                    </button>
                  )}
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 text-[10px] font-black text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/60 transition-all"
                  >
                    <RotateCcw size={11} /> 새로 만들기
                  </button>
                  <div className="flex items-center gap-1 ml-1">
                    <ChevronRight size={9} className="text-emerald-400" />
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">완료</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── 푸터: 미들웨어 정보 ── */}
        <footer className="flex items-center justify-between px-4 sm:px-6 py-2 border-t border-black/10 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Play size={7} className="text-slate-300 dark:text-white/20" />
              <span className="text-[8px] font-bold text-slate-300 dark:text-white/20 uppercase tracking-wider">
                Layer 0→4 파이프라인
              </span>
            </div>
            <span className="text-[8px] text-slate-300 dark:text-white/15">·</span>
            <span className="text-[8px] font-bold text-slate-300 dark:text-white/20 uppercase tracking-wider">
              Claude Sonnet × Lyria 3
            </span>
          </div>
          <div className={`text-[8px] font-black uppercase tracking-widest ${
            pipelineStage === 'done'  ? 'text-emerald-400' :
            pipelineStage === 'error' ? 'text-red-400'     :
            isGenerating              ? activeMod.color     :
            'text-slate-300 dark:text-white/20'
          }`}>
            {pipelineStage === 'idle'    ? 'READY'      :
             pipelineStage === 'done'    ? 'DONE'       :
             pipelineStage === 'error'   ? 'ERROR'      :
             pipelineStage === 'routing' ? 'ROUTING...' :
             `${pipelineStage.toUpperCase()} →`}
          </div>
        </footer>

      </div>
    </div>
  )
}

export default ContentStudio
