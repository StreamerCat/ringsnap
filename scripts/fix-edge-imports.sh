#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FUNCTIONS_DIR="$ROOT_DIR/supabase/functions"

if [[ ! -d "$FUNCTIONS_DIR" ]]; then
  echo "supabase/functions directory not found: $FUNCTIONS_DIR" >&2
  exit 1
fi

export ROOT_DIR

python3 - <<'PY'
from pathlib import Path
import re

import os
root = Path(os.environ["ROOT_DIR"])
functions_dir = root / "supabase" / "functions"

patterns = [
    re.compile(r'(["\'])https://esm\.sh/@supabase/supabase-js[^"\']*\1'),
    re.compile(r'(["\'])npm:@supabase/supabase-js[^"\']*\1'),
    re.compile(r'(["\'])@supabase/supabase-js[^"\']*\1'),
]

for file_path in functions_dir.rglob("*"):
    if not file_path.is_file():
        continue
    if file_path.suffix not in {".ts", ".tsx", ".js", ".jsx", ".mjs", ".mts", ".cts"}:
        continue

    original = file_path.read_text()
    updated = original
    for pattern in patterns:
        updated = pattern.sub(lambda m: f'{m.group(1)}supabase{m.group(1)}', updated)

    if updated != original:
        file_path.write_text(updated)
        print(f"updated import specifiers: {file_path.relative_to(root)}")

for function_dir in sorted(functions_dir.iterdir()):
    if not function_dir.is_dir():
        continue
    if function_dir.name == "_shared":
        continue
    if not (function_dir / "index.ts").exists():
        continue

    deno_json = function_dir / "deno.json"
    deno_contents = '{\n  "imports": {\n    "supabase": "npm:@supabase/supabase-js@2"\n  }\n}\n'

    if deno_json.exists():
        existing = deno_json.read_text()
        if existing != deno_contents:
            deno_json.write_text(deno_contents)
            print(f"wrote deno.json: {deno_json.relative_to(root)}")
    else:
        deno_json.write_text(deno_contents)
        print(f"created deno.json: {deno_json.relative_to(root)}")
PY
