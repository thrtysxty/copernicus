import React, { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useIpcError } from '../../../hooks/useIpcError'
import { unwrapIpc } from '../../../types/ipc'

interface AuditResult {
  skillName: string
  file: string
  issue: 'summary-style' | 'no-trigger' | 'too-short'
  line: number
  current: string
}

const ISSUE_LABELS: Record<AuditResult['issue'], string> = {
  'summary-style': 'Summary-style description',
  'no-trigger':    'Missing trigger keyword',
  'too-short':     'Description too short',
}

export const SkillsSection: React.FC = () => {
  const invoke = useIpcError()
  const [results, setResults] = useState<AuditResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    invoke<AuditResult[]>('skills:audit')
      .then((res) => setResults(unwrapIpc<AuditResult[]>(res) ?? []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }, [invoke])

  const bySkill = results.reduce<Record<string, AuditResult[]>>((acc, r) => {
    ;(acc[r.skillName] ??= []).push(r)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-white mb-1">Skills</h2>
        <p className="text-xs text-zinc-500">Audit results for skill descriptions in <code className="text-zinc-400">.claude/skills/</code></p>
      </div>

      {loading && <p className="text-xs text-zinc-500">Running audit…</p>}

      {!loading && results.length === 0 && (
        <p className="text-xs text-zinc-500">No description issues found.</p>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-yellow-400 text-xs font-medium">
            <AlertTriangle size={13} />
            <span>{results.length} warning{results.length !== 1 ? 's' : ''} across {Object.keys(bySkill).length} skill{Object.keys(bySkill).length !== 1 ? 's' : ''}</span>
          </div>

          {Object.entries(bySkill).map(([skillName, issues]) => (
            <div key={skillName} className="border border-zinc-800 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-zinc-900/60 text-xs font-mono text-zinc-300 border-b border-zinc-800">
                {skillName}
              </div>
              <div className="divide-y divide-zinc-800/60">
                {issues.map((issue, i) => (
                  <div key={i} className="px-4 py-3 flex items-start gap-3">
                    <AlertTriangle size={12} className="text-yellow-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs text-yellow-400 font-medium mb-0.5">
                        {ISSUE_LABELS[issue.issue]} <span className="text-zinc-500 font-normal">— line {issue.line}</span>
                      </div>
                      <div className="text-xs text-zinc-400 font-mono truncate">
                        {issue.current.length > 80 ? issue.current.slice(0, 80) + '…' : issue.current}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
