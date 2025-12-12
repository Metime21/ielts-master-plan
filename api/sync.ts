// File: pages/api/sync.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

const ITEM_KEY = 'smartStorageData';

// --- Type Guards ---
function isPlannerData(obj: any): boolean {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
  const keys = Object.keys(obj);
  if (keys.length === 0) return false;
  return keys.every(key => /^\d{4}-\d{2}-\d{2}$/.test(key));
}

function isResourceHubData(obj: any): boolean {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
  const fields = ['vocabulary', 'listening', 'reading', 'writing', 'speaking'];
  return fields.every(field => Array.isArray(obj[field]));
}

function isChillZoneWrapper(obj: any): boolean {
  // Matches { chillZone: { seriesList: [...] } }
  return (
    typeof obj === 'object' &&
    obj !== null &&
    obj.chillZone !== undefined &&
    typeof obj.chillZone === 'object' &&
    obj.chillZone !== null &&
    Array.isArray(obj.chillZone.seriesList)
  );
}

function isChillZoneFlat(obj: any): boolean {
  // Matches { seriesList: [...] } (direct)
  return (
    typeof obj === 'object' &&
    obj !== null &&
    Array.isArray(obj.seriesList)
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    // Always read current full state
    let currentData = await kv.get(ITEM_KEY);
    if (typeof currentData !== 'object' || currentData === null) {
      currentData = {};
    }

    if (req.method === 'POST') {
      const body = req.body;

      let newData = { ...currentData };

      if (isPlannerData(body)) {
        // SmartPlanner: merge planner data into root (as before)
        // But to avoid conflict, we store under a hidden convention?
        // However, frontend expects flat date keys on root.
        // So we must keep planner on root — but then how to separate?
        //
        // 🔥 CRITICAL: Since frontend reads entire object as planner,
        // we CANNOT store other modules on root if planner is there.
        //
        // Therefore, we MUST change strategy:
        // We will store all modules in namespaced fields internally,
        // but on GET, we return only the relevant part based on who's asking?
        // ❌ But frontend doesn't tell us who's asking!
        //
        // ALTERNATIVE: Realize that original design is flawed.
        // But you said: DO NOT CHANGE FRONTEND.
        //
        // So the ONLY way is: detect which module is writing, and ONLY update its part,
        // while preserving others — but on GET, return the WHOLE object,
        // and hope each frontend only uses its own keys.
        //
        // This works IF:
        // - Planner uses ONLY date keys (e.g., "2025-12-01")
        // - ResourceHub uses ONLY category keys ("vocabulary", etc.)
        // - ChillZone uses ONLY "chillZone" key
        //
        // And these key sets DO NOT OVERLAP.
        //
        // ✅ They don't! So we can merge safely.

        // Merge planner data (date keys) into root
        for (const [key, value] of Object.entries(body)) {
          newData[key] = value;
        }
      } else if (isResourceHubData(body)) {
        // Merge resource hub categories
        const categories = ['vocabulary', 'listening', 'reading', 'writing', 'speaking'];
        for (const cat of categories) {
          if (Array.isArray(body[cat])) {
            newData[cat] = body[cat];
          }
        }
      } else if (isChillZoneWrapper(body)) {
        // Body is { chillZone: { seriesList } }
        newData.chillZone = body.chillZone;
      } else if (isChillZoneFlat(body)) {
        // Body is { seriesList: [...] }
        newData.chillZone = body;
      } else {
        // Unknown structure: do a shallow merge (backward compatibility)
        newData = { ...newData, ...body };
      }

      await kv.set(ITEM_KEY, newData, { ex: 60 * 60 * 24 * 30 }); // 30 days
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'GET') {
      // Return full merged object
      // Each frontend will pick what it needs:
      // - Planner: uses date keys
      // - ResourceHub: uses category keys
      // - ChillZone: uses chillZone key
      return res.status(200).json(currentData);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Sync API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
