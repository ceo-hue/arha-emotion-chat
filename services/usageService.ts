import { doc, getDoc, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { DailyUsage, MonthlyUsage, UserTier, TIER_LIMITS, MONTHLY_LIMITS } from '../types';

const GUEST_KEY = 'arha_guest_usage';

function getKSTDate(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function getKSTMonth(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7); // YYYY-MM
}

// ── Guest (localStorage) ───────────────────────────────────────────────────

export function getGuestUsage(): DailyUsage {
  const today = getKSTDate();
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DailyUsage;
      if (parsed.date === today) return parsed;
    }
  } catch {}
  return { date: today, count: 0 };
}

export function incrementGuestUsage(): void {
  const usage = getGuestUsage();
  usage.count += 1;
  localStorage.setItem(GUEST_KEY, JSON.stringify(usage));
}

// ── Daily (Firestore — guest/free) ─────────────────────────────────────────

export async function getDailyUsage(uid: string): Promise<DailyUsage> {
  const today = getKSTDate();
  const snap = await getDoc(doc(db, 'users', uid, 'usage', 'daily'));
  if (snap.exists()) {
    const data = snap.data() as DailyUsage;
    if (data.date === today) return { date: data.date, count: data.count };
  }
  return { date: today, count: 0 };
}

export async function incrementDailyUsage(uid: string): Promise<void> {
  const today = getKSTDate();
  const ref = doc(db, 'users', uid, 'usage', 'daily');
  const snap = await getDoc(ref);
  if (snap.exists() && (snap.data() as DailyUsage).date === today) {
    await setDoc(ref, { count: increment(1), updatedAt: serverTimestamp() }, { merge: true });
  } else {
    await setDoc(ref, { date: today, count: 1, updatedAt: serverTimestamp() });
  }
}

// ── Monthly (Firestore — paid tier) ───────────────────────────────────────

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

// ── Common ─────────────────────────────────────────────────────────────────

/**
 * paid 티어: 월간 한도 체크
 * guest/free 티어: 일일 한도 체크
 */
export function canSendMessage(
  tier: UserTier,
  dailyCount: number,
  monthlyCount = 0,
): boolean {
  if (tier === 'paid') {
    return monthlyCount < MONTHLY_LIMITS[tier];
  }
  return dailyCount < TIER_LIMITS[tier];
}

export function remainingMessages(
  tier: UserTier,
  dailyCount: number,
  monthlyCount = 0,
): number {
  if (tier === 'paid') {
    const limit = MONTHLY_LIMITS[tier];
    return isFinite(limit) ? Math.max(0, limit - monthlyCount) : Infinity;
  }
  const limit = TIER_LIMITS[tier];
  return isFinite(limit) ? Math.max(0, limit - dailyCount) : Infinity;
}
