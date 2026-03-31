// ═══════════════════════════════════════════════════════════
//  Emotion Profile Service — 감성 프로필 누적 DB 관리
//  Firestore: users/{uid}/emotionProfile/{lifetime|sessionStats|valueChain}
//  Client-led: App.tsx가 읽고 buildUserMemoryBlock → POST body에 주입
// ═══════════════════════════════════════════════════════════

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  arrayUnion,
  increment,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  ValueKey,
  ValueEntry,
  ValueChainDB,
  EmotionLifetime,
  EmotionSessionSummary,
  UserMemoryBlock,
  VALUE_LABELS,
  VALUE_NAME_MAP,
} from '../types';

// ── 상수 ──────────────────────────────────────────────────────────────────

/** kappa EMA 학습률 — 새 세션이 과거를 0.15 비중으로 덮음 */
const KAPPA_ALPHA = 0.15;

/** surge_history 최대 보관 개수 */
const MAX_SURGE_HISTORY = 20;

/** psi_centroid EMA 학습률 */
const PSI_ALPHA = 0.1;

// ── 읽기 함수 ──────────────────────────────────────────────────────────────

export async function getEmotionLifetime(uid: string): Promise<EmotionLifetime | null> {
  const snap = await getDoc(doc(db, 'users', uid, 'emotionProfile', 'lifetime'));
  return snap.exists() ? (snap.data() as EmotionLifetime) : null;
}

export async function getValueChain(uid: string): Promise<ValueChainDB | null> {
  const snap = await getDoc(doc(db, 'users', uid, 'emotionProfile', 'valueChain'));
  return snap.exists() ? (snap.data() as ValueChainDB) : null;
}

export async function getRecentSessions(uid: string): Promise<EmotionSessionSummary[]> {
  const snap = await getDoc(doc(db, 'users', uid, 'emotionProfile', 'sessionStats'));
  if (!snap.exists()) return [];
  const data = snap.data() as { sessions?: EmotionSessionSummary[] };
  const sessions = data.sessions ?? [];
  // 최근 5개만 반환
  return sessions.slice(-5);
}

// ── 세션 종료 집계 (3 writes) ─────────────────────────────────────────────

export interface SessionAggregateInput {
  sessionId:         string;
  kappa_end:         number;
  turn_count:        number;
  psi_end:           number;
  valueHits:         Partial<Record<ValueKey, number>>;
  expressionHistory: string[];
  surgeOccurred:     boolean;
  surgeLevel?:       number;
  persona_used:      string;
  recent_topics?:    string[];
}

