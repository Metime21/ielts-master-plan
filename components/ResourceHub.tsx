
import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink, FileText, Search, Volume2, X, Plus, Trash2, CheckSquare, Square, History, Globe, Mic, BookOpen, PenTool, Languages, Headphones, Edit, Check, Link as LinkIcon } from 'lucide-react';
// --- API Helper Function (Added Here) ---
const translateAndDefine = async (text: string): Promise<string> => {
    // 明确告诉 AI 你的要求，确保回复结构清晰
    const prompt = `Provide a concise dictionary definition, part of speech, and a simple Chinese translation for the English word or phrase: "${text}". Format the response clearly using bullet points or paragraphs.`;

    try {
        // 这是调用 Next.js /api/gemini 代理的代码
        const fetchResponse = await fetch('/api/gemini', { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
            }),
        });
        
        if (!fetchResponse.ok) {
            throw new Error(`API Proxy Error: ${fetchResponse.statusText}`);
        }

        const data = await fetchResponse.json();
        // 从代理返回的完整 response 对象中提取 text
        const resultText = data.response.text; 
        
        return resultText; 
    } catch (error) {
        console.error("Dictionary API Call Error:", error);
        return "Definition search failed. Please check your API connection or try again.";
    }
};

// --- Sub-components ---

// FileManager Component: Handles Upload, View, and Delete logic
interface FileManagerProps {
  title: string;
}

