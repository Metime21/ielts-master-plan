// api/sync.ts
import { kv } from '@vercel/kv';

export const config = {
  runtime: 'edge',
};

const ITEM_KEY = 'smartStorageData';

export default async function handler(req: Request): Promise<Response> {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    if (req.method === 'POST') {
      const body = await req.json();
      // ✅ FIXED: expire → ex (Vercel KV uses 'ex' for expiration in seconds)
      await kv.set(ITEM_KEY, body, { ex: 60 * 60 * 24 * 30 }); // 30 days
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    } else {
      const data = await kv.get(ITEM_KEY);
      return new Response(JSON.stringify(data || {}), { status: 200, headers });
    }
  } catch (error) {
    console.error('Sync API error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers,
    });
  }
}
