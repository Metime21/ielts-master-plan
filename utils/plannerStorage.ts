export const PLANNER_STORAGE_KEY = 'plannerLocalHistory';

type PlannerStorageShape = Record<string, unknown>;

const isPlainObject = (value: unknown): value is PlannerStorageShape =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const loadPlannerData = (): PlannerStorageShape => {
  try {
    const raw = localStorage.getItem(PLANNER_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return isPlainObject(parsed) ? parsed : {};
  } catch (error) {
    console.warn('Failed to load planner data from localStorage', error);
    return {};
  }
};

export const savePlannerData = (data: PlannerStorageShape) => {
  try {
    localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to save planner data to localStorage', error);
  }
};
