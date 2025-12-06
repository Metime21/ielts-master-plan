
import React, { useState } from 'react';
import { PlayCircle, Music, Film, Edit, Check, Plus, ExternalLink } from 'lucide-react';

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
    // Using a reliable Unsplash image (Group/Family vibe) to ensure it displays correctly
    poster: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=2070&auto=format&fit=crop'
  },
  {
    id: 'friends',
    title: 'Friends',
    desc: 'Classic American Idioms • Humor',
    url: 'https://www.bilibili.com/video/BV1phynYEEBx/?spm_id_from=333.1387.favlist.content.click&vd_source=1e206dd35c34dcc28320db7fcfbfa95e',
    // Using TMDb reliable image source for Friends
    poster: 'https://image.tmdb.org/t/p/original/f496cm9enuEsZkSPzCwnTESEK5s.jpg'
  },
  {
    id: 'custom-slot',
    title: 'Add New Series',
    desc: 'Click edit to add your link',
    url: '',
    poster: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=2070&auto=format&fit=crop',
    isCustom: true
  }
];

const ChillZone: React.FC = () => {
  const [seriesList, setSeriesList] = useState<Series[]>(DEFAULT_SERIES);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Temp state for form
  const [editForm, setEditForm] = useState<Partial<Series>>({});

  const startEditing = (series: Series) => {
    setEditingId(series.id);
    setEditForm({ ...series });
  };

  const saveEditing = (id: string) => {
    setSeriesList(prev => prev.map(item => {
      if (item.id === id) {
        // Simple "auto identify" logic simulation:
        // If user didn't provide a title but provided a URL, try to guess
        let finalTitle = editForm.title || item.title;
        let finalDesc = editForm.desc || item.desc;
        const finalPoster = editForm.poster || item.poster;

        if (!editForm.title && editForm.url) {
           if (editForm.url.includes('bilibili')) finalTitle = "Bilibili Video";
           else if (editForm.url.includes('youtube')) finalTitle = "YouTube Video";
           else finalTitle = "Web Resource";
           
           if (!editForm.desc) finalDesc = "Custom Link";
        }

        return {
          ...item,
          ...editForm,
          title: finalTitle,
          desc: finalDesc,
          poster: finalPoster
        } as Series;
      }
      return item;
    }));
    setEditingId(null);
  };

  const handleInputChange = (field: keyof Series, value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-academic-900">Chill Zone</h2>
        <p className="text-slate-500">Relax, recharge, and learn subconsciously.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* Combined TV Series Card (Spans 8 cols) */}
        <div className="md:col-span-8 bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden flex flex-col">
           <div className="px-6 py-4 bg-academic-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                 <Film size={20} className="text-accent-400" />
                 <h3 className="font-bold text-lg">TV Series Collection</h3>
              </div>
              <span className="text-xs bg-white/10 px-2 py-1 rounded text-slate-200">3 Slots Available</span>
           </div>

           <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 h-full min-h-[300px]">
             {seriesList.map((series) => (
               <div key={series.id} className="relative group h-full flex flex-col">
                 {/* Background Image */}
                 <div className="absolute inset-0 bg-slate-800">
                    <img 
                      src={editingId === series.id ? editForm.poster : series.poster} 
                      alt={series.title}
                      className="w-full h-full object-cover opacity-50 group-hover:opacity-40 transition-opacity"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
                 </div>

                 {/* Content Overlay */}
                 <div className="relative z-10 flex-1 flex flex-col p-4">
                    {/* Top Right Actions */}
                    <div className="flex justify-end mb-auto">
                       {editingId === series.id ? (
                          <button 
                            onClick={() => saveEditing(series.id)}
                            className="p-1.5 bg-green-500 text-white rounded-full hover:bg-green-600 shadow-sm transition-colors"
                          >
                            <Check size={14} />
                          </button>
                       ) : (
                          <button 
                            onClick={() => startEditing(series)}
                            className="p-1.5 bg-white/10 text-white hover:bg-white/20 rounded-full backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Edit size={14} />
                          </button>
                       )}
                    </div>

                    {/* Edit Mode Forms or Display Mode */}
                    {editingId === series.id ? (
                       <div className="space-y-2 mt-4 animate-fade-in">
                          <input 
                             placeholder="URL link..."
                             value={editForm.url || ''}
                             onChange={(e) => handleInputChange('url', e.target.value)}
                             className="w-full text-[10px] p-1.5 rounded bg-white/90 text-slate-900 placeholder:text-slate-400 focus:outline-none"
                          />
                          <input 
                             placeholder="Title..."
                             value={editForm.title || ''}
                             onChange={(e) => handleInputChange('title', e.target.value)}
                             className="w-full text-xs font-bold p-1.5 rounded bg-white/90 text-slate-900 placeholder:text-slate-400 focus:outline-none"
                          />
                          <input 
                             placeholder="Desc..."
                             value={editForm.desc || ''}
                             onChange={(e) => handleInputChange('desc', e.target.value)}
                             className="w-full text-[10px] p-1.5 rounded bg-white/90 text-slate-900 placeholder:text-slate-400 focus:outline-none"
                          />
                           <input 
                             placeholder="Poster Image URL..."
                             value={editForm.poster || ''}
                             onChange={(e) => handleInputChange('poster', e.target.value)}
                             className="w-full text-[10px] p-1.5 rounded bg-white/90 text-slate-900 placeholder:text-slate-400 focus:outline-none"
                          />
                       </div>
                    ) : (
                       <div className="mt-auto">
                          <h4 className={`font-bold text-white leading-tight mb-1 ${series.title.length > 15 ? 'text-lg' : 'text-xl'}`}>
                             {series.title}
                          </h4>
                          <p className="text-xs text-slate-300 line-clamp-2 mb-4">{series.desc}</p>
                          
                          {series.url ? (
                            <a 
                              href={series.url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="w-full py-2 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl flex items-center justify-center gap-2 text-white text-xs font-bold transition-all border border-white/10"
                            >
                              <PlayCircle size={14} /> Watch Now
                            </a>
                          ) : (
                            <button 
                               onClick={() => startEditing(series)}
                               className="w-full py-2 bg-dashed border border-white/30 rounded-xl flex items-center justify-center gap-2 text-white/50 text-xs hover:bg-white/10 hover:text-white transition-colors"
                            >
                               <Plus size={14} /> Add Resource
                            </button>
                          )}
                       </div>
                    )}
                 </div>
               </div>
             ))}
           </div>
        </div>

        {/* Music Card (Spanning 4 cols) */}
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
                 <p className="text-slate-300 text-sm">Learn lyrics, understand rhythm, and relax your mind with curated English songs.</p>
               </div>
             </div>
          </a>
        </div>

      </div>
    </div>
  );
};

export default ChillZone;
