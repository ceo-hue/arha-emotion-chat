import { doc, getDoc, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { DailyUsage, UserTier, TIER_LIMITS } from '../types';

const GUEST_KEY = 'arha_guest_usage';

function getKSTDate(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
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

// ── Logged-in (Firestore) ──────────────────────────────────────────────────

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

// ── Common ─────────────────────────────────────────────────────────────────

export function canSendMessage(tier: UserTier, currentCount: number): boolean {
  return currentCount < TIER_LIMITS[tier];
}

export function remainingMessages(tier: UserTier, currentCount: number): number {
  const limit = TIER_LIMITS[tier];
  if (!isFinite(limit)) return Infinity;
  return Math.max(0, limit - currentCount);
}
