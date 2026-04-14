import { ipcMain } from 'electron';
import { handleIpc } from '../utils/handle-ipc';
// @ts-ignore
import { syncUserAction } from '../../../scripts/agent-daemon/lib/hub.mjs';
// @ts-ignore
import { getDb } from '../../../scripts/agent-daemon/lib/db.mjs';

export function registerHubHandlers() {
  ipcMain.handle('hub:user-sync', (_event, action) =>
    handleIpc('hub:user-sync', [action], () => {
      syncUserAction(action);
      return { ok: true };
    })
  );

  ipcMain.handle('hub:get-events', (_event, { limit, offset, event_types }: { limit: number; offset: number; event_types?: string[] }) =>
    handleIpc('hub:get-events', [{ limit, offset, event_types }], () => {
      const db = getDb();
      let query = 'SELECT * FROM hub_events';
      let countQuery = 'SELECT COUNT(*) as count FROM hub_events';
      const params: any[] = [];
      const countParams: any[] = [];

      if (event_types && event_types.length > 0) {
        const placeholders = event_types.map(() => '?').join(',');
        query += ` WHERE event_type IN (${placeholders})`;
        countQuery += ` WHERE event_type IN (${placeholders})`;
        params.push(...event_types);
        countParams.push(...event_types);
      }

      query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const events = db.prepare(query).all(...params);
      const { count } = db.prepare(countQuery).get(...countParams) as { count: number };

      return { events, total: count };
    })
  );

  ipcMain.handle('hub:get-attribution', (_event, { limit, offset, surface, story_id }: { limit: number; offset: number; surface?: string; story_id?: string }) =>
    handleIpc('hub:get-attribution', [{ limit, offset, surface, story_id }], () => {
      const db = getDb();
      let query = 'SELECT * FROM hub_attribution';
      let countQuery = 'SELECT COUNT(*) as count FROM hub_attribution';
      const params: any[] = [];
      const conditions: string[] = [];

      if (surface) {
        conditions.push('surface = ?');
        params.push(surface);
      }
      if (story_id) {
        conditions.push('target = ?');
        params.push(story_id);
      }

      if (conditions.length > 0) {
        const whereClause = ' WHERE ' + conditions.join(' AND ');
        query += whereClause;
        countQuery += whereClause;
      }

      query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
      const countParams = [...params];
      params.push(limit, offset);

      const rows = db.prepare(query).all(...params);
      const { count } = db.prepare(countQuery).get(...countParams) as { count: number };

      return { rows, total: count };
    })
  );

  ipcMain.handle('hub:get-cost-summary', () =>
    handleIpc('hub:get-cost-summary', [], () => {
      const db = getDb();

      const tokens = db.prepare('SELECT role_name, state, token_id, budget FROM hub_tokens').all() as Array<{
        role_name: string;
        state: string;
        token_id: string;
        budget: string;
      }>;

      const by_role_map: Record<string, { role_name: string; total_usd: number; token_count: number }> = {};
      const active_tokens: Array<{ token_id: string; role_name: string; cost_usd: number; max_cost_usd: number }> = [];

      for (const t of tokens) {
        let budgetObj = { current_cost_usd: 0, max_cost_usd: 0 };
        try {
          if (t.budget) budgetObj = JSON.parse(t.budget);
        } catch (e) {}

        const cost = budgetObj.current_cost_usd || 0;

        if (!by_role_map[t.role_name]) {
          by_role_map[t.role_name] = { role_name: t.role_name, total_usd: 0, token_count: 0 };
        }

        const entry = by_role_map[t.role_name];
        if (entry) {
            entry.total_usd += cost;
            entry.token_count += 1;
        }

        if (t.state === 'ACTIVE') {
          active_tokens.push({
            token_id: t.token_id,
            role_name: t.role_name,
            cost_usd: cost,
            max_cost_usd: budgetObj.max_cost_usd || 0
          });
        }
      }

      const by_role = Object.values(by_role_map);

      const allEvents = db.prepare('SELECT timestamp, action, token_id FROM hub_events').all() as Array<{ timestamp: string, action: string, token_id: string }>;
      const daily_map: Record<string, { date: string, total_usd: number, token_count: number, role_spend: Record<string, number> }> = {};

      const token_roles = tokens.reduce((acc, t) => {
        acc[t.token_id] = t.role_name;
        return acc;
      }, {} as Record<string, string>);

      for (const ev of allEvents) {
         try {
           const actionObj = JSON.parse(ev.action || '{}');
           if (actionObj.cost_usd) {
             const date = ev.timestamp.split('T')[0];
             if (!date) continue;
             if (!daily_map[date]) {
               daily_map[date] = { date, total_usd: 0, token_count: 0, role_spend: {} };
             }
             const role = token_roles[ev.token_id] || 'unknown';
             const dailyEntry = daily_map[date];
             if (dailyEntry) {
                 dailyEntry.total_usd += actionObj.cost_usd;
                 dailyEntry.role_spend[role] = (dailyEntry.role_spend[role] || 0) + actionObj.cost_usd;
             }
           }
         } catch(e) {}
      }

      const daily = Object.values(daily_map).map(d => {
         const top_role = Object.entries(d.role_spend).sort((a,b) => b[1] - a[1])[0]?.[0] || 'unknown';
         return {
           date: d.date,
           total_usd: d.total_usd,
           top_role: top_role,
           token_count: 0
         };
      }).sort((a,b) => b.date.localeCompare(a.date));

      for (const d of Object.values(daily_map)) {
         const date = d.date;
         const dailyEvents = allEvents.filter(ev => ev.timestamp.startsWith(date));
         const uniqueTokens = new Set(dailyEvents.filter(ev => {
            try { return JSON.parse(ev.action||'{}').cost_usd > 0 } catch(e){return false}
         }).map(ev => ev.token_id));
         const dayEntry = daily.find(x => x.date === date);
         if (dayEntry) dayEntry.token_count = uniqueTokens.size;
      }

      return { by_role, active_tokens, daily };
    })
  );
}
