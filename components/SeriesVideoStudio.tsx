// ═══════════════════════════════════════════════════════════
//  Series Video Studio — 스크립트 기반 연속 영상 제작
//  개념 → Claude 내레이션 스크립트 → 편집 → 순차 VEO 생성
//  1~10편 일관성 있는 시리즈 콘텐츠 생성
// ═══════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react'
import { Film, FileText, Play, Download, RotateCcw, CheckCircle, Loader } from 'lucide-react'
import {
  generateNarrationScript,
  buildSeriesVideoPrompt,
  type NarrationScript,
  type NarrationShot,
} from '../services/narrationService'
import { generateVideo }    from '../services/videoService'
import { describeError }    from '../lib/generationError'
import { type VideoAspectRatio } from '../lib/modelStrategy'

// ── 상수 ──────────────────────────────────────────────────

const MAX_SHOTS = 10

type Phase = 'input' | 'scripting' | 'editing' | 'generating' | 'complete'
type SeriesType = 'ad' | 'movie'

// ── Props ──────────────────────────────────────────────────

interface Props {
  initialPrompt?:  string;
  aspectRatio:     VideoAspectRatio;
  // 함수언어체계 브릿지 — 채팅 currentAnalysis에서 전달
  expressionMode?: string;
  trajectory?:     string;
}

// ── 컴포넌트 ───────────────────────────────────────────────

