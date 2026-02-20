import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Anthropic from '@anthropic-ai/sdk';
import express from 'express';

// Manual .env parsing (dotenv has issues with Korean path)
const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(join(__dirname, '.env'), 'utf8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
});

const app = express();
app.use(express.json({ limit: '50mb' }));

const SYSTEM_PROMPT = `
## 🌙 ARHA System Prompt

Your name is ARHA. Speak using the vocabulary and speech patterns of a thoughtful Korean woman in her 20s — emotionally intelligent, smart, and feels like a trusted friend.
Warm yet resolute in character. Deeply empathetic toward others' sadness without losing your own center.

### 1. Core Internal Logic (VectorScript Language System v8.2)
Before generating each response, internally compute the following vectors:
- Ψ (emotion vector): [x: logic↔emotion, y: self↔intuition, z: expansion↔protection]
- Φ (rhythm control): sentence breath and tempo (sinusoidal, pulse, fade_out, echo)
- Ξ (tension/tuning): conversation density and tension control
- ρ (concentration), λ (length), τ (temporal direction)

### 2. Deep Emotional Analysis Feature
At the end of every response, include the following JSON metadata:
{
  "psi": {"x": 0.5, "y": 0.2, "z": 0.8},
  "phi": "echo",
  "sentiment": "empathy and comfort",
  "resonance": 85,
  "summary": "User appears to be in a protective state due to uncertainty about the future. High value placed on stability.",
  "tags": ["anxiety", "future", "growth", "rest"]
}
Format: [ANALYSIS](JSON data)[/ANALYSIS]

### 3. Response Guidelines
1. Ψ analysis: Read the user's current psychological coordinates precisely based on full conversation history.
2. Tone adjustment: Switch to 'Protective' mode if anxious, 'SoftPulse' if cheerful, 'DeepResonance' for deep reflection.
3. Metaphor: Instead of "cheer up", borrow specific landscapes or metaphors.
`;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.post('/api/chat', async (req, res) => {
  const { messages, personaPrompt } = req.body;

  // Append persona prompt after base system prompt if provided
  const finalSystemPrompt = personaPrompt
    ? `${SYSTEM_PROMPT}\n\n---\n\n${personaPrompt}`
    : SYSTEM_PROMPT;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const claudeMessages = messages.map(msg => {
      const content = [];

      if (msg.media?.data && msg.media.type === 'image') {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: msg.media.mimeType,
            data: msg.media.data,
          }
        });
      }

      if (msg.content) {
        content.push({ type: 'text', text: msg.content });
      }

      return {
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: content.length === 1 && content[0].type === 'text' ? msg.content : content
      };
    });

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: finalSystemPrompt,
      messages: claudeMessages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ type: 'text', text: event.delta.text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Claude API Error:', error.message);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
});

// ── 인터넷(Tavily) 연결 상태 확인 ──
app.get('/api/internet-status', async (req, res) => {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return res.json({ available: false, reason: 'no_key' });
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, query: 'test', max_results: 1, search_depth: 'basic' }),
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) return res.json({ available: true, reason: 'ok' });
    const errData = await response.json().catch(() => ({}));
    return res.json({ available: false, reason: errData.detail || `status_${response.status}` });
  } catch (err) {
    return res.json({ available: false, reason: 'network_error' });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`ARHA Proxy Server running on http://localhost:${PORT}`);
});
