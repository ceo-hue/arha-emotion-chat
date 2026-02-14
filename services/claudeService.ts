import { Message, AnalysisData } from '../types';

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
    throw new Error(`Server error: ${response.status}`);
  }

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

          // Check if [ANALYSIS] tag has appeared
          const analysisTagStart = fullText.indexOf('[ANALYSIS]');

          let safeEnd: number;
          if (analysisTagStart !== -1) {
            // Tag found - only show text before it
            safeEnd = analysisTagStart;
          } else {
            // Tag not found yet - hold back last 12 chars in case tag is partially received
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

  // Final flush: send any remaining safe text
  const analysisMatch = fullText.match(/\[ANALYSIS\](.*?)\[\/ANALYSIS\]/s);
  const finalEnd = analysisMatch
    ? fullText.indexOf('[ANALYSIS]')
    : fullText.length;

  if (finalEnd > lastSentIndex) {
    onChunk(fullText.substring(lastSentIndex, finalEnd));
  }

  // Parse and emit analysis data
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
