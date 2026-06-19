import React, { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChevronRight, ThumbsUp, ThumbsDown } from 'lucide-react'
import { useIpcError } from '../../hooks/useIpcError'
import { unwrapIpc } from '../../types/ipc'

interface KbArticleProps {
  articleId: string
}

interface ArticleData {
  id: string
  title: string
  section: string
  content: string
}

export const KbArticle: React.FC<KbArticleProps> = ({ articleId }) => {
  const invoke = useIpcError()
  const [article, setArticle] = useState<ArticleData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchArticle = async () => {
      setLoading(true)
      try {
        const res = await invoke<ArticleData>('kb:get-article', articleId)
        const data = unwrapIpc<ArticleData>(res)
        if (data && typeof data === 'object') {
          setArticle(data as ArticleData)
        } else {
          setArticle(null)
        }
      } catch (err) {
        // Suppressed error
        setArticle(null)
      } finally {
        setLoading(false)
      }
    }

    if (articleId) {
      fetchArticle()
    }
  }, [articleId, invoke])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#050505]">
        <span className="text-[11px] text-zinc-500 font-mono uppercase tracking-widest animate-pulse">Loading Article...</span>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#050505]">
        <span className="text-[11px] text-red-500 font-mono uppercase tracking-widest">Article not found</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#050505] overflow-hidden">
      {/* Article Header */}
      <header className="h-14 px-6 border-b border-white/5 shrink-0 flex items-center justify-between bg-[#080808]">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-zinc-600">
            <span>Knowledge Base</span>
            <ChevronRight size={10} />
            <span>{article.section || 'Uncategorized'}</span>
          </div>
          <h1 className="text-lg font-bold text-zinc-200 tracking-tight">{article.title}</h1>
        </div>

        {/* Voting Widget Placeholder (Story 570) */}
        <div className="flex items-center gap-2">
          <button className="p-1.5 rounded text-zinc-500 hover:text-copernicus-phosphor hover:bg-copernicus-phosphor transition-colors" title="Helpful">
            <ThumbsUp size={14} />
          </button>
          <button className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-400 transition-colors" title="Not Helpful">
            <ThumbsDown size={14} />
          </button>
        </div>
      </header>

      {/* Article Body */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-3xl mx-auto prose prose-invert prose-phosphor prose-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {article.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
