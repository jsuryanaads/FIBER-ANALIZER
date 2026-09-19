# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path
ROOT = Path(SPEC).resolve().parent
a = Analysis(
    [str(ROOT / "generator" / "generator_app.py")],
    pathex=[str(ROOT)],
    binaries=[],
    datas=[(str(ROOT / "generator"), "generator"), (str(ROOT / "template"), "template")],
    hiddenimports=["tkinter"], hookspath=[], hooksconfig={}, runtime_hooks=[], excludes=[], noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, a.binaries, a.datas, [], name="WebVIEW-Generator", debug=False,
          bootloader_ignore_signals=False, strip=False, upx=True, console=False)
