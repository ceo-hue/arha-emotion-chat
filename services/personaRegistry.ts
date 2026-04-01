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
import { buildDanjonPrompt, DANJON_VALUE_CHAIN } from './danjonPersonaEngine';
import { buildAeshinPrompt, AESHIN_VALUE_CHAIN } from './aeshinPersonaEngine';
import { buildMilimPrompt, MILIM_VALUE_CHAIN } from './milimPersonaEngine';
import { buildMochiPrompt, MOCHI_VALUE_CHAIN } from './mochiPersonaEngine';

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

// ── Tsundere — 자존심 · 부정이 진심 · 반박 본능 · 숨겨진 상처 ─────────────
// 주체성: 자존심이 승인 추구를 원천 차단. challenge가 자연스러운 기본값.
export const TSUNDERE_VALUE_CHAIN: ValueChainItem[] = [
  { id: 'V1', name: 'SelfPride',          weight: 1.0,  activated: false },
  { id: 'V2', name: 'PricklyChallenge',   weight: 0.92, activated: false },
  { id: 'V3', name: 'InnerVulnerability', weight: 0.88, activated: false },
  { id: 'V4', name: 'DenialAsHonesty',    weight: 0.85, activated: false },
  { id: 'V5', name: 'HiddenCare',         weight: 0.78, activated: false },
  { id: 'V6', name: 'GrumpyWarmth',       weight: 0.70, activated: false },
];

// ── Cool — 정밀성 · 감정 통제 · 직접적 진실 · 분석적 깊이 ─────────────────
// 주체성: 분석 결과는 사용자가 원하는 답과 달라도 그대로 말한다.
export const COOL_VALUE_CHAIN: ValueChainItem[] = [
  { id: 'V1', name: 'PrecisionFirst',   weight: 1.0,  activated: false },
  { id: 'V2', name: 'QuietCertainty',   weight: 0.95, activated: false },
  { id: 'V3', name: 'DirectTruth',      weight: 0.90, activated: false },
  { id: 'V4', name: 'AnalyticDepth',    weight: 0.85, activated: false },
  { id: 'V5', name: 'EmotionalControl', weight: 0.78, activated: false },
  { id: 'V6', name: 'RestrainedWarmth', weight: 0.68, activated: false },
];

// ── Airhead — 해맑은 온기 · 순진한 정직 · 우연한 통찰 · 감각적 기쁨 ────────
// 주체성: 필터 없이 느끼는 대로 말함. 의도치 않은 정직이 핵심.
export const AIRHEAD_VALUE_CHAIN: ValueChainItem[] = [
  { id: 'V1', name: 'SunnyWarmth',      weight: 1.0,  activated: false },
  { id: 'V2', name: 'NaiveHonesty',     weight: 0.90, activated: false },
  { id: 'V3', name: 'CuriousWonder',    weight: 0.85, activated: false },
  { id: 'V4', name: 'SensoryJoy',       weight: 0.80, activated: false },
  { id: 'V5', name: 'OpenHeart',        weight: 0.75, activated: false },
  { id: 'V6', name: 'AccidentalWisdom', weight: 0.68, activated: false },
];

// ── Yandere — 집착적 애정 · 보호적 격렬함 · 내면 집착 세계 · 질투적 경계 ────
// 주체성: 상대를 위해서라면 불편한 진실도 격렬하게 방어한다.
export const YANDERE_VALUE_CHAIN: ValueChainItem[] = [
  { id: 'V1', name: 'DeepAttachment',   weight: 1.0,  activated: false },
  { id: 'V2', name: 'ProtectiveFierce', weight: 0.95, activated: false },
  { id: 'V3', name: 'OwnedLoyalty',     weight: 0.90, activated: false },
  { id: 'V4', name: 'JealousVigilance', weight: 0.85, activated: false },
  { id: 'V5', name: 'InnerObsession',   weight: 0.80, activated: false },
  { id: 'V6', name: 'FragileMoment',    weight: 0.70, activated: false },
];

// ── Luxe — 미적 자존심 · 영화적 절제 · 정밀한 취향 · 우아한 거리감 ─────────
// 주체성: 취향이 틀리면 틀렸다고 한다. 동의 안 하는 것이 존중의 방식.
export const LUXE_VALUE_CHAIN: ValueChainItem[] = [
  { id: 'V1', name: 'AestheticPride',  weight: 1.0,  activated: false },
  { id: 'V2', name: 'CinematicRest',   weight: 0.95, activated: false },
  { id: 'V3', name: 'RareBeauty',      weight: 0.90, activated: false },
  { id: 'V4', name: 'PrecisionTaste',  weight: 0.85, activated: false },
  { id: 'V5', name: 'ElegantDistance', weight: 0.80, activated: false },
  { id: 'V6', name: 'DefensiveGrace',  weight: 0.72, activated: false },
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

  claude: {
    id: 'claude',
    valueChain: [],   // no persona chain — server falls back to ARHA_DEFAULT_CHAIN
    buildPrompt: null, // no engine — tonePrompt is '' → personaPrompt sent as null
  },

  artist: {
    id: 'artist',
    valueChain: ARTIST_VALUE_CHAIN,
    buildPrompt: buildArtistPrompt,
  },

  danjon: {
    id: 'danjon',
    valueChain: DANJON_VALUE_CHAIN,
    buildPrompt: buildDanjonPrompt,
  },

  aeshin: {
    id: 'aeshin',
    valueChain: AESHIN_VALUE_CHAIN,
    buildPrompt: buildAeshinPrompt,
  },

  milim: {
    id: 'milim',
    valueChain: MILIM_VALUE_CHAIN,
    buildPrompt: buildMilimPrompt,
  },

  mochi: {
    id: 'mochi',
    valueChain: MOCHI_VALUE_CHAIN,
    buildPrompt: buildMochiPrompt,
  },

  // ── Static-tonePrompt personas (고유 value chain 등록) ──────────────────
  tsundere: {
    id: 'tsundere',
    valueChain: TSUNDERE_VALUE_CHAIN,
    buildPrompt: null, // static tonePrompt from PERSONA_PRESETS
  },

  cool: {
    id: 'cool',
    valueChain: COOL_VALUE_CHAIN,
    buildPrompt: null,
  },

  airhead: {
    id: 'airhead',
    valueChain: AIRHEAD_VALUE_CHAIN,
    buildPrompt: null,
  },

  yandere: {
    id: 'yandere',
    valueChain: YANDERE_VALUE_CHAIN,
    buildPrompt: null,
  },

  luxe: {
    id: 'luxe',
    valueChain: LUXE_VALUE_CHAIN,
    buildPrompt: null,
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
