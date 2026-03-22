# -*- mode: python ; coding: utf-8 -*-
# Single-file (--onefile equivalent) build for copernicus backend.
# Run from repo root: pyinstaller backend/copernicus_backend.spec --distpath backend/dist/

a = Analysis(
    ['app.py'],
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
