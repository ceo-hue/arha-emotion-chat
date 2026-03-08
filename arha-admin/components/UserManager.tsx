import React, { useState, useEffect, useCallback } from 'react';
import { Users, RefreshCw, Loader2, Crown, Shield, User as UserIcon, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type UserTier = 'free' | 'paid' | 'admin';

interface UserRow {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  tier: UserTier;
  dailyCount: number;
  createdAt: number | null;
}

const TIER_OPTIONS: UserTier[] = ['free', 'paid', 'admin'];

const TIER_META: Record<UserTier, { label: string; color: string; icon: React.ReactNode }> = {
  admin: { label: 'Admin', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20', icon: <Shield size={9} /> },
  paid:  { label: 'Pro',   color: 'text-amber-400 bg-amber-400/10 border-amber-400/20',   icon: <Crown size={9} /> },
  free:  { label: 'Free',  color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', icon: <UserIcon size={9} /> },
};

export default function UserManager() {
  const { user } = useAuth();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTier, setFilterTier] = useState<UserTier | 'all'>('all');
  const [search, setSearch] = useState('');
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  const authHeaders = useCallback(async () => {
    if (!user) throw new Error('Not authenticated');
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [user]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/users', { headers });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleTierChange = useCallback(async (targetUid: string, newTier: UserTier) => {
    setUpdatingUid(targetUid);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/users?uid=${encodeURIComponent(targetUid)}&tier=${newTier}`, {
        method: 'PATCH',
        headers,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setUsers(prev => prev.map(u => u.uid === targetUid ? { ...u, tier: newTier } : u));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update tier');
    } finally {
      setUpdatingUid(null);
    }
  }, [authHeaders]);

  const filtered = users.filter(u => {
    if (filterTier !== 'all' && u.tier !== filterTier) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.email.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-violet-400" />
          <h2 className="text-[12px] font-bold text-white/80">Users</h2>
          {!loading && (
            <span className="text-[9px] font-bold text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
              {filtered.length} / {users.length}
            </span>
          )}
        </div>
        <button
          onClick={loadUsers}
          disabled={loading}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] text-white/30 hover:text-white/60 hover:bg-white/5 disabled:opacity-40 transition-all"
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          새로고침
        </button>
      </div>

      {/* Filters */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
        <input
          type="text"
          placeholder="이메일 또는 이름 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[11px] text-white/70 placeholder-white/20 outline-none focus:border-violet-400/40 transition-colors"
        />
        <div className="flex gap-1">
          {(['all', ...TIER_OPTIONS] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterTier(t)}
              className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wide transition-all ${
                filterTier === t
                  ? 'bg-violet-500/25 text-violet-300 border border-violet-400/30'
                  : 'text-white/25 hover:text-white/50 border border-transparent'
              }`}
            >
              {t === 'all' ? 'All' : TIER_META[t].label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-2 text-white/30">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-[11px]">불러오는 중...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-red-400">
            <AlertTriangle size={16} />
            <span className="text-[11px]">{error}</span>
            <button
              onClick={loadUsers}
              className="text-[10px] underline text-red-400/60 hover:text-red-400 transition-colors"
            >
              다시 시도
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-white/20 text-[11px]">
            {search || filterTier !== 'all' ? '검색 결과 없음' : '사용자 없음'}
          </div>
        ) : (
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-white/5 text-white/20 text-[9px] uppercase tracking-widest">
                <th className="px-4 py-2.5 text-left font-bold">User</th>
                <th className="px-3 py-2.5 text-center font-bold w-24">Tier</th>
                <th className="px-3 py-2.5 text-center font-bold w-20">오늘</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const meta = TIER_META[u.tier];
                const isUpdating = updatingUid === u.uid;
                return (
                  <tr key={u.uid} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                    {/* User info */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {u.photoURL ? (
                          <img
                            src={u.photoURL}
                            alt=""
                            className="w-7 h-7 rounded-lg shrink-0 object-cover border border-white/10"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-lg shrink-0 bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                            <span className="text-[10px] font-black text-violet-400">
                              {u.displayName?.[0] ?? u.email?.[0] ?? '?'}
                            </span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-white/70 font-medium truncate">{u.displayName || '—'}</p>
                          <p className="text-white/25 text-[9px] truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Tier dropdown */}
                    <td className="px-3 py-2.5 text-center">
                      {isUpdating ? (
                        <Loader2 size={12} className="animate-spin text-violet-400 mx-auto" />
                      ) : (
                        <select
                          value={u.tier}
                          onChange={e => handleTierChange(u.uid, e.target.value as UserTier)}
                          className={`appearance-none text-center px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide border cursor-pointer transition-all bg-transparent ${meta.color}`}
                        >
                          {TIER_OPTIONS.map(t => (
                            <option key={t} value={t} className="bg-gray-900 text-white normal-case tracking-normal">
                              {TIER_META[t].label}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>

                    {/* Daily count */}
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-[10px] font-bold ${u.dailyCount > 0 ? 'text-white/60' : 'text-white/15'}`}>
                        {u.dailyCount}회
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
