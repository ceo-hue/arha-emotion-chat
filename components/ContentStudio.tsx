
// ═══════════════════════════════════════════════════════════
//  ContentStudio — 통합 콘텐츠 생성 스튜디오 v2
//  Image · Video · Music · Code · Design · Plan 한 공간
//
//  설계 원칙
//  ① 결과물: 탭별 완전 독립 (Record<ContentModality, ModalityResult>)
//  ② 파이프라인 수식: 전역 공유 → 다른 탭에서 재사용(멀티모달 연계)
//  ③ 이미지 완료 시 음악 탭에서 "이미지→음악" 연계 옵션 자동 제공
// ═══════════════════════════════════════════════════════════

import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  X, Film, ImageIcon, Music, Code2, Palette, ClipboardList,
  Download, RotateCcw, Zap, Layers, ChevronRight, Play, Link2,
} from 'lucide-react'
import { generateVideo }                               from '../services/videoService'
import { generateImage }                               from '../services/imageService'
import { generateMusic, generateMusicFromImage }       from '../services/musicService'
import { buildMiddlewareConfig, type AnalysisData }    from '../services/analysisToMiddleware'
import { executePipeline }                             from '../services/middleware/pipeline'
import type { ContentModality, MiddlewarePipelineResult, ModalityPrompts } from '../services/middleware/types'
import SeriesVideoStudio                               from './SeriesVideoStudio'
import type { VideoAspectRatio, AspectRatio, UserTier } from '../lib/modelStrategy'
import { describeError }                               from '../lib/generationError'

// ── 타입 ──────────────────────────────────────────────────

interface Props {
  onClose:          () => void
  initialModality?: ContentModality
  initialPrompt?:   string
  currentAnalysis?: AnalysisData | null
  kappa?:           number
  tier?:            UserTier
}

type PipelineStage = 'idle' | 'layer0' | 'layer1' | 'layer2' | 'layer3' | 'layer4' | 'routing' | 'done' | 'error'
type VideoMode     = 'single' | 'series'
type ImageStyle    = 'arha' | 'photo' | 'anime' | 'watercolor' | 'oil' | 'sketch'

// 탭별 독립 결과
interface ModalityResult {
  url?:   string
  text?:  string
  error?: string
  stage:  PipelineStage
}

// 전역 공유 파이프라인 (수식 · 프롬프트 세트)
interface SharedPipeline {
  pipelineResult: MiddlewarePipelineResult
  prompts:        ModalityPrompts
  sourceModality: ContentModality
  equation:       string
  narrative:      string
  temperature:    number
}

// ── 상수 ──────────────────────────────────────────────────

const MODALITY_META: Record<ContentModality, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  video:  { label: '영상',   icon: <Film         size={14}/>, color: 'text-orange-400', bg: 'bg-orange-500/15'  },
  image:  { label: '이미지', icon: <ImageIcon    size={14}/>, color: 'text-violet-400', bg: 'bg-violet-500/15'  },
  music:  { label: '음악',   icon: <Music        size={14}/>, color: 'text-cyan-400',   bg: 'bg-cyan-500/15'    },
  code:   { label: '코드',   icon: <Code2        size={14}/>, color: 'text-emerald-400',bg: 'bg-emerald-500/15' },
  design: { label: '디자인', icon: <Palette      size={14}/>, color: 'text-pink-400',   bg: 'bg-pink-500/15'    },
  plan:   { label: '기획',   icon: <ClipboardList size={14}/>,color: 'text-amber-400',  bg: 'bg-amber-500/15'   },
}

