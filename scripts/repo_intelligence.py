#!/usr/bin/env python3
"""
repo_intelligence.py — Low-token multi-file code awareness for Claude.

Commands:
  outline  <file>                 Exports/signatures only — no bodies
  imports  <file> [--depth N]     Import chain up to depth N (default 2)
  usages   <symbol> [--ext LIST]  All references (default ext: ts,tsx,py)
  changed  [--base REF]           Files changed vs base ref (default: HEAD)

Examples:
  python3 scripts/repo_intelligence.py outline copernicus/electron/ipc/git-handlers.ts
  python3 scripts/repo_intelligence.py imports copernicus/src/renderer/App.tsx --depth 2
  python3 scripts/repo_intelligence.py usages handleIpc
  python3 scripts/repo_intelligence.py changed --base main
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
IGNORE = {'node_modules', 'dist', 'dist-electron', 'release', '.git', '__pycache__'}

# ─── Outline ──────────────────────────────────────────────────────────────────

PY_CLASS_RE = re.compile(r'^class\s+(\w+)(?:\(([^)]*)\))?:', re.MULTILINE)
PY_DEF_RE   = re.compile(r'^(async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:', re.MULTILINE)


def outline_ts(path: Path) -> list[str]:
    src = path.read_text(encoding='utf-8', errors='ignore')
    results = []
    for i, line in enumerate(src.splitlines(), 1):
        stripped = line.strip()
        if not stripped.startswith('export'):
            continue
        if re.match(r'^export\s+\*', stripped):   # skip re-export *
            continue
        # Strip body: everything after opening brace or arrow or = assignment
        decl = re.sub(r'\s*\{.*$', '', stripped)
        decl = re.sub(r'\s*=\s*(?:function|class|\(|=>).*$', '', decl)
        decl = decl.strip().rstrip(',;')
        if decl:
            results.append(f"  L{i:<5} {decl}")
    return results


def outline_py(path: Path) -> list[str]:
    src = path.read_text(encoding='utf-8', errors='ignore')
    results = []
    for m in PY_CLASS_RE.finditer(src):
        lineno = src[:m.start()].count('\n') + 1
        bases = f'({m.group(2)})' if m.group(2) else ''
        results.append((lineno, f"class {m.group(1)}{bases}"))
    for m in PY_DEF_RE.finditer(src):
        lineno = src[:m.start()].count('\n') + 1
        ret = f' -> {m.group(4).strip()}' if m.group(4) else ''
        prefix = 'async ' if m.group(1) else ''
        results.append((lineno, f"{prefix}def {m.group(2)}(...){ret}"))
    results.sort(key=lambda x: x[0])
    return [f"  L{ln:<5} {decl}" for ln, decl in results]


def cmd_outline(args):
    p = Path(args.file)
    if not p.is_absolute():
        p = REPO_ROOT / p
    if not p.exists():
        print(f"error: {p} not found", file=sys.stderr); sys.exit(1)

    ext = p.suffix.lower()
    try:
        rel = p.relative_to(REPO_ROOT)
    except ValueError:
        rel = p
    print(f"outline: {rel}\n{'─' * 60}")

    if ext in ('.ts', '.tsx', '.js', '.jsx'):
        lines = outline_ts(p)
    elif ext == '.py':
        lines = outline_py(p)
    else:
        print(f"  (unsupported extension: {ext})"); return

    print('\n'.join(lines) if lines else "  (no exports found)")


# ─── Import Chain ─────────────────────────────────────────────────────────────

TS_IMPORT_RE = re.compile(r'''(?m)^\s*import\s+[^'"]*from\s+['"]([^'"]+)['"]''')


def resolve_ts_import(imp: str, source_dir: Path) -> Path | None:
    if not imp.startswith('.'):
        return None
    for ext in ('', '.ts', '.tsx', '.js', '/index.ts', '/index.tsx'):
        candidate = (source_dir / (imp + ext)).resolve()
        if candidate.exists():
            return candidate
    return None


def cmd_imports(args):
    root = Path(args.file)
    if not root.is_absolute():
        root = REPO_ROOT / root
    if not root.exists():
        print(f"error: {root} not found", file=sys.stderr); sys.exit(1)

    depth = args.depth
    try:
        rel = root.relative_to(REPO_ROOT)
    except ValueError:
        rel = root
    print(f"imports: {rel} (depth={depth})\n{'─' * 60}")

    seen: set[str] = set()

    def walk(path: Path, level: int):
        if level > depth or str(path) in seen:
            return
        seen.add(str(path))
        src = path.read_text(encoding='utf-8', errors='ignore')
        for m in TS_IMPORT_RE.finditer(src):
            imp = m.group(1)
            resolved = resolve_ts_import(imp, path.parent)
            prefix = '  ' * level
            if resolved:
                try:
                    tag = f' → {resolved.relative_to(REPO_ROOT)}'
                except ValueError:
                    tag = f' → {resolved}'
            else:
                tag = '  (external)'
            print(f"{prefix}{imp}{tag}")
            if resolved and level < depth:
                walk(resolved, level + 1)

    walk(root, 0)


# ─── Usages ───────────────────────────────────────────────────────────────────

def cmd_usages(args):
    symbol = args.symbol
    exts = tuple('.' + e.strip() for e in args.ext.split(','))
    pattern = re.compile(r'\b' + re.escape(symbol) + r'\b')

    print(f"usages: {symbol}\n{'─' * 60}")
    hits = 0
    for path in REPO_ROOT.rglob('*'):
        if path.is_dir():
            continue
        if not path.suffix.lower() in exts:
            continue
        if any(part in IGNORE for part in path.parts):
            continue
        try:
            for i, line in enumerate(path.read_text(encoding='utf-8', errors='ignore').splitlines(), 1):
                if pattern.search(line):
                    try:
                        rel = path.relative_to(REPO_ROOT)
                    except ValueError:
                        rel = path
                    print(f"  {rel}:{i}  {line.strip()}")
                    hits += 1
                    if hits >= 60:
                        print("  ... (truncated at 60 results)")
                        return
        except (OSError, PermissionError):
            continue
    if hits == 0:
        print("  (no usages found)")


# ─── Changed ──────────────────────────────────────────────────────────────────

def cmd_changed(args):
    base = args.base or 'HEAD'

    def run_diff(extra: list[str]) -> str:
        r = subprocess.run(
            ['git', '-C', str(REPO_ROOT), 'diff', '--stat', base] + extra,
            capture_output=True, text=True
        )
        return r.stdout.strip() if r.returncode == 0 else ''

    output = run_diff([]) or run_diff(['--cached'])
    print(f"changed vs {base}:\n{'─' * 60}")
    print(output if output else "  (no changes)")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description='Repo code intelligence — low token cost',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    sub = parser.add_subparsers(dest='command', required=True)

    p_out = sub.add_parser('outline', help='Exports/signatures (no bodies)')
    p_out.add_argument('file', help='Path to file (absolute or relative to repo root)')

    p_imp = sub.add_parser('imports', help='Import chain')
    p_imp.add_argument('file', help='Entry point file')
    p_imp.add_argument('--depth', type=int, default=2, help='Traversal depth (default 2)')

    p_use = sub.add_parser('usages', help='All references to a symbol')
    p_use.add_argument('symbol')
    p_use.add_argument('--ext', default='ts,tsx,py', help='Comma-separated file extensions')

    p_chg = sub.add_parser('changed', help='Files changed vs base ref')
    p_chg.add_argument('--base', default='HEAD', help='Base git ref (default: HEAD)')

    args = parser.parse_args()
    {
        'outline': cmd_outline,
        'imports': cmd_imports,
        'usages': cmd_usages,
        'changed': cmd_changed,
    }[args.command](args)


if __name__ == '__main__':
    main()
