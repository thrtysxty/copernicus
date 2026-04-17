#!/usr/bin/env python3
"""
Infrastructure health check script for Copernicus.

Checks CCR (Claude Code Router), Ollama, and MLX availability.
Returns JSON with --json flag for automation.
Exit code 0 if all critical routes (CCR + Ollama) are alive.
Exit code 1 if any critical route is dead.
"""

import argparse
import http.client
import json
import socket
import sys
from typing import Dict, Any


def check_port(host: str, port: int, timeout: float = 1.5) -> Dict[str, Any]:
    """Check if a TCP port is reachable."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((host, port))
        sock.close()
        return {
            "alive": result == 0,
            "port": port,
            "error": None if result == 0 else f"Connection failed with code {result}"
        }
    except Exception as e:
        return {
            "alive": False,
            "port": port,
            "error": str(e)
        }


def check_http_endpoint(
    host: str,
    port: int,
    path: str = "/health",
    timeout: float = 1.5
) -> Dict[str, Any]:
    """Check an HTTP endpoint for liveness."""
    try:
        conn = http.client.HTTPConnection(host, port, timeout=timeout)
        conn.request("GET", path)
        response = conn.getresponse()
        conn.close()
        return {
            "alive": 200 <= response.status < 300,
            "port": port,
            "status": response.status
        }
    except Exception as e:
        return {
            "alive": False,
            "port": port,
            "error": str(e)
        }


def check_ccr() -> Dict[str, Any]:
    """Check if CCR is available on port 9669."""
    result = check_http_endpoint("127.0.0.1", 9669, "/health", timeout=1.5)
    return {
        "alive": result.get("alive", False),
        "port": 9669,
        "error": result.get("error")
    }


def check_ollama() -> Dict[str, Any]:
    """Check if Ollama is available on port 11434."""
    # Ollama has a /api/tags endpoint that lists models
    result = check_http_endpoint("localhost", 11434, "/api/tags", timeout=1.5)
    return {
        "alive": result.get("alive", False),
        "port": 11434,
        "error": result.get("error")
    }


def check_mlx() -> Dict[str, Any]:
    """Check if MLX is available on port 8080."""
    # MLX server typically has a /v1/models endpoint
    result = check_http_endpoint("localhost", 8080, "/v1/models", timeout=1.5)
    return {
        "alive": result.get("alive", False),
        "port": 8080,
        "error": result.get("error")
    }


def main():
    parser = argparse.ArgumentParser(
        description="Check Copernicus infrastructure health"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON"
    )
    args = parser.parse_args()

    # Check all services
    results = {
        "ccr": check_ccr(),
        "ollama": check_ollama(),
        "mlx": check_mlx()
    }

    if args.json:
        print(json.dumps(results, indent=2))
    else:
        print("Copernicus Infrastructure Health Check")
        print("=" * 40)
        for name, status in results.items():
            state = "✓ ALIVE" if status["alive"] else "✗ DEAD"
            print(f"{name.upper():8} {state:10} (port {status['port']})")
            if status.get("error"):
                print(f"         Error: {status['error']}")
        print("=" * 40)

    # Exit code 0 if CCR and Ollama are alive (critical routes)
    # MLX is optional for now
    critical_alive = results["ccr"]["alive"] and results["ollama"]["alive"]
    sys.exit(0 if critical_alive else 1)


if __name__ == "__main__":
    main()
