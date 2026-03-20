import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Edit3,
  Save,
  CheckCircle2,
  Calendar as CalendarIcon,
  Target,
} from 'lucide-react';
import { Task, DailyReview, Mood, DayData } from '../types';
import { loadPlannerData, savePlannerData } from '../utils/plannerStorage';

const getDaysInMonth = (year: number, month: number) =>
  new Date(year, month + 1, 0).getDate();

const getFirstDayOfMonth = (year: number, month: number) =>
  new Date(year, month, 1).getDay();

const formatDateKey = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
};

const INITIAL_TASKS: Task[] = [
  { id: '1', timeRange: '08:00 - 09:00', subject: 'Listening', content: 'Cambridge Practice', progress: 0 },
  { id: '2', timeRange: '10:15 - 11:30', subject: 'Reading', content: 'Passage 1-2 Focus', progress: 0 },
  { id: '3', timeRange: '15:30 - 16:30', subject: 'Writing', content: 'Task 1 Analysis', progress: 0 },
  { id: '4', timeRange: '16:30 - 17:00', subject: 'Speaking', content: 'Part 2 Practice', progress: 0 },
];

const INITIAL_REVIEW: DailyReview = {
  readingListening: '',
  speakingWriting: '',
  mood: null,
};

const MORANDI_BORDERS = [
  'border-[#E6B89C]',
  'border-[#A4C3B2]',
  'border-[#9BB7D4]',
  'border-[#EAD18F]',
];

const createDefaultTasks = (): Task[] =>
  INITIAL_TASKS.map((task) => ({
    ...task,
  }));

