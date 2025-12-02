import React, { useState, useCallback, useEffect } from 'react';
import { Volume2, CheckCircle, XCircle, ArrowLeft, LayoutGrid, Loader2, ChevronRight, Book, AlertTriangle } from 'lucide-react';
import { WordItem, VocabularyCategory, CATEGORIES } from '../types';
import { playAudio, cleanText, stopAudio } from '../services/audio';
import { saveWordProgress, updatePoints, getProgressIdsByCategory, getRandomWordsByCategory, getRandomDistractors, getCategoryStats } from '../services/db';
import { VocabStatus } from '../App';
import { triggerHaptic } from '../utils/feedback';

interface QuizProps {
  onPointsUpdate: (pts: number) => void;
  vocabStatus: Record<string, VocabStatus>;
}

function shuffle<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5);
}

const Quiz: React.FC<QuizProps> = ({ onPointsUpdate, vocabStatus }) => {
  const [selectedCategory, setSelectedCategory] = useState<VocabularyCategory | null>(null);
  const [currentWord, setCurrentWord] = useState<WordItem | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [answered, setAnswered] = useState<'correct' | 'wrong' | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [noWordsFound, setNoWordsFound] = useState(false); // New state for empty DB
  
  const [categoryStats, setCategoryStats] = useState<Record<string, { learned: number, mistake: number }>>({});

  useEffect(() => {
      const loadStats = async () => {
          if (!selectedCategory) {
              const stats: Record<string, { learned: number, mistake: number }> = {};
              for (const cat of CATEGORIES) {
                  const data = await getCategoryStats(cat.id);
                  stats[cat.id] = data;
              }
              setCategoryStats(stats);
          }
      };
      loadStats();
  }, [selectedCategory, answered]); 

  const generateQuestion = useCallback(async (category: VocabularyCategory) => {
    setLoadingQuestion(true);
    setNoWordsFound(false);
    try {
        const excludedList = await getProgressIdsByCategory(category);
        const excludedIds = new Set(excludedList);
        
        let target: WordItem | null = null;
        let attempts = 0;
        
        // 1. Try to find a new (unlearned) word
        while (!target && attempts < 5) {
            const candidates = await getRandomWordsByCategory(category, 5);
            if (candidates.length === 0) break;
            
            for (const c of candidates) {
                if (!excludedIds.has(c.wordHead) && c.tranCn) {
                    target = c;
                    break;
                }
            }
            attempts++;
        }

        // 2. If no new words found, Fallback to Review Mode
        if (!target) {
            const reviewCandidates = await getRandomWordsByCategory(category, 1);
            if (reviewCandidates.length > 0) {
                target = reviewCandidates[0];
            }
        }

        if (!target) {
            // DB is empty or query failed
            console.warn("No words found for category:", category);
            setNoWordsFound(true);
            setLoadingQuestion(false);
            return;
        }

        const distractors = await getRandomDistractors(target.wordHead, 3);
        while(distractors.length < 3) {
            distractors.push("Error Option " + (distractors.length + 1));
        }

        const allOptions = shuffle([target.tranCn, ...distractors]);

        setCurrentWord(target);
        setOptions(allOptions);
        setAnswered(null);
        setSelectedOption(null);
    } catch (e) {
        console.error("Quiz Error", e);
        setNoWordsFound(true);
    } finally {
        setLoadingQuestion(false);
    }
  }, []);

  const handleCategorySelect = (cat: VocabularyCategory) => {
    if (!vocabStatus[cat]?.ready) return;
    triggerHaptic(20);
    stopAudio();
    setSelectedCategory(cat);
    generateQuestion(cat);
  };

  const handleAnswer = async (option: string) => {
    if (answered || !currentWord) return;
    
    triggerHaptic(10);
    setSelectedOption(option);
    const isCorrect = option === currentWord.tranCn;

    if (isCorrect) {
      setAnswered('correct');
      playAudio(currentWord.wordHead); 
      const newPoints = await updatePoints(10);
      onPointsUpdate(newPoints);
      await saveWordProgress(currentWord, 'learned');
    } else {
      setAnswered('wrong');
      triggerHaptic(50);
      playAudio(currentWord.wordHead);
      await saveWordProgress(currentWord, 'mistake');
    }
  };

  const handleNext = async () => {
      triggerHaptic();
      if (!selectedCategory) return;
      if (answered === null && currentWord) {
          setAnswered('wrong'); 
          setSelectedOption(null); 
          await saveWordProgress(currentWord, 'mistake');
          return; 
      }
      stopAudio();
      setIsPlayingAudio(false);
      generateQuestion(selectedCategory);
  };

  const handlePlaySentence = async (e: React.MouseEvent) => {
      e.stopPropagation();
      triggerHaptic();
      if (currentWord?.sContent && !isPlayingAudio) {
          setIsPlayingAudio(true);
          try {
            await playAudio(currentWord.sContent);
          } finally {
            setIsPlayingAudio(false);
          }
      }
  };

  const handleBack = () => {
      triggerHaptic();
      stopAudio();
      setSelectedCategory(null);
      setNoWordsFound(false);
  };

  useEffect(() => {
      return () => { stopAudio(); };
  }, []);

  // --- Category Selection View ---
  if (!selectedCategory) {
    return (
      <div className="p-4 h-full overflow-y-auto pb-20">
        <div className="flex items-center space-x-2 mb-6">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                <LayoutGrid size={20} />
            </div>
            <h2 className="text-lg font-bold text-gray-800">选择词库 (Select Library)</h2>
        </div>
        <div className="grid gap-3">
          {CATEGORIES.map((cat) => {
            const stats = categoryStats[cat.id] || { learned: 0, mistake: 0 };
            const status = vocabStatus[cat.id] || { count: 0, ready: false };
            const isReady = status.ready;

            return (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat.id)}
              disabled={!isReady}
              className={`group bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-stretch space-y-3 transition-all text-left relative overflow-hidden
                ${isReady ? 'active:scale-95' : 'opacity-50 cursor-not-allowed grayscale'}`}
            >
              <div className="flex justify-between items-center w-full">
                  <div className="flex items-center space-x-3">
                    <div className={`w-11 h-11 rounded-xl flex-none flex items-center justify-center font-bold text-white shadow-sm text-sm mr-3
                        ${cat.id === 'xiaoxue' ? 'bg-green-400' : 
                          cat.id === 'chuzhong' ? 'bg-teal-400' :
                          cat.id === 'gaozhong' ? 'bg-blue-400' :
                          cat.id === 'CET4' ? 'bg-indigo-400' : 'bg-purple-400'
                        }`}>
                        {cat.name.substring(0, 1)}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center flex-wrap gap-2">
                            <span className="font-bold text-gray-800 text-base">{cat.name}</span>
                            {isReady ? (
                                <>
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-600 border border-green-100 whitespace-nowrap">
                                    {stats.learned} 掌握
                                </span>
                                </>
                            ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200 whitespace-nowrap">
                                    准备中...
                                </span>
                            )}
                        </div>
                        <div className="text-xs mt-1 truncate flex items-center text-gray-400">
                            <Book size={12} className="mr-1 opacity-70" />
                            <span>{isReady ? `词汇量: ${status.count.toLocaleString()}` : '正在初始化资源...'}</span>
                        </div>
                    </div>
                  </div>
                  {isReady && <ChevronRight size={18} className="text-gray-300 flex-none ml-2" />}
              </div>
            </button>
          )})}
        </div>
      </div>
    );
  }

  // --- Error View (Empty DB) ---
  if (noWordsFound) {
      return (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <div className="bg-amber-100 p-4 rounded-full mb-4">
                  <AlertTriangle size={48} className="text-amber-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">词库数据为空</h3>
              <p className="text-gray-500 text-sm mb-6">
                  未能找到该分类的单词数据。请尝试在设置中重置应用，或检查网络连接后重启。
              </p>
              <button 
                  onClick={handleBack}
                  className="px-6 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg active:scale-95 transition-transform"
              >
                  返回 (Back)
              </button>
          </div>
      );
  }

  // --- Loading View ---
  if (loadingQuestion || !currentWord) {
      return (
          <div className="flex flex-col items-center justify-center h-full">
              <Loader2 size={32} className="animate-spin text-blue-500 mb-2" />
              <p className="text-xs text-gray-400">Loading Question...</p>
          </div>
      );
  }

  // --- Quiz Main UI ---
  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-hidden relative">
       <div className="px-4 py-2 bg-white flex items-center border-b border-gray-100 flex-none z-10 h-12">
           <button 
                onClick={handleBack} 
                className="p-1 -ml-1 text-gray-600 hover:bg-gray-100 rounded-full transition-colors mr-2 active:scale-90"
           >
               <ArrowLeft size={24} />
           </button>
           <span className="text-sm font-bold text-gray-800">
               {CATEGORIES.find(c => c.id === selectedCategory)?.name} Mode
           </span>
       </div>

      <div className="flex-1 flex flex-col items-center p-4 w-full max-w-lg mx-auto overflow-y-auto">
        <div className="w-full text-center space-y-3 mt-2">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h1 className="text-3xl font-black text-gray-900 break-words tracking-tight mb-2">{currentWord.wordHead}</h1>
                <button 
                    className="inline-flex items-center space-x-1 bg-blue-50 px-3 py-1 rounded-full active:bg-blue-100 transition-colors active:scale-95" 
                    onClick={() => { triggerHaptic(); playAudio(currentWord?.wordHead || ''); }}
                >
                    <span className="text-blue-600 font-mono text-sm">/{currentWord.usphone}/</span>
                    <Volume2 size={14} className="text-blue-600" />
                </button>
            </div>

            {currentWord.sContent && (
                <div className="bg-white/60 p-4 rounded-xl border border-gray-100/50 w-full text-left">
                    <div className="flex items-center justify-between">
                        <p className="text-gray-700 font-medium text-base leading-snug flex-1 mr-2">
                            {cleanText(currentWord.sContent)}
                        </p>
                        <button 
                            onClick={handlePlaySentence}
                            disabled={isPlayingAudio}
                            className={`text-blue-400 hover:text-blue-600 p-2 flex-shrink-0 bg-blue-50 rounded-full transition-colors ${isPlayingAudio ? 'opacity-50 cursor-not-allowed' : 'active:bg-blue-100 active:scale-90'}`}
                        >
                            {isPlayingAudio ? <Loader2 size={20} className="animate-spin" /> : <Volume2 size={20} />}
                        </button>
                    </div>
                    <div className={`mt-2 pt-2 border-t border-gray-200 transition-opacity duration-300 ${answered ? 'opacity-100' : 'opacity-0'}`}>
                        <p className="text-gray-600 text-sm">{currentWord.sCn}</p>
                    </div>
                </div>
            )}
        </div>

        <div className="w-full space-y-2 mt-6 pb-20">
            {options.map((option, idx) => {
                let btnClass = "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"; 
                let icon = null;
                
                if (answered) {
                    if (option === currentWord?.tranCn) {
                        btnClass = "bg-green-50 border-green-500 text-green-700 font-bold ring-1 ring-green-500"; 
                        icon = <CheckCircle className="text-green-600 flex-shrink-0" size={18} />;
                    } else if (selectedOption === option && selectedOption !== currentWord?.tranCn) {
                        btnClass = "bg-red-50 border-red-500 text-red-700 ring-1 ring-red-500"; 
                        icon = <XCircle className="text-red-600 flex-shrink-0" size={18} />;
                    } else {
                        btnClass = "opacity-50 bg-gray-50 border-transparent grayscale"; 
                    }
                }

                return (
                    <button
                        key={idx}
                        disabled={answered !== null}
                        onClick={() => handleAnswer(option)}
                        className={`w-full p-3 rounded-xl border text-left transition-all shadow-sm flex items-center justify-between active:scale-[0.97] touch-manipulation ${btnClass}`}
                    >
                        <span className="text-sm font-medium line-clamp-1 mr-2">{option}</span>
                        {icon}
                    </button>
                )
            })}
        </div>
      </div>

      <div className="flex-none absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-3 z-20 pb-safe">
          <button 
                onClick={handleNext}
                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all active:scale-[0.97] shadow-md
                    ${answered 
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200' 
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
              <span>{answered ? 'Next Question' : 'Skip / Show Answer'}</span>
              <ChevronRight size={18} />
          </button>
      </div>
    </div>
  );
};

export default Quiz;