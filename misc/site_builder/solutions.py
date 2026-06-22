# This file is part of QOBLIB - Quantum Optimization Benchmarking Library
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""Reference-solution / best-known-value (BKV) readers.

Maps the repository's ``solutions/`` folders to ``{instance: {value, status,
source_file}}``. Handles per-instance ``.sol`` files (with the objective stored
inline or in a comment), aggregate ``record.csv`` / ``solutions.json`` files,
and the Birkhoff ``qbench_*.json`` solution bundles.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from . import config


STATUS_PRIORITY = {
    "open": 0,
    "best_known": 1,
    "solved": 2,
    "optimal": 3,
}


def read_bkv_from_sol_file(path: Path) -> float | None:
    """
    Read the objective value from a .sol file. Many solution files store the
    solution *vector* (one spin/bit per line) with the objective in a comment,
    e.g. LABS uses ``# Energy: 898`` and network uses ``# Objective value = ...``.
    We therefore look for a labelled objective FIRST (including in comments) and
    only fall back to a bare number when the file is literally a single value —
    never the first element of a solution vector.
    """
    try:
        text = path.read_text(encoding="utf-8", errors="replace").strip()
        if not text:
            return None

        # Try JSON
        if text.startswith("{"):
            try:
                d = json.loads(text)
                for key in ("value", "objective", "obj", "best", "bkv", "energy"):
                    if key in d:
                        return float(d[key])
            except json.JSONDecodeError:
                pass

        # Try a labelled objective anywhere in the file (incl. comment lines).
        # Separator may be ':' / '=' or just whitespace (e.g. routing's "Cost 583").
        label_re = re.compile(
            r"\b(?:energy|objective(?:\s+value)?|value|obj|bkv|cost|merit)\b\s*[=:]?\s*([-+]?\d+(?:\.\d+)?)",
            re.IGNORECASE,
        )
        for line in text.splitlines():
            m = label_re.search(line)
            if m:
                return float(m.group(1))

        # Fall back to a bare number ONLY when the first data line is a lone value
        # (otherwise it is a solution vector and the first token is not the objective).
        for line in text.splitlines():
            s = line.strip()
            if not s or s.startswith("#"):
                continue
            parts = s.split()
            if len(parts) == 1:
                try:
                    return float(parts[0])
                except ValueError:
                    return None
            return None  # first data line is a vector → no inline objective
    except Exception:
        pass
    return None


def normalise_solution_stem(path: Path) -> tuple[str, str]:
    """Map repository solution filenames back to their instance name and status."""
    parts = path.name.split(".")
    status = "open"

    while parts and parts[-1] in {"xz", "gz", "bz2"}:
        parts.pop()
    while parts and parts[-1] in {"sol", "txt", "json", "gph", "xml"}:
        parts.pop()
    if parts and parts[-1] in {"opt", "bst", "solved"}:
        marker = parts.pop()
        status = {
            "opt": "optimal",
            "bst": "best_known",
            "solved": "solved",
        }[marker]

    return ".".join(parts), status


def merge_solution_entry(
    result: dict[str, dict],
    inst: str,
    value: float | None,
    status: str,
    source_file: str | None = None,
) -> None:
    if not inst:
        return

    current = result.get(inst)
    current_priority = STATUS_PRIORITY.get(current.get("status", "open"), 0) if current else -1
    new_priority = STATUS_PRIORITY.get(status, 0)

    if current is None or new_priority > current_priority:
        merged = {"status": status}
        if value is not None:
            merged["value"] = value
        elif current and "value" in current:
            merged["value"] = current["value"]
        if source_file:
            merged["source_file"] = source_file
        elif current and "source_file" in current:
            merged["source_file"] = current["source_file"]
        result[inst] = merged
        return

    if value is not None and "value" not in current:
        current["value"] = value
    if source_file and "source_file" not in current:
        current["source_file"] = source_file


def read_solutions_folder(solutions_dir: Path) -> dict[str, dict]:
    """
    Returns {instance_stem: {"value": float, "status": "optimal"|"open"|"best_known"}}.
    Handles:
      - One .sol file per instance (filename matches instance stem).
      - A record.csv / solutions.csv with columns: instance, value, status.
      - A record.json / solutions.json.
    """
    result: dict[str, dict] = {}
    if not solutions_dir.is_dir():
        return result

    # CSV-style aggregate file
    for csv_name in ("record.csv", "solutions.csv", "best_known.csv"):
        csv_path = solutions_dir / csv_name
        if csv_path.exists():
            import csv
            with open(csv_path, newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    inst = row.get("instance") or row.get("name") or ""
                    val_str = row.get("value") or row.get("obj") or row.get("objective") or ""
                    status = (row.get("status") or "open").strip().lower()
                    try:
                        result[inst.strip()] = {
                            "value": float(val_str),
                            "status": status,
                            "source_file": config.rel_to_root(csv_path),
                        }
                    except ValueError:
                        pass
            if result:
                return result  # prefer aggregate file

    # JSON aggregate file
    for json_name in ("record.json", "solutions.json", "best_known.json"):
        json_path = solutions_dir / json_name
        if json_path.exists():
            try:
                data = json.loads(json_path.read_text())
                if isinstance(data, dict):
                    for inst, entry in data.items():
                        if isinstance(entry, dict):
                            val = entry.get("value") or entry.get("obj")
                            status = entry.get("status", "open")
                        else:
                            val, status = entry, "open"
                        try:
                            result[inst] = {
                                "value": float(val),
                                "status": status,
                                "source_file": config.rel_to_root(json_path),
                            }
                        except (TypeError, ValueError):
                            pass
                return result
            except Exception:
                pass

    # Per-instance solution files
    for sol_file in sorted(solutions_dir.rglob("*")):
        if not sol_file.is_file() or sol_file.name.startswith(".") or sol_file.name == "README.md":
            continue

        inst, status = normalise_solution_stem(sol_file)
        value = None
        if sol_file.suffix in (".sol", ".txt", ".json"):
            value = read_bkv_from_sol_file(sol_file)
        merge_solution_entry(
            result,
            inst,
            value,
            status,
            source_file=config.rel_to_root(sol_file),
        )

    return result


def load_birkhoff_solution_map(problem_dir: Path) -> dict[str, dict]:
    result: dict[str, dict] = {}
    solutions_dir = problem_dir / 'solutions'
    for sol_file in sorted(solutions_dir.glob('qbench_*.json')):
        try:
            data = json.loads(sol_file.read_text(encoding='utf-8'))
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        for key, entry in data.items():
            if not isinstance(entry, dict):
                continue
            inst_id = entry.get('id')
            if not inst_id:
                continue
            status = 'optimal' if entry.get('optimal') else 'best_known'
            merged = {
                'status': status,
                'source_file': config.rel_to_root(sol_file),
            }
            if 'k' in entry:
                merged['value'] = float(entry['k'])
            result[inst_id] = merged
    return result
