import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useIpcError } from '../../hooks/useIpcError'
import { useToastStore } from '../../store/toastStore'
import log from '../../utils/logger'
import { X, Check } from 'lucide-react'

interface SkillOnboardingModalProps {
  stackProfile: any
  onClose: () => void
  onDismiss: () => void
  onSuccess: () => void
}

const CATEGORIES = [
  'library-api-reference',
  'product-verification',
  'ci-cd-deployment',
  'code-quality-review',
  'architecture-patterns',
  'database-schema',
  'security-policies',
  'performance-guidelines',
  'ui-ux-standards'
]

export const SkillOnboardingModal: React.FC<SkillOnboardingModalProps> = ({ stackProfile, onClose, onDismiss, onSuccess }) => {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const invoke = useIpcError()

  useEffect(() => {
    const defaultSelected = new Set<string>()
    defaultSelected.add('library-api-reference')
    defaultSelected.add('code-quality-review')

    if (stackProfile.hasPlaywright || stackProfile.hasPytest) {
      defaultSelected.add('product-verification')
    }
    if (stackProfile.hasCI) {
      defaultSelected.add('ci-cd-deployment')
    }
    setSelectedCategories(Array.from(defaultSelected))
  }, [stackProfile])

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  const handleGenerate = async () => {
    if (selectedCategories.length === 0) return
    setIsGenerating(true)
    try {
      await invoke('skills:scaffold', {
        categories: selectedCategories,
        stackProfile
      })
      useToastStore.getState().addToast('Skills successfully generated', 'success')
      onSuccess()
    } catch (err) {
      log.error('Failed to generate skills', err)
      // useIpcError already shows a toast, but we should make sure we're not stuck loading
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-[#0a0a0a] border border-white/10 shadow-2xl rounded-lg overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-white/5 shrink-0 bg-white/5">
          <h2 className="text-[14px] font-bold text-zinc-100">Scaffold Project Skills</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto">
          <p className="text-[11px] text-zinc-400 mb-4 leading-relaxed">
            Based on your detected stack, we recommend creating the following AI agent skills. These skills give Jules specific context on how to work within this repository.
          </p>

          <div className="space-y-2">
            {CATEGORIES.map(category => {
              const isSelected = selectedCategories.includes(category)
              return (
                <label
                  key={category}
                  onClick={(e) => {
                    e.preventDefault()
                    toggleCategory(category)
                  }}
                  className={`flex items-center gap-3 p-3 border rounded cursor-pointer transition-all ${
                    isSelected
                      ? 'border-indigo-500/50 bg-indigo-500/10'
                      : 'border-white/5 bg-black/20 hover:border-white/20 hover:bg-black/40'
                  }`}
                >
                  <div
                    className={`flex items-center justify-center w-4 h-4 rounded border ${
                      isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-zinc-600'
                    }`}
                  >
                    {isSelected && <Check size={12} className="text-white" />}
                  </div>
                  <span className={`text-[11px] font-mono tracking-wide ${isSelected ? 'text-indigo-200' : 'text-zinc-400'}`}>
                    {category}
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        <div className="p-4 border-t border-white/5 flex items-center justify-between shrink-0 bg-black/40">
          <button
            onClick={onDismiss}
            disabled={isGenerating}
            className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
          >
            Skip
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || selectedCategories.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:text-indigo-400 text-white text-[10px] font-bold uppercase tracking-widest rounded transition-colors"
          >
            {isGenerating ? (
              <>
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Selected'
            )}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
