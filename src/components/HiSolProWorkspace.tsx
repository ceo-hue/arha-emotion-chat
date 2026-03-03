import React, { useMemo, useState } from 'react';
import { Activity, Cpu, Database, LayoutDashboard, Send, X } from 'lucide-react';
import { OrchestrationService } from '../pro-engine/OrchestrationService';
import { MemoryService } from '../pro-engine/MemoryService';

type Tab = 'chat' | 'memory';

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

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userInput = input.trim();
    const userId = `${Date.now()}-u`;
    const assistantId = `${Date.now()}-a`;

    setMessages((prev) => [...prev, { id: userId, role: 'user', content: userInput }, { id: assistantId, role: 'assistant', content: '' }]);
    setInput('');
    setIsLoading(true);

    try {
      const result = await orchestrator.process(userInput, (chunk) => {
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: `${m.content}${chunk}` } : m)));
      });
      setThoughtTrace(result.thoughtTrace ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900 text-white flex flex-col backdrop-blur-xl">
      <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center animate-pulse">
            <Cpu size={20} />
          </div>
          <h1 className="text-lg font-black tracking-tighter">
            HISOL PRO
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full ml-2 border border-emerald-500/30">
              V4.0 ACTIVE
            </span>
          </h1>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all text-slate-400" aria-label="Close PRO workspace">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-20 border-r border-white/10 flex flex-col items-center py-8 gap-4 bg-slate-800/40">
          <button
            onClick={() => setActiveTab('chat')}
            className={`p-4 rounded-2xl transition-all ${activeTab === 'chat' ? 'bg-violet-500/20 text-violet-300 border border-violet-400/40' : 'text-slate-400 hover:bg-white/10'}`}
          >
            <LayoutDashboard size={24} />
          </button>
          <button
            onClick={() => setActiveTab('memory')}
            className={`p-4 rounded-2xl transition-all ${activeTab === 'memory' ? 'bg-violet-500/20 text-violet-300 border border-violet-400/40' : 'text-slate-400 hover:bg-white/10'}`}
          >
            <Database size={24} />
          </button>
        </div>

        <div className="flex-1 flex flex-col relative bg-slate-900/50 min-w-0">
          {activeTab === 'chat' && (
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col p-6 overflow-y-auto overflow-x-hidden">
                <div className="max-w-3xl mx-auto w-full space-y-6">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`p-6 rounded-3xl border ${m.role === 'user' ? 'bg-violet-500/10 border-violet-400/20' : 'bg-white/5 border-white/10'}`}
                    >
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{m.role}</p>
                      <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">{m.content}</p>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="text-center py-10 text-violet-400 animate-pulse font-bold text-xs uppercase tracking-widest">
                      HiSol Orchestrator Reasoning...
                    </div>
                  )}
                </div>
              </div>
              <div className="w-80 border-l border-white/5 bg-black/20 p-8 flex flex-col gap-6 overflow-y-auto">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Activity size={12} /> Agent Trace
                </h3>
                <div className="space-y-4">
                  {thoughtTrace.map((log, i) => (
                    <div key={`${i}-${log.slice(0, 8)}`} className="text-[11px] font-mono text-emerald-400/80 bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10 leading-relaxed">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'memory' && (
            <div className="flex-1 p-10 overflow-y-auto">
              <h2 className="text-3xl font-black mb-8 tracking-tighter">Value Chain Intelligence</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <div className="p-10 rounded-[2rem] bg-gradient-to-br from-violet-600/20 to-indigo-600/10 border border-violet-500/30 flex flex-col gap-4">
                  <p className="text-xs font-black text-violet-400 uppercase tracking-widest">Primary Node</p>
                  <p className="text-2xl font-bold tracking-tight">SECURITY</p>
                  <p className="text-sm text-slate-400">최근 대화에서 핵심 가치로 식별되었습니다.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'chat' && (
        <div className="p-6 border-t border-white/5 bg-slate-800/80 backdrop-blur-md">
          <div className="max-w-4xl mx-auto flex gap-4">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              type="text"
              placeholder="Command HiSol PRO Engine..."
              className="flex-1 bg-white/5 border border-white/10 rounded-3xl px-8 py-4 focus:outline-none focus:ring-2 focus:ring-violet-500 text-white text-sm"
            />
            <button
              onClick={handleSend}
              className="bg-violet-600 px-8 py-4 rounded-3xl font-black hover:bg-violet-500 transition-all flex items-center gap-2 shadow-xl shadow-violet-600/40 active:scale-95"
            >
              <Send size={18} /> SEND
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HiSolProWorkspace;
