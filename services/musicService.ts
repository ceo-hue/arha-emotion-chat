/**
 * musicService — Lyria 3 기반 음악 생성
 * 함수언어 미들웨어의 music 프롬프트를 받아 오디오를 생성
 */

import { GoogleGenAI } from '@google/genai';

// 중간 타입 별칭 — 깊은 제네릭 중첩 시 >> 연산자 혼동 방지
type AudioPart = { inlineData?: { data: string; mimeType: string }; text?: string };
type AudioCandidate = { content?: { parts?: AudioPart[] } };
type AudioChunk = { candidates?: AudioCandidate[] };
type LyriaStreamFn = (opts: unknown) => Promise<AsyncIterable<AudioChunk>>;
type LyriaAI = { models: { generateContentStream: LyriaStreamFn } };

const GEMINI_API_KEY =
  typeof window !== 'undefined'
    ? (window as Window & { GEMINI_API_KEY?: string }).GEMINI_API_KEY
    : process.env.GEMINI_API_KEY;

export interface GenerateMusicRequest {
  /** 함수언어 미들웨어가 생성한 음악 기술 프롬프트 */
  musicPrompt: string;
  /** 추가 컨텍스트 (선택) */
  contextPrompt?: string;
  /** 생성 길이 초 (기본 30) */
  durationSeconds?: number;
}

export interface GenerateMusicResult {
  audioUrl:  string;   // blob URL
  audioBlob: Blob;
  lyrics?:   string;
  prompt:    string;   // 실제 사용된 프롬프트
}

/**
 * Lyria 3 Clip으로 음악 생성
 */
export async function generateMusic(req: GenerateMusicRequest): Promise<GenerateMusicResult> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  // 미들웨어 프롬프트 + 추가 컨텍스트 조합
  const fullPrompt = req.contextPrompt
    ? `${req.musicPrompt}. Additional context: ${req.contextPrompt}`
    : req.musicPrompt;

  const response = await (ai as unknown as LyriaAI).models.generateContentStream({
    model: 'lyria-3-clip-preview',
    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    config: { responseModalities: ['AUDIO'] },
  });

  // 오디오 청크 수집
  const audioChunks: string[] = [];
  let lyrics = '';

  for await (const chunk of response) {
    const candidates = chunk.candidates || [];
    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith('audio/')) {
          audioChunks.push(part.inlineData.data);
        }
        if (part.text) {
          lyrics += part.text;
        }
      }
    }
  }

  if (audioChunks.length === 0) {
    throw new Error('음악 생성 실패: 오디오 데이터가 없습니다.');
  }

  // base64 청크 → Blob
  const combined = audioChunks.join('');
  const binary = atob(combined);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const audioBlob = new Blob([bytes], { type: 'audio/wav' });
  const audioUrl = URL.createObjectURL(audioBlob);

  return { audioUrl, audioBlob, lyrics: lyrics || undefined, prompt: fullPrompt };
}

/**
 * 이미지/영상 컨텍스트 기반 음악 생성
 * (멀티모달 퓨전 — 이미지에서 음악 생성)
 */
export async function generateMusicFromImage(
  imageBase64: string,
  musicPrompt: string,
): Promise<GenerateMusicResult> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const prompt = `이 이미지의 분위기와 감성에 맞는 음악을 생성하세요. ${musicPrompt}`;

  const response = await (ai as unknown as LyriaAI).models.generateContentStream({
    model: 'lyria-3-clip-preview',
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
        { text: prompt },
      ],
    }],
    config: { responseModalities: ['AUDIO'] },
  });

  const audioChunks: string[] = [];
  let lyrics = '';

  for await (const chunk of response) {
    const candidates = chunk.candidates || [];
    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith('audio/')) {
          audioChunks.push(part.inlineData.data);
        }
        if (part.text) lyrics += part.text;
      }
    }
  }

  if (audioChunks.length === 0) {
    throw new Error('이미지 기반 음악 생성 실패');
  }

  const combined = audioChunks.join('');
  const binary = atob(combined);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const audioBlob = new Blob([bytes], { type: 'audio/wav' });
  const audioUrl = URL.createObjectURL(audioBlob);

  return { audioUrl, audioBlob, lyrics: lyrics || undefined, prompt };
}
