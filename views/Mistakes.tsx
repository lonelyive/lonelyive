
import React, { useEffect, useState } from 'react';
import { Volume2, Check, ArrowLeft, Trash2 } from 'lucide-react';
import { WordStatus } from '../types';
import { getMistakes, removeWordProgress } from '../services/db';
import { playAudio } from '../services/audio';
import { triggerHaptic } from '../utils/feedback';

interface MistakesProps {
    onBack: () => void;
}

const Mistakes: React.FC<MistakesProps> = ({ onBack }) => {
  const [mistakes, setMistakes] = useState<WordStatus[]>([]);

  const loadData = async () => {
    const data = await getMistakes();
    setMistakes(data.sort((a, b) => b.timestamp - a.timestamp));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMastered = async (wordHead: string) => {
      triggerHaptic(20); // Confirmation vibration
      await removeWordProgress(wordHead);
      setMistakes(prev => prev.filter(m => m.wordHead !== wordHead));
  };

  const handleBack = () => {
      triggerHaptic();
      onBack();
  };

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
        <h2 className="text-xl font-bold text-gray-800">错题本 ({mistakes.length})</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
        {mistakes.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-64 text-gray-400">
               <div className="bg-green-100 p-6 rounded-full mb-4">
                   <Check size={48} className="text-green-500" />
               </div>
               <p className="text-lg font-medium text-gray-600">太棒了！</p>
               <p className="text-sm">错题本是空的 (No mistakes)</p>
           </div>
        ) : (
            mistakes.map((item) => (
                <div key={item.wordHead} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative group">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900">{item.wordHead}</h3>
                            <div className="flex items-center space-x-2 mt-1">
                                <span className="text-sm font-mono text-gray-500 bg-gray-100 px-2 rounded">/{item.data.usphone}/</span>
                                <button 
                                    onClick={() => { triggerHaptic(); playAudio(item.wordHead); }} 
                                    className="text-blue-500 hover:text-blue-700 active:scale-90 transition-transform"
                                >
                                    <Volume2 size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <p className="text-gray-800 font-medium mb-3 text-lg border-l-4 border-red-400 pl-3">{item.data.tranCn}</p>
                    
                    <div className="bg-gray-50 p-3 rounded-lg text-sm mb-4">
                        <p className="text-gray-700 mb-1">{item.data.sContent}</p>
                        <p className="text-gray-400 text-xs">{item.data.sCn}</p>
                    </div>

                    <button 
                        onClick={() => handleMastered(item.wordHead)}
                        className="w-full py-3 bg-green-50 text-green-700 rounded-xl font-bold flex items-center justify-center space-x-2 hover:bg-green-100 active:scale-[0.97] transition-all"
                    >
                        <Check size={18} />
                        <span>我已掌握 (Mastered)</span>
                    </button>
                </div>
            ))
        )}
      </div>
    </div>
  );
};

export default Mistakes;
