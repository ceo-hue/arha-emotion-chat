import { Message, AnalysisData } from '../types';

function parseAnalysis(fullText: string, onChunk: (chunk: string) => void, onAnalysis: (analysis: AnalysisData) => void) {
  const analysisMatch = fullText.match(/\[ANALYSIS\](.*?)\[\/ANALYSIS\]/s);
  const displayText = analysisMatch
    ? fullText.substring(0, fullText.indexOf('[ANALYSIS]')).trim()
    : fullText.trim();

  onChunk(displayText);

  if (analysisMatch?.[1]) {
    try {
      const analysis: AnalysisData = JSON.parse(analysisMatch[1]);
      onAnalysis(analysis);
    } catch (e) {
      console.error('Analysis JSON parse error', e);
    }
  }

  return displayText;
}

export const chatWithClaudeStream = async (
  messages: Message[],
  onChunk: (chunk: string) => void,
  onAnalysis: (analysis: AnalysisData) => void,
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
    body: JSON.stringify({ messages: payload }),
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
    return parseAnalysis(data.text, onChunk, onAnalysis);
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
          let safeEnd: number;
          if (analysisTagStart !== -1) {
            safeEnd = analysisTagStart;
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

  // Final flush
  const analysisMatch = fullText.match(/\[ANALYSIS\](.*?)\[\/ANALYSIS\]/s);
  const finalEnd = analysisMatch
    ? fullText.indexOf('[ANALYSIS]')
    : fullText.length;

  if (finalEnd > lastSentIndex) {
    onChunk(fullText.substring(lastSentIndex, finalEnd));
  }

  if (analysisMatch?.[1]) {
    try {
      const analysis: AnalysisData = JSON.parse(analysisMatch[1]);
      onAnalysis(analysis);
    } catch (e) {
      console.error('Analysis JSON parse error', e);
    }
  }

  return fullText.substring(0, finalEnd);
};
