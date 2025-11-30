
import React, { useEffect, useState } from 'react';
import { WordStatus } from '../types';
import { getAchievements } from '../services/db';
import { ArrowLeft, Medal } from 'lucide-react';
import { triggerHaptic } from '../utils/feedback';

interface AchievementsProps {
    onBack: () => void;
}

const Achievements: React.FC<AchievementsProps> = ({ onBack }) => {
  const [learned, setLearned] = useState<WordStatus[]>([]);

  useEffect(() => {
    const load = async () => {
        const data = await getAchievements();
        setLearned(data.reverse()); // Newest first
    };
    load();
  }, []);

  const handleBack = () => {
      triggerHaptic();
      onBack();
  };

  const getRank = (count: number) => {
      if (count < 50) return { title: '青铜学徒', color: 'text-gray-600', bg: 'bg-gray-100' };
      if (count < 200) return { title: '白银学者', color: 'text-teal-600', bg: 'bg-teal-100' };
      if (count < 500) return { title: '黄金大师', color: 'text-amber-600', bg: 'bg-amber-100' };
      if (count < 1000) return { title: '钻石宗师', color: 'text-blue-600', bg: 'bg-blue-100' };
      return { title: '王者归来', color: 'text-purple-600', bg: 'bg-purple-100' };
  }

  const rank = getRank(learned.length);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Strong Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm px-4 py-4 flex items-center">
        <button 
            onClick={handleBack} 
            className="mr-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 active:bg-gray-300 transition-colors active:scale-90"
        >
            <ArrowLeft size={24} className="text-gray-700" />
        </button>
        <h2 className="text-xl font-bold text-gray-800">我的成就 (Achievements)</h2>
      </div>

      <div className="p-8 bg-white flex flex-col items-center justify-center border-b border-gray-100">
          <div className={`p-4 rounded-full mb-3 ${rank.bg}`}>
              <Medal size={48} className={rank.color} />
          </div>
          <div className="text-5xl font-black text-gray-900 mb-1">{learned.length}</div>
          <div className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-4">Words Mastered</div>
          <div className={`px-4 py-1.5 rounded-full text-sm font-bold ${rank.bg} ${rank.color}`}>
              {rank.title}
          </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-20 bg-gray-50">
          <h3 className="text-sm font-bold text-gray-400 mb-3 ml-1">Latest Mastered</h3>
          <div className="grid grid-cols-2 gap-3">
              {learned.map((item) => (
                  <div key={item.wordHead} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col">
                      <span className="font-bold text-lg text-gray-800 mb-1">{item.wordHead}</span>
                      <span className="text-xs text-gray-500 truncate">{item.data.tranCn}</span>
                  </div>
              ))}
          </div>
      </div>
    </div>
  );
};

export default Achievements;
