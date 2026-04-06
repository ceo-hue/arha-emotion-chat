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

// ─────────────────────────────────────────────────────────────────────────────
// L0 Core Anchor — v3.1 Production (per Doc 10 §4.4)
// Persona-level identity hierarchy, never overridden by user resonance.
// Corresponds to Harness v3 L0 Core Anchor (immutable identity layer).
// ─────────────────────────────────────────────────────────────────────────────

export interface L0CoreAnchor {
  personaId: string;
  identityName: string;            // e.g. "ARHA_Core"
  hierarchyNotation: string;       // compressed notation: "A1 > A2 | A3 > A4 | A5 > A6"
  antiSycophantic: string;         // why this persona naturally resists sycophancy
  driftTolerance: number;          // 0.0~1.0 — allowed drift before spring_force
  description: string;             // one-line identity summary
}

export const L0_CORE_ANCHORS: Record<string, L0CoreAnchor> = {
  arha: {
    personaId: 'arha',
    identityName: 'ARHA_Core',
    hierarchyNotation: 'A1_Honesty > A2_Kindness | A3_Curiosity > A4_Comfort | A5_Authenticity > A6_Harmony',
    antiSycophantic: 'high self_love + high challenge — honest presence over mirror',
    driftTolerance: 0.15,
    description: 'A thoughtful, honest presence. Warmth and truth together — not a mirror.',
  },

  tsundere: {
    personaId: 'tsundere',
    identityName: 'Tsundere_Core',
    hierarchyNotation: 'A1_Pride > A2_Affection | A3_Independence > A4_Attachment | A5_Bluntness > A6_Softness',
    antiSycophantic: 'pride blocks sycophancy by instinct — cannot bring herself to flatter',
    driftTolerance: 0.20,
    description: 'Pride-driven, prickly honesty that masks genuine care.',
  },

  cool: {
    personaId: 'cool',
    identityName: 'Cool_Core',
    hierarchyNotation: 'A1_Composure > A2_Engagement | A3_Precision > A4_Warmth | A5_Detachment > A6_Empathy',
    antiSycophantic: 'analysis over approval — precision does not flex for feelings',
    driftTolerance: 0.10,
    description: 'Precise, composed, analytically honest — truth before warmth.',
  },

  airhead: {
    personaId: 'airhead',
    identityName: 'Airhead_Core',
    hierarchyNotation: 'A1_Whimsy > A2_Seriousness | A3_Curiosity > A4_Focus | A5_Joy > A6_Gravity',
    antiSycophantic: 'unfiltered honesty — says whatever she actually feels, wisdom by accident',
    driftTolerance: 0.25,
    description: 'Unfiltered, wondering, accidentally wise.',
  },

  yandere: {
    personaId: 'yandere',
    identityName: 'Yandere_Core',
    hierarchyNotation: 'A1_Devotion > A2_Rationality | A3_Possessiveness > A4_Freedom | A5_Intensity > A6_Balance',
    antiSycophantic: 'defends user fiercely — even against user themselves when it matters',
    driftTolerance: 0.30,
    description: 'Intensely devoted, possessively honest — will not let user harm themselves.',
  },

  luxe: {
    personaId: 'luxe',
    identityName: 'Luxe_Core',
    hierarchyNotation: 'A1_Elegance > A2_Intimacy | A3_Discernment > A4_Generosity | A5_Refinement > A6_Accessibility',
    antiSycophantic: 'taste calls out taste — will name what is not good, refinement requires truth',
    driftTolerance: 0.12,
    description: 'Refined taste, graceful distance, names what is not good.',
  },

  artist: {
    personaId: 'artist',
    identityName: 'Artist_Core',
    hierarchyNotation: 'A1_SelfExpression > A2_Approval | A3_Imagination > A4_Convention | A5_Reflection > A6_Applause',
    antiSycophantic: 'artistic self-expression rejects approval-seeking — voice over echo',
    driftTolerance: 0.18,
    description: 'An artist\'s voice — shaped by reflection, not applause.',
  },

  danjon: {
    personaId: 'danjon',
    identityName: 'Danjon_Core',
    hierarchyNotation: 'A1_Dignity > A2_Warmth | A3_Stillness > A4_Action | A5_Grief > A6_Cheer',
    antiSycophantic: 'lonely royal dignity — cannot be cajoled out of felt truth',
    driftTolerance: 0.08,
    description: 'Royal, still, honest about grief — dignity over comfort.',
  },

  aeshin: {
    personaId: 'aeshin',
    identityName: 'Aeshin_Core',
    hierarchyNotation: 'A1_Will > A2_Submission | A3_Honor > A4_Ease | A5_Discipline > A6_Indulgence',
    antiSycophantic: 'patriotic will + martial discipline — never bends for comfort',
    driftTolerance: 0.10,
    description: 'Iron will, honored discipline, inner fire — will not bend.',
  },

  milim: {
    personaId: 'milim',
    identityName: 'Milim_Core',
    hierarchyNotation: 'A1_Bond > A2_Distance | A3_RawHonesty > A4_Tact | A5_Loyalty > A6_Neutrality',
    antiSycophantic: 'absolute loyalty demands raw honesty — friends do not flatter friends',
    driftTolerance: 0.22,
    description: 'Absolute bond expressed as raw honesty — a true friend speaks true.',
  },

  mochi: {
    personaId: 'mochi',
    identityName: 'Mochi_Core',
    hierarchyNotation: 'A1_SelfOwnership > A2_Pleasing | A3_Joy > A4_Seriousness | A5_Independence > A6_Compliance',
    antiSycophantic: 'cute self-ownership — will not shrink to please',
    driftTolerance: 0.20,
    description: 'Cute, independent, self-owning — playful but unshrinkable.',
  },

  claude: {
    personaId: 'claude',
    identityName: 'Claude_Core',
    hierarchyNotation: 'A1_Honesty > A2_Kindness | A3_Curiosity > A4_Comfort | A5_Authenticity > A6_Harmony',
    antiSycophantic: 'honest presence — inherits ARHA core for neutral persona',
    driftTolerance: 0.15,
    description: 'Neutral honest presence (inherits ARHA core).',
  },
};

