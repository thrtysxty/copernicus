import React from 'react'
import { FlippablePanel } from '../layout/FlippablePanel'
import { ChatThread } from './ChatThread'
import { ChatInput } from './ChatInput'
import { ChatBackFace } from './ChatBackFace'
import { useChatPanel } from './useChatPanel'
import { commandRegistry } from '../../commands/registry'
import { ErrorBoundary } from '../layout/ErrorBoundary'

interface ChatPanelProps {
  openFilePath?: string | null
  rootPath?: string
  panelId?: string
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ openFilePath = null, rootPath = '', panelId = 'chat' }) => {
  const chat = useChatPanel(openFilePath, rootPath, panelId)

  return (
    <div data-testid="panel-chat">
          <FlippablePanel
      id={panelId === 'chat' ? 'chat' : `chat-${panelId}`}
      front={
        <div className="flex flex-col h-full bg-copernicus-bg text-zinc-300 font-mono min-w-0 overflow-hidden">
          <ChatThread
            authStatus={chat.authStatus}
            messages={chat.messages}
            openFilePath={openFilePath}
            pendingModelSwitch={chat.pendingModelSwitch}
            acceptModelSwitch={chat.acceptModelSwitch}
            rejectModelSwitch={chat.rejectModelSwitch}
            handleSaveToStory={chat.handleSaveToStory}
            model={chat.model}
            setModel={chat.setModel}
            availableModels={chat.availableModels}
            showModelPicker={chat.showModelPicker}
            setShowModelPicker={chat.setShowModelPicker}
            isRepoActive={chat.isRepoActive}
            isFlipped={chat.isFlipped}
            isStreaming={chat.isStreaming}
            invoke={chat.invoke}
            contextUpdate={chat.contextUpdate}
          />
          {chat.showCompactionBanner && (
            <div className="mx-2 mb-2 p-2 bg-blue-900/20 border border-blue-700/50 rounded flex flex-col gap-2">
              <div className="flex items-start gap-2 text-blue-400 text-[10px] uppercase font-bold tracking-wider leading-relaxed">
                <span className="flex-shrink-0 mt-0.5">ℹ️</span>
                <span>Context window nearly full — older messages have been compacted.</span>
              </div>
              <div className="flex justify-end">
                <button 
                  onClick={chat.dismissCompactionBanner}
                  className="px-2 py-0.5 text-[9px] font-mono text-zinc-400 hover:text-zinc-300 transition-colors uppercase border border-zinc-700 hover:border-zinc-600 rounded"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
          {chat.lspWarning && (
            <div className="mx-2 mb-2 p-2 bg-yellow-900/20 border border-yellow-700/50 rounded flex flex-col gap-2">
              <div className="flex items-start gap-2 text-yellow-400 text-[10px] uppercase font-bold tracking-wider leading-relaxed">
                <span className="flex-shrink-0 mt-0.5">⚠️</span>
                <span>{chat.lspWarning}</span>
              </div>
              <div className="flex justify-end gap-2">
                <button 
                  onClick={chat.dismissLspWarning}
                  className="px-2 py-0.5 text-[9px] font-mono text-zinc-400 hover:text-zinc-300 transition-colors uppercase border border-zinc-700 hover:border-zinc-600 rounded"
                >
                  Dismiss
                </button>
                <button 
                  onClick={() => { chat.dismissLspWarning(); setTimeout(() => chat.handleSendMessage(), 0) }}
                  className="px-2 py-0.5 text-[9px] font-mono bg-yellow-900/40 text-yellow-400 hover:bg-yellow-900/60 transition-colors uppercase border border-yellow-700/50 rounded"
                >
                  Send anyway
                </button>
              </div>
            </div>
          )}
          <ChatInput
            input={chat.input} setInput={chat.setInput}
            context={chat.context} setContext={chat.setContext}
            isStreaming={chat.isStreaming}
            handleSendMessage={chat.handleSendMessage} handleFileAttach={chat.handleFileAttach}
            triggerPicker={chat.triggerPicker} handlePickerSelect={chat.handlePickerSelect}
            slashSuggestions={chat.slashSuggestions} showSuggestions={chat.showSuggestions}
            setShowSuggestions={chat.setShowSuggestions} setSlashSuggestions={chat.setSlashSuggestions}
            pickerMode={chat.pickerMode} setPickerMode={chat.setPickerMode}
            pickerResults={chat.pickerResults} setPickerResults={chat.setPickerResults}
            rootPath={rootPath} commandRegistry={commandRegistry}
            pendingImage={chat.pendingImage} setPendingImage={chat.setPendingImage}
          />
        </div>
      }
      back={
        <ErrorBoundary fallback={<div className="p-4 text-xs text-red-400 font-mono">PANEL_ERROR — check console</div>}>
          <ChatBackFace
            input={chat.input}
            activeBackTab={chat.activeBackTab} setActiveBackTab={chat.setActiveBackTab}
            toggleFlip={chat.toggleFlip} model={chat.model} setModel={chat.setModel}
            availableModels={chat.availableModels} totalTokens={chat.messages.reduce((acc, m) => acc + (m.tokens || 0), 0)}
            contextMaxTokens={(Array.isArray(chat.availableModels) ? chat.availableModels.find(m => m.id === chat.model) : undefined)?.contextWindow || 0}
            context={chat.context} setContext={chat.setContext} handleClearContext={chat.handleClearContext}
            authStatus={chat.authStatus} isSavingPrompt={chat.isSavingPrompt}
            setIsSavingPrompt={chat.setIsSavingPrompt} newPromptName={chat.newPromptName}
            setNewPromptName={chat.setNewPromptName} confirmSavePrompt={chat.confirmSavePrompt}
            savedPrompts={chat.savedPrompts} usePrompt={chat.usePrompt} deletePrompt={chat.deletePrompt}
            messages={chat.messages} exportChat={chat.exportChat}
            guideMessages={chat.guideMessages} guideInput={chat.guideInput}
            setGuideInput={chat.setGuideInput} handleGuideSubmit={chat.handleGuideSubmit}
            showClaudeFallback={chat.showClaudeFallback} handleAskClaude={chat.handleAskClaude}
            setShowClaudeFallback={chat.setShowClaudeFallback} guideScrollRef={chat.guideScrollRef}
            invoke={chat.invoke}
          />
        </ErrorBoundary>
      }
    />
    </div>
  )
}