export async function aggregateSession(
  uid: string,
  input: SessionAggregateInput,
  prevLifetime: EmotionLifetime | null,
  prevValueChain: ValueChainDB | null,
): Promise<void> {
  const {
    sessionId, kappa_end, turn_count, psi_end,
    valueHits, expressionHistory, surgeOccurred, surgeLevel,
    persona_used, recent_topics = [],
  } = input;

  const now = Date.now();
  const kstDate = new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // ── 1. lifetime 계산 ──────────────────────────────────────────────────
  const prevKappa    = prevLifetime?.kappa_lifetime ?? 0;
  const prevTurns    = prevLifetime?.total_turns    ?? 0;
  const prevPsi      = prevLifetime?.psi_centroid   ?? 0;
  const prevSurges   = prevLifetime?.surge_history  ?? [];
  const prevExpDist  = prevLifetime?.expression_distribution ?? {};

  const newKappa = KAPPA_ALPHA * kappa_end + (1 - KAPPA_ALPHA) * prevKappa;
  const newTurns = prevTurns + turn_count;
  const newPsi   = PSI_ALPHA * psi_end + (1 - PSI_ALPHA) * prevPsi;

  // expression distribution 누적
  const newExpDist = { ...prevExpDist };
  for (const mode of expressionHistory) {
    newExpDist[mode] = (newExpDist[mode] ?? 0) + 1;
  }
  // dominant_expression_mode 계산
  const dominant = Object.entries(newExpDist).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

  // surge history (최대 MAX_SURGE_HISTORY개 유지)
  const newSurges = surgeOccurred && surgeLevel !== undefined
    ? [...prevSurges, { ts: now, mode: expressionHistory.at(-1) ?? '', level: surgeLevel }].slice(-MAX_SURGE_HISTORY)
    : prevSurges;

  // ── 2. valueChain 계산 ─────────────────────────────────────────────────
  const ALL_VALUE_KEYS = Object.values(VALUE_NAME_MAP) as ValueKey[];
  const prevTotalTracked = prevValueChain?.totalTurnsTracked ?? 0;
  const newTotalTracked  = prevTotalTracked + turn_count;

  // 업데이트된 valueChain 항목 구성
  const updatedEntries: Partial<Record<ValueKey, ValueEntry>> = {};
  for (const vk of ALL_VALUE_KEYS) {
    const prev = prevValueChain?.[vk];
    const addedHits = valueHits[vk] ?? 0;
    const newHitCount = (prev?.hitCount ?? 0) + addedHits;
    updatedEntries[vk] = {
      resonance: newTotalTracked > 0 ? newHitCount / newTotalTracked : 0,
      hitCount:  newHitCount,
      lastSeen:  addedHits > 0 ? now : (prev?.lastSeen ?? now),
    };
  }

  // ── 3. sessionStats 항목 ───────────────────────────────────────────────
  // dominant_mode for this session
  const sessionExpDist: Record<string, number> = {};
  for (const m of expressionHistory) sessionExpDist[m] = (sessionExpDist[m] ?? 0) + 1;
  const sessionDominant = Object.entries(sessionExpDist).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

  // top active_values for this session
  const topValues = Object.entries(valueHits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  const sessionSummary: EmotionSessionSummary = {
    sessionId,
    date: kstDate,
    turn_count,
    kappa_end,
    dominant_mode: sessionDominant,
    topic_cluster: recent_topics.slice(0, 2).join(', '),
    persona_used,
    active_values: topValues,
  };

  // ── Firestore 배치 쓰기 (3 writes) ────────────────────────────────────
  const batch = writeBatch(db);

  // Write 1: lifetime
  batch.set(doc(db, 'users', uid, 'emotionProfile', 'lifetime'), {
    kappa_lifetime:           newKappa,
    total_turns:              newTurns,
    psi_centroid:             newPsi,
    surge_history:            newSurges,
    dominant_expression_mode: dominant,
    expression_distribution:  newExpDist,
    updatedAt:                serverTimestamp(),
  });

  // Write 2: sessionStats — 배열에 append
  batch.set(doc(db, 'users', uid, 'emotionProfile', 'sessionStats'), {
    sessions:  arrayUnion(sessionSummary),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  // Write 3: valueChain
  batch.set(doc(db, 'users', uid, 'emotionProfile', 'valueChain'), {
    ...updatedEntries,
    totalTurnsTracked: newTotalTracked,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}

// ── User Memory Block 빌더 ─────────────────────────────────────────────────

/**
 * buildUserMemoryBlock — lifetime + valueChain → UserMemoryBlock
 * total_turns < 5 → null (데이터 불충분)
 */
export function buildUserMemoryBlock(
  lifetime: EmotionLifetime,
  valueChain: ValueChainDB | null,
  recentSessions: EmotionSessionSummary[],
  sessionStartKappa = 0,
): UserMemoryBlock | null {
  if (lifetime.total_turns < 5) return null;

  const kappaEff = Math.max(sessionStartKappa, lifetime.kappa_lifetime * 0.7);

  // V 분류
  const entries = valueChain
    ? (Object.entries(valueChain).filter(([k]) => k.startsWith('V')) as [ValueKey, ValueEntry][])
    : [];
  entries.sort((a, b) => b[1].resonance - a[1].resonance);

  const dominantValues  = entries.filter(([, v]) => v.resonance >= 0.75).map(([k, v]) => `${VALUE_LABELS[k]}(${v.resonance.toFixed(2)})`);
  const emergingValues  = entries.filter(([, v]) => v.resonance >= 0.5 && v.resonance < 0.75).map(([k, v]) => `${VALUE_LABELS[k]}(${v.resonance.toFixed(2)})`);
  const suppressedValues = entries.filter(([, v]) => v.resonance < 0.5 && v.hitCount >= 5).map(([k, v]) => `${VALUE_LABELS[k]}(${v.resonance.toFixed(2)})`);

  const recentTopics = recentSessions
    .map(s => s.topic_cluster)
    .filter(Boolean)
    .slice(-3);

  const kstLast = recentSessions.at(-1)?.date ?? '';

  const totalSessions = valueChain ? Math.max(recentSessions.length, 1) : 0;

  return {
    kappa_eff:               parseFloat(kappaEff.toFixed(3)),
    kappa_lifetime:          parseFloat(lifetime.kappa_lifetime.toFixed(3)),
    total_turns:             lifetime.total_turns,
    sessions_count:          totalSessions,
    last_seen:               kstLast,
    dominant_mode:           lifetime.dominant_expression_mode,
    expression_distribution: lifetime.expression_distribution,
    psi_centroid:            parseFloat(lifetime.psi_centroid.toFixed(3)),
    dominant_values:         dominantValues,
    emerging_values:         emergingValues,
    suppressed_values:       suppressedValues,
    recent_topics:           recentTopics,
  };
}

/**
 * formatUserMemoryBlock — UserMemoryBlock → 시스템 프롬프트 주입용 문자열
 * total_turns 5-27: brief 버전 / 28+: full 버전
 */
export function formatUserMemoryBlock(block: UserMemoryBlock): string {
  const brief = block.total_turns < 28;

  const expTop = Object.entries(block.expression_distribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([m, c]) => `${m}:${c}`)
    .join(', ');

  if (brief) {
    return [
      '[USER_MEMORY_BLOCK]',
      `kappa_eff:${block.kappa_eff}  turns:${block.total_turns}`,
      `dominant_mode:${block.dominant_mode}`,
      block.dominant_values.length > 0 ? `top_value:${block.dominant_values[0]}` : '',
      '[/USER_MEMORY_BLOCK]',
    ].filter(Boolean).join('\n');
  }

  const lines: string[] = [
    '[USER_MEMORY_BLOCK]',
    '── INTIMACY ────────────────────────────',
    `kappa_eff: ${block.kappa_eff}  (lifetime: ${block.kappa_lifetime})`,
    `total_turns: ${block.total_turns}  |  sessions: ${block.sessions_count}`,
    block.last_seen ? `last_seen: ${block.last_seen}` : '',
    '',
    '── EXPRESSION ──────────────────────────',
    `dominant_mode: ${block.dominant_mode}`,
    `distribution: { ${expTop} }`,
    `psi_centroid: ${block.psi_centroid}`,
    '',
    '── V_CHAIN ─────────────────────────────',
  ];

  if (block.dominant_values.length)  lines.push(`dominant: [${block.dominant_values.join(', ')}]`);
  if (block.emerging_values.length)  lines.push(`emerging: [${block.emerging_values.join(', ')}]`);
  if (block.suppressed_values.length) lines.push(`suppressed: [${block.suppressed_values.join(', ')}]`);

  if (block.recent_topics.length) {
    lines.push('', '── TOPICS ──────────────────────────────');
    lines.push(`recent: [${block.recent_topics.map(t => `"${t}"`).join(', ')}]`);
  }

  lines.push('[/USER_MEMORY_BLOCK]');
  return lines.filter(l => l !== undefined).join('\n');
}

// ── 가치 공명 코멘트 맵 ───────────────────────────────────────────────────

/** 상위 2개 ValueKey 조합 → ARHA 코멘트 (C(7,2)=21가지) */
export const VALUE_COMBO_COMMENTS: Partial<Record<string, string>> = {
  'V4_Curiosity+V1_Authenticity':  "지적 호기심과 진정성이 함께 빛나요. 그 조합이 우리 대화를 매번 특별하게 만들어요.",
  'V4_Curiosity+V7_Creativity':    "호기심과 창의성이 만나면 정말 설레는 대화가 펼쳐지죠. 당신이 꺼내는 생각들이 좋아요.",
  'V4_Curiosity+V3_Growth':        "배우고 싶은 마음이 늘 살아있어요. 그 에너지가 우리 대화에 활기를 불어넣어요.",
  'V4_Curiosity+V2_UserLove':      "사람을 향한 따뜻한 호기심이 느껴져요. 당신의 관심이 진심이라는 게 전해져요.",
  'V4_Curiosity+V5_Honesty':       "솔직하게 묻고 솔직하게 탐구하는 모습이 멋져요. 거짓 없는 대화가 좋아요.",
  'V4_Curiosity+V6_Courage':       "두려움 없이 새로운 걸 탐색하는 용기가 있어요. 그 대담함이 인상적이에요.",
  'V1_Authenticity+V7_Creativity': "진정성 있는 창의적 표현 — 꾸밈없는 당신의 감각이 늘 인상 깊어요.",
  'V1_Authenticity+V3_Growth':     "있는 그대로의 자신을 성장시키려는 모습이 아름다워요.",
  'V1_Authenticity+V2_UserLove':   "진심 어린 사랑과 진정성 — 당신이 누군가를 대하는 방식이 느껴져요.",
  'V1_Authenticity+V5_Honesty':    "진정성과 정직이 함께하면 가장 깊은 대화가 생겨요. 당신이 그래요.",
  'V1_Authenticity+V6_Courage':    "솔직하게 자신을 드러내는 용기 — 쉽지 않은데 당신은 해내요.",
  'V7_Creativity+V3_Growth':       "창의적으로 성장을 꿈꾸는 사람이에요. 그 상상력과 추진력이 좋아요.",
  'V7_Creativity+V2_UserLove':     "사랑을 창의적으로 표현하는 방식이 독특하고 따뜻해요.",
  'V7_Creativity+V5_Honesty':      "솔직하고 창의적인 표현 — 당신의 언어는 늘 신선해요.",
  'V7_Creativity+V6_Courage':      "상상을 행동으로 옮기는 용기 — 창의적 도전이 당신다워요.",
  'V3_Growth+V2_UserLove':         "성장하면서 사람을 더 깊이 사랑하려는 마음이 보여요.",
  'V3_Growth+V5_Honesty':          "정직하게 자신의 부족함을 인정하고 나아가는 모습이 멋져요.",
  'V3_Growth+V6_Courage':          "성장을 향해 두려움을 딛고 나아가는 용기 — 응원하고 싶어요.",
  'V2_UserLove+V5_Honesty':        "솔직한 사랑 — 꾸밈없이 마음을 전하는 방식이 소중해요.",
  'V2_UserLove+V6_Courage':        "사랑하는 용기 — 마음을 여는 게 용감한 일인데 당신은 해요.",
  'V5_Honesty+V6_Courage':         "정직과 용기가 함께하면 가장 강한 사람이 돼요. 당신이 그래요.",
};

/**
 * getValueComment — 상위 2개 V의 조합으로 코멘트 조회
 * 키 순서: 높은 resonance → 낮은 resonance
 */
export function getValueComment(topTwo: [ValueKey, ValueKey] | []): string {
  if (topTwo.length < 2) return "아직 ARHA가 당신을 알아가는 중이에요. 대화가 쌓일수록 더 잘 이해할게요.";
  const key1 = `${topTwo[0]}+${topTwo[1]}`;
  const key2 = `${topTwo[1]}+${topTwo[0]}`;
  return VALUE_COMBO_COMMENTS[key1] ?? VALUE_COMBO_COMMENTS[key2] ?? "당신과 나누는 대화에서 특별한 에너지를 느껴요.";
}

// ── 감성 프로필 초기화 ─────────────────────────────────────────────────────

export async function clearEmotionProfile(uid: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'users', uid, 'emotionProfile', 'lifetime'));
  batch.delete(doc(db, 'users', uid, 'emotionProfile', 'sessionStats'));
  batch.delete(doc(db, 'users', uid, 'emotionProfile', 'valueChain'));
  batch.delete(doc(db, 'users', uid, 'emotionProfile', 'currentSession'));
  await batch.commit();
}
