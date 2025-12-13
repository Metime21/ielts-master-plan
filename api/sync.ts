// pages/api/sync.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

interface ResourceItem { name: string; url?: string; isUpload?: boolean; note?: string; }
interface ResourceHubData { vocabulary: ResourceItem[]; listening: ResourceItem[]; reading: ResourceItem[]; writing: ResourceItem[]; speaking: ResourceItem[]; seriesList?: string[]; }
interface PlannerData { [date: string]: { goal?: string; completed?: boolean; notes?: string; }; }
interface ChillZoneData { seriesList: string[]; }

const PLANNER_KEY = 'smartplanner:data';
const HUB_KEY = 'resourcehub:data';
const CHILL_KEY = 'chillzone:data';

function isPlainObject(obj: unknown): obj is Record<string, unknown> {
  return obj !== null && typeof obj === 'object' && !Array.isArray(obj) && Object.getPrototypeOf(obj) === Object.prototype;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'POST') {
      let body: unknown;
      try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      } catch {
        return res.status(400).json({ error: 'Invalid JSON' });
      }

      if (!isPlainObject(body)) {
        return res.status(400).json({ error: 'Body must be object' });
      }

      if (Object.keys(body).some(k => /^\d{4}-\d{2}-\d{2}$/.test(k))) {
        const current = ((await kv.get(PLANNER_KEY)) as PlannerData | null) || {};
        await kv.set(PLANNER_KEY, { ...current, ...body }, { ex: 2592000 });
        return res.json({ ok: true });
      }

      if (['vocabulary','listening','reading','writing','speaking'].every(cat => Array.isArray(body[cat]))) {
        const current = ((await kv.get(HUB_KEY)) as ResourceHubData | null) || {
          vocabulary: [], listening: [], reading: [], writing: [], speaking: [], seriesList: []
        };
        const update = { ...current };
        for (const cat of ['vocabulary','listening','reading','writing','speaking'] as const) {
          if (Array.isArray(body[cat])) update[cat] = body[cat];
        }
        await kv.set(HUB_KEY, update, { ex: 2592000 });
        return res.json({ ok: true });
      }

      if (body.chillZone && isPlainObject(body.chillZone) && Array.isArray(body.chillZone.seriesList)) {
        const current = ((await kv.get(CHILL_KEY)) as ChillZoneData | null) || { seriesList: [] };
        await kv.set(CHILL_KEY, { ...current, seriesList: body.chillZone.seriesList }, { ex: 2592000 });
        return res.json({ ok: true });
      }

      return res.status(400).json({ error: 'Invalid format' });
    }

    if (req.method === 'GET') {
      const planner = ((await kv.get(PLANNER_KEY)) as PlannerData | null) || {};
      const hub = ((await kv.get(HUB_KEY)) as ResourceHubData | null);
      const chill = ((await kv.get(CHILL_KEY)) as ChillZoneData | null);

      const validHub = hub &&
        Array.isArray(hub.vocabulary) &&
        Array.isArray(hub.listening) &&
        Array.isArray(hub.reading) &&
        Array.isArray(hub.writing) &&
        Array.isArray(hub.speaking) ? hub : null;

      const validChill = chill && Array.isArray(chill.seriesList) ? chill : null;

      return res.json({ planner, resourceHub: validHub, chillZone: validChill });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('Sync error:', e);
    res.status(500).json({ error: 'Server error' });
  }
}
