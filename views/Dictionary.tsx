import React from 'react';

const Dictionary: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="p-3 bg-white shadow-sm flex-none z-10 text-center border-b border-gray-200">
          <h1 className="text-base font-bold text-gray-800">百度翻译 (Baidu Translate)</h1>
      </div>

      {/* Iframe Container */}
      <div className="flex-1 w-full h-full overflow-hidden bg-white relative">
          <iframe 
            src="https://fanyi.baidu.com/?aldtype=85#en/zh/" 
            className="w-full h-full border-0 absolute inset-0"
            title="Baidu Translate"
            // Adding sandbox to allow scripts/forms but attempt to respect frame security
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
      </div>
    </div>
  );
};

export default Dictionary;