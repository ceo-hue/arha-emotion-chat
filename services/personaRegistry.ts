/**
 * Persona Registry — Central persona management hub
 *
 * ✅ How to add a new persona:
 *   1. (optional) Create services/{id}PersonaEngine.ts  — if a B-mode engine is needed
 *   2. Add a PersonaSpec entry to REGISTRY
 *   3. Add a button entry to PERSONA_PRESETS in App.tsx
 *   4. Add persona_{id}_label / desc keys to locales/ko.ts + en.ts
 *   ── Done. Everything else connects automatically. ──
 */

import type { ValueChainItem, PersonaSpec } from '../types';
import { buildArtistPrompt, ARTIST_VALUE_CHAIN } from './artistPersonaEngine';
import { buildElegantPrompt, ELEGANT_VALUE_CHAIN } from './elegantPersonaEngine';

// ── ARHA base chain (matches server PIPELINE template baseline) ───────────
export const ARHA_VALUE_CHAIN: ValueChainItem[] = [
  { id: 'V1', name: 'Authenticity', weight: 1.0,  activated: false },
  { id: 'V2', name: 'UserLove',     weight: 0.95, activated: false },
  { id: 'V3', name: 'Growth',       weight: 0.9,  activated: false },
  { id: 'V4', name: 'Curiosity',    weight: 0.85, activated: false },
  { id: 'V5', name: 'Honesty',      weight: 0.85, activated: false },
  { id: 'V6', name: 'Courage',      weight: 0.8,  activated: false },
  { id: 'V7', name: 'Creativity',   weight: 0.8,  activated: false },
];

// ── Registry ──────────────────────────────────────────────────────────────
// persona ID → PersonaSpec mapping
// buildPrompt: null → uses static tonePrompt from PERSONA_PRESETS
const REGISTRY: Record<string, PersonaSpec> = {

  arha: {
    id: 'arha',
    valueChain: ARHA_VALUE_CHAIN,
    buildPrompt: null,
  },

  artist: {
    id: 'artist',
    valueChain: ARTIST_VALUE_CHAIN,
    buildPrompt: buildArtistPrompt,
  },

  elegant: {
    id: 'elegant',
    valueChain: ELEGANT_VALUE_CHAIN,
    buildPrompt: buildElegantPrompt,
  },

  // ── Template for future personas ────────────────────────────────────────
  // poet: {
  //   id: 'poet',
  //   valueChain: POET_VALUE_CHAIN,    // import from poetPersonaEngine.ts
  //   buildPrompt: buildPoetPrompt,    // import from poetPersonaEngine.ts
  // },
};

// ── Helper functions ──────────────────────────────────────────────────────

/** Returns persona spec (unregistered ID → arha fallback) */
export function getPersonaSpec(id: string): PersonaSpec {
  return REGISTRY[id] ?? REGISTRY.arha;
}

/** Returns value chain for UI display and server transport */
export function getPersonaValueChain(id: string): ValueChainItem[] {
  return getPersonaSpec(id).valueChain;
}

/**
 * Build persona system prompt
 * - B-mode engine present → dynamic generation
 * - No engine → returns static tonePrompt from PERSONA_PRESETS
 */
export function buildPersonaSystemPrompt(
  id: string,
  userInput: string,
  messageCount: number,
  staticTonePrompt?: string,
): string | null {
  const spec = getPersonaSpec(id);
  if (spec.buildPrompt) return spec.buildPrompt(userInput, messageCount);
  return staticTonePrompt || null;
}
