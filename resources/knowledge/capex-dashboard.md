# CapEx Dashboard

Every LLM call is logged with model, provider, token count, cost, and latency. The CapEx dashboard shows where your money goes and what it produces.

## Five Tabs

| Tab | What It Shows |
|-----|---------------|
| **Financial** | Total spend by provider, model, and time period |
| **Quality** | Token efficiency, completion rates, error rates |
| **LLM** | Per-model usage breakdown, average tokens per call |
| **Velocity** | Stories completed, time per story, agent throughput |
| **Heatmap** | Spending intensity by hour/day |

## Status Bar

The bottom status bar shows:
- **Live agent telemetry** — which model is active, what it's doing
- **Session timer** — how long the current session has been running
- **Total CapEx** — running cost for the session

## Data Source

All data comes from the `model_calls` SQLite table. You can query it directly:

```sql
SELECT model, provider, SUM(cost) as total
FROM model_calls
GROUP BY model, provider
ORDER BY total DESC;
```

## Cost Attribution

Each model call is attributed to the story that triggered it. When a story moves to Review, you see the total cost of implementation. The Financial tab breaks down cost per story.
