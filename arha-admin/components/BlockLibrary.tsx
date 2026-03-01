import React, { useState } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { ESSENCE_BLOCKS, CATEGORIES } from '../data/essenceBlocks';
import { ChevronDown, Plus, Check } from 'lucide-react';
import type { EssenceBlock } from '../types';
import { MAX_SUPPORTERS, OPERATOR_META } from '../types';

interface BlockLibraryProps {
  onAddBlock: (block: EssenceBlock) => void;
  activeBlockIds: Set<string>;
}

export default function BlockLibrary({ onAddBlock, activeBlockIds }: BlockLibraryProps) {
  const { t, lang } = useI18n();
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(['philosophy', 'emotion', 'creativity', 'expression', 'systems']));
  const isFull = activeBlockIds.size >= 1 + MAX_SUPPORTERS; // max 4 total

  const catLabels: Record<string, string> = {
    philosophy: t.catPhilosophy,
    emotion: t.catEmotion,
    creativity: t.catCreativity,
    expression: t.catExpression,
    systems: t.catSystems,
  };

  const toggleCat = (key: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-white/10">
        <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">{t.blockLibrary}</h2>
        <p className="text-[10px] text-white/25 mt-1">{t.blockLibraryDesc}</p>
      </div>

      {/* Block list */}
      <div className="flex-1 overflow-y-auto scroll-hide p-3 space-y-2">
        {CATEGORIES.map(cat => {
          const blocks = ESSENCE_BLOCKS.filter(b => b.category === cat.key);
          const isExpanded = expandedCats.has(cat.key);

          return (
            <div key={cat.key}>
              {/* Category header */}
              <button
                onClick={() => toggleCat(cat.key)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg ${cat.bg} ${cat.border} border transition-all hover:brightness-125`}
              >
                <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${cat.color}`}>
                  {catLabels[cat.key]}
                </span>
                <span className="text-[8px] text-white/20 ml-1">{blocks.length}</span>
                <ChevronDown size={10} className={`ml-auto text-white/30 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
              </button>

              {/* Blocks */}
              {isExpanded && (
                <div className="mt-1.5 space-y-1.5">
                  {blocks.map(block => {
                    const isActive = activeBlockIds.has(block.id);
                    const isDisabled = isActive || (!isActive && isFull);
                    return (
                      <div
                        key={block.id}
                        className={`p-2.5 rounded-xl border transition-all ${
                          isActive
                            ? 'bg-white/3 border-white/5 opacity-50'
                            : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/8'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-base shrink-0">{block.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-white/80">
                              {lang === 'ko' ? block.name : block.nameEn}
                            </p>
                            <p className="text-[9px] text-white/35 mt-0.5 leading-relaxed">
                              {lang === 'ko' ? block.description : block.descriptionEn}
                            </p>
                            {/* Function notation */}
                            <p className="text-[8px] font-mono text-white/15 mt-1">
                              {block.funcNotation}
                            </p>
                            {/* Default vector mini + operator type badge */}
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-[7px] font-mono text-blue-400/40">X:{block.defaultVector.x}</span>
                              <span className="text-[7px] font-mono text-pink-400/40">Y:{block.defaultVector.y}</span>
                              <span className="text-[7px] font-mono text-amber-400/40">Z:{block.defaultVector.z}</span>
                              {block.operatorType && (() => {
                                const meta = OPERATOR_META[block.operatorType];
                                return (
                                  <span className={`text-[7px] font-mono font-bold px-1 py-0.5 rounded ${meta.bgColor} ${meta.color}`}>
                                    {meta.notation}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                          <button
                            onClick={() => !isDisabled && onAddBlock(block)}
                            disabled={isDisabled}
                            className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold transition-all ${
                              isDisabled
                                ? 'bg-white/5 text-white/20 cursor-not-allowed'
                                : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 active:scale-95'
                            }`}
                          >
                            {isActive
                              ? <><Check size={8} /> {t.alreadyAdded}</>
                              : isFull
                                ? <span className="text-[8px] text-white/20">MAX</span>
                                : <><Plus size={8} /> {t.addBlock}</>
                            }
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
