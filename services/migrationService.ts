import { User } from 'firebase/auth';
import { savePersona, saveAutosave, addSession, loadPersona, loadAutosave } from './firestoreService';
import { ChatSession } from '../types';

const HISTORY_KEY  = 'arha_chat_history_v1';
const AUTOSAVE_KEY = 'arha_autosave_current';
const PERSONA_KEY  = 'arha_persona_v1';
const MIGRATED_KEY = 'arha_migrated_v1';

// 최초 로그인 시 localStorage 데이터를 Firestore로 1회 이전
export async function migrateLocalStorageToFirestore(user: User): Promise<void> {
  // 이미 마이그레이션 완료된 경우 skip
  if (localStorage.getItem(MIGRATED_KEY) === user.uid) return;

  const tasks: Promise<void>[] = [];

  // 페르소나
  const personaRaw = localStorage.getItem(PERSONA_KEY);
  if (personaRaw) {
    try {
      const persona = JSON.parse(personaRaw);
      const existing = await loadPersona(user.uid);
      if (!existing) tasks.push(savePersona(user.uid, persona));
    } catch {}
  }

  // 자동저장
  const autosaveRaw = localStorage.getItem(AUTOSAVE_KEY);
  if (autosaveRaw) {
    try {
      const { messages, analysis } = JSON.parse(autosaveRaw);
      const existing = await loadAutosave(user.uid);
      if (!existing) tasks.push(saveAutosave(user.uid, messages, analysis));
    } catch {}
  }

  // 히스토리
  const historyRaw = localStorage.getItem(HISTORY_KEY);
  if (historyRaw) {
    try {
      const sessions: ChatSession[] = JSON.parse(historyRaw);
      for (const session of sessions) {
        tasks.push(addSession(user.uid, session));
      }
    } catch {}
  }

  await Promise.all(tasks);

  // 완료 플래그
  localStorage.setItem(MIGRATED_KEY, user.uid);
}
