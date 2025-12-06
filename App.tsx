import React, { useState } from 'react';
import { LayoutDashboard, Library, CalendarDays, Coffee } from 'lucide-react';
import Header from './components/Header';
import ResourceHub from './components/ResourceHub';
import SmartPlanner from './components/SmartPlanner';
import ChillZone from './components/ChillZone';
import GeminiChat from './components/GeminiChat';
import { Tab } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DASHBOARD);

  // Tab navigation configuration
  const navItems = [
    { id: Tab.DASHBOARD, label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: Tab.RESOURCES, label: 'Resources', icon: <Library size={20} /> },
    { id: Tab.PLANNER, label: 'Planner', icon: <CalendarDays size={20} /> },
    { id: Tab.CHILL, label: 'Chill Zone', icon: <Coffee size={20} /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      <Header />
      
      {/* Sticky Navigation Bar */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center md:justify-start space-x-1 md:space-x-8 h-16 items-center overflow-x-auto no-scrollbar">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap
                  ${activeTab === item.id 
                    ? 'bg-academic-500 text-white shadow-md' 
                    : 'text-slate-500 hover:text-academic-500 hover:bg-slate-100'
                  }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Render Active View */}
        {activeTab === Tab.DASHBOARD && (
          <div className="space-y-12 animate-fade-in">
             <div className="text-center py-10">
               <h2 className="text-4xl font-extrabold text-academic-900 mb-4">Welcome back, Scholar.</h2>
               <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                 "Success is not final, failure is not fatal: it is the courage to continue that counts."
               </p>
             </div>
             
             {/* Quick Links Preview for Dashboard */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div 
                  onClick={() => setActiveTab(Tab.PLANNER)}
                  className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg hover:border-accent-400 transition-all cursor-pointer group"
                >
                   <div className="bg-blue-100 w-12 h-12 rounded-xl flex items-center justify-center text-academic-500 mb-4 group-hover:bg-academic-500 group-hover:text-white transition-colors">
                     <CalendarDays />
                   </div>
                   <h3 className="font-bold text-lg mb-2">Today's Tasks</h3>
                   <p className="text-slate-500 text-sm">Check your schedule and track progress for today.</p>
                </div>

                <div 
                   onClick={() => setActiveTab(Tab.RESOURCES)}
                   className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg hover:border-accent-400 transition-all cursor-pointer group"
                >
                   <div className="bg-emerald-100 w-12 h-12 rounded-xl flex items-center justify-center text-emerald-600 mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                     <Library />
                   </div>
                   <h3 className="font-bold text-lg mb-2">Core Resources</h3>
                   <p className="text-slate-500 text-sm">Access vocabulary, listening papers, and reading materials.</p>
                </div>

                 <div 
                   onClick={() => setActiveTab(Tab.CHILL)}
                   className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg hover:border-accent-400 transition-all cursor-pointer group"
                >
                   <div className="bg-orange-100 w-12 h-12 rounded-xl flex items-center justify-center text-accent-500 mb-4 group-hover:bg-accent-500 group-hover:text-white transition-colors">
                     <Coffee />
                   </div>
                   <h3 className="font-bold text-lg mb-2">Relaxation</h3>
                   <p className="text-slate-500 text-sm">Take a break with Modern Family or some music.</p>
                </div>
             </div>
          </div>
        )}

        {activeTab === Tab.RESOURCES && <ResourceHub />}
        {activeTab === Tab.PLANNER && <SmartPlanner />}
        {activeTab === Tab.CHILL && <ChillZone />}

      </main>

      {/* Floating Chat Widget */}
      <GeminiChat />

      {/* Simple Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-400 text-sm">
          <p>© 2024 IELTS Master Plan. Designed for Excellence.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;