import React, { useState, useEffect } from 'react';
import { useIpcError } from '../../hooks/useIpcError';
import { HubEvent, HubAttribution, HubCostSummary } from '../../types/hub';
import { AlertTriangle, User, Bot, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { unwrapIpc, IpcResult } from '../../types/ipc';

export function HubLedgerPanel() {
  const invoke = useIpcError();
  const [activeTab, setActiveTab] = useState<'events' | 'attribution' | 'cost'>('events');

  const [events, setEvents] = useState<HubEvent[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsPage, setEventsPage] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [attributions, setAttributions] = useState<HubAttribution[]>([]);
  const [attrTotal, setAttrTotal] = useState(0);
  const [attrPage, setAttrPage] = useState(0);
  const [surfaceFilter, setSurfaceFilter] = useState<string>('');

  const [costSummary, setCostSummary] = useState<HubCostSummary | null>(null);

  const fetchEvents = async (page: number, append = false) => {
    const res = await invoke<IpcResult<{ events: HubEvent[]; total: number }>>('hub:get-events', { limit: 50, offset: page * 50 });
    if (res.ok && res.data) {
      const { events: newEvents, total } = unwrapIpc<{ events: HubEvent[]; total: number }>(res);
      setEvents(prev => append ? [...prev, ...newEvents] : newEvents);
      setEventsTotal(total);
    }
  };

  const fetchAttribution = async (page: number, surface: string, append = false) => {
    const res = await invoke<IpcResult<{ rows: HubAttribution[]; total: number }>>('hub:get-attribution', { limit: 50, offset: page * 50, surface: surface || undefined });
    if (res.ok && res.data) {
      const { rows, total } = unwrapIpc<{ rows: HubAttribution[]; total: number }>(res);
      setAttributions(prev => append ? [...prev, ...rows] : rows);
      setAttrTotal(total);
    }
  };

  const fetchCost = async () => {
    const res = await invoke<IpcResult<HubCostSummary>>('hub:get-cost-summary');
    if (res.ok && res.data) {
      setCostSummary(unwrapIpc<HubCostSummary>(res));
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (activeTab === 'events') {
      fetchEvents(0);
      interval = setInterval(() => fetchEvents(0), 10000);
    } else if (activeTab === 'attribution') {
      fetchAttribution(0, surfaceFilter);
      interval = setInterval(() => fetchAttribution(0, surfaceFilter), 10000);
    } else if (activeTab === 'cost') {
      fetchCost();
      interval = setInterval(() => fetchCost(), 60000);
    }
    return () => {
        if (interval) clearInterval(interval);
    };
  }, [activeTab, surfaceFilter]);

  const loadMoreEvents = () => {
    const nextPage = eventsPage + 1;
    setEventsPage(nextPage);
    fetchEvents(nextPage, true);
  };

  const loadMoreAttr = () => {
    const nextPage = attrPage + 1;
    setAttrPage(nextPage);
    fetchAttribution(nextPage, surfaceFilter, true);
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const nextSet = new Set(prev);
      if (nextSet.has(id)) nextSet.delete(id);
      else nextSet.add(id);
      return nextSet;
    });
  };

  // Group consecutive token:checked events
  const groupedEvents: any[] = [];
  let currentGroup: any = null;

  events.forEach(ev => {
    if (ev.event_type === 'token:checked') {
      if (!currentGroup) {
        currentGroup = { type: 'group', id: ev.event_id, events: [ev], token_id: ev.token_id };
        groupedEvents.push(currentGroup);
      } else {
        currentGroup.events.push(ev);
      }
    } else {
      currentGroup = null;
      groupedEvents.push({ type: 'single', ev });
    }
  });

  return (
    <div data-testid="panel-hub" className="h-full flex flex-col bg-[#1A1A1A] text-[#E0E0E0] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-[#252525] border-b border-zinc-800 shrink-0">
        <button
          className={`px-3 py-1 text-sm font-medium transition-colors ${activeTab === 'events' ? 'bg-copernicus-phosphor text-[#050505] rounded-none' : 'text-zinc-500 hover:text-zinc-300'}`}
          onClick={() => { setActiveTab('events'); setEventsPage(0); }}
        >
          Events
        </button>
        <button
          className={`px-3 py-1 text-sm font-medium transition-colors ${activeTab === 'attribution' ? 'bg-copernicus-phosphor text-[#050505] rounded-none' : 'text-zinc-500 hover:text-zinc-300'}`}
          onClick={() => { setActiveTab('attribution'); setAttrPage(0); }}
        >
          Attribution
        </button>
        <button
          className={`px-3 py-1 text-sm font-medium transition-colors ${activeTab === 'cost' ? 'bg-copernicus-phosphor text-[#050505] rounded-none' : 'text-zinc-500 hover:text-zinc-300'}`}
          onClick={() => setActiveTab('cost')}
        >
          Cost
        </button>
        <div className="flex-grow" />
        <button className="text-zinc-400 hover:text-zinc-200" onClick={() => {
            if (activeTab === 'events') fetchEvents(0);
            if (activeTab === 'attribution') fetchAttribution(0, surfaceFilter);
            if (activeTab === 'cost') fetchCost();
        }}>
           <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 relative">
        {activeTab === 'events' && (
          <div className="flex flex-col gap-2">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase text-zinc-500 border-b border-zinc-800">
                <tr>
                  <th className="px-2 py-2">Timestamp</th>
                  <th className="px-2 py-2">Token ID</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Result/Notes</th>
                </tr>
              </thead>
              <tbody>
                {groupedEvents.map((item, index) => {
                   if (item.type === 'group') {
                     const isExpanded = expandedGroups.has(item.id);
                     return (
                       <React.Fragment key={item.id + '-' + index}>
                         <tr className="border-b border-zinc-800/50 hover:bg-zinc-800/20 cursor-pointer" onClick={() => toggleGroup(item.id)}>
                           <td className="px-2 py-2 whitespace-nowrap text-zinc-500 flex items-center gap-1">
                             {isExpanded ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>}
                             {new Date(item.events[0].timestamp).toLocaleString()}
                           </td>
                           <td className="px-2 py-2 font-mono text-xs">{item.token_id.substring(0, 12)}...</td>
                           <td className="px-2 py-2 text-zinc-500 italic flex items-center gap-1">
                             {item.events.length} token:checked events
                           </td>
                           <td className="px-2 py-2 text-zinc-500 italic">
                             Collapsed
                           </td>
                         </tr>
                         {isExpanded && item.events.map((ev: HubEvent) => (
                           <tr key={ev.event_id} className="border-b border-zinc-800/20 bg-zinc-800/10 hover:bg-zinc-800/30">
                             <td className="px-2 py-2 whitespace-nowrap text-zinc-600 pl-8">{new Date(ev.timestamp).toLocaleString()}</td>
                             <td className="px-2 py-2 font-mono text-xs text-zinc-500">{ev.token_id.substring(0, 12)}...</td>
                             <td className="px-2 py-2 text-zinc-400">token:checked</td>
                             <td className="px-2 py-2 text-zinc-500 truncate max-w-xs" title={ev.notes || ev.result || ''}>{ev.notes || ev.result || '-'}</td>
                           </tr>
                         ))}
                       </React.Fragment>
                     );
                   }

                   const ev = item.ev;
                   let color = 'text-zinc-300';
                   if (ev.event_type === 'token:minted') color = 'text-green-400';
                   if (ev.event_type === 'token:revoked' || ev.event_type === 'token:expired') color = 'text-red-400';
                   const isAlert = ev.event_type === 'token:loop_suspected' || ev.event_type === 'token:renewal_denied';
                   if (isAlert) color = 'text-amber-400';

                   return (
                     <tr key={ev.event_id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                       <td className="px-2 py-2 whitespace-nowrap text-zinc-500">{new Date(ev.timestamp).toLocaleString()}</td>
                       <td className="px-2 py-2 font-mono text-xs">{ev.token_id.substring(0, 12)}...</td>
                       <td className={`px-2 py-2 ${color} flex items-center gap-1`}>
                         {isAlert && <AlertTriangle className="w-3 h-3" />}
                         {ev.event_type}
                       </td>
                       <td className="px-2 py-2 text-zinc-400 truncate max-w-xs" title={ev.notes || ev.result || ''}>
                         {ev.notes || ev.result || '-'}
                       </td>
                     </tr>
                   );
                })}
              </tbody>
            </table>
            {events.length < eventsTotal && (
              <button onClick={loadMoreEvents} className="mt-4 px-4 py-2 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-sm mx-auto flex">Load More</button>
            )}
          </div>
        )}

        {activeTab === 'attribution' && (
          <div className="flex flex-col gap-2">
            <div className="mb-2 flex gap-2 items-center">
              <span className="text-sm text-zinc-500">Filter by Surface:</span>
              <select
                className="bg-zinc-800 text-sm p-1 border border-zinc-700 rounded text-zinc-200 outline-none"
                value={surfaceFilter}
                onChange={e => { setSurfaceFilter(e.target.value); setAttrPage(0); fetchAttribution(0, e.target.value); }}
              >
                <option value="">All Surfaces</option>
                <option value="kanban">Kanban</option>
                <option value="editor">Editor</option>
                <option value="chat">Chat</option>
                <option value="workflow">Workflow</option>
              </select>
            </div>
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase text-zinc-500 border-b border-zinc-800">
                <tr>
                  <th className="px-2 py-2">Timestamp</th>
                  <th className="px-2 py-2">Surface</th>
                  <th className="px-2 py-2">Actor</th>
                  <th className="px-2 py-2">Authority</th>
                  <th className="px-2 py-2">Action</th>
                  <th className="px-2 py-2">Target</th>
                </tr>
              </thead>
              <tbody>
                {attributions.map((attr, idx) => {
                  const isUser = attr.authority_level === 5;

                  // Two-row instruction/execution chains grouped visually with indent
                  // Execution (Agent, newer) is a child of Instruction (User, older)
                  let isChainChild = false;
                  if (idx < attributions.length - 1) {
                     const next = attributions[idx + 1];
                     if (next && next.authority_level === 5 && attr.authority_level < 5 && next.target === attr.target) {
                        const diff = new Date(attr.timestamp).getTime() - new Date(next.timestamp).getTime();
                        if (diff >= 0 && diff < 120000) { // executed within 2 minutes of instruction
                           isChainChild = true;
                        }
                     }
                  }

                  return (
                    <tr key={attr.attr_id} className={`border-b border-zinc-800/50 hover:bg-zinc-800/20 ${isChainChild ? 'bg-zinc-800/10 border-l-2 border-l-zinc-600' : ''}`}>
                      <td className="px-2 py-2 whitespace-nowrap text-zinc-500">
                        {isChainChild ? <span className="pl-4 text-zinc-600 flex items-center gap-1"><ChevronRight className="w-3 h-3"/> {new Date(attr.timestamp).toLocaleTimeString()}</span> : new Date(attr.timestamp).toLocaleString()}
                      </td>
                      <td className="px-2 py-2 text-zinc-400">{attr.surface}</td>
                      <td className="px-2 py-2 flex items-center gap-1 text-zinc-300">
                        {isUser ? <User className="w-3 h-3 text-blue-400"/> : <Bot className="w-3 h-3 text-purple-400"/>}
                        {attr.executing_actor}
                      </td>
                      <td className="px-2 py-2 text-zinc-500 text-center">{attr.authority_level}</td>
                      <td className="px-2 py-2 text-zinc-300">{attr.action_type}</td>
                      <td className="px-2 py-2 font-mono text-xs text-zinc-400">{attr.target || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {attributions.length < attrTotal && (
              <button onClick={loadMoreAttr} className="mt-4 px-4 py-2 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-sm mx-auto flex">Load More</button>
            )}
          </div>
        )}

        {activeTab === 'cost' && costSummary && (
          <div className="flex flex-col gap-6">
             {costSummary.by_role.length === 0 && costSummary.daily.length === 0 ? (
               <div className="text-zinc-500 italic text-center mt-10">No cost data yet.</div>
             ) : (
               <>
                 <div>
                   <h3 className="text-sm font-semibold text-zinc-300 mb-3 border-b border-zinc-800 pb-1">Total Cost by Role</h3>
                   <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                     {costSummary.by_role.map(r => (
                       <div key={r.role_name} className="bg-zinc-800/50 p-3 rounded border border-zinc-700/50">
                         <div className="text-xs text-zinc-500 uppercase tracking-wider">{r.role_name}</div>
                         <div className="text-xl font-medium text-copernicus-phosphor mt-1">${r.total_usd.toFixed(2)}</div>
                         <div className="text-xs text-zinc-400 mt-1">{r.token_count} tokens</div>
                       </div>
                     ))}
                   </div>
                 </div>

                 {costSummary.active_tokens.length > 0 && (
                   <div>
                     <h3 className="text-sm font-semibold text-zinc-300 mb-3 border-b border-zinc-800 pb-1">Active Tokens Burndown</h3>
                     <div className="flex flex-col gap-3">
                       {costSummary.active_tokens.map(t => {
                         const pct = t.max_cost_usd > 0 ? Math.min(100, (t.cost_usd / t.max_cost_usd) * 100) : 0;
                         return (
                           <div key={t.token_id} className="text-sm">
                             <div className="flex justify-between text-zinc-400 mb-1">
                               <span>{t.role_name} <span className="font-mono text-xs ml-2 text-zinc-500">({t.token_id.substring(0,8)})</span></span>
                               <span>${t.cost_usd.toFixed(2)} / ${t.max_cost_usd.toFixed(2)}</span>
                             </div>
                             <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                               <div className="bg-copernicus-phosphor h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                             </div>
                           </div>
                         );
                       })}
                     </div>
                   </div>
                 )}

                 {costSummary.daily.length > 0 && (
                   <div>
                     <h3 className="text-sm font-semibold text-zinc-300 mb-3 border-b border-zinc-800 pb-1">Daily Spend Summary</h3>
                     <table className="w-full text-sm text-left">
                       <thead className="text-xs uppercase text-zinc-500 border-b border-zinc-800">
                         <tr>
                           <th className="px-2 py-2">Date</th>
                           <th className="px-2 py-2 text-right">Total Spend</th>
                           <th className="px-2 py-2 text-center">Active Tokens</th>
                           <th className="px-2 py-2">Top Role</th>
                         </tr>
                       </thead>
                       <tbody>
                         {costSummary.daily.map(d => (
                           <tr key={d.date} className="border-b border-zinc-800/50">
                             <td className="px-2 py-2 text-zinc-300">{d.date}</td>
                             <td className="px-2 py-2 text-right font-medium text-red-400">${d.total_usd.toFixed(2)}</td>
                             <td className="px-2 py-2 text-center text-zinc-400">{d.token_count}</td>
                             <td className="px-2 py-2 text-zinc-400">{('top_role' in d) ? (d as any).top_role : '-'}</td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                 )}
               </>
             )}
          </div>
        )}
      </div>
    </div>
  );
}
