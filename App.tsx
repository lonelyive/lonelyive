import React, { useEffect, useState } from 'react';
import Layout from './components/Layout';
import Home from './views/Home';
import Quiz from './views/Quiz';
import Settings from './views/Settings';
import Mistakes from './views/Mistakes';
import Achievements from './views/Achievements';
import { AppTab, CATEGORIES, UserStats } from './types';
import { checkInStreak, getUserStats, getVocabularyCount, clearVocabularyByCategory } from './services/db';
import { fetchAndParseVocabulary } from './utils/loader';

export interface VocabStatus {
    count: number;
    ready: boolean;
}

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.HOME);
  const [homeView, setHomeView] = useState<'main' | 'mistakes' | 'achievements'>('main');
  const [stats, setStats] = useState<UserStats>({ points: 0, streakDays: 0, lastLoginDate: '' });
  const [vocabStatus, setVocabStatus] = useState<Record<string, VocabStatus>>({});

  useEffect(() => {
    const initApp = async () => {
      try {
        // 1. Load User Data
        await checkInStreak();
        const s = await getUserStats();
        setStats(s);
        
        // 2. Show UI immediately
        setLoading(false);
        
        // 3. Start Background Load
        autoLoadVocabularies();

      } catch (e) {
          console.error("[App] Init failed", e);
          setLoading(false);
      }
    };

    initApp();
  }, []);

  const autoLoadVocabularies = async () => {
      const missingCategories = [];
      const initialStatus: Record<string, VocabStatus> = {};
      
      // Phase 1: Quick DB Check
      for (const cat of CATEGORIES) {
          try {
              const count = await getVocabularyCount(cat.id);
              if (count > 10) {
                  initialStatus[cat.id] = { count, ready: true };
              } else {
                  initialStatus[cat.id] = { count: 0, ready: false };
                  missingCategories.push(cat);
              }
          } catch (e) {
              initialStatus[cat.id] = { count: 0, ready: false };
              missingCategories.push(cat);
          }
      }
      setVocabStatus(initialStatus);

      // Phase 2: Download & Parse Missing
      for (const cat of missingCategories) {
            console.log(`[App] ⬇️ Auto-loading: ${cat.name}`);
            try {
                await clearVocabularyByCategory(cat.id);
                const success = await fetchAndParseVocabulary(cat.id, cat.file, (progressCount) => {
                    // Optional: update progress if needed, but we keep UI simple
                });
                
                if (success) {
                    const finalCount = await getVocabularyCount(cat.id);
                    console.log(`[App] 🎉 Loaded ${cat.name}: ${finalCount}`);
                    setVocabStatus(prev => ({ ...prev, [cat.id]: { count: finalCount, ready: true } }));
                } else {
                    console.error(`[App] ❌ Failed to load ${cat.name}`);
                }
            } catch (err) {
                console.error(`[App] ❌ Error loading ${cat.name}:`, err);
            }
      }
  };

  const handlePointsUpdate = (newPoints: number) => {
      setStats(prev => ({ ...prev, points: newPoints }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-blue-600 text-white px-6">
        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-medium">Initializing...</p>
      </div>
    );
  }

  const renderContent = () => {
    const counts: Record<string, number> = {};
    // Safe access to vocabStatus
    Object.keys(vocabStatus || {}).forEach(k => counts[k] = vocabStatus[k]?.count || 0);

    if (activeTab === AppTab.HOME) {
        if (homeView === 'mistakes') return <Mistakes onBack={() => setHomeView('main')} />;
        if (homeView === 'achievements') return <Achievements onBack={() => setHomeView('main')} />;
        
        const totalWords = Object.values(counts).reduce((a, b) => a + b, 0);
        return <Home totalWords={totalWords} vocabCounts={counts} onNavigate={setHomeView} />;
    }
    if (activeTab === AppTab.LEARN) {
        return <Quiz onPointsUpdate={handlePointsUpdate} vocabStatus={vocabStatus} />;
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