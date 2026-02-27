import React from 'react';
import { useI18n } from '../contexts/I18nContext';
import { PERSONA_PRESETS } from '../data/personaPresets';
import { CATEGORIES } from '../data/essenceBlocks';
import { X, Layers, Crown, Shield } from 'lucide-react';
import type { ActiveEssenceBlock, VectorXYZ } from '../types';

interface SkeletonCanvasProps {
  selectedPersonaId: string;
  onSelectPersona: (id: string) => void;
  activeBlocks: ActiveEssenceBlock[];
  onRemoveBlock: (id: string) => void;
  onChangeVector: (id: string, axis: keyof VectorXYZ, value: number) => void;
  onPromoteToMain: (id: string) => void;
}

/** 물성 바 — 작은 수평 게이지 */
function PropertyBar({ label, value, colorNeg, colorPos }: {
  label: string; value: number; colorNeg: string; colorPos: string;
}) {
  const percent = ((value + 1) / 2) * 100; // -1~1 → 0~100%
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[7px] text-white/25 w-8 text-right shrink-0">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-white/5 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 w-px h-full bg-white/10" />
        <div
          className={`absolute top-0 h-full rounded-full transition-all ${value >= 0 ? colorPos : colorNeg}`}
          style={value >= 0
            ? { left: '50%', width: `${(value / 1) * 50}%` }
            : { right: '50%', width: `${(Math.abs(value) / 1) * 50}%` }
          }
        />
      </div>
    </div>
  );
}

