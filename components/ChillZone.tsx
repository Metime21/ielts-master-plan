import React, { useState, useEffect } from 'react';
import { PlayCircle, Music, Film, Edit, Check, Plus, ExternalLink, X } from 'lucide-react'; // 确保 X 导入

interface Series {
  id: string;
  title: string;
  desc: string;
  url: string;
  poster: string;
  isCustom?: boolean;
}

const DEFAULT_SERIES: Series[] = [
  {
    id: 'modern-family',
    title: 'Modern Family',
    desc: 'Shadowing Practice • Daily Life Vocab',
    url: 'https://www.bilibili.com/video/BV1vfFye3E1s/?spm_id_from=333.1387.favlist.content.click&vd_source=1e206dd35c34dcc28320db7fcfbfa95e',
    poster: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=2070&auto=format&fit=crop'
  },
  {
    id: 'friends',
    title: 'Friends',
    desc: 'Classic American Idioms • Humor',
    url: 'https://www.bilibili.com/video/BV1phynYEEBx/?spm_id_from=333.1387.favlist.content.click&vd_source=1e206dd35c34dcc28320db7fcfbfa95e',
    poster: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=2070&auto=format&fit=crop'
  },
  // 假设这里是 DEFAULT_SERIES 的其余内容...
];

// 【步骤四：修改组件接口和定义】
interface ChillZoneCardProps {
  seriesList: any[]; 
  onSave: (items: any[]) => void; 
}

