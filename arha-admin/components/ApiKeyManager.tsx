import React, { useState, useEffect, useCallback } from 'react';
import { Key, Plus, Copy, Check, Trash2, RefreshCw, AlertTriangle, X, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ApiKey {
  id: string;
  name: string;
  keyPreview: string;
  isActive: boolean;
  callCount: number;
  dailyLimit: number;
  createdAt: number;
  lastUsed: number | null;
}

interface NewKeyResult {
  id: string;
  key: string;
  name: string;
  dailyLimit: number;
}

export default function ApiKeyManager() {
  const { user } = useAuth();

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDailyLimit, setNewDailyLimit] = useState('100');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Full key shown once after creation
  const [newKeyResult, setNewKeyResult] = useState<NewKeyResult | null>(null);
  const [copiedNewKey, setCopiedNewKey] = useState(false);

  // Per-key copied state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Deactivating
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ── helpers ────────────────────────────────────────────────────────────────
  const getToken = useCallback(async () => {
    if (!user) throw new Error('Not authenticated');
    return user.getIdToken();
  }, [user]);

  const authHeaders = useCallback(async () => {
    const token = await getToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [getToken]);

  // ── load keys ──────────────────────────────────────────────────────────────
  const loadKeys = useCallback(async () => {
    setLoadingKeys(true);
    setFetchError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/arha-keys', { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setKeys(data.keys ?? []);
    } catch (e: any) {
      setFetchError(e.message || 'Failed to load keys');
    } finally {
      setLoadingKeys(false);
    }
  }, [authHeaders]);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  // ── create key ─────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    const name = newName.trim() || 'My API Key';
    const dailyLimit = Math.max(1, Math.min(10000, Number(newDailyLimit) || 100));
    setCreating(true);
    setCreateError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/arha-keys', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, dailyLimit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setNewKeyResult(data);
      setShowCreateForm(false);
      setNewName('');
      setNewDailyLimit('100');
      await loadKeys();
    } catch (e: any) {
      setCreateError(e.message || 'Failed to create key');
    } finally {
      setCreating(false);
    }
  };

  // ── deactivate key ─────────────────────────────────────────────────────────
  const handleDeactivate = async (id: string) => {
    setDeactivatingId(id);
    setConfirmDeleteId(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/arha-keys?id=${id}`, { method: 'DELETE', headers });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      await loadKeys();
    } catch (e: any) {
      alert('Deactivation failed: ' + e.message);
    } finally {
      setDeactivatingId(null);
    }
  };

  // ── copy helpers ──────────────────────────────────────────────────────────
  const copyText = async (text: string, setFn: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setFn(true);
      setTimeout(() => setFn(false), 2000);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setFn(true);
      setTimeout(() => setFn(false), 2000);
    }
  };

  const formatDate = (ts: number | null) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', year: '2-digit' });
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">

      {/* ── Section header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key size={14} className="text-violet-400" />
          <h2 className="text-[12px] font-black text-white/70 uppercase tracking-widest">API Keys</h2>
          <span className="text-[9px] text-white/20 font-mono">{keys.filter(k => k.isActive).length} active</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadKeys}
            disabled={loadingKeys}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/25 hover:text-white/60 hover:bg-white/5 transition-all"
            title="새로고침"
          >
            <RefreshCw size={11} className={loadingKeys ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => { setShowCreateForm(v => !v); setCreateError(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-emerald-300 bg-emerald-500/12 border border-emerald-400/25 hover:bg-emerald-500/20 hover:border-emerald-400/40 transition-all"
          >
            <Plus size={11} />
            새 키 발급
          </button>
        </div>
      </div>

      {/* ── New key revealed banner ── */}
      {newKeyResult && (
        <div className="rounded-2xl bg-emerald-500/8 border border-emerald-400/25 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check size={10} className="text-emerald-400" />
              </div>
              <span className="text-[11px] font-bold text-emerald-300">키가 생성되었습니다</span>
            </div>
            <button onClick={() => setNewKeyResult(null)} className="text-white/20 hover:text-white/50 transition-colors">
              <X size={12} />
            </button>
          </div>
          <p className="text-[9px] text-amber-300/70 flex items-center gap-1.5">
            <AlertTriangle size={9} />
            이 키는 지금만 볼 수 있습니다. 반드시 안전한 곳에 복사해 두세요.
          </p>
          <div className="flex items-center gap-2 bg-black/30 rounded-xl px-3 py-2.5 border border-white/8">
            <code className="flex-1 text-[10px] font-mono text-white/70 break-all select-all">
              {newKeyResult.key}
            </code>
            <button
              onClick={() => copyText(newKeyResult.key, setCopiedNewKey)}
              className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold transition-all ${
                copiedNewKey
                  ? 'bg-emerald-500/20 border border-emerald-400/30 text-emerald-300'
                  : 'bg-white/8 border border-white/15 text-white/50 hover:text-white/80 hover:bg-white/12'
              }`}
            >
              {copiedNewKey ? <Check size={10} /> : <Copy size={10} />}
              {copiedNewKey ? '복사됨' : '복사'}
            </button>
          </div>
          <div className="flex items-center gap-3 text-[9px] text-white/30">
            <span>이름: <span className="text-white/50">{newKeyResult.name}</span></span>
            <span>·</span>
            <span>일일 한도: <span className="text-white/50">{newKeyResult.dailyLimit.toLocaleString()}</span></span>
          </div>
        </div>
      )}

      {/* ── Create form ── */}
      {showCreateForm && (
        <div className="rounded-2xl bg-white/3 border border-white/10 p-4 space-y-3">
          <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">새 API 키 발급</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] text-white/30 uppercase tracking-wider">키 이름</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="My API Key"
                maxLength={50}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-[11px] text-white/70 placeholder:text-white/20 focus:outline-none focus:border-violet-400/40 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-white/30 uppercase tracking-wider">일일 한도 (calls/day)</label>
              <input
                type="number"
                value={newDailyLimit}
                onChange={e => setNewDailyLimit(e.target.value)}
                min={1}
                max={10000}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-[11px] text-white/70 focus:outline-none focus:border-violet-400/40 transition-colors"
              />
            </div>
          </div>
          {createError && (
            <p className="text-[10px] text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{createError}</p>
          )}
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => { setShowCreateForm(false); setCreateError(null); }}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white/30 hover:text-white/50 hover:bg-white/5 transition-all"
            >
              취소
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[10px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-400/30 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {creating ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
              {creating ? '생성 중...' : '키 생성'}
            </button>
          </div>
        </div>
      )}

      {/* ── Error state ── */}
      {fetchError && (
        <div className="flex items-center gap-2 text-[10px] text-red-400 bg-red-500/8 border border-red-400/15 rounded-xl px-4 py-3">
          <AlertTriangle size={11} />
          {fetchError}
        </div>
      )}

      {/* ── Loading state ── */}
      {loadingKeys && !fetchError && (
        <div className="flex items-center justify-center py-10 gap-2 text-white/20">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-[10px]">키 목록 로딩 중...</span>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loadingKeys && !fetchError && keys.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-white/20">
          <Key size={28} strokeWidth={1} />
          <p className="text-[11px]">발급된 API 키가 없습니다</p>
          <p className="text-[9px] text-white/15">위의 "새 키 발급" 버튼으로 생성하세요</p>
        </div>
      )}

      {/* ── Keys list ── */}
      {!loadingKeys && keys.length > 0 && (
        <div className="space-y-2">
          {keys.map(k => (
            <div
              key={k.id}
              className={`rounded-2xl border transition-all ${
                k.isActive
                  ? 'bg-white/3 border-white/8 hover:border-white/12'
                  : 'bg-white/1 border-white/5 opacity-50'
              }`}
            >
              <div className="flex items-start gap-3 p-4">
                {/* Status dot */}
                <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${k.isActive ? 'bg-emerald-400' : 'bg-white/15'}`} />

                {/* Main info */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-white/70">{k.name}</span>
                    {!k.isActive && (
                      <span className="text-[8px] font-black uppercase tracking-widest text-white/25 bg-white/5 px-1.5 py-0.5 rounded">
                        비활성
                      </span>
                    )}
                  </div>

                  {/* Key preview */}
                  <div className="flex items-center gap-2">
                    <code className="text-[10px] font-mono text-white/35 select-all">
                      {k.keyPreview}
                    </code>
                    {k.isActive && (
                      <button
                        onClick={() => copyText(k.keyPreview, v => v && setCopiedId(k.id))}
                        className="text-white/20 hover:text-white/50 transition-colors"
                        title="프리뷰 복사"
                      >
                        {copiedId === k.id ? (
                          <Check size={10} className="text-emerald-400" />
                        ) : (
                          <Copy size={10} />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-3 text-[9px] text-white/25 flex-wrap">
                    {/* Usage bar */}
                    <div className="flex items-center gap-1.5">
                      <span>총 호출</span>
                      <span className="font-mono text-white/40">{k.callCount.toLocaleString()}</span>
                    </div>
                    <span className="text-white/10">·</span>
                    <div className="flex items-center gap-1.5">
                      <span>일일 한도</span>
                      <span className="font-mono text-white/40">{k.dailyLimit.toLocaleString()}</span>
                    </div>
                    <span className="text-white/10">·</span>
                    <div className="flex items-center gap-1.5">
                      <span>생성</span>
                      <span className="font-mono text-white/35">{formatDate(k.createdAt)}</span>
                    </div>
                    {k.lastUsed && (
                      <>
                        <span className="text-white/10">·</span>
                        <div className="flex items-center gap-1.5">
                          <span>마지막 사용</span>
                          <span className="font-mono text-white/35">{formatDate(k.lastUsed)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Deactivate button */}
                {k.isActive && (
                  <div className="shrink-0">
                    {confirmDeleteId === k.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded-lg text-[9px] text-white/30 hover:text-white/50 hover:bg-white/5 transition-all"
                        >
                          취소
                        </button>
                        <button
                          onClick={() => handleDeactivate(k.id)}
                          disabled={deactivatingId === k.id}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold text-red-300 bg-red-500/12 border border-red-400/20 hover:bg-red-500/20 disabled:opacity-40 transition-all"
                        >
                          {deactivatingId === k.id
                            ? <Loader2 size={9} className="animate-spin" />
                            : <Trash2 size={9} />}
                          확인
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(k.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="비활성화"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── API docs hint ── */}
      {keys.length > 0 && (
        <div className="rounded-xl bg-violet-500/5 border border-violet-400/12 px-4 py-3 space-y-2">
          <p className="text-[9px] font-bold text-violet-300/60 uppercase tracking-widest">사용 방법</p>
          <pre className="text-[9px] font-mono text-white/30 leading-relaxed whitespace-pre-wrap break-all select-all">{`POST https://arha-admin.vercel.app/api/arha
X-API-Key: arha_sk_...
Content-Type: application/json

{
  "persona": { "summary": "..." },
  "message": "안녕하세요",
  "blocks": [],   // optional
  "history": []   // optional
}`}</pre>
        </div>
      )}
    </div>
  );
}
