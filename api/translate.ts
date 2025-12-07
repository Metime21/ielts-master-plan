// api/translate.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.query;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing text query parameter' });
  }

  try {
    const response = await fetch('https://libretranslate.de/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: 'en',
        target: 'zh'
      })
    });

    const data = await response.json();
    res.status(200).json({ translation: data.translatedText || '' });
  } catch (error) {
    res.status(500).json({ error: 'Translation service unavailable' });
  }
}
