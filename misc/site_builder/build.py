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
"""Top-level build orchestration.

``build_data`` scans every problem directory and emits the split JSON payload:

    <out>/data/index.json                              — lightweight home-page payload
    <out>/data/leaderboard.json                        — aggregated submissions
    <out>/data/problems/<id>/meta.json                 — per-problem metadata
    <out>/data/problems/<id>/instances.json            — per-problem instance list
    <out>/data/problems/<id>/solutions.json            — per-problem best-known values / statuses
    <out>/data/problems/<id>/submissions.json          — per-problem submission leaderboard entries
    <out>/data/problems/<id>/submission_groups.json    — per-package submission profiles
    <out>/data/problems/<id>/instance_submissions.json — per-instance detailed submissions

``build_site`` copies the static frontend (HTML/CSS/JS from ``website/``) into
the output directory and then writes the generated data into ``<out>/data``.
This builder never emits HTML — all markup lives in the static ``website/``
files; the Python side only produces data.
"""

from __future__ import annotations

import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

from . import config
from .problem import build_problem


def _write_json(path: Path, payload) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def _index_problem_summary(data: dict) -> dict:
    """Lightweight per-problem record for the home page index."""
    return {
        "id": data["id"],
        "slug": data["slug"],
        "name": data["name"],
        "short": data["short"],
        "why": data["why"],
        "type": data["type"],
        "formulation": data["formulation"],
        "minimize": data["minimize"],
        "tags": data["tags"],
        "vars_min": data["vars_min"],
        "vars_max": data["vars_max"],
        "instance_count": data["instance_count"],
        "solved_count": data["solved_count"],
        "best_known_count": data["best_known_count"],
        "open_count": data["open_count"],
        "quantum_solved_count": data["quantum_solved_count"],
        "quantum_hw_solved_count": data["quantum_hw_solved_count"],
        "quantum_sim_solved_count": data["quantum_sim_solved_count"],
        "github_url": data["github_url"],
        "data_path": f"data/problems/{data['id']}",
    }


def _write_problem_chunks(problem_id: str, data: dict, problems_root: Path) -> tuple[list[dict], int]:
    """Split one problem payload into the per-file chunks and return its
    (submissions, instance_count) for the global aggregates."""
    chunk_dir = problems_root / problem_id
    chunk_dir.mkdir(parents=True, exist_ok=True)

    instances = data.pop("instances", [])
    submissions = data.pop("submissions", [])
    submission_groups = data.pop("submission_groups", [])

    # Detailed submissions used by instance pages (popped off each instance).
    submissions_by_instance: dict[str, list[dict]] = {}
    for inst in instances:
        inst_name = inst.get("name")
        if not inst_name:
            continue
        detailed_subs = inst.pop("submissions", [])
        if detailed_subs:
            submissions_by_instance[inst_name] = detailed_subs

    solutions = [
        {
            "instance": inst.get("name"),
            "status": inst.get("status", "open"),
            **({"value": inst["bkv"]} if "bkv" in inst else {}),
        }
        for inst in instances
        if inst.get("name")
    ]

    _write_json(chunk_dir / "meta.json", data)
    _write_json(chunk_dir / "instances.json", {"problem_id": problem_id, "instances": instances})
    _write_json(chunk_dir / "submissions.json", {"problem_id": problem_id, "entries": submissions})
    _write_json(chunk_dir / "submission_groups.json", {"problem_id": problem_id, "entries": submission_groups})
    _write_json(chunk_dir / "solutions.json", {"problem_id": problem_id, "entries": solutions})
    _write_json(chunk_dir / "instance_submissions.json", {"problem_id": problem_id, "entries": submissions_by_instance})

    print(
        f"  → {chunk_dir} "
        f"({len(instances)} instances, {data['solved_count']} solved, {len(submissions)} submissions)"
    )
    return submissions, data["instance_count"]


def build_data(out_dir: Path, built_at: str | None = None) -> dict:
    """Scan the repository and write the split JSON payload under ``out_dir/data``."""
    data_root = out_dir / "data"
    problems_root = data_root / "problems"
    data_root.mkdir(parents=True, exist_ok=True)
    problems_root.mkdir(parents=True, exist_ok=True)

    problem_dirs = config.find_problem_dirs()
    if not problem_dirs:
        print("No problem directories found. Run from the repository root.", file=sys.stderr)
        raise SystemExit(1)

    all_submissions: list[dict] = []
    index_problems: list[dict] = []
    total_instances = 0

    for problem_id, problem_dir in problem_dirs:
        print(f"Processing {problem_dir.name}…")
        data = build_problem(problem_id, problem_dir)
        index_problems.append(_index_problem_summary(data))
        submissions, instance_count = _write_problem_chunks(problem_id, data, problems_root)
        all_submissions.extend(submissions)
        total_instances += instance_count

    # Aggregated leaderboard: sort by problem, then instance, then value.
    all_submissions.sort(key=lambda s: (s.get("problem_id", ""), s.get("instance", ""), s.get("value") or 0))
    _write_json(data_root / "leaderboard.json", {"entries": all_submissions})
    print(f"\n→ {data_root / 'leaderboard.json'}  ({len(all_submissions)} submissions)")

    built_at = built_at or datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    index = {
        "built_at": built_at,
        "commit": config.get_commit_hash(),
        "total_instances": total_instances,
        "total_submissions": len(all_submissions),
        "problems": index_problems,
    }
    _write_json(data_root / "index.json", index)
    print(f"→ {data_root / 'index.json'}")
    print(f"\nDone. {len(problem_dirs)} problems, {total_instances} instances, {len(all_submissions)} submissions.")

    return {
        "problems": len(problem_dirs),
        "instances": total_instances,
        "submissions": len(all_submissions),
    }


def copy_static_frontend(root: Path, out_dir: Path) -> None:
    """Copy the static site (HTML/CSS/JS/images) from ``<root>/website`` into ``out_dir``."""
    website_dir = root / "website"
    if not website_dir.is_dir():
        raise SystemExit(f"Static frontend directory not found: {website_dir}")
    out_dir.mkdir(parents=True, exist_ok=True)
    shutil.copytree(website_dir, out_dir, dirs_exist_ok=True)


def build_site(
    out: Path | str,
    root: Path | str = ".",
    repo_url: str = config.DEFAULT_REPO_URL,
    ref: str = config.DEFAULT_REF,
    built_at: str | None = None,
    copy_static: bool = True,
) -> dict:
    """Assemble the full static site under ``out``.

    Configures the build context, copies the static frontend, and writes the
    generated data. Returns a small summary dict (problem / instance / submission
    counts).
    """
    root = Path(root)
    out = Path(out)
    config.configure(root, repo_url, ref)
    if copy_static:
        copy_static_frontend(root, out)
    return build_data(out, built_at=built_at)
