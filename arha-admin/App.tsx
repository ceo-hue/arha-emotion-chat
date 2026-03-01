import React, { useState, useMemo, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useI18n } from './contexts/I18nContext';
import AuthGate from './components/AuthGate';
import BlockLibrary from './components/BlockLibrary';
import SkeletonCanvas from './components/SkeletonCanvas';
import LiveOutput from './components/LiveOutput';
import SystemPromptModal from './components/SystemPromptModal';
import { PERSONA_PRESETS } from './data/personaPresets';
import { ArrowLeft, Globe, Download, LogOut, FlaskConical, Loader2, Layers, PenTool, Zap, FileText } from 'lucide-react';
import type { EssenceBlock, ActiveEssenceBlock, TestResult, VectorXYZ, BlockRole, OperatorType } from './types';
import { INFLUENCE_MAP, MAX_SUPPORTERS, OPERATOR_CYCLE } from './types';

const ARHA_URL = 'https://arha-emotion-chat.vercel.app';

export default function App() {
  const { user, loading, handleSignOut } = useAuth();
  const { t, lang, setLang } = useI18n();

  // Canvas state
  const [selectedPersonaId, setSelectedPersonaId] = useState('arha');
  const [activeBlocks, setActiveBlocks] = useState<ActiveEssenceBlock[]>([]);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [mobileTab, setMobileTab] = useState<'library' | 'canvas' | 'output'>('canvas');
  const [showPromptModal, setShowPromptModal] = useState(false);

  // Derived
  const activeBlockIds = useMemo(() => new Set(activeBlocks.map(b => b.id)), [activeBlocks]);

  /** 영향력 자동 재계산 */
  const recalcInfluence = (blocks: ActiveEssenceBlock[]): ActiveEssenceBlock[] => {
    const main = blocks.find(b => b.role === 'main');
    const supporters = blocks.filter(b => b.role === 'supporter');
    return blocks.map(b => {
      if (b.role === 'main') {
        return { ...b, influence: INFLUENCE_MAP.main };
      }
      const idx = supporters.indexOf(b);
      const inf = idx < INFLUENCE_MAP.supporter.length
        ? INFLUENCE_MAP.supporter[idx]
        : 0;
      return { ...b, influence: inf };
    });
  };

  // Block operations
  const addBlock = useCallback((block: EssenceBlock) => {
    setActiveBlocks(prev => {
      if (prev.some(b => b.id === block.id)) return prev;
      const hasMain = prev.some(b => b.role === 'main');
      const supporterCount = prev.filter(b => b.role === 'supporter').length;

      // 첫 블록 → main, 이후 → supporter (최대 3개)
      let role: BlockRole;
      if (!hasMain) {
        role = 'main';
      } else if (supporterCount < MAX_SUPPORTERS) {
        role = 'supporter';
      } else {
        return prev; // 최대 블록 수 초과 — 추가 불가
      }

      const next = [...prev, { ...block, vector: { ...block.defaultVector }, role, influence: 0 }];
      return recalcInfluence(next);
    });
  }, []);

  const removeBlock = useCallback((id: string) => {
    setActiveBlocks(prev => {
      const next = prev.filter(b => b.id !== id);
      // 메인이 제거되면 첫 서포터를 승격
      if (!next.some(b => b.role === 'main') && next.length > 0) {
        next[0] = { ...next[0], role: 'main' };
      }
      return recalcInfluence(next);
    });
  }, []);

  const changeVector = useCallback((id: string, axis: keyof VectorXYZ, value: number) => {
    setActiveBlocks(prev => prev.map(b =>
      b.id === id ? { ...b, vector: { ...b.vector, [axis]: value } } : b
    ));
  }, []);

  /** 오퍼레이터 타입 순환 변경 */
  const changeOperator = useCallback((id: string, op: OperatorType) => {
    setActiveBlocks(prev => prev.map(b =>
      b.id === id ? { ...b, operatorType: op } : b
    ));
  }, []);

  /** 블록 역할 변경 (main ↔ supporter) */
  const promoteToMain = useCallback((id: string) => {
    setActiveBlocks(prev => {
      const next = prev.map(b => ({
        ...b,
        role: (b.id === id ? 'main' : 'supporter') as BlockRole,
      }));
      return recalcInfluence(next);
    });
  }, []);

  // Test execution
  const runTest = useCallback(async (testMessage: string) => {
    const persona = PERSONA_PRESETS.find(p => p.id === selectedPersonaId);
    if (!persona) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/test-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basePersonaSummary: persona.tonePromptSummary,
          essenceBlocks: activeBlocks
            .filter(b => b.vector.x + b.vector.y + b.vector.z > 0)
            .map(b => ({
              funcNotation: b.funcNotation,
              interpretX: b.interpretX,
              interpretY: b.interpretY,
              interpretZ: b.interpretZ,
              essenceProperties: b.essenceProperties,
              keywords: b.keywords,
              vector: b.vector,
              role: b.role,
              influence: b.influence,
              operatorType: b.operatorType,
            })),
          personaTriggers: persona.triggers ?? [],
          testMessage,
        }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();

      setTestResult({
        response: data.response,
        conflictIndex: data.conflictIndex,
        vectorDistance: data.vectorDistance ?? 0,
        matchedKeywords: data.matchedKeywords,
        totalExpectedKeywords: data.totalExpectedKeywords,
        axisBreakdown: data.axisBreakdown ?? { x: 0.33, y: 0.33, z: 0.33 },
        activatedTriggers: data.activatedTriggers ?? [],
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error('Test failed:', err);
      setTestResult({
        response: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        conflictIndex: 1.0,
        vectorDistance: 0,
        matchedKeywords: [],
        totalExpectedKeywords: 0,
        axisBreakdown: { x: 0, y: 0, z: 0 },
        activatedTriggers: [],
        timestamp: Date.now(),
      });
    } finally {
      setIsTesting(false);
    }
  }, [selectedPersonaId, activeBlocks]);

  // Export to JSON
  const exportJson = useCallback(() => {
    const data = {
      selectedPersonaId,
      activeBlocks: activeBlocks.map(b => ({
        id: b.id, name: b.name, nameEn: b.nameEn,
        category: b.category,
        funcNotation: b.funcNotation,
        operatorType: b.operatorType,
        role: b.role,
        influence: b.influence,
        vector: b.vector,
        essenceProperties: b.essenceProperties,
        interpretX: b.interpretX,
        interpretY: b.interpretY,
        interpretZ: b.interpretZ,
        keywords: b.keywords,
      })),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `persona-vector-${selectedPersonaId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedPersonaId, activeBlocks]);

  // Auth loading
  if (loading) {
    return (
      <div className="h-[100dvh] w-full bg-black flex items-center justify-center">
        <Loader2 size={24} className="text-violet-400 animate-spin" />
      </div>
    );
  }

  // Auth gate
  if (!user) return <AuthGate />;

  return (
    <div className="h-[100dvh] w-full bg-black text-white flex flex-col">
      {/* ── Header bar ── */}
      <header className="shrink-0 h-12 flex items-center justify-between px-4 border-b border-white/10 glass-panel">
        <div className="flex items-center gap-3">
          <a
            href={ARHA_URL}
            className="flex items-center gap-1.5 text-white/30 hover:text-white/60 text-[10px] transition-colors"
          >
            <ArrowLeft size={12} />
            {t.backToArha}
          </a>
          <div className="w-px h-5 bg-white/10" />
          <FlaskConical size={14} className="text-violet-400" />
          <h1 className="text-[12px] font-bold text-white/80">{t.appTitle}</h1>
          <span className="text-[7px] font-black uppercase tracking-[0.2em] text-violet-400/50 hidden md:inline">
            {t.appSubtitle}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <button
            onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
          >
            <Globe size={10} />
            {lang.toUpperCase()}
          </button>

          {/* System Prompt Generator */}
          <button
            onClick={() => setShowPromptModal(true)}
            disabled={!selectedPersonaId}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-violet-300 bg-violet-500/15 border border-violet-400/30 hover:bg-violet-500/25 hover:border-violet-400/50 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
          >
            <FileText size={11} />
            <span>{t.generatePrompt ?? '프롬프트 생성'}</span>
          </button>

          {/* Export */}
          <button
            onClick={exportJson}
            disabled={activeBlocks.length === 0}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] text-white/30 hover:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
          >
            <Download size={10} />
            {t.exportJson}
          </button>

          {/* User + sign out */}
          <div className="flex items-center gap-2 pl-2 border-l border-white/10">
            <span className="text-[9px] text-white/25 hidden md:inline">{user.email}</span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut size={10} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile tab bar (< lg) ── */}
      <div className="lg:hidden flex items-center gap-1.5 px-2 py-1.5 shrink-0 bg-white/5 border-b border-white/10">
        <button onClick={() => setMobileTab('library')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold tracking-wide transition-all ${mobileTab === 'library' ? 'bg-violet-500/25 text-violet-300 border border-violet-400/40 shadow-lg shadow-violet-500/10' : 'text-white/50 hover:text-white/70 hover:bg-white/5 border border-transparent'}`}>
          <Layers size={13} />
          {t.tabBlocks}
        </button>
        <button onClick={() => setMobileTab('canvas')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold tracking-wide transition-all ${mobileTab === 'canvas' ? 'bg-violet-500/25 text-violet-300 border border-violet-400/40 shadow-lg shadow-violet-500/10' : 'text-white/50 hover:text-white/70 hover:bg-white/5 border border-transparent'}`}>
          <PenTool size={13} />
          {t.tabCanvas}
        </button>
        <button onClick={() => setMobileTab('output')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold tracking-wide transition-all ${mobileTab === 'output' ? 'bg-violet-500/25 text-violet-300 border border-violet-400/40 shadow-lg shadow-violet-500/10' : 'text-white/50 hover:text-white/70 hover:bg-white/5 border border-transparent'}`}>
          <Zap size={13} />
          {t.tabOutput}
        </button>
      </div>

      {/* ── 3-panel body ── */}
      <div className="flex-1 flex min-h-0 gap-1 p-1">
        {/* Panel 1: Block Library */}
        <div className={`w-full lg:w-[280px] shrink-0 glass-panel rounded-2xl overflow-hidden flex-col ${mobileTab === 'library' ? 'flex' : 'hidden lg:flex'}`}>
          <BlockLibrary onAddBlock={addBlock} activeBlockIds={activeBlockIds} />
        </div>

        {/* Panel 2: Skeleton Canvas */}
        <div className={`flex-1 min-w-0 glass-panel rounded-2xl overflow-hidden flex-col ${mobileTab === 'canvas' ? 'flex' : 'hidden lg:flex'}`}>
          <SkeletonCanvas
            selectedPersonaId={selectedPersonaId}
            onSelectPersona={setSelectedPersonaId}
            activeBlocks={activeBlocks}
            onRemoveBlock={removeBlock}
            onChangeVector={changeVector}
            onChangeOperator={changeOperator}
            onPromoteToMain={promoteToMain}
          />
        </div>

        {/* Panel 3: Live Output */}
        <div className={`w-full lg:w-[340px] shrink-0 glass-panel rounded-2xl overflow-hidden flex-col ${mobileTab === 'output' ? 'flex' : 'hidden lg:flex'}`}>
          <LiveOutput
            onTest={runTest}
            testResult={testResult}
            isTesting={isTesting}
          />
        </div>
      </div>

      {/* System Prompt Modal */}
      {showPromptModal && (() => {
        const persona = PERSONA_PRESETS.find(p => p.id === selectedPersonaId);
        return persona ? (
          <SystemPromptModal
            persona={persona}
            activeBlocks={activeBlocks}
            onClose={() => setShowPromptModal(false)}
          />
        ) : null;
      })()}
    </div>
  );
}
