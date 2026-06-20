import type { Database } from 'libsql';

export function getDailyCosts(db: Database, days: number): any[] {
  return db.prepare(`
    SELECT date(created_at) as day,
           SUM(cost_usd) as total_cost,
           SUM(tokens_in + tokens_out) as total_tokens
    FROM model_calls
    WHERE created_at >= date('now', '-' || ? || ' days')
    GROUP BY date(created_at) ORDER BY day ASC
  `).all(days);
}

export function getCostByModel(db: Database): any[] {
  return db.prepare(`
    SELECT model_id, provider,
           SUM(cost_usd) as total_cost,
           COUNT(*) as call_count,
           SUM(tokens_in) as tokens_in,
           SUM(tokens_out) as tokens_out
    FROM model_calls GROUP BY model_id, provider ORDER BY total_cost DESC
  `).all();
}

export function getCostByStory(db: Database): any[] {
  return db.prepare(`
    SELECT panel_id as story_id,
           SUM(cost_usd) as total_cost,
           COUNT(*) as call_count,
           SUM(tokens_in + tokens_out) as total_tokens
    FROM model_calls
    WHERE panel_id IS NOT NULL AND panel_id != 'chat'
    GROUP BY panel_id ORDER BY total_cost DESC LIMIT 50
  `).all();
}

export function getWeeklyVelocity(db: Database, weeks: number): any[] {
  return db.prepare(`
    SELECT strftime('%Y-W%W', start_time) as week,
           SUM(duration_hours) as hours,
           COUNT(DISTINCT story_id) as stories
    FROM dev_sessions
    WHERE start_time >= date('now', '-' || (? * 7) || ' days')
    GROUP BY week ORDER BY week ASC
  `).all(weeks);
}

export function getCostHeatmapData(db: Database): { churnMap: Record<string, number>, costMap: Record<string, number> } {
  const churn = db.prepare('SELECT changed_files FROM review_sessions').all() as { changed_files: string }[];
  const churnMap: Record<string, number> = {};
  for (const s of churn) {
    try {
      const files = JSON.parse(s.changed_files) as string[];
      if (Array.isArray(files)) files.forEach(f => churnMap[f] = (churnMap[f] || 0) + 1);
    } catch (err) { console.warn('Non-critical: failed to parse changed_files for churn', err); }
  }

  const costs = db.prepare(`
    SELECT mc.cost_usd, rs.changed_files
    FROM model_calls mc
    JOIN review_sessions rs ON mc.session_id = rs.session_id
  `).all() as { cost_usd: number; changed_files: string }[];

  const costMap: Record<string, number> = {};
  for (const c of costs) {
    try {
      const files = JSON.parse(c.changed_files) as string[];
      if (Array.isArray(files)) {
        const splitCost = c.cost_usd / files.length;
        files.forEach(f => costMap[f] = (costMap[f] || 0) + splitCost);
      }
    } catch (err) { console.warn('Non-critical: failed to parse changed_files for cost heatmap', err); }
  }

  return { churnMap, costMap };
}

export function getCapexLeaderboard(db: Database, days: number | 'all'): any[] {
  let query = `
    SELECT
      provider,
      model_id,
      COUNT(*) as total_calls,
      SUM(cost_usd) as total_cost,
      AVG(latency_ms) as avg_latency,
      SUM(tokens_out) as total_tokens_out,
      SUM(CASE WHEN tokens_out > 0 THEN 1 ELSE 0 END) as successful_calls
    FROM model_calls
  `;
  const params: unknown[] = [];
  if (days !== 'all') {
    query += ` WHERE created_at >= date('now', '-' || ? || ' days')`;
    params.push(days);
  }
  query += ` GROUP BY provider, model_id`;
  return db.prepare(query).all(...params);
}
