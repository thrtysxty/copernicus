import React, { useState, useEffect, useRef } from 'react';
import { SlashCommandInput } from './SlashCommandInput';
import { useAgentStore, AgentId } from '../store/agents';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const ChatPanel: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I am your ATLAS planning assistant. How can I help you architect your project today?' }
  ]);
  const [model, setModel] = useState('claude-sonnet-4-6');
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const lastOutputs = useAgentStore(s => s.lastOutputs);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cleanup = window.electron.ipcRenderer.on('chat:stream', (text: string) => {
      setStreamingContent(prev => prev + text);
    });
    
    const errorCleanup = window.electron.ipcRenderer.on('chat:error', (error: string) => {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error}` }]);
      setIsStreaming(false);
      setStreamingContent('');
    });

    return () => {
      cleanup();
      errorCleanup();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const handleSendMessage = async (text: string) => {
    let processedText = text;
    
    // Inject context via @last markers
    const markers: AgentId[] = ['claude', 'gemini', 'jules'];
    markers.forEach(id => {
      const marker = `@last-${id}`;
      if (text.includes(marker)) {
        const output = lastOutputs[id];
        const snippet = output ? `\n--- LAST ${id.toUpperCase()} OUTPUT ---\n${output}\n--- END ---\n` : `\n[No output found for ${id}]\n`;
        processedText = processedText.replace(marker, snippet);
      }
    });

    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setIsStreaming(true);
    setStreamingContent('');

    const response = await window.electron.ipcRenderer.invoke('chat:send', { 
      messages: newMessages.map(m => ({ 
        role: m.role, 
        content: m.role === 'user' && m.content === text ? processedText : m.content 
      })), 
      model 
    });

    if (response) {
      setMessages(prev => [...prev, { role: 'assistant', content: response.content }]);
      setIsStreaming(false);
      setStreamingContent('');
    }
  };

  return (
    <div className="flex-1 bg-gray-900 border-l border-gray-700 flex flex-col overflow-hidden">
      <div className="p-2 border-b border-gray-700 font-bold text-gray-400 text-xs uppercase tracking-wider flex justify-between items-center bg-gray-800 bg-opacity-50">
        <div className="flex items-center space-x-2">
          <span>Planning Chat</span>
          <select 
            value={model} 
            onChange={(e) => setModel(e.target.value)}
            className="bg-gray-700 text-[10px] border-none rounded px-1 outline-none text-gray-300"
          >
            <option value="claude-sonnet-4-6">Claude 3.5 Sonnet</option>
            <option value="claude-opus-4-6">Claude 3 Opus</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            <option value="gemini-2.0-pro">Gemini 2.0 Pro</option>
          </select>
        </div>
        <button 
          onClick={() => setMessages([])}
          className="text-[10px] hover:text-white opacity-50 hover:opacity-100 transition"
        >
          Clear
        </button>
      </div>
      
      <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[90%] p-2 rounded-lg text-sm whitespace-pre-wrap shadow-sm ${
              msg.role === 'user' 
                ? 'bg-blue-700 text-white rounded-tr-none' 
                : 'bg-gray-800 text-gray-200 rounded-tl-none border border-gray-700'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isStreaming && (
          <div className="flex flex-col items-start">
            <div className="max-w-[90%] p-2 rounded-lg text-sm whitespace-pre-wrap bg-gray-800 text-gray-200 rounded-tl-none border border-gray-700">
              {streamingContent}
              <span className="animate-pulse inline-block w-2 h-4 bg-blue-500 ml-1"></span>
            </div>
          </div>
        )}
      </div>
      
      <div className="p-2 border-t border-gray-700 bg-gray-800 bg-opacity-20">
        <SlashCommandInput 
          onSendMessage={handleSendMessage}
          placeholder="Plan architecture or /command..."
        />
        <div className="mt-1 flex space-x-2 overflow-x-auto pb-1 no-scrollbar">
          {['claude', 'gemini', 'jules'].map(id => (
            <span 
              key={id} 
              className="text-[9px] text-gray-500 font-mono bg-gray-800 px-1 rounded border border-gray-700 cursor-help whitespace-nowrap"
              title={`Inject last ${id} output`}
            >
              @last-{id}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
