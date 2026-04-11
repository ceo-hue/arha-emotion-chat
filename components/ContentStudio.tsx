
// ═══════════════════════════════════════════════════════════
//  ContentStudio — 통합 콘텐츠 생성 스튜디오
//  Image · Video · Music · Code · Design · Plan 한 공간
//  함수언어 미들웨어(Layer 0→4) 파이프라인 중심
// ═══════════════════════════════════════════════════════════

import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  X, Film, ImageIcon, Music, Code2, Palette, ClipboardList,
  Download, RotateCcw, Zap, Layers, ChevronRight, Play,
} from 'lucide-react'
import { generateVideo }   from '../services/videoService'
import { generateImage }   from '../services/imageService'
import { generateMusic }   from '../services/musicService'
import { buildMiddlewareConfig, type AnalysisData } from '../services/analysisToMiddleware'
import { executePipeline } from '../services/middleware/pipeline'
import type { ContentModality, MiddlewarePipelineResult } from '../services/middleware/types'
import SeriesVideoStudio   from './SeriesVideoStudio'
import type { VideoAspectRatio, AspectRatio, UserTier } from '../lib/modelStrategy'
import { describeError }   from '../lib/generationError'

// ── 타입 ──────────────────────────────────────────────────

interface Props {
  onClose:           () => void
  initialModality?:  ContentModality
  initialPrompt?:    string
  currentAnalysis?:  AnalysisData | null
  kappa?:            number
  tier?:             UserTier
}

type PipelineStage = 'idle' | 'layer0' | 'layer1' | 'layer2' | 'layer3' | 'layer4' | 'routing' | 'done' | 'error'
type VideoMode     = 'single' | 'series'
type ImageStyle    = 'arha' | 'photo' | 'anime' | 'watercolor' | 'oil' | 'sketch'

interface PipelineSnapshot {
  equation:    string
  narrative:   string
  temperature: number
}

// ── 상수 ──────────────────────────────────────────────────

const MODALITY_META: Record<ContentModality, {
  label: string
  icon:  React.ReactNode
  color: string
  bg:    string
}> = {
  video:  { label: '영상',   icon: <Film         size={14}/>, color: 'text-orange-400', bg: 'bg-orange-500/15'  },
  image:  { label: '이미지', icon: <ImageIcon    size={14}/>, color: 'text-violet-400', bg: 'bg-violet-500/15'  },
  music:  { label: '음악',   icon: <Music        size={14}/>, color: 'text-cyan-400',   bg: 'bg-cyan-500/15'    },
  code:   { label: '코드',   icon: <Code2        size={14}/>, color: 'text-emerald-400',bg: 'bg-emerald-500/15' },
  design: { label: '디자인', icon: <Palette      size={14}/>, color: 'text-pink-400',   bg: 'bg-pink-500/15'    },
  plan:   { label: '기획',   icon: <ClipboardList size={14}/>,color: 'text-amber-400',  bg: 'bg-amber-500/15'   },
}

const VIDEO_RATIOS: Array<{ id: VideoAspectRatio; label: string }> = [
  { id: '16:9', label: '16:9' },
  { id: '9:16', label: '9:16' },
]
const IMAGE_RATIOS: Array<{ id: AspectRatio; label: string }> = [
  { id: '1:1', label: '1:1' }, { id: '16:9', label: '16:9' },
  { id: '9:16', label: '9:16' }, { id: '4:3', label: '4:3' }, { id: '3:4', label: '3:4' },
]
const IMAGE_STYLES: Array<{ id: ImageStyle; label: string }> = [
  { id: 'arha', label: 'ARHA' }, { id: 'photo', label: 'Realistic' },
  { id: 'anime', label: 'Anime' }, { id: 'watercolor', label: 'Watercolor' },
  { id: 'oil', label: 'Oil Paint' }, { id: 'sketch', label: 'Sketch' },
]

const PIPELINE_STEPS: Array<{ key: PipelineStage; label: string; llm: boolean }> = [
  { key: 'layer0',  label: 'L0 정규화',   llm: false },
  { key: 'layer1',  label: 'L1 의미분해', llm: true  },
  { key: 'layer2',  label: 'L2 벡터필드', llm: false },
  { key: 'layer3',  label: 'L3 수식조립', llm: true  },
  { key: 'layer4',  label: 'L4 컴파일',   llm: false },
  { key: 'routing', label: 'API 라우팅',   llm: false },
]
const STAGE_ORDER: PipelineStage[] = ['idle','layer0','layer1','layer2','layer3','layer4','routing','done','error']

