import React, { useEffect, useState } from 'react';
import { SplashScreen } from '@capacitor/splash-screen'; 
import { StatusBar, Style } from '@capacitor/status-bar'; 
import Layout from './components/Layout';
import Home from './views/Home';
import Quiz from './views/Quiz';
import Settings from './views/Settings';
import Mistakes from './views/Mistakes';
import Achievements from './views/Achievements';
import { AppTab, CATEGORIES, UserStats } from './types';
import { checkInStreak, getUserStats, getVocabularyCount, clearVocabularyByCategory } from './services/db';
import { fetchAndParseVocabulary } from './utils/loader';
import { BookMarked, Sparkles } from 'lucide-react';

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
        // Reset Status Bar to default behavior
        try {
            await StatusBar.setStyle({ style: Style.Dark });
            await StatusBar.setOverlaysWebView({ overlay: false }); // Disable overlay
            await StatusBar.setBackgroundColor({ color: '#333333' }); // Match config
        } catch (e) {
            // Ignore on web
        }

        const vocabLoadTask = autoLoadVocabularies();
        const userLoadTask = (async () => {
            await checkInStreak();
            return await getUserStats();
        })();

        const splashDelay = new Promise(resolve => setTimeout(resolve, 1500));
        const [userData] = await Promise.all([userLoadTask, splashDelay]);
        
        setStats(userData);
        setLoading(false);

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

      for (const cat of missingCategories) {
            console.log(`[App] ⬇️ Auto-loading: ${cat.name}`);
            try {
                await clearVocabularyByCategory(cat.id);
                const success = await fetchAndParseVocabulary(cat.id, cat.file, () => {});
                if (success) {
                    const finalCount = await getVocabularyCount(cat.id);
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
      // Removed pt-safe since we are no longer immersive
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-blue-600 to-indigo-700 text-white px-6">
        <div className="relative mb-6">
            <div className="absolute inset-0 bg-white/20 rounded-full blur-xl animate-pulse-slow"></div>
            <div className="bg-white p-5 rounded-3xl shadow-xl relative z-10 animate-slide-up">
                <BookMarked size={64} className="text-blue-600" />
                <div className="absolute -top-2 -right-2 bg-amber-400 p-1.5 rounded-full border-4 border-blue-600">
                    <Sparkles size={16} className="text-white" />
                </div>
            </div>
        </div>
        
        <h1 className="text-4xl font-black mb-2 tracking-tight animate-fade-in">单词大师</h1>
        <p className="opacity-80 text-sm tracking-widest uppercase font-medium animate-fade-in" style={{animationDelay: '0.1s'}}>Word Master</p>
        
        <div className="mt-12 flex flex-col items-center space-y-3 animate-fade-in" style={{animationDelay: '0.2s'}}>
            <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
            <p className="text-xs opacity-60">正在准备词库...</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    const counts: Record<string, number> = {};
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