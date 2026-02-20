export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return res.json({ available: false, reason: 'no_key' });
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: 'test',
        max_results: 1,
        search_depth: 'basic',
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      return res.json({ available: true, reason: 'ok' });
    }

    const errData = await response.json().catch(() => ({}));
    return res.json({ available: false, reason: errData.detail || `status_${response.status}` });
  } catch (err) {
    return res.json({ available: false, reason: 'network_error' });
  }
}
