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

    if (req.method === 'POST') {
    const body = req.body;

    if (!isPlainObject(body)) {
        return res.status(400).json({ error: 'Body must be object' });
    }

    // 定义 Resource Hub 的所有类别
    const resourceCategories = ['vocabulary', 'listening', 'reading', 'writing', 'speaking'] as const;
    
    // --- 1. 处理 PLANNER 数据更新 (以日期为键) ---
    const isPlannerUpdate = Object.keys(body).some(k => /^\d{4}-\d{2}-\d{2}$/.test(k));
    
    if (isPlannerUpdate) {
        // Planner 只进行局部更新和写入 PLANNER_KEY
        const currentPlanner = ((await kv.get(PLANNER_KEY)) as PlannerData | null) || {};
        await kv.set(PLANNER_KEY, { ...currentPlanner, ...body }, { ex: 2592000 });
        return res.json({ ok: true });
    }

    // --- 2. 处理 RESOURCE HUB / CHILL ZONE 数据更新 ---
    const isResourceUpdate = 
        resourceCategories.some(cat => Array.isArray(body[cat])) || 
        Array.isArray(body.seriesList); 

    if (isResourceUpdate) {
        // 从 HUB_KEY 读取当前完整数据 (安全读取，避免覆盖)
        const currentHub = ((await kv.get(HUB_KEY)) as ResourceHubData | null) || {
            vocabulary: [],
            listening: [],
            reading: [],
            writing: [],
            speaking: [],
            seriesList: [], 
        };

        const updateHub = { ...currentHub };

        // 用请求体中的数据更新对应的字段 
        for (const cat of resourceCategories) {
            if (Array.isArray(body[cat])) {
                updateHub[cat] = body[cat]; 
            }
        }
        
        // 更新 Chill Zone 数据
        if (Array.isArray(body.seriesList)) {
            updateHub.seriesList = body.seriesList; 
        }

        // 将完整对象写入 HUB_KEY
        await kv.set(HUB_KEY, updateHub, { ex: 2592000 });
        return res.json({ ok: true });
    }
    
    // 如果请求体中不包含任何 Planner 或 Resource/Chill 数据，返回错误
    return res.status(400).json({ error: 'No recognizable sync data found in request' });
}

  } catch (e) {
    console.error('Sync API error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
