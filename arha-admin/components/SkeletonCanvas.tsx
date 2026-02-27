import React from 'react';
import { useI18n } from '../contexts/I18nContext';
import { PERSONA_PRESETS } from '../data/personaPresets';
import { CATEGORIES } from '../data/essenceBlocks';
import { X, Layers } from 'lucide-react';
import type { ActiveEssenceBlock } from '../types';

interface SkeletonCanvasProps {
  selectedPersonaId: string;
  onSelectPersona: (id: string) => void;
  activeBlocks: ActiveEssenceBlock[];
  onRemoveBlock: (id: string) => void;
  onChangeWeight: (id: string, weight: number) => void;
}

export default function SkeletonCanvas({
  selectedPersonaId, onSelectPersona,
  activeBlocks, onRemoveBlock, onChangeWeight,
}: SkeletonCanvasProps) {
  const { t, lang } = useI18n();
  const persona = PERSONA_PRESETS.find(p => p.id === selectedPersonaId);

  // Build equation text
  const equationText = persona
    ? `f(${persona.label}${activeBlocks.length > 0 ? ' + ' + activeBlocks.map(b => `${b.nameEn}(${b.weight.toFixed(2)})`).join(' + ') : ''}) → prompt`
    : '';

  const catColor = (category: string) => CATEGORIES.find(c => c.key === category)?.color ?? 'text-white/50';

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-white/10">
        <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">{t.skeletonCanvas}</h2>
      </div>

      <div className="flex-1 overflow-y-auto scroll-hide p-4 space-y-4">
        {/* Persona selector */}
        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-violet-400/50 mb-2">{t.basePersona}</p>
          <div className="flex flex-wrap gap-1.5">
            {PERSONA_PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => onSelectPersona(p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-95 ${
                  p.id === selectedPersonaId
                    ? 'bg-violet-500/20 border border-violet-400/40 text-violet-300'
                    : 'bg-white/5 border border-white/10 text-white/40 hover:text-white/60 hover:border-white/20'
                }`}
              >
                <span>{p.emoji}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Value chain display */}
        {persona && (
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/25 mb-2">{t.valueChain}</p>
            <div className="flex flex-wrap gap-1">
              {persona.valueChain.map(v => (
                <div key={v.id} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/8">
                  <span className="text-[8px] font-mono text-white/30">{v.id}</span>
                  <span className="text-[9px] text-white/50">{v.name}</span>
                  <span className="text-[8px] font-mono text-emerald-400/50">{v.weight.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Essence layer */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Layers size={10} className="text-emerald-400/50" />
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-400/50">{t.essenceLayer}</p>
            <span className="text-[8px] text-white/20 font-mono">{activeBlocks.length}</span>
          </div>

          {activeBlocks.length === 0 ? (
            <div className="py-8 text-center border-2 border-dashed border-white/10 rounded-2xl">
              <p className="text-[11px] text-white/20">{t.noBlocks}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeBlocks.map(block => (
                <div key={block.id} className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{block.emoji}</span>
                    <span className={`text-[11px] font-bold ${catColor(block.category)}`}>
                      {lang === 'ko' ? block.name : block.nameEn}
                    </span>
                    <span className="text-[9px] text-white/25 flex-1 truncate">
                      {lang === 'ko' ? block.description : block.descriptionEn}
                    </span>
                    <button
                      onClick={() => onRemoveBlock(block.id)}
                      className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  {/* Weight slider */}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[8px] text-white/25 uppercase tracking-wider">{t.weight}</span>
                    <input
                      type="range"
                      min="0" max="1" step="0.05"
                      value={block.weight}
                      onChange={e => onChangeWeight(block.id, parseFloat(e.target.value))}
                      className="flex-1 h-1 cursor-pointer"
                    />
                    <span className="text-[10px] font-mono font-bold text-emerald-400 w-8 text-right">
                      {block.weight.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Equation preview */}
        {activeBlocks.length > 0 && (
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/25 mb-2">{t.equationPreview}</p>
            <div className="p-3 rounded-xl glass-sunken">
              <p className="text-[10px] font-mono text-emerald-400/70 leading-relaxed break-all">
                {equationText}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
