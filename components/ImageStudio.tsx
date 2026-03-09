
import React, { useState, useCallback, useEffect, useRef } from 'react'
import { X, Sparkles, Download, RotateCcw, ImageIcon, Wand2, SlidersHorizontal, Brain } from 'lucide-react'
import { generateImage, type GenerateImageRequest } from '../services/imageService'
import type { UserTier } from '../lib/modelStrategy'
import { analyzePrompt, analyzeRefinement, type PromptAnalysis, type RefinementAnalysis } from '../services/promptAnalyzer'
import { detectRefinementIntent, type RefinementIntent } from '../lib/promptPipeline'
import { describeError, type GenerationError } from '../lib/generationError'
import { prependCapped } from '../lib/fp'
import { type AspectRatio } from '../lib/modelStrategy'
import MediaAnalysisPanel from './MediaAnalysisPanel'

// ── 상수 ─────────────────────────────────────────────────

const STYLE_PRESETS = [
  { id: 'arha',       label: 'ARHA',       desc: 'ARHA 감성'  },
  { id: 'photo',      label: 'Realistic',  desc: '사실적 사진' },
  { id: 'anime',      label: 'Anime',      desc: '애니메이션'  },
  { id: 'watercolor', label: 'Watercolor', desc: '수채화'      },
  { id: 'oil',        label: 'Oil Paint',  desc: '유화'        },
  { id: 'sketch',     label: 'Sketch',     desc: '스케치'      },
] as const

const ASPECT_RATIOS = [
  { id: '1:1',  label: '1:1',  desc: '정방형', w: 20, h: 20 },
  { id: '16:9', label: '16:9', desc: '가로형', w: 24, h: 14 },
  { id: '9:16', label: '9:16', desc: '세로형', w: 14, h: 24 },
  { id: '4:3',  label: '4:3',  desc: '표준형', w: 22, h: 17 },
  { id: '3:4',  label: '3:4',  desc: '초상화', w: 17, h: 22 },
] as const

type StyleId  = typeof STYLE_PRESETS[number]['id']
type StudioTab = 'controls' | 'canvas' | 'analysis'

const ANALYSIS_DEBOUNCE_MS = 900

// ── Props ────────────────────────────────────────────────

interface Props {
  onClose:        () => void
  initialPrompt?: string
  tier?:          UserTier
}

// ── 컴포넌트 ─────────────────────────────────────────────

