// src/utils/plannerStorage.ts
export const loadPlannerData = (): Record<string, any> => {
  try {
    const data = localStorage.getItem('ielts-planner-data');
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.warn('Failed to load planner data from localStorage', e);
    return {};
  }
};

export const savePlannerData = (data: Record<string, any>) => {
  try {
    localStorage.setItem('ielts-planner-data', JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save planner data to localStorage', e);
  }
};
