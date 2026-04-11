/**
 * 콘텐츠 라우터 — 미들웨어 출력 → 각 생성 API 분기
 */

import type { ModalityPrompts, ContentModality } from './middleware/types';
import { generateVideo } from './videoService';
import { generateImage } from './imageService';
import { generateMusic } from './musicService';

export interface ContentRouterOptions {
  modality:        ContentModality;
  prompts:         ModalityPrompts;
  aspectRatio?:    string;
  style?:          string;
  // 미들웨어 파라미터
  temperature?:    number;
}

export interface ContentResult {
  modality: ContentModality;
  url?:     string;    // 이미지/영상 URL
  text?:    string;    // 코드/기획/디자인 텍스트
  blob?:    Blob;      // 음악 오디오
  error?:   string;
}

export async function routeToContent(
  opts: ContentRouterOptions,
): Promise<ContentResult> {
  const { modality, prompts } = opts;

  try {
    switch (modality) {

      case 'video': {
        const url = await generateVideo({
          rawPrompt:   prompts.video,
          aspectRatio: (opts.aspectRatio as '16:9' | '9:16') ?? '16:9',
        });
        return { modality, url };
      }

      case 'image': {
        const dataUri = await generateImage({
          rawPrompt:   prompts.image,
          aspectRatio: (opts.aspectRatio as '1:1' | '16:9' | '9:16' | '4:3' | '3:4') ?? '1:1',
          opts: {
            style: (opts.style as 'arha' | 'photo' | 'anime' | 'watercolor' | 'oil' | 'sketch') ?? 'arha',
            refinements: [],
          },
        });
        return { modality, url: dataUri };
      }

      case 'music': {
        try {
          const musicResult = await generateMusic({ musicPrompt: prompts.music });
          return { modality, url: musicResult.audioUrl, blob: musicResult.audioBlob };
        } catch {
          // Lyria 미지원 환경 또는 API 키 없음 → 프롬프트 텍스트 반환
          return { modality, text: prompts.music };
        }
      }

      case 'code':
        return { modality, text: prompts.code };

      case 'design':
        return { modality, text: prompts.design };

      case 'plan':
        return { modality, text: prompts.plan };

      default:
        return { modality, error: `Unknown modality: ${modality}` };
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { modality, error };
  }
}

/**
 * 여러 모달리티를 병렬 생성
 */
export async function routeMultiple(
  modalities: ContentModality[],
  prompts: ModalityPrompts,
  sharedOpts: Omit<ContentRouterOptions, 'modality' | 'prompts'> = {},
): Promise<ContentResult[]> {
  return Promise.all(
    modalities.map(modality =>
      routeToContent({ ...sharedOpts, modality, prompts })
    )
  );
}
