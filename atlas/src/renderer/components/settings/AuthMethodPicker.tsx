import React from 'react';
import { Key, Globe, FileText } from 'lucide-react';

interface AuthMethodPickerProps {
  onSelect: (method: string) => void;
  onClose: () => void;
}

export const AuthMethodPicker: React.FC<AuthMethodPickerProps> = ({ onSelect, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="p-4 border-b border-gray-700 bg-gray-800 flex justify-between items-center">
          <h3 className="font-bold text-white">Select Auth Method</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">×</button>
        </div>
        <div className="p-2 space-y-1">
          <button 
            onClick={() => onSelect('oauth')}
            className="w-full flex items-center space-x-3 p-3 hover:bg-gray-800 rounded-md transition text-left group"
          >
            <Globe className="text-blue-400 group-hover:text-blue-300" size={20} />
            <div>
              <div className="text-sm font-bold text-gray-200">OAuth Browser Flow</div>
              <div className="text-[10px] text-gray-500">Sign in via provider's website</div>
            </div>
          </button>
          <button 
            onClick={() => onSelect('manual')}
            className="w-full flex items-center space-x-3 p-3 hover:bg-gray-800 rounded-md transition text-left group"
          >
            <Key className="text-amber-400 group-hover:text-amber-300" size={20} />
            <div>
              <div className="text-sm font-bold text-gray-200">Manual API Key</div>
              <div className="text-[10px] text-gray-500">Enter your key directly</div>
            </div>
          </button>
          <button 
            onClick={() => onSelect('file')}
            className="w-full flex items-center space-x-3 p-3 hover:bg-gray-800 rounded-md transition text-left group opacity-50 cursor-not-allowed"
            disabled
          >
            <FileText className="text-green-400" size={20} />
            <div>
              <div className="text-sm font-bold text-gray-200">Credentials File</div>
              <div className="text-[10px] text-gray-500">Auto-detected from local disk</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
