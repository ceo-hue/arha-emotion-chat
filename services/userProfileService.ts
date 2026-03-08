import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, UserTier } from '../types';

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid, 'profile', 'info'));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    uid,
    tier:                 d.tier                ?? 'free',
    displayName:          d.displayName         ?? '',
    email:                d.email               ?? '',
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

/** 신규 유저 최초 로그인 시 profile 생성 (tier 기본값 = 'free') */
export async function ensureProfile(
  uid: string,
  defaults: { displayName: string; email: string; photoURL?: string },
): Promise<UserProfile> {
  const existing = await getUserProfile(uid);
  if (existing) return existing;

  const profile: Omit<UserProfile, 'uid'> = {
    tier: 'free',
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
