import { Message, AnalysisData, ArtifactContent } from '../types';

export type ChatCallbacks = {
  onChunk: (chunk: string) => void;
  onAnalysis: (analysis: AnalysisData) => void;
  onArtifact?: (artifact: ArtifactContent) => void;
  onMuMode?: (mode: string) => void;
};

function parseArtifact(text: string): ArtifactContent | null {
  const match = text.match(/\[ARTIFACT\](.*?)\[\/ARTIFACT\]/s);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as ArtifactContent;
  } catch {
    return null;
  }
}

function parseFullResponse(
  fullText: string,
  callbacks: ChatCallbacks,
  muMode?: string,
) {
  // artifact 제거 후 display text
  let displayText = fullText.replace(/\[ARTIFACT\].*?\[\/ARTIFACT\]/s, '').trim();

  // analysis 제거
  const analysisMatch = displayText.match(/\[ANALYSIS\](.*?)\[\/ANALYSIS\]/s);
  if (analysisMatch) {
    displayText = displayText.substring(0, displayText.indexOf('[ANALYSIS]')).trim();
    try {
      const analysis: AnalysisData = JSON.parse(analysisMatch[1]);
      if (muMode) analysis.mu_mode = muMode as AnalysisData['mu_mode'];
      callbacks.onAnalysis(analysis);
    } catch (e) {
      console.error('Analysis JSON parse error', e);
    }
  }

  callbacks.onChunk(displayText);

  // artifact 콜백
  const artifact = parseArtifact(fullText);
  if (artifact && callbacks.onArtifact) {
    callbacks.onArtifact(artifact);
  }

  if (muMode && callbacks.onMuMode) {
    callbacks.onMuMode(muMode);
  }

  return displayText;
}

// 하위 호환: 기존 시그니처 유지
export const chatWithClaudeStream = async (
  messages: Message[],
  onChunk: (chunk: string) => void,
  onAnalysis: (analysis: AnalysisData) => void,
  personaPrompt?: string,
  onArtifact?: (artifact: ArtifactContent) => void,
  onMuMode?: (mode: string) => void,
) => {
  const payload = messages.map(msg => ({
    role: msg.role,
    content: msg.content,
    media: msg.media?.data ? {
      type: msg.media.type,
      mimeType: msg.media.mimeType,
      data: msg.media.data,
    } : undefined,
  }));

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: payload, personaPrompt }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Server error: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';

  // JSON response (Vercel production)
  if (contentType.includes('application/json')) {
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return parseFullResponse(data.text, { onChunk, onAnalysis, onArtifact, onMuMode }, data.muMode);
  }

  // SSE streaming response (local dev)
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let lastSentIndex = 0;
  let sseBuffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    sseBuffer += decoder.decode(value, { stream: true });
    const lines = sseBuffer.split('\n');
    sseBuffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (!data) continue;

      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'text') {
          fullText += parsed.text;

          const analysisTagStart = fullText.indexOf('[ANALYSIS]');
          const artifactTagStart = fullText.indexOf('[ARTIFACT]');
          let safeEnd: number;
          const firstSpecialTag = [analysisTagStart, artifactTagStart].filter(i => i !== -1);
          if (firstSpecialTag.length > 0) {
            safeEnd = Math.min(...firstSpecialTag);
          } else {
            safeEnd = Math.max(0, fullText.length - 12);
          }

          if (safeEnd > lastSentIndex) {
            onChunk(fullText.substring(lastSentIndex, safeEnd));
            lastSentIndex = safeEnd;
          }
        } else if (parsed.type === 'error') {
          throw new Error(parsed.message);
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }

  // Final flush — SSE는 이미 onChunk로 스트리밍했으므로 onChunk 재호출 없이 analysis/artifact만 처리
  return parseFullResponse(fullText, { onChunk: () => {}, onAnalysis, onArtifact, onMuMode });
};
