import React, { useMemo, useState } from 'react';
import { Activity, CheckCircle2, CircleDashed, Database, House, LayoutDashboard, Send, X } from 'lucide-react';
import { OrchestrationService } from '../pro-engine/OrchestrationService';
import { MemoryService } from '../pro-engine/MemoryService';

type Tab = 'chat' | 'memory';

type PipelineStep = {
  id: string;
  title: string;
  summary: string;
  done: boolean;
};

interface HiSolProWorkspaceProps {
  onClose: () => void;
  user: { uid?: string } | null;
}

const HiSolProWorkspace: React.FC<HiSolProWorkspaceProps> = ({ onClose, user }) => {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; content: string }>>([]);
  const [thoughtTrace, setThoughtTrace] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const orchestrator = useMemo(() => {
    const memory = new MemoryService(user?.uid);
    return new OrchestrationService(memory);
  }, [user?.uid]);

  const pipelineSteps = useMemo<PipelineStep[]>(() => {
    const defaults: PipelineStep[] = [
      { id: 'C-001', title: 'Emotion Engine', summary: '감정 벡터 분석 대기', done: false },
      { id: 'C-002', title: 'Auto Trigger', summary: '전문가 선택 대기', done: false },
      { id: 'C-003', title: 'Context Manager', summary: '기술 문맥 추출 대기', done: false },
      { id: 'C-004', title: 'Prompt Composer', summary: '전문가 패널 프롬프트 조립 대기', done: false },
      { id: 'C-005', title: 'Orchestrator', summary: '응답 생성 대기', done: false },
    ];

    for (const log of thoughtTrace) {
      const m = log.match(/^(C-\d{3})\s+([^:]+):\s*(.*)$/);
      if (!m) continue;
      const id = m[1];
      const summary = m[3];
      const idx = defaults.findIndex((s) => s.id === id);
      if (idx >= 0) defaults[idx] = { ...defaults[idx], summary, done: true };
    }

    return defaults;
  }, [thoughtTrace]);

  const completedSteps = pipelineSteps.filter((s) => s.done).length;
  const pipelineProgress = Math.round((completedSteps / pipelineSteps.length) * 100);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userInput = input.trim();
    const userId = `${Date.now()}-u`;
    const assistantId = `${Date.now()}-a`;

    setMessages((prev) => [...prev, { id: userId, role: 'user', content: userInput }, { id: assistantId, role: 'assistant', content: '' }]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.filter((m) => m.role === 'user').slice(-5).map((m) => m.content);
      const result = await orchestrator.process(
        userInput,
        (chunk) => {
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: `${m.content}${chunk}` } : m)));
        },
        history,
      );
      setThoughtTrace(result.thoughtTrace ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] text-white bg-slate-950 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.12),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(99,102,241,0.16),transparent_30%),radial-gradient(circle_at_50%_100%,rgba(15,23,42,0.6),transparent_45%)]" />

      <div className="relative h-full flex flex-col backdrop-blur-xl">
        <header className="h-16 px-4 md:px-6 border-b border-white/10 bg-slate-900/70 grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <button
            onClick={onClose}
            className="h-9 px-3 rounded-xl border border-emerald-300/30 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-bold tracking-wide flex items-center gap-1.5"
            aria-label="Back to home"
          >
            <House size={14} />
            HOME
          </button>

          <div className="min-w-0 text-center">
            <h1 className="text-base md:text-lg font-black tracking-tight truncate">HISOL PRO WORKSPACE</h1>
            <p className="text-[10px] md:text-xs text-slate-300/80 truncate">Focus Mode for Deep Technical Conversations</p>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center"
            aria-label="Close PRO workspace"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 min-h-0 flex">
          <aside className="w-16 md:w-20 border-r border-white/10 bg-slate-900/55 flex flex-col items-center py-4 md:py-6 gap-3">
            <button
              onClick={() => setActiveTab('chat')}
              className={`w-11 h-11 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all ${activeTab === 'chat' ? 'bg-violet-500/25 text-violet-200 border border-violet-300/40' : 'text-slate-400 hover:bg-white/10'}`}
            >
              <LayoutDashboard size={20} />
            </button>
            <button
              onClick={() => setActiveTab('memory')}
              className={`w-11 h-11 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all ${activeTab === 'memory' ? 'bg-violet-500/25 text-violet-200 border border-violet-300/40' : 'text-slate-400 hover:bg-white/10'}`}
            >
              <Database size={20} />
            </button>
          </aside>

          <main className="flex-1 min-w-0 bg-slate-900/35">
            {activeTab === 'chat' && (
              <div className="h-full flex flex-col xl:flex-row">
                <section className="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto">
                  <div className="max-w-4xl mx-auto space-y-4 md:space-y-5">
                    {messages.length === 0 && !isLoading && (
                      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
                        <p className="text-sm md:text-base text-slate-200 leading-7">기술 이슈를 입력하면 HiSol PRO가 가치 문맥 기반으로 분석해 답변합니다.</p>
                      </div>
                    )}

                    {messages.map((m) => (
                      <div key={m.id} className={`rounded-3xl border p-5 md:p-6 ${m.role === 'user' ? 'ml-auto max-w-[88%] bg-violet-500/12 border-violet-300/25' : 'max-w-[92%] bg-white/6 border-white/12'}`}>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-bold mb-2">{m.role === 'user' ? 'You' : 'HiSol'}</p>
                        <p className="text-sm md:text-[15px] leading-7 text-slate-100 whitespace-pre-wrap">{m.content || '...'}</p>
                      </div>
                    ))}

                    {isLoading && (
                      <div className="text-center py-6 text-emerald-300 animate-pulse text-xs font-bold tracking-[0.18em] uppercase">
                        Orchestrator Processing
                      </div>
                    )}
                  </div>
                </section>

                <aside className="xl:w-[380px] border-t xl:border-t-0 xl:border-l border-white/10 bg-black/20 p-4 md:p-6 overflow-y-auto">
                  <h3 className="text-[11px] font-black text-slate-300 uppercase tracking-[0.16em] flex items-center gap-2 mb-3">
                    <Activity size={13} /> Pipeline Analysis
                  </h3>

                  <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-3.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300/90 font-bold">Pipeline Progress</span>
                      <span className="text-emerald-300 font-black">{pipelineProgress}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-400 to-violet-400 transition-all duration-500" style={{ width: `${pipelineProgress}%` }} />
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {pipelineSteps.map((step) => (
                      <div key={step.id} className={`rounded-2xl border p-3 ${step.done ? 'border-emerald-400/25 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}>
                        <div className="flex items-center gap-2">
                          {step.done ? (
                            <CheckCircle2 size={14} className="text-emerald-300 shrink-0" />
                          ) : (
                            <CircleDashed size={14} className="text-slate-400 shrink-0" />
                          )}
                          <p className="text-[11px] font-black text-slate-200 tracking-wide">
                            {step.id} {step.title}
                          </p>
                        </div>
                        <p className={`mt-1.5 text-[11px] leading-5 ${step.done ? 'text-emerald-100/90' : 'text-slate-400'}`}>
                          {step.summary}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.16em] mb-2">Raw Trace</p>
                    <div className="space-y-2">
                      {thoughtTrace.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-slate-400">실행 후 단계 로그가 표시됩니다.</div>
                      ) : (
                        thoughtTrace.map((log, i) => (
                          <div key={`${i}-${log.slice(0, 8)}`} className="text-[10px] font-mono leading-5 text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-white/10">
                            {log}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </aside>
              </div>
            )}

            {activeTab === 'memory' && (
              <div className="h-full p-6 md:p-10 overflow-y-auto">
                <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-6">Value Chain Intelligence</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  <div className="rounded-3xl border border-violet-400/30 bg-gradient-to-br from-violet-500/20 to-indigo-500/10 p-6 md:p-8">
                    <p className="text-[11px] font-black text-violet-300 uppercase tracking-[0.16em]">Primary Node</p>
                    <p className="text-2xl font-black mt-3">SECURITY</p>
                    <p className="text-sm text-slate-300 mt-3 leading-6">최근 대화에서 핵심 가치로 식별되었습니다.</p>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>

        {activeTab === 'chat' && (
          <footer className="p-4 md:p-5 border-t border-white/10 bg-slate-900/70 backdrop-blur-xl">
            <div className="max-w-5xl mx-auto flex items-center gap-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSend();
                }}
                type="text"
                placeholder="Command HiSol PRO Engine..."
                className="flex-1 h-12 bg-white/10 border border-white/20 rounded-2xl px-4 md:px-5 focus:outline-none focus:ring-2 focus:ring-violet-400 text-sm md:text-base"
              />
              <button
                onClick={handleSend}
                className="h-12 px-5 md:px-6 rounded-2xl bg-violet-600 hover:bg-violet-500 border border-violet-300/30 text-sm font-black tracking-wide flex items-center gap-2"
              >
                <Send size={16} /> SEND
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
};

export default HiSolProWorkspace;