const ChillZoneCard: React.FC<ChillZoneCardProps> = ({ seriesList: propSeriesList, onSave }) => {
  // 【状态修改】：使用 propSeriesList 初始化 currentSeries
  const [currentSeries, setCurrentSeries] = useState<any[]>(propSeriesList);
  const [newSeries, setNewSeries] = useState<Series | null>(null);
  const [isLoading, setIsLoading] = useState(false); // 不再自己加载数据，改为 false
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // 【新增同步逻辑】：当父组件数据更新时，同步内部状态
  useEffect(() => {
    setCurrentSeries(propSeriesList);
  }, [propSeriesList]);

  // 【旧的 loadData 函数和 useEffect 块已删除】

  const handleToggleEdit = () => {
    setIsEditing(prev => !prev);
    if (isEditing) {
      setNewSeries(null);
    }
  };

  const handleAddSeries = (series: Series) => {
    if (currentSeries.some(s => s.id === series.id)) return;
    setCurrentSeries(prev => [...prev, { ...series, isCustom: true, id: Date.now().toString() }]);
    setNewSeries(null);
  };

  const handleDeleteSeries = (id: string) => {
    setCurrentSeries(prev => prev.filter(s => s.id !== id));
  };

  // 【步骤五：修改保存逻辑】
  const handleSaveSeries = async () => {
    if (!currentSeries || isSaving) return;

    setIsSaving(true);

    const seriesToSave = currentSeries.filter(s => s.isCustom);
    
    // 确保 DEFAULT_SERIES 也被包含，如果需要
    const newSeriesList = [...DEFAULT_SERIES, ...seriesToSave];

    try {
        // 调用上层组件的 onSave 函数，不再直接调用 API
        onSave(newSeriesList); 

        setIsEditing(false);
    } catch (e) {
      console.error('Error saving chillzone:', e);
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="md:col-span-12 lg:col-span-4 grid grid-cols-12 gap-8 h-full">
      {/* 电视剧/系列卡片编辑区 */}
      <div className="md:col-span-8 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-slate-700">Chill Zone Series</h2>
          <div className="flex items-center space-x-2">
            {isEditing && (
              <button
                onClick={handleSaveSeries}
                disabled={isSaving}
                className={`flex items-center space-x-1 px-3 py-1 text-sm rounded-full transition ${isSaving ? 'bg-green-300 text-white' : 'bg-green-500 text-white hover:bg-green-600'}`}
              >
                <Check size={16} />
                <span>{isSaving ? 'Saving...' : 'Save'}</span>
              </button>
            )}
            <button
              onClick={handleToggleEdit}
              className={`flex items-center space-x-1 px-3 py-1 text-sm rounded-full border transition ${isEditing ? 'border-red-500 text-red-500 hover:bg-red-50' : 'border-slate-300 text-slate-500 hover:bg-slate-50'}`}
            >
              <Edit size={16} />
              <span>{isEditing ? 'Cancel Edit' : 'Edit'}</span>
            </button>
          </div>
        </div>

        {/* 现有系列列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentSeries.map((series: Series) => (
            <div
              key={series.id}
              className="relative rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow bg-white"
            >
              <img
                src={series.poster}
                alt={series.title}
                className="w-full h-32 object-cover"
              />
              <div className="p-4">
                <h3 className="text-lg font-bold text-slate-800 mb-1">{series.title}</h3>
                <p className="text-sm text-slate-500 mb-3">{series.desc}</p>
                <a
                  href={series.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm transition"
                >
                  <PlayCircle size={16} />
                  <span>Watch Now</span>
                  <ExternalLink size={14} />
                </a>
              </div>
              {isEditing && series.isCustom && (
                <div className="absolute top-2 right-2">
                  <button
                    onClick={() => handleDeleteSeries(series.id)}
                    className="bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 新增系列表单 */}
        {isEditing && (
          <div className="mt-6 p-4 border border-dashed border-slate-300 rounded-xl bg-slate-50">
            <h4 className="text-md font-semibold text-slate-700 mb-3">Add New Series</h4>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Title"
                value={newSeries?.title || ''}
                onChange={(e) => setNewSeries(prev => ({ ...prev, title: e.target.value } as Series))}
                className="w-full p-2 border rounded-md"
              />
              <input
                type="text"
                placeholder="Description (e.g., Vocab Focus)"
                value={newSeries?.desc || ''}
                onChange={(e) => setNewSeries(prev => ({ ...prev, desc: e.target.value } as Series))}
                className="w-full p-2 border rounded-md"
              />
              <input
                type="url"
                placeholder="Video URL"
                value={newSeries?.url || ''}
                onChange={(e) => setNewSeries(prev => ({ ...prev, url: e.target.value } as Series))}
                className="w-full p-2 border rounded-md"
              />
              <input
                type="url"
                placeholder="Poster Image URL (Optional)"
                value={newSeries?.poster || ''}
                onChange={(e) => setNewSeries(prev => ({ ...prev, poster: e.target.value } as Series))}
                className="w-full p-2 border rounded-md"
              />
              <button
                onClick={() => newSeries?.title && newSeries?.url && handleAddSeries(newSeries)}
                disabled={!newSeries?.title || !newSeries?.url}
                className="flex items-center space-x-1 px-3 py-1 text-sm rounded-full bg-blue-500 text-white hover:bg-blue-600 transition disabled:opacity-50"
              >
                <Plus size={16} />
                <span>Add Series</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Music Card */}
      <div className="md:col-span-4 flex flex-col">
        <a
          href="https://www.voicetube.com/channel/music"
          target="_blank"
          rel="noreferrer"
          className="block group relative bg-academic-900 h-full min-h-[300px] rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all"
        >
          <div className="absolute top-0 right-0 p-8 opacity-20">
            <Music size={150} className="text-white transform rotate-12" />
          </div>
          <div className="absolute inset-0 flex flex-col justify-end p-8 z-10">
            <div className="bg-gradient-to-r from-pink-500 to-violet-600 w-20 h-20 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform mb-6">
              <PlayCircle size={32} className="text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">VoiceTube Music</h3>
              <p className="text-slate-300 text-sm">
                Learn lyrics, understand rhythm, and relax your mind with curated English songs.
              </p>
            </div>
          </div>
          <div className="absolute inset-0 bg-black opacity-40 group-hover:opacity-50 transition-opacity"></div>
        </a>
      </div>
    </div>
  );
};

export default ChillZoneCard;
