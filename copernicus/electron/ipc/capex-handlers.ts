import { ipcMain } from 'electron'
import { stateLedger } from '../db/state-ledger'
import { handleIpc } from '../utils/handle-ipc'

export function registerCapexHandlers() {
  ipcMain.handle('ledger:leaderboard', (_e, days: number | 'all') => handleIpc('ledger:leaderboard', [days], () => {
    const rows = stateLedger.getCapexLeaderboard(days);

    // Calculate composite score
    // completion rate (40%), cost efficiency (30%), latency (20%), approval rate (10%)
    
    let maxCostEfficiency = 0;
    let minLatency = Infinity;
    let maxLatency = 0;
    
    const enriched = rows.map(r => {
      // 1. Completion Rate
      const completionRate = r.total_calls > 0 ? r.successful_calls / r.total_calls : 0;
      
      // 2. Cost Efficiency: tokens out per USD
      const costEfficiency = r.total_cost > 0 ? r.total_tokens_out / r.total_cost : 0;
      if (costEfficiency > maxCostEfficiency) maxCostEfficiency = costEfficiency;
      
      // 3. Latency
      if (r.avg_latency > 0) {
        if (r.avg_latency < minLatency) minLatency = r.avg_latency;
        if (r.avg_latency > maxLatency) maxLatency = r.avg_latency;
      }

      // 4. Approval Rate
      const approvalRate = completionRate; // Inference since not explicitly in model_calls

      return {
        ...r,
        completionRate,
        costEfficiency,
        approvalRate
      };
    });

    return enriched.map(r => {
      const normCompletion = r.completionRate * 100;
      const normApproval = r.approvalRate * 100;
      const normCostEff = maxCostEfficiency > 0 ? (r.costEfficiency / maxCostEfficiency) * 100 : 0;
      
      // Inverse latency normalization (lower is better)
      let normLatency = 100;
      if (maxLatency > minLatency && r.avg_latency > 0) {
        normLatency = 100 - ((r.avg_latency - minLatency) / (maxLatency - minLatency)) * 100;
      }

      const composite_score = (
        (normCompletion * 0.40) +
        (normCostEff * 0.30) +
        (normLatency * 0.20) +
        (normApproval * 0.10)
      );

      return {
        provider: r.provider,
        model_id: r.model_id,
        composite_score: Math.round(composite_score),
        total_calls: r.total_calls,
        avg_latency: Math.round(r.avg_latency || 0),
        total_cost: Number((r.total_cost || 0).toFixed(4)),
        approval_rate: Math.round(normApproval)
      };
    }).sort((a, b) => b.composite_score - a.composite_score);
  }))
}
