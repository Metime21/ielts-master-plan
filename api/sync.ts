// File: pages/api/sync.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

// Define keys for each module
const PLANNER_KEY = 'smartplanner:data';
const HUB_KEY = 'resourcehub:data';
const CHILL_KEY = 'chillzone:data';

function isPlainObject(obj: any): obj is Record<string, any> {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    !Array.isArray(obj) &&
    Object.getPrototypeOf(obj) === Object.prototype
  );
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    if (req.method === 'POST') {
      const body = req.body;
      let targetKey: string | null = null;
      let currentData: any = {};
      let newData: any = {};

      // Identify the module by payload structure
      if (isPlainObject(body) && Object.keys(body).some(k => /^\d{4}-\d{2}-\d{2}$/.test(k))) {
        // SmartPlanner
        targetKey = PLANNER_KEY;
        currentData = (await kv.get(targetKey)) || {};
        newData = { ...currentData, ...body };
      } else if (
        isPlainObject(body) &&
        ['vocabulary', 'listening', 'reading', 'writing', 'speaking'].every(cat => Array.isArray(body[cat]))
      ) {
        // ResourceHub —— 更严格：要求所有字段都存在且为数组（可选，原逻辑用 some 也可）
        targetKey = HUB_KEY;
        currentData = (await kv.get(targetKey)) || {};
        newData = { ...currentData };
        for (const cat of ['vocabulary', 'listening', 'reading', 'writing', 'speaking'] as const) {
          if (Array.isArray(body[cat])) {
            newData[cat] = body[cat];
          }
        }
      } else if (
        isPlainObject(body) &&
        body.chillZone &&
        isPlainObject(body.chillZone) &&
        Array.isArray(body.chillZone.seriesList)
      ) {
        // ChillZone
        targetKey = CHILL_KEY;
        currentData = (await kv.get(targetKey)) || {};
        newData = { ...currentData, seriesList: body.chillZone.seriesList };
      } else {
        console.warn('Unrecognized sync payload:', body);
        return res.status(400).json({ error: 'Invalid data format' });
      }

      await kv.set(targetKey, newData, { ex: 60 * 60 * 24 * 30 });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'GET') {
      const plannerData = await kv.get(PLANNER_KEY);
      const planner = (plannerData && typeof plannerData === 'object') ? plannerData : {};

      const hubData = await kv.get(HUB_KEY);
      const resourceHub = (
        hubData &&
        typeof hubData === 'object' &&
        Array.isArray(hubData.vocabulary) &&
        Array.isArray(hubData.listening) &&
        Array.isArray(hubData.reading) &&
        Array.isArray(hubData.writing) &&
        Array.isArray(hubData.speaking)
      ) ? hubData : null;

      const chillData = await kv.get(CHILL_KEY);
      const chillZone = (
        chillData &&
        typeof chillData === 'object' &&
        Array.isArray(chillData.seriesList)
      ) ? chillData : null;

      // ✅ 返回字段名与前端完全一致
      return res.status(200).json({
        planner,
        resourceHub,   // ← 关键：字段名 resourceHub
        chillZone,     // ← 关键：字段名 chillZone
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Sync API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
