// api/sync.ts
import { get, set } from '@vercel/edge-config';

export default async function handler(req: Request): Promise<Response> {
  // 允许跨域请求
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // 处理预检请求（OPTIONS）
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    if (req.method === 'POST') {
      const body = await req.json();
      await set('plannerData', body);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    } else {
      const data = await get('plannerData');
      return new Response(JSON.stringify(data || {}), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error in sync API:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
}