const FileManager: React.FC<FileManagerProps> = ({ title }) => {
  const [files, setFiles] = useState<{ name: string; url: string }[]>([]);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "application/pdf") {
      const fileUrl = URL.createObjectURL(file);
      setFiles(prev => [...prev, { name: file.name, url: fileUrl }]);
    } else if (file) {
      alert("Please upload a PDF file.");
    }
    if (event.target) event.target.value = '';
  };

  const toggleDeleteMode = () => {
    setIsDeleteMode(!isDeleteMode);
    setSelectedIndices(new Set());
  };

  const toggleSelection = (index: number) => {
    const newSelection = new Set(selectedIndices);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedIndices(newSelection);
  };

  const deleteSelected = () => {
    setFiles(files.filter((_, idx) => !selectedIndices.has(idx)));
    setSelectedIndices(new Set());
    setIsDeleteMode(false);
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
            title={isDeleteMode ? "Cancel Delete Mode" : "Manage Files"}
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
          files.map((file, idx) => (
            <div 
              key={idx} 
              className={`flex items-center gap-2 p-1.5 rounded-lg transition-all ${
                isDeleteMode && selectedIndices.has(idx) ? 'bg-red-50 border border-red-100' : 'bg-white border border-slate-100'
              }`}
            >
              {isDeleteMode ? (
                <button 
                  onClick={() => toggleSelection(idx)}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  {selectedIndices.has(idx) ? (
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
                    onClick={() => toggleSelection(idx)}
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

      {isDeleteMode && selectedIndices.size > 0 && (
        <button 
          onClick={deleteSelected}
          className="w-full py-1 bg-red-500 text-white text-[10px] font-bold rounded-md hover:bg-red-600 transition-colors flex items-center justify-center gap-1 animate-fade-in"
        >
          <Trash2 size={10} /> Delete ({selectedIndices.size})
        </button>
      )}
    </div>
  );
};

interface ResourceItem {
  name: string;
  url?: string;
  isUpload?: boolean;
  note?: string;
}

interface ResourceCardProps {
  title: string;
  items: ResourceItem[];
  icon: React.ReactNode;
  headerColor: string; // Tailwind bg class
}

const ResourceCard: React.FC<ResourceCardProps> = ({ title, items: initialItems, icon, headerColor }) => {
  const [items, setItems] = useState<ResourceItem[]>(initialItems);
  const [isEditing, setIsEditing] = useState(false);

  const handleAddItem = () => {
    setItems([...items, { name: '', url: '', note: 'New Resource' }]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const handleUpdateItem = (index: number, field: keyof ResourceItem, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Smart Identify: Auto-fill title from URL if title is empty
    if (field === 'url' && !newItems[index].name && value) {
      try {
        const urlObj = new URL(value);
        let domain = urlObj.hostname.replace('www.', '');
        domain = domain.charAt(0).toUpperCase() + domain.slice(1);
        newItems[index].name = domain;
      } catch (e) {
        // Invalid URL, ignore
      }
    }

    setItems(newItems);
  };

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-slate-100 flex flex-col h-full group">
      {/* Morandi Header */}
      <div className={`px-4 py-2 flex items-center justify-between ${headerColor} transition-colors border-b border-black/5`}>
        <div className="flex items-center gap-2.5">
          <div className="bg-white/60 p-1.5 rounded-lg text-slate-800 backdrop-blur-sm shadow-sm">
             {icon}
          </div>
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">{title}</h3>
        </div>
        
        {/* Edit Toggle */}
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className={`p-1.5 rounded-lg transition-colors ${isEditing ? 'bg-white text-emerald-600 shadow-sm' : 'hover:bg-white/50 text-slate-600'}`}
          title={isEditing ? "Save Changes" : "Edit Resources"}
        >
          {isEditing ? <Check size={14} /> : <Edit size={14} />}
        </button>
      </div>
      
      {/* Content */}
      <div className="p-3 space-y-2 flex-1 bg-white">
        {items.map((item, idx) => (
          <div key={idx} className="group/item">
            {isEditing ? (
              // Edit Mode View
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 space-y-2 animate-fade-in relative">
                {item.isUpload ? (
                  <div className="flex items-center justify-between">
                     <span className="text-xs font-bold text-slate-400 uppercase">PDF Manager (Locked)</span>
                     {/* Cannot delete hardcoded upload managers easily to preserve functionality, or maybe allow rename only */}
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
            ) : (
              // View Mode View
              item.isUpload ? (
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
                      {item.note && <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wide truncate">{item.note}</p>}
                    </div>
                    <ExternalLink size={12} className="text-slate-300 group-hover/item:text-slate-600 transition-colors flex-shrink-0 ml-2" />
                  </div>
                </a>
              )
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

// --- Tools Components ---

const DictionaryWidget: React.FC = () => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const performSearch = async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    setShowHistory(false);
    
    setHistory(prev => {
      const newHistory = [text, ...prev.filter(h => h !== text)].slice(0, 5); 
      return newHistory;
    });

    const data = await translateAndDefine(text);
    setResult(data);
    setLoading(false);
  };

  const handleSearchClick = () => performSearch(query);
  const handleHistorySelect = (item: string) => {
    setQuery(item);
    performSearch(item);
  };

  const openGoogleTranslate = () => {
    const text = query.trim() || "";
    window.open(`https://translate.google.com/?sl=en&tl=zh-CN&text=${encodeURIComponent(text)}`, '_blank');
  };

  const speak = () => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(query);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 h-fit" ref={historyRef}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Search size={14} /> Dictionary
        </h3>
        <button onClick={openGoogleTranslate} className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-1 rounded-full hover:bg-blue-100 transition-colors">
          <Globe size={10} className="inline mr-1"/> Google
        </button>
      </div>

      <div className="relative mb-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setShowHistory(true)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchClick()}
              placeholder="Search..."
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 text-sm"
            />
            {showHistory && history.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden">
                <div className="text-[10px] font-bold text-slate-400 px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-1">
                  <History size={10} /> RECENT
                </div>
                <ul>
                  {history.map((item, idx) => (
                    <li key={idx} onClick={() => handleHistorySelect(item)} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-none flex justify-between items-center group">
                      {item} <ExternalLink size={12} className="opacity-0 group-hover:opacity-50" />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <button 
            onClick={handleSearchClick} 
            disabled={loading} 
            className="bg-slate-800 hover:bg-slate-900 text-white px-3 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Go'}
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-sm relative animate-fade-in">
           <button onClick={() => setResult(null)} className="absolute top-2 right-2 text-slate-300 hover:text-slate-500"><X size={14} /></button>
           <div className="flex items-center gap-2 mb-2">
             <span className="font-bold text-base text-slate-800">{query}</span>
             <button onClick={speak} className="text-slate-500 hover:text-slate-800"><Volume2 size={16} /></button>
           </div>
           <div className="prose prose-xs text-slate-600 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto custom-scrollbar">{result}</div>
        </div>
      )}
    </div>
  );
};

const StudyTimer: React.FC = () => {
  const [mode, setMode] = useState<'timer' | 'stopwatch'>('timer');
  const [status, setStatus] = useState<'idle' | 'running' | 'paused'>('idle');
  
  // Timer Input State (HH:MM:SS)
  const [h, setH] = useState('00');
  const [m, setM] = useState('25');
  const [s, setS] = useState('00');
  
  // Running State
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [stopwatchTime, setStopwatchTime] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    
    if (status === 'running') {
      interval = setInterval(() => {
        if (mode === 'timer') {
          setTimeLeft((prev) => {
            if (prev <= 0) {
              if (interval) clearInterval(interval);
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
    
    return () => { if (interval) clearInterval(interval); };
  }, [status, mode]);

  const playAppleRadarAlarm = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = new AudioContext();
      const now = ctx.currentTime;
      
      const playPulse = (time: number) => {
         const osc = ctx.createOscillator();
         const gain = ctx.createGain();
         osc.connect(gain);
         gain.connect(ctx.destination);
         
         osc.type = 'triangle'; // Sharp enough for alarm
         osc.frequency.setValueAtTime(1200, time);
         osc.frequency.exponentialRampToValueAtTime(800, time + 0.1);
         
         gain.gain.setValueAtTime(0, time);
         gain.gain.linearRampToValueAtTime(0.3, time + 0.01);
         gain.gain.linearRampToValueAtTime(0, time + 0.1);
         
         osc.start(time);
         osc.stop(time + 0.1);
      };

      // Radar pattern: 3 fast beeps, wait, repeat
      for(let loop = 0; loop < 4; loop++) {
        const base = now + (loop * 1.5);
        playPulse(base);
        playPulse(base + 0.15);
        playPulse(base + 0.3);
      }
    } catch (e) {
      console.error("Audio error", e);
    }
  };

  const handleStart = () => {
    if (mode === 'timer') {
      if (status === 'idle') {
        const totalSec = (parseInt(h) * 3600) + (parseInt(m) * 60) + parseInt(s);
        setTimeLeft(totalSec > 0 ? totalSec : 0);
      }
      if (timeLeft > 0 || status === 'idle') setStatus('running');
    } else {
      setStatus('running');
    }
  };

  const handlePause = () => setStatus('paused');
  
  const handleReset = () => {
    setStatus('idle');
    if (mode === 'timer') {
      // Keep input values, reset timeleft
    } else {
      setStopwatchTime(0);
    }
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

  const handleInputChange = (val: string, setter: React.Dispatch<React.SetStateAction<string>>, max: number) => {
    let num = parseInt(val.replace(/\D/g, '')) || 0;
    if (num > max) num = max;
    setter(num.toString().padStart(2, '0'));
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 overflow-hidden">
       {/* Mode Switcher */}
       <div className="bg-slate-100 p-1 rounded-lg flex mb-8">
          <button 
             onClick={() => { setMode('timer'); setStatus('idle'); }}
             className={`flex-1 py-1 rounded-md text-xs font-bold transition-all ${mode === 'timer' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
          >
             Timer
          </button>
          <button 
             onClick={() => { setMode('stopwatch'); setStatus('idle'); }}
             className={`flex-1 py-1 rounded-md text-xs font-bold transition-all ${mode === 'stopwatch' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
          >
             Stopwatch
          </button>
       </div>

       {/* Display Area */}
       <div className="flex justify-center items-center h-24 mb-6">
          {mode === 'timer' && status === 'idle' ? (
             // Input Mode
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
             // Running Mode (Timer or Stopwatch)
             <div className="text-6xl font-light text-slate-800 tabular-nums tracking-tight">
                {mode === 'timer' ? formatTime(timeLeft) : formatTime(stopwatchTime)}
             </div>
          )}
       </div>

       {/* Controls - iOS Style */}
       <div className="flex justify-between items-center px-4">
          {/* Cancel / Reset Button */}
          <button 
            onClick={handleReset}
            className="w-16 h-16 rounded-full bg-slate-100 text-slate-500 font-medium text-sm hover:bg-slate-200 transition-colors active:scale-95 flex items-center justify-center border border-slate-200"
          >
            {status === 'idle' && mode === 'timer' ? 'Clear' : 'Cancel'}
          </button>
          
          {/* Start / Pause Button */}
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
  return (
    <div className="animate-fade-in max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row justify-between items-end mb-6 px-2">
        <div>
          <h2 className="text-3xl font-extrabold text-academic-900 tracking-tight">Resource Hub</h2>
          <p className="text-slate-500 mt-1 flex items-center gap-2 text-sm">
             Curated materials for band 8.0+
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* --- LEFT: Resources Grid (8 Cols) --- */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* Row 1: Foundations & Input */}
          <ResourceCard 
            title="Vocabulary" 
            icon={<Languages size={18} className="text-emerald-700"/>}
            headerColor="bg-[#A4C3B2]/30" // Morandi Green
            items={[
              { name: 'YouGlish', url: 'https://youglish.com', note: 'Contextual Pronunciation' },
              { name: 'BuBeiDan (App)', note: 'App Recommendation' },
              { name: 'Vocabulary Lists (PDF)', isUpload: true }
            ]} 
          />
          
          <ResourceCard 
            title="Listening" 
            icon={<Headphones size={18} className="text-blue-700"/>}
            headerColor="bg-[#9BB7D4]/30" // Morandi Blue
            items={[
              { name: 'BBC Learning English', url: 'https://www.youtube.com/@bbclearningenglish/videos', note: 'Global News & Accents' },
              { name: 'VoiceTube', url: 'https://www.voicetube.com/channels/business-and-finance?sortBy=publishedAt&page=1', note: 'Video Dictionary' },
              { name: 'Cambridge Listening Practice', isUpload: true }
            ]} 
          />

          {/* Row 2: Reading & Writing */}
          <ResourceCard 
             title="Reading" 
             icon={<BookOpen size={18} className="text-rose-700"/>}
             headerColor="bg-[#D4A5A5]/30" // Morandi Red/Pink
             items={[
               { name: 'Cambridge 11-19 Papers', isUpload: true }
             ]} 
           />

          <ResourceCard 
            title="Writing" 
            icon={<PenTool size={18} className="text-yellow-700"/>}
            headerColor="bg-[#EAD18F]/30" // Morandi Yellow
            items={[
              { name: 'Simon IELTS', url: 'https://www.bilibili.com/video/BV1fhghzZE8a/?spm_id_from=333.1387.favlist.content.click&vd_source=1e206dd35c34dcc28320db7fcfbfa95e', note: 'Band 9 Structures' },
              { name: 'IELTS Liz Essays', url: 'https://ieltsliz.com/ielts-writing-task-2/', note: 'Model Answers' }
            ]} 
          />

          {/* Row 3: Speaking - Full Width */}
          <div className="md:col-span-2">
            <ResourceCard 
              title="Speaking" 
              icon={<Mic size={18} className="text-orange-700"/>}
              headerColor="bg-[#E6B89C]/30" // Morandi Orange
              items={[
                { name: 'English with Lucy', url: 'https://www.youtube.com/feed/subscriptions/UCz4tgANd4yy8Oe0iXCdSWfA', note: 'British Pronunciation' },
                { name: 'IELTS Liz Tips', url: 'https://ieltsliz.com/ielts-speaking-free-lessons-essential-tips/', note: 'Part 1, 2, 3 Strategy' }
              ]} 
            />
          </div>
        </div>

        {/* --- RIGHT: Tools Sidebar (4 Cols) --- */}
        <div className="lg:col-span-4 space-y-5">
           <StudyTimer />
           <DictionaryWidget />
        </div>

      </div>
    </div>
  );
};

export default ResourceHub;
