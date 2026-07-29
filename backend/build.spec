# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path

block_cipher = None
backend_dir = Path(SPECPATH)

# The lightweight backend only ships its Python API and configuration. Large AI
# runtimes remain optional and are intentionally not bundled in this release.
a = Analysis(
    [str(backend_dir / "run.py")],
    pathex=[str(backend_dir)],
    binaries=[],
    datas=[
        (str(backend_dir / "api"), "api"),
        (str(backend_dir / "core"), "core"),
        (str(backend_dir / "models"), "models"),
    ],
    hiddenimports=[
        "api.capabilities",
        "api.health",
        "core.config",
        "core.model_manager",
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "torch", "tensorflow", "transformers", "modelscope",
        "librosa", "opencv-python", "funasr", "kantts",
        "matplotlib", "pillow",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(backend_dir.parent / "public" / "app-icon.ico"),
)
