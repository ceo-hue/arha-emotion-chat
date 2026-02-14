
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ARHA_SYSTEM_PROMPT } from "../constants";
import { Message, AnalysisData, GroundingSource } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// Retry utility with enhanced error detection for quota issues
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5, delay = 2000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      const errorStr = error?.message || "";
      const isQuotaExceeded = error?.status === 429 || 
                              errorStr.includes('429') || 
                              errorStr.includes('RESOURCE_EXHAUSTED') || 
                              errorStr.includes('quota');

      if (errorStr.includes('Requested entity was not found')) {
        if (typeof window.aistudio !== 'undefined') {
          await window.aistudio.openSelectKey();
        }
      }

      if (isQuotaExceeded) {
        const waitTime = delay * Math.pow(2, i);
        console.warn(`Quota exceeded. Retrying in ${waitTime}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export const chatWithArhaStream = async (
  messages: Message[], 
  onChunk: (chunk: string) => void,
  onAnalysis: (analysis: AnalysisData) => void,
  onGrounding?: (sources: GroundingSource[]) => void,
  latLng?: { latitude: number; longitude: number }
) => {
  const ai = getAI();
  
  const history = messages.slice(0, -1).map(msg => {
    const parts: any[] = [{ text: msg.content }];
    if (msg.media?.data) {
      parts.push({
        inlineData: {
          mimeType: msg.media.mimeType,
          data: msg.media.data
        }
      });
    }
    return { role: msg.role === 'user' ? 'user' : 'model', parts };
  });

  const lastMsg = messages[messages.length - 1];
  const lastParts: any[] = [{ text: lastMsg.content }];
  if (lastMsg.media?.data) {
    lastParts.push({
      inlineData: {
        mimeType: lastMsg.media.mimeType,
        data: lastMsg.media.data
      }
    });
  }

  try {
    const isComplex = lastMsg.media?.type === 'image' || lastMsg.media?.type === 'video';
    // Use gemini-3-flash-preview for general text tasks and search grounding.
    const modelName = isComplex ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';

    const config: any = {
      systemInstruction: ARHA_SYSTEM_PROMPT,
      temperature: 0.8,
      // Gemini 3 models support googleSearch but not googleMaps for now.
      tools: isComplex ? [] : [{ googleSearch: {} }],
    };

    if (latLng && !isComplex) {
      config.toolConfig = {
        retrievalConfig: { latLng }
      };
    }

    const responseStream = await withRetry(() => ai.models.generateContentStream({
      model: modelName,
      contents: [...history, { role: 'user', parts: lastParts }],
      config,
    })) as AsyncIterable<GenerateContentResponse>;

    let fullText = "";
    let lastSentIndex = 0;
    let finalGrounding: GroundingSource[] = [];

    for await (const chunk of responseStream) {
      const text = chunk.text;
      
      // Extract grounding sources from search metadata
      if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        const chunks = chunk.candidates[0].groundingMetadata.groundingChunks;
        
        const webSources: GroundingSource[] = chunks
          .filter((c: any) => c.web)
          .map((c: any) => ({ title: c.web.title, uri: c.web.uri }));
          
        const mapSources: GroundingSource[] = chunks
          .filter((c: any) => c.maps)
          .map((c: any) => ({ title: c.maps.title, uri: c.maps.uri }));
          
        const sources = [...webSources, ...mapSources];
        if (sources.length > 0) finalGrounding = [...finalGrounding, ...sources];
      }

      if (text) {
        fullText += text;
        const analysisTagStart = fullText.indexOf('[ANALYSIS]');
        
        let safeToSentText = "";
        if (analysisTagStart === -1) {
          const potentialTagBuffer = 12;
          if (fullText.length > potentialTagBuffer) {
            safeToSentText = fullText.substring(0, fullText.length - potentialTagBuffer);
          }
        } else {
          safeToSentText = fullText.substring(0, analysisTagStart);
        }

        if (safeToSentText.length > lastSentIndex) {
          const chunkToSend = safeToSentText.substring(lastSentIndex);
          onChunk(chunkToSend);
          lastSentIndex = safeToSentText.length;
        }
      }
    }

    const finalAnalysisIndex = fullText.indexOf('[ANALYSIS]');
    const finalSafeText = finalAnalysisIndex === -1 ? fullText : fullText.substring(0, finalAnalysisIndex);
    if (finalSafeText.length > lastSentIndex) {
      onChunk(finalSafeText.substring(lastSentIndex));
    }

    if (finalGrounding.length > 0 && onGrounding) {
      const uniqueSources = Array.from(new Map(finalGrounding.map(item => [item.uri, item])).values());
      onGrounding(uniqueSources);
    }

    const analysisMatch = fullText.match(/\[ANALYSIS\](.*?)\[\/ANALYSIS\]/s);
    if (analysisMatch && analysisMatch[1]) {
      try {
        const analysis: AnalysisData = JSON.parse(analysisMatch[1]);
        onAnalysis(analysis);
      } catch (e) {
        console.error("Analysis JSON parse error", e);
      }
    }

    return fullText;
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};

export const generateArhaVideo = async (prompt: string, aspectRatio: '16:9' | '9:16') => {
  const ai = getAI();
  return await withRetry(async () => {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: `In the style of a thoughtful 20-something Korean student named Arha: ${prompt}`,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspectRatio
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  });
};
