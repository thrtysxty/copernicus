from flask import request as flask_request
from flask_limiter import Limiter

def _rate_limit_key() -> str:
    return flask_request.headers.get("X-Session-Id") or flask_request.remote_addr or "127.0.0.1"

limiter = Limiter(key_func=_rate_limit_key, default_limits=["200 per minute"])