const createDefaultDayData = (): DayData => ({
  tasks: createDefaultTasks(),
  review: { ...INITIAL_REVIEW },
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const sanitizeProgress = (value: unknown): number => {
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
};

const sanitizeTask = (value: unknown, fallback: Task): Task => {
  if (!isPlainObject(value)) {
    return { ...fallback };
  }

  return {
    id: typeof value.id === 'string' ? value.id : fallback.id,
    timeRange: typeof value.timeRange === 'string' ? value.timeRange : fallback.timeRange,
    subject: typeof value.subject === 'string' ? value.subject : fallback.subject,
    content: typeof value.content === 'string' ? value.content : fallback.content,
    progress: sanitizeProgress(value.progress),
  };
};

const sanitizeReview = (value: unknown): DailyReview => {
  if (!isPlainObject(value)) {
    return { ...INITIAL_REVIEW };
  }

  const moodValue = value.mood;
  const validMood =
    typeof moodValue === 'string' && Object.values(Mood).includes(moodValue as Mood)
      ? (moodValue as Mood)
      : null;

  return {
    readingListening:
      typeof value.readingListening === 'string' ? value.readingListening : '',
    speakingWriting:
      typeof value.speakingWriting === 'string' ? value.speakingWriting : '',
    mood: validMood,
  };
};

const sanitizeDayData = (value: unknown): DayData => {
  if (!isPlainObject(value)) {
    return createDefaultDayData();
  }

  const rawTasks = Array.isArray(value.tasks) ? value.tasks : [];
  const tasks = INITIAL_TASKS.map((fallbackTask, index) =>
    sanitizeTask(rawTasks[index], fallbackTask)
  );

  return {
    tasks,
    review: sanitizeReview(value.review),
  };
};

const sanitizeHistory = (value: unknown): Record<string, DayData> => {
  if (!isPlainObject(value)) {
    return {};
  }

  const history: Record<string, DayData> = {};
  for (const [key, dayValue] of Object.entries(value)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
      history[key] = sanitizeDayData(dayValue);
    }
  }

  return history;
};

const hasMeaningfulReview = (review: DailyReview) =>
  review.mood !== null ||
  review.readingListening.trim() !== '' ||
  review.speakingWriting.trim() !== '';

const isTaskDifferentFromTemplate = (task: Task, template: Task) =>
  task.timeRange !== template.timeRange ||
  task.subject !== template.subject ||
  task.content !== template.content ||
  task.progress !== template.progress;

const hasMeaningfulTaskChanges = (tasks: Task[]) =>
  tasks.some((task, index) => isTaskDifferentFromTemplate(task, INITIAL_TASKS[index]));

const hasMeaningfulDayData = (dayData: DayData) =>
  hasMeaningfulReview(dayData.review) || hasMeaningfulTaskChanges(dayData.tasks);

async function loadFromAPI(): Promise<Record<string, DayData>> {
  const localHistory = sanitizeHistory(loadPlannerData());

  try {
    const res = await fetch('/api/sync', { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const fullData = await res.json();
    const remoteHistory = sanitizeHistory(fullData?.planner);

    if (Object.keys(localHistory).length > 0) {
      return { ...remoteHistory, ...localHistory };
    }

    return remoteHistory;
  } catch (error) {
    console.warn('Failed to load from /api/sync:', error);
    return localHistory;
  }
}

async function saveToAPI(history: Record<string, DayData>): Promise<void> {
  savePlannerData(history as Record<string, unknown>);

  const cleanedHistory: Record<string, DayData> = {};
  for (const [key, dayData] of Object.entries(history)) {
    if (hasMeaningfulDayData(dayData)) {
      cleanedHistory[key] = dayData;
    }
  }

  if (Object.keys(cleanedHistory).length === 0) {
    return;
  }

  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanedHistory),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (error) {
    console.error('Sync failed (data kept locally):', error);
  }
}

const SmartPlanner: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [history, setHistory] = useState<Record<string, DayData>>({});
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    loadFromAPI().then((data) => {
      if (isMounted) {
        setHistory(data);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const dateKey = formatDateKey(selectedDate);
  const currentData: DayData = history[dateKey] ?? createDefaultDayData();

  const updateHistory = (tasks: Task[], review: DailyReview) => {
    setHistory((prev) => {
      const newHistory = { ...prev, [dateKey]: { tasks, review } };
      void saveToAPI(newHistory);
      return newHistory;
    });
  };

  const handleTaskChange = (
    taskId: string,
    field: keyof Task,
    value: string | number
  ) => {
    const newTasks = currentData.tasks.map((task) =>
      task.id === taskId ? { ...task, [field]: value } : task
    );
    updateHistory(newTasks, currentData.review);
  };

  const setTaskProgress = (taskId: string, progress: number) => {
    const newTasks = currentData.tasks.map((task) =>
      task.id === taskId ? { ...task, progress } : task
    );
    updateHistory(newTasks, currentData.review);
  };

  const handleProgressClick = (
    e: React.MouseEvent<HTMLDivElement>,
    taskId: string
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const percent = x / width;

    let newProgress = 0;
    if (percent <= 0.125) newProgress = 0;
    else if (percent <= 0.375) newProgress = 25;
    else if (percent <= 0.625) newProgress = 50;
    else if (percent <= 0.875) newProgress = 75;
    else newProgress = 100;

    setTaskProgress(taskId, newProgress);
  };

  const handleReviewChange = (
    field: keyof DailyReview,
    value: string | Mood | null
  ) => {
    const newReview = { ...currentData.review, [field]: value };
    updateHistory(currentData.tasks, newReview);
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + offset,
      1
    );
    setCurrentDate(newDate);
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const todayKey = formatDateKey(new Date());

  const renderCalendarDays = () => {
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-6 w-6" />);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const key = formatDateKey(date);
      const isSelected = key === dateKey;
      const isToday = key === todayKey;
      const hasData = !!history[key];

      days.push(
        <button
          key={key}
          onClick={() => setSelectedDate(date)}
          className="relative h-7 w-7 flex flex-col items-center justify-center rounded-full text-[10px] font-medium transition-all"
        >
          <div
            className={`h-6 w-6 flex items-center justify-center rounded-full transition-colors duration-200 ${
              isToday
                ? 'bg-red-500 text-white shadow-md'
                : isSelected
                ? 'bg-academic-800 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {d}
          </div>
          {hasData && !isSelected && !isToday && (
            <span className="absolute bottom-0.5 w-0.5 h-0.5 bg-slate-400 rounded-full"></span>
          )}
        </button>
      );
    }

    return days;
  };

  const getProgressColor = (val: number) => {
    if (val === 0) return 'bg-slate-200';
    if (val === 25) return 'bg-red-400';
    if (val === 50) return 'bg-orange-400';
    if (val === 75) return 'bg-blue-400';
    return 'bg-green-500';
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-in pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-end justify-between px-2">
            <div>
              <h2 className="text-3xl font-extrabold text-academic-900 tracking-tight">
                Daily Review
              </h2>
              <p className="text-slate-500 font-medium mt-1 flex items-center gap-1 text-sm">
                <Edit3 size={14} /> Reflect, Learn, Improve.
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black text-slate-200 tracking-tighter leading-none">
                {selectedDate.getDate()}
              </div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                {monthNames[selectedDate.getMonth()]}
              </div>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-6 border border-white/60 shadow-xl bg-white/90 backdrop-blur-xl">
            <div className="mb-6 p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 block">
                Mood Check
              </label>
              <div className="flex gap-4 justify-between sm:justify-start">
                {Object.values(Mood).map((m) => (
                  <button
                    key={m}
                    onClick={() => handleReviewChange('mood', m)}
                    className={`text-4xl w-16 h-16 flex items-center justify-center rounded-full transition-all transform hover:scale-110 ${
                      currentData.review.mood === m
                        ? 'bg-white ring-2 ring-accent-400 scale-110 shadow-lg'
                        : 'hover:bg-white/80 grayscale opacity-60 hover:grayscale-0 hover:opacity-100'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="group bg-white rounded-3xl p-5 border border-slate-100 focus-within:ring-2 focus-within:ring-academic-100 focus-within:border-academic-200 transition-all shadow-sm hover:shadow-md">
                <label className="text-xs font-bold text-academic-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400"></span> Reading & Listening Analysis
                </label>
                <textarea
                  className="w-full bg-transparent border-none focus:ring-0 text-slate-700 text-base leading-relaxed h-60 resize-none placeholder:text-slate-300"
                  placeholder="Detailed breakdown of mistakes, synonyms found, or tricky accents encountered..."
                  value={currentData.review.readingListening}
                  onChange={(e) =>
                    handleReviewChange('readingListening', e.target.value)
                  }
                />
              </div>

              <div className="group bg-white rounded-3xl p-5 border border-slate-100 focus-within:ring-2 focus-within:ring-academic-100 focus-within:border-academic-200 transition-all shadow-sm hover:shadow-md">
                <label className="text-xs font-bold text-academic-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-pink-400"></span> Speaking & Writing Notes
                </label>
                <textarea
                  className="w-full bg-transparent border-none focus:ring-0 text-slate-700 text-base leading-relaxed h-60 resize-none placeholder:text-slate-300"
                  placeholder="New idioms, grammar corrections, or ideas for Task 2 topics..."
                  value={currentData.review.speakingWriting}
                  onChange={(e) =>
                    handleReviewChange('speakingWriting', e.target.value)
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden relative group hover:shadow-xl transition-shadow">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-academic-500 via-indigo-400 to-accent-400"></div>
            <div className="p-4 pt-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <CalendarIcon size={12} className="text-accent-500" />
                  {monthNames[month]}{' '}
                  <span className="text-slate-400 font-normal">{year}</span>
                </h3>
                <div className="flex gap-1">
                  <button
                    onClick={() => changeMonth(-1)}
                    className="p-0.5 hover:bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => changeMonth(1)}
                    className="p-0.5 hover:bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-y-1 justify-items-center mb-1 border-b border-slate-50 pb-1">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <span
                    key={i}
                    className="text-[8px] font-bold text-slate-300 uppercase tracking-wider"
                  >
                    {day}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-y-1 justify-items-center">
                {renderCalendarDays()}
              </div>
            </div>
          </div>

          <div className="rounded-3xl pt-2">
            <div className="flex items-center justify-between px-2 mb-3">
              <h3 className="text-sm font-bold text-academic-900 flex items-center gap-2">
                <Target size={16} className="text-accent-500" /> Schedule
              </h3>
              <span className="text-[9px] font-bold bg-white px-1.5 py-0.5 rounded-full text-slate-500 border border-slate-200 shadow-sm">
                {currentData.tasks.filter((t) => t.progress === 100).length}/4
              </span>
            </div>

            <div className="space-y-5">
              {currentData.tasks.map((task, index) => (
                <div
                  key={task.id}
                  className={`bg-white rounded-2xl p-6 shadow-sm border-l-4 hover:shadow-md transition-all group ${
                    MORANDI_BORDERS[index % MORANDI_BORDERS.length].replace(
                      'border-',
                      'border-l-'
                    )
                  }`}
                >
                  <div className="flex justify-between items-start mb-3 gap-2">
                    {editingTaskId === task.id ? (
                      <div className="w-full space-y-2">
                        <input
                          className="w-full text-[10px] font-bold text-slate-500 bg-slate-50 rounded px-1 py-0.5"
                          value={task.timeRange}
                          onChange={(e) =>
                            handleTaskChange(task.id, 'timeRange', e.target.value)
                          }
                          placeholder="Time"
                        />
                        <input
                          className="w-full text-xs font-bold text-academic-900 bg-slate-50 rounded px-1 py-0.5"
                          value={task.subject}
                          onChange={(e) =>
                            handleTaskChange(task.id, 'subject', e.target.value)
                          }
                          placeholder="Subject"
                        />
                        <textarea
                          className="w-full text-lg font-medium text-slate-700 bg-slate-50 rounded px-1 py-1 resize-none"
                          rows={2}
                          value={task.content}
                          onChange={(e) =>
                            handleTaskChange(task.id, 'content', e.target.value)
                          }
                          placeholder="Content details..."
                        />
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center pr-1 mb-1">
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide bg-slate-50 inline-block px-1 py-0.5 rounded">
                            {task.timeRange}
                          </div>
                          {task.progress === 100 && (
                            <CheckCircle2
                              size={12}
                              className="text-green-500 flex-shrink-0"
                            />
                          )}
                        </div>
                        <div className="text-xs font-bold text-academic-800 truncate mb-1">
                          {task.subject}
                        </div>
                        <div className="text-lg font-medium text-slate-700 leading-snug break-words">
                          {task.content}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() =>
                        setEditingTaskId(editingTaskId === task.id ? null : task.id)
                      }
                      className="text-slate-300 hover:text-academic-500 transition-colors p-0.5 flex-shrink-0 mt-1"
                    >
                      {editingTaskId === task.id ? (
                        <Save size={14} />
                      ) : (
                        <Edit3 size={14} />
                      )}
                    </button>
                  </div>

                  <div
                    className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden cursor-pointer relative group/progress mt-4"
                    onClick={(e) => handleProgressClick(e, task.id)}
                    title="Click to set progress (0%, 25%, 50%, 75%, 100%)"
                  >
                    <div className="absolute inset-0 flex opacity-0 group-hover/progress:opacity-20 transition-opacity z-10">
                      <div className="w-[12.5%] h-full"></div>
                      <div className="w-[25%] h-full border-r border-black"></div>
                      <div className="w-[25%] h-full border-r border-black"></div>
                      <div className="w-[25%] h-full border-r border-black"></div>
                      <div className="w-[12.5%] h-full"></div>
                    </div>
                    <div
                      className={`h-full transition-all duration-300 ease-out ${getProgressColor(
                        task.progress
                      )}`}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartPlanner;
