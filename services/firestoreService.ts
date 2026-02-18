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
  character: string;
  age: string;
  job: string;
  personality: string;
  values: string;
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
    character:   d.character   ?? '',
    age:         d.age         ?? '',
    job:         d.job         ?? '',
    personality: d.personality ?? '',
    values:      d.values      ?? '',
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