const ImageStudio: React.FC<Props> = ({ onClose, initialPrompt = '', tier: _tier }) => {
  const tier: UserTier = _tier ?? 'free'

  // 모바일 탭 상태
  const [activeTab, setActiveTab]         = useState<StudioTab>('controls')

  // 기본 상태
  const [prompt, setPrompt]               = useState(initialPrompt)
  const [aspectRatio, setAspectRatio]     = useState<AspectRatio>('1:1')
  const [style, setStyle]                 = useState<StyleId>('arha')
  const [isGenerating, setIsGenerating]   = useState(false)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [history, setHistory]             = useState<string[]>([])
  const [error, setError]                 = useState<string | null>(null)

  // 재요청 보정 상태
  const [refinementInput, setRefinementInput]   = useState('')
  const [prevPrompt, setPrevPrompt]             = useState('')
  const [refinements, setRefinements]           = useState<RefinementIntent[]>([])
  const [isRefining, setIsRefining]             = useState(false)

  // 분석 상태
  const [analysis, setAnalysis]                         = useState<PromptAnalysis | null>(null)
  const [refinementAnalysis, setRefinementAnalysis]     = useState<RefinementAnalysis | null>(null)
  const [isAnalyzing, setIsAnalyzing]                   = useState(false)

  const analysisTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 프롬프트 변경 시 debounce 분석
  useEffect(() => {
    if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current)
    if (!prompt.trim() || prompt.length < 5) {
      setAnalysis(null)
      setIsAnalyzing(false)
      return
    }
    setIsAnalyzing(true)
    analysisTimerRef.current = setTimeout(async () => {
      const result = await analyzePrompt(prompt)
      setAnalysis(result)
      setIsAnalyzing(false)
    }, ANALYSIS_DEBOUNCE_MS)
    return () => { if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current) }
  }, [prompt])

  // 이미지 생성
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return
    setIsGenerating(true)
    setActiveTab('canvas')
    setError(null)
    setRefinementAnalysis(null)
    setRefinements([])
    try {
      const url = await generateImage({
        rawPrompt: prompt,
        aspectRatio,
        opts: { style, refinements: [] },
        tier,
      })
      setGeneratedImage(url)
      setHistory(prev => prependCapped(url, 8)(prev))
      setPrevPrompt(prompt)
    } catch (e) {
      const ge = e as GenerationError
      setError(ge?._tag ? describeError(ge) : '이미지 생성에 실패했어요. 다시 시도해주세요.')
    } finally {
      setIsGenerating(false)
    }
  }, [prompt, aspectRatio, style, isGenerating])

  // 재요청 보정
  const handleRefine = useCallback(async () => {
    if (!refinementInput.trim() || isGenerating || isRefining) return
    setIsRefining(true)
    setActiveTab('canvas')
    setError(null)

    const intent         = detectRefinementIntent(refinementInput)
    const newRefinements = [...refinements, intent]
    setRefinements(newRefinements)

    // 비동기 Gemini 분석 (UI 표시용, 생성 블로킹 없음)
    analyzeRefinement(prevPrompt, refinementInput).then(ra => {
      if (ra) setRefinementAnalysis(ra)
    })

    try {
      const url = await generateImage({
        rawPrompt: prevPrompt,
        aspectRatio,
        opts: { style, refinements: newRefinements },
        tier,
      })
      setGeneratedImage(url)
      setHistory(prev => prependCapped(url, 8)(prev))
      setRefinementInput('')
    } catch (e) {
      const ge = e as GenerationError
      setError(ge?._tag ? describeError(ge) : '보정 생성에 실패했어요. 다시 시도해주세요.')
    } finally {
      setIsRefining(false)
    }
  }, [refinementInput, prevPrompt, refinements, aspectRatio, style, isGenerating, isRefining])

  const handleDownload = () => {
    if (!generatedImage) return
    const a    = document.createElement('a')
    a.href     = generatedImage
    a.download = `arha-image-${Date.now()}.png`
    a.click()
  }

  const handleReset = () => {
    setGeneratedImage(null)
    setPrompt('')
    setPrevPrompt('')
    setRefinements([])
    setRefinementInput('')
    setRefinementAnalysis(null)
    setError(null)
  }

  const generationParams = generatedImage ? {
    model:       'Gemini Flash → Imagen 4',
    aspectRatio,
    style:       STYLE_PRESETS.find(s => s.id === style)?.label,
  } : undefined

  const isBusy = isGenerating || isRefining

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-panel w-full sm:max-w-6xl sm:mx-4 h-[90dvh] sm:h-[92vh] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col shadow-2xl">

        {/* ── 헤더 ── */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-black/10 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-fuchsia-500/15 flex items-center justify-center">
              <Sparkles size={15} className="text-fuchsia-400" />
            </div>
            <div>
              <h2 className="text-[13px] font-black uppercase tracking-widest text-slate-700 dark:text-white/90">Image Studio</h2>
              <p className="text-[8px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-widest">
                {tier === 'paid' || tier === 'admin'
                ? 'ARHA × Gemini 3.1 Flash · Pro Quality'
                : 'ARHA × Gemini Flash · FP Architecture'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-all text-slate-500 dark:text-white/50"
          >
            <X size={16} />
          </button>
        </header>

        {/* ── 바디 ── */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* 왼쪽: 컨트롤 — 모바일: 탭 전환 / sm+: 항상 표시 */}
          <aside className={`${activeTab === 'controls' ? 'flex' : 'hidden'} sm:flex flex-col gap-3 sm:gap-4 p-4 sm:p-5 w-full sm:w-52 lg:w-64 shrink-0 border-r border-black/10 dark:border-white/10 overflow-y-auto scroll-hide`}>

            {/* 모델 배지 */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[9px] font-black tracking-widest w-fit ${
              tier === 'paid' || tier === 'admin'
                ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400'
                : 'bg-fuchsia-500/10 text-fuchsia-500/70 dark:text-fuchsia-400/60'
            }`}>
              <span>{tier === 'paid' || tier === 'admin' ? '✦ PRO' : 'FREE'}</span>
              <span className="opacity-50">·</span>
              <span>{tier === 'paid' || tier === 'admin' ? 'Gemini 3.1 Flash' : 'Gemini 2.0 Flash'}</span>
            </div>

            {/* 프롬프트 */}
            <div>
              <label className="text-[8px] font-black uppercase tracking-widest text-fuchsia-500/60 dark:text-fuchsia-400/60 mb-1.5 block">
                Prompt
              </label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="어떤 이미지를 만들고 싶으세요? 상세하게 묘사할수록 좋아요."
                rows={5}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate() }}
                className="w-full rounded-xl p-3 text-[12px] bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-slate-700 dark:text-white/80 placeholder:text-slate-400 dark:placeholder:text-white/25 focus:outline-none focus:border-fuchsia-400/50 resize-none leading-relaxed"
              />
              <p className="text-[8px] text-slate-400 dark:text-white/20 mt-1">Ctrl+Enter 로 생성</p>
            </div>

            {/* 비율 */}
            <div>
              <label className="text-[8px] font-black uppercase tracking-widest text-fuchsia-500/60 dark:text-fuchsia-400/60 mb-1.5 block">
                Aspect Ratio
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {ASPECT_RATIOS.map(ar => (
                  <button
                    key={ar.id}
                    onClick={() => setAspectRatio(ar.id as AspectRatio)}
                    title={ar.desc}
                    className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl border transition-all ${
                      aspectRatio === ar.id
                        ? 'border-fuchsia-400 bg-fuchsia-500/10'
                        : 'border-black/10 dark:border-white/10 hover:border-fuchsia-400/30 bg-black/3 dark:bg-white/3'
                    }`}
                  >
                    <div
                      className={`rounded-sm transition-all ${aspectRatio === ar.id ? 'bg-fuchsia-400' : 'bg-slate-400/40 dark:bg-white/20'}`}
                      style={{ width: ar.w, height: ar.h }}
                    />
                    <span className={`text-[7px] font-bold ${aspectRatio === ar.id ? 'text-fuchsia-400' : 'text-slate-500 dark:text-white/35'}`}>
                      {ar.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 스타일 */}
            <div>
              <label className="text-[8px] font-black uppercase tracking-widest text-fuchsia-500/60 dark:text-fuchsia-400/60 mb-1.5 block">
                Style
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {STYLE_PRESETS.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setStyle(s.id)}
                    className={`flex flex-col items-start px-3 py-2.5 rounded-xl border transition-all text-left ${
                      style === s.id
                        ? 'border-fuchsia-400 bg-fuchsia-500/10'
                        : 'border-black/10 dark:border-white/10 hover:border-fuchsia-400/30 bg-black/3 dark:bg-white/3'
                    }`}
                  >
                    <span className={`text-[10px] font-black ${style === s.id ? 'text-fuchsia-400' : 'text-slate-700 dark:text-white/70'}`}>
                      {s.label}
                    </span>
                    <span className="text-[8px] text-slate-400 dark:text-white/30">{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 재요청 보정 섹션 — 이미지 생성 후 표시 */}
            {prevPrompt && !isBusy && (
              <div className="border-t border-black/8 dark:border-white/8 pt-3 space-y-2">
                <label className="text-[8px] font-black uppercase tracking-widest text-fuchsia-500/60 dark:text-fuchsia-400/60 flex items-center gap-1">
                  <Wand2 size={8} />
                  보정 요청
                </label>

                {refinements.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {refinements.map((r, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full text-[7px] font-bold bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400">
                        {r.label}
                      </span>
                    ))}
                  </div>
                )}

                <textarea
                  value={refinementInput}
                  onChange={e => setRefinementInput(e.target.value)}
                  placeholder="예: 좀 더 밝게, 배경 흐리게, 색감 선명하게..."
                  rows={3}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleRefine() }}
                  className="w-full rounded-xl p-3 text-[11px] bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-slate-700 dark:text-white/80 placeholder:text-slate-400 dark:placeholder:text-white/25 focus:outline-none focus:border-fuchsia-400/50 resize-none leading-relaxed"
                />
                <button
                  onClick={handleRefine}
                  disabled={!refinementInput.trim()}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-[11px] transition-all active:scale-95 ${
                    !refinementInput.trim()
                      ? 'bg-fuchsia-500/10 text-fuchsia-400/35 cursor-not-allowed'
                      : 'bg-fuchsia-500/15 border border-fuchsia-500/25 text-fuchsia-400 hover:bg-fuchsia-500/25'
                  }`}
                >
                  <Wand2 size={11} /> 보정 생성
                </button>
              </div>
            )}

            {/* 생성 버튼 */}
            <button
              onClick={handleGenerate}
              disabled={isBusy || !prompt.trim()}
              className={`mt-auto flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-[12px] tracking-wide transition-all active:scale-95 ${
                isBusy || !prompt.trim()
                  ? 'bg-fuchsia-500/15 text-fuchsia-400/35 cursor-not-allowed'
                  : 'bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white hover:brightness-110 shadow-lg shadow-fuchsia-500/25'
              }`}
            >
              {isBusy
                ? <><span className="animate-spin inline-block">✦</span> {isRefining ? '보정 중...' : '생성 중...'}</>
                : <><Sparkles size={13} /> 이미지 생성</>
              }
            </button>
          </aside>

          {/* 중앙: 캔버스 — 모바일: 탭 전환 / sm+: 항상 표시 */}
          <main className={`${activeTab === 'canvas' ? 'flex' : 'hidden'} sm:flex flex-1 flex-col items-center justify-center p-4 sm:p-8 overflow-hidden relative min-w-0`}>

            {/* 로딩 */}
            {isBusy && (
              <div className="flex flex-col items-center gap-5">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 rounded-full border-2 border-fuchsia-500/10 animate-ping" />
                  <div className="absolute inset-2 rounded-full border-2 border-fuchsia-500/20 animate-ping" style={{ animationDelay: '0.3s' }} />
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-fuchsia-400 border-r-fuchsia-400/40 animate-spin" />
                  <Sparkles size={22} className="absolute inset-0 m-auto text-fuchsia-400 animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-bold text-slate-700 dark:text-white/80">
                    {isRefining ? '보정 이미지를 생성하고 있어요' : '이미지를 그리고 있어요'}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-white/35 mt-1">Gemini Flash × Imagen 4</p>
                </div>
              </div>
            )}

            {/* 에러 */}
            {!isBusy && error && (
              <div className="flex flex-col items-center gap-3 text-center max-w-xs">
                <p className="text-[12px] text-red-400 leading-relaxed">{error}</p>
                <button onClick={() => setError(null)} className="text-[10px] text-fuchsia-400 hover:underline">닫기</button>
              </div>
            )}

            {/* 결과 */}
            {!isBusy && !error && generatedImage && (
              <div className="flex flex-col items-center gap-4 w-full max-w-xl animate-in fade-in duration-300">
                <div className="rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 shadow-2xl shadow-black/20 w-full flex items-center justify-center bg-black/5 dark:bg-white/3">
                  <img
                    src={generatedImage}
                    alt="Generated"
                    className="max-h-[52vh] max-w-full object-contain"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-500 dark:text-fuchsia-400 text-[11px] font-bold hover:bg-fuchsia-500/20 transition-all active:scale-95"
                  >
                    <Download size={12} /> 다운로드
                  </button>
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-slate-500 dark:text-white/40 text-[11px] font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-all active:scale-95"
                  >
                    <RotateCcw size={12} /> 새로 만들기
                  </button>
                </div>
              </div>
            )}

            {/* 빈 상태 */}
            {!isBusy && !error && !generatedImage && (
              <div className="flex flex-col items-center gap-3 opacity-25">
                <div className="w-28 h-28 rounded-3xl border-2 border-dashed border-fuchsia-400/50 flex items-center justify-center">
                  <ImageIcon size={36} className="text-fuchsia-400/70" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-white/50 font-medium text-center">
                  왼쪽에서 프롬프트를 입력하고<br />이미지를 생성하세요
                </p>
              </div>
            )}

            {/* 히스토리 스트립 */}
            {history.length > 1 && (
              <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-6 sm:right-6 flex gap-2 overflow-x-auto scroll-hide">
                {history.slice(1).map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setGeneratedImage(img)}
                    className="w-11 h-11 shrink-0 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 hover:border-fuchsia-400/60 opacity-60 hover:opacity-100 transition-all"
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </main>

          {/* 오른쪽: 분석 패널 — 모바일: 탭 전환 / lg+: 항상 표시 */}
          <div className={`${activeTab === 'analysis' ? 'flex' : 'hidden'} lg:flex flex-col overflow-hidden min-w-0 flex-1 lg:flex-none`}>
            <MediaAnalysisPanel
              mediaType="image"
              analysis={analysis}
              refinement={refinementAnalysis}
              isAnalyzing={isAnalyzing}
              generationParams={generationParams}
              className="flex-1 flex flex-col gap-4 p-4 border-l border-black/8 dark:border-white/8 overflow-y-auto scroll-hide lg:w-56 lg:flex-none"
            />
          </div>
        </div>

        {/* ── 모바일 하단 탭 바 ── */}
        <nav className="sm:hidden flex shrink-0 border-t border-black/10 dark:border-white/10">
          {([
            { id: 'controls' as StudioTab, icon: <SlidersHorizontal size={15} />, label: '설정' },
            { id: 'canvas'   as StudioTab, icon: <ImageIcon          size={15} />, label: '결과' },
            { id: 'analysis' as StudioTab, icon: <Brain              size={15} />, label: '분석' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
                activeTab === tab.id
                  ? 'text-fuchsia-400'
                  : 'text-slate-400 dark:text-white/30'
              }`}
            >
              {tab.icon}
              <span className="text-[8px] font-black uppercase tracking-widest">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}

export default ImageStudio
