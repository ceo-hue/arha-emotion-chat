
import React, { useState, useCallback } from 'react';
import { X, Sparkles, Download, RotateCcw, ImageIcon } from 'lucide-react';
import { generateArhaImage } from '../services/geminiService';

// ── Style presets ────────────────────────────────────────────────────────────
const STYLE_PRESETS = [
  { id: 'arha',       label: 'ARHA',       desc: 'ARHA 감성',     color: 'emerald' },
  { id: 'photo',      label: 'Realistic',  desc: '사실적 사진',    color: 'sky' },
  { id: 'anime',      label: 'Anime',      desc: '애니메이션',     color: 'pink' },
  { id: 'watercolor', label: 'Watercolor', desc: '수채화',         color: 'blue' },
  { id: 'oil',        label: 'Oil Paint',  desc: '유화',           color: 'amber' },
  { id: 'sketch',     label: 'Sketch',     desc: '스케치',         color: 'slate' },
] as const;

const STYLE_SUFFIX: Record<string, string> = {
  arha:       '',
  photo:      ', photorealistic, high quality photography, natural lighting, sharp details',
  anime:      ', anime illustration style, vibrant colors, detailed linework, Studio Ghibli aesthetic',
  watercolor: ', soft watercolor painting style, flowing brushstrokes, pastel tones, artistic',
  oil:        ', oil painting style, rich impasto texture, impressionistic, masterpiece quality',
  sketch:     ', detailed pencil sketch, fine crosshatching lines, monochrome, artistic illustration',
};

// ── Aspect ratio options ─────────────────────────────────────────────────────
const ASPECT_RATIOS = [
  { id: '1:1',  label: '1:1',  desc: '정방형',   w: 20, h: 20 },
  { id: '16:9', label: '16:9', desc: '가로형',   w: 24, h: 14 },
  { id: '9:16', label: '9:16', desc: '세로형',   w: 14, h: 24 },
  { id: '4:3',  label: '4:3',  desc: '표준형',   w: 22, h: 17 },
  { id: '3:4',  label: '3:4',  desc: '초상화',   w: 17, h: 22 },
] as const;

type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
type StyleId    = typeof STYLE_PRESETS[number]['id'];

interface Props {
  onClose: () => void;
  initialPrompt?: string;
}

