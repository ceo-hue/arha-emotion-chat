import { Message, AnalysisData, ArtifactContent, PipelineData, ValueChainItem } from '../types';

export type ChatCallbacks = {
  onChunk: (chunk: string) => void;
  onAnalysis: (analysis: AnalysisData) => void;
  onPipeline?: (pipeline: PipelineData) => void;
  onArtifact?: (artifact: ArtifactContent) => void;
  onMuMode?: (mode: string) => void;
  onSearching?: (query: string) => void;
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

function parsePipeline(text: string): PipelineData | null {
  const match = text.match(/\[PIPELINE\](.*?)\[\/PIPELINE\]/s);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as PipelineData;
  } catch {
    return null;
  }
}

function parseFullResponse(
  fullText: string,
  callbacks: ChatCallbacks,
  muMode?: string,
) {
  // [ARTIFACT], [ANALYSIS], [PIPELINE] 모두 제거한 display text
  let displayText = fullText
    .replace(/\[ARTIFACT\].*?\[\/ARTIFACT\]/s, '')
    .replace(/\[PIPELINE\].*?\[\/PIPELINE\]/s, '')
    .trim();

  // analysis 파싱
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

  // pipeline 콜백
  const pipeline = parsePipeline(fullText);
  if (pipeline && callbacks.onPipeline) {
    callbacks.onPipeline(pipeline);
  }

  if (muMode && callbacks.onMuMode) {
    callbacks.onMuMode(muMode);
  }

  return displayText;
}

export const chatWithClaudeStream = async (
  messages: Message[],
  onChunk: (chunk: string) => void,
  onAnalysis: (analysis: AnalysisData) => void,
  personaPrompt?: string,
  onArtifact?: (artifact: ArtifactContent) => void,
  onMuMode?: (mode: string) => void,
  userMode?: string,
  onPipeline?: (pipeline: PipelineData) => void,
  onSearching?: (query: string) => void,
  /** 페르소나별 가치 체인 — 서버 PIPELINE r3 템플릿에 동적 주입 */
  personaValueChain?: ValueChainItem[],
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
    body: JSON.stringify({ messages: payload, personaPrompt, personaValueChain, userMode }),
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
    return parseFullResponse(data.text, { onChunk, onAnalysis, onPipeline, onArtifact, onMuMode }, data.muMode);
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
          const pipelineTagStart = fullText.indexOf('[PIPELINE]');
          const artifactTagStart = fullText.indexOf('[ARTIFACT]');
          const firstSpecialTag = [analysisTagStart, pipelineTagStart, artifactTagStart].filter(i => i !== -1);
          const safeEnd = firstSpecialTag.length > 0
            ? Math.min(...firstSpecialTag)
            : Math.max(0, fullText.length - 12);

          if (safeEnd > lastSentIndex) {
            onChunk(fullText.substring(lastSentIndex, safeEnd));
            lastSentIndex = safeEnd;
          }
        } else if (parsed.type === 'searching') {
          // 인터넷 검색 시작 알림
          if (onSearching) onSearching(parsed.query);
        } else if (parsed.type === 'error') {
          throw new Error(parsed.message);
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }

  // Final flush
  return parseFullResponse(fullText, { onChunk: () => {}, onAnalysis, onPipeline, onArtifact, onMuMode, onSearching });
};
