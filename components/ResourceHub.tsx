import React, { useState, useRef, useEffect } from 'react';
import {
  ExternalLink,
  FileText,
  Search,
  Volume2,
  X,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  History,
  Globe,
  Mic,
  BookOpen,
  PenTool,
  Languages,
  Headphones,
  Edit,
  Check,
  LinkIcon,
} from 'lucide-react';
import { generateGeminiResponse } from '../services/geminiService';

interface ResourceItem {
  name: string;
  url?: string;
  isUpload?: boolean;
  note?: string;
}

interface ResourceCollections {
  vocabulary: ResourceItem[];
  listening: ResourceItem[];
  reading: ResourceItem[];
  writing: ResourceItem[];
  speaking: ResourceItem[];
}

interface StoredUploadRecord {
  id: string;
  title: string;
  name: string;
  file: Blob;
  updatedAt: number;
}

interface UploadFileView {
  id: string;
  name: string;
  url: string;
}

const RESOURCE_UPLOAD_DB = 'ielts-master-plan';
const RESOURCE_UPLOAD_STORE = 'resource-uploads';
const RESOURCE_LOCAL_BACKUP_KEY = 'resourceHubLocalBackup';
const DICTIONARY_HISTORY_KEY = 'resourceHubDictionaryHistory';

const DEFAULT_RESOURCES: ResourceCollections = {
  vocabulary: [
    { name: 'YouGlish', url: 'https://youglish.com', note: 'Contextual Pronunciation' },
    { name: 'BuBeiDan (App)', note: 'App Recommendation' },
    { name: 'Vocabulary Lists (PDF)', isUpload: true },
  ],
  listening: [
    { name: 'BBC Learning English', url: 'https://www.youtube.com/@bbclearningenglish/videos', note: 'Global News & Accents' },
    { name: 'VoiceTube', url: 'https://www.voicetube.com/channels/business-and-finance?sortBy=publishedAt&page=1', note: 'Video Dictionary' },
    { name: 'Cambridge Listening Practice', isUpload: true },
  ],
  reading: [{ name: 'Cambridge 11-19 Papers', isUpload: true }],
  writing: [
    { name: 'Simon IELTS', url: 'https://www.bilibili.com/video/BV1fhghzZE8a/', note: 'Band 9 Structures' },
    { name: 'IELTS Liz Essays', url: 'https://ieltsliz.com/ielts-writing-task-2/', note: 'Model Answers' },
  ],
  speaking: [
    { name: 'English with Lucy', url: 'https://www.youtube.com/@EnglishwithLucy', note: 'British Pronunciation' },
    { name: 'IELTS Liz Tips', url: 'https://ieltsliz.com/ielts-speaking-free-lessons-essential-tips/', note: 'Part 1, 2, 3 Strategy' },
  ],
};

const DICTIONARY_SYSTEM_INSTRUCTION = 'You are an expert IELTS vocabulary assistant.';

const buildDictionaryPrompt = (text: string) => `You are a professional IELTS English dictionary. For the word or phrase "${text}", provide ONLY the following information in EXACTLY this format with NO extra text, explanations, greetings, or markdown:
**Part of Speech:** [pos]
**Pronunciation:** [ipa]
**Definition:** [definition]
**Example:** [example_en]
**Example Translation:** [example_zh]
**Chinese:** [translation]
**Bilingual对照:** [chinese] / [english]
**IELTS高频词组 (chunk):** [chunk1], [chunk2], [chunk3]

Rules:
- If input is invalid, respond ONLY: "Invalid input. Please enter a valid English word or phrase."
- NEVER add any other text before, after, or between these lines.
- Each field must appear on its own line starting exactly with "**Field Name:**".
- Do not use bullet points, numbering, or extra spacing.`;

const openUploadDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available'));
      return;
    }

    const request = window.indexedDB.open(RESOURCE_UPLOAD_DB, 1);

    request.onerror = () => reject(request.error || new Error('Failed to open upload database'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RESOURCE_UPLOAD_STORE)) {
        const store = db.createObjectStore(RESOURCE_UPLOAD_STORE, { keyPath: 'id' });
        store.createIndex('title', 'title', { unique: false });
      }
    };
  });

