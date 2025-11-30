
import React, { useState } from 'react';
import { Trash, RefreshCw, CheckCircle, Loader2 } from 'lucide-react';
import { resetGlobalData } from '../services/db';
import { triggerHaptic } from '../utils/feedback';

const Settings: React.FC = () => {
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
      triggerHaptic(20);
      const confirmed = window.confirm(
          "⚠️ 警告 (Warning)\n\n" +
          "此操作将永久删除以下所有数据：\n" +
          "- 所有的学习进度 (Learning Progress)\n" +
          "- 错题本记录 (Mistakes Book)\n" +
          "- 我的成就与等级 (Achievements)\n" +
          "- 每日打卡记录 (Daily Streak)\n" +
          "- 当前积分 (Total Points)\n\n" +
          "确定要执行全局重置吗？(Are you sure to reset all?)"
      );

      if (confirmed) {
          triggerHaptic(30);
          setResetting(true);
          try {
            // 1. Clear IndexedDB
            await resetGlobalData();
            
            // 2. Clear LocalStorage just in case
            localStorage.clear();

            // 3. Feedback and Reload
            // Add a small delay to ensure IndexedDB transactions are fully flushed
            setTimeout(() => {
                alert("✅ 重置成功！应用将重新启动。\n(Reset successful! App will reload.)");
                window.location.reload(); 
            }, 500);
          } catch (e) {
            setResetting(false);
            alert("❌ 重置失败，请重试。(Reset failed)");
            console.error(e);
          }
      }
  };

  return (
    <div className="p-4 space-y-4 h-full bg-gray-50 overflow-y-auto">
      <h2 className="text-xl font-bold text-gray-800">设置 (Settings)</h2>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-bold text-gray-700 flex items-center text-sm">
                  <RefreshCw size={16} className="mr-2 text-blue-500" />
                  数据管理 (Data Management)
              </h3>
          </div>
          
          <div className="p-4">
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                  如果您想重新开始学习，可以使用下方的重置功能。这将清除您的所有个人进度，但不会删除已加载的词库。
              </p>
              <button 
                onClick={handleReset}
                disabled={resetting}
                className="w-full flex items-center justify-center space-x-2 p-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 active:bg-red-200 active:scale-95 transition-all border border-red-100"
              >
                  {resetting ? <Loader2 size={18} className="animate-spin" /> : <Trash size={18} />}
                  <span className="font-bold text-sm">全局重置 (Global Reset)</span>
              </button>
          </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden p-4">
          <h3 className="font-bold text-gray-700 mb-2 text-sm">关于 (About)</h3>
          <ul className="text-xs text-gray-500 space-y-2">
              <li className="flex items-center"><CheckCircle size={12} className="mr-2 text-green-500"/> Local Database Storage</li>
              <li className="flex items-center"><CheckCircle size={12} className="mr-2 text-green-500"/> Offline Mode Support</li>
              <li className="flex items-center"><CheckCircle size={12} className="mr-2 text-green-500"/> EN/CN Dictionary</li>
          </ul>
      </div>

      <div className="text-center text-gray-300 text-[10px] mt-8 pb-10">
          <p>VocabMaster v1.3.0</p>
          <p>Designed for English Learners</p>
      </div>
    </div>
  );
};

export default Settings;
