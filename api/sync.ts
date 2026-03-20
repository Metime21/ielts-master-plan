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
}

interface PlannerTask {
  id: string;
  timeRange: string;
  subject: string;
  content: string;
  progress: number;
}

interface PlannerReview {
  readingListening: string;
  speakingWriting: string;
  mood: string | null;
}

interface PlannerDayData {
  tasks: PlannerTask[];
  review: PlannerReview;
}

interface PlannerData {
  [date: string]: PlannerDayData;
}

interface ChillZoneItem {
  id: string;
  title: string;
  desc: string;
  url: string;
  poster: string;
  isCustom?: boolean;
}

interface ChillZoneData {
  seriesList: ChillZoneItem[];
}

const PLANNER_KEY = 'planner:data';
const HUB_KEY = 'resourcehub:data';
const CHILL_KEY = 'chillzone:data';

const RESOURCE_CATEGORIES = [
  'vocabulary',
  'listening',
  'reading',
  'writing',
  'speaking',
] as const;

const EMPTY_REVIEW: PlannerReview = {
  readingListening: '',
  speakingWriting: '',
  mood: null,
};

const EMPTY_RESOURCES: ResourceHubData = {
  vocabulary: [],
  listening: [],
  reading: [],
  writing: [],
  speaking: [],
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isDateKey(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(key);
}

function sanitizeProgress(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 100) {
    return 100;
  }

  return value;
}

function sanitizePlannerTask(value: unknown): PlannerTask | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const { id, timeRange, subject, content, progress } = value;

  if (
    typeof id !== 'string' ||
    typeof timeRange !== 'string' ||
    typeof subject !== 'string' ||
    typeof content !== 'string'
  ) {
    return null;
  }

  return {
    id,
    timeRange,
    subject,
    content,
    progress: sanitizeProgress(progress),
  };
}

function sanitizePlannerReview(value: unknown): PlannerReview {
  if (!isPlainObject(value)) {
    return { ...EMPTY_REVIEW };
  }

  return {
    readingListening:
      typeof value.readingListening === 'string' ? value.readingListening : '',
    speakingWriting:
      typeof value.speakingWriting === 'string' ? value.speakingWriting : '',
    mood:
      typeof value.mood === 'string' || value.mood === null
        ? value.mood
        : null,
  };
}

function sanitizePlannerDayData(value: unknown): PlannerDayData | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const rawTasks = Array.isArray(value.tasks) ? value.tasks : [];
  const tasks = rawTasks
    .map((task) => sanitizePlannerTask(task))
    .filter((task): task is PlannerTask => task !== null);

  const review = sanitizePlannerReview(value.review);

  return {
    tasks,
    review,
  };
}

function sanitizePlannerPayload(value: unknown): PlannerData | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const result: PlannerData = {};

  for (const [key, dayValue] of Object.entries(value)) {
    if (!isDateKey(key)) {
      continue;
    }

    const sanitizedDay = sanitizePlannerDayData(dayValue);
    if (sanitizedDay) {
      result[key] = sanitizedDay;
    }
  }

  return result;
}

function sanitizeResourceItem(value: unknown): ResourceItem | null {
  if (!isPlainObject(value) || typeof value.name !== 'string') {
    return null;
  }

  return {
    name: value.name,
    url: typeof value.url === 'string' ? value.url : undefined,
    isUpload: typeof value.isUpload === 'boolean' ? value.isUpload : undefined,
    note: typeof value.note === 'string' ? value.note : undefined,
  };
}

function sanitizeResourceArray(value: unknown): ResourceItem[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value
    .map((item) => sanitizeResourceItem(item))
    .filter((item): item is ResourceItem => item !== null);
}

function sanitizeResourceHubPayload(value: unknown): Partial<ResourceHubData> | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const result: Partial<ResourceHubData> = {};

  for (const category of RESOURCE_CATEGORIES) {
    const sanitized = sanitizeResourceArray(value[category]);
    if (sanitized) {
      result[category] = sanitized;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

function sanitizeStoredResourceHub(value: unknown): ResourceHubData | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const result: Partial<ResourceHubData> = {};

  for (const category of RESOURCE_CATEGORIES) {
    const sanitized = sanitizeResourceArray(value[category]);
    if (!sanitized) {
      return null;
    }
    result[category] = sanitized;
  }

  return result as ResourceHubData;
}

function sanitizeChillZoneItem(value: unknown): ChillZoneItem | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const { id, title, desc, url, poster, isCustom } = value;

  if (
    typeof id !== 'string' ||
    typeof title !== 'string' ||
    typeof desc !== 'string' ||
    typeof url !== 'string' ||
    typeof poster !== 'string'
  ) {
    return null;
  }

  return {
    id,
    title,
    desc,
    url,
    poster,
    isCustom: typeof isCustom === 'boolean' ? isCustom : undefined,
  };
}

function sanitizeChillZonePayload(value: unknown): ChillZoneData | null {
  if (!isPlainObject(value) || !Array.isArray(value.seriesList)) {
    return null;
  }

  const seriesList = value.seriesList
    .map((item) => sanitizeChillZoneItem(item))
    .filter((item): item is ChillZoneItem => item !== null);

  return {
    seriesList,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const plannerRaw = await kv.get(PLANNER_KEY);
      const hubRaw = await kv.get(HUB_KEY);
      const chillRaw = await kv.get(CHILL_KEY);

      const planner = sanitizePlannerPayload(plannerRaw) || {};
      const resourceHub = sanitizeStoredResourceHub(hubRaw);
      const chillZone = sanitizeChillZonePayload(chillRaw);

      return res.status(200).json({
        planner,
        resourceHub,
        chillZone,
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = req.body;

    if (!isPlainObject(body)) {
      return res.status(400).json({ error: 'Body must be an object' });
    }

    const hasPlannerKeys = Object.keys(body).some((key) => isDateKey(key));
    if (hasPlannerKeys) {
      const incomingPlanner = sanitizePlannerPayload(body);
      if (!incomingPlanner) {
        return res.status(400).json({ error: 'Invalid planner payload format' });
      }

      const currentPlanner =
        sanitizePlannerPayload(await kv.get(PLANNER_KEY)) || {};

      await kv.set(PLANNER_KEY, {
        ...currentPlanner,
        ...incomingPlanner,
      });

      return res.status(200).json({ ok: true });
    }

    const resourceUpdate = sanitizeResourceHubPayload(body);
    if (resourceUpdate) {
      const currentHub =
        sanitizeStoredResourceHub(await kv.get(HUB_KEY)) || EMPTY_RESOURCES;

      await kv.set(HUB_KEY, {
        ...currentHub,
        ...resourceUpdate,
      });

      return res.status(200).json({ ok: true });
    }

    const chillUpdate = sanitizeChillZonePayload(body);
    if (chillUpdate && Object.keys(body).length === 1) {
      await kv.set(CHILL_KEY, chillUpdate);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Invalid sync payload format' });
  } catch (error) {
    console.error('Sync API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
