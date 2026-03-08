
// ═══════════════════════════════════════════════════════════
//  Video Service — FP 아키텍처 영상 생성 파이프라인
//  VEO 3.1 Fast + 비동기 폴링 재귀 패턴
// ═══════════════════════════════════════════════════════════

import { GoogleGenAI } from '@google/genai'
import { delay } from '../lib/fp'
import { VIDEO_RETRY_POLICY, withRetryPolicy } from '../lib/generationError'
import { buildVideoPrompt } from '../lib/promptPipeline'
import { selectVideoStrategy, getMediaApiKey, type VideoAspectRatio } from '../lib/modelStrategy'

// ── 클라이언트 ────────────────────────────────────────────

const getAI = () => new GoogleGenAI({ apiKey: getMediaApiKey() })

// ── 폴링 상수 ─────────────────────────────────────────────

const POLL_INTERVAL_MS = 10_000  // 10초 간격 폴링

// ── 순수 폴링 함수 ────────────────────────────────────────

/**
 * pollOperation — 영상 생성 완료까지 재귀 폴링
 *
 * done=true가 될 때까지 POLL_INTERVAL_MS마다 상태 확인.
 * 꼬리 재귀 패턴으로 루프 없이 구현.
 */
const pollOperation = async (
  ai: GoogleGenAI,
  operation: any,
): Promise<string> => {
  if (operation.done) {
    const uri    = operation.response?.generatedVideos?.[0]?.video?.uri
    if (!uri) throw { _tag: 'EmptyOutput' }
    const apiKey = getMediaApiKey()
    const resp   = await fetch(`${uri}&key=${apiKey}`)
    const blob   = await resp.blob()
    return URL.createObjectURL(blob)
  }
  await delay(POLL_INTERVAL_MS)
  const next = await ai.operations.getVideosOperation({ operation })
  return pollOperation(ai, next)
}

// ── 영상 생성 요청 타입 ───────────────────────────────────

export type GenerateVideoRequest = {
  readonly rawPrompt:  string
  readonly aspectRatio: VideoAspectRatio
}

// ── 영상 생성 파이프라인 ──────────────────────────────────

/**
 * generateVideo — FP 영상 생성 파이프라인
 *
 * 1. 프롬프트 파이프라인 합성 (buildVideoPrompt)
 * 2. 모델 전략 선택 (selectVideoStrategy)
 * 3. VEO API 호출 → 비동기 operation 반환
 * 4. pollOperation으로 완료 대기
 * 5. withRetryPolicy로 할당량 초과 시 자동 재시도
 */
export const generateVideo = async (req: GenerateVideoRequest): Promise<string> => {
  const ai       = getAI()
  const strategy = selectVideoStrategy(req.aspectRatio)
  const prompt   = buildVideoPrompt(req.rawPrompt)

  return withRetryPolicy(VIDEO_RETRY_POLICY)(async () => {
    const operation = await ai.models.generateVideos({
      model:  strategy.model,
      prompt,
      config: {
        numberOfVideos: 1,
        resolution:     strategy.resolution,
        aspectRatio:    strategy.aspectRatio,
      },
    })
    return pollOperation(ai, operation)
  })
}