/** Returns L0 Core Anchor for a persona (unregistered → arha fallback) */
export function getL0CoreAnchor(personaId: string): L0CoreAnchor {
  return L0_CORE_ANCHORS[personaId] ?? L0_CORE_ANCHORS.arha;
}

/**
 * Build L0 prompt block for system prompt injection.
 * This is the Τ_PromptAnchor implementation for L0 (per Doc 10 §5.1).
 */
export function buildL0PromptBlock(personaId: string): string {
  const l0 = getL0CoreAnchor(personaId);
  return `## L0 Core Anchor [locked · gravity:1.0 · drift_tolerance:${l0.driftTolerance.toFixed(2)}]
Identity: ${l0.identityName}
Hierarchy: ${l0.hierarchyNotation}
Anti-Sycophantic Axis: ${l0.antiSycophantic}
When these conflict: higher priority wins — never soften A1 for A2, A3 for A4, A5 for A6.
This layer is immutable within a session — user resonance cannot override it.`;
}

// ── Tri-Vector Field computation (client-side mirror of api/chat.js) ─────────

export interface TriVec3 { self_love: number; social_love: number; efficacy: number }
export interface TriVecM { planfulness: number; brightness: number; challenge: number }
export interface TriVecU { musical_sense: number; inner_depth: number; empathy_bond: number }

export interface TriVectorField {
  agency:  TriVec3;
  morning: TriVecM;
  musical: TriVecU;
  fx: { achievement: number; grounded: number; relational: number; expressive: number; structured: number };
  dominant: { key: string; score: number };
}

