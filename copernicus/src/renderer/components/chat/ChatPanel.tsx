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
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ openFilePath = null, rootPath = '' }) => {
  const chat = useChatPanel(openFilePath, rootPath)

  return (
    <FlippablePanel
      id="chat"
      front={
        <div className="flex flex-col h-full bg-copernicus-bg text-zinc-300 font-mono min-w-0 overflow-hidden">
          <ChatThread
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
          />
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
            contextMaxTokens={chat.availableModels.find(m => m.id === chat.model)?.contextWindow || 0}
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
  )
}