const withUploadStore = async <T,>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => Promise<T>
): Promise<T> => {
  const db = await openUploadDatabase();

  try {
    const transaction = db.transaction(RESOURCE_UPLOAD_STORE, mode);
    const store = transaction.objectStore(RESOURCE_UPLOAD_STORE);
    const result = await action(store);

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Upload transaction failed'));
      transaction.onabort = () => reject(transaction.error || new Error('Upload transaction aborted'));
    });

    return result;
  } finally {
    db.close();
  }
};

const loadStoredUploadRecords = async (title: string): Promise<StoredUploadRecord[]> =>
  withUploadStore('readonly', (store) => {
    const index = store.index('title');

    return new Promise((resolve, reject) => {
      const request = index.getAll(title);
      request.onerror = () => reject(request.error || new Error('Failed to load stored uploads'));
      request.onsuccess = () => {
        const result = Array.isArray(request.result) ? (request.result as StoredUploadRecord[]) : [];
        result.sort((a, b) => a.updatedAt - b.updatedAt);
        resolve(result);
      };
    });
  });

const saveStoredUploadRecord = async (title: string, file: File): Promise<void> =>
  withUploadStore('readwrite', (store) => {
    const record: StoredUploadRecord = {
      id: `${title}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      name: file.name,
      file,
      updatedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const request = store.put(record);
      request.onerror = () => reject(request.error || new Error('Failed to store upload'));
      request.onsuccess = () => resolve();
    });
  });

const deleteStoredUploadRecords = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) {
    return;
  }

  await withUploadStore('readwrite', (store) =>
    Promise.all(
      ids.map(
        (id) =>
          new Promise<void>((resolve, reject) => {
            const request = store.delete(id);
            request.onerror = () => reject(request.error || new Error('Failed to delete upload'));
            request.onsuccess = () => resolve();
          })
      )
    ).then(() => undefined)
  );
};

const loadLocalResourceBackup = (): ResourceCollections | null => {
  try {
    const raw = localStorage.getItem(RESOURCE_LOCAL_BACKUP_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<ResourceCollections>;
    if (
      !parsed ||
      !Array.isArray(parsed.vocabulary) ||
      !Array.isArray(parsed.listening) ||
      !Array.isArray(parsed.reading) ||
      !Array.isArray(parsed.writing) ||
      !Array.isArray(parsed.speaking)
    ) {
      return null;
    }

    return {
      vocabulary: parsed.vocabulary,
      listening: parsed.listening,
      reading: parsed.reading,
      writing: parsed.writing,
      speaking: parsed.speaking,
    };
  } catch (error) {
    console.warn('Failed to parse local resource backup:', error);
    return null;
  }
};

const saveLocalResourceBackup = (resources: ResourceCollections) => {
  try {
    localStorage.setItem(RESOURCE_LOCAL_BACKUP_KEY, JSON.stringify(resources));
  } catch (error) {
    console.warn('Failed to save local resource backup:', error);
  }
};

const loadDictionaryHistory = (): string[] => {
  try {
    const raw = localStorage.getItem(DICTIONARY_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch (error) {
    console.warn('Failed to load dictionary history:', error);
    return [];
  }
};

const saveDictionaryHistory = (history: string[]) => {
  try {
    localStorage.setItem(DICTIONARY_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.warn('Failed to save dictionary history:', error);
  }
};

const requestDictionaryEntry = async (text: string): Promise<string> => {
  try {
    return await generateGeminiResponse(buildDictionaryPrompt(text), DICTIONARY_SYSTEM_INSTRUCTION);
  } catch (error) {
    console.error('Dictionary API Call Error:', error);
    return 'Definition search failed. Please check your API connection or try again.';
  }
};

interface FileManagerProps {
  title: string;
}

const FileManager: React.FC<FileManagerProps> = ({ title }) => {
  const [files, setFiles] = useState<UploadFileView[]>([]);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const mountedRef = useRef(false);

  const replaceFiles = (nextFiles: UploadFileView[]) => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = nextFiles.map((file) => file.url);
    setFiles(nextFiles);
  };

  const reloadFiles = async () => {
    try {
      const stored = await loadStoredUploadRecords(title);
      const nextFiles = stored.map((record) => ({
        id: record.id,
        name: record.name,
        url: URL.createObjectURL(record.file),
      }));

      if (!mountedRef.current) {
        nextFiles.forEach((file) => URL.revokeObjectURL(file.url));
        return;
      }

      replaceFiles(nextFiles);
    } catch (error) {
      console.error(`Failed to load files for "${title}"`, error);
      if (mountedRef.current) {
        replaceFiles([]);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    void reloadFiles();

    return () => {
      mountedRef.current = false;
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
    };
  }, [title]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file && file.type === 'application/pdf') {
      try {
        await saveStoredUploadRecord(title, file);
        await reloadFiles();
      } catch (error) {
        console.error(`Failed to save file for "${title}"`, error);
        alert('Failed to save PDF locally. Please try again.');
      }
    } else if (file) {
      alert('Please upload a PDF file.');
    }

    if (event.target) {
      event.target.value = '';
    }
  };

  const toggleDeleteMode = () => {
    setIsDeleteMode((prev) => !prev);
    setSelectedIds(new Set());
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const deleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      return;
    }

    try {
      await deleteStoredUploadRecords(ids);
      await reloadFiles();
    } catch (error) {
      console.error(`Failed to delete files for "${title}"`, error);
      alert('Failed to delete the selected files. Please try again.');
    } finally {
      setSelectedIds(new Set());
      setIsDeleteMode(false);
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{title}</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1 bg-emerald-100 text-emerald-600 rounded-md hover:bg-emerald-200 transition-colors"
            title="Upload PDF"
          >
            <Plus size={14} />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".pdf"
            onChange={handleFileUpload}
          />
          <button
            onClick={toggleDeleteMode}
            className={`p-1 rounded-md transition-colors ${
              isDeleteMode
                ? 'bg-red-100 text-red-600 ring-1 ring-red-400'
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            }`}
            title={isDeleteMode ? 'Cancel Delete Mode' : 'Manage Files'}
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
        {files.length === 0 ? (
          <div className="text-center py-3 text-[10px] text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
            No files uploaded
          </div>
        ) : (
          files.map((file) => (
            <div
              key={file.id}
              className={`flex items-center gap-2 p-1.5 rounded-lg transition-all ${
                isDeleteMode && selectedIds.has(file.id)
                  ? 'bg-red-50 border border-red-100'
                  : 'bg-white border border-slate-100'
              }`}
            >
              {isDeleteMode ? (
                <button
                  onClick={() => toggleSelection(file.id)}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  {selectedIds.has(file.id) ? (
                    <CheckSquare size={16} className="text-red-500" />
                  ) : (
                    <Square size={16} />
                  )}
                </button>
              ) : (
                <FileText size={14} className="text-blue-500 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0 overflow-hidden">
                {isDeleteMode ? (
                  <span
                    onClick={() => toggleSelection(file.id)}
                    className="text-xs text-slate-700 truncate block cursor-pointer select-none"
                  >
                    {file.name}
                  </span>
                ) : (
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-slate-700 truncate hover:text-blue-600 hover:underline block"
                    title="Click to read PDF"
                  >
                    {file.name}
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      {isDeleteMode && selectedIds.size > 0 && (
        <button
          onClick={deleteSelected}
          className="w-full py-1 bg-red-500 text-white text-[10px] font-bold rounded-md hover:bg-red-600 transition-colors flex items-center justify-center gap-1 animate-fade-in"
        >
          <Trash2 size={10} /> Delete ({selectedIds.size})
        </button>
      )}
    </div>
  );
};

interface ResourceCardProps {
  title: string;
  items: ResourceItem[];
  icon: React.ReactNode;
  headerColor: string;
  onSave: (updatedItems: ResourceItem[]) => void;
}

const ResourceCard: React.FC<ResourceCardProps> = ({
  title,
  items: initialItems,
  icon,
  headerColor,
  onSave,
}) => {
  const [items, setItems] = useState<ResourceItem[]>(initialItems);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const handleAddItem = () => {
    const newItems = [...items, { name: '', url: '', note: 'New Resource' }];
    setItems(newItems);
    onSave(newItems);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    onSave(newItems);
  };

  const handleUpdateItem = (index: number, field: keyof ResourceItem, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'url' && !newItems[index].name && value) {
      try {
        const urlObj = new URL(value);
        let domain = urlObj.hostname.replace('www.', '');
        domain = domain.charAt(0).toUpperCase() + domain.slice(1);
        newItems[index].name = domain;
      } catch {
        // Ignore invalid URLs while editing.
      }
    }

    setItems(newItems);
    onSave(newItems);
  };

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-slate-100 flex flex-col h-full group">
      <div
        className={`px-4 py-2 flex items-center justify-between ${headerColor} transition-colors border-b border-black/5`}
      >
        <div className="flex items-center gap-2.5">
          <div className="bg-white/60 p-1.5 rounded-lg text-slate-800 backdrop-blur-sm shadow-sm">
            {icon}
          </div>
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">{title}</h3>
        </div>
        <button
          onClick={() => setIsEditing((prev) => !prev)}
          className={`p-1.5 rounded-lg transition-colors ${
            isEditing ? 'bg-white text-emerald-600 shadow-sm' : 'hover:bg-white/50 text-slate-600'
          }`}
          title={isEditing ? 'Save Changes' : 'Edit Resources'}
        >
          {isEditing ? <Check size={14} /> : <Edit size={14} />}
        </button>
      </div>
      <div className="p-3 space-y-2 flex-1 bg-white">
        {items.map((item, idx) => (
          <div key={idx} className="group/item">
            {isEditing ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 space-y-2 animate-fade-in relative">
                {item.isUpload ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">PDF Manager (Locked)</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <LinkIcon size={12} className="text-slate-400 flex-shrink-0" />
                      <input
                        value={item.url || ''}
                        onChange={(e) => handleUpdateItem(idx, 'url', e.target.value)}
                        placeholder="https://..."
                        className="flex-1 text-[10px] bg-white border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:border-blue-300"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        value={item.name}
                        onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                        placeholder="Title"
                        className="flex-1 text-xs font-bold bg-white border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:border-blue-300"
                      />
                      <button
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Remove Item"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <input
                      value={item.note || ''}
                      onChange={(e) => handleUpdateItem(idx, 'note', e.target.value)}
                      placeholder="Short Note (Optional)"
                      className="w-full text-[9px] bg-transparent border-b border-slate-200 focus:border-slate-400 text-slate-500 focus:outline-none px-1"
                    />
                  </>
                )}
              </div>
            ) : item.isUpload ? (
              <FileManager title={item.name} />
            ) : (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="block bg-slate-50 border border-slate-200 rounded-xl p-2 hover:border-slate-400 hover:bg-white hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-700 group-hover/item:text-slate-900 transition-colors block truncate">
                      {item.name}
                    </span>
                    {item.note && (
                      <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wide truncate">
                        {item.note}
                      </p>
                    )}
                  </div>
                  <ExternalLink
                    size={12}
                    className="text-slate-300 group-hover/item:text-slate-600 transition-colors flex-shrink-0 ml-2"
                  />
                </div>
              </a>
            )}
          </div>
        ))}
        {isEditing && (
          <button
            onClick={handleAddItem}
            className="w-full py-1.5 mt-2 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:text-slate-600 hover:border-slate-400 hover:bg-slate-50 text-xs font-medium flex items-center justify-center gap-1 transition-all"
          >
            <Plus size={14} /> Add Resource
          </button>
        )}
      </div>
    </div>
  );
};

const DictionaryWidget: React.FC = () => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>(() => loadDictionaryHistory());
  const [showHistory, setShowHistory] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setShowHistory(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    saveDictionaryHistory(history);
  }, [history]);

  const performSearch = async (text: string) => {
    const normalizedText = text.trim();
    if (!normalizedText) {
      return;
    }

    setLoading(true);
    setResult(null);
    setShowHistory(false);
    setHistory((prev) => [normalizedText, ...prev.filter((item) => item !== normalizedText)].slice(0, 5));

    try {
      const data = await requestDictionaryEntry(normalizedText);
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchClick = () => {
    void performSearch(query);
  };

  const handleHistorySelect = (item: string) => {
    setQuery(item);
    void performSearch(item);
  };

  const openGoogleTranslate = () => {
    const text = query.trim();
    window.open(`https://translate.google.com/?sl=en&tl=zh-CN&text=${encodeURIComponent(text)}`, '_blank');
  };

  const speak = () => {
    const text = query.trim();
    if (!text || !('speechSynthesis' in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const parseResult = (raw: string): Record<string, string> | null => {
    const parsed: Record<string, string> = {};
    const lines = raw.split('\n');

    for (const line of lines) {
      if (line.startsWith('**Part of Speech:**')) {
        parsed.pos = line.replace('**Part of Speech:**', '').trim();
      } else if (line.startsWith('**Pronunciation:**')) {
        parsed.pronunciation = line.replace('**Pronunciation:**', '').trim();
      } else if (line.startsWith('**Definition:**')) {
        parsed.definition = line.replace('**Definition:**', '').trim();
      } else if (line.startsWith('**Example:**')) {
        parsed.exampleEn = line.replace('**Example:**', '').trim();
      } else if (line.startsWith('**Example Translation:**')) {
        parsed.exampleZh = line.replace('**Example Translation:**', '').trim();
      } else if (line.startsWith('**Chinese:**')) {
        parsed.chinese = line.replace('**Chinese:**', '').trim();
      } else if (line.startsWith('**Bilingual对照:**')) {
        parsed.bilingual = line.replace('**Bilingual对照:**', '').trim();
      } else if (line.startsWith('**IELTS高频词组 (chunk):**')) {
        parsed.chunks = line.replace('**IELTS高频词组 (chunk):**', '').trim();
      }
    }

    return Object.keys(parsed).length > 0 ? parsed : null;
  };

  const parsedResult = result ? parseResult(result) : null;

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 h-fit" ref={historyRef}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Search size={14} /> Smart Dictionary
        </h3>
        <button
          onClick={openGoogleTranslate}
          className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-1 rounded-full hover:bg-blue-100 transition-colors flex items-center gap-1"
        >
          <Globe size={10} /> Google
        </button>
      </div>
      <div className="relative mb-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setShowHistory(true)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchClick()}
              placeholder="Enter an English word or phrase..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm font-medium"
            />
            {showHistory && history.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
                <div className="text-[10px] font-bold text-slate-400 px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-1">
                  <History size={10} /> RECENT SEARCHES
                </div>
                <ul>
                  {history.map((item, idx) => (
                    <li
                      key={idx}
                      onClick={() => handleHistorySelect(item)}
                      className="px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-none flex justify-between items-center group"
                    >
                      {item}
                      <ExternalLink size={12} className="opacity-0 group-hover:opacity-60" />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <button
            onClick={handleSearchClick}
            disabled={loading || !query.trim()}
            className="bg-slate-800 hover:bg-slate-900 text-white px-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center min-w-[60px]"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Go'
            )}
          </button>
        </div>
      </div>
      {result && (
        <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-4 border border-slate-200 relative animate-fade-in">
          <button
            onClick={() => setResult(null)}
            className="absolute top-2 right-2 text-slate-300 hover:text-slate-500"
          >
            <X size={14} />
          </button>
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-lg font-bold text-slate-800">{query}</h4>
            <button
              onClick={speak}
              className="text-slate-500 hover:text-slate-800 transition-colors"
              title="Pronounce"
            >
              <Volume2 size={16} />
            </button>
          </div>
          {parsedResult ? (
            <div className="space-y-2 text-sm">
              {parsedResult.pos && (
                <div>
                  <span className="font-semibold text-slate-600">Part of Speech:</span>{' '}
                  <span className="text-slate-800">{parsedResult.pos}</span>
                </div>
              )}
              {parsedResult.pronunciation && (
                <div>
                  <span className="font-semibold text-slate-600">Pronunciation:</span>{' '}
                  <span className="text-slate-800">{parsedResult.pronunciation}</span>
                </div>
              )}
              {parsedResult.definition && (
                <div>
                  <span className="font-semibold text-slate-600">Definition:</span>{' '}
                  <span className="text-slate-800">{parsedResult.definition}</span>
                </div>
              )}
              {parsedResult.exampleEn && (
                <div>
                  <span className="font-semibold text-slate-600">Example:</span>{' '}
                  <span className="text-slate-800 italic">"{parsedResult.exampleEn}"</span>
                </div>
              )}
              {parsedResult.exampleZh && (
                <div>
                  <span className="font-semibold text-slate-600">Translation:</span>{' '}
                  <span className="text-slate-800">{parsedResult.exampleZh}</span>
                </div>
              )}
              {parsedResult.chinese && (
                <div>
                  <span className="font-semibold text-slate-600">Chinese:</span>{' '}
                  <span className="text-slate-800">{parsedResult.chinese}</span>
                </div>
              )}
              {parsedResult.bilingual && (
                <div>
                  <span className="font-semibold text-slate-600">Bilingual对照:</span>{' '}
                  <span className="text-slate-800">{parsedResult.bilingual}</span>
                </div>
              )}
              {parsedResult.chunks && (
                <div>
                  <span className="font-semibold text-slate-600">IELTS高频词组:</span>{' '}
                  <span className="text-slate-800">{parsedResult.chunks}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-slate-600 whitespace-pre-wrap leading-relaxed">{result}</div>
          )}
        </div>
      )}
    </div>
  );
};

const StudyTimer: React.FC = () => {
  const [mode, setMode] = useState<'timer' | 'stopwatch'>('timer');
  const [status, setStatus] = useState<'idle' | 'running' | 'paused'>('idle');
  const [h, setH] = useState('00');
  const [m, setM] = useState('25');
  const [s, setS] = useState('00');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [stopwatchTime, setStopwatchTime] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  const initAudioContext = () => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioContextRef.current = new AudioContextClass();
      }
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (status === 'running') {
      interval = setInterval(() => {
        if (mode === 'timer') {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              if (interval) {
                clearInterval(interval);
              }
              setStatus('idle');
              playAppleRadarAlarm();
              return 0;
            }
            return prev - 1;
          });
        } else {
          setStopwatchTime((prev) => prev + 1);
        }
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [status, mode]);

  const playAppleRadarAlarm = () => {
    try {
      if (!audioContextRef.current) {
        initAudioContext();
      }

      const ctx = audioContextRef.current;
      if (!ctx) {
        return;
      }

      if (ctx.state === 'suspended') {
        void ctx.resume();
      }

      const now = ctx.currentTime;
      const playPulse = (time: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1200, time);
        osc.frequency.exponentialRampToValueAtTime(800, time + 0.1);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.3, time + 0.01);
        gain.gain.linearRampToValueAtTime(0, time + 0.1);
        osc.start(time);
        osc.stop(time + 0.1);
      };

      for (let loop = 0; loop < 4; loop += 1) {
        const base = now + loop * 1.5;
        playPulse(base);
        playPulse(base + 0.15);
        playPulse(base + 0.3);
      }
    } catch (error) {
      console.error('Audio alarm failed:', error);
    }
  };

  const handleStart = () => {
    initAudioContext();

    if (mode === 'timer') {
      if (status === 'idle') {
        const totalSec = parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10);
        if (totalSec <= 0) {
          return;
        }
        setTimeLeft(totalSec);
        setStatus('running');
        return;
      }

      if (timeLeft > 0) {
        setStatus('running');
      }
      return;
    }

    setStatus('running');
  };

  const handlePause = () => setStatus('paused');

  const handleReset = () => {
    setStatus('idle');
    if (mode === 'stopwatch') {
      setStopwatchTime(0);
      return;
    }

    const totalSec = parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10);
    setTimeLeft(totalSec > 0 ? totalSec : 0);
  };

  const formatTime = (totalSec: number) => {
    const hh = Math.floor(totalSec / 3600);
    const mm = Math.floor((totalSec % 3600) / 60);
    const ss = totalSec % 60;

    if (hh > 0) {
      return `${hh}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
    }

    return `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
  };

  const handleInputChange = (
    val: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
    max: number
  ) => {
    let num = parseInt(val.replace(/\D/g, ''), 10) || 0;
    if (num > max) {
      num = max;
    }
    setter(num.toString().padStart(2, '0'));
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 overflow-hidden">
      <div className="bg-slate-100 p-1 rounded-lg flex mb-8">
        <button
          onClick={() => {
            setMode('timer');
            setStatus('idle');
          }}
          className={`flex-1 py-1 rounded-md text-xs font-bold transition-all ${
            mode === 'timer' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'
          }`}
        >
          Timer
        </button>
        <button
          onClick={() => {
            setMode('stopwatch');
            setStatus('idle');
          }}
          className={`flex-1 py-1 rounded-md text-xs font-bold transition-all ${
            mode === 'stopwatch' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'
          }`}
        >
          Stopwatch
        </button>
      </div>
      <div className="flex justify-center items-center h-24 mb-6">
        {mode === 'timer' && status === 'idle' ? (
          <div className="flex items-center text-5xl font-light text-slate-800 tracking-tight gap-1">
            <input
              value={h}
              onChange={(e) => handleInputChange(e.target.value, setH, 99)}
              onFocus={(e) => e.target.select()}
              className="w-16 text-center bg-transparent hover:bg-slate-50 focus:bg-slate-100 rounded-lg outline-none transition-colors"
              placeholder="00"
            />
            <span className="text-slate-300 -mt-2">:</span>
            <input
              value={m}
              onChange={(e) => handleInputChange(e.target.value, setM, 59)}
              onFocus={(e) => e.target.select()}
              className="w-16 text-center bg-transparent hover:bg-slate-50 focus:bg-slate-100 rounded-lg outline-none transition-colors"
              placeholder="00"
            />
            <span className="text-slate-300 -mt-2">:</span>
            <input
              value={s}
              onChange={(e) => handleInputChange(e.target.value, setS, 59)}
              onFocus={(e) => e.target.select()}
              className="w-16 text-center bg-transparent hover:bg-slate-50 focus:bg-slate-100 rounded-lg outline-none transition-colors"
              placeholder="00"
            />
          </div>
        ) : (
          <div className="text-6xl font-light text-slate-800 tabular-nums tracking-tight">
            {mode === 'timer' ? formatTime(timeLeft) : formatTime(stopwatchTime)}
          </div>
        )}
      </div>
      <div className="flex justify-between items-center px-4">
        <button
          onClick={handleReset}
          className="w-16 h-16 rounded-full bg-slate-100 text-slate-500 font-medium text-sm hover:bg-slate-200 transition-colors active:scale-95 flex items-center justify-center border border-slate-200"
        >
          {status === 'idle' && mode === 'timer' ? 'Clear' : 'Cancel'}
        </button>
        {status === 'running' ? (
          <button
            onClick={handlePause}
            className="w-16 h-16 rounded-full bg-orange-100 text-orange-600 font-medium text-sm hover:bg-orange-200 transition-colors active:scale-95 flex items-center justify-center border border-orange-200"
          >
            Pause
          </button>
        ) : (
          <button
            onClick={handleStart}
            className="w-16 h-16 rounded-full bg-green-100 text-green-600 font-medium text-sm hover:bg-green-200 transition-colors active:scale-95 flex items-center justify-center border border-green-200"
          >
            {status === 'paused' ? 'Resume' : 'Start'}
          </button>
        )}
      </div>
    </div>
  );
};

const ResourceHub: React.FC = () => {
  const [resources, setResources] = useState<ResourceCollections>(DEFAULT_RESOURCES);

  useEffect(() => {
    const loadSyncData = async () => {
      const localBackup = loadLocalResourceBackup();

      try {
        const res = await fetch('/api/sync', { cache: 'no-store' });
        if (!res.ok) {
          throw new Error('Network response not ok');
        }

        const data = await res.json();
        const hub = data?.resourceHub;

        const nextResources: ResourceCollections = {
          vocabulary: Array.isArray(hub?.vocabulary) ? hub.vocabulary : localBackup?.vocabulary || DEFAULT_RESOURCES.vocabulary,
          listening: Array.isArray(hub?.listening) ? hub.listening : localBackup?.listening || DEFAULT_RESOURCES.listening,
          reading: Array.isArray(hub?.reading) ? hub.reading : localBackup?.reading || DEFAULT_RESOURCES.reading,
          writing: Array.isArray(hub?.writing) ? hub.writing : localBackup?.writing || DEFAULT_RESOURCES.writing,
          speaking: Array.isArray(hub?.speaking) ? hub.speaking : localBackup?.speaking || DEFAULT_RESOURCES.speaking,
        };

        setResources(nextResources);
        saveLocalResourceBackup(nextResources);
      } catch (error) {
        console.error('Sync load failed:', error);
        if (localBackup) {
          setResources(localBackup);
        }
      }
    };

    void loadSyncData();
  }, []);

  const saveAllResources = async (newResources: ResourceCollections) => {
    saveLocalResourceBackup(newResources);

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newResources),
      });

      if (!res.ok) {
        console.error('Sync save failed:', await res.text());
      }
    } catch (error) {
      console.error('Sync save error:', error);
    }
  };

  return (
    <div className="animate-fade-in max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row justify-between items-end mb-6 px-2">
        <div>
          <h2 className="text-3xl font-extrabold text-academic-900 tracking-tight">Resource Hub</h2>
          <p className="text-slate-500 mt-1 flex items-center gap-2 text-sm">Curated materials for band 8.0+</p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-5">
          <ResourceCard
            title="Vocabulary"
            icon={<Languages size={18} className="text-emerald-700" />}
            headerColor="bg-[#A4C3B2]/30"
            items={resources.vocabulary}
            onSave={(updatedItems) => {
              const newResources = { ...resources, vocabulary: updatedItems };
              setResources(newResources);
              void saveAllResources(newResources);
            }}
          />
          <ResourceCard
            title="Listening"
            icon={<Headphones size={18} className="text-blue-700" />}
            headerColor="bg-[#9BB7D4]/30"
            items={resources.listening}
            onSave={(updatedItems) => {
              const newResources = { ...resources, listening: updatedItems };
              setResources(newResources);
              void saveAllResources(newResources);
            }}
          />
          <ResourceCard
            title="Reading"
            icon={<BookOpen size={18} className="text-rose-700" />}
            headerColor="bg-[#D4A5A5]/30"
            items={resources.reading}
            onSave={(updatedItems) => {
              const newResources = { ...resources, reading: updatedItems };
              setResources(newResources);
              void saveAllResources(newResources);
            }}
          />
          <ResourceCard
            title="Writing"
            icon={<PenTool size={18} className="text-yellow-700" />}
            headerColor="bg-[#EAD18F]/30"
            items={resources.writing}
            onSave={(updatedItems) => {
              const newResources = { ...resources, writing: updatedItems };
              setResources(newResources);
              void saveAllResources(newResources);
            }}
          />
          <ResourceCard
            title="Speaking"
            icon={<Mic size={18} className="text-orange-700" />}
            headerColor="bg-[#E6B89C]/30"
            items={resources.speaking}
            onSave={(updatedItems) => {
              const newResources = { ...resources, speaking: updatedItems };
              setResources(newResources);
              void saveAllResources(newResources);
            }}
          />
        </div>
        <div className="lg:col-span-4 space-y-5">
          <StudyTimer />
          <DictionaryWidget />
        </div>
      </div>
    </div>
  );
};

export default ResourceHub;
