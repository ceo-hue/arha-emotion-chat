import React from 'react';
import { useI18n } from '../contexts/I18nContext';

interface ConflictGaugeProps {
  value: number;
  matchedKeywords: string[];
  totalExpected: number;
}

export default function ConflictGauge({ value, matchedKeywords, totalExpected }: ConflictGaugeProps) {
  const { t } = useI18n();
  const matchPercent = Math.round((1 - value) * 100);
  const label = value < 0.3 ? t.conflictLow : value < 0.6 ? t.conflictMid : t.conflictHigh;
  const color = value < 0.3 ? 'text-emerald-400' : value < 0.6 ? 'text-amber-400' : 'text-red-400';
  const barColor = value < 0.3 ? 'bg-emerald-500' : value < 0.6 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">{t.conflictIndex}</span>
        <span className={`text-[10px] font-bold ${color}`}>{label}</span>
      </div>

      {/* Bar */}
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
