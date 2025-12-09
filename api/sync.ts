// api/sync.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

const ITEM_KEY = 'smartStorageData';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    if (req.method === 'POST') {
      const body = req.body; // ✅ Vercel 自动解析 JSON
      await kv.set(ITEM_KEY, body, { ex: 60 * 60 * 24 * 30 }); // 30 days in seconds
      return res.status(200).json({ ok: true });
    } else {
      const data = await kv.get(ITEM_KEY);
      return res.status(200).json(data || {});
    }
  } catch (error) {
    console.error('Sync API error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
