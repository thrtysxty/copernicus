import os
import platform
from pathlib import Path
from dotenv import load_dotenv

bind = f"127.0.0.1:{os.environ.get('COPERNICUS_BACKEND_PORT', '5001')}"
workers = 2
timeout = 120
accesslog = "-"
errorlog = "-"

# Load secrets and app config at startup
secrets_path = Path.home() / ".secrets"
if secrets_path.exists():
    load_dotenv(secrets_path)

if platform.system() == "Darwin":
    config_path = Path.home() / "Library" / "Application Support" / "copernicus" / "config.env"
else:
    config_path = Path.home() / ".config" / "copernicus" / "config.env"
if config_path.exists():
    load_dotenv(config_path)