const VIDEO_RATIOS: Array<{ id: VideoAspectRatio; label: string }> = [
  { id: '16:9', label: '16:9' }, { id: '9:16', label: '9:16' },
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

const EMPTY_RESULT: ModalityResult = { stage: 'idle' }

// ── 컴포넌트 ───────────────────────────────────────────────

const ContentStudio: React.FC<Props> = ({
  onClose, initialModality = 'image', initialPrompt = '',
  currentAnalysis, kappa = 0.5, tier = 'free',
}) => {

  const [modality,    setModality]    = useState<ContentModality>(initialModality)
  const [prompt,      setPrompt]      = useState(initialPrompt)
  const [videoMode,   setVideoMode]   = useState<VideoMode>('single')
  const [videoRatio,  setVideoRatio]  = useState<VideoAspectRatio>('16:9')
  const [imageRatio,  setImageRatio]  = useState<AspectRatio>('1:1')
  const [imageStyle,  setImageStyle]  = useState<ImageStyle>('arha')
  const [videoElapsed,setVideoElapsed]= useState(0)
  const videoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── 핵심 상태 ─────────────────────────────────────────
  // 탭별 완전 독립 결과
  const [results, setResults] = useState<Partial<Record<ContentModality, ModalityResult>>>({})
  // 이미지 히스토리 (image 탭 전용)
  const [imageHistory, setImageHistory] = useState<string[]>([])
  // 전역 공유 파이프라인 수식 (멀티모달 연계의 핵심)
  const [sharedPipeline, setSharedPipeline] = useState<SharedPipeline | null>(null)
  // 현재 탭이 생성 중인지
  const [generatingTab, setGeneratingTab] = useState<ContentModality | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  const curResult = results[modality] ?? EMPTY_RESULT
  const isGenerating = generatingTab === modality

  // 비디오 타이머
  useEffect(() => {
    if (generatingTab === 'video' && modality === 'video') {
      setVideoElapsed(0)
      videoTimerRef.current = setInterval(() => setVideoElapsed(t => t + 1), 1000)
    } else {
      if (videoTimerRef.current) clearInterval(videoTimerRef.current)
    }
    return () => { if (videoTimerRef.current) clearInterval(videoTimerRef.current) }
  }, [generatingTab, modality])

  // 탭별 결과 업데이트 헬퍼
  const setTabResult = useCallback((m: ContentModality, patch: Partial<ModalityResult>) => {
    setResults(prev => ({ ...prev, [m]: { ...(prev[m] ?? EMPTY_RESULT), ...patch } }))
  }, [])

  // ── 파이프라인 실행 (수식 생성) ───────────────────────
  const runPipeline = useCallback(async (targetModality: ContentModality, text: string): Promise<SharedPipeline | null> => {
    const config = buildMiddlewareConfig(currentAnalysis, kappa, [targetModality])

    setTabResult(targetModality, { stage: 'layer1' })

    const [pipelineResult] = await Promise.all([
      executePipeline(text, config),
      (async () => {
        await new Promise(r => setTimeout(r, 500)); setTabResult(targetModality, { stage: 'layer2' })
        await new Promise(r => setTimeout(r, 350)); setTabResult(targetModality, { stage: 'layer3' })
        await new Promise(r => setTimeout(r, 700)); setTabResult(targetModality, { stage: 'layer4' })
      })(),
    ])

    const pr = pipelineResult as MiddlewarePipelineResult
    const shared: SharedPipeline = {
      pipelineResult: pr,
      prompts:        pr.modality_prompts,
      sourceModality: targetModality,
      equation:       pr.equation,
      narrative:      pr.narrative,
      temperature:    pr.temperature,
    }
    setSharedPipeline(shared)
    return shared
  }, [currentAnalysis, kappa, setTabResult])

  // ── 콘텐츠 API 라우팅 ──────────────────────────────────
  const routeContent = useCallback(async (
    targetModality: ContentModality,
    prompts: ModalityPrompts,
    opts: { imageBase64?: string } = {}
  ) => {
    setTabResult(targetModality, { stage: 'routing' })

    switch (targetModality) {
      case 'video': {
        const url = await generateVideo({ rawPrompt: prompts.video, aspectRatio: videoRatio })
        setTabResult(targetModality, { url, stage: 'done' })
        break
      }
      case 'image': {
        const url = await generateImage({
          rawPrompt: prompts.image, aspectRatio: imageRatio,
          opts: { style: imageStyle, refinements: [] }, tier: tier as UserTier,
        })
        setTabResult(targetModality, { url, stage: 'done' })
        setImageHistory(h => [url, ...h].slice(0, 8))
        break
      }
      case 'music': {
        try {
          // 이미지 기반 음악 생성 (멀티모달 연계)
          const res = opts.imageBase64
            ? await generateMusicFromImage(opts.imageBase64, prompts.music)
            : await generateMusic({ musicPrompt: prompts.music })
          setTabResult(targetModality, { url: res.audioUrl, stage: 'done' })
        } catch {
          setTabResult(targetModality, { text: prompts.music, stage: 'done' })
        }
        break
      }
      case 'code':   setTabResult(targetModality, { text: prompts.code,   stage: 'done' }); break
      case 'design': setTabResult(targetModality, { text: prompts.design, stage: 'done' }); break
      case 'plan':   setTabResult(targetModality, { text: prompts.plan,   stage: 'done' }); break
    }
  }, [videoRatio, imageRatio, imageStyle, tier, setTabResult])

  // ── 메인 생성 핸들러 ──────────────────────────────────
  const handleGenerate = useCallback(async (opts: { useShared?: boolean; imageBase64?: string } = {}) => {
    const text = prompt.trim()
    if ((!text && !opts.useShared) || generatingTab !== null) return

    setGeneratingTab(modality)
    setTabResult(modality, { stage: 'layer0', error: undefined })

    try {
      // 수식 재사용 vs 새로 생성
      let pipeline = opts.useShared ? sharedPipeline : null
      if (!pipeline) {
        if (!text) return
        pipeline = await runPipeline(modality, text)
        if (!pipeline) throw new Error('파이프라인 실행 실패')
      }

      await routeContent(modality, pipeline.prompts, opts)

    } catch (e: unknown) {
      const ge = e as { _tag?: string; message?: string }
      const msg = ge?._tag ? describeError(ge as Parameters<typeof describeError>[0]) : (ge?.message ?? '생성 중 오류가 발생했어요.')
      setTabResult(modality, { error: msg, stage: 'error' })
    } finally {
      setGeneratingTab(null)
    }
  }, [prompt, generatingTab, modality, sharedPipeline, runPipeline, routeContent, setTabResult])

  // 수식 기반 빠른 생성 (파이프라인 skip)
  const handleGenerateFromShared = useCallback(async (imageBase64?: string) => {
    if (!sharedPipeline || generatingTab !== null) return
    setGeneratingTab(modality)
    setTabResult(modality, { stage: 'routing', error: undefined })
    try {
      await routeContent(modality, sharedPipeline.prompts, { imageBase64 })
    } catch (e: unknown) {
      const ge = e as { _tag?: string; message?: string }
      setTabResult(modality, { error: ge?.message ?? '생성 오류', stage: 'error' })
    } finally {
      setGeneratingTab(null)
    }
  }, [sharedPipeline, generatingTab, modality, routeContent, setTabResult])

  const handleReset = () => {
    setResults(prev => { const n = { ...prev }; delete n[modality]; return n })
  }

  const handleDownload = (url: string, ext: string) => {
    const a = document.createElement('a')
    a.href = url; a.download = `arha-${modality}-${Date.now()}.${ext}`; a.click()
  }

  // 이미지→음악 연계를 위한 base64 변환
  const getImageBase64 = useCallback(async (url: string): Promise<string | undefined> => {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      return await new Promise(resolve => {
        const reader = new FileReader()
        reader.onloadend = () => resolve((reader.result as string).split(',')[1])
        reader.readAsDataURL(blob)
      })
    } catch { return undefined }
  }, [])

  // 파이프라인 스텝 상태
  const curStage = curResult.stage
  const curIdx   = STAGE_ORDER.indexOf(curStage)
  const stepState = (key: PipelineStage): 'idle' | 'active' | 'done' | 'error' => {
    if (curStage === 'error') return 'error'
    if (curStage === 'done')  return 'done'
    if (key === curStage)     return 'active'
    if (STAGE_ORDER.indexOf(key) < curIdx) return 'done'
    return 'idle'
  }

  const meta       = MODALITY_META[modality]
  const fmtTime    = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`
  const hasResult  = !!(curResult.url || curResult.text)
  const hasShared  = !!sharedPipeline

  // 이미지 결과 (다른 탭에서 연계용)
  const imageResult = results['image']
  const hasImage    = !!imageResult?.url

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
              const active  = m === modality
              const hasDone = results[m]?.stage === 'done'
              return (
                <button key={m} onClick={() => setModality(m)} disabled={generatingTab !== null}
                  className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black whitespace-nowrap transition-all disabled:opacity-40 ${
                    active ? `${mm.bg} ${mm.color}` : 'text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60'
                  }`}
                >
                  <span className={active ? mm.color : undefined}>{mm.icon}</span>
                  <span className="hidden sm:inline">{mm.label}</span>
                  {/* 완료 뱃지 */}
                  {hasDone && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-white/30"/>
                  )}
                </button>
              )
            })}
          </div>

          {/* Video Single/Series */}
          {modality === 'video' && (
            <div className="flex gap-0.5 bg-black/5 dark:bg-white/5 rounded-xl p-1">
              {(['single','series'] as VideoMode[]).map(mode => (
                <button key={mode} onClick={() => setVideoMode(mode)} disabled={generatingTab !== null}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[9px] font-black transition-all disabled:opacity-40 ${
                    videoMode === mode ? (mode==='series'?'bg-gradient-to-r from-purple-500 to-orange-500 text-white':'bg-orange-500 text-white') : 'text-slate-400 dark:text-white/30'
                  }`}
                >{mode==='series'?'Series':'Single'}</button>
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

          {/* ── 왼쪽 컨트롤 + 파이프라인 ── */}
          <aside className="w-60 lg:w-64 shrink-0 flex flex-col border-r border-black/10 dark:border-white/10 overflow-y-auto scroll-hide">
            <div className="p-4 flex flex-col gap-3">

              {/* ── 멀티모달 연계 배너 ── */}
              {hasShared && sharedPipeline!.sourceModality !== modality && (
                <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-400/20">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Link2 size={9} className="text-purple-400"/>
                    <span className="text-[8px] font-black text-purple-400 uppercase tracking-widest">수식 연계 가능</span>
                  </div>
                  <p className="font-mono text-[9px] text-purple-300 truncate mb-2">
                    {sharedPipeline!.equation}
                  </p>
                  <button
                    onClick={async () => {
                      // 음악 탭 + 이미지 있으면 이미지→음악 연계
                      if (modality === 'music' && hasImage) {
                        const b64 = await getImageBase64(imageResult!.url!)
                        handleGenerateFromShared(b64)
                      } else {
                        handleGenerateFromShared()
                      }
                    }}
                    disabled={generatingTab !== null}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-purple-500/15 text-purple-400 text-[10px] font-black hover:bg-purple-500/25 transition-all disabled:opacity-40"
                  >
                    <Zap size={10}/>
                    {modality === 'music' && hasImage ? '이미지→음악으로 생성' : '이 수식으로 바로 생성'}
                  </button>
                </div>
              )}

              {/* 프롬프트 */}
              <div>
                <label className={`text-[8px] font-black uppercase tracking-widest ${meta.color} mb-1.5 block`}>콘텐츠 요청</label>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key==='Enter'&&(e.ctrlKey||e.metaKey)) handleGenerate() }}
                  disabled={generatingTab !== null}
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
                      <button key={r.id} onClick={() => setVideoRatio(r.id)} disabled={generatingTab !== null}
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
                        <button key={r.id} onClick={() => setImageRatio(r.id)} disabled={generatingTab !== null}
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
                        <button key={s.id} onClick={() => setImageStyle(s.id)} disabled={generatingTab !== null}
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
                onClick={() => handleGenerate()}
                disabled={generatingTab !== null || !prompt.trim()}
                className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-[11px] font-black transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${meta.bg} ${meta.color} hover:brightness-110`}
              >
                {isGenerating ? (
                  <><div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin"/>
                  {modality==='video' ? `생성 중 ${fmtTime(videoElapsed)}` : '생성 중...'}</>
                ) : (
                  <><Zap size={12}/> 새 수식으로 생성 <span className="text-[8px] opacity-50">⌘↵</span></>
                )}
              </button>
            </div>

            {/* 파이프라인 상태 */}
            <div className="px-4 pb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Layers size={9} className="text-slate-400 dark:text-white/25"/>
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-white/25">파이프라인</span>
                {/* 다른 탭 생성 중 표시 */}
                {generatingTab && generatingTab !== modality && (
                  <span className={`ml-auto text-[8px] font-black ${MODALITY_META[generatingTab].color} animate-pulse`}>
                    {MODALITY_META[generatingTab].label} 생성 중
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                {PIPELINE_STEPS.map(step => {
                  const s = isGenerating ? stepState(step.key) : (hasShared ? 'done' : 'idle')
                  return (
                    <div key={step.key} className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all ${
                        s==='done'?'bg-emerald-400':s==='active'?`${meta.color.replace('text-','bg-')} animate-pulse`:s==='error'?'bg-red-400/50':'bg-black/10 dark:bg-white/10'
                      }`}/>
                      <span className={`text-[9px] font-bold ${s==='done'?'text-emerald-400':s==='active'?meta.color:'text-slate-400 dark:text-white/20'}`}>
                        {step.label}
                      </span>
                      {step.llm && <span className="text-[7px] font-black text-slate-300 dark:text-white/15 uppercase">AI</span>}
                    </div>
                  )
                })}
              </div>

              {/* 공유 수식 박스 */}
              {hasShared && (
                <div className="mt-3 p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/8 dark:border-white/8">
                  <div className="flex items-center gap-1 mb-1">
                    <div className="text-[8px] font-black text-slate-400 dark:text-white/25 uppercase tracking-widest">공유 수식</div>
                    <span className={`ml-auto text-[7px] font-black ${MODALITY_META[sharedPipeline!.sourceModality].color} uppercase`}>
                      {MODALITY_META[sharedPipeline!.sourceModality].label}에서 생성
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-purple-400 dark:text-purple-300 break-all leading-relaxed">{sharedPipeline!.equation}</div>
                  {sharedPipeline!.narrative && (
                    <p className="mt-1 text-[9px] text-slate-400 dark:text-white/30 leading-relaxed">{sharedPipeline!.narrative}</p>
                  )}
                  <div className="mt-1 text-[8px] font-mono text-slate-300 dark:text-white/20">T={sharedPipeline!.temperature.toFixed(2)}</div>
                </div>
              )}
            </div>

            {/* 이미지 히스토리 */}
            {modality==='image' && imageHistory.length>0 && (
              <div className="px-4 pb-4">
                <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-white/25 mb-2">최근 생성</div>
                <div className="grid grid-cols-4 gap-1">
                  {imageHistory.map((url,i) => (
                    <button key={i} onClick={() => setResults(p => ({...p, image: {...(p.image??EMPTY_RESULT), url}}))}
                      className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${curResult.url===url?'border-violet-400 scale-105':'border-transparent hover:border-white/30'}`}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover"/>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* ── 오른쪽 캔버스 (탭별 독립 결과) ── */}
          <main className="flex-1 flex flex-col items-center justify-center p-6 min-h-0 overflow-y-auto">

            {/* 에러 */}
            {curStage==='error' && curResult.error && (
              <div className="w-full max-w-md p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-center">
                <p className="text-[11px] text-red-400 leading-relaxed">{curResult.error}</p>
                <button onClick={handleReset} className="mt-3 flex items-center gap-1.5 mx-auto text-[10px] font-black text-red-400 hover:text-red-300 transition-all">
                  <RotateCcw size={11}/> 다시 시도
                </button>
              </div>
            )}

            {/* 대기 */}
            {curStage==='idle' && !hasResult && (
              <div className="flex flex-col items-center gap-4 text-center opacity-40">
                <div className={`w-16 h-16 rounded-2xl ${meta.bg} flex items-center justify-center`}>
                  <span className={`${meta.color} scale-[1.8]`}>{meta.icon}</span>
                </div>
                <div>
                  <p className="text-[13px] font-black text-slate-600 dark:text-white/60">{meta.label} 생성 준비</p>
                  <p className="text-[10px] text-slate-400 dark:text-white/30 mt-1">
                    {hasShared ? '수식 연계 배너에서 바로 생성하거나, 새 요청을 입력하세요' : '왼쪽에서 내용을 입력하고 생성하기를 눌러주세요'}
                  </p>
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
                    {PIPELINE_STEPS.find(s => s.key===curStage)?.label ?? '처리 중...'}
                  </p>
                  {modality==='video' && <p className="text-[10px] text-slate-400 dark:text-white/30 mt-0.5 font-mono">{fmtTime(videoElapsed)}</p>}
                </div>
              </div>
            )}

            {/* ── 결과 (탭별 독립) ── */}
            {!isGenerating && hasResult && curStage!=='error' && (
              <div className="w-full flex flex-col items-center gap-4">

                {modality==='video' && curResult.url && (
                  <div className="w-full max-w-2xl rounded-2xl overflow-hidden bg-black shadow-2xl">
                    <video src={curResult.url} controls autoPlay loop className="w-full"/>
                  </div>
                )}

                {modality==='image' && curResult.url && (
                  <div className="max-w-lg w-full rounded-2xl overflow-hidden shadow-xl">
                    <img src={curResult.url} alt="Generated" className="w-full object-contain"/>
                  </div>
                )}

                {modality==='music' && (
                  <div className="w-full max-w-md p-5 rounded-2xl bg-cyan-500/8 border border-cyan-500/20">
                    <div className="flex items-center gap-2 mb-4">
                      <Music size={14} className="text-cyan-400"/>
                      <span className="text-[11px] font-black text-cyan-400">음악 생성 완료</span>
                      {hasImage && (
                        <span className="ml-auto text-[8px] font-black text-cyan-400/60 flex items-center gap-1">
                          <Link2 size={8}/> 이미지 연계
                        </span>
                      )}
                    </div>
                    {curResult.url
                      ? <audio ref={audioRef} src={curResult.url} controls className="w-full"/>
                      : curResult.text && (
                          <div className="p-3 rounded-xl bg-black/10 dark:bg-white/5">
                            <p className="text-[9px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest mb-1.5">음악 프롬프트</p>
                            <p className="text-[11px] text-slate-600 dark:text-white/60 font-mono leading-relaxed">{curResult.text}</p>
                          </div>
                        )
                    }
                  </div>
                )}

                {['code','design','plan'].includes(modality) && curResult.text && (
                  <div className="w-full max-w-2xl">
                    <div className={`flex items-center gap-2 mb-2 ${meta.color}`}>
                      {meta.icon}
                      <span className="text-[11px] font-black">{meta.label} 컴파일 완료</span>
                    </div>
                    <pre className={`p-4 rounded-2xl ${meta.bg} border border-black/8 dark:border-white/8 text-[11px] text-slate-700 dark:text-white/70 font-mono leading-relaxed whitespace-pre-wrap break-words overflow-auto max-h-96`}>
                      {curResult.text}
                    </pre>
                  </div>
                )}

                {/* 액션 버튼 */}
                <div className="flex items-center gap-2 mt-2">
                  {curResult.url && (
                    <button
                      onClick={() => {
                        const ext = modality==='video'?'mp4':modality==='image'?'png':'mp3'
                        handleDownload(curResult.url!, ext)
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 text-[10px] font-black text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/60 transition-all"
                    >
                      <Download size={11}/> 다운로드
                    </button>
                  )}
                  <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 text-[10px] font-black text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/60 transition-all">
                    <RotateCcw size={11}/> 초기화
                  </button>
                  {curStage==='done' && (
                    <div className="flex items-center gap-1 ml-1">
                      <ChevronRight size={9} className="text-emerald-400"/>
                      <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">완료 · 다른 탭에서 수식 연계 가능</span>
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
            {hasShared && (
              <span className="ml-2 text-[8px] font-black text-purple-400/60 flex items-center gap-1">
                <Link2 size={7}/> 수식 공유 중
              </span>
            )}
          </div>
          <span className={`text-[8px] font-black uppercase tracking-widest ${
            curStage==='done'?'text-emerald-400':curStage==='error'?'text-red-400':isGenerating?meta.color:'text-slate-300 dark:text-white/20'
          }`}>
            {curStage==='idle'?'READY':curStage==='done'?'DONE':curStage==='error'?'ERROR':`${curStage.toUpperCase()} →`}
          </span>
        </footer>
      </div>
    </div>
  )
}

export default ContentStudio
