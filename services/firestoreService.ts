import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Message, ChatSession, AnalysisData } from '../types';

// ── 타입 ──────────────────────────────────────────────────────────────────

export type PersonaConfig = {
  id: string;
  label: string;
  emoji: string;
  description: string;
  tonePrompt: string;
};

// ── 공통 유틸 ─────────────────────────────────────────────────────────────

// base64 이미지/영상 데이터는 Firestore 1MB 제한에 걸리므로 저장 전 제거
function sanitizeMessages(messages: Message[]): Message[] {
  return messages.map((m) => ({
    ...m,
    media: m.media ? { ...m.media, data: undefined } : undefined,
  }));
}

// ── 페르소나 ──────────────────────────────────────────────────────────────

export async function savePersona(userId: string, persona: PersonaConfig): Promise<void> {
  const ref = doc(db, 'users', userId, 'persona', 'config');
  await setDoc(ref, { ...persona, updatedAt: serverTimestamp() });
}

export async function loadPersona(userId: string): Promise<PersonaConfig | null> {
  const ref = doc(db, 'users', userId, 'persona', 'config');
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    id:          d.id          ?? '',
    label:       d.label       ?? '',
    emoji:       d.emoji       ?? '',
    description: d.description ?? '',
    tonePrompt:  d.tonePrompt  ?? '',
  };
}

// ── 자동저장 ──────────────────────────────────────────────────────────────

export async function saveAutosave(
  userId: string,
  messages: Message[],
  analysis: AnalysisData | null,
): Promise<void> {
  const ref = doc(db, 'users', userId, 'autosave', 'current');
  await setDoc(ref, {
    messages: sanitizeMessages(messages),
    analysis,
    updatedAt: serverTimestamp(),
  });
}

export async function loadAutosave(userId: string): Promise<{
  messages: Message[];
  analysis: AnalysisData | null;
} | null> {
  const ref = doc(db, 'users', userId, 'autosave', 'current');
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const d = snap.data();
  return { messages: d.messages ?? [], analysis: d.analysis ?? null };
}

// ── 히스토리 세션 ─────────────────────────────────────────────────────────

export async function addSession(userId: string, session: ChatSession): Promise<void> {
  const ref = doc(db, 'users', userId, 'sessions', session.id);
  await setDoc(ref, {
    ...session,
    messages: sanitizeMessages(session.messages),
  });
}

export async function loadSessions(userId: string): Promise<ChatSession[]> {
  const colRef = collection(db, 'users', userId, 'sessions');
  const q = query(colRef, orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as ChatSession);
}

export async function deleteSession(userId: string, sessionId: string): Promise<void> {
  const ref = doc(db, 'users', userId, 'sessions', sessionId);
  await deleteDoc(ref);
}

export async function clearAllSessions(userId: string): Promise<void> {
  const colRef = collection(db, 'users', userId, 'sessions');
  const snap = await getDocs(colRef);
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

// ── 가치 프로필 ────────────────────────────────────────────────────────────
// 구조: { [keyword]: weight } — 최대 50개, 초과 시 최저 weight 제거

export type ValueProfile = Record<string, number>;

const VALUE_PROFILE_MAX = 50;

export async function loadValueProfile(userId: string): Promise<ValueProfile> {
  const ref = doc(db, 'users', userId, 'valueProfile', 'keywords');
  const snap = await getDoc(ref);
  if (!snap.exists()) return {};
  const data = snap.data();
  // updatedAt 필드 제외하고 키워드만 반환
  const { updatedAt: _u, ...keywords } = data;
  return keywords as ValueProfile;
}

export async function updateValueProfile(
  userId: string,
  newTags: string[],
): Promise<ValueProfile> {
  if (!newTags.length) return {};

  const ref = doc(db, 'users', userId, 'valueProfile', 'keywords');
  const snap = await getDoc(ref);
  const existing: ValueProfile = snap.exists()
    ? (() => { const { updatedAt: _u, ...kw } = snap.data(); return kw as ValueProfile; })()
    : {};

  // 새 태그 weight 누적
  const updated: ValueProfile = { ...existing };
  for (const tag of newTags) {
    updated[tag] = (updated[tag] ?? 0) + 1;
  }

  // 최대 50개 초과 시 weight 낮은 순으로 제거
  const entries = Object.entries(updated);
  if (entries.length > VALUE_PROFILE_MAX) {
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    const trimmed = Object.fromEntries(sorted.slice(0, VALUE_PROFILE_MAX));
    await setDoc(ref, { ...trimmed, updatedAt: serverTimestamp() });
    return trimmed;
  }

  await setDoc(ref, { ...updated, updatedAt: serverTimestamp() });
  return updated;
}

// 상위 N개 키워드 반환 (weight 내림차순)
export function getTopKeywords(profile: ValueProfile, n = 5): Array<{ keyword: string; weight: number }> {
  return Object.entries(profile)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([keyword, weight]) => ({ keyword, weight }));
}
