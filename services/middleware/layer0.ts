/**
 * Layer 0 — 입력 수용 & 전처리 (결정론적)
 * Φ_Normalize → Δ_InputClassify → Ξ_context_influence → Ψ_AmbiguityTag
 */

import type {
  InputObject, ContextAnchor, AmbiguityTag, AnchorMode,
  AxisWeights, ContentModality, ARHAAnalysisInput,
} from './types';
import {
  ANCHOR_MODE_THRESHOLDS,
  EXPRESSION_MODE_AXIS_WEIGHTS,
  TRAJECTORY_TO_T,
} from './constants';

// ─────────────────────────────────────────
// Φ_Normalize — 텍스트 정규화
// ─────────────────────────────────────────

function normalize(raw: string): {
  normalized_text: string;
  lang_flag: 'ko' | 'en' | 'mixed';
  emoji_signals: string[];
  sentence_units: string[];
} {
  // 이모지 추출
  const emoji_signals = Array.from(raw.matchAll(/\p{Emoji}/gu), m => m[0]);

  // 정규화: 중복 공백, 특수기호 정리 (이모지 제거 후)
  const normalized_text = raw
    .replace(/\p{Emoji}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 언어 감지 (간단 휴리스틱)
  const ko_chars = (normalized_text.match(/[가-힣]/g) || []).length;
  const en_chars = (normalized_text.match(/[a-zA-Z]/g) || []).length;
  const total = ko_chars + en_chars || 1;
  const lang_flag: 'ko' | 'en' | 'mixed' =
    ko_chars / total > 0.7 ? 'ko'
    : en_chars / total > 0.7 ? 'en'
    : 'mixed';

  // 문장 분절 (마침표, 느낌표, 물음표, 쉼표 기준)
  const sentence_units = normalized_text
    .split(/(?<=[.!?])\s+|,\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return { normalized_text, lang_flag, emoji_signals, sentence_units };
}

// ─────────────────────────────────────────
// Δ_InputClassify — 도메인 분류 + 복잡도 계산
// ─────────────────────────────────────────

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  emotion:   ['감정', '기분', '마음', '슬픔', '기쁨', '외로움', 'feel', 'emotion', 'sad', 'happy'],
  visual:    ['빛', '색', '장면', '배경', '카메라', 'light', 'scene', 'visual', 'color'],
  narrative: ['이야기', '기억', '추억', '서사', 'story', 'memory', 'narrative'],
  temporal:  ['새벽', '아침', '밤', '시간', '순간', 'dawn', 'night', 'moment', 'time'],
  spatial:   ['공간', '거리', '방', '도시', 'space', 'room', 'city', 'place'],
  music:     ['소리', '음악', '노래', '멜로디', 'sound', 'music', 'melody', 'rhythm'],
  code:      ['코드', '함수', '알고리즘', 'code', 'function', 'algorithm', 'class'],
  design:    ['디자인', '레이아웃', '색상', '폰트', 'design', 'layout', 'color', 'font'],
};

function classifyDomain(text: string): string[] {
  const lower = text.toLowerCase();
  return Object.entries(DOMAIN_KEYWORDS)
    .filter(([, keywords]) => keywords.some(kw => lower.includes(kw)))
    .map(([domain]) => domain);
}

function computeCScore(
  sentence_count: number,
  domain_count: number,
  text: string,
): number {
  // 중첩 수식어 수 (간단: 형용사 연속)
  const modifier_nesting = (text.match(/[^\s]+(?:\s+[^\s]+){0,2}(?:하고|하며|이고|이며)/g) || []).length;
  // 접속사 수
  const conjunction_count = (text.match(/그리고|하지만|그러나|또한|but|and|however|also/g) || []).length;

  const raw = (
    0.20 * Math.min(sentence_count, 10) / 10 +
    0.30 * Math.min(domain_count, 5) / 5 +
    0.25 * Math.min(modifier_nesting, 5) / 5 +
    0.25 * Math.min(conjunction_count, 5) / 5
  );

  return Math.min(1.0, raw);
}

function cScoreToAnchorMode(c: number): AnchorMode {
  if (c < ANCHOR_MODE_THRESHOLDS.triangle.max) return 'triangle';
  if (c < ANCHOR_MODE_THRESHOLDS.square.max) return 'square';
  if (c < ANCHOR_MODE_THRESHOLDS.pentagon.max) return 'pentagon';
  return 'equation';
}

function buildInitialAxisWeights(
  domain: string[],
  analysis?: ARHAAnalysisInput,
): AxisWeights {
  // 기본값
  const weights: AxisWeights = {
    emotion: 0.50, visual: 0.40, rhythm: 0.40,
    state: 0.40, relation: 0.40, video: 0.30,
    physics: 0.20, music: 0.30,
  };

  // 도메인 기반 부스트
  if (domain.includes('emotion'))   weights.emotion  += 0.20;
  if (domain.includes('visual'))    weights.visual   += 0.20;
  if (domain.includes('narrative')) weights.state    += 0.15;
  if (domain.includes('temporal'))  weights.rhythm   += 0.15;
  if (domain.includes('spatial'))   weights.visual   += 0.10;
  if (domain.includes('music'))     weights.music    += 0.25;
  if (domain.includes('code'))      { weights.state  += 0.30; weights.emotion -= 0.15; }
  if (domain.includes('design'))    { weights.visual += 0.25; weights.relation += 0.10; }

  // ARHA expressionMode 오버라이드
  if (analysis?.expressionMode) {
    const override = EXPRESSION_MODE_AXIS_WEIGHTS[analysis.expressionMode] || {};
    for (const [k, v] of Object.entries(override)) {
      (weights as unknown as Record<string, number>)[k] = v;
    }
  }

  // 0-1 클램핑
  for (const k of Object.keys(weights)) {
    const w = weights as unknown as Record<string, number>;
    w[k] = Math.min(1.0, Math.max(0.0, w[k]));
  }

  return weights;
}

// ─────────────────────────────────────────
// Ξ_context_influence — 컨텍스트 영향도
// ─────────────────────────────────────────

function computeXiWeight(harnessState?: { session_id?: string; turn_count?: number }): number {
  if (!harnessState) return 0.0;
  if (harnessState.turn_count && harnessState.turn_count > 0) return 0.8; // intra_session
  return 0.5; // inter_session (기본)
}

// ─────────────────────────────────────────
// Ψ_AmbiguityTag — 모호성 감지
// ─────────────────────────────────────────

function detectAmbiguity(text: string): AmbiguityTag[] {
  const tags: AmbiguityTag[] = [];

  // Ψ vs G: 감정인가 물리인가 (예: "무거운")
  if (/무거운|무게|gravity|heavy/i.test(text)) {
    tags.push({
      type: 'Ψ_vs_G',
      text: '무게감 표현',
      resolution: '맥락 우선 → 감정 서술이면 Ψ, 물리 현상이면 G',
    });
  }

  // T vs S: 시간인가 사회인가 (예: "오랜 관계")
  if (/오랜|오래된|long-term|lasting/i.test(text)) {
    tags.push({
      type: 'T_vs_S',
      text: '지속성 표현',
      resolution: '관계 서술이면 S(Sociality), 시간 흐름이면 T(Temporality)',
    });
  }

  // I_and_D: 고밀도 + 고확신 (전문 용어 + 단언)
  if (/반드시|절대|항상|always|definitely|certainly/i.test(text)) {
    tags.push({
      type: 'I_and_D',
      text: '단언적 표현',
      resolution: 'I와 D 동시 상승 → 시너지 보너스 C5 적용',
    });
  }

  return tags;
}

// ─────────────────────────────────────────
// 모달리티 감지 (target_modalities)
// ─────────────────────────────────────────

function detectTargetModalities(text: string, explicit?: ContentModality[]): ContentModality[] {
  if (explicit && explicit.length > 0) return explicit;
  const lower = text.toLowerCase();
  const modalities: ContentModality[] = [];
  if (/영상|비디오|video|동영상/.test(lower)) modalities.push('video');
  if (/이미지|사진|photo|image|그림/.test(lower)) modalities.push('image');
  if (/음악|노래|music|사운드|sound/.test(lower)) modalities.push('music');
  if (/코드|code|함수|function/.test(lower)) modalities.push('code');
  if (/디자인|design|레이아웃|layout/.test(lower)) modalities.push('design');
  if (/기획|계획|plan|전략|strategy/.test(lower)) modalities.push('plan');
  // 아무것도 없으면 기본값
  if (modalities.length === 0) modalities.push('image', 'video');
  return modalities;
}

// ─────────────────────────────────────────
// 공개 API
// ─────────────────────────────────────────

export interface Layer0Options {
  analysis?:          ARHAAnalysisInput;
  harness_state?:     { session_id?: string; turn_count?: number };
  context_anchor?:    ContextAnchor;
  target_modalities?: ContentModality[];
}

export function runLayer0(raw_text: string, opts: Layer0Options = {}): InputObject {
  const { analysis, harness_state, context_anchor, target_modalities } = opts;

  // 정규화
  const { normalized_text, lang_flag, emoji_signals, sentence_units } =
    normalize(raw_text);

  // 도메인 분류
  const domain = classifyDomain(normalized_text);

  // 복잡도 → 앵커 모드
  const C_score = computeCScore(sentence_units.length, domain.length, normalized_text);
  const anchor_mode = cScoreToAnchorMode(C_score);

  // 축 가중치
  const axis_weights = buildInitialAxisWeights(domain, analysis);

  // 컨텍스트 영향도
  const xi_weight = computeXiWeight(harness_state);

  // ARHA 분석 데이터를 context_anchor로 통합
  const merged_context_anchor: ContextAnchor | undefined =
    analysis
      ? {
          ...context_anchor,
          from_analysis_data: true,
          emotion_vector:     analysis.psi,
          expression_mode:    analysis.expressionMode,
          trajectory:         analysis.trajectory,
          resonance:          analysis.resonance,
          trust_level:        analysis.kappa,
        }
      : context_anchor;

  // 모호성 감지
  const ambig_tags = detectAmbiguity(normalized_text);

  // 모달리티 감지
  const detected_modalities = detectTargetModalities(normalized_text, target_modalities);

  return {
    raw_text,
    normalized_text,
    lang_flag,
    emoji_signals,
    sentence_units,
    domain,
    axis_weights,
    C_score,
    anchor_mode,
    xi_weight,
    context_anchor: merged_context_anchor,
    ambig_tags,
    target_modalities: detected_modalities,
  };
}
