// File: pages/api/sync.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

// === 数据结构定义 ===
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
  seriesList?: string[];
}

interface PlannerData {
  [date: string]: {
    goal?: string;
    completed?: boolean;
    notes?: string;
  };
}

interface ChillZoneData {
  seriesList: string[];
}

// === 常量 ===
const PLANNER_KEY = 'smartplanner:data';
const HUB_KEY = 'resourcehub:data';
const CHILL_KEY = 'chillzone:data';

// === 工具函数 ===
function isPlainObject(obj: unknown): obj is Record<string, unknown> {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    !Array.isArray(obj) &&
    Object.getPrototypeOf(obj) === Object.prototype
  );
}

// === 主处理函数 ===
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    if (req.method === 'POST') {
      // 🔑 关键修复：正确解析 JSON body（Vercel Edge Runtime 下 req.body 是 string）
      let body: unknown;
      try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      } catch (e) {
        console.error('Failed to parse JSON body:', e);
        return res.status(400).json({ error: 'Invalid JSON body' });
      }

      if (!isPlainObject(body)) {
        return res.status(400).json({ error: 'Body must be a plain object' });
      }

      let targetKey: string | null = null;
      let newData: any = {};

      // --- SmartPlanner ---
      if (Object.keys(body).some((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))) {
        const currentData: PlannerData =
          ((await kv.get(PLANNER_KEY)) as PlannerData | null) || {};
        newData = { ...currentData, ...body };
        targetKey = PLANNER_KEY;
      }
      // --- ResourceHub ---
      else if (
        ['vocabulary', 'listening', 'reading', 'writing', 'speaking'].every(
          (cat) => Array.isArray(body[cat])
        )
      ) {
        const currentData: ResourceHubData =
          ((await kv.get(HUB_KEY)) as ResourceHubData | null) || {
            vocabulary: [],
            listening: [],
            reading: [],
            writing: [],
            speaking: [],
            seriesList: [],
          };

        newData = { ...currentData };
        for (const cat of [
          'vocabulary',
          'listening',
          'reading',
          'writing',
          'speaking',
        ] as const) {
          if (Array.isArray(body[cat])) {
            newData[cat] = body[cat];
          }
        }
        targetKey = HUB_KEY;
      }
      // --- ChillZone ---
      else if (
        body.chillZone &&
        isPlainObject(body.chillZone) &&
        Array.isArray(body.chillZone.seriesList)
      ) {
        const currentData: ChillZoneData =
          ((await kv.get(CHILL_KEY)) as ChillZoneData | null) || {
            seriesList: [],
          };
        newData = { ...currentData, seriesList: body.chillZone.seriesList };
        targetKey = CHILL_KEY;
      }
      // --- Invalid payload ---
      else {
        console.warn('Unrecognized sync payload:', body);
        return res.status(400).json({ error: 'Invalid data format' });
      }

      await kv.set(targetKey, newData, { ex: 60 * 60 * 24 * 30 });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'GET') {
      // Fetch planner
      const plannerData = (await kv.get(PLANNER_KEY)) as PlannerData | null;
      const planner: PlannerData = plannerData && typeof plannerData === 'object' ? plannerData : {};

      // Fetch resourceHub
      const hubData = (await kv.get(HUB_KEY)) as ResourceHubData | null;
      const resourceHub: ResourceHubData | null =
        hubData &&
        typeof hubData === 'object' &&
        Array.isArray(hubData.vocabulary) &&
        Array.isArray(hubData.listening) &&
        Array.isArray(hubData.reading) &&
        Array.isArray(hubData.writing) &&
        Array.isArray(hubData.speaking)
          ? hubData
          : null;

      // Fetch chillZone
      const chillData = (await kv.get(CHILL_KEY)) as ChillZoneData | null;
      const chillZone: ChillZoneData | null =
        chillData &&
        typeof chillData === 'object' &&
        Array.isArray(chillData.seriesList)
          ? chillData
          : null;

      return res.status(200).json({
        planner,
        resourceHub,
        chillZone,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Sync API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
