import log from '../../utils/logger'
import { useEffect, useState } from 'react';
import { useIpcError } from '../../hooks/useIpcError';
import { IpcResult } from '../../types/ipc';

interface ContractProposal {
  proposal_id: string;
  role_name: string;
  rationale: string;
  evidence: string;
  proposed_diff: string;
  state: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  reviewed_by?: string;
  reviewed_at?: string;
}

interface ProposalListResult {
  pending: ContractProposal[];
  history: ContractProposal[];
}

function DiffViewer({ diff }: { diff: string }) {
  return (
    <pre className="text-xs font-mono bg-zinc-900 rounded p-3 overflow-x-auto leading-relaxed">
      {diff.split('\n').map((line, i) => (
        <span key={i} className={
          line.startsWith('+') ? 'text-green-400 block' :
          line.startsWith('-') ? 'text-red-400 block' :
          line.startsWith('@@') ? 'text-blue-400 block' :
          'text-zinc-500 block'
        }>{line}</span>
      ))}
    </pre>
  );
}

export function ContractProposalPanel() {
  const invoke = useIpcError();
  const [data, setData] = useState<ProposalListResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const result = await invoke<IpcResult<ProposalListResult>>('hub:get-proposals');
      if (result && result.ok && result.data) {
        setData(result.data);
      } else if (result && !result.ok) {
        setError(result.error ?? 'Unknown error fetching proposals');
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    fetchData();

    // Listen for live proposal events
    const remove = (window as any).ipcRenderer.on('contract:proposal_ready', () => {
      fetchData();
    });

    return () => remove();
  }, []);

  const handleApprove = async (p: ContractProposal) => {
    try {
      const result = await invoke<IpcResult<{ success: boolean }>>('hub:approve-proposal', { proposalId: p.proposal_id });
      if (result && result.ok) {
        fetchData();
      }
    } catch (e: any) {
      log.error('Approve failed', e);
    }
  };

  const handleReject = async (p: ContractProposal) => {
    const reason = window.prompt('Rejection reason:') ?? 'No reason provided';
    try {
      const result = await invoke<IpcResult<{ success: boolean }>>('hub:reject-proposal', { proposalId: p.proposal_id, reason });
      if (result && result.ok) {
        fetchData();
      }
    } catch (e: any) {
      log.error('Reject failed', e);
    }
  };

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#050505]">
        <div className="text-red-400 font-mono text-sm border border-red-900/50 bg-red-950/20 p-4 rounded max-w-lg text-center">
          Failed to load proposals: {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#050505]">
        <div className="text-zinc-500 font-mono text-sm animate-pulse">
          Loading proposals...
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#050505] overflow-y-auto overflow-x-hidden p-8">

      {/* PENDING SECTION */}
      <div className="mb-12">
        <h2 className="text-sm font-mono text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Pending Proposals
        </h2>

        {data.pending.length === 0 ? (
          <div className="text-zinc-500 font-mono text-sm">No pending proposals.</div>
        ) : (
          <div className="flex flex-col gap-6">
            {data.pending.map((p) => (
              <div key={p.proposal_id} className="border border-zinc-800 rounded bg-zinc-900/50 p-6 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-white font-mono font-bold">{p.role_name}</h3>
                    <p className="text-zinc-400 text-sm mt-1">{p.rationale}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReject(p)}
                      className="px-3 py-1.5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-mono text-xs transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(p)}
                      className="px-3 py-1.5 rounded bg-copernicus-phosphor text-[#050505] hover:brightness-110 font-mono text-xs transition-all"
                    >
                      Approve
                    </button>
                  </div>
                </div>

                <div className="text-xs text-zinc-500 font-mono">
                  Evidence: {p.evidence}
                </div>

                <DiffViewer diff={p.proposed_diff} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* HISTORY SECTION */}
      <div>
        <h2 className="text-sm font-mono text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-zinc-600" />
          History
        </h2>

        {data.history.length === 0 ? (
          <div className="text-zinc-500 font-mono text-sm">No proposal history.</div>
        ) : (
          <div className="flex flex-col gap-6">
            {data.history.map((p) => (
              <div key={p.proposal_id} className="border border-zinc-800 rounded bg-zinc-900/50 p-6 flex flex-col gap-4 opacity-75 hover:opacity-100 transition-opacity">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-white font-mono font-bold flex items-center gap-2">
                      {p.role_name}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.state === 'APPROVED' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {p.state}
                      </span>
                    </h3>
                    <p className="text-zinc-400 text-sm mt-1">{p.rationale}</p>
                  </div>
                  <div className="text-xs text-zinc-500 font-mono text-right">
                    <div>{p.reviewed_by}</div>
                    <div>{p.reviewed_at ? new Date(p.reviewed_at).toLocaleString() : ''}</div>
                  </div>
                </div>

                <div className="text-xs text-zinc-500 font-mono">
                  Evidence: {p.evidence}
                </div>

                <details>
                  <summary className="text-xs font-mono text-zinc-400 cursor-pointer hover:text-white mb-2">
                    Show Diff
                  </summary>
                  <DiffViewer diff={p.proposed_diff} />
                </details>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
