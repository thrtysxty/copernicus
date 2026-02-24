import React from 'react';

interface TabBarProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const TabBar: React.FC<TabBarProps> = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div className="flex bg-gray-800 text-gray-400 text-sm border-b border-gray-700">
      {tabs.map((tab) => (
        <button
          key={tab}
          className={`px-4 py-1 hover:bg-gray-700 focus:outline-none ${activeTab === tab ? 'bg-gray-900 text-white border-t-2 border-blue-500' : 'border-t-2 border-transparent'}`}
          onClick={() => onTabChange(tab)}
        >
          {tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      ))}
    </div>
  );
};
