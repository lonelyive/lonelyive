
import React, { useState, useCallback, useEffect } from 'react';
import { Volume2, CheckCircle, XCircle, ArrowLeft, LayoutGrid, Loader2, ChevronRight, GraduationCap, AlertCircle, Download, Book } from 'lucide-react';
import { WordItem, VocabularyCategory, CATEGORIES } from '../types';
import { playAudio, cleanText, stopAudio } from '../services/audio';
import { saveWordProgress, updatePoints, getProgressIdsByCategory, getRandomWordsByCategory, getRandomDistractors, getCategoryStats } from '../services/db';
import { VocabStatus } from '../App';
import { triggerHaptic } from '../utils/feedback';

interface QuizProps {
  onPointsUpdate: (pts: number) => void;
  vocabCounts: Record<string, number>;
  vocabStatus?: Record<string, VocabStatus>;
}

// Shuffle array
function shuffle<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5);
}

const Quiz: React.FC<QuizProps> = ({ onPointsUpdate, vocabCounts, vocabStatus = {} }) => {
  const [selectedCategory, setSelectedCategory] = useState<VocabularyCategory | null>(null);
  const [currentWord, setCurrentWord] = useState<WordItem | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [answered, setAnswered] = useState<'correct' | 'wrong' | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  
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
    try {
        const excludedList = await getProgressIdsByCategory(category);
        const excludedIds = new Set(excludedList);
        
        let target: WordItem | null = null;
        let attempts = 0;
        
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

        if (!target) {
            setIsFinished(true);
            setLoadingQuestion(false);
            return;
        }

        const distractors = await getRandomDistractors(target.wordHead, 3);
        while(distractors.length < 3) {
            distractors.push("Wrong Answer " + (distractors.length + 1));
        }

        const allOptions = shuffle([target.tranCn, ...distractors]);

        setCurrentWord(target);
        setOptions(allOptions);
        setAnswered(null);
        setSelectedOption(null);
    } catch (e) {
        console.error("Quiz Error", e);
    } finally {
        setLoadingQuestion(false);
    }

  }, []);

  const handleCategorySelect = (cat: VocabularyCategory) => {
    if (vocabStatus[cat]?.loading) return;

    triggerHaptic(20); // Slightly longer haptic for selection
    stopAudio();
    setSelectedCategory(cat);
    setIsFinished(false);
    generateQuestion(cat);
  };

  const handleAnswer = async (option: string) => {
    if (answered || !currentWord) return;
    
    triggerHaptic(10); // Click feel
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
      triggerHaptic(50); // Error vibration is stronger
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
  };

  useEffect(() => {
      return () => {
          stopAudio();
      };
  }, []);

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
            const status = vocabStatus[cat.id];
            const isLoading = status?.loading;
            const count = status?.count || 0;

            return (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat.id)}
              disabled={isLoading}
              className={`group bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-stretch space-y-3 transition-all text-left relative overflow-hidden
                ${isLoading ? 'opacity-80 cursor-wait' : 'active:scale-95'}`}
            >
              {/* Progress Bar Background for Loading */}
              {isLoading && (
                  <div className="absolute bottom-0 left-0 h-1 bg-blue-100 w-full">
                      <div className="h-full bg-blue-500 animate-pulse w-full"></div>
                  </div>
              )}

              <div className="flex justify-between items-center w-full">
                  <div className="flex items-center space-x-3">
                    <div className={`w-11 h-11 rounded-xl flex-none flex items-center justify-center font-bold text-white shadow-sm text-sm mr-3
                        ${cat.id === 'xiaoxue' ? 'bg-green-400' : 
                          cat.id === 'chuzhong' ? 'bg-teal-400' :
                          cat.id === 'gaozhong' ? 'bg-blue-400' :
                          cat.id === 'CET4' ? 'bg-indigo-400' : 'bg-purple-400'
                        }`}>
                        {isLoading ? <Loader2 size={20} className="animate-spin" /> : cat.name.substring(0, 1)}
                    </div>
                    
                    <div className="flex flex-col min-w-0">
                        {/* Title Line */}
                        <div className="flex items-center flex-wrap gap-2">
                            <span className="font-bold text-gray-800 text-base">{cat.name}</span>
                            
                            {!isLoading && (
                                <>
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-600 border border-green-100 whitespace-nowrap">
                                    {stats.learned} 掌握
                                </span>
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-500 border border-red-100 whitespace-nowrap">
                                    {stats.mistake} 错题
                                </span>
                                </>
                            )}
                        </div>

                        {/* Subtitle / Status Line */}
                        <div className={`text-xs mt-1 truncate flex items-center ${isLoading ? 'text-blue-500 font-medium' : 'text-gray-400'}`}>
                            {isLoading ? (
                                <>
                                    <Download size={12} className="mr-1 animate-bounce" />
                                    <span>正在加载资源: {count.toLocaleString()}...</span>
                                </>
                            ) : (
                                <>
                                    <Book size={12} className="mr-1 opacity-70" />
                                    <span>词汇量: {count.toLocaleString()}</span>
                                </>
                            )}
                        </div>
                    </div>
                  </div>
                  {!isLoading && <ChevronRight size={18} className="text-gray-300 flex-none ml-2" />}
              </div>
            </button>
          )})}
        </div>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
           <span className="text-3xl">🎉</span>
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">恭喜通关！</h2>
        <p className="text-gray-600 mb-6 text-sm">该词库已暂无更多新词</p>
        <button 
           onClick={handleBack}
           className="px-6 py-2 bg-blue-600 text-white rounded-full font-bold shadow-md active:scale-95 transition-transform"
        >
          返回
        </button>
      </div>
    );
  }

  if (loadingQuestion || !currentWord) {
      return (
          <div className="flex flex-col items-center justify-center h-full">
              <Loader2 size={32} className="animate-spin text-blue-500 mb-2" />
              <p className="text-gray-400 text-sm">Loading...</p>
          </div>
      );
  }

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
                            aria-label="Play sentence audio"
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
