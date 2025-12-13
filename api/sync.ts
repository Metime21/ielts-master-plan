// pages/api/sync.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

interface ResourceItem {
  name: string;
  url?: string;
  isUpload?: boolean;
  note?: string;
}

interface ResourceHubData {
  vocabulary: ResourceItem[];
  listening: ResourceItem[];
  reading: ResourceItem[];
  writing: ResourceItem[];
  speaking: ResourceItem[];
  seriesList?: any[];
}

interface PlannerData {
  [date: string]: {
    tasks?: Array<{
      id: string;
      timeRange: string;
      subject: string;
      content: string;
      progress: number;
    }>;
    review?: {
      readingListening?: string;
      speakingWriting?: string;
      mood?: string;
    };
  };
}

interface ChillZoneData {
  seriesList: any[];
}

const PLANNER_KEY = 'planner:data';
const HUB_KEY = 'resourcehub:data';
const CHILL_KEY = 'chillzone:data';

function isPlainObject(obj: any): obj is Record<string, unknown> {
  return obj !== null && typeof obj === 'object' && obj.constructor === Object;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const planner = ((await kv.get(PLANNER_KEY)) as PlannerData | null) || {};
      const hub = ((await kv.get(HUB_KEY)) as ResourceHubData | null) || null;
      const chill = ((await kv.get(CHILL_KEY)) as ChillZoneData | null) || null;

      const validHub =
        hub &&
        Array.isArray(hub.vocabulary) &&
        Array.isArray(hub.listening) &&
        Array.isArray(hub.reading) &&
        Array.isArray(hub.writing) &&
        Array.isArray(hub.speaking)
          ? hub
          : null;

      const validChill = chill && Array.isArray(chill.seriesList) ? chill : null;

      return res.json({
        planner,
        resourceHub: validHub,
        chillZone: validChill,
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = req.body;

    if (!isPlainObject(body)) {
      return res.status(400).json({ error: 'Body must be object' });
    }

    // Handle Planner update: keys are dates like "2025-12-13"
    if (Object.keys(body).some(k => /^\d{4}-\d{2}-\d{2}$/.test(k))) {
      const current = ((await kv.get(PLANNER_KEY)) as PlannerData | null) || {};
      await kv.set(PLANNER_KEY, { ...current, ...body }, { ex: 2592000 });
      return res.json({ ok: true });
    }
    
    // --- 【修正后的 Resource Hub 和 Chill Zone 合并保存逻辑】---
    
    const resourceCategories = ['vocabulary', 'listening', 'reading', 'writing', 'speaking'] as const;

    // 检查请求体中是否包含任何 Resource Hub 或 Chill Zone 的数据字段
    const hasRelevantField = 
        resourceCategories.some(cat => Array.isArray(body[cat])) || 
        Array.isArray(body.seriesList); 

    if (hasRelevantField) {
        // 1. 从 HUB_KEY 读取当前完整数据 (安全读取，避免覆盖)
        const current = ((await kv.get(HUB_KEY)) as ResourceHubData | null) || {
            vocabulary: [],
            listening: [],
            reading: [],
            writing: [],
            speaking: [],
            seriesList: [], 
        };

        const update = { ...current };

        // 2. 用请求体中的数据更新对应的字段 
        for (const cat of resourceCategories) {
            if (Array.isArray(body[cat])) {
                update[cat] = body[cat]; 
            }
        }
        
        // 3. 更新 Chill Zone 数据
        if (Array.isArray(body.seriesList)) {
            update.seriesList = body.seriesList; 
        }

        // 4. 将包含 Chill Zone 在内的完整对象，只写入 HUB_KEY
        await kv.set(HUB_KEY, update, { ex: 2592000 });
        return res.json({ ok: true });
    }
    
    // 如果请求体中不包含任何相关数据，返回错误
    return res.status(400).json({ error: 'No relevant sync data found in request' });

  } catch (e) {
    console.error('Sync API error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
