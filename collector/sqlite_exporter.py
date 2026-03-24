import os
import sqlite3
import json
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
import sys
from urllib.parse import urlparse
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("sqlite_exporter")

# Get database path from environment
DB_PATH = os.environ.get("COPERNICUS_DB_PATH")

if not DB_PATH:
    logger.error("COPERNICUS_DB_PATH environment variable is not set")
    sys.exit(1)

def parse_otlp_attributes(attributes):
    data = {}
    for attr in attributes:
        key = attr.get("key")
        value_dict = attr.get("value", {})

        # OTLP values can be stringValue, intValue, doubleValue, boolValue, etc.
        if "stringValue" in value_dict:
            data[key] = value_dict["stringValue"]
        elif "intValue" in value_dict:
            data[key] = int(value_dict["intValue"])
        elif "doubleValue" in value_dict:
            data[key] = float(value_dict["doubleValue"])
        elif "boolValue" in value_dict:
            data[key] = bool(value_dict["boolValue"])
    return data

def write_to_db(signal_type, data):
    try:
        conn = sqlite3.connect(DB_PATH, timeout=10)
        cursor = conn.cursor()

        # Determine table based on signal_type
        if signal_type == "api_request":
            session_id = data.get("session_id", "unknown")
            model_id = data.get("model_id", "unknown")
            provider = data.get("provider", "unknown")
            tokens_in = data.get("tokens_in", 0)
            tokens_out = data.get("tokens_out", 0)
            cost_usd = data.get("cost_usd", 0.0)
            latency_ms = data.get("latency_ms")

            # The schema mentions caching fields: reasoning, prompt_text, response_text, context_json
            # AC: "extracts cost, tokens, and cache fields"
            reasoning = data.get("reasoning", None)
            prompt_text = data.get("prompt_text", None)
            response_text = data.get("response_text", None)
            context_json = data.get("context_json", None)
            prompt_id = data.get("prompt.id", None)

            cursor.execute("""
                INSERT INTO model_calls (session_id, model_id, provider, tokens_in, tokens_out, cost_usd, latency_ms, reasoning, prompt_text, response_text, context_json, prompt_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (session_id, model_id, provider, tokens_in, tokens_out, cost_usd, latency_ms, reasoning, prompt_text, response_text, context_json, prompt_id))

        elif signal_type == "code_edit_tool.decision":
            prompt_id = data.get("prompt.id")
            decision = data.get("decision")
            file_path = data.get("file_path")
            timestamp = data.get("timestamp") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

            if decision not in ["accept", "reject", "abort"]:
                logger.warning(f"Invalid or missing decision value: '{decision}'. Skipping row.")
            else:
                cursor.execute("""
                    INSERT INTO edit_decisions (prompt_id, decision, file_path, timestamp)
                    VALUES (?, ?, ?, ?)
                """, (prompt_id, decision, file_path, timestamp))

        elif signal_type in ["active_time", "tool_result"]:
            # Insert into events table
            content = json.dumps(data)
            cursor.execute("""
                INSERT INTO events (type, content, agent_id)
                VALUES (?, ?, ?)
            """, (signal_type, content, data.get("agent_id", "collector")))

            if signal_type == "tool_result" and "git_commit_id" in data:
                commit_sha = data.get("git_commit_id")
                session_id = data.get("session_id")
                if commit_sha and session_id:
                    cursor.execute("""
                        UPDATE model_calls
                        SET commit_sha = ?
                        WHERE session_id = ? AND commit_sha IS NULL
                    """, (commit_sha, session_id))

        else:
            logger.warning(f"Unknown signal type: {signal_type}")

        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Database error: {e}")

class OTLPHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 0:
            post_data = self.rfile.read(content_length)
            try:
                payload = json.loads(post_data.decode('utf-8'))

                # Check for simplified testing format first
                if "signal_type" in payload and "data" in payload:
                    write_to_db(payload["signal_type"], payload["data"])

                # OTLP metrics format fallback
                elif "resourceMetrics" in payload:
                    for rm in payload["resourceMetrics"]:
                        for sm in rm.get("scopeMetrics", []):
                            for metric in sm.get("metrics", []):
                                name = metric.get("name")
                                data = {}

                                # Extract data points
                                data_points = []
                                if "sum" in metric:
                                    data_points = metric["sum"].get("dataPoints", [])
                                elif "gauge" in metric:
                                    data_points = metric["gauge"].get("dataPoints", [])

                                for dp in data_points:
                                    attrs = dp.get("attributes", [])
                                    data.update(parse_otlp_attributes(attrs))

                                    # Sometimes value is directly in the data point
                                    if "asInt" in dp:
                                        data["value"] = int(dp["asInt"])
                                    elif "asDouble" in dp:
                                        data["value"] = float(dp["asDouble"])

                                write_to_db(name, data)
                else:
                    logger.warning("Unknown payload structure, ignoring.")

                self.send_response(200)
                self.end_headers()
                self.wfile.write(b"OK")
            except json.JSONDecodeError:
                logger.error("Invalid JSON payload")
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"Invalid JSON")
            except Exception as e:
                logger.error(f"Error processing request: {e}")
                self.send_response(500)
                self.end_headers()
                self.wfile.write(b"Internal Server Error")
        else:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(b"Empty payload")

    def log_message(self, format, *args):
        # Suppress default HTTP server logging
        pass

def run_server(port=4318):
    server_address = ('localhost', port)
    httpd = HTTPServer(server_address, OTLPHandler)
    logger.info(f"Starting OTLP SQLite Exporter on port {port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("Server shutting down...")
    finally:
        httpd.server_close()
        logger.info("Server stopped")

if __name__ == '__main__':
    run_server()
