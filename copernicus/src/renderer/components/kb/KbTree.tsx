import React, { useState, useEffect, useCallback } from 'react'
import { ChevronRight, ChevronDown, Search, FileText } from 'lucide-react'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc } from '../../types/ipc'

interface KbArticleSummary {
  id: string
  title: string
  section: string
}

interface KbTreeProps {
  activeArticleId: string | null
  onSelectArticle: (id: string) => void
}

const SECTIONS = [
  'Foundations',
  'The Copernicus IDE',
  'Providers & Agents',
  'Advanced Techniques',
  'Workflows & Patterns',
  'Integrations',
]

export const KbTree: React.FC<KbTreeProps> = ({ activeArticleId, onSelectArticle }) => {
  const invoke = useIpcError()
  const [searchQuery, setSearchQuery] = useState('')
  const [articles, setArticles] = useState<Record<string, KbArticleSummary[]>>({})
  const [searchResults, setSearchResults] = useState<KbArticleSummary[] | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  const fetchArticles = useCallback(async () => {
    try {
      const res = await invoke<Record<string, KbArticleSummary[]>>('kb:list-articles')
      const data = unwrapIpc<Record<string, KbArticleSummary[]>>(res)
      if (data && typeof data === 'object') setArticles(data as Record<string, KbArticleSummary[]>)
    } catch (err) {
      // Suppress error
      // Suppress error
    }
  }, [invoke])

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null)
      return
    }
    try {
      const res = await invoke<KbArticleSummary[]>('kb:search', query)
      const data = unwrapIpc<KbArticleSummary[]>(res)
      if (data && Array.isArray(data)) setSearchResults(data)
    } catch (err) {
      // Suppress error
    }
  }, [invoke])

  useEffect(() => {
    fetchArticles()
  }, [fetchArticles])

  useEffect(() => {
    const handler = setTimeout(() => {
      performSearch(searchQuery)
    }, 300)
    return () => clearTimeout(handler)
  }, [searchQuery, performSearch])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && searchQuery) {
        setSearchQuery('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchQuery])

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full bg-[#080808] border-r border-copernicus-steel w-64 shrink-0">
      <header className="h-8 px-3 border-b border-white/5 shrink-0 flex items-center bg-black/20">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Knowledge Base</span>
      </header>

      <div className="p-2 border-b border-white/5 shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1.5 text-zinc-500" size={12} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search articles..."
            className="w-full bg-black/40 border border-zinc-800 rounded px-7 py-1 text-[10px] text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-copernicus-phosphor/50 transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 custom-scrollbar">
        {searchResults !== null ? (
          // Search Results View
          <div className="space-y-1">
            <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-zinc-500">Search Results</div>
            {searchResults.length === 0 && (
              <div className="px-2 py-2 text-[10px] text-zinc-600 italic">No articles found</div>
            )}
            {searchResults.map((article) => (
              <button
                key={article.id}
                onClick={() => onSelectArticle(article.id)}
                className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-[11px] truncate group ${
                  activeArticleId === article.id
                    ? 'bg-copernicus-phosphor text-[#050505] rounded-none' // §1.4 VT selection block
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
              >
                <FileText size={12} className={activeArticleId === article.id ? 'text-[#050505]' : 'text-zinc-600 group-hover:text-zinc-400'} shrink-0="true" />
                <span className="truncate">{article.title}</span>
              </button>
            ))}
          </div>
        ) : (
          // Tree View
          <div className="space-y-4 pb-4">
            {SECTIONS.map((section) => {
              const isCollapsed = collapsedSections.has(section)
              const sectionArticles = articles[section] || []

              if (sectionArticles.length === 0) return null // Hide empty sections for now, or could show empty state

              return (
                <div key={section} className="space-y-0.5">
                  <button
                    onClick={() => toggleSection(section)}
                    className="w-full flex items-center gap-1.5 px-1 py-1 text-left text-zinc-300 hover:text-zinc-100 group"
                  >
                    {isCollapsed ? (
                      <ChevronRight size={12} className="text-zinc-600 group-hover:text-zinc-400" />
                    ) : (
                      <ChevronDown size={12} className="text-zinc-600 group-hover:text-zinc-400" />
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-widest">{section}</span>
                  </button>

                  {!isCollapsed && (
                    <div className="pl-4 space-y-0.5 mt-1">
                      {sectionArticles.map((article) => (
                        <button
                          key={article.id}
                          onClick={() => onSelectArticle(article.id)}
                          className={`w-full text-left flex items-center gap-2 px-2 py-1 text-[11px] truncate group ${
                            activeArticleId === article.id
                              ? 'bg-copernicus-phosphor text-[#050505] rounded-none' // §1.4 VT selection block
                              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded'
                          }`}
                        >
                          <FileText size={12} className={activeArticleId === article.id ? 'text-[#050505]' : 'text-zinc-600 group-hover:text-zinc-400'} shrink-0="true" />
                          <span className="truncate">{article.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Render "uncategorized" or other sections not in SECTIONS */}
            {Object.keys(articles).filter(s => !SECTIONS.includes(s)).map((section) => {
              const isCollapsed = collapsedSections.has(section)
              const sectionArticles = articles[section] || []
              if (sectionArticles.length === 0) return null

              return (
                <div key={section} className="space-y-0.5 mt-4">
                  <button
                    onClick={() => toggleSection(section)}
                    className="w-full flex items-center gap-1.5 px-1 py-1 text-left text-zinc-300 hover:text-zinc-100 group"
                  >
                    {isCollapsed ? (
                      <ChevronRight size={12} className="text-zinc-600 group-hover:text-zinc-400" />
                    ) : (
                      <ChevronDown size={12} className="text-zinc-600 group-hover:text-zinc-400" />
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-widest">{section === 'uncategorized' ? 'Other Articles' : section}</span>
                  </button>

                  {!isCollapsed && (
                    <div className="pl-4 space-y-0.5 mt-1">
                      {sectionArticles.map((article) => (
                        <button
                          key={article.id}
                          onClick={() => onSelectArticle(article.id)}
                          className={`w-full text-left flex items-center gap-2 px-2 py-1 text-[11px] truncate group ${
                            activeArticleId === article.id
                              ? 'bg-copernicus-phosphor text-[#050505] rounded-none' // §1.4 VT selection block
                              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded'
                          }`}
                        >
                          <FileText size={12} className={activeArticleId === article.id ? 'text-[#050505]' : 'text-zinc-600 group-hover:text-zinc-400'} shrink-0="true" />
                          <span className="truncate">{article.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
