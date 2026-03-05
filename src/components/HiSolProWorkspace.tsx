import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertCircle, CheckCircle2, ChevronRight, CircleDashed, Database, History, House, Plus, RefreshCcw, Send, Trash2, X } from 'lucide-react';
import { OrchestrationService } from '../pro-engine/OrchestrationService';
import { MemoryService } from '../pro-engine/MemoryService';
import type { SearchResultItem } from '../../types';

type Tab = 'chat' | 'memory';

type ProMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  searchResults?: SearchResultItem[];
};

type ProHistorySession = {
  id: string;
  title: string;
  updatedAt: number;
  messages: ProMessage[];
  thoughtTrace: string[];
};

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
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ProMessage[]>([]);
  const [thoughtTrace, setThoughtTrace] = useState<string[]>([]);
  const [historySessions, setHistorySessions] = useState<ProHistorySession[]>([]);
  const [valueProfile, setValueProfile] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [internetStatus, setInternetStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [searchingQuery, setSearchingQuery] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLElement | null>(null);
  const pendingSearchResultsRef = useRef<SearchResultItem[]>([]);

  const sessionStorageKey = useMemo(() => `hisol-pro:session:${user?.uid || 'guest'}`, [user?.uid]);
  const historyStorageKey = useMemo(() => `hisol-pro:history:${user?.uid || 'guest'}`, [user?.uid]);

  const memory = useMemo(() => new MemoryService(user?.uid), [user?.uid]);
  const orchestrator = useMemo(() => new OrchestrationService(memory), [memory]);

  const loadValueProfile = async () => {
    const profile = await memory.getProfile();
    setValueProfile(profile);
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(sessionStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { messages?: ProMessage[]; thoughtTrace?: string[] };
        setMessages(parsed.messages ?? []);
        setThoughtTrace(parsed.thoughtTrace ?? []);
      } else {
        setMessages([]);
        setThoughtTrace([]);
      }
    } catch {
      setMessages([]);
      setThoughtTrace([]);
    }

    try {
      const rawHistory = localStorage.getItem(historyStorageKey);
      if (rawHistory) {
        const parsed = JSON.parse(rawHistory) as ProHistorySession[];
        setHistorySessions(Array.isArray(parsed) ? parsed : []);
      } else {
        setHistorySessions([]);
      }
    } catch {
      setHistorySessions([]);
    }

    loadValueProfile();
  }, [sessionStorageKey, historyStorageKey]);

  useEffect(() => {
    let mounted = true;
    const checkInternet = async () => {
      try {
        const response = await fetch('/api/internet-status');
        const data = await response.json();
        if (mounted) setInternetStatus(data.available ? 'online' : 'offline');
      } catch {
        if (mounted) setInternetStatus('offline');
      }
    };

    checkInternet();
    const timer = window.setInterval(checkInternet, 60000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(
      sessionStorageKey,
      JSON.stringify({
        messages,
        thoughtTrace,
      }),
    );
  }, [sessionStorageKey, messages, thoughtTrace]);

  useEffect(() => {
    localStorage.setItem(historyStorageKey, JSON.stringify(historySessions));
  }, [historyStorageKey, historySessions]);

  useEffect(() => {
    if (activeTab !== 'chat') return;
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: isLoading ? 'auto' : 'smooth' });
  }, [messages, isLoading, activeTab]);

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

  const valueEntries = useMemo(() => {
    return Object.entries(valueProfile)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
  }, [valueProfile]);

  const completedSteps = pipelineSteps.filter((s) => s.done).length;
  const pipelineProgress = Math.round((completedSteps / pipelineSteps.length) * 100);

  const archiveCurrentSession = () => {
    const userMessages = messages.filter((m) => m.role === 'user');
    if (userMessages.length === 0) return;

    const title = userMessages[0].content.slice(0, 36) || 'PRO Conversation';
    const session: ProHistorySession = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      updatedAt: Date.now(),
      messages,
      thoughtTrace,
    };

    setHistorySessions((prev) => [session, ...prev].slice(0, 30));
  };

  const handleNewChat = () => {
    archiveCurrentSession();
    setMessages([]);
    setThoughtTrace([]);
    setInput('');
    setActiveTab('chat');
  };

  const handleDeleteConversation = () => {
    setMessages([]);
    setThoughtTrace([]);
    localStorage.removeItem(sessionStorageKey);
  };

  const handleLoadHistory = (session: ProHistorySession) => {
    setMessages(session.messages);
    setThoughtTrace(session.thoughtTrace);
    setActiveTab('chat');
    setShowHistoryPanel(false);
  };

  const handleDeleteHistoryItem = (id: string) => {
    setHistorySessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userInput = input.trim();
    const userId = `${Date.now()}-u`;
    const assistantId = `${Date.now()}-a`;

    setMessages((prev) => [...prev, { id: userId, role: 'user', content: userInput }, { id: assistantId, role: 'assistant', content: '' }]);
    setInput('');
    setIsLoading(true);
    setErrorMessage(null);
    setSearchingQuery(null);
    pendingSearchResultsRef.current = [];

    try {
      const history = messages.filter((m) => m.role === 'user').slice(-5).map((m) => m.content);
      const result = await orchestrator.process(
        userInput,
        (chunk) => {
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: `${m.content}${chunk}` } : m)));
        },
        history,
        {
          onSearching: (query) => setSearchingQuery(query),
          onSearchResult: (item) => {
            pendingSearchResultsRef.current = [...pendingSearchResultsRef.current, item];
          },
        },
      );
      setThoughtTrace(result.thoughtTrace ?? []);
      if (pendingSearchResultsRef.current.length > 0) {
        const collected = pendingSearchResultsRef.current;
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, searchResults: collected } : m)));
      }
      await loadValueProfile();
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : 'API connection failed');
    } finally {
      setIsLoading(false);
      setSearchingQuery(null);
      pendingSearchResultsRef.current = [];
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

        <div className="flex-1 min-h-0 flex relative">
          <aside className="w-16 md:w-20 border-r border-white/10 bg-slate-900/55 flex flex-col items-center py-4 md:py-6 gap-3">
            <button
              onClick={() => setShowHistoryPanel((p) => !p)}
              className={`w-11 h-11 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all ${showHistoryPanel ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-300/40' : 'text-slate-400 hover:bg-white/10'}`}
              title="Chat History"
            >
              <History size={20} />
            </button>
          </aside>

          {showHistoryPanel && (
            <>
              <button
                onClick={() => setShowHistoryPanel(false)}
                className="lg:hidden absolute inset-0 z-10 bg-black/55"
                aria-label="Close history panel backdrop"
              />
              <aside className="absolute left-3 right-3 top-3 bottom-3 z-20 rounded-2xl border border-white/15 bg-slate-900/96 p-4 overflow-y-auto lg:static lg:left-auto lg:right-auto lg:top-auto lg:bottom-auto lg:z-auto lg:rounded-none lg:border-0 lg:border-r lg:border-white/10 lg:bg-slate-900/70 lg:w-[320px]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-black text-slate-300 uppercase tracking-[0.16em]">Chat History</h3>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleNewChat}
                    className="h-7 px-2 rounded-lg border border-emerald-300/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-[10px] font-bold text-emerald-200 flex items-center gap-1"
                  >
                    <Plus size={12} /> 새 채팅
                  </button>
                  <button
                    onClick={handleDeleteConversation}
                    className="h-7 px-2 rounded-lg border border-rose-300/30 bg-rose-500/10 hover:bg-rose-500/20 text-[10px] font-bold text-rose-200 flex items-center gap-1"
                  >
                    <Trash2 size={11} /> 대화 삭제
                  </button>
                </div>
              </div>

              {historySessions.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-slate-400">저장된 히스토리가 없습니다.</div>
              ) : (
                <div className="space-y-2.5">
                  {historySessions.map((s) => (
                    <div key={s.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <button onClick={() => handleLoadHistory(s)} className="w-full text-left">
                        <p className="text-[12px] font-bold text-slate-100 truncate">{s.title}</p>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">{new Date(s.updatedAt).toLocaleString()}</span>
                          <ChevronRight size={13} className="text-slate-500" />
                        </div>
                      </button>
                      <button
                        onClick={() => handleDeleteHistoryItem(s.id)}
                        className="mt-2 h-7 px-2 rounded-lg border border-rose-300/30 bg-rose-500/10 hover:bg-rose-500/20 text-[10px] font-bold text-rose-200 flex items-center gap-1"
                      >
                        <Trash2 size={11} /> 삭제
                      </button>
                    </div>
                  ))}
                </div>
              )}
              </aside>
            </>
          )}

          <main className="flex-1 min-w-0 bg-slate-900/35">
            {activeTab === 'chat' && (
              <div className="h-full flex flex-col xl:flex-row">
                <section ref={chatScrollRef} className="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto">
                  <div className="max-w-4xl mx-auto space-y-4 md:space-y-5">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] text-slate-400 flex items-center justify-between gap-2">
                      <span>메시지 {messages.length}개</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black tracking-wider ${
                        internetStatus === 'online'
                          ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-300/30'
                          : internetStatus === 'offline'
                            ? 'bg-rose-500/20 text-rose-200 border border-rose-300/30'
                            : 'bg-slate-500/20 text-slate-200 border border-slate-300/30'
                      }`}>
                        NET {internetStatus.toUpperCase()}
                      </span>
                    </div>

                    {messages.length === 0 && !isLoading && (
                      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
                        <p className="text-sm md:text-base text-slate-200 leading-7">기술 이슈를 입력하면 HiSol PRO가 가치 문맥 기반으로 분석해 답변합니다.</p>
                      </div>
                    )}

                    {messages.map((m) => (
                      <div key={m.id} className={`rounded-3xl border p-5 md:p-6 ${m.role === 'user' ? 'ml-auto max-w-[88%] bg-violet-500/12 border-violet-300/25' : 'max-w-[92%] bg-white/6 border-white/12'}`}>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-bold mb-2">{m.role === 'user' ? 'You' : 'HiSol'}</p>
                        <p className="text-sm md:text-[15px] leading-7 text-slate-100 whitespace-pre-wrap">{m.content || '...'}</p>
                        {m.role === 'assistant' && m.searchResults && m.searchResults.length > 0 && (
                          <div className="mt-3 space-y-2 rounded-2xl border border-sky-300/20 bg-sky-500/10 p-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-200">Search Sources</p>
                            {m.searchResults.map((item, idx) => (
                              <div key={`${m.id}-sr-${idx}`} className="space-y-1.5">
                                <p className="text-[10px] text-sky-100/90 truncate">query: {item.query}</p>
                                {item.urls.slice(0, 3).map((u) => (
                                  <a
                                    key={`${m.id}-url-${u.url}`}
                                    href={u.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block text-[11px] text-sky-200 hover:text-sky-100 underline underline-offset-2 truncate"
                                  >
                                    {u.title || u.url}
                                  </a>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {isLoading && (
                      <div className="space-y-2">
                        <div className="text-center py-2 text-emerald-300 animate-pulse text-xs font-bold tracking-[0.18em] uppercase">
                          Orchestrator Processing
                        </div>
                        {searchingQuery && (
                          <div className="text-center text-[11px] text-sky-200">
                            Web Search: <span className="font-bold">{searchingQuery}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {errorMessage && (
                      <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 p-3 text-[11px] text-rose-100 flex items-start gap-2">
                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                        <span>{errorMessage}</span>
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
                    <div className="mb-4 rounded-2xl border border-violet-400/20 bg-violet-500/8 p-3.5">
                      <div className="flex items-center justify-between mb-2.5">
                        <p className="text-[10px] font-black text-violet-200 uppercase tracking-[0.16em]">Live Value Chain</p>
                        <button
                          onClick={() => setActiveTab('memory')}
                          className="text-[10px] px-2 py-1 rounded-lg border border-violet-300/25 bg-violet-500/15 hover:bg-violet-500/25 text-violet-200 font-bold"
                        >
                          자세히 보기
                        </button>
                      </div>
                      {valueEntries.length === 0 ? (
                        <p className="text-[11px] text-slate-300/70">아직 누적된 가치가 없습니다.</p>
                      ) : (
                        <div className="space-y-2">
                          {valueEntries.slice(0, 6).map(([term, weight], idx) => {
                            const max = valueEntries[0]?.[1] ?? 1;
                            const width = Math.max(12, Math.round((weight / max) * 100));
                            return (
                              <div key={`live-${term}`} className="flex items-center gap-2">
                                <span className="text-[10px] w-4 text-slate-400">{idx + 1}</span>
                                <span className="text-[11px] text-slate-100 w-16 truncate">{term}</span>
                                <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                  <div className="h-full rounded-full bg-gradient-to-r from-violet-300 to-emerald-300" style={{ width: `${width}%` }} />
                                </div>
                                <span className="text-[10px] text-violet-200 font-bold w-6 text-right">{weight}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

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
                <div className="flex items-center justify-between mb-6 gap-3">
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight">Value Chain Intelligence</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('chat')}
                      className="h-9 px-3 rounded-xl border border-emerald-300/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-bold text-emerald-200"
                    >
                      채팅으로
                    </button>
                    <button
                      onClick={loadValueProfile}
                      className="h-9 px-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-200 flex items-center gap-1.5"
                    >
                      <RefreshCcw size={13} /> 새로고침
                    </button>
                  </div>
                </div>

                {valueEntries.length === 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
                    아직 누적된 가치가 없습니다. PRO 대화를 진행하면 가치 체인이 자동 누적됩니다.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {valueEntries.map(([term, weight], index) => (
                      <div key={term} className="rounded-3xl border border-violet-400/30 bg-gradient-to-br from-violet-500/20 to-indigo-500/10 p-6 md:p-8">
                        <p className="text-[11px] font-black text-violet-300 uppercase tracking-[0.16em]">Node #{index + 1}</p>
                        <p className="text-2xl font-black mt-3 break-words">{term}</p>
                        <p className="text-sm text-slate-300 mt-3 leading-6">누적 강도: {weight}</p>
                      </div>
                    ))}
                  </div>
                )}
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


