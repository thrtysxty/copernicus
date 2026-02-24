import React, { useState, useRef, useEffect } from 'react';
import { SlashCommandRegistry } from '../commands/registry';
import { SlashCommand } from '../commands/types';

interface SlashCommandInputProps {
  placeholder?: string;
  onSendMessage?: (text: string) => void;
  className?: string;
}

export const SlashCommandInput: React.FC<SlashCommandInputProps> = ({ 
  placeholder = "Type a message or /command...", 
  onSendMessage,
  className = ""
}) => {
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState<SlashCommand[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value.startsWith('/')) {
      const query = value.slice(1).split(' ')[0].toLowerCase();
      const filtered = SlashCommandRegistry.getAll().filter(c => 
        c.name.startsWith(query)
      );
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0 && !value.includes(' '));
      setSelectedIndex(0);
    } else {
      setShowSuggestions(false);
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectCommand(suggestions[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    } else if (e.key === 'Enter' && value.trim()) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const selectCommand = (cmd: SlashCommand) => {
    setValue(`/${cmd.name} `);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleSubmit = () => {
    if (value.startsWith('/')) {
      const parts = value.slice(1).trim().split(/\s+/);
      const name = parts[0];
      const args = parts.slice(1).join(' ');
      SlashCommandRegistry.dispatch(name, args);
    } else {
      onSendMessage?.(value);
    }
    setValue('');
  };

  return (
    <div className={`relative ${className}`}>
      {showSuggestions && (
        <div className="absolute bottom-full left-0 w-full bg-gray-800 border border-gray-700 rounded-t-md shadow-2xl z-50 overflow-hidden">
          <div className="p-2 text-[10px] uppercase text-gray-500 font-bold border-b border-gray-700">
            Commands
          </div>
          <div className="max-h-48 overflow-y-auto">
            {suggestions.map((cmd, i) => (
              <div 
                key={cmd.name}
                className={`px-3 py-2 cursor-pointer flex flex-col ${i === selectedIndex ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}
                onClick={() => selectCommand(cmd)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm">/{cmd.name}</span>
                  <span className={`text-[10px] px-1 rounded ${i === selectedIndex ? 'bg-blue-500' : 'bg-gray-700 text-gray-400'}`}>
                    {cmd.target}
                  </span>
                </div>
                <div className={`text-xs ${i === selectedIndex ? 'text-blue-100' : 'text-gray-400'}`}>
                  {cmd.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        type="text"
        className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
};
