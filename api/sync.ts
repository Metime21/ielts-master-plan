// File: pages/api/sync.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

const ITEM_KEY = 'smartStorageData';

function isPlainObject(obj: any): obj is Record<string, any> {
  return obj !== null && typeof obj === 'object' && !Array.isArray(obj) && Object.getPrototypeOf(obj) === Object.prototype;
}

// Detect SmartPlanner: has at least one YYYY-MM-DD key
function isPlannerData(obj: any): boolean {
  if (!isPlainObject(obj)) return false;
  return Object.keys(obj).some(key => /^\d{4}-\d{2}-\d{2}$/.test(key));
}

// Detect ResourceHub: has at least one of the category fields as array
function isResourceHubData(obj: any): boolean {
  if (!isPlainObject(obj)) return false;
  const categories = ['vocabulary', 'listening', 'reading', 'writing', 'speaking'];
  return categories.some(cat => Array.isArray(obj[cat]));
}

// Detect ChillZone wrapper: { chillZone: { seriesList: [...] } }
function isChillZoneWrapper(obj: any): boolean {
  return isPlainObject(obj) && isPlainObject(obj.chillZone) && Array.isArray(obj.chillZone.seriesList);
}

// Detect ChillZone flat: { seriesList: [...] }
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
    // Always read current full state from KV
    let currentData = await kv.get(ITEM_KEY);
    if (!isPlainObject(currentData)) {
      currentData = {};
    }

    if (req.method === 'POST') {
      const body = req.body;

      // Start with current data — never lose existing fields
      const mergedData = { ...currentData };

      if (isPlannerData(body)) {
        // Only update date-keyed entries
        for (const [key, value] of Object.entries(body)) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
            mergedData[key] = value;
          }
        }
      } else if (isResourceHubData(body)) {
        // Only update known category fields if they are arrays
        const categories = ['vocabulary', 'listening', 'reading', 'writing', 'speaking'];
        for (const cat of categories) {
          if (Array.isArray(body[cat])) {
            mergedData[cat] = body[cat];
          }
          // If body[cat] is not an array (or missing), leave existing value untouched
        }
      } else if (isChillZoneWrapper(body)) {
        // Extract chillZone object
        mergedData.chillZone = { ...body.chillZone };
      } else if (isChillZoneFlat(body)) {
        // Wrap flat seriesList into chillZone
        mergedData.chillZone = { ...body };
      } else {
        // Unrecognized payload — reject to prevent accidental wipe
        console.warn('Rejecting unrecognized sync payload:', body);
        return res.status(400).json({ error: 'Unrecognized data format' });
      }

      // Save merged state (30-day expiry)
      await kv.set(ITEM_KEY, mergedData, { ex: 60 * 60 * 24 * 30 });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'GET') {
      // Return full merged state
      return res.status(200).json(currentData);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Sync API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
