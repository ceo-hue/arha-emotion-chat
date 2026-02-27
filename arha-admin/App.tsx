import React, { useState, useMemo, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useI18n } from './contexts/I18nContext';
import AuthGate from './components/AuthGate';
import BlockLibrary from './components/BlockLibrary';
import SkeletonCanvas from './components/SkeletonCanvas';
import LiveOutput from './components/LiveOutput';
import { PERSONA_PRESETS } from './data/personaPresets';
import { ArrowLeft, Globe, Download, LogOut, FlaskConical, Loader2 } from 'lucide-react';
import type { EssenceBlock, ActiveEssenceBlock, TestResult, VectorXYZ } from './types';

const ARHA_URL = 'https://arha-감성-벡터.vercel.app';

export default function App() {
  const { user, loading, handleSignOut } = useAuth();
  const { t, lang, setLang } = useI18n();

  // Canvas state
  const [selectedPersonaId, setSelectedPersonaId] = useState('arha');
  const [activeBlocks, setActiveBlocks] = useState<ActiveEssenceBlock[]>([]);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Derived
  const activeBlockIds = useMemo(() => new Set(activeBlocks.map(b => b.id)), [activeBlocks]);

  // Block operations
  const addBlock = useCallback((block: EssenceBlock) => {
    setActiveBlocks(prev => {
      if (prev.some(b => b.id === block.id)) return prev;
      return [...prev, { ...block, vector: { ...block.defaultVector } }];
    });
  }, []);

  const removeBlock = useCallback((id: string) => {
    setActiveBlocks(prev => prev.filter(b => b.id !== id));
  }, []);

  const changeVector = useCallback((id: string, axis: keyof VectorXYZ, value: number) => {
    setActiveBlocks(prev => prev.map(b =>
      b.id === id ? { ...b, vector: { ...b.vector, [axis]: value } } : b
    ));
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
            })),
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

      {/* ── 3-panel body ── */}
      <div className="flex-1 flex min-h-0 gap-1 p-1">
        {/* Panel 1: Block Library */}
        <div className="w-[280px] shrink-0 glass-panel rounded-2xl overflow-hidden hidden lg:flex flex-col">
          <BlockLibrary onAddBlock={addBlock} activeBlockIds={activeBlockIds} />
        </div>

        {/* Panel 2: Skeleton Canvas */}
        <div className="flex-1 glass-panel rounded-2xl overflow-hidden flex flex-col">
          <SkeletonCanvas
            selectedPersonaId={selectedPersonaId}
            onSelectPersona={setSelectedPersonaId}
            activeBlocks={activeBlocks}
            onRemoveBlock={removeBlock}
            onChangeVector={changeVector}
          />
        </div>

        {/* Panel 3: Live Output */}
        <div className="w-[340px] shrink-0 glass-panel rounded-2xl overflow-hidden hidden lg:flex flex-col">
          <LiveOutput
            onTest={runTest}
            testResult={testResult}
            isTesting={isTesting}
          />
        </div>
      </div>
    </div>
  );
}