export default function SkeletonCanvas({
  selectedPersonaId, onSelectPersona,
  activeBlocks, onRemoveBlock, onChangeVector, onPromoteToMain,
}: SkeletonCanvasProps) {
  const { t, lang } = useI18n();
  const persona = PERSONA_PRESETS.find(p => p.id === selectedPersonaId);

  // Build vector equation text with role markers
  const mainBlock = activeBlocks.find(b => b.role === 'main');
  const supporters = activeBlocks.filter(b => b.role === 'supporter');
  const equationText = persona
    ? `f(${persona.label}${mainBlock
        ? ` ⊕ MAIN[${mainBlock.funcNotation}·${(mainBlock.influence * 100).toFixed(0)}%]`
        : ''}${supporters.length > 0
        ? ' + ' + supporters.map((b, i) =>
            `S${i + 1}[${b.funcNotation}·${(b.influence * 100).toFixed(0)}%]`
          ).join(' + ')
        : ''}) → prompt`
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

        {/* Essence layer — XYZ 3-axis blocks */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Layers size={10} className="text-emerald-400/50" />
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-400/50">{t.essenceLayer}</p>
            <span className="text-[8px] text-white/20 font-mono">{activeBlocks.length}/4</span>
            {activeBlocks.length > 0 && (
              <span className="text-[7px] text-white/15 font-mono ml-auto">
                MAIN×1 + SUPPORT×{supporters.length}
              </span>
            )}
          </div>

          {activeBlocks.length === 0 ? (
            <div className="py-8 text-center border-2 border-dashed border-white/10 rounded-2xl">
              <p className="text-[11px] text-white/20">{t.noBlocks}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeBlocks.map((block, idx) => {
                const isMain = block.role === 'main';
                const supporterIdx = !isMain ? supporters.indexOf(block) + 1 : 0;
                return (
                <div
                  key={block.id}
                  className={`p-3 rounded-xl space-y-2.5 transition-all ${
                    isMain
                      ? 'bg-violet-500/8 border-2 border-violet-400/30 ring-1 ring-violet-500/10'
                      : 'bg-white/5 border border-white/10'
                  }`}
                >
                  {/* Role badge + block header */}
                  <div className="flex items-center gap-2">
                    {/* Role indicator */}
                    {isMain ? (
                      <div className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-500/20 border border-violet-400/30">
                        <Crown size={8} className="text-violet-400" />
                        <span className="text-[7px] font-black uppercase tracking-wider text-violet-400">MAIN</span>
                        <span className="text-[7px] font-mono text-violet-400/60">{(block.influence * 100).toFixed(0)}%</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => onPromoteToMain(block.id)}
                        className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/5 border border-white/8 hover:border-violet-400/30 hover:bg-violet-500/10 transition-all group"
                        title={lang === 'ko' ? '메인으로 승격' : 'Promote to Main'}
                      >
                        <Shield size={8} className="text-white/25 group-hover:text-violet-400" />
                        <span className="text-[7px] font-black uppercase tracking-wider text-white/25 group-hover:text-violet-400">S{supporterIdx}</span>
                        <span className="text-[7px] font-mono text-white/20">{(block.influence * 100).toFixed(0)}%</span>
                      </button>
                    )}

                    <span className="text-base">{block.emoji}</span>
                    <span className={`text-[11px] font-bold ${catColor(block.category)}`}>
                      {lang === 'ko' ? block.name : block.nameEn}
                    </span>
                    <span className="text-[8px] font-mono text-white/20 flex-1 truncate">
                      {block.funcNotation}
                    </span>
                    <button
                      onClick={() => onRemoveBlock(block.id)}
                      className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  {/* XYZ Sliders */}
                  <div className="space-y-1.5">
                    {/* X: 객관성 */}
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono font-bold text-blue-400 w-4">X</span>
                      <span className="text-[7px] text-white/25 w-10">{t.axisX}</span>
                      <input
                        type="range" min="0" max="1" step="0.05"
                        value={block.vector.x}
                        onChange={e => onChangeVector(block.id, 'x', parseFloat(e.target.value))}
                        className="flex-1 h-1 cursor-pointer accent-blue-400"
                      />
                      <span className="text-[9px] font-mono font-bold text-blue-400 w-7 text-right">
                        {block.vector.x.toFixed(2)}
                      </span>
                    </div>
                    {/* Y: 주체성 */}
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono font-bold text-pink-400 w-4">Y</span>
                      <span className="text-[7px] text-white/25 w-10">{t.axisY}</span>
                      <input
                        type="range" min="0" max="1" step="0.05"
                        value={block.vector.y}
                        onChange={e => onChangeVector(block.id, 'y', parseFloat(e.target.value))}
                        className="flex-1 h-1 cursor-pointer accent-pink-400"
                      />
                      <span className="text-[9px] font-mono font-bold text-pink-400 w-7 text-right">
                        {block.vector.y.toFixed(2)}
                      </span>
                    </div>
                    {/* Z: 본질성 */}
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono font-bold text-amber-400 w-4">Z</span>
                      <span className="text-[7px] text-white/25 w-10">{t.axisZ}</span>
                      <input
                        type="range" min="0" max="1" step="0.05"
                        value={block.vector.z}
                        onChange={e => onChangeVector(block.id, 'z', parseFloat(e.target.value))}
                        className="flex-1 h-1 cursor-pointer accent-amber-400"
                      />
                      <span className="text-[9px] font-mono font-bold text-amber-400 w-7 text-right">
                        {block.vector.z.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Essence Properties mini-display */}
                  <div className="pt-1.5 border-t border-white/5 space-y-0.5">
                    <p className="text-[7px] font-black uppercase tracking-wider text-white/15 mb-1">{t.essenceProps}</p>
                    <PropertyBar label={t.propTemp} value={block.essenceProperties.temperature} colorNeg="bg-blue-400" colorPos="bg-red-400" />
                    <PropertyBar label={t.propDist} value={block.essenceProperties.distance} colorNeg="bg-emerald-400" colorPos="bg-violet-400" />
                    <PropertyBar label={t.propDens} value={block.essenceProperties.density} colorNeg="bg-sky-400" colorPos="bg-orange-400" />
                    <PropertyBar label={t.propSpeed} value={block.essenceProperties.speed} colorNeg="bg-gray-400" colorPos="bg-yellow-400" />
                    <PropertyBar label={t.propBright} value={block.essenceProperties.brightness} colorNeg="bg-gray-500" colorPos="bg-white" />
                  </div>
                </div>
                );
              })}
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