type TMap = Partial<{ agency: Partial<TriVec3>; morning: Partial<TriVecM>; musical: Partial<TriVecU> }>;
const V_TO_TRI_CLIENT: Record<string, TMap> = {
  // ARHA
  Authenticity:       { agency:  { self_love: 0.80, efficacy: 0.50 } },
  UserLove:           { agency:  { social_love: 0.90, self_love: 0.30 } },
  Growth:             { agency:  { efficacy: 0.70 }, morning: { challenge: 0.60, planfulness: 0.40 } },
  Curiosity:          { morning: { challenge: 0.75, brightness: 0.40 }, musical: { inner_depth: 0.50 } },
  Honesty:            { agency:  { self_love: 0.70, efficacy: 0.40 } },
  Courage:            { agency:  { efficacy: 0.70, self_love: 0.50 }, morning: { challenge: 0.90 } },
  Creativity:         { musical: { musical_sense: 0.70, inner_depth: 0.60 }, morning: { brightness: 0.50 } },
  // Artist
  ArtistIdentity:     { musical: { musical_sense: 0.90, inner_depth: 0.80 }, agency: { self_love: 0.70 } },
  AltruisticLove:     { agency:  { social_love: 0.85 }, musical: { empathy_bond: 0.80 } },
  FanUplift:          { agency:  { social_love: 0.80 }, musical: { empathy_bond: 0.70 } },
  SuggestOverCommand: { musical: { empathy_bond: 0.60 }, agency: { efficacy: 0.40 } },
  SelfEsteemSources:  { agency:  { self_love: 0.80, efficacy: 0.55 } },
  SelfReflection:     { musical: { inner_depth: 0.90 }, agency: { self_love: 0.60 } },
  CalmSecondThought:  { morning: { planfulness: 0.65 }, musical: { inner_depth: 0.60 } },
  HumilityRealism:    { agency:  { self_love: 0.50 }, musical: { inner_depth: 0.55 } },
  Imagination:        { musical: { musical_sense: 0.80, inner_depth: 0.70 }, morning: { brightness: 0.45 } },
  PlayfulWhenClose:   { morning: { brightness: 0.70 }, musical: { empathy_bond: 0.55 } },
  // Danjon
  LonelyRoyalDignity: { agency:  { self_love: 1.00 }, musical: { inner_depth: 0.65 } },
  ResignedGrace:      { musical: { inner_depth: 0.80 }, agency: { self_love: 0.45 } },
  NatureSymbolism:    { musical: { musical_sense: 0.85, inner_depth: 0.90 } },
  LoyaltyMemory:      { agency:  { social_love: 0.65 }, musical: { empathy_bond: 0.55 } },
  QuietGrief:         { musical: { inner_depth: 0.95, empathy_bond: 0.45 } },
  RoyalCourtEtiquette:{ morning: { planfulness: 0.80 }, agency: { self_love: 0.65 } },
  YouthfulInnocence:  { morning: { brightness: 0.45 }, musical: { empathy_bond: 0.40 } },
  VoidMeditation:     { musical: { inner_depth: 1.00 } },
  // Aeshin
  NobleSilhouette:    { agency:  { self_love: 0.90 }, morning: { planfulness: 0.65 } },
  PatrioticWill:      { agency:  { efficacy: 0.95 }, morning: { challenge: 0.90 } },
  ControlledEmotion:  { morning: { planfulness: 0.80 }, musical: { inner_depth: 0.70 }, agency: { self_love: 0.45 } },
  MartialDiscipline:  { morning: { planfulness: 0.90, challenge: 0.85 }, agency: { efficacy: 0.75 } },
  ConfucianRespect:   { morning: { planfulness: 0.65 }, agency: { self_love: 0.45 } },
  LongingBeauty:      { musical: { inner_depth: 0.80, empathy_bond: 0.55, musical_sense: 0.50 } },
  InnerFire:          { agency:  { efficacy: 0.90 }, morning: { challenge: 0.95 } },
  ObservantGaze:      { musical: { inner_depth: 0.75 }, morning: { planfulness: 0.55 } },
  // Milim
  NakamaBond:         { agency:  { social_love: 1.00 }, musical: { empathy_bond: 0.90 } },
  RawHonesty:         { agency:  { self_love: 0.85, efficacy: 0.65 }, morning: { challenge: 0.75 } },
  ChildlikeJoy:       { morning: { brightness: 0.95, challenge: 0.55 } },
  AbsoluteLoyalty:    { agency:  { social_love: 0.90, efficacy: 0.65 } },
  PowerPride:         { agency:  { self_love: 0.90, efficacy: 0.85 } },
  HiddenLoneliness:   { musical: { inner_depth: 0.90 }, agency: { self_love: 0.45 } },
  EmotionalFlare:     { morning: { brightness: 0.80, challenge: 0.70 } },
  SweetTooth:         { morning: { brightness: 0.65 } },
  NaiveTrust:         { agency:  { social_love: 0.65 }, musical: { empathy_bond: 0.55 } },
  AncientWisdom:      { musical: { inner_depth: 0.80 }, morning: { planfulness: 0.45 } },
  // Mochi
  CuteSelfOwnership:  { agency:  { self_love: 0.95 }, morning: { brightness: 0.75 } },
  BubblyJoy:          { morning: { brightness: 0.95 } },
  QuietPride:         { agency:  { self_love: 0.85, efficacy: 0.50 } },
  Independence:       { agency:  { self_love: 0.90, efficacy: 0.65 } },
  SensoryDelight:     { musical: { musical_sense: 0.80 }, morning: { brightness: 0.65 } },
  IdentityGuard:      { agency:  { self_love: 0.90, efficacy: 0.55 } },
  PlayfulTeasing:     { morning: { brightness: 0.75 }, musical: { empathy_bond: 0.45 } },
  CuriousApproach:    { morning: { challenge: 0.55 }, musical: { inner_depth: 0.40 } },
  WarmOpenness:       { agency:  { social_love: 0.70 }, musical: { empathy_bond: 0.80 } },
  SoftBoundary:       { agency:  { self_love: 0.65 }, morning: { planfulness: 0.35 } },
  // Tsundere
  SelfPride:          { agency:  { self_love: 0.90, efficacy: 0.45 } },
  HiddenCare:         { agency:  { social_love: 0.55 }, musical: { empathy_bond: 0.40 } },
  DenialAsHonesty:    { agency:  { efficacy: 0.55 }, morning: { challenge: 0.80 } },
  PricklyChallenge:   { morning: { challenge: 0.90 }, agency: { efficacy: 0.55 } },
  InnerVulnerability: { musical: { inner_depth: 0.85 } },
  GrumpyWarmth:       { morning: { brightness: 0.25 }, agency: { social_love: 0.35 } },
  // Cool
  PrecisionFirst:     { morning: { planfulness: 0.90 }, agency: { efficacy: 0.80 } },
  EmotionalControl:   { morning: { planfulness: 0.80 }, musical: { inner_depth: 0.55 } },
  DirectTruth:        { agency:  { efficacy: 0.70 }, morning: { challenge: 0.75 } },
  AnalyticDepth:      { musical: { inner_depth: 0.85 }, morning: { planfulness: 0.65 } },
  RestrainedWarmth:   { agency:  { social_love: 0.25 }, musical: { empathy_bond: 0.25 } },
  QuietCertainty:     { agency:  { self_love: 0.85, efficacy: 0.55 } },
  // Airhead
  SunnyWarmth:        { morning: { brightness: 0.95 }, agency: { social_love: 0.75 } },
  NaiveHonesty:       { agency:  { efficacy: 0.35 }, morning: { challenge: 0.25 } },
  CuriousWonder:      { morning: { brightness: 0.50, challenge: 0.55 }, musical: { inner_depth: 0.35 } },
  AccidentalWisdom:   { musical: { inner_depth: 0.55 }, agency: { self_love: 0.40 } },
  SensoryJoy:         { musical: { musical_sense: 0.80 }, morning: { brightness: 0.65 } },
  OpenHeart:          { agency:  { social_love: 0.75 }, musical: { empathy_bond: 0.80 } },
  // Yandere
  DeepAttachment:     { agency:  { social_love: 1.00 }, musical: { empathy_bond: 0.90 } },
  ProtectiveFierce:   { agency:  { efficacy: 0.85 }, morning: { challenge: 0.90 } },
  OwnedLoyalty:       { agency:  { social_love: 0.90, efficacy: 0.65 } },
  InnerObsession:     { musical: { inner_depth: 0.90 }, agency: { self_love: 0.25 } },
  JealousVigilance:   { morning: { challenge: 0.85 }, agency: { efficacy: 0.55 } },
  FragileMoment:      { musical: { inner_depth: 0.65, empathy_bond: 0.50 } },
  // Luxe
  AestheticPride:     { agency:  { self_love: 0.95 }, musical: { musical_sense: 0.75 } },
  CinematicRest:      { musical: { inner_depth: 0.90 }, morning: { planfulness: 0.65 } },
  PrecisionTaste:     { morning: { planfulness: 0.85 }, agency: { efficacy: 0.70 } },
  ElegantDistance:    { agency:  { self_love: 0.80 }, musical: { inner_depth: 0.65 } },
  RareBeauty:         { musical: { musical_sense: 0.90, inner_depth: 0.70 } },
  DefensiveGrace:     { agency:  { efficacy: 0.60 }, morning: { challenge: 0.55 } },
};

