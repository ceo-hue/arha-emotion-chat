import { User } from 'firebase/auth';
import { savePersona, saveAutosave, addSession, loadPersona, loadAutosave } from './firestoreService';
import { ChatSession } from '../types';

// localStorage keys (legacy — used only for one-time migration)
const HISTORY_KEY  = 'arha_chat_history_v1';
const AUTOSAVE_KEY = 'arha_autosave_current';
const PERSONA_KEY  = 'arha_persona_v1';
const MIGRATED_KEY = 'arha_migrated_v1';

/**
 * Runs once on the first login to migrate data from localStorage to Firestore.
 * Guarded by the MIGRATED_KEY flag — subsequent calls are no-ops.
 */
export async function migrateLocalStorageToFirestore(user: User): Promise<void> {
  // Skip if already migrated for this user
  if (localStorage.getItem(MIGRATED_KEY) === user.uid) return;

  const tasks: Promise<void>[] = [];

  // Migrate persona config
  const personaRaw = localStorage.getItem(PERSONA_KEY);
  if (personaRaw) {
    try {
      const persona = JSON.parse(personaRaw);
      const existing = await loadPersona(user.uid);
      if (!existing) tasks.push(savePersona(user.uid, persona));
    } catch {}
  }

  // Migrate autosave snapshot
  const autosaveRaw = localStorage.getItem(AUTOSAVE_KEY);
  if (autosaveRaw) {
    try {
      const { messages, analysis } = JSON.parse(autosaveRaw);
      const existing = await loadAutosave(user.uid);
      if (!existing) tasks.push(saveAutosave(user.uid, messages, analysis));
    } catch {}
  }

  // Migrate chat history sessions
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

  // Mark as migrated so this never runs again for this user
  localStorage.setItem(MIGRATED_KEY, user.uid);
}
