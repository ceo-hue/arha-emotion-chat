
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AnalysisData, ChatSession } from '../types';
import { Terminal, BrainCircuit, Heart, Activity, Zap, Layers } from 'lucide-react';

interface EmotionalDashboardProps {
  analysis: AnalysisData | null;
  moodColor: string;
  allHistory: ChatSession[];
  isAnalyzing: boolean;
  onClose: () => void;
}

const EmotionalDashboard: React.FC<EmotionalDashboardProps> = ({ 
  analysis, allHistory, isAnalyzing
}) => {
  const [logs, setLogs] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const topKeywords = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    const process = (tags?: string[]) => tags?.forEach(t => tagCounts[t] = (tagCounts[t] || 0) + 1);
    allHistory.forEach(s => process(s.tags));
    process(analysis?.tags);
    return Object.entries(tagCounts).sort(([, a], [, b]) => b - a).slice(0, 10);
  }, [allHistory, analysis]);

  // 시스템 로그 고도화: 실제 벡터 연산 과정 노출
  useEffect(() => {
    if (isAnalyzing) {
      const pendingLogs = [
        `>> INITIALIZING_VECTORSCRIPT_V8.2...`,
        `>> CALCULATING_PSI_COORDINATES...`,
        `>> RHYTHM_PHI_ADJUSTING...`
      ];
      setLogs(prev => [...prev.slice(-15), ...pendingLogs]);
    }
  }, [isAnalyzing]);

  useEffect(() => {
    if (analysis) {
      const syncLogs = [
        `>> Ψ_SYNC_SUCCESS: [x:${analysis.psi.x}, y:${analysis.psi.y}, z:${analysis.psi.z}]`,
        `>> Φ_MODE_LOCKED: "${analysis.phi.toUpperCase()}"`,
        `>> RESONANCE_PEAK: ${analysis.resonance}%`
      ];
      setLogs(prev => [...prev.slice(-15), ...syncLogs]);
    }
  }, [analysis]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden text-white bg-transparent">
      <div className="flex-1 flex flex-col p-6 space-y-5 min-h-0 overflow-hidden">
        
        {/* Vector State: 실제 연산 지표 시각화 */}
        <div className="space-y-3 shrink-0">
          <span className="text-[9px] font-black text-emerald-300/40 uppercase tracking-widest pl-1 flex items-center gap-2">
            <Activity size={10} /> VectorScript State
          </span>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Ψ.x (Logic)', val: analysis?.psi.x ?? 0.5 },
              { label: 'Ψ.y (Self)', val: analysis?.psi.y ?? 0.5 },
              { label: 'Ψ.z (Ext)', val: analysis?.psi.z ?? 0.5 }
            ].map((v, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-2 flex flex-col items-center">
                <span className="text-[7px] text-white/40 font-bold mb-1 uppercase tracking-tighter">{v.label}</span>
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-1000 ease-out" 
                    style={{ width: `${v.val * 100}%` }}
                  />
                </div>
                <span className="text-[8px] font-mono text-emerald-400 mt-1">{(v.val).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Keywords */}
        <div className="space-y-3 shrink-0">
          <span className="text-[9px] font-black text-emerald-300/40 uppercase tracking-widest pl-1 flex items-center gap-2">
            <Layers size={10} /> Resonance Keywords
          </span>
          <div className="flex flex-wrap gap-2">
            {topKeywords.length > 0 ? topKeywords.slice(0, 6).map(([tag, count], i) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-emerald-900/40 border border-emerald-500/10 transition-all">
                <span className="text-[9px] font-bold text-emerald-100">#{tag}</span>
                <span className="text-[7px] font-black text-emerald-400/60">{count}</span>
              </div>
            )) : (
              <div className="w-full py-4 flex items-center justify-center border border-dashed border-white/5 rounded-2xl opacity-20 text-[8px] uppercase font-black tracking-widest">
                Scanning Vectors...
              </div>
            )}
          </div>
        </div>

        {/* Insight Box */}
        <div className="flex-1 bg-white/5 border border-white/10 rounded-[2rem] p-6 relative overflow-hidden flex flex-col min-h-0">
          <BrainCircuit className="absolute -bottom-10 -right-10 text-emerald-400/5" size={160} />
          <div className="relative z-10 flex flex-col h-full">
            <span className="text-[10px] font-black text-emerald-300/60 uppercase flex items-center gap-2.5 mb-4 shrink-0">
              <Heart size={14} className="text-emerald-500" /> Insight Projection
            </span>
            <div className="flex-1 overflow-y-auto scroll-hide">
              <p className="text-[13px] leading-relaxed text-white/90 font-medium whitespace-pre-wrap tracking-tight">
                {analysis?.summary || (allHistory.length > 0 ? allHistory[0].report : "사용자의 대화를 통해 감성 벡터를 조율하고 있습니다.")}
              </p>
            </div>
            {analysis && (
              <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <Zap size={12} className="text-emerald-400" />
                  <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Phi Mode: {analysis.phi}</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-500 font-bold">{analysis.resonance}% MATCH</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MONITORING - 실시간 스트리밍 로그 강화 */}
      <div className="h-[160px] p-6 flex flex-col space-y-3 bg-black/40 border-t border-white/5 shrink-0">
        <header className="flex items-center gap-2.5 shrink-0">
          <Terminal size={14} className="text-emerald-500" />
          <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500/60">System Monitoring</h3>
        </header>
        <div ref={scrollRef} className="flex-1 bg-emerald-950/20 rounded-2xl border border-emerald-500/5 p-3 font-mono text-[9px] text-emerald-200/50 overflow-y-auto scroll-hide">
          {logs.map((l, i) => (
            <div key={i} className="flex gap-2 mb-1 opacity-80 animate-in fade-in slide-in-from-left-2 duration-300">
              <span className="text-emerald-500 font-bold shrink-0">{`>`}</span>
              <span className="tracking-tighter">{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmotionalDashboard;
