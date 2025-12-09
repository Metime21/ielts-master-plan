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
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    if (req.method === 'POST') {
      const body = await req.json();
      await kv.set(ITEM_KEY, body, { expire: 60 * 60 * 24 * 30 }); // 可选：30天过期
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    } else {
      const data = await kv.get(ITEM_KEY);
      return new Response(JSON.stringify(data || {}), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Sync API error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
}
