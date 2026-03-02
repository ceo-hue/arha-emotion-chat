import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Plus, Copy, Check, Trash2, RefreshCw, AlertTriangle, X, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface License {
  id: string;
  keyPreview: string;
  name: string;
  email: string;
  tier: 'basic' | 'pro' | 'enterprise';
  isActive: boolean;
  callCount: number;
  dailyLimit: number;
  expiresAt: number | null;
  createdAt: number;
  lastVerified: number | null;
}

interface NewLicenseResult {
  id: string;
  key: string;
  name: string;
  email: string;
  tier: string;
  dailyLimit: number;
  expiresAt: string | null;
}

const TIER_COLORS = {
  basic:      'bg-gray-100 text-gray-700',
  pro:        'bg-blue-100 text-blue-700',
  enterprise: 'bg-purple-100 text-purple-700',
};

const TIER_LIMITS = { basic: 1000, pro: 10000, enterprise: 100000 };

export default function LicenseManager() {
  const { user } = useAuth();

  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoadingKeys] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newTier, setNewTier] = useState<'basic' | 'pro' | 'enterprise'>('basic');
  const [newExpiry, setNewExpiry] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newResult, setNewResult] = useState<NewLicenseResult | null>(null);
  const [copied, setCopied] = useState(false);

  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const getToken = useCallback(async () => {
    if (!user) throw new Error('Not authenticated');
    return user.getIdToken();
  }, [user]);

  const authHeaders = useCallback(async () => {
    const token = await getToken();
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }, [getToken]);

  const loadLicenses = useCallback(async () => {
    setLoadingKeys(true);
    setFetchError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/license/list', { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setLicenses(data.licenses || []);
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoadingKeys(false);
    }
  }, [authHeaders]);

  useEffect(() => { loadLicenses(); }, [loadLicenses]);

  const handleCreate = async () => {
    if (!newName.trim() || !newEmail.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const headers = await authHeaders();
      const body: Record<string, unknown> = {
        name: newName.trim(),
        email: newEmail.trim(),
        tier: newTier,
        dailyLimit: TIER_LIMITS[newTier],
      };
      if (newExpiry) body.expiresAt = new Date(newExpiry).toISOString();

      const res = await fetch('/api/license/issue', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to issue');
      setNewResult(data);
      setNewName('');
      setNewEmail('');
      setNewTier('basic');
      setNewExpiry('');
      setShowForm(false);
      loadLicenses();
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    setDeactivatingId(id);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/license/list?id=${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('Failed to deactivate');
      setConfirmDeleteId(null);
      loadLicenses();
    } catch {
      /* ignore */
    } finally {
      setDeactivatingId(null);
    }
  };

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-purple-500" />
          <h2 className="text-lg font-semibold text-gray-800">Licenses</h2>
          <span className="text-sm text-gray-400">(self-hosted npm 패키지용)</span>
        </div>
        <div className="flex gap-2">
          <button onClick={loadLicenses} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="새로고침">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setShowForm(true); setCreateError(null); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg font-medium"
          >
            <Plus className="w-4 h-4" /> 새 라이선스 발급
          </button>
        </div>
      </div>

      {/* 발급 완료 배너 */}
      {newResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-green-800">라이선스 발급 완료</p>
              <p className="text-sm text-green-600 mt-0.5">이 키는 지금 한 번만 표시됩니다. 반드시 복사하세요.</p>
            </div>
            <button onClick={() => setNewResult(null)} className="text-green-500 hover:text-green-700">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 bg-white border border-green-300 rounded-lg px-3 py-2">
            <code className="flex-1 text-sm font-mono text-gray-800 break-all">{newResult.key}</code>
            <button onClick={() => copyText(newResult.key)} className="shrink-0 text-green-600 hover:text-green-800">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div className="text-xs text-green-700 space-y-0.5">
            <p>수신자: <strong>{newResult.email}</strong></p>
            <p>티어: <strong>{newResult.tier}</strong> / 일일 한도: <strong>{newResult.dailyLimit.toLocaleString()}</strong>회</p>
            {newResult.expiresAt && <p>만료일: <strong>{new Date(newResult.expiresAt).toLocaleDateString('ko-KR')}</strong></p>}
          </div>
        </div>
      )}

      {/* 발급 폼 */}
      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="font-medium text-gray-700">새 라이선스 발급</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">고객명 / 회사명</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                placeholder="예: Acme Corp"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">이메일</label>
              <input
                type="email"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                placeholder="contact@company.com"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">티어</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                value={newTier}
                onChange={e => setNewTier(e.target.value as typeof newTier)}
              >
                <option value="basic">Basic (1,000콜/일)</option>
                <option value="pro">Pro (10,000콜/일)</option>
                <option value="enterprise">Enterprise (100,000콜/일)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">만료일 (선택, 비워두면 영구)</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                value={newExpiry}
                onChange={e => setNewExpiry(e.target.value)}
              />
            </div>
          </div>
          {createError && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertTriangle className="w-4 h-4" />{createError}
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
              취소
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim() || !newEmail.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium"
            >
              {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> 발급 중...</> : '발급'}
            </button>
          </div>
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> 불러오는 중...
        </div>
      ) : fetchError ? (
        <div className="flex items-center gap-2 text-red-500 text-sm py-4">
          <AlertTriangle className="w-4 h-4" />{fetchError}
        </div>
      ) : licenses.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          발급된 라이선스가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {licenses.map(lic => (
            <div key={lic.id} className={`border rounded-xl p-4 ${lic.isActive ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-800 truncate">{lic.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLORS[lic.tier]}`}>
                      {lic.tier}
                    </span>
                    {!lic.isActive && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">비활성</span>
                    )}
                    {lic.expiresAt && Date.now() > lic.expiresAt && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">만료됨</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{lic.email}</p>
                  <code className="text-xs font-mono text-gray-400">{lic.keyPreview}</code>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 mt-1">
                    <span>총 {lic.callCount.toLocaleString()}회 검증</span>
                    <span>일일 한도 {lic.dailyLimit.toLocaleString()}회</span>
                    {lic.expiresAt && (
                      <span>만료 {new Date(lic.expiresAt).toLocaleDateString('ko-KR')}</span>
                    )}
                    {lic.lastVerified && (
                      <span>최근 검증 {new Date(lic.lastVerified).toLocaleDateString('ko-KR')}</span>
                    )}
                  </div>
                </div>
                {lic.isActive && (
                  <div>
                    {confirmDeleteId === lic.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">비활성화?</span>
                        <button
                          onClick={() => handleDeactivate(lic.id)}
                          disabled={deactivatingId === lic.id}
                          className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                        >
                          {deactivatingId === lic.id ? '...' : '확인'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(lic.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                        title="비활성화"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
