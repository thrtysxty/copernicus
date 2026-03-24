# -*- mode: python ; coding: utf-8 -*-
# Single-file (--onefile equivalent) build for copernicus backend.
# Run from repo root: pyinstaller backend/copernicus_backend.spec --distpath backend/dist/

import os
import sys
import shutil

# Find the notebooklm entry point script
notebooklm_script = shutil.which('notebooklm')
if not notebooklm_script:
    # Fallback to looking in the same directory as python executable
    notebooklm_script = os.path.join(os.path.dirname(sys.executable), 'notebooklm')

if not os.path.exists(notebooklm_script) and sys.platform == 'win32':
    notebooklm_script += '.exe'

scripts_to_analyze = ['app.py']
if notebooklm_script and os.path.exists(notebooklm_script):
    scripts_to_analyze.append(notebooklm_script)

a = Analysis(
    scripts_to_analyze,
    pathex=['.'],
    binaries=[],
    datas=[],
    hiddenimports=[
        'flask',
        'flask_cors',
        'flask_socketio',
        'python_socketio',
        'anthropic',
        'openai',
        'ollama',
        'google.generativeai',
        'notebooklm',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    name='copernicus-backend',
    debug=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
