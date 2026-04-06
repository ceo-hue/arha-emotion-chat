
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AnalysisData, ChatSession } from '../types';
import { Terminal, BrainCircuit, Heart, Activity, Zap, Layers, TrendingUp, Target, Shield, AlertTriangle } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import type { TriVectorField } from '../services/personaRegistry';
import { getTriVectorPullLabel } from '../services/personaRegistry';
import type { AnchorConfig } from '../services/anchorConfig';
import type { TurnFeedbackResult, FeedbackState, FitTrend } from '../services/anchorFeedback';

interface EmotionalDashboardProps {
  analysis: AnalysisData | null;
  moodColor: string;
  allHistory: ChatSession[];
  isAnalyzing: boolean;
  onClose: () => void;
  triVectorField?: TriVectorField;
  anchorConfig?: AnchorConfig;
  /** Phase 4: feedback loop result from last turn */
  feedbackResult?: TurnFeedbackResult | null;
  /** Phase 4: current feedback state */
  feedbackState?: FeedbackState | null;
  /** Phase 4: fit trend analysis */
  fitTrend?: FitTrend;
}

const EmotionalDashboard: React.FC<EmotionalDashboardProps> = ({
  analysis, allHistory, isAnalyzing, triVectorField, anchorConfig, feedbackResult, feedbackState, fitTrend
}) => {
  const { t } = useI18n();
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
      const syncLogs: string[] = [
        `>> Ψ_SYNC_SUCCESS: [x:${analysis.psi.x}, y:${analysis.psi.y}, z:${analysis.psi.z}]`,
        `>> Φ_MODE_LOCKED: "${analysis.phi.toUpperCase()}"`,
        `>> RESONANCE_PEAK: ${analysis.resonance}%`,
      ];
      if (analysis.emotion_label)      syncLogs.push(`>> EMOTION_LABEL: ${analysis.emotion_label.toUpperCase()}`);
      if (analysis.expression_mode)    syncLogs.push(`>> EXPR_MODE: ${analysis.expression_mode}`);
      if (analysis.trajectory)         syncLogs.push(`>> TRAJECTORY: ${analysis.trajectory.toUpperCase()}`);
      if (analysis.delta_psi   !== undefined) syncLogs.push(`>> ∂Ψ/∂t: ${analysis.delta_psi.toFixed(3)} (change_rate)`);
      if (analysis.surge_risk  !== undefined) syncLogs.push(`>> Γ_SURGE_RISK: ${(analysis.surge_risk * 100).toFixed(1)}%`);
      if (analysis.energy_state) syncLogs.push(`>> ENERGY: K=${analysis.energy_state.kinetic.toFixed(2)} P=${analysis.energy_state.potential.toFixed(2)}`);
      if (triVectorField) {
        const { agency, morning, musical, dominant } = triVectorField;
        syncLogs.push(`>> V_AGENCY: sl=${agency.self_love.toFixed(2)} so=${agency.social_love.toFixed(2)} ef=${agency.efficacy.toFixed(2)}`);
        syncLogs.push(`>> V_MORNING: pl=${morning.planfulness.toFixed(2)} br=${morning.brightness.toFixed(2)} ch=${morning.challenge.toFixed(2)}`);
        syncLogs.push(`>> V_MUSICAL: ms=${musical.musical_sense.toFixed(2)} id=${musical.inner_depth.toFixed(2)} eb=${musical.empathy_bond.toFixed(2)}`);
        syncLogs.push(`>> DOMINANT_PULL: ${dominant.key.toUpperCase()}(${(dominant.score * 100).toFixed(0)}) — ${getTriVectorPullLabel(dominant.key)}`);
      }
      setLogs(prev => [...prev.slice(-15), ...syncLogs]);
    }
  }, [analysis]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden text-slate-800 dark:text-white bg-transparent">
      {/* ── 스크롤 가능한 상단 컨텐츠 영역 ── */}
      <div className="flex-1 overflow-y-auto scroll-hide px-5 pt-5 pb-3 flex flex-col gap-4 min-h-0">

        {/* ── Row 1: VectorScript Ψ (3열) + Dynamics 배지 한 줄 ── */}
        <div className="space-y-2">
          <span className="text-[9px] font-black text-emerald-600/60 dark:text-emerald-300/40 uppercase tracking-widest flex items-center gap-2">
            <Activity size={10} /> VectorScript State
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: 'Ψ.x', val: analysis?.psi.x ?? 0.5, color: 'bg-emerald-500' },
              { label: 'Ψ.y', val: analysis?.psi.y ?? 0.5, color: 'bg-emerald-400' },
              { label: 'Ψ.z', val: analysis?.psi.z ?? 0.5, color: 'bg-emerald-300' },
            ].map((v, i) => (
              <div key={i} className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1.5 flex flex-col items-center gap-1">
                <span className="text-[7px] text-slate-500 dark:text-white/40 font-bold uppercase tracking-tighter">{v.label}</span>
                <div className="w-full h-0.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full ${v.color} transition-all duration-1000 ease-out`} style={{ width: `${v.val * 100}%` }} />
                </div>
                <span className="text-[8px] font-mono text-emerald-400">{v.val.toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* 감정/모드 배지 — Ψ 바로 아래 한 줄 */}
          {analysis && (analysis.emotion_label || analysis.expression_mode || analysis.trajectory) && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {analysis.emotion_label && (() => {
                const ec: Record<string, string> = {
                  joy: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
                  sadness: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
                  anger: 'bg-red-500/10 border-red-500/20 text-red-400',
                  anxiety: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
                  neutral: 'bg-white/5 border-white/10 text-white/40',
                  excitement: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
                };
                return <span className={`px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-wide border ${ec[analysis.emotion_label] ?? 'bg-white/5 border-white/10 text-white/40'}`}>{analysis.emotion_label}</span>;
              })()}
              {analysis.expression_mode && (
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[7px] font-black text-emerald-400 uppercase tracking-wide">
                  {analysis.expression_mode.replace(/_/g, ' ')}
                </span>
              )}
              {analysis.trajectory && (() => {
                const tc: Record<string, string> = {
                  escalating: 'bg-red-500/10 border-red-500/20 text-red-400',
                  cooling: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
                  reversal_possible: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
                  stable: 'bg-white/5 border-white/10 text-white/35',
                };
                return <span className={`px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-wide border ${tc[analysis.trajectory] ?? 'bg-white/5 border-white/10 text-white/40'}`}>{analysis.trajectory.replace(/_/g, ' ')}</span>;
              })()}
            </div>
          )}
        </div>

        {/* ── Row 2: Dynamics 수치 — energy + delta/surge를 4열 그리드 ── */}
        {analysis && (analysis.energy_state || analysis.delta_psi !== undefined || analysis.surge_risk !== undefined) && (
          <div className="space-y-2">
            <span className="text-[9px] font-black text-emerald-600/60 dark:text-emerald-300/40 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp size={10} /> Dynamics Engine v2.0
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {analysis.energy_state && ([
                { label: 'Kinetic',   val: analysis.energy_state.kinetic,   color: 'bg-amber-400' },
                { label: 'Potential', val: analysis.energy_state.potential, color: 'bg-violet-400' },
              ] as const).map((e, i) => (
                <div key={i} className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1.5 flex flex-col gap-1">
                  <span className="text-[7px] text-slate-500 dark:text-white/40 font-bold uppercase tracking-tighter">{e.label}</span>
                  <div className="w-full h-0.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full ${e.color} transition-all duration-1000 ease-out`} style={{ width: `${e.val * 100}%` }} />
                  </div>
                  <span className="text-[8px] font-mono text-emerald-400">{e.val.toFixed(2)}</span>
                </div>
              ))}
              {analysis.delta_psi !== undefined && (
                <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1.5 flex flex-col gap-1">
                  <span className="text-[7px] text-slate-500 dark:text-white/40 font-bold uppercase tracking-tighter">∂Ψ/∂t</span>
                  <div className="w-full h-0.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-400 transition-all duration-1000 ease-out" style={{ width: `${analysis.delta_psi * 100}%` }} />
                  </div>
                  <span className="text-[8px] font-mono text-emerald-400">{analysis.delta_psi.toFixed(3)}</span>
                </div>
              )}
              {analysis.surge_risk !== undefined && (
                <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1.5 flex flex-col gap-1">
                  <span className="text-[7px] text-slate-500 dark:text-white/40 font-bold uppercase tracking-tighter">Γ_surge</span>
                  <div className="w-full h-0.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ease-out ${analysis.surge_risk > 0.7 ? 'bg-red-400' : analysis.surge_risk > 0.4 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${analysis.surge_risk * 100}%` }} />
                  </div>
                  <span className="text-[8px] font-mono text-emerald-400">{analysis.surge_risk.toFixed(3)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Row 2.5: Anchor Hierarchy (L0/L1/L2) — v3.1 Prompt Anchor Injection ── */}
        {anchorConfig && (
          <div className="space-y-2">
            <span className="text-[9px] font-black text-emerald-600/60 dark:text-emerald-300/40 uppercase tracking-widest flex items-center gap-2">
              <Target size={10} /> Anchor Hierarchy
              <span className="ml-auto text-[8px] font-mono text-emerald-500/70 normal-case tracking-normal">
                mode:{anchorConfig.mode} · c={anchorConfig.complexity.toFixed(2)}
              </span>
            </span>

            {/* L0 — locked identity */}
            <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg px-2.5 py-1.5">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[8px] font-black text-violet-500 uppercase tracking-wider">L0 · locked · gravity 1.0</span>
                <span className="text-[7px] font-mono text-violet-400/70">drift ≤ {anchorConfig.L0.driftTolerance.toFixed(2)}</span>
              </div>
              <div className="text-[9px] font-bold text-slate-700 dark:text-violet-200/90 mb-0.5">{anchorConfig.L0.identityName}</div>
              <div className="text-[8px] font-mono text-slate-500 dark:text-violet-200/60 leading-snug break-all">
                {anchorConfig.L0.hierarchyNotation}
              </div>
            </div>

            {/* L1 — session main vectors */}
            {anchorConfig.L1_main.length > 0 && (
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-2.5 py-1.5">
                <div className="text-[8px] font-black text-emerald-500 uppercase tracking-wider mb-1">L1 Main · gravity 0.90</div>
                <div className="space-y-0.5">
                  {anchorConfig.L1_main.map((m) => (
                    <div key={m.key} className="flex items-center gap-2">
                      <span className="text-[8px] font-mono text-emerald-400 w-16 shrink-0">{m.key}</span>
                      <div className="flex-1 h-1 bg-emerald-900/20 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 transition-all duration-700" style={{ width: `${m.score * 100}%` }} />
                      </div>
                      <span className="text-[8px] font-mono text-emerald-400 w-8 text-right">{m.score.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* L2 — task sub-dimensions */}
            {anchorConfig.L2_subs.length > 0 && (
              <div className="bg-sky-500/5 border border-sky-500/20 rounded-lg px-2.5 py-1.5">
                <div className="text-[8px] font-black text-sky-500 uppercase tracking-wider mb-1">L2 Sub · gravity 0.75</div>
                <div className="flex flex-wrap gap-1">
                  {anchorConfig.L2_subs.map((s, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20 text-[8px] font-mono text-sky-400">
                      {s.dimension}<span className="text-sky-500/60 ml-1">{s.score.toFixed(2)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* L3 Support — dynamic domain anchors (Phase 2 W5) */}
            {anchorConfig.L3_support && anchorConfig.L3_support.length > 0 && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[8px] font-black text-amber-500 uppercase tracking-wider">L3 Support · gravity 0.60</div>
                  <span className="text-[7px] font-mono text-amber-500/60">mode:{anchorConfig.L3_support[0].mode}</span>
                </div>
                <div className="space-y-1">
                  {anchorConfig.L3_support.map((l, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="px-1 py-0.5 rounded bg-amber-500/15 border border-amber-500/20 text-[7px] font-mono text-amber-400 shrink-0 mt-0.5">
                        {l.domain}
                      </span>
                      <span className="text-[8px] leading-snug text-slate-600 dark:text-amber-100/80 line-clamp-2">
                        {l.text}
                      </span>
                      <span className="text-[7px] font-mono text-amber-500/50 shrink-0 mt-0.5">{l.score.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Row 2.8: Feedback Loop (Phase 4 — Closed-Loop Anchor Correction) ── */}
        {feedbackResult && (
          <div className="space-y-2">
            <span className="text-[9px] font-black text-rose-600/60 dark:text-rose-300/40 uppercase tracking-widest flex items-center gap-2">
              <Shield size={10} /> Anchor Feedback Loop
              {feedbackState && (
                <span className="text-[7px] font-mono text-rose-400/60 ml-auto">
                  turn #{feedbackState.turnIndex} · corrections: {feedbackState.correctionCount}
                </span>
              )}
            </span>

            {/* Fit Score Bar */}
            <div className="bg-slate-500/5 border border-slate-500/20 rounded-lg px-2.5 py-2">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Anchor Fit Score</div>
                <span className={`text-[10px] font-mono font-bold ${
                  feedbackResult.evaluation.overallFit >= 0.65 ? 'text-emerald-400' :
                  feedbackResult.evaluation.overallFit >= 0.50 ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {feedbackResult.evaluation.overallFit.toFixed(3)}
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-1.5 bg-slate-700/30 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    feedbackResult.evaluation.overallFit >= 0.65 ? 'bg-emerald-400' :
                    feedbackResult.evaluation.overallFit >= 0.50 ? 'bg-amber-400' : 'bg-rose-400'
                  }`}
                  style={{ width: `${Math.min(100, feedbackResult.evaluation.overallFit * 100)}%` }}
                />
              </div>
              {/* Threshold markers */}
              <div className="flex justify-between mt-0.5">
                <span className="text-[6px] text-rose-400/50">0.35</span>
                <span className="text-[6px] text-amber-400/50">0.50</span>
                <span className="text-[6px] text-emerald-400/50">0.65 ✓</span>
              </div>
            </div>

            {/* Drift Guard */}
            {feedbackResult.drift.detected && (
              <div className={`rounded-lg px-2.5 py-1.5 border ${
                feedbackResult.drift.severity >= 3 ? 'bg-rose-500/10 border-rose-500/30' :
                feedbackResult.drift.severity >= 2 ? 'bg-amber-500/10 border-amber-500/30' :
                'bg-yellow-500/5 border-yellow-500/20'
              }`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle size={10} className={
                    feedbackResult.drift.severity >= 3 ? 'text-rose-400' :
                    feedbackResult.drift.severity >= 2 ? 'text-amber-400' : 'text-yellow-400'
                  } />
                  <span className="text-[8px] font-black uppercase tracking-wider text-rose-400">
                    Drift Alert · Severity {feedbackResult.drift.severity}/3
                  </span>
                </div>
                <p className="text-[7px] leading-snug text-slate-400">
                  {feedbackResult.drift.description}
                </p>
              </div>
            )}

            {/* Correction Status */}
            {feedbackResult.correction.type !== 'none' && (
              <div className={`rounded-lg px-2.5 py-1.5 border ${
                feedbackResult.correction.type === 'l0_recovery' ? 'bg-rose-500/10 border-rose-500/30' :
                feedbackResult.correction.type === 'strong_redirect' ? 'bg-amber-500/10 border-amber-500/30' :
                'bg-sky-500/5 border-sky-500/20'
              }`}>
                <div className="text-[8px] font-black uppercase tracking-wider mb-1" style={{
                  color: feedbackResult.correction.type === 'l0_recovery' ? '#f87171' :
                         feedbackResult.correction.type === 'strong_redirect' ? '#fbbf24' : '#38bdf8'
                }}>
                  {feedbackResult.correction.type === 'l0_recovery' ? '🚨 L0 Recovery Active' :
                   feedbackResult.correction.type === 'strong_redirect' ? '⚠️ Strong Redirect' :
                   '💡 Soft Nudge'}
                </div>
                {feedbackResult.correction.emphasize.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {feedbackResult.correction.emphasize.map((dim, i) => (
                      <span key={i} className="px-1 py-0.5 rounded bg-emerald-500/15 text-[7px] font-mono text-emerald-400">
                        ↑ {dim}
                      </span>
                    ))}
                    {feedbackResult.correction.deemphasize.map((dim, i) => (
                      <span key={`d-${i}`} className="px-1 py-0.5 rounded bg-rose-500/15 text-[7px] font-mono text-rose-400">
                        ↓ {dim}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Fit Trend */}
            {fitTrend && fitTrend !== 'insufficient_data' && (
              <div className="flex items-center gap-2 px-2.5 py-1">
                <span className="text-[7px] font-mono text-slate-500">Trend:</span>
                <span className={`text-[8px] font-bold ${
                  fitTrend === 'improving' ? 'text-emerald-400' :
                  fitTrend === 'declining' ? 'text-rose-400' : 'text-slate-400'
                }`}>
                  {fitTrend === 'improving' ? '📈 Improving' :
                   fitTrend === 'declining' ? '📉 Declining' : '➡️ Stable'}
                </span>
                {feedbackState && feedbackState.fitHistory.length > 0 && (
                  <span className="text-[6px] font-mono text-slate-500 ml-auto">
                    [{feedbackState.fitHistory.map(f => f.toFixed(2)).join(' → ')}]
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Row 3: Keywords ── */}
        <div className="space-y-2">
          <span className="text-[9px] font-black text-emerald-600/60 dark:text-emerald-300/40 uppercase tracking-widest flex items-center gap-2">
            <Layers size={10} /> Resonance Keywords
          </span>
          <div className="flex flex-wrap gap-1.5">
            {topKeywords.length > 0 ? topKeywords.slice(0, 8).map(([tag, count], i) => (
              <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-300/30 dark:border-emerald-500/10">
                <span className="text-[8px] font-bold text-emerald-700 dark:text-emerald-100">#{tag}</span>
                <span className="text-[7px] font-black text-emerald-500/60 dark:text-emerald-400/60">{count}</span>
              </div>
            )) : (
              <div className="w-full py-3 flex items-center justify-center border border-dashed border-black/10 dark:border-white/5 rounded-xl opacity-20 text-[8px] uppercase font-black tracking-widest">
                {t.scanningVectors}
              </div>
            )}
          </div>
        </div>

        {/* ── Row 4: Insight Projection (스크롤 영역 안에서 자연스럽게 늘어남) ── */}
        <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-4 relative overflow-hidden">
          <BrainCircuit className="absolute -bottom-8 -right-8 text-emerald-400/5" size={120} />
          <div className="relative z-10">
            <span className="text-[9px] font-black text-emerald-600/80 dark:text-emerald-300/60 uppercase flex items-center gap-2 mb-3">
              <Heart size={12} className="text-emerald-500" /> Insight Projection
            </span>
            <p className="text-[12px] leading-relaxed text-slate-700 dark:text-white/90 font-medium whitespace-pre-wrap tracking-tight">
              {analysis?.summary || (allHistory.length > 0 ? allHistory[0].report : t.insightDefault)}
            </p>
            {analysis && (
              <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <Zap size={11} className="text-emerald-400" />
                  <span className="text-[8px] font-black text-slate-500 dark:text-white/40 uppercase tracking-widest">Phi: {analysis.phi}</span>
                </div>
                <span className="text-[9px] font-mono text-emerald-500 font-bold">{analysis.resonance}% MATCH</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MONITORING - 실시간 스트리밍 로그 강화 */}
      <div className="h-[160px] p-6 flex flex-col space-y-3 bg-slate-900/90 dark:bg-black/40 border-t border-slate-700/30 dark:border-white/5 shrink-0">
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

export default React.memo(EmotionalDashboard);