const SeriesVideoStudio: React.FC<Props> = ({ initialPrompt = '', aspectRatio, expressionMode, trajectory }) => {

  // ── 입력 상태 ──────────────────────────────────────────
  const [concept,     setConcept]     = useState(initialPrompt)
  const [seriesType,  setSeriesType]  = useState<SeriesType>('ad')
  const [shotCount,   setShotCount]   = useState(5)

  // ── 워크플로우 상태 ───────────────────────────────────
  const [phase,       setPhase]       = useState<Phase>('input')
  const [script,      setScript]      = useState<NarrationScript | null>(null)
  const [shots,       setShots]       = useState<NarrationShot[]>([])
  const [clips,       setClips]       = useState<(string | null)[]>([])
  const [currentShot, setCurrentShot] = useState(0)
  const [error,       setError]       = useState<string | null>(null)
  const [elapsed,     setElapsed]     = useState(0)

  // ── 타이머 ref ─────────────────────────────────────────
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimer = () => {
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed(t => t + 1), 1000)
  }
  const stopTimer = () => { if (timerRef.current) clearInterval(timerRef.current) }
  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  // ── 스크립트 생성 ──────────────────────────────────────
  const handleGenerateScript = useCallback(async () => {
    if (!concept.trim()) return
    setPhase('scripting')
    setError(null)
    try {
      const result = await generateNarrationScript({ concept, type: seriesType, shotCount, expressionMode, trajectory })
      setScript(result)
      setShots(result.shots.map(s => ({ ...s })))  // editable copy
      setClips(new Array(result.shots.length).fill(null))
      setPhase('editing')
    } catch (e: any) {
      setError(e.message ?? '스크립트 생성 실패')
      setPhase('input')
    }
  }, [concept, seriesType, shotCount])

  // ── 샷 필드 편집 ──────────────────────────────────────
  const updateShot = (idx: number, field: 'narration' | 'visualPrompt', value: string) => {
    setShots(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  // ── 순차 영상 생성 ─────────────────────────────────────
  const handleGenerateVideos = useCallback(async () => {
    if (!script) return
    setPhase('generating')
    setCurrentShot(0)
    const results: (string | null)[] = new Array(shots.length).fill(null)

    for (let i = 0; i < shots.length; i++) {
      setCurrentShot(i)
      startTimer()
      try {
        const prompt = buildSeriesVideoPrompt(shots[i], script.consistencyAnchor, script.expressionMode)
        const url    = await generateVideo({ rawPrompt: prompt, aspectRatio })
        results[i]   = url
        setClips([...results])
      } catch (e: any) {
        const ge = e as { _tag?: string }
        const msg = ge._tag ? describeError(e as Parameters<typeof describeError>[0]) : (e.message ?? '생성 실패')
        results[i] = null
        setClips([...results])
        setError(`Shot ${i + 1} 생성 실패: ${msg}`)
      } finally {
        stopTimer()
      }
    }
    setPhase('complete')
  }, [shots, script, aspectRatio])

  // ── 리셋 ──────────────────────────────────────────────
  const handleReset = () => {
    setPhase('input')
    setScript(null)
    setShots([])
    setClips([])
    setCurrentShot(0)
    setError(null)
    setConcept('')
  }

  // ── 개별 다운로드 ──────────────────────────────────────
  const downloadClip = (url: string, idx: number) => {
    const a = document.createElement('a')
    a.href = url
    a.download = `arha-series-${idx + 1}.mp4`
    a.click()
  }

  // ── JSX ────────────────────────────────────────────────
  return (
    <div className="flex flex-1 overflow-hidden min-h-0">

      {/* ── 왼쪽: 설정 패널 ── */}
      <aside className="flex flex-col gap-4 p-5 w-52 lg:w-64 shrink-0 border-r border-black/10 dark:border-white/10 overflow-y-auto scroll-hide">

        {/* 개념 입력 */}
        <div>
          <label className="text-[8px] font-black uppercase tracking-widest text-orange-500/60 dark:text-orange-400/60 mb-1.5 block">
            Concept
          </label>
          <textarea
            value={concept}
            onChange={e => setConcept(e.target.value)}
            disabled={phase !== 'input'}
            placeholder={'콘텐츠 주제/개념\n예: 새벽 카페에서 혼자 일하는 여성의 하루'}
            rows={5}
            className="w-full rounded-xl p-3 text-[12px] bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-slate-700 dark:text-white/80 placeholder:text-slate-400 dark:placeholder:text-white/25 focus:outline-none focus:border-orange-400/50 resize-none leading-relaxed disabled:opacity-40"
          />
        </div>

        {/* 유형 선택 */}
        <div>
          <label className="text-[8px] font-black uppercase tracking-widest text-orange-500/60 dark:text-orange-400/60 mb-1.5 block">
            Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { id: 'ad'    as SeriesType, label: '광고', sub: '60s Commercial' },
              { id: 'movie' as SeriesType, label: '영화', sub: 'Cinematic Film'  },
            ]).map(t => (
              <button
                key={t.id}
                onClick={() => setSeriesType(t.id)}
                disabled={phase !== 'input'}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-all disabled:opacity-40 ${
                  seriesType === t.id
                    ? 'border-orange-400 bg-orange-500/10 text-orange-400'
                    : 'border-black/10 dark:border-white/10 text-slate-600 dark:text-white/50 hover:border-orange-400/30'
                }`}
              >
                <span className="text-[11px] font-black">{t.label}</span>
                <span className="text-[8px] opacity-60">{t.sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 샷 수 */}
        <div>
          <label className="text-[8px] font-black uppercase tracking-widest text-orange-500/60 dark:text-orange-400/60 mb-1.5 block">
            Shots — <span className="text-orange-400">{shotCount}편</span>
          </label>
          <input
            type="range" min={1} max={MAX_SHOTS} value={shotCount}
            onChange={e => setShotCount(Number(e.target.value))}
            disabled={phase !== 'input'}
            className="w-full accent-orange-400 disabled:opacity-40"
          />
          <div className="flex justify-between text-[8px] text-slate-400 dark:text-white/25 mt-0.5">
            <span>1</span><span>{MAX_SHOTS}</span>
          </div>
        </div>

        {/* 함수언어체계 적용 상태 배지 */}
        {(expressionMode || trajectory) && (
          <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/15 p-3 space-y-1">
            <p className="text-[8px] font-black text-indigo-400/70 uppercase tracking-widest mb-1">
              Function Language Bridge
            </p>
            {expressionMode && (
              <p className="text-[9px] text-slate-500 dark:text-white/40">
                <span className="text-indigo-400 font-bold">mode</span> {expressionMode}
              </p>
            )}
            {trajectory && (
              <p className="text-[9px] text-slate-500 dark:text-white/40">
                <span className="text-indigo-400 font-bold">arc</span> {trajectory}
              </p>
            )}
          </div>
        )}

        {/* 일관성 앵커 (스크립트 생성 후 표시) */}
        {script && (
          <div className="rounded-xl bg-purple-500/5 border border-purple-500/20 p-3">
            <p className="text-[8px] font-black text-purple-400/70 uppercase tracking-widest mb-1">
              Consistency Anchor
            </p>
            <p className="text-[9px] text-slate-500 dark:text-white/40 leading-relaxed">
              {script.consistencyAnchor}
            </p>
          </div>
        )}

        {/* 진행 상황 (생성 중) */}
        {phase === 'generating' && (
          <div className="space-y-1.5">
            <p className="text-[8px] font-black uppercase tracking-widest text-orange-400/60">
              Progress
            </p>
            {shots.map((_, i) => {
              const done    = clips[i] !== null && clips[i] !== undefined
              const current = i === currentShot && phase === 'generating'
              return (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 transition-all ${
                    done    ? 'bg-emerald-400' :
                    current ? 'bg-orange-400 animate-pulse' :
                    'bg-slate-300 dark:bg-white/10'
                  }`} />
                  <span className={`text-[9px] ${
                    done    ? 'text-emerald-400 font-bold' :
                    current ? 'text-orange-400 font-bold' :
                    'text-slate-400 dark:text-white/25'
                  }`}>
                    Shot {i + 1}
                    {current && <span className="ml-1 font-normal">{fmtTime(elapsed)}</span>}
                    {done    && <span className="ml-1">✓</span>}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="mt-auto space-y-2">
          {phase === 'input' && (
            <button
              onClick={handleGenerateScript}
              disabled={!concept.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-[12px] tracking-wide bg-gradient-to-r from-purple-500 to-orange-500 text-white hover:brightness-110 shadow-lg disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              <FileText size={13} /> 스크립트 생성
            </button>
          )}
          {phase === 'editing' && (
            <button
              onClick={handleGenerateVideos}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-[12px] tracking-wide bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:brightness-110 shadow-lg shadow-orange-500/25 transition-all active:scale-95"
            >
              <Film size={13} /> {shots.length}편 영상 생성
            </button>
          )}
          {(phase === 'editing' || phase === 'complete') && (
            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/60 transition-all"
            >
              <RotateCcw size={11} /> 처음부터
            </button>
          )}
        </div>
      </aside>

      {/* ── 중앙: 스크립트 편집 / 영상 타임라인 ── */}
      <main className="flex-1 overflow-y-auto scroll-hide p-4 sm:p-6">

        {/* ── Phase: input / scripting ── */}
        {(phase === 'input' || phase === 'scripting') && (
          <div className="h-full flex flex-col items-center justify-center gap-4 opacity-60">
            {phase === 'scripting' ? (
              <>
                <Loader size={28} className="text-purple-400 animate-spin" />
                <p className="text-[13px] font-bold text-slate-600 dark:text-white/60">
                  Claude가 스크립트를 작성하고 있어요
                </p>
                <p className="text-[10px] text-slate-400 dark:text-white/30">
                  {seriesType === 'ad' ? '광고' : '영화'} · {shotCount}편
                </p>
              </>
            ) : (
              <>
                <div className="w-24 h-24 rounded-3xl border-2 border-dashed border-purple-400/40 flex items-center justify-center">
                  <FileText size={32} className="text-purple-400/60" />
                </div>
                <p className="text-[12px] text-center text-slate-500 dark:text-white/40">
                  개념을 입력하고<br />스크립트를 생성하세요
                </p>
              </>
            )}
          </div>
        )}

        {/* ── Phase: editing — 샷 카드 ── */}
        {phase === 'editing' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <FileText size={14} className="text-purple-400" />
              <h3 className="text-[11px] font-black uppercase tracking-widest text-purple-400">
                Script Editor — {shots.length}편
              </h3>
              <span className="ml-auto text-[9px] text-slate-400 dark:text-white/30">
                내레이션·비주얼 프롬프트 직접 편집 가능
              </span>
            </div>

            {shots.map((shot, i) => (
              <div key={i} className="rounded-2xl border border-black/8 dark:border-white/8 bg-black/2 dark:bg-white/2 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/6 dark:border-white/6 bg-orange-500/5">
                  <span className="w-6 h-6 rounded-lg bg-orange-500/15 flex items-center justify-center text-[9px] font-black text-orange-400">
                    {shot.index}
                  </span>
                  <span className="text-[9px] font-black text-orange-400/60 uppercase tracking-widest">
                    Shot {shot.index}
                  </span>
                  <span className="ml-auto text-[8px] text-slate-400 dark:text-white/25">
                    {shot.duration}s
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  {/* 내레이션 (Korean) */}
                  <div>
                    <label className="text-[8px] font-black text-purple-400/60 uppercase tracking-widest mb-1 block">
                      내레이션 (Korean)
                    </label>
                    <textarea
                      value={shot.narration}
                      onChange={e => updateShot(i, 'narration', e.target.value)}
                      rows={2}
                      className="w-full rounded-xl p-2.5 text-[11px] bg-black/5 dark:bg-white/5 border border-black/8 dark:border-white/8 text-slate-700 dark:text-white/80 focus:outline-none focus:border-purple-400/40 resize-none leading-relaxed"
                    />
                  </div>

                  {/* 비주얼 프롬프트 (English) */}
                  <div>
                    <label className="text-[8px] font-black text-orange-400/60 uppercase tracking-widest mb-1 block">
                      Visual Prompt (English)
                    </label>
                    <textarea
                      value={shot.visualPrompt}
                      onChange={e => updateShot(i, 'visualPrompt', e.target.value)}
                      rows={2}
                      className="w-full rounded-xl p-2.5 text-[11px] bg-black/5 dark:bg-white/5 border border-black/8 dark:border-white/8 text-slate-600 dark:text-white/60 focus:outline-none focus:border-orange-400/40 resize-none leading-relaxed font-mono"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Phase: generating / complete — 영상 타임라인 ── */}
        {(phase === 'generating' || phase === 'complete') && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <Film size={14} className="text-orange-400" />
              <h3 className="text-[11px] font-black uppercase tracking-widest text-orange-400">
                Video Timeline — {shots.length}편
              </h3>
              {phase === 'complete' && (
                <span className="ml-auto flex items-center gap-1 text-[9px] text-emerald-400 font-bold">
                  <CheckCircle size={10} /> 완료
                </span>
              )}
            </div>

            {/* 에러 배너 */}
            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-[10px] text-red-400">
                {error}
                <button onClick={() => setError(null)} className="ml-3 underline">닫기</button>
              </div>
            )}

            {shots.map((shot, i) => {
              const clip    = clips[i]
              const done    = clip !== null && clip !== undefined && clip !== ''
              const current = i === currentShot && phase === 'generating'
              const waiting = !done && !current

              return (
                <div key={i} className={`rounded-2xl border overflow-hidden transition-all ${
                  done    ? 'border-emerald-500/20 bg-emerald-500/3' :
                  current ? 'border-orange-400/30 bg-orange-500/5' :
                  'border-black/8 dark:border-white/8'
                }`}>
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      done    ? 'bg-emerald-400' :
                      current ? 'bg-orange-400 animate-pulse' :
                      'bg-slate-300 dark:bg-white/15'
                    }`} />
                    <span className={`text-[10px] font-bold ${
                      done    ? 'text-emerald-400' :
                      current ? 'text-orange-400' :
                      'text-slate-400 dark:text-white/30'
                    }`}>
                      Shot {shot.index}
                    </span>
                    <span className="text-[9px] text-slate-400 dark:text-white/25 truncate flex-1">
                      {shot.narration.slice(0, 50)}{shot.narration.length > 50 ? '…' : ''}
                    </span>
                    {current && (
                      <span className="text-[9px] text-orange-400 shrink-0">
                        {fmtTime(elapsed)}
                      </span>
                    )}
                    {done && clip && (
                      <button
                        onClick={() => downloadClip(clip, i)}
                        className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[9px] font-bold hover:bg-emerald-500/20 transition-all"
                      >
                        <Download size={9} /> 저장
                      </button>
                    )}
                  </div>

                  {/* 비디오 플레이어 (완료된 샷) */}
                  {done && clip && (
                    <div className="px-4 pb-4">
                      <video
                        src={clip}
                        controls muted loop playsInline
                        className="w-full rounded-xl max-h-48 object-contain bg-black"
                      />
                    </div>
                  )}

                  {/* 생성 중 애니메이션 */}
                  {current && (
                    <div className="px-4 pb-4 flex items-center justify-center h-20">
                      <Loader size={20} className="text-orange-400 animate-spin" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

export default SeriesVideoStudio
