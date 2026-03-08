import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, UserTier } from '../types';

/**
 * VITE_ADMIN_EMAILS 환경변수에 등록된 이메일은 로그인 시 자동으로 admin 티어 부여.
 * Vercel 환경변수 설정: VITE_ADMIN_EMAILS=you@gmail.com
 * 여러 명: VITE_ADMIN_EMAILS=a@gmail.com,b@gmail.com
 */
const ADMIN_EMAILS: string[] = (import.meta.env.VITE_ADMIN_EMAILS ?? '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

function resolveAdminTier(email: string, currentTier: UserTier): UserTier {
  return ADMIN_EMAILS.includes(email.toLowerCase()) ? 'admin' : currentTier;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid, 'profile', 'info'));
  if (!snap.exists()) return null;
  const d = snap.data();
  const email = d.email ?? '';
  const tier  = resolveAdminTier(email, d.tier ?? 'free');
  return {
    uid,
    tier,
    displayName:          d.displayName         ?? '',
    email,
    photoURL:             d.photoURL,
    stripeCustomerId:     d.stripeCustomerId,
    stripeSubscriptionId: d.stripeSubscriptionId,
    subscriptionStatus:   d.subscriptionStatus,
    billingCycle:         d.billingCycle,
    currentPeriodEnd:     d.currentPeriodEnd,
  };
}

export async function createOrUpdateProfile(
  uid: string,
  data: Partial<Omit<UserProfile, 'uid'>>,
): Promise<void> {
  await setDoc(
    doc(db, 'users', uid, 'profile', 'info'),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/** 로그인 시 profile 보장 — 없으면 생성, admin 이메일이면 tier 강제 동기화 */
export async function ensureProfile(
  uid: string,
  defaults: { displayName: string; email: string; photoURL?: string },
): Promise<UserProfile> {
  const existing = await getUserProfile(uid);

  // admin 이메일인데 tier가 다르면 Firestore에도 동기화
  const resolvedTier = resolveAdminTier(defaults.email, existing?.tier ?? 'free');
  if (existing) {
    if (existing.tier !== resolvedTier) {
      await setDoc(
        doc(db, 'users', uid, 'profile', 'info'),
        { tier: resolvedTier, updatedAt: serverTimestamp() },
        { merge: true },
      );
      return { ...existing, tier: resolvedTier };
    }
    return existing;
  }

  const profile: Omit<UserProfile, 'uid'> = {
    tier: resolvedTier,
    ...defaults,
  };
  await setDoc(doc(db, 'users', uid, 'profile', 'info'), {
    ...profile,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { uid, ...profile };
}

export async function setUserTier(uid: string, tier: UserTier): Promise<void> {
  await setDoc(
    doc(db, 'users', uid, 'profile', 'info'),
    { tier, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
