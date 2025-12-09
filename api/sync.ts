// api/sync.ts
import { get, set } from '@vercel/edge-config';

export const config = {
  runtime: 'edge',
};

// ✅ 统一使用与前端相同的键名
const ITEM_KEY = 'smartStorageData';

// ✅ 从环境变量获取 Edge Config ID（Vercel 自动注入）
const EDGE_CONFIG_ID = process.env.EDGE_CONFIG_ID;

if (!EDGE_CONFIG_ID) {
  throw new Error('Missing EDGE_CONFIG_ID. Please configure it in Vercel project environment variables.');
}

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

      // ✅ 正确调用 set(configId, key, value)
      await set(EDGE_CONFIG_ID, ITEM_KEY, body);

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    } else {
      // GET 请求：返回当前数据（可用于调试）
      const data = await get(EDGE_CONFIG_ID, ITEM_KEY);
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
