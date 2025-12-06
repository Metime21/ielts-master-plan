
export enum Tab {
  DASHBOARD = 'Dashboard',
  RESOURCES = 'Resources',
  PLANNER = 'Planner',
  CHILL = 'Chill Zone'
}

export enum Mood {
  NEUTRAL = '😐',
  GREAT = '😄',
  TIRED = '😴',
  FIGHTING = '💪',
  ROCKET = '🚀'
}

export interface Task {
  id: string;
  timeRange: string;
  subject: string;
  content: string;
  progress: number; // 0, 25, 50, 75, 100
}

export interface DailyReview {
  readingListening: string;
  speakingWriting: string;
  mood: Mood | null;
}

export interface DayData {
  tasks: Task[];
  review: DailyReview;
}

export interface ResourceLink {
  title: string;
  url?: string;
  description?: string;
  isUpload?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}
