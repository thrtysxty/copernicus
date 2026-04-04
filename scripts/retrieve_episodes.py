import argparse
import json
import os
import sqlite3
import struct
from pathlib import Path

def get_db_path() -> Path:
    return Path.home() / 'Library' / 'Application Support' / 'copernicus' / 'jules.db'

def openrouter_api_key() -> str:
    key = os.environ.get("OPENROUTER_API_KEY", "")
    if not key:
        import subprocess
        result = subprocess.run(
            ["bash", "-c", "source ~/.secrets 2>/dev/null && echo $OPENROUTER_API_KEY"],
            capture_output=True, text=True
        )
        key = result.stdout.strip()
    if not key:
        raise RuntimeError("OPENROUTER_API_KEY not set — add it to ~/.secrets")
    return key

def get_embedding(text: str) -> list[float]:
    import openai

    client = openai.OpenAI(
        api_key=openrouter_api_key(),
        base_url="https://openrouter.ai/api/v1"
    )
    resp = client.embeddings.create(model="text-embedding-3-small", input=text)
    return resp.data[0].embedding

def retrieve_episodes(query: str, limit: int = 3) -> list[dict]:
    db_path = get_db_path()
    if not db_path.exists():
        return []

    try:
        embedding = get_embedding(query)
    except Exception as e:
        # Fall back gracefully if embedding fails
        print(f"Error fetching embedding: {e}")
        return []

    # Pack float list into a binary blob for sqlite-vec
    embedding_blob = struct.pack(f"<{len(embedding)}f", *embedding)

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    try:
        conn.enable_load_extension(True)
        import sqlite_vec
        sqlite_vec.load(conn)
    except AttributeError:
        try:
            import sqlite_vec
            sqlite_vec.load(conn)
        except Exception as e:
             # Just fallback to attempting vector query without load
             pass
    except Exception:
        pass

    try:
        rows = conn.execute("""
            SELECT e.story_id, e.outcome, e.quality_score, e.blocked_reasons, e.files_touched
            FROM episodes_vec v
            JOIN episodes e ON e.embedding_id = v.rowid
            WHERE v.embedding MATCH ? AND k = ?
            ORDER BY distance
        """, (embedding_blob, limit)).fetchall()
    except sqlite3.OperationalError as e:
        # If the table doesn't exist or vec isn't loaded correctly, return empty list.
        # This will gracefully degrade to empty episodes list for the LLM.
        return []

    results = []
    for row in rows:
        results.append({
            "story_id": row["story_id"],
            "outcome": row["outcome"],
            "quality_score": row["quality_score"],
            "blocked_reasons": json.loads(row["blocked_reasons"]),
            "files_touched": json.loads(row["files_touched"])
        })

    return results

def main():
    parser = argparse.ArgumentParser(description="Retrieve relevant past episodes for a story")
    parser.add_argument("query", type=str, help="The story description or task to search for")
    parser.add_argument("--limit", type=int, default=3, help="Number of episodes to return")
    args = parser.parse_args()

    episodes = retrieve_episodes(args.query, args.limit)
    print(json.dumps(episodes, indent=2))

if __name__ == "__main__":
    main()
