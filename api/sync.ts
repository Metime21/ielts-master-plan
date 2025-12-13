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
  seriesList?: any[]; // for compatibility
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

    // Handle ResourceHub partial update
    const resourceCategories = ['vocabulary', 'listening', 'reading', 'writing', 'speaking'] as const;
    const hasResourceField = resourceCategories.some(cat => Array.isArray(body[cat]));

    if (hasResourceField) {
      const current = ((await kv.get(HUB_KEY)) as ResourceHubData | null) || {
        vocabulary: [],
        listening: [],
        reading: [],
        writing: [],
        speaking: [],
        seriesList: [],
      };

      const update = { ...current };

      for (const cat of resourceCategories) {
        if (Array.isArray(body[cat])) {
          update[cat] = body[cat];
        }
      }

      // Also update seriesList if provided (e.g., from frontend)
      if (Array.isArray(body.seriesList)) {
        update.seriesList = body.seriesList;
      }

      await kv.set(HUB_KEY, update, { ex: 2592000 });
      return res.json({ ok: true });
    }

    // Handle ChillZone update: ONLY if body is exactly { seriesList: [...] }
    if (
      body &&
      Object.keys(body).length === 1 &&
      Array.isArray(body.seriesList)
    ) {
      await kv.set(CHILL_KEY, { seriesList: body.seriesList }, { ex: 2592000 });
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'Invalid sync payload format' });

  } catch (e) {
    console.error('Sync API error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
