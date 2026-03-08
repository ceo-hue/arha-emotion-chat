
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, Video, Download, Film, RotateCcw, Play } from 'lucide-react';
import { generateArhaVideo } from '../services/geminiService';

// ── Aspect ratio ─────────────────────────────────────────────────────────────
const ASPECT_RATIOS = [
  { id: '16:9', label: '16:9', desc: '가로형 · YouTube / 데스크탑', w: 28, h: 16 },
  { id: '9:16', label: '9:16', desc: '세로형 · Shorts / Reels',    w: 16, h: 28 },
] as const;

type AspectRatio = '16:9' | '9:16';

// ── Generation step labels (fake-progress for UX) ────────────────────────────
const STEPS = [
  '프롬프트 이해 중',
  '장면 구성 중',
  '프레임 생성 중',
  '최종 렌더링 중',
];

interface Props {
  onClose: () => void;
  initialPrompt?: string;
}

const VideoStudio: React.FC<Props> = ({ onClose, initialPrompt = '' }) => {
  const [prompt, setPrompt]             = useState(initialPrompt);
  const [aspectRatio, setAspectRatio]   = useState<AspectRatio>('16:9');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const [elapsed, setElapsed]           = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Elapsed timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isGenerating) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(t => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isGenerating]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ── Active step index based on elapsed ──────────────────────────────────
  const activeStep = Math.min(Math.floor(elapsed / 20), STEPS.length - 1);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const videoUrl = await generateArhaVideo(prompt, aspectRatio);
      setGeneratedVideo(videoUrl);
    } catch {
      setError('영상 생성에 실패했어요. 프롬프트를 수정하거나 다시 시도해주세요.');
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, aspectRatio, isGenerating]);

  const handleDownload = () => {
    if (!generatedVideo) return;
    const a = document.createElement('a');
    a.href = generatedVideo;
    a.download = `arha-video-${Date.now()}.mp4`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-5xl mx-4 h-[92vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl">

        {/* ── Header ── */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-black/10 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-orange-500/15 flex items-center justify-center">
              <Film size={15} className="text-orange-400" />
            </div>
            <div>
              <h2 className="text-[13px] font-black uppercase tracking-widest text-slate-700 dark:text-white/90">Video Studio</h2>
              <p className="text-[8px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-widest">ARHA × VEO 3.1 Fast</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-all text-slate-500 dark:text-white/50"
          >
            <X size={16} />
          </button>
        </header>

        {/* ── Body ── */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* ── Left: Controls ── */}
          <aside className="w-72 shrink-0 flex flex-col gap-4 p-5 border-r border-black/10 dark:border-white/10 overflow-y-auto scroll-hide">

            {/* Prompt */}
            <div>
              <label className="text-[8px] font-black uppercase tracking-widest text-orange-500/60 dark:text-orange-400/60 mb-1.5 block">
                Prompt
              </label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="장면을 구체적으로 묘사해주세요.&#10;예: 해질 무렵 바닷가를 걷는 여성, 황금빛 노을, 느린 카메라 워크"
                rows={7}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate(); }}
                className="w-full rounded-xl p-3 text-[12px] bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-slate-700 dark:text-white/80 placeholder:text-slate-400 dark:placeholder:text-white/25 focus:outline-none focus:border-orange-400/50 resize-none leading-relaxed"
              />
              <p className="text-[8px] text-slate-400 dark:text-white/20 mt-1">Ctrl+Enter 로 생성 · 약 1–3분 소요</p>
            </div>

            {/* Aspect Ratio */}
            <div>
              <label className="text-[8px] font-black uppercase tracking-widest text-orange-500/60 dark:text-orange-400/60 mb-1.5 block">
                Aspect Ratio
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ASPECT_RATIOS.map(ar => (
                  <button
                    key={ar.id}
                    onClick={() => setAspectRatio(ar.id)}
                    className={`flex flex-col items-center gap-2.5 py-4 rounded-xl border transition-all ${
                      aspectRatio === ar.id
                        ? 'border-orange-400 bg-orange-500/10'
                        : 'border-black/10 dark:border-white/10 hover:border-orange-400/30 bg-black/3 dark:bg-white/3'
                    }`}
                  >
                    <div
                      className={`rounded-sm transition-all ${aspectRatio === ar.id ? 'bg-orange-400' : 'bg-slate-400/40 dark:bg-white/20'}`}
                      style={{ width: ar.w, height: ar.h }}
                    />
                    <div className="text-center">
                      <p className={`text-[10px] font-black ${aspectRatio === ar.id ? 'text-orange-400' : 'text-slate-700 dark:text-white/70'}`}>
                        {ar.label}
                      </p>
                      <p className="text-[8px] text-slate-400 dark:text-white/30 leading-tight mt-0.5">{ar.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Info card */}
            <div className="rounded-xl bg-orange-500/5 border border-orange-500/15 p-3 space-y-1.5">
              <p className="text-[9px] font-black text-orange-400/80 uppercase tracking-widest">VEO 3.1 Fast</p>
              <p className="text-[9px] text-slate-500 dark:text-white/35 leading-relaxed">
                Google DeepMind의 최신 영상 생성 AI.<br />
                720p · 5초 내외 · 자연스러운 물리 시뮬레이션
              </p>
            </div>

            {/* Generate CTA */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className={`mt-auto flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-[12px] tracking-wide transition-all active:scale-95 ${
                isGenerating || !prompt.trim()
                  ? 'bg-orange-500/15 text-orange-400/35 cursor-not-allowed'
                  : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:brightness-110 shadow-lg shadow-orange-500/25'
              }`}
            >
              {isGenerating
                ? <><span className="animate-spin inline-block">✦</span> 생성 중... {formatTime(elapsed)}</>
                : <><Film size={13} /> 영상 생성</>
              }
            </button>
          </aside>

          {/* ── Right: Canvas ── */}
          <main className="flex-1 flex flex-col items-center justify-center p-8 overflow-hidden min-w-0">

            {/* Loading */}
            {isGenerating && (
              <div className="flex flex-col items-center gap-6 text-center max-w-xs w-full">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 rounded-full border-4 border-orange-500/10 animate-ping" />
                  <div className="absolute inset-0 rounded-full border-4 border-orange-500/10" />
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-orange-400 border-r-orange-400/30 animate-spin" />
                  <Film size={24} className="absolute inset-0 m-auto text-orange-400" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-slate-700 dark:text-white/80">영상을 생성하고 있어요</p>
                  <p className="text-[11px] text-slate-400 dark:text-white/40 mt-1">경과 시간 {formatTime(elapsed)}</p>
                </div>
                {/* Progress steps */}
                <div className="w-full space-y-2.5 mt-2">
                  {STEPS.map((step, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full shrink-0 transition-all duration-700 ${
                        i < activeStep  ? 'bg-orange-400 scale-100' :
                        i === activeStep ? 'bg-orange-400 animate-pulse scale-125' :
                        'bg-slate-300 dark:bg-white/10 scale-75'
                      }`} />
                      <p className={`text-[10px] transition-all duration-500 ${
                        i <= activeStep ? 'text-orange-400 font-bold' : 'text-slate-400 dark:text-white/25'
                      }`}>
                        {step}
                        {i === activeStep && <span className="ml-1.5 animate-pulse">...</span>}
                      </p>
                      {i < activeStep && (
                        <span className="ml-auto text-[8px] text-emerald-500 font-black">✓</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {!isGenerating && error && (
              <div className="flex flex-col items-center gap-3 text-center max-w-xs">
                <p className="text-[12px] text-red-400 leading-relaxed">{error}</p>
                <button onClick={() => setError(null)} className="text-[10px] text-orange-400 hover:underline">
                  닫기
                </button>
              </div>
            )}

            {/* Result */}
            {!isGenerating && !error && generatedVideo && (
              <div className="flex flex-col items-center gap-4 w-full max-w-2xl animate-in fade-in duration-300">
                <div className="rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 shadow-2xl shadow-black/20 w-full bg-black">
                  <video
                    src={generatedVideo}
                    controls
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full max-h-[55vh] object-contain"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500 dark:text-orange-400 text-[11px] font-bold hover:bg-orange-500/20 transition-all active:scale-95"
                  >
                    <Download size={12} /> 다운로드
                  </button>
                  <button
                    onClick={() => { setGeneratedVideo(null); setPrompt(''); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-slate-500 dark:text-white/40 text-[11px] font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-all active:scale-95"
                  >
                    <RotateCcw size={12} /> 새로 만들기
                  </button>
                </div>
              </div>
            )}

            {/* Empty state */}
            {!isGenerating && !error && !generatedVideo && (
              <div className="flex flex-col items-center gap-3 opacity-25">
                <div className="w-28 h-28 rounded-3xl border-2 border-dashed border-orange-400/50 flex items-center justify-center">
                  <Play size={36} className="text-orange-400/70 ml-1" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-white/50 font-medium text-center">
                  왼쪽에서 장면을 묘사하고<br />영상을 생성하세요
                </p>
                <p className="text-[9px] text-slate-400 dark:text-white/30 text-center">
                  생성에 약 1–3분 소요됩니다
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default VideoStudio;
