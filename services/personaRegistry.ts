/**
 * Persona Registry — 중앙 페르소나 관리 허브
 *
 * ✅ 새 페르소나 추가 방법:
 *   1. (선택) services/{id}PersonaEngine.ts 생성 (B-mode 엔진이 필요한 경우)
 *   2. REGISTRY 에 PersonaSpec 항목 추가
 *   3. App.tsx PERSONA_PRESETS 에 버튼 항목 추가
 *   4. locales/ko.ts + en.ts 에 persona_{id}_label / desc 키 추가
 *   ── 끝. 나머지는 자동으로 연결됩니다. ──
 */

import type { ValueChainItem, PersonaSpec } from '../types';
import { buildArtistPrompt, ARTIST_VALUE_CHAIN } from './artistPersonaEngine';

// ── ARHA 기본 체인 (서버 PIPELINE 템플릿 베이스라인과 동일) ──────────────
export const ARHA_VALUE_CHAIN: ValueChainItem[] = [
  { id: 'V1', name: 'Authenticity', weight: 1.0,  activated: false },
  { id: 'V2', name: 'UserLove',     weight: 0.95, activated: false },
  { id: 'V3', name: 'Growth',       weight: 0.9,  activated: false },
  { id: 'V4', name: 'Curiosity',    weight: 0.85, activated: false },
  { id: 'V5', name: 'Honesty',      weight: 0.85, activated: false },
  { id: 'V6', name: 'Courage',      weight: 0.8,  activated: false },
  { id: 'V7', name: 'Creativity',   weight: 0.8,  activated: false },
];

// ── 레지스트리 ────────────────────────────────────────────────────────────
// 페르소나 ID → PersonaSpec 매핑
// buildPrompt: null → PERSONA_PRESETS 의 정적 tonePrompt 사용
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

  // ── 추후 페르소나 추가 예시 ────────────────────────────────────────────
  // poet: {
  //   id: 'poet',
  //   valueChain: POET_VALUE_CHAIN,       // import from poetPersonaEngine.ts
  //   buildPrompt: buildPoetPrompt,       // import from poetPersonaEngine.ts
  // },
};

// ── 헬퍼 함수 ─────────────────────────────────────────────────────────────

/** 페르소나 스펙 반환 (미등록 ID → arha 폴백) */
export function getPersonaSpec(id: string): PersonaSpec {
  return REGISTRY[id] ?? REGISTRY.arha;
}

/** UI / 서버 전송용 가치 체인 반환 */
export function getPersonaValueChain(id: string): ValueChainItem[] {
  return getPersonaSpec(id).valueChain;
}

/**
 * 페르소나 시스템 프롬프트 빌드
 * - B-mode 엔진이 있으면 동적 생성
 * - 없으면 PERSONA_PRESETS 의 정적 tonePrompt 사용
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
