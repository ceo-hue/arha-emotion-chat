
// ═══════════════════════════════════════════════════════════
//  Image Service — FP 아키텍처 이미지 생성 파이프라인
//  Gemini Flash(1차) → Imagen 4(fallback) 이중 전략
// ═══════════════════════════════════════════════════════════

import { GoogleGenAI } from '@google/genai'
import { ok, err, isOk, type Result } from '../lib/fp'
import { type GenerationError, IMAGE_RETRY_POLICY, withRetryPolicy } from '../lib/generationError'
import { buildImagePrompt, type ImagePromptOptions } from '../lib/promptPipeline'
import { selectImageStrategy, getMediaApiKey, type AspectRatio, type UserTier } from '../lib/modelStrategy'

// ── 클라이언트 ────────────────────────────────────────────

const getAI = () => new GoogleGenAI({ apiKey: getMediaApiKey() })

// ── 순수 추출기들 ─────────────────────────────────────────

/** Gemini Flash 응답에서 인라인 이미지 추출 */
const extractInlineImage = (resp: unknown): Result<GenerationError, string> => {
  const parts = (resp as any)?.candidates?.[0]?.content?.parts ?? []
  const img   = parts.find((p: any) => p?.inlineData?.data)
  return img
    ? ok(`data:${img.inlineData.mimeType ?? 'image/png'};base64,${img.inlineData.data}`)
    : err({ _tag: 'EmptyOutput' } as const)
}

/** Imagen 응답에서 이미지 바이트 추출 */
const extractImagenBytes = (resp: unknown): Result<GenerationError, string> => {
  const img   = (resp as any)?.generatedImages?.[0]?.image
  const bytes = img?.imageBytes
  return bytes
    ? ok(`data:${img.mimeType ?? 'image/png'};base64,${bytes}`)
    : err({ _tag: 'EmptyOutput' } as const)
}

// ── 이미지 생성 요청 타입 ─────────────────────────────────

export type GenerateImageRequest = {
  readonly rawPrompt:  string
  readonly aspectRatio: AspectRatio
  readonly opts:       ImagePromptOptions
  readonly tier?:      UserTier
}

// ── 이미지 생성 파이프라인 ────────────────────────────────

/**
 * generateImage — FP 이미지 생성 파이프라인
 *
 * 1. 프롬프트 파이프라인 합성 (buildImagePrompt)
 * 2. 모델 전략 선택 (selectImageStrategy)
 * 3. Gemini Flash 1차 시도
 * 4. 실패 시 Imagen 4 fallback
 * 5. withRetryPolicy로 자동 재시도
 */
export const generateImage = async (req: GenerateImageRequest): Promise<string> => {
  const ai       = getAI()
  const strategy = selectImageStrategy(req.opts.style, req.tier ?? 'free')
  const prompt   = buildImagePrompt(req.opts)(req.rawPrompt)

  return withRetryPolicy(IMAGE_RETRY_POLICY)(async () => {
    // ── 1차: Gemini Flash Image Generation ──────────────
    try {
      const resp = await ai.models.generateContent({
        model:    strategy.primary,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config:   { responseModalities: strategy.modalities },
      })
      const result = extractInlineImage(resp)
      if (isOk(result)) return result.value
    } catch {
      // 1차 실패 → fallback 진행
    }

    // ── 2차: Imagen 4 fallback ───────────────────────────
    const resp2  = await ai.models.generateImages({
      model:  strategy.fallback,
      prompt,
      config: {
        numberOfImages: 1,
        aspectRatio:    req.aspectRatio,
        outputMimeType: strategy.outputMimeType,
      },
    })
    const result2 = extractImagenBytes(resp2)
    if (isOk(result2)) return result2.value

    throw { _tag: 'EmptyOutput' }
  })
}
