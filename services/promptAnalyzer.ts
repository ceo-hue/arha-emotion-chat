
// ═══════════════════════════════════════════════════════════
//  Prompt Analyzer — Gemini 기반 프롬프트 분석 서비스
//  채팅 감성 분석과 동일한 패턴으로 미디어 생성 분석 제공
// ═══════════════════════════════════════════════════════════

import { GoogleGenAI } from '@google/genai'
import { ANALYSIS_MODEL, getMediaApiKey } from '../lib/modelStrategy'

// ── 분석 타입 ─────────────────────────────────────────────

/** 프롬프트 장면 분석 결과 */
export type PromptAnalysis = {
  readonly subject:     string    // 주 피사체
  readonly mood:        string    // 분위기
  readonly lighting:    string    // 조명 특성
  readonly composition: string    // 구도
  readonly colorTone:   string    // 색조
  readonly tags:        string[]  // 추출 키워드 (최대 6개)
  readonly complexity:  number    // 프롬프트 복잡도 0–100
  readonly promptScore: number    // 예측 생성 품질 0–100
}

/** 재요청 비교 분석 결과 */
export type RefinementAnalysis = {
  readonly changes:   ReadonlyArray<{
    readonly type:   'add' | 'remove' | 'modify'
    readonly aspect: string  // 변경 측면 (한국어)
    readonly detail: string  // 상세 내용 (한국어)
  }>
  readonly preserved: ReadonlyArray<string>  // 유지되는 요소들
  readonly intent:    string                  // 전체 재요청 의도 요약
}

// ── Gemini 클라이언트 ─────────────────────────────────────

const getAI = () => new GoogleGenAI({ apiKey: getMediaApiKey() })

// ── 분석 프롬프트 ─────────────────────────────────────────

const SCENE_ANALYSIS_PROMPT = (p: string) => `
You are a professional photographer and AI art director analyzing an image generation prompt.
Analyze this prompt and respond ONLY with valid JSON (no markdown, no explanation):

Prompt: "${p}"

Required JSON format:
{
  "subject": "주 피사체를 한국어로 2-4단어",
  "mood": "분위기를 한국어로 2-3단어",
  "lighting": "조명 특성을 한국어로 2-3단어",
  "composition": "구도를 한국어로 2-3단어",
  "colorTone": "색조를 한국어로 2-3단어",
  "tags": ["태그1", "태그2", "태그3", "태그4", "태그5"],
  "complexity": 75,
  "promptScore": 80
}

complexity: 0-100 (단어 수와 세부 묘사 기준)
promptScore: 0-100 (AI가 얼마나 잘 생성할지 예측, 구체적일수록 높음)
`

const REFINEMENT_ANALYSIS_PROMPT = (original: string, request: string) => `
You are an AI image refinement analyst. Compare the original prompt with the user's refinement request.
Respond ONLY with valid JSON:

Original prompt: "${original}"
Refinement request: "${request}"

Required JSON format:
{
  "changes": [
    {"type": "add|remove|modify", "aspect": "변경 측면 한국어", "detail": "상세 내용 한국어"}
  ],
  "preserved": ["유지되는 핵심 요소1", "요소2"],
  "intent": "재요청의 전체 의도를 한국어 1문장으로"
}

type values: "add" (새 요소 추가), "remove" (요소 제거), "modify" (기존 요소 변경)
`

// ── 분석 함수 ─────────────────────────────────────────────

/**
 * analyzePrompt — 프롬프트를 장면 구성 요소로 분석
 * 실패 시 null 반환 (UI는 graceful degradation)
 */
export const analyzePrompt = async (prompt: string): Promise<PromptAnalysis | null> => {
  if (!prompt.trim() || prompt.length < 5) return null
  try {
    const ai   = getAI()
    const resp = await ai.models.generateContent({
      model:    ANALYSIS_MODEL,
      contents: [{ role: 'user', parts: [{ text: SCENE_ANALYSIS_PROMPT(prompt) }] }],
      config:   { temperature: 0.1, maxOutputTokens: 400 },
    })
    const text = resp.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
    const json = text.startsWith('{') ? text : text.replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(json) as PromptAnalysis
  } catch {
    return null
  }
}

/**
 * analyzeRefinement — 원본 프롬프트 vs 재요청 비교 분석
 * 실패 시 null 반환
 */
export const analyzeRefinement = async (
  originalPrompt: string,
  refinementRequest: string,
): Promise<RefinementAnalysis | null> => {
  if (!originalPrompt.trim() || !refinementRequest.trim()) return null
  try {
    const ai   = getAI()
    const resp = await ai.models.generateContent({
      model:    ANALYSIS_MODEL,
      contents: [{ role: 'user', parts: [{ text: REFINEMENT_ANALYSIS_PROMPT(originalPrompt, refinementRequest) }] }],
      config:   { temperature: 0.1, maxOutputTokens: 500 },
    })
    const text = resp.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
    const json = text.startsWith('{') ? text : text.replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(json) as RefinementAnalysis
  } catch {
    return null
  }
}
