// File: pages/api/sync.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

// Define keys for each module
const PLANNER_KEY = 'smartplanner:data';
const HUB_KEY = 'resourcehub:data';
const CHILL_KEY = 'chillzone:data'; // ← 已添加

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
        // SmartPlanner: date-keyed object
        targetKey = PLANNER_KEY;
        currentData = await kv.get(targetKey) || {};
        newData = { ...currentData, ...body };
      } 
      else if (isPlainObject(body) && 
        ['vocabulary', 'listening', 'reading', 'writing', 'speaking'].some(cat => Array.isArray(body[cat]))) {
        // ResourceHub: has array categories
        targetKey = HUB_KEY;
        currentData = await kv.get(targetKey) || {};
        newData = { ...currentData };
        for (const cat of ['vocabulary', 'listening', 'reading', 'writing', 'speaking'] as const) {
          if (Array.isArray(body[cat])) {
            newData[cat] = body[cat];
          }
        }
      }
      else if (isPlainObject(body) && 
        body.chillZone && 
        isPlainObject(body.chillZone) && 
        Array.isArray(body.chillZone.seriesList)) {
        // ChillZone: { chillZone: { seriesList: [...] } }
        targetKey = CHILL_KEY;
        currentData = await kv.get(targetKey) || {};
        newData = { ...currentData, seriesList: body.chillZone.seriesList };
      }
      else {
        // Reject unknown payload
        console.warn('Unrecognized sync payload:', body);
        return res.status(400).json({ error: 'Invalid data format' });
      }

      // Save to correct key
      await kv.set(targetKey, newData, { ex: 60 * 60 * 24 * 30 }); // 30-day expiry
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'GET') {
      // 安全地获取 Planner 数据
      const plannerData = await kv.get(PLANNER_KEY);
      const planner = (plannerData && typeof plannerData === 'object') ? plannerData : {};

      // 安全地获取 Resource Hub 数据
      const hubData = await kv.get(HUB_KEY);
      const resourceHub = (
        hubData &&
        typeof hubData === 'object' &&
        Array.isArray(hubData.vocabulary) &&
        Array.isArray(hubData.listening) &&
        Array.isArray(hubData.reading) &&
        Array.isArray(hubData.writing) &&
        Array.isArray(hubData.speaking)
      ) ? hubData : { vocabulary: [], listening: [], reading: [], writing: [], speaking: [] };

      // 安全地获取 Chill Zone 数据
      const chillData = await kv.get(CHILL_KEY);
      const chillZone = (
        chillData &&
        typeof chillData === 'object' &&
        Array.isArray(chillData.seriesList)
      ) ? chillData : { seriesList: [] };

      return res.status(200).json({ planner, resourceHub, chillZone });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Sync API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
