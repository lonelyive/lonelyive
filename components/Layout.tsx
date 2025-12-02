
import React from 'react';
import { Award, BookOpen, Calendar, Home, Settings } from 'lucide-react';
import { AppTab, UserStats } from '../types';
import { triggerHaptic } from '../utils/feedback';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  stats: UserStats;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, stats }) => {
  
  const isMaxScore = stats.points >= 999999;

  const handleTabClick = (tab: AppTab) => {
    if (activeTab !== tab) {
      triggerHaptic();
      onTabChange(tab);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-800 overflow-hidden font-sans">
      {/* Top Bar - Relative container for absolute centering */}
      <header className="flex-none h-14 bg-white shadow-sm flex items-center justify-between px-4 z-10 relative">
        {/* Left: Streak */}
        <div className="flex items-center space-x-2 text-blue-600 z-20">
          <Calendar size={20} />
          <span className="font-bold text-lg">{stats.streakDays} <span className="text-xs font-normal text-gray-500">days</span></span>
        </div>
        
        {/* Center: Title (Absolutely positioned) */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <h1 className="text-lg font-black text-gray-800 tracking-tight">单词大师</h1>
        </div>

        {/* Right: Points */}
        <div className="flex items-center space-x-2 text-amber-500 z-20">
          <Award size={20} />
          <span className={`font-bold text-lg ${isMaxScore ? 'animate-pulse text-red-500' : ''}`}>
            {isMaxScore ? 'MAX' : stats.points}
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="flex-none h-16 bg-white border-t border-gray-200 flex items-center justify-around pb-safe">
        <NavButton 
          active={activeTab === AppTab.HOME} 
          onClick={() => handleTabClick(AppTab.HOME)} 
          icon={<Home size={24} />} 
          label="首页" 
        />
        <NavButton 
          active={activeTab === AppTab.LEARN} 
          onClick={() => handleTabClick(AppTab.LEARN)} 
          icon={<BookOpen size={24} />} 
          label="学习" 
        />
        <NavButton 
          active={activeTab === AppTab.SETTINGS} 
          onClick={() => handleTabClick(AppTab.SETTINGS)} 
          icon={<Settings size={24} />} 
          label="设置" 
        />
      </nav>
    </div>
  );
};

const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center w-full h-full space-y-1 active:scale-95 transition-transform duration-150 ${active ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
  >
    <div className={`transition-transform duration-200 ${active ? 'scale-110' : ''}`}>
      {icon}
    </div>
    <span className="text-xs font-medium">{label}</span>
  </button>
);

export default Layout;
