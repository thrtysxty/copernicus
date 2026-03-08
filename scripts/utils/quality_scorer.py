import logging
import sqlite3
from pathlib import Path

# Path to the Copernicus DB
DB_PATH = (Path(__file__).resolve().parent.parent.parent / "copernicus" / "copernicus.db").resolve()

def get_db_connection():
    """Establish a connection to the Copernicus SQLite database."""
    # Ensure directory exists just in case
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    return sqlite3.connect(str(DB_PATH))

def init_table():
    """Initialise the model_performance table if it doesn't exist."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS model_performance (
              id                  INTEGER PRIMARY KEY AUTOINCREMENT,
              model_id            TEXT NOT NULL,
              provider            TEXT NOT NULL,
              task_type           TEXT NOT NULL,
              timestamp           DATETIME DEFAULT CURRENT_TIMESTAMP,
              duration_ms         INTEGER NOT NULL,
              tokens_used         INTEGER NOT NULL,
              tokens_per_sec      REAL NOT NULL,
              cost_usd            REAL NOT NULL,
              speed_score         REAL NOT NULL,
              cost_score          REAL NOT NULL,
              accuracy_score      REAL NOT NULL,
              adherence_score     REAL NOT NULL,
              composite_qs        REAL NOT NULL,
              verification_passed INTEGER NOT NULL DEFAULT 1,
              worktree_branch     TEXT
            );
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_model_performance_model
              ON model_performance(model_id, timestamp DESC);
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_model_performance_task
              ON model_performance(task_type, timestamp DESC);
        """)
        conn.commit()
    except Exception as e:
        print(f"Error initialising model_performance table: {e}")
    finally:
        conn.close()

def log_task(metrics: dict):
    """
    Calculate the composite QS and write to the database.
    Formula: QS = (0.2 * S_speed) + (0.2 * S_cost) + (0.4 * S_accuracy) + (0.2 * S_adherence)
    """
    init_table()

    speed_score = float(metrics.get("speed_score", 0))
    cost_score = float(metrics.get("cost_score", 0))
    accuracy_score = float(metrics.get("accuracy_score", 0))
    adherence_score = float(metrics.get("adherence_score", 0))

    composite_qs = (0.2 * speed_score) + (0.2 * cost_score) + (0.4 * accuracy_score) + (0.2 * adherence_score)

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO model_performance (
                model_id, provider, task_type, duration_ms, tokens_used,
                tokens_per_sec, cost_usd, speed_score, cost_score,
                accuracy_score, adherence_score, composite_qs,
                verification_passed, worktree_branch
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            metrics.get("model_id", "unknown"),
            metrics.get("provider", "unknown"),
            metrics.get("task_type", "unknown"),
            int(metrics.get("duration_ms", 0)),
            int(metrics.get("tokens_used", 0)),
            float(metrics.get("tokens_per_sec", 0)),
            float(metrics.get("cost_usd", 0)),
            speed_score,
            cost_score,
            accuracy_score,
            adherence_score,
            composite_qs,
            int(metrics.get("verification_passed", 1)),
            metrics.get("worktree_branch")
        ))
        conn.commit()
        return composite_qs
    except Exception as e:
        print(f"Error logging task metrics: {e}")
        return None
    finally:
        conn.close()

def get_best_model(role: str, limit: int = 10):
    """
    Returns the highest-weighted model for a role using a simple moving average
    of recent tasks (up to `limit`).
    """
    init_table()

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        # Calculate the moving average of composite_qs for each model for the given task_type (role)
        # using the most recent 'limit' entries per model.
        query = """
            WITH RecentTasks AS (
                SELECT model_id, composite_qs,
                       ROW_NUMBER() OVER(PARTITION BY model_id ORDER BY timestamp DESC) as rn
                FROM model_performance
                WHERE task_type = ?
            )
            SELECT model_id, AVG(composite_qs) as avg_qs
            FROM RecentTasks
            WHERE rn <= ?
            GROUP BY model_id
            ORDER BY avg_qs DESC
            LIMIT 1
        """
        cursor.execute(query, (role, limit))
        row = cursor.fetchone()

        if row:
            return row[0]
        return None
    except Exception as e:
        print(f"Error getting best model for role {role}: {e}")
        return None
    finally:
        conn.close()
