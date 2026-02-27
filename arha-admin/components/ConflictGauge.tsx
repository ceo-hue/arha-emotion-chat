import React from 'react';
import { useI18n } from '../contexts/I18nContext';

interface ConflictGaugeProps {
  value: number;
  vectorDistance: number;
  matchedKeywords: string[];
  totalExpected: number;
  axisBreakdown: { x: number; y: number; z: number };
}

export default function ConflictGauge({ value, vectorDistance, matchedKeywords, totalExpected, axisBreakdown }: ConflictGaugeProps) {
  const { t } = useI18n();
  const matchPercent = Math.round((1 - value) * 100);
  const label = value < 0.3 ? t.conflictLow : value < 0.6 ? t.conflictMid : t.conflictHigh;
  const color = value < 0.3 ? 'text-emerald-400' : value < 0.6 ? 'text-amber-400' : 'text-red-400';
  const barColor = value < 0.3 ? 'bg-emerald-500' : value < 0.6 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">{t.conflictIndex}</span>
        <span className={`text-[10px] font-bold ${color}`}>{label}</span>
      </div>

      {/* Main bar */}
      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-700 ease-out`}
          style={{ width: `${matchPercent}%` }}
        />
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-white/40">
          {t.matchedKeywords}: {matchedKeywords.length}/{totalExpected}
        </span>
        <span className={`font-mono font-bold ${color}`}>{matchPercent}%</span>
      </div>

      {/* XYZ Axis Breakdown */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 rounded-lg bg-blue-500/5 border border-blue-400/10">
          <p className="text-[7px] font-black uppercase text-blue-400/40">X {t.axisX}</p>
          <p className="text-[12px] font-mono font-bold text-blue-400">{(axisBreakdown.x * 100).toFixed(0)}%</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-pink-500/5 border border-pink-400/10">
          <p className="text-[7px] font-black uppercase text-pink-400/40">Y {t.axisY}</p>
          <p className="text-[12px] font-mono font-bold text-pink-400">{(axisBreakdown.y * 100).toFixed(0)}%</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-amber-500/5 border border-amber-400/10">
          <p className="text-[7px] font-black uppercase text-amber-400/40">Z {t.axisZ}</p>
          <p className="text-[12px] font-mono font-bold text-amber-400">{(axisBreakdown.z * 100).toFixed(0)}%</p>
        </div>
      </div>

      {/* Vector distance */}
      <div className="flex items-center justify-between text-[9px]">
        <span className="text-white/25">{t.vectorDistance}</span>
        <span className="font-mono text-violet-400">{vectorDistance.toFixed(3)}</span>
      </div>

      {/* Matched keyword pills */}
      {matchedKeywords.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {matchedKeywords.slice(0, 8).map((kw) => (
            <span key={kw} className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[8px] font-mono">
              {kw}
            </span>
          ))}
          {matchedKeywords.length > 8 && (
            <span className="px-1.5 py-0.5 text-[8px] text-white/30">+{matchedKeywords.length - 8}</span>
          )}
        </div>
      )}
    </div>
  );
}
