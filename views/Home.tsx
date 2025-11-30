
import React, { useEffect, useState } from 'react';
import { Trophy, AlertCircle, Activity } from 'lucide-react';
import { CATEGORIES } from '../types';
import { getAchievements, getMistakes } from '../services/db';
import { triggerHaptic } from '../utils/feedback';

interface HomeProps {
  totalWords: number;
  vocabCounts: Record<string, number>;
  onNavigate: (view: 'mistakes' | 'achievements') => void;
}

const Home: React.FC<HomeProps> = ({ totalWords, vocabCounts, onNavigate }) => {
  const [mistakeCount, setMistakeCount] = useState(0);
  const [learnedCount, setLearnedCount] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      const m = await getMistakes();
      const l = await getAchievements();
      setMistakeCount(m.length);
      setLearnedCount(l.length);
    };
    fetchStats();
  }, []);

  const getLevel = (count: number) => {
    if (count < 50) return { name: '新手 (Novice)', color: 'bg-gray-400' };
    if (count < 200) return { name: '学徒 (Apprentice)', color: 'bg-green-500' };
    if (count < 500) return { name: '学者 (Scholar)', color: 'bg-blue-500' };
    if (count < 1000) return { name: '大师 (Master)', color: 'bg-purple-500' };
    return { name: '传说 (Legend)', color: 'bg-amber-500' };
  };

  const handleNav = (view: 'mistakes' | 'achievements') => {
      triggerHaptic();
      onNavigate(view);
  };

  const level = getLevel(learnedCount);
  const progressPercent = totalWords > 0 ? Math.min(100, (learnedCount / totalWords) * 100) : 0;

  return (
    <div className="p-4 space-y-4 pb-20 h-full overflow-y-auto">
      {/* Hero Stats */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-xl"></div>
        
        <h2 className="text-xs font-medium opacity-80 mb-2 uppercase tracking-widest flex items-center">
            <Activity size={14} className="mr-1" /> 
            Overall Progress
        </h2>
        
        <div className="flex items-end justify-between mb-4">
            <div>
                <div className="flex items-baseline space-x-1">
                    <span className="text-4xl font-bold tracking-tight">{learnedCount}</span>
                    <span className="text-lg opacity-60">/ {totalWords}</span>
                </div>
                <span className="text-sm opacity-75">words learned</span>
            </div>
            <span className="text-2xl font-bold">{progressPercent.toFixed(1)}%</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-black/20 rounded-full h-3 backdrop-blur-sm">
            <div 
                className="bg-white/90 h-3 rounded-full transition-all duration-1000 ease-out" 
                style={{ width: `${progressPercent}%` }}
            ></div>
        </div>
      </div>

      {/* Main Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button 
            onClick={() => handleNav('mistakes')}
            className="group bg-white p-6 rounded-xl shadow-sm border border-red-50 flex flex-col items-center justify-center space-y-3 active:scale-95 transition-all duration-150"
        >
            <div className="bg-red-50 p-4 rounded-full text-red-500 group-hover:bg-red-100 transition-colors">
                <AlertCircle size={28} />
            </div>
            <div className="text-center">
                <span className="block font-bold text-gray-800 text-lg">错题本</span>
                <span className="text-xs text-red-500 font-medium">{mistakeCount} 待复习</span>
            </div>
        </button>

        <button 
            onClick={() => handleNav('achievements')}
            className="group bg-white p-6 rounded-xl shadow-sm border border-amber-50 flex flex-col items-center justify-center space-y-3 active:scale-95 transition-all duration-150"
        >
            <div className="bg-amber-50 p-4 rounded-full text-amber-500 group-hover:bg-amber-100 transition-colors">
                <Trophy size={28} />
            </div>
            <div className="text-center">
                <span className="block font-bold text-gray-800 text-lg">我的成就</span>
                <span className="text-xs text-amber-600 font-medium truncate max-w-[100px]">{level.name}</span>
            </div>
        </button>
      </div>
    </div>
  );
};

export default Home;
