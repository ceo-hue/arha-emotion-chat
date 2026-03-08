import { doc, getDoc, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { MonthlyUsage, UserTier, MONTHLY_LIMITS } from '../types';

// ── KST helpers ────────────────────────────────────────────────────────────

function getKSTMonth(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7); // YYYY-MM
}

// ── Guest (localStorage — 월간) ────────────────────────────────────────────

const GUEST_KEY = 'arha_guest_monthly';

export function getGuestUsage(): MonthlyUsage {
  const month = getKSTMonth();
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MonthlyUsage;
      if (parsed.month === month) return parsed;
    }
  } catch {}
  return { month, count: 0 };
}

export function incrementGuestUsage(): void {
  const usage = getGuestUsage();
  usage.count += 1;
  localStorage.setItem(GUEST_KEY, JSON.stringify(usage));
}

// ── Monthly (Firestore — 전 로그인 티어 공통) ──────────────────────────────

export async function getMonthlyUsage(uid: string): Promise<MonthlyUsage> {
  const month = getKSTMonth();
  const snap = await getDoc(doc(db, 'users', uid, 'usage', 'monthly'));
  if (snap.exists()) {
    const data = snap.data() as MonthlyUsage;
    if (data.month === month) return { month: data.month, count: data.count };
  }
  return { month, count: 0 };
}

export async function incrementMonthlyUsage(uid: string): Promise<void> {
  const month = getKSTMonth();
  const ref = doc(db, 'users', uid, 'usage', 'monthly');
  const snap = await getDoc(ref);
  if (snap.exists() && (snap.data() as MonthlyUsage).month === month) {
    await setDoc(ref, { count: increment(1), updatedAt: serverTimestamp() }, { merge: true });
  } else {
    await setDoc(ref, { month, count: 1, updatedAt: serverTimestamp() });
  }
}

// ── @deprecated Daily — 하위 호환용 래퍼 (월간으로 위임) ──────────────────

/** @deprecated getMonthlyUsage 사용 */
export async function getDailyUsage(uid: string): Promise<MonthlyUsage> {
  return getMonthlyUsage(uid);
}

/** @deprecated incrementMonthlyUsage 사용 */
export async function incrementDailyUsage(uid: string): Promise<void> {
  return incrementMonthlyUsage(uid);
}

// App.tsx DailyUsage 타입 참조 호환 (MonthlyUsage로 통일)
export type { MonthlyUsage as DailyUsage };

// ── Common ─────────────────────────────────────────────────────────────────

/** 모든 티어: 월간 한도 체크 */
export function canSendMessage(
  tier: UserTier,
  _dailyCount: number,
  monthlyCount = 0,
): boolean {
  if (tier === 'admin') return true;
  return monthlyCount < MONTHLY_LIMITS[tier];
}

export function remainingMessages(
  tier: UserTier,
  _dailyCount: number,
  monthlyCount = 0,
): number {
  if (tier === 'admin') return Infinity;
  const limit = MONTHLY_LIMITS[tier];
  return isFinite(limit) ? Math.max(0, limit - monthlyCount) : Infinity;
}