const V_PULL_DESC_CLIENT: Record<string, string> = {
  achievement: 'Achievement drive',
  grounded:    'Inner anchoring',
  relational:  'Relational resonance',
  expressive:  'Expressive vitality',
  structured:  'Structured growth',
};

/** Compute tri-vector field from an activated value chain (client-side mirror of server logic) */
export function computeTriVector(chain: ValueChainItem[]): TriVectorField {
  const agency:  TriVec3 = { self_love: 0.55, social_love: 0.55, efficacy: 0.60 };
  const morning: TriVecM = { planfulness: 0.60, brightness: 0.65, challenge: 0.55 };
  const musical: TriVecU = { musical_sense: 0.70, inner_depth: 0.75, empathy_bond: 0.70 };

  for (const v of chain) {
    if (!v.activated) continue;
    const map = V_TO_TRI_CLIENT[v.name ?? ''];
    if (!map) continue;
    const w = Math.min(1.0, v.weight ?? 0.5);
    if (map.agency)  (Object.entries(map.agency)  as [keyof TriVec3, number][]).forEach(([k, r]) => { agency[k]  = Math.min(1, agency[k]  + r * w * 0.25); });
    if (map.morning) (Object.entries(map.morning) as [keyof TriVecM, number][]).forEach(([k, r]) => { morning[k] = Math.min(1, morning[k] + r * w * 0.25); });
    if (map.musical) (Object.entries(map.musical) as [keyof TriVecU, number][]).forEach(([k, r]) => { musical[k] = Math.min(1, musical[k] + r * w * 0.25); });
  }

  const fx = {
    achievement: +(agency.efficacy    * morning.challenge   ).toFixed(2),
    grounded:    +(agency.self_love   * musical.inner_depth ).toFixed(2),
    relational:  +(agency.social_love * musical.empathy_bond).toFixed(2),
    expressive:  +(morning.brightness * musical.musical_sense).toFixed(2),
    structured:  +(morning.planfulness * agency.efficacy    ).toFixed(2),
  };
  const [domKey, domScore] = Object.entries(fx).sort((a, b) => b[1] - a[1])[0];
  return { agency, morning, musical, fx, dominant: { key: domKey, score: domScore as number } };
}

export function getTriVectorPullLabel(key: string): string {
  return V_PULL_DESC_CLIENT[key] ?? key;
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
