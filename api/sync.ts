// File: pages/api/sync.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

const ITEM_KEY = 'smartStorageData';

function isPlainObject(obj: any): obj is Record<string, any> {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    !Array.isArray(obj) &&
    Object.getPrototypeOf(obj) === Object.prototype
  );
}

function isPlannerData(obj: any): boolean {
  if (!isPlainObject(obj)) return false;
  let hasDateKey = false;
  for (const key in obj) {
    if (Object.hasOwn(obj, key) && /^\d{4}-\d{2}-\d{2}$/.test(key)) {
      hasDateKey = true;
      break;
    }
  }
  return hasDateKey;
}

function isResourceHubData(obj: any): boolean {
  if (!isPlainObject(obj)) return false;
  const fields = ['vocabulary', 'listening', 'reading', 'writing', 'speaking'];
  // Must have at least one valid array field, and no invalid fields
  let hasValidField = false;
  for (const field of fields) {
    const val = obj[field];
    if (val !== undefined && val !== null && !Array.isArray(val)) {
      return false; // Non-array value -> not ResourceHub
    }
    if (Array.isArray(val)) {
      hasValidField = true;
    }
  }
  return hasValidField;
}

function isChillZoneWrapper(obj: any): boolean {
  return (
    isPlainObject(obj) &&
    isPlainObject(obj.chillZone) &&
    Array.isArray(obj.chillZone.seriesList)
  );
}

function isChillZoneFlat(obj: any): boolean {
  return isPlainObject(obj) && Array.isArray(obj.seriesList);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    let rawCurrentData = await kv.get(ITEM_KEY);
    let currentData: Record<string, any> = {};

    if (isPlainObject(rawCurrentData)) {
      currentData = rawCurrentData;
    }

    if (req.method === 'POST') {
      const body = req.body;
      let newData: Record<string, any> = { ...currentData };

      if (isPlannerData(body)) {
        // Only merge date-keyed entries
        for (const [key, value] of Object.entries(body)) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
            newData[key] = value;
          }
        }
      } else if (isResourceHubData(body)) {
        const categories = ['vocabulary', 'listening', 'reading', 'writing', 'speaking'];
        for (const cat of categories) {
          if (Array.isArray(body[cat])) {
            newData[cat] = body[cat];
          }
          // If body[cat] is undefined/null, leave existing value untouched
        }
      } else if (isChillZoneWrapper(body)) {
        newData.chillZone = body.chillZone;
      } else if (isChillZoneFlat(body)) {
        newData.chillZone = body;
      } else {
        // Unknown structure: do nothing to avoid accidental wipe
        // Or optionally log for debugging
        console.warn('Unrecognized sync payload:', body);
        // Do not merge unknown payloads!
        // Return early to prevent data loss
        return res.status(400).json({ error: 'Unrecognized data format' });
      }

      await kv.set(ITEM_KEY, newData, { ex: 60 * 60 * 24 * 30 });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'GET') {
      return res.status(200).json(currentData);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Sync API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