// ── 컴포넌트 ───────────────────────────────────────────────

const ContentStudio: React.FC<Props> = ({
  onClose, initialModality = 'image', initialPrompt = '',
  currentAnalysis, kappa = 0.5, tier = 'free',
}) => {

  // 공통
  const [modality,      setModality]      = useState<ContentModality>(initialModality)
  const [prompt,        setPrompt]        = useState(initialPrompt)
  const [isGenerating,  setIsGenerating]  = useState(false)
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>('idle')
  const [pipelineSnap,  setPipelineSnap]  = useState<PipelineSnapshot | null>(null)
  const [error,         setError]         = useState<string | null>(null)

  // 결과
  const [videoUrl,     setVideoUrl]     = useState<string | null>(null)
  const [imageUrl,     setImageUrl]     = useState<string | null>(null)
  const [imageHistory, setImageHistory] = useState<string[]>([])
  const [audioUrl,     setAudioUrl]     = useState<string | null>(null)
  const [textResult,   setTextResult]   = useState<string | null>(null)

  // 비디오 옵션
  const [videoMode,    setVideoMode]    = useState<VideoMode>('single')
  const [videoRatio,   setVideoRatio]   = useState<VideoAspectRatio>('16:9')
  const [videoElapsed, setVideoElapsed] = useState(0)
  const videoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 이미지 옵션
  const [imageRatio, setImageRatio] = useState<AspectRatio>('1:1')
  const [imageStyle, setImageStyle] = useState<ImageStyle>('arha')

  const audioRef = useRef<HTMLAudioElement | null>(null)

  // 비디오 생성 중 경과 타이머
  useEffect(() => {
    if (isGenerating && modality === 'video') {
      setVideoElapsed(0)
      videoTimerRef.current = setInterval(() => setVideoElapsed(t => t + 1), 1000)
    } else {
      if (videoTimerRef.current) clearInterval(videoTimerRef.current)
    }
    return () => { if (videoTimerRef.current) clearInterval(videoTimerRef.current) }
  }, [isGenerating, modality])

  const switchModality = (m: ContentModality) => {
    if (isGenerating) return
    setModality(m)
    setError(null)
    setPipelineStage('idle')
  }

  // ── 메인 생성 핸들러 ──────────────────────────────────
  const handleGenerate = useCallback(async () => {
    const text = prompt.trim()
    if (!text || isGenerating) return

    setIsGenerating(true)
    setError(null)
    setPipelineSnap(null)

    try {
      setPipelineStage('layer0')
      const config = buildMiddlewareConfig(currentAnalysis, kappa, [modality])

      setPipelineStage('layer1')

      // 파이프라인 + 단계 시뮬레이션 병렬 실행
      const [pipelineResult] = await Promise.all([
        executePipeline(text, config),
        (async () => {
          await new Promise(r => setTimeout(r, 500))
          setPipelineStage('layer2')
          await new Promise(r => setTimeout(r, 350))
          setPipelineStage('layer3')
          await new Promise(r => setTimeout(r, 700))
          setPipelineStage('layer4')
        })(),
      ])

      const pr = pipelineResult as MiddlewarePipelineResult
      setPipelineSnap({ equation: pr.equation, narrative: pr.narrative, temperature: pr.temperature })

      setPipelineStage('routing')
      const p = pr.modality_prompts

      switch (modality) {
        case 'video': {
          const url = await generateVideo({ rawPrompt: p.video, aspectRatio: videoRatio })
          setVideoUrl(url)
          break
        }
        case 'image': {
          const url = await generateImage({ rawPrompt: p.image, aspectRatio: imageRatio, opts: { style: imageStyle, refinements: [] }, tier: tier as UserTier })
          setImageUrl(url)
          setImageHistory(h => [url, ...h].slice(0, 8))
          break
        }
        case 'music': {
          try {
            const res = await generateMusic({ musicPrompt: p.music })
            setAudioUrl(res.audioUrl)
          } catch {
            setTextResult(p.music)
          }
          break
        }
        case 'code':   setTextResult(p.code);   break
        case 'design': setTextResult(p.design); break
        case 'plan':   setTextResult(p.plan);   break
      }

      setPipelineStage('done')

    } catch (e: unknown) {
      const ge = e as { _tag?: string; message?: string }
      setError(ge?._tag ? describeError(ge as Parameters<typeof describeError>[0]) : (ge?.message ?? '생성 중 오류가 발생했어요.'))
      setPipelineStage('error')
    } finally {
      setIsGenerating(false)
    }
  }, [prompt, isGenerating, modality, currentAnalysis, kappa, videoRatio, imageRatio, imageStyle, tier])

  const handleReset = () => {
    setVideoUrl(null); setImageUrl(null); setAudioUrl(null); setTextResult(null)
    setError(null); setPipelineStage('idle'); setPipelineSnap(null); setPrompt('')
  }

  const handleDownload = (url: string, ext: string) => {
    const a = document.createElement('a')
    a.href = url; a.download = `arha-${modality}-${Date.now()}.${ext}`; a.click()
  }

  // 파이프라인 스텝 상태
  const curIdx = STAGE_ORDER.indexOf(pipelineStage)
  const stepState = (key: PipelineStage): 'idle' | 'active' | 'done' | 'error' => {
    if (pipelineStage === 'error') return 'error'
    if (pipelineStage === 'done')  return 'done'
    if (key === pipelineStage)     return 'active'
    if (STAGE_ORDER.indexOf(key) < curIdx) return 'done'
    return 'idle'
  }

  const meta = MODALITY_META[modality]
  const fmtTime = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`
  const hasResult = !!(videoUrl || imageUrl || audioUrl || textResult)

  // ── JSX ───────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-panel w-full sm:max-w-6xl sm:mx-4 h-[94dvh] sm:h-[92vh] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col shadow-2xl">

        {/* ── 헤더 ── */}
        <header className="flex items-center gap-2 px-4 sm:px-5 py-3 border-b border-black/10 dark:border-white/10 shrink-0">

          <div className={`w-8 h-8 rounded-xl ${meta.bg} flex items-center justify-center shrink-0`}>
            <span className={meta.color}>{meta.icon}</span>
          </div>
          <div className="shrink-0">
            <h2 className="text-[12px] font-black uppercase tracking-widest text-slate-700 dark:text-white/90 leading-none">ARHA Studio</h2>
            <p className="text-[8px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-widest mt-0.5">미들웨어 × {meta.label}</p>
          </div>

          {/* 모달리티 탭 */}
          <div className="flex items-center gap-0.5 bg-black/5 dark:bg-white/5 rounded-xl p-1 ml-2 overflow-x-auto scrollbar-none flex-1">
            {(Object.keys(MODALITY_META) as ContentModality[]).map(m => {
              const mm = MODALITY_META[m]
              const active = m === modality
              return (
                <button key={m} onClick={() => switchModality(m)} disabled={isGenerating}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black whitespace-nowrap transition-all disabled:opacity-40 ${
                    active ? `${mm.bg} ${mm.color}` : 'text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60'
                  }`}
                >
                  <span className={active ? mm.color : undefined}>{mm.icon}</span>
                  <span className="hidden sm:inline">{mm.label}</span>
                </button>
              )
            })}
          </div>

          {/* Video Single/Series */}
          {modality === 'video' && (
            <div className="flex gap-0.5 bg-black/5 dark:bg-white/5 rounded-xl p-1">
              {(['single','series'] as VideoMode[]).map(mode => (
                <button key={mode} onClick={() => setVideoMode(mode)} disabled={isGenerating}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-black transition-all disabled:opacity-40 ${
                    videoMode === mode
                      ? mode === 'series' ? 'bg-gradient-to-r from-purple-500 to-orange-500 text-white' : 'bg-orange-500 text-white'
                      : 'text-slate-400 dark:text-white/30'
                  }`}
                >
                  {mode === 'series' ? 'Series' : 'Single'}
                </button>
              ))}
            </div>
          )}

          <button onClick={onClose} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-all text-slate-500 dark:text-white/50">
            <X size={16}/>
          </button>
        </header>

        {/* ── 시리즈 모드 ── */}
        {modality === 'video' && videoMode === 'series' ? (
          <SeriesVideoStudio
            initialPrompt={prompt}
            aspectRatio={videoRatio}
            expressionMode={currentAnalysis?.expression_mode}
            trajectory={currentAnalysis?.trajectory}
          />
        ) : (

        /* ── 메인 바디 ── */
        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* 왼쪽: 컨트롤 + 파이프라인 */}
          <aside className="w-60 lg:w-68 shrink-0 flex flex-col border-r border-black/10 dark:border-white/10 overflow-y-auto scroll-hide">
            <div className="p-4 flex flex-col gap-3">

              {/* 프롬프트 */}
              <div>
                <label className={`text-[8px] font-black uppercase tracking-widest ${meta.color} mb-1.5 block`}>콘텐츠 요청</label>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key==='Enter'&&(e.ctrlKey||e.metaKey)) handleGenerate() }}
                  disabled={isGenerating}
                  rows={4}
                  placeholder={`${meta.label} 내용을 묘사해 주세요...\n예: "새벽 빗소리, 혼자 걷는 기분"`}
                  className="w-full resize-none rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 px-3 py-2.5 text-[11px] text-slate-700 dark:text-white/80 placeholder:text-slate-400 dark:placeholder:text-white/20 focus:outline-none focus:border-purple-400/40 transition-all disabled:opacity-40"
                />
              </div>

              {/* 비디오 옵션 */}
              {modality === 'video' && (
                <div>
                  <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30 mb-1.5 block">화면 비율</label>
                  <div className="flex gap-1.5">
                    {VIDEO_RATIOS.map(r => (
                      <button key={r.id} onClick={() => setVideoRatio(r.id)} disabled={isGenerating}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-black border transition-all disabled:opacity-40 ${
                          videoRatio===r.id ? 'bg-orange-500/15 text-orange-400 border-orange-400/30' : 'border-black/10 dark:border-white/10 text-slate-400 dark:text-white/30'
                        }`}
                      >{r.label}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* 이미지 옵션 */}
              {modality === 'image' && (
                <>
                  <div>
                    <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30 mb-1.5 block">화면 비율</label>
                    <div className="flex flex-wrap gap-1">
                      {IMAGE_RATIOS.map(r => (
                        <button key={r.id} onClick={() => setImageRatio(r.id)} disabled={isGenerating}
                          className={`px-2 py-1 rounded-lg text-[9px] font-black border transition-all disabled:opacity-40 ${
                            imageRatio===r.id ? 'bg-violet-500/15 text-violet-400 border-violet-400/30' : 'border-black/10 dark:border-white/10 text-slate-400 dark:text-white/30'
                          }`}
                        >{r.label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30 mb-1.5 block">스타일</label>
                    <div className="flex flex-wrap gap-1">
                      {IMAGE_STYLES.map(s => (
                        <button key={s.id} onClick={() => setImageStyle(s.id)} disabled={isGenerating}
                          className={`px-2 py-1 rounded-lg text-[9px] font-black border transition-all disabled:opacity-40 ${
                            imageStyle===s.id ? 'bg-violet-500/15 text-violet-400 border-violet-400/30' : 'border-black/10 dark:border-white/10 text-slate-400 dark:text-white/30'
                          }`}
                        >{s.label}</button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* 생성 버튼 */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-[11px] font-black transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${meta.bg} ${meta.color} hover:brightness-110`}
              >
                {isGenerating ? (
                  <><div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin"/>
                  {modality==='video' ? `생성 중 ${fmtTime(videoElapsed)}` : '생성 중...'}</>
                ) : (
                  <><Zap size={12}/> 미들웨어로 생성 <span className="text-[8px] opacity-50">⌘↵</span></>
                )}
              </button>
            </div>

            {/* 파이프라인 상태 */}
            <div className="px-4 pb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Layers size={9} className="text-slate-400 dark:text-white/25"/>
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-white/25">파이프라인</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {PIPELINE_STEPS.map(step => {
                  const s = stepState(step.key)
                  return (
                    <div key={step.key} className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all ${
                        s==='done' ? 'bg-emerald-400' : s==='active' ? `${meta.color.replace('text-','bg-')} animate-pulse` : s==='error' ? 'bg-red-400/50' : 'bg-black/10 dark:bg-white/10'
                      }`}/>
                      <span className={`text-[9px] font-bold ${s==='done' ? 'text-emerald-400' : s==='active' ? meta.color : 'text-slate-400 dark:text-white/20'}`}>
                        {step.label}
                      </span>
                      {step.llm && <span className="text-[7px] font-black text-slate-300 dark:text-white/15 uppercase">AI</span>}
                    </div>
                  )
                })}
              </div>

              {pipelineSnap && (
                <div className="mt-3 p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/8 dark:border-white/8">
                  <div className="text-[8px] font-black text-slate-400 dark:text-white/25 uppercase tracking-widest mb-1">생성 수식</div>
                  <div className="font-mono text-[10px] text-purple-400 dark:text-purple-300 break-all leading-relaxed">{pipelineSnap.equation}</div>
                  {pipelineSnap.narrative && (
                    <p className="mt-1 text-[9px] text-slate-400 dark:text-white/30 leading-relaxed">{pipelineSnap.narrative}</p>
                  )}
                  <div className="mt-1 text-[8px] font-mono text-slate-300 dark:text-white/20">T={pipelineSnap.temperature.toFixed(2)}</div>
                </div>
              )}
            </div>

            {/* 이미지 히스토리 */}
            {modality==='image' && imageHistory.length>0 && (
              <div className="px-4 pb-4">
                <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-white/25 mb-2">최근 생성</div>
                <div className="grid grid-cols-4 gap-1">
                  {imageHistory.map((url,i) => (
                    <button key={i} onClick={() => setImageUrl(url)}
                      className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${imageUrl===url ? 'border-violet-400 scale-105' : 'border-transparent hover:border-white/30'}`}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover"/>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* 오른쪽: 캔버스 */}
          <main className="flex-1 flex flex-col items-center justify-center p-6 min-h-0 overflow-y-auto">

            {/* 에러 */}
            {pipelineStage==='error' && error && (
              <div className="w-full max-w-md p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
                <p className="text-[11px] text-red-400 leading-relaxed">{error}</p>
                <button onClick={handleReset} className="mt-3 flex items-center gap-1.5 mx-auto text-[10px] font-black text-red-400 hover:text-red-300 transition-all">
                  <RotateCcw size={11}/> 다시 시도
                </button>
              </div>
            )}

            {/* 대기 */}
            {pipelineStage==='idle' && !hasResult && (
              <div className="flex flex-col items-center gap-4 text-center opacity-40">
                <div className={`w-16 h-16 rounded-2xl ${meta.bg} flex items-center justify-center`}>
                  <span className={`${meta.color} scale-[1.8]`}>{meta.icon}</span>
                </div>
                <div>
                  <p className="text-[13px] font-black text-slate-600 dark:text-white/60">{meta.label} 생성 준비</p>
                  <p className="text-[10px] text-slate-400 dark:text-white/30 mt-1">왼쪽에서 내용을 입력하고 생성하기를 눌러주세요</p>
                </div>
              </div>
            )}

            {/* 생성 중 */}
            {isGenerating && (
              <div className="flex flex-col items-center gap-5">
                <div className="relative w-20 h-20">
                  <div className={`absolute inset-0 rounded-full border-2 border-current ${meta.color} opacity-20 animate-ping`}/>
                  <div className={`absolute inset-2 rounded-full border-2 border-current ${meta.color} border-t-transparent animate-spin`}/>
                  <div className={`absolute inset-5 rounded-full ${meta.bg} flex items-center justify-center`}>
                    <span className={meta.color}>{meta.icon}</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-black text-slate-600 dark:text-white/70">{meta.label} 생성 중</p>
                  <p className={`text-[10px] ${meta.color} mt-1 font-mono`}>
                    {PIPELINE_STEPS.find(s => s.key===pipelineStage)?.label ?? '처리 중...'}
                  </p>
                  {modality==='video' && (
                    <p className="text-[10px] text-slate-400 dark:text-white/30 mt-0.5 font-mono">{fmtTime(videoElapsed)}</p>
                  )}
                </div>
              </div>
            )}

            {/* 결과 */}
            {!isGenerating && hasResult && pipelineStage!=='error' && (
              <div className="w-full flex flex-col items-center gap-4">

                {modality==='video' && videoUrl && (
                  <div className="w-full max-w-2xl rounded-2xl overflow-hidden bg-black shadow-2xl">
                    <video src={videoUrl} controls autoPlay loop className="w-full"/>
                  </div>
                )}

                {modality==='image' && imageUrl && (
                  <div className="max-w-lg w-full rounded-2xl overflow-hidden shadow-xl">
                    <img src={imageUrl} alt="Generated" className="w-full object-contain"/>
                  </div>
                )}

                {modality==='music' && (
                  <div className="w-full max-w-md p-5 rounded-2xl bg-cyan-500/8 border border-cyan-500/20">
                    <div className="flex items-center gap-2 mb-4">
                      <Music size={14} className="text-cyan-400"/>
                      <span className="text-[11px] font-black text-cyan-400">음악 생성 완료</span>
                    </div>
                    {audioUrl
                      ? <audio ref={audioRef} src={audioUrl} controls className="w-full"/>
                      : textResult && (
                          <div className="p-3 rounded-xl bg-black/10 dark:bg-white/5">
                            <p className="text-[9px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest mb-1.5">음악 프롬프트</p>
                            <p className="text-[11px] text-slate-600 dark:text-white/60 font-mono leading-relaxed">{textResult}</p>
                          </div>
                        )
                    }
                  </div>
                )}

                {['code','design','plan'].includes(modality) && textResult && (
                  <div className="w-full max-w-2xl">
                    <div className={`flex items-center gap-2 mb-2 ${meta.color}`}>
                      {meta.icon}
                      <span className="text-[11px] font-black">{meta.label} 프롬프트 컴파일 완료</span>
                    </div>
                    <pre className={`p-4 rounded-2xl ${meta.bg} border border-black/8 dark:border-white/8 text-[11px] text-slate-700 dark:text-white/70 font-mono leading-relaxed whitespace-pre-wrap break-words overflow-auto max-h-96`}>
                      {textResult}
                    </pre>
                  </div>
                )}

                {/* 액션 */}
                <div className="flex items-center gap-2 mt-2">
                  {(videoUrl||imageUrl||audioUrl) && (
                    <button
                      onClick={() => {
                        const url = videoUrl ?? imageUrl ?? audioUrl ?? ''
                        const ext = videoUrl ? 'mp4' : imageUrl ? 'png' : 'mp3'
                        handleDownload(url, ext)
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 text-[10px] font-black text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/60 transition-all"
                    >
                      <Download size={11}/> 다운로드
                    </button>
                  )}
                  <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 text-[10px] font-black text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/60 transition-all">
                    <RotateCcw size={11}/> 새로 만들기
                  </button>
                  {pipelineStage==='done' && (
                    <div className="flex items-center gap-1 ml-1">
                      <ChevronRight size={9} className="text-emerald-400"/>
                      <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">완료</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
        )}

        {/* 푸터 */}
        <footer className="flex items-center justify-between px-4 sm:px-6 py-2 border-t border-black/8 dark:border-white/8 shrink-0">
          <div className="flex items-center gap-2">
            <Play size={7} className="text-slate-300 dark:text-white/20"/>
            <span className="text-[8px] font-bold text-slate-300 dark:text-white/20 uppercase tracking-wider">
              Layer 0→4 · Claude Sonnet · {modality==='video'?'VEO 3.1':modality==='image'?'Gemini':modality==='music'?'Lyria 3':'Claude'}
            </span>
          </div>
          <span className={`text-[8px] font-black uppercase tracking-widest ${
            pipelineStage==='done'?'text-emerald-400':pipelineStage==='error'?'text-red-400':isGenerating?meta.color:'text-slate-300 dark:text-white/20'
          }`}>
            {pipelineStage==='idle'?'READY':pipelineStage==='done'?'DONE':pipelineStage==='error'?'ERROR':`${pipelineStage.toUpperCase()} →`}
          </span>
        </footer>
      </div>
    </div>
  )
}

export default ContentStudio
