import React, { useEffect, useState } from 'react';
import Layout from './components/Layout';
import Home from './views/Home';
import Quiz from './views/Quiz';
import Settings from './views/Settings';
import Mistakes from './views/Mistakes';
import Achievements from './views/Achievements';
import { AppTab, CATEGORIES, UserStats } from './types';
import { checkInStreak, getUserStats, isVocabularyLoaded, getVocabularyCount, clearVocabularyByCategory } from './services/db';
import { fetchAndParseVocabulary } from './utils/loader';

// Define the shape of our vocab status
export interface VocabStatus {
    count: number;
    loading: boolean;
}

const App: React.FC = () => {
  const [loading, setLoading] = useState(true); // Initial User Stats loading (fast)
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.HOME);
  const [homeView, setHomeView] = useState<'main' | 'mistakes' | 'achievements'>('main');
  
  // User State
  const [stats, setStats] = useState<UserStats>({ points: 0, streakDays: 0, lastLoginDate: '' });
  
  // Detailed status for each vocabulary category (count + loading state)
  const [vocabStatus, setVocabStatus] = useState<Record<string, VocabStatus>>({});

  useEffect(() => {
    const initApp = async () => {
      try {
        // 1. Fast Load: User Stats & Basic DB
        await checkInStreak();
        const s = await getUserStats();
        setStats(s);
        
        // Remove Splash Screen immediately so user can interact
        setLoading(false);

        // 2. Load Vocabularies
        loadVocabularies();

      } catch (e) {
          console.error("Failed to load application", e);
          setLoading(false); // Allow entry even if error, though might be empty
      }
    };

    initApp();
  }, []);

  const loadVocabularies = async () => {
      // Step A: First, check ALL categories in parallel to see what's already on disk.
      // This ensures the UI shows counts for existing libs immediately, 
      // without waiting for the first missing lib to parse.
      const statusUpdates: Record<string, VocabStatus> = {};
      const missingCategories = [];

      await Promise.all(CATEGORIES.map(async (cat) => {
          try {
              const isLoaded = await isVocabularyLoaded(cat.id);
              if (isLoaded) {
                  const count = await getVocabularyCount(cat.id);
                  statusUpdates[cat.id] = { count, loading: false };
              } else {
                  // Mark as needing load
                  statusUpdates[cat.id] = { count: 0, loading: true };
                  missingCategories.push(cat);
              }
          } catch (e) {
              console.error(`Metadata check failed for ${cat.id}`, e);
          }
      }));

      // Batch update state for immediate UI feedback
      setVocabStatus(prev => ({ ...prev, ...statusUpdates }));

      // Step B: Sequentially process only the missing categories
      // (Web Workers are parallel, but we queue them to avoid freezing low-end devices with too many concurrent workers)
      for (const cat of missingCategories) {
            try {
                // Cleanup potential partial data
                await clearVocabularyByCategory(cat.id);

                // Stream load with progress updates
                const success = await fetchAndParseVocabulary(cat.id, cat.file, (currentCount) => {
                    setVocabStatus(prev => ({ ...prev, [cat.id]: { count: currentCount, loading: true } }));
                });
                
                // Finalize
                if (success) {
                    const finalCount = await getVocabularyCount(cat.id);
                    setVocabStatus(prev => ({ ...prev, [cat.id]: { count: finalCount, loading: false } }));
                } else {
                    // Handle error state
                    setVocabStatus(prev => ({ ...prev, [cat.id]: { count: 0, loading: false } }));
                }
            } catch (error) {
                console.error(`Error processing ${cat.name}`, error);
                setVocabStatus(prev => ({ ...prev, [cat.id]: { count: 0, loading: false } }));
            }
      }
  };

  const handlePointsUpdate = (newPoints: number) => {
      setStats(prev => ({ ...prev, points: newPoints }));
  };

  // Only show splash screen for user stats (very fast)
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-blue-600 text-white px-6">
        <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mb-6"></div>
        <h1 className="text-3xl font-bold mb-2">English Master</h1>
        <p className="opacity-90 text-sm">Synchronizing user data...</p>
      </div>
    );
  }

  // Helper to get simple counts for Home/Layout
  const getSimpleCounts = () => {
      const counts: Record<string, number> = {};
      Object.keys(vocabStatus).forEach(k => counts[k] = vocabStatus[k].count);
      return counts;
  };

  const renderContent = () => {
    const simpleCounts = getSimpleCounts();

    if (activeTab === AppTab.HOME) {
        if (homeView === 'mistakes') return <Mistakes onBack={() => setHomeView('main')} />;
        if (homeView === 'achievements') return <Achievements onBack={() => setHomeView('main')} />;
        
        const totalWords = Object.values(simpleCounts).reduce((a, b) => a + b, 0);
        return <Home totalWords={totalWords} vocabCounts={simpleCounts} onNavigate={setHomeView} />;
    }
    if (activeTab === AppTab.LEARN) {
        // Pass full status object to Quiz so it can show loading bars
        return <Quiz onPointsUpdate={handlePointsUpdate} vocabCounts={simpleCounts} vocabStatus={vocabStatus} />;
    }
    if (activeTab === AppTab.SETTINGS) {
        return <Settings />;
    }
    return null;
  };

  return (
    <Layout activeTab={activeTab} onTabChange={(tab) => { setActiveTab(tab); setHomeView('main'); }} stats={stats}>
      {renderContent()}
    </Layout>
  );
};

export default App;