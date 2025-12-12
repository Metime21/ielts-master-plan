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
  const keys = Object.keys(obj);
  if (keys.length === 0) return false;
  return keys.every(key => /^\d{4}-\d{2}-\d{2}$/.test(key));
}

function isResourceHubData(obj: any): boolean {
  if (!isPlainObject(obj)) return false;
  const fields = ['vocabulary', 'listening', 'reading', 'writing', 'speaking'];
  return fields.every(field => Array.isArray(obj[field]));
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
    // Safely get and normalize current data
    let rawCurrentData = await kv.get(ITEM_KEY);
    let currentData: Record<string, any> = {};

    if (isPlainObject(rawCurrentData)) {
      currentData = rawCurrentData;
    }
    // If it's not a plain object (e.g., string, number, array, null, undefined), treat as empty

    if (req.method === 'POST') {
      const body = req.body;

      let newData: Record<string, any> = { ...currentData }; // ✅ Now safe!

      if (isPlannerData(body)) {
        for (const [key, value] of Object.entries(body)) {
          newData[key] = value;
        }
      } else if (isResourceHubData(body)) {
        const categories = ['vocabulary', 'listening', 'reading', 'writing', 'speaking'];
        for (const cat of categories) {
          if (Array.isArray(body[cat])) {
            newData[cat] = body[cat];
          }
        }
      } else if (isChillZoneWrapper(body)) {
        newData.chillZone = body.chillZone;
      } else if (isChillZoneFlat(body)) {
        newData.chillZone = body;
      } else {
        // Fallback: shallow merge only if body is plain object
        if (isPlainObject(body)) {
          newData = { ...newData, ...body };
        }
        // Otherwise ignore malformed body
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