const ImageStudio: React.FC<Props> = ({ onClose, initialPrompt = '' }) => {
  const [prompt, setPrompt]               = useState(initialPrompt);
  const [aspectRatio, setAspectRatio]     = useState<AspectRatio>('1:1');
  const [style, setStyle]                 = useState<StyleId>('arha');
  const [isGenerating, setIsGenerating]   = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [history, setHistory]             = useState<string[]>([]);
  const [error, setError]                 = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const fullPrompt = prompt + (STYLE_SUFFIX[style] ?? '');
      const imageUrl = await generateArhaImage(fullPrompt, aspectRatio as any);
      setGeneratedImage(imageUrl);
      setHistory(prev => [imageUrl, ...prev.slice(0, 7)]);
    } catch {
      setError('이미지 생성에 실패했어요. 프롬프트를 수정하거나 다시 시도해주세요.');
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, aspectRatio, style, isGenerating]);

  const handleDownload = () => {
    if (!generatedImage) return;
    const a = document.createElement('a');
    a.href = generatedImage;
    a.download = `arha-image-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-5xl mx-4 h-[92vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl">

        {/* ── Header ── */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-black/10 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-fuchsia-500/15 flex items-center justify-center">
              <Sparkles size={15} className="text-fuchsia-400" />
            </div>
            <div>
              <h2 className="text-[13px] font-black uppercase tracking-widest text-slate-700 dark:text-white/90">Image Studio</h2>
              <p className="text-[8px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-widest">ARHA × Gemini × Imagen 4</p>
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
              <label className="text-[8px] font-black uppercase tracking-widest text-fuchsia-500/60 dark:text-fuchsia-400/60 mb-1.5 block">
                Prompt
              </label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="어떤 이미지를 만들고 싶으세요? 상세하게 묘사할수록 좋아요."
                rows={5}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate(); }}
                className="w-full rounded-xl p-3 text-[12px] bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-slate-700 dark:text-white/80 placeholder:text-slate-400 dark:placeholder:text-white/25 focus:outline-none focus:border-fuchsia-400/50 resize-none leading-relaxed"
              />
              <p className="text-[8px] text-slate-400 dark:text-white/20 mt-1">Ctrl+Enter 로 생성</p>
            </div>

            {/* Aspect Ratio */}
            <div>
              <label className="text-[8px] font-black uppercase tracking-widest text-fuchsia-500/60 dark:text-fuchsia-400/60 mb-1.5 block">
                Aspect Ratio
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {ASPECT_RATIOS.map(ar => (
                  <button
                    key={ar.id}
                    onClick={() => setAspectRatio(ar.id)}
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

            {/* Style */}
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

            {/* Generate CTA */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className={`mt-auto flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-[12px] tracking-wide transition-all active:scale-95 ${
                isGenerating || !prompt.trim()
                  ? 'bg-fuchsia-500/15 text-fuchsia-400/35 cursor-not-allowed'
                  : 'bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white hover:brightness-110 shadow-lg shadow-fuchsia-500/25'
              }`}
            >
              {isGenerating
                ? <><span className="animate-spin inline-block">✦</span> 생성 중...</>
                : <><Sparkles size={13} /> 이미지 생성</>
              }
            </button>
          </aside>

          {/* ── Right: Canvas ── */}
          <main className="flex-1 flex flex-col items-center justify-center p-8 overflow-hidden relative min-w-0">

            {/* Loading */}
            {isGenerating && (
              <div className="flex flex-col items-center gap-5">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 rounded-full border-2 border-fuchsia-500/10 animate-ping" />
                  <div className="absolute inset-2 rounded-full border-2 border-fuchsia-500/20 animate-ping" style={{ animationDelay: '0.3s' }} />
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-fuchsia-400 border-r-fuchsia-400/40 animate-spin" />
                  <Sparkles size={22} className="absolute inset-0 m-auto text-fuchsia-400 animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-bold text-slate-700 dark:text-white/80">이미지를 그리고 있어요</p>
                  <p className="text-[10px] text-slate-400 dark:text-white/35 mt-1">Gemini Flash × Imagen 4</p>
                </div>
              </div>
            )}

            {/* Error */}
            {!isGenerating && error && (
              <div className="flex flex-col items-center gap-3 text-center max-w-xs">
                <p className="text-[12px] text-red-400">{error}</p>
                <button onClick={() => setError(null)} className="text-[10px] text-fuchsia-400 hover:underline">
                  닫기
                </button>
              </div>
            )}

            {/* Result */}
            {!isGenerating && !error && generatedImage && (
              <div className="flex flex-col items-center gap-4 w-full max-w-xl animate-in fade-in duration-300">
                <div className="rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 shadow-2xl shadow-black/20 w-full flex items-center justify-center bg-black/5 dark:bg-white/3">
                  <img
                    src={generatedImage}
                    alt="Generated"
                    className="max-h-[55vh] max-w-full object-contain"
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
                    onClick={() => { setGeneratedImage(null); setPrompt(''); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-slate-500 dark:text-white/40 text-[11px] font-bold hover:bg-black/10 dark:hover:bg-white/10 transition-all active:scale-95"
                  >
                    <RotateCcw size={12} /> 새로 만들기
                  </button>
                </div>
              </div>
            )}

            {/* Empty state */}
            {!isGenerating && !error && !generatedImage && (
              <div className="flex flex-col items-center gap-3 opacity-25">
                <div className="w-28 h-28 rounded-3xl border-2 border-dashed border-fuchsia-400/50 flex items-center justify-center">
                  <ImageIcon size={36} className="text-fuchsia-400/70" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-white/50 font-medium text-center">
                  왼쪽에서 프롬프트를 입력하고<br />이미지를 생성하세요
                </p>
              </div>
            )}

            {/* History strip */}
            {history.length > 1 && (
              <div className="absolute bottom-4 left-6 right-6 flex gap-2 overflow-x-auto scroll-hide">
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
        </div>
      </div>
    </div>
  );
};

export default ImageStudio;
