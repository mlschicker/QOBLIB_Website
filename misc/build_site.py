#!/usr/bin/env python3
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
"""Build the static GitHub Pages site for QOBLIB."""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import html
import json
import re
import shutil
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any
from urllib.parse import quote


DEFAULT_REPO_URL = "https://github.com/ZIB-AOPT/QOBLIB"
DEFAULT_REF = "main"
PROBLEM_DIR_RE = re.compile(r"^\d{2}-")
SUBMISSION_DATE_RE = re.compile(r"^(?P<date>\d{8})[_-]")
MONTHS = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "sept": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}
PAPER_IMAGE_PATHS = [
    Path("paper/images/mip_density_optsolvedIn_plot_aug25.png"),
    Path("paper/images/qubo_density_optsolvedIn_plot_aug25.png"),
]
PAPER_DATASETS = [
    (Path("paper/data/mip_instances_july25.csv"), "MIP"),
    (Path("paper/data/qubo_instances_aug25.csv"), "QUBO"),
]
PAPER_CLASS_TO_PROBLEM = {
    "marketsplit": "01-marketsplit",
    "labs": "02-labs",
    "birkhoff": "03-birkhoff",
    "steiner": "04-steiner",
    "sports": "05-sports",
    "portfolio": "06-portfolio",
    "independentset": "07-independentset",
    "network": "08-network",
    "routing": "09-routing",
    "topology": "10-topology",
}
PROBLEM_DETAILS: dict[str, dict[str, Any]] = {
    "01-marketsplit": {
        "short": "Market Split",
        "type": "Subset sum",
        "formulation": "MIP / QUBO",
        "minimize": True,
        "tags": ["feasibility", "partitioning", "integer data"],
        "why_care": "These instances stress multi-constraint subset-sum structure, where feasibility is easy to state but difficult to certify at useful sizes.",
        "instance_interest": "A compact feasibility benchmark for partitioning integer data across many simultaneous subset-sum constraints.",
    },
    "02-labs": {
        "short": "LABS",
        "type": "Binary sequences",
        "formulation": "QUBO / Ising",
        "minimize": True,
        "tags": ["autocorrelation", "spin variables", "signal design"],
        "why_care": "LABS is a canonical spin benchmark with direct links to communications, radar, and cryptography, and it becomes difficult as sequence length grows.",
        "instance_interest": "A sequence-design benchmark where small objective changes can separate strong search methods from weak ones.",
    },
    "03-birkhoff": {
        "short": "Birkhoff",
        "type": "Matrix decomposition",
        "formulation": "MIP",
        "minimize": True,
        "tags": ["assignment", "decomposition", "sparsity"],
        "why_care": "Minimum Birkhoff decomposition connects assignment structure, sparse representation, and quantum physics applications through a hard cardinality objective.",
        "instance_interest": "A decomposition benchmark that tests whether a method can find sparse convex combinations of permutation matrices.",
    },
    "04-steiner": {
        "short": "Steiner Packing",
        "type": "Network design",
        "formulation": "MIP",
        "minimize": True,
        "tags": ["VLSI", "routing", "packing"],
        "why_care": "Steiner tree packing models wire routing pressure in VLSI-style grids, where many connection demands must coexist without conflicts.",
        "instance_interest": "A routing benchmark for packing disjoint connection structures through constrained grid geometry.",
    },
    "05-sports": {
        "short": "Sports Scheduling",
        "type": "Scheduling",
        "formulation": "CSP / MIP",
        "minimize": True,
        "tags": ["timetabling", "feasibility", "RobinX"],
        "why_care": "Sports timetabling captures realistic constraint interactions from round-robin tournaments and includes instances selected for diversity and difficulty.",
        "instance_interest": "A real-world-like scheduling benchmark where feasibility under many interacting constraints is the central challenge.",
    },
    "06-portfolio": {
        "short": "Portfolio",
        "type": "Finance",
        "formulation": "QUBO / BQP",
        "minimize": True,
        "tags": ["risk", "transaction costs", "time series"],
        "why_care": "Portfolio instances add transaction costs, short selling, borrowing costs, and time coupling to a familiar financial optimization model.",
        "instance_interest": "A finance benchmark for balancing risk, returns, transaction costs, and time-linked binary decisions.",
    },
    "07-independentset": {
        "short": "MIS",
        "type": "Graph optimization",
        "formulation": "QUBO / MIP",
        "minimize": False,
        "tags": ["graphs", "stable set", "maximum cardinality"],
        "why_care": "Maximum independent set is a fundamental graph problem with compact QUBO structure and hard instances from social, biological, and benchmark graphs.",
        "instance_interest": "A graph benchmark that tests maximum-cardinality search on sparse and dense structures with known comparison points.",
    },
    "08-network": {
        "short": "Network Design",
        "type": "Telecommunications",
        "formulation": "MIP",
        "minimize": True,
        "tags": ["flows", "degree constraints", "routing"],
        "why_care": "Network design represents traffic-routing and degree-constrained infrastructure planning, with objective values tied to congestion.",
        "instance_interest": "A flow-routing benchmark for constructing sparse directed networks under traffic and degree constraints.",
    },
    "09-routing": {
        "short": "Vehicle Routing",
        "type": "Logistics",
        "formulation": "MIP",
        "minimize": True,
        "tags": ["VRP", "time windows", "capacity"],
        "why_care": "Vehicle routing combines route selection, capacity, and time-window pressure, reflecting core logistics and mobility applications.",
        "instance_interest": "A logistics benchmark for route construction with tight capacity and service-window constraints.",
    },
    "10-topology": {
        "short": "Topology",
        "type": "Graph design",
        "formulation": "Graph search / MIP",
        "minimize": True,
        "tags": ["diameter", "degree bound", "graph golf"],
        "why_care": "Topology design asks for low-diameter graphs under degree limits, a concise model for communication latency and network architecture.",
        "instance_interest": "A graph-design benchmark where a small diameter improvement can be meaningful and hard to prove.",
    },
}
DIRECTORY_INSTANCE_PROBLEMS = {"04-steiner", "06-portfolio"}
RECURSIVE_FILE_INSTANCE_PROBLEMS = {"05-sports"}
IGNORED_INSTANCE_FILES = {"README.md", "bounds.csv", "demand.txt"}
IGNORED_INSTANCE_DIRS = {"instance_gen_set"}
COMPRESSION_SUFFIXES = (".tar.gz", ".json.gz", ".xml.gz", ".txt.gz", ".gph.xz", ".dat.xz", ".gz", ".xz", ".zip")
INSTANCE_SUFFIXES = (".dat", ".json", ".gph", ".vrp", ".xml", ".txt", ".csv")


def read_template_columns(root: Path) -> list[str]:
    template_path = root / "misc" / "submission_template.csv"
    with template_path.open(newline="", encoding="utf-8-sig") as file:
        reader = csv.reader(file)
        return next(reader)


def problem_dirs(root: Path) -> list[Path]:
    return sorted(
        [path for path in root.iterdir() if path.is_dir() and PROBLEM_DIR_RE.match(path.name)],
        key=lambda path: path.name,
    )


def split_markdown_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def strip_markdown(text: str) -> str:
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    text = re.sub(r"\[(.*?)\]\([^)]*\)", r"\1", text)
    return text.strip()


def parse_problem_table(root: Path) -> dict[str, dict[str, str]]:
    readme = root / "README.md"
    if not readme.exists():
        return {}

    problems: dict[str, dict[str, str]] = {}
    for line in readme.read_text(encoding="utf-8").splitlines():
        if "[Details](" not in line:
            continue
        cells = split_markdown_row(line)
        if len(cells) < 4:
            continue
        link_match = re.search(r"\(([^)]+)\)", cells[3])
        if not link_match:
            continue
        problem_path = link_match.group(1).strip("./")
        problems[problem_path] = {
            "number": strip_markdown(cells[0]),
            "title": strip_markdown(cells[1]),
            "description": strip_markdown(cells[2]),
        }
    return problems


def read_problem_heading(problem_dir: Path) -> str:
    readme = problem_dir / "README.md"
    if not readme.exists():
        return problem_dir.name
    for line in readme.read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith("# "):
            heading = line[2:].strip()
            heading = re.sub(r"^\d+\s*-\s*", "", heading)
            return heading
    return problem_dir.name


def source_path_url(repo_url: str, ref: str, rel_path: str | Path, kind: str = "blob") -> str:
    rel = Path(rel_path).as_posix()
    encoded_path = "/".join(quote(part) for part in rel.split("/"))
    encoded_ref = quote(ref, safe="/")
    return f"{repo_url.rstrip('/')}/{kind}/{encoded_ref}/{encoded_path}"


def tree_url(repo_url: str, ref: str, rel_path: str | Path) -> str:
    return source_path_url(repo_url, ref, rel_path, "tree")


def strip_known_suffixes(name: str, suffixes: tuple[str, ...]) -> str:
    changed = True
    while changed:
        changed = False
        for suffix in suffixes:
            if name.endswith(suffix):
                name = name[: -len(suffix)]
                changed = True
                break
    return name


def instance_name_from_file(path: Path) -> str:
    return strip_known_suffixes(strip_known_suffixes(path.name, COMPRESSION_SUFFIXES), INSTANCE_SUFFIXES)


def paper_instance_aliases(problem_dir: str, file_name: str) -> list[str]:
    stem = strip_known_suffixes(file_name, (".lp", ".qs", ".mps", ".gz", ".xz"))
    aliases = [stem]
    if problem_dir == "03-birkhoff":
        match = re.match(r"^bh(?P<density>[DS])-(?P<size>\d+)-0*(?P<index>\d+)$", stem)
        if match:
            size = int(match.group("size"))
            density = size * size if match.group("density") == "D" else size
            aliases.append(f"B{size}_{density}_{int(match.group('index'))}")
    return list(dict.fromkeys(aliases))


def instance_format(path: Path) -> str:
    if path.is_dir():
        return "directory"
    name = path.name
    for suffix in COMPRESSION_SUFFIXES:
        if name.endswith(suffix):
            base = name[: -len(suffix)]
            inner = Path(base).suffix
            return f"{inner}{suffix}" if inner else suffix
    return path.suffix or "file"


def solution_instance_name(path: Path, problem_dir: str) -> str:
    name = strip_known_suffixes(path.name, COMPRESSION_SUFFIXES)
    if problem_dir == "06-portfolio":
        name = re.sub(r"_b\d+$", "", strip_known_suffixes(name, INSTANCE_SUFFIXES))
        return f"po_{name}" if name.startswith("a") else name
    for marker in (".opt.", ".bst."):
        if marker in name:
            return name.split(marker, 1)[0]
    name = re.sub(r"\.(opt|bst)$", "", name)
    return strip_known_suffixes(name, INSTANCE_SUFFIXES + (".sol",))


def parse_numeric(value: str) -> float | None:
    value = value.strip().replace(",", "")
    if not value or value.upper() in {"N/A", "NA", "INF", "-INF"}:
        return None
    if not re.fullmatch(r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?", value):
        return None
    try:
        return float(value)
    except ValueError:
        return None


def objective_is_proven(result: dict[str, Any]) -> bool:
    fields = result["fields"]
    objective = parse_numeric(fields.get("Best Objective Value", ""))
    bound = parse_numeric(fields.get("Optimality Bound", ""))
    if objective is None or bound is None:
        return False
    tolerance = 1e-9 * max(1.0, abs(objective), abs(bound))
    return abs(objective - bound) <= tolerance


def status_label(status: str) -> str:
    return {
        "optimal": "Optimal",
        "best_known": "Best known",
        "submitted": "Submitted",
        "open": "Open",
    }.get(status, status.replace("_", " ").title())


def short_metric_value(value: str) -> str:
    parsed = parse_numeric(value)
    if parsed is None:
        return value
    if parsed.is_integer():
        return str(int(parsed))
    return f"{parsed:.3g}"


def format_paper_metric(metric: dict[str, str]) -> str:
    parts = [metric["formulation"]]
    if metric.get("num_vars"):
        parts.append(f"{short_metric_value(metric['num_vars'])} vars")
    if metric.get("density") and metric["density"].lower() != "n/a":
        parts.append(f"density {short_metric_value(metric['density'])}")
    if metric.get("optimal"):
        parts.append(f"optimal {metric['optimal']}")
    elif metric.get("feasible"):
        parts.append(f"feasible {metric['feasible']}")
    return ", ".join(parts)


def format_paper_context(metrics: list[dict[str, str]]) -> str:
    return "; ".join(format_paper_metric(metric) for metric in metrics)


def parse_submission_prefix_date(name: str) -> dt.datetime | None:
    match = SUBMISSION_DATE_RE.match(name)
    if not match:
        return None
    value = match.group("date")
    try:
        return dt.datetime.strptime(value, "%Y%m%d")
    except ValueError:
        return None


def parse_date_text(value: str) -> dt.datetime | None:
    value = value.strip()
    if not value or value.upper() in {"N/A", "NA"}:
        return None

    normalized = value.replace("Z", "+00:00")
    for candidate in (normalized, normalized.replace("/", "-")):
        try:
            parsed = dt.datetime.fromisoformat(candidate)
            return parsed.replace(tzinfo=None)
        except ValueError:
            pass

    match = re.match(r"^(?P<day>\d{1,2})\.\s*(?P<month>[A-Za-z]+)\.?\s*(?P<year>\d{4})$", value)
    if match:
        month = MONTHS.get(match.group("month").lower().rstrip("."))
        if month:
            return dt.datetime(int(match.group("year")), month, int(match.group("day")))

    match = re.match(r"^(?P<year>\d{4})-(?P<month>\d{1,2})-(?P<day>\d{1,2})", value)
    if match:
        try:
            return dt.datetime(
                int(match.group("year")),
                int(match.group("month")),
                int(match.group("day")),
            )
        except ValueError:
            return None

    return None


def result_date_key(date_value: str, submission_set: str) -> str:
    parsed = parse_date_text(date_value) or parse_submission_prefix_date(submission_set)
    if not parsed:
        return ""
    return parsed.strftime("%Y-%m-%dT%H:%M:%S")


def count_top_level_entries(path: Path) -> int:
    if not path.is_dir():
        return 0
    ignored = {"README.md"}
    return sum(1 for child in path.iterdir() if not child.name.startswith(".") and child.name not in ignored)


def count_files(path: Path) -> int:
    if not path.is_dir():
        return 0
    return sum(1 for child in path.rglob("*") if child.is_file() and not child.name.startswith("."))


def collect_paper_metrics(root: Path) -> dict[tuple[str, str], list[dict[str, str]]]:
    metrics: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    for rel_path, formulation in PAPER_DATASETS:
        path = root / rel_path
        if not path.exists():
            continue
        with path.open(newline="", encoding="utf-8-sig") as file:
            for row in csv.DictReader(file):
                problem_dir = PAPER_CLASS_TO_PROBLEM.get((row.get("class") or "").strip())
                file_name = (row.get("file") or "").strip()
                if not problem_dir or not file_name:
                    continue
                metric = {
                    "formulation": formulation,
                    "file": file_name,
                    "num_vars": (row.get("num_vars") or "").strip(),
                    "num_constraints": (row.get("num_constraints") or "").strip(),
                    "density": (row.get("density") or "").strip(),
                    "coeff_range": (row.get("coeff_range") or "").strip(),
                    "obj_value": (row.get("obj_value") or "").strip(),
                    "optimal": (row.get("optimal") or "").strip(),
                    "feasible": (row.get("feasible") or "").strip(),
                    "problem_size": (row.get("problem_size") or "").strip(),
                }
                for instance in paper_instance_aliases(problem_dir, file_name):
                    metrics[(problem_dir, instance)].append(metric)
    for values in metrics.values():
        values.sort(key=lambda item: item["formulation"])
    return dict(metrics)


def problem_info(root: Path) -> dict[str, dict[str, str]]:
    table_info = parse_problem_table(root)
    info: dict[str, dict[str, str]] = {}
    for problem_dir in problem_dirs(root):
        table = table_info.get(problem_dir.name, {})
        details = PROBLEM_DETAILS.get(problem_dir.name, {})
        number = table.get("number") or problem_dir.name.split("-", 1)[0]
        title = table.get("title") or read_problem_heading(problem_dir)
        description = table.get("description") or ""
        info[problem_dir.name] = {
            "number": number,
            "title": title,
            "description": description,
            "short": details.get("short", title),
            "type": details.get("type", ""),
            "formulation": details.get("formulation", ""),
            "minimize": details.get("minimize", True),
            "tags": details.get("tags", []),
            "why_care": details.get("why_care", ""),
            "instance_interest": details.get("instance_interest", ""),
        }
    return info


def load_submission_results(
    root: Path,
    columns: list[str],
    problems: dict[str, dict[str, str]],
    repo_url: str,
    ref: str,
) -> tuple[list[dict[str, Any]], list[str]]:
    results: list[dict[str, Any]] = []
    warnings: list[str] = []

    for csv_path in sorted(root.glob("[0-9][0-9]-*/submissions/*/*/*_summary.csv")):
        rel_csv = csv_path.relative_to(root).as_posix()
        parts = rel_csv.split("/")
        if len(parts) < 5:
            warnings.append(f"Skipping unexpected summary path: {rel_csv}")
            continue

        problem_dir, _, submission_set, instance_dir = parts[:4]
        if problem_dir not in problems:
            warnings.append(f"Skipping summary for unknown problem: {rel_csv}")
            continue

        with csv_path.open(newline="", encoding="utf-8-sig") as file:
            reader = csv.DictReader(file)
            if reader.fieldnames != columns:
                warnings.append(f"Header mismatch in {rel_csv}")
            for row_index, row in enumerate(reader, start=1):
                fields = {column: (row.get(column) or "").strip() for column in columns}
                instance = fields.get("Problem") or instance_dir
                readme_path = csv_path.with_name("README.md")
                rel_readme = readme_path.relative_to(root).as_posix() if readme_path.exists() else ""
                date_key = result_date_key(fields.get("Date", ""), submission_set)
                results.append(
                    {
                        "id": f"{rel_csv}:{row_index}",
                        "problem_dir": problem_dir,
                        "problem_number": problems[problem_dir]["number"],
                        "problem_title": problems[problem_dir]["title"],
                        "submission_set": submission_set,
                        "instance_dir": instance_dir,
                        "instance": instance,
                        "date_key": date_key,
                        "summary_csv": rel_csv,
                        "summary_url": source_path_url(repo_url, ref, rel_csv),
                        "readme_path": rel_readme,
                        "readme_url": source_path_url(repo_url, ref, rel_readme) if rel_readme else "",
                        "fields": fields,
                    }
                )

    results.sort(
        key=lambda item: (
            item["date_key"],
            item["problem_dir"],
            item["submission_set"],
            item["instance"],
        ),
        reverse=True,
    )
    return results, warnings


def collect_submission_sets(
    root: Path,
    problems: dict[str, dict[str, str]],
    results: list[dict[str, Any]],
    repo_url: str,
    ref: str,
) -> list[dict[str, Any]]:
    result_groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for result in results:
        result_groups[(result["problem_dir"], result["submission_set"])].append(result)

    sets: list[dict[str, Any]] = []
    for problem_dir in problem_dirs(root):
        submissions_dir = problem_dir / "submissions"
        if not submissions_dir.is_dir():
            continue
        for set_dir in sorted([path for path in submissions_dir.iterdir() if path.is_dir()], key=lambda path: path.name):
            rel_set = set_dir.relative_to(root).as_posix()
            readme_path = set_dir / "README.md"
            rel_readme = readme_path.relative_to(root).as_posix() if readme_path.exists() else ""
            group = result_groups.get((problem_dir.name, set_dir.name), [])
            date_key = ""
            if group:
                date_key = max(item["date_key"] for item in group)
            if not date_key:
                parsed = parse_submission_prefix_date(set_dir.name)
                date_key = parsed.strftime("%Y-%m-%dT%H:%M:%S") if parsed else ""
            submitters = sorted({item["fields"].get("Submitter", "") for item in group if item["fields"].get("Submitter", "")})
            modeling = sorted({item["fields"].get("Modeling Approach", "") for item in group if item["fields"].get("Modeling Approach", "")})
            algorithms = sorted({item["fields"].get("Algorithm Type", "") for item in group if item["fields"].get("Algorithm Type", "")})
            sets.append(
                {
                    "problem_dir": problem_dir.name,
                    "problem_title": problems[problem_dir.name]["title"],
                    "name": set_dir.name,
                    "path": rel_set,
                    "source_url": tree_url(repo_url, ref, rel_set),
                    "readme_path": rel_readme,
                    "readme_url": source_path_url(repo_url, ref, rel_readme) if rel_readme else "",
                    "date_key": date_key,
                    "instance_count": count_top_level_entries(set_dir),
                    "submitted_instance_count": len({item["instance"] for item in group}),
                    "result_count": len(group),
                    "submitters": submitters,
                    "modeling_approaches": modeling,
                    "algorithm_types": algorithms,
                }
            )

    sets.sort(key=lambda item: (item["date_key"], item["problem_dir"], item["name"]), reverse=True)
    return sets


def collect_problems(
    root: Path,
    problems: dict[str, dict[str, str]],
    results: list[dict[str, Any]],
    submission_sets: list[dict[str, Any]],
    repo_url: str,
    ref: str,
) -> list[dict[str, Any]]:
    results_by_problem = defaultdict(int)
    for result in results:
        results_by_problem[result["problem_dir"]] += 1

    sets_by_problem = defaultdict(int)
    for submission_set in submission_sets:
        sets_by_problem[submission_set["problem_dir"]] += 1

    collected: list[dict[str, Any]] = []
    for problem_dir in problem_dirs(root):
        rel_problem = problem_dir.relative_to(root).as_posix()
        meta = problems[problem_dir.name]
        links = {}
        for child_name in ("README.md", "instances", "models", "solutions", "submissions", "check"):
            child = problem_dir / child_name
            if not child.exists():
                continue
            rel_child = child.relative_to(root).as_posix()
            links[child_name] = source_path_url(repo_url, ref, rel_child) if child.is_file() else tree_url(repo_url, ref, rel_child)

        collected.append(
            {
                "name": problem_dir.name,
                "number": meta["number"],
                "title": meta["title"],
                "description": meta["description"],
                "short": meta["short"],
                "type": meta["type"],
                "formulation": meta["formulation"],
                "minimize": meta["minimize"],
                "tags": meta["tags"],
                "why_care": meta["why_care"],
                "instance_interest": meta["instance_interest"],
                "path": rel_problem,
                "page": f"problems/{problem_dir.name}/",
                "source_url": tree_url(repo_url, ref, rel_problem),
                "links": links,
                "counts": {
                    "instances": count_top_level_entries(problem_dir / "instances"),
                    "model_files": count_files(problem_dir / "models"),
                    "solution_files": count_files(problem_dir / "solutions"),
                    "submission_sets": sets_by_problem[problem_dir.name],
                    "results": results_by_problem[problem_dir.name],
                },
            }
        )
    return collected


def collect_solution_statuses(root: Path, problem_dir: str, repo_url: str, ref: str) -> dict[str, dict[str, str]]:
    solutions_dir = root / problem_dir / "solutions"
    statuses: dict[str, dict[str, str]] = {}
    if not solutions_dir.is_dir():
        return statuses

    priority = {"solution": 0, "best_known": 1, "optimal": 2}
    for source in sorted(path for path in solutions_dir.rglob("*") if path.is_file()):
        if source.name.startswith(".") or source.name in {"README.md", "0-info.txt"}:
            continue
        name = solution_instance_name(source, problem_dir)
        if not name:
            continue
        status = ""
        if ".opt." in source.name or source.name.endswith(".opt.sol"):
            status = "optimal"
        elif ".bst." in source.name or source.name.endswith(".bst.sol"):
            status = "best_known"
        else:
            status = "solution"
        rel_source = source.relative_to(root).as_posix()
        current = statuses.get(name)
        if current and priority[current["status"]] > priority[status]:
            continue
        statuses[name] = {
            "status": status,
            "solution_path": rel_source,
            "solution_url": source_path_url(repo_url, ref, rel_source),
        }
    return statuses


def add_instance_source(
    instances: dict[tuple[str, str], dict[str, Any]],
    root: Path,
    problem: dict[str, Any],
    source: Path,
    repo_url: str,
    ref: str,
) -> None:
    name = source.name if source.is_dir() else instance_name_from_file(source)
    if not name:
        return
    rel_source = source.relative_to(root).as_posix()
    key = (problem["name"], name)
    entry = instances.setdefault(
        key,
        {
            "id": f"{problem['name']}:{name}",
            "problem_dir": problem["name"],
            "problem_number": problem["number"],
            "problem_title": problem["title"],
            "instance": name,
            "family": "",
            "format": instance_format(source),
            "source_path": rel_source,
            "source_url": tree_url(repo_url, ref, rel_source) if source.is_dir() else source_path_url(repo_url, ref, rel_source),
        },
    )
    if not entry.get("source_path"):
        entry.update(
            {
                "family": "",
                "format": instance_format(source),
                "source_path": rel_source,
                "source_url": tree_url(repo_url, ref, rel_source) if source.is_dir() else source_path_url(repo_url, ref, rel_source),
            }
        )


def collect_instance_sources(
    root: Path,
    problems: list[dict[str, Any]],
    repo_url: str,
    ref: str,
) -> dict[tuple[str, str], dict[str, Any]]:
    instances: dict[tuple[str, str], dict[str, Any]] = {}
    for problem in problems:
        problem_name = problem["name"]
        instances_dir = root / problem_name / "instances"
        if not instances_dir.is_dir():
            continue

        if problem_name in RECURSIVE_FILE_INSTANCE_PROBLEMS:
            sources = sorted(path for path in instances_dir.rglob("*") if path.is_file())
        else:
            sources = sorted(path for path in instances_dir.iterdir() if not path.name.startswith("."))

        for source in sources:
            if source.name in IGNORED_INSTANCE_FILES:
                continue
            if source.is_dir() and source.name in IGNORED_INSTANCE_DIRS:
                continue
            if source.is_dir() and problem_name not in DIRECTORY_INSTANCE_PROBLEMS:
                continue
            if source.is_file() and problem_name in DIRECTORY_INSTANCE_PROBLEMS:
                continue
            add_instance_source(instances, root, problem, source, repo_url, ref)
            if problem_name in RECURSIVE_FILE_INSTANCE_PROBLEMS and source.is_file():
                key = (problem_name, instance_name_from_file(source))
                if key in instances:
                    rel_parent = source.parent.relative_to(instances_dir).as_posix()
                    instances[key]["family"] = "" if rel_parent == "." else rel_parent

    return instances


def best_results_by_instance(
    results: list[dict[str, Any]],
    problem_lookup: dict[str, dict[str, Any]],
) -> tuple[dict[tuple[str, str], dict[str, Any]], Counter[tuple[str, str]]]:
    best: dict[tuple[str, str], dict[str, Any]] = {}
    counts: Counter[tuple[str, str]] = Counter()
    for result in results:
        key = (result["problem_dir"], result["instance"])
        counts[key] += 1
        value = parse_numeric(result["fields"].get("Best Objective Value", ""))
        if value is None:
            continue
        current = best.get(key)
        minimize = problem_lookup.get(result["problem_dir"], {}).get("minimize", True)
        if current is None:
            best[key] = result
            continue
        current_value = parse_numeric(current["fields"].get("Best Objective Value", ""))
        if current_value is None:
            best[key] = result
            continue
        if (minimize and value < current_value) or (not minimize and value > current_value):
            best[key] = result
    return best, counts


def collect_instances(
    root: Path,
    problems: list[dict[str, Any]],
    results: list[dict[str, Any]],
    repo_url: str,
    ref: str,
) -> list[dict[str, Any]]:
    problem_lookup = {problem["name"]: problem for problem in problems}
    instances = collect_instance_sources(root, problems, repo_url, ref)
    best_results, result_counts = best_results_by_instance(results, problem_lookup)
    paper_metrics = collect_paper_metrics(root)
    solution_indexes = {
        problem["name"]: collect_solution_statuses(root, problem["name"], repo_url, ref)
        for problem in problems
    }

    for problem_name, solution_index in solution_indexes.items():
        problem = problem_lookup[problem_name]
        for instance, solution in solution_index.items():
            key = (problem_name, instance)
            instances.setdefault(
                key,
                {
                    "id": f"{problem_name}:{instance}",
                    "problem_dir": problem_name,
                    "problem_number": problem["number"],
                    "problem_title": problem["title"],
                    "instance": instance,
                    "family": "",
                    "format": "",
                    "source_path": "",
                    "source_url": "",
                },
            )

    for result in results:
        key = (result["problem_dir"], result["instance"])
        if key not in instances and result["problem_dir"] in problem_lookup:
            problem = problem_lookup[result["problem_dir"]]
            instances[key] = {
                "id": f"{result['problem_dir']}:{result['instance']}",
                "problem_dir": result["problem_dir"],
                "problem_number": problem["number"],
                "problem_title": problem["title"],
                "instance": result["instance"],
                "family": "",
                "format": "",
                "source_path": "",
                "source_url": "",
            }

    collected: list[dict[str, Any]] = []
    for key, entry in instances.items():
        problem_name, instance = key
        best_result = best_results.get(key)
        best_value = ""
        best_numeric: float | None = None
        best_summary_url = ""
        best_submission = ""
        best_submitter = ""
        best_date = ""
        if best_result:
            best_value = best_result["fields"].get("Best Objective Value", "")
            best_numeric = parse_numeric(best_value)
            best_summary_url = best_result["summary_url"]
            best_submission = best_result["submission_set"]
            best_submitter = best_result["fields"].get("Submitter", "")
            best_date = best_result["fields"].get("Date", "")

        solution = solution_indexes.get(problem_name, {}).get(instance, {})
        solution_status = solution.get("status", "")
        if solution_status == "optimal" or (best_result and objective_is_proven(best_result)):
            status = "optimal"
        elif solution_status == "best_known" or best_result:
            status = "best_known"
        elif result_counts[key]:
            status = "submitted"
        else:
            status = "open"
        metrics = paper_metrics.get(key, [])

        collected.append(
            {
                **entry,
                "why_care": problem_lookup.get(problem_name, {}).get("instance_interest", ""),
                "problem_why_care": problem_lookup.get(problem_name, {}).get("why_care", ""),
                "paper_metrics": metrics,
                "paper_context": format_paper_context(metrics),
                "status": status,
                "status_label": status_label(status),
                "solution_status": solution_status,
                "solution_path": solution.get("solution_path", ""),
                "solution_url": solution.get("solution_url", ""),
                "best_value": best_value,
                "best_numeric": best_numeric,
                "best_summary_url": best_summary_url,
                "best_submission": best_submission,
                "best_submitter": best_submitter,
                "best_date": best_date,
                "submission_count": result_counts[key],
            }
        )

    collected.sort(key=lambda item: (item["problem_dir"], item["instance"]))
    return collected


def collect_leaderboard(
    results: list[dict[str, Any]],
    problems: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    problem_lookup = {problem["name"]: problem for problem in problems}
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for result in results:
        value = parse_numeric(result["fields"].get("Best Objective Value", ""))
        if value is None:
            continue
        grouped[(result["problem_dir"], result["instance"])].append({**result, "numeric_value": value})

    entries: list[dict[str, Any]] = []
    for (problem_name, instance), rows in sorted(grouped.items()):
        problem = problem_lookup.get(problem_name, {})
        minimize = problem.get("minimize", True)
        rows.sort(
            key=lambda item: (
                item["numeric_value"] if minimize else -item["numeric_value"],
                item["date_key"],
                item["submission_set"],
            )
        )
        last_value: float | None = None
        rank = 0
        for index, row in enumerate(rows, start=1):
            if last_value is None or row["numeric_value"] != last_value:
                rank = index
                last_value = row["numeric_value"]
            fields = row["fields"]
            entries.append(
                {
                    "rank": rank,
                    "problem_dir": problem_name,
                    "problem_title": row["problem_title"],
                    "instance": instance,
                    "objective": fields.get("Best Objective Value", ""),
                    "numeric_objective": row["numeric_value"],
                    "direction": "minimize" if minimize else "maximize",
                    "submitter": fields.get("Submitter", ""),
                    "date": fields.get("Date", ""),
                    "date_key": row["date_key"],
                    "modeling": fields.get("Modeling Approach", ""),
                    "algorithm": fields.get("Algorithm Type", ""),
                    "runtime": fields.get("Total Runtime", ""),
                    "submission_set": row["submission_set"],
                    "summary_url": row["summary_url"],
                    "reference": fields.get("Reference", ""),
                }
            )
    return entries


def build_dataset(
    root: Path,
    repo_url: str = DEFAULT_REPO_URL,
    ref: str = DEFAULT_REF,
    generated_at: str | None = None,
) -> dict[str, Any]:
    columns = read_template_columns(root)
    problems = problem_info(root)
    results, warnings = load_submission_results(root, columns, problems, repo_url, ref)
    submission_sets = collect_submission_sets(root, problems, results, repo_url, ref)
    problem_entries = collect_problems(root, problems, results, submission_sets, repo_url, ref)
    instances = collect_instances(root, problem_entries, results, repo_url, ref)
    leaderboard = collect_leaderboard(results, problem_entries)
    instance_counts = Counter(instance["problem_dir"] for instance in instances)
    for problem in problem_entries:
        problem["counts"]["instances"] = instance_counts[problem["name"]]
    generated = generated_at or dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    counts = {
        "problems": len(problem_entries),
        "submission_sets": len(submission_sets),
        "results": len(results),
        "instances": len(instances),
        "leaderboard_entries": len(leaderboard),
    }
    return {
        "generated_at": generated,
        "repo_url": repo_url.rstrip("/"),
        "ref": ref,
        "template_columns": columns,
        "counts": counts,
        "problems": problem_entries,
        "instances": instances,
        "submission_sets": submission_sets,
        "leaderboard": leaderboard,
        "results": results,
        "warnings": warnings,
    }


def escape(value: Any) -> str:
    return html.escape("" if value is None else str(value), quote=True)


def root_prefix(depth: int) -> str:
    return "../" * depth


def page_layout(title: str, body: str, depth: int, dataset: dict[str, Any]) -> str:
    prefix = root_prefix(depth)
    generated = escape(dataset["generated_at"])
    repo_url = escape(dataset["repo_url"])
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escape(title)} | QOBLIB</title>
  <link rel="stylesheet" href="{prefix}assets/site.css">
  <script defer src="{prefix}assets/site.js"></script>
</head>
<body>
  <header class="site-header">
    <nav class="site-nav" aria-label="Main navigation">
      <a class="brand" href="{prefix}index.html">QOBLIB</a>
      <div class="nav-links">
        <a href="{prefix}index.html">Overview</a>
        <a href="{prefix}instances/">Instances</a>
        <a href="{prefix}submissions/">Submissions</a>
        <a href="{prefix}leaderboard/">Leaderboard</a>
        <a href="{repo_url}">GitHub</a>
      </div>
    </nav>
  </header>
  <main>
{body}
  </main>
  <footer class="site-footer">
    <span>Generated from <a href="{repo_url}">{escape(dataset["ref"])}</a> on {generated}</span>
    <span><a href="{prefix}assets/qoblib-data.json">Download site data</a></span>
  </footer>
</body>
</html>
"""


def stat_card(label: str, value: Any) -> str:
    return f"""<div class="stat-card">
  <strong>{escape(value)}</strong>
  <span>{escape(label)}</span>
</div>"""


def format_count(value: int) -> str:
    return f"{value:,}"


def sort_number(value: str) -> str:
    parsed = parse_numeric(value)
    return "" if parsed is None else str(parsed)


def problem_meta_text(problem: dict[str, Any]) -> str:
    parts = [problem.get("type", ""), problem.get("formulation", ""), "min" if problem.get("minimize", True) else "max"]
    return " / ".join(part for part in parts if part)


def repo_file_url(dataset: dict[str, Any], rel_path: str) -> str:
    return source_path_url(dataset["repo_url"], dataset["ref"], rel_path)


def render_submit_callout(dataset: dict[str, Any], title: str = "Submit a solution") -> str:
    contributing_url = repo_file_url(dataset, "CONTRIBUTING.md")
    template_url = repo_file_url(dataset, "misc/submission_template.csv")
    return f"""<section class="callout submit-callout">
  <div>
    <p class="eyebrow">Contribute results</p>
    <h2>{escape(title)}</h2>
    <p>Have a better bound, a new feasible solution, a quantum run, or a useful negative result? QOBLIB accepts benchmark submissions by pull request using the canonical summary CSV template.</p>
  </div>
  <div class="callout-actions">
    <a class="button primary" href="{escape(contributing_url)}">Submission guide</a>
    <a class="button" href="{escape(template_url)}">CSV template</a>
    <a class="button" href="{escape(dataset["repo_url"])}">Open repository</a>
  </div>
</section>"""


def render_home(dataset: dict[str, Any]) -> str:
    counts = dataset["counts"]
    stats = "\n".join(
        [
            stat_card("Problem classes", format_count(counts["problems"])),
            stat_card("Instances", format_count(counts["instances"])),
            stat_card("Submission sets", format_count(counts["submission_sets"])),
            stat_card("Ranked results", format_count(counts["leaderboard_entries"])),
        ]
    )

    problem_cards = []
    for problem in dataset["problems"]:
        problem_counts = problem["counts"]
        problem_cards.append(
            f"""<article class="problem-card">
  <div class="problem-number">{escape(problem["number"])}</div>
  <h3><a href="{escape(problem["page"])}">{escape(problem["title"])}</a></h3>
  <p class="problem-meta">{escape(problem_meta_text(problem))}</p>
  <p>{escape(problem["description"])}</p>
  <p class="why-care">{escape(problem["why_care"])}</p>
  <dl class="compact-stats">
    <div><dt>Instances</dt><dd>{format_count(problem_counts["instances"])}</dd></div>
    <div><dt>Submissions</dt><dd>{format_count(problem_counts["submission_sets"])}</dd></div>
    <div><dt>Results</dt><dd>{format_count(problem_counts["results"])}</dd></div>
  </dl>
</article>"""
        )

    image_cards = []
    for image in dataset.get("images", []):
        caption = "Mixed Integer Programming formulations" if "mip_" in image["asset_path"] else "QUBO formulations"
        image_cards.append(
            f"""<figure class="landscape-card">
  <img src="{escape(image["asset_path"])}" alt="{escape(caption)}">
  <figcaption>{escape(caption)}</figcaption>
</figure>"""
        )

    image_section = ""
    if image_cards:
        image_section = f"""<section class="section">
  <div class="section-heading">
    <h2>Complexity landscape</h2>
    <p>Difficulty summaries from the QOBLIB paper data included in the repository.</p>
  </div>
  <div class="landscape-grid">
    {"".join(image_cards)}
  </div>
</section>"""

    body = f"""    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Quantum Optimization Benchmarking Library</p>
        <h1>Benchmark instances and solution submissions for quantum optimization.</h1>
        <p>QOBLIB collects ten challenging optimization problem classes with practical motivation, reference models, known solutions, and community-submitted results.</p>
        <div class="hero-actions">
          <a class="button primary" href="instances/">Browse instances</a>
          <a class="button" href="submissions/">Browse submissions</a>
          <a class="button" href="leaderboard/">View leaderboard</a>
          <a class="button" href="{escape(dataset["repo_url"])}">View repository</a>
        </div>
      </div>
      <div class="stats-grid">{stats}</div>
    </section>
    {render_submit_callout(dataset)}
    <section class="section">
      <div class="section-heading">
        <h2>Problem classes</h2>
        <p>Each card links to generated repository summaries and source files for the corresponding benchmark class.</p>
      </div>
      <div class="problem-grid">
        {"".join(problem_cards)}
      </div>
    </section>
    {image_section}
"""
    return page_layout("Overview", body, 0, dataset)


def filter_option(value: str) -> str:
    return f'<option value="{escape(value)}">{escape(value)}</option>'


def submissions_table(results: list[dict[str, Any]], depth: int, filter_name: str = "results") -> str:
    prefix = root_prefix(depth)
    rows = []
    for result in results:
        fields = result["fields"]
        search_text = " ".join(
            [
                result["problem_title"],
                result["instance"],
                result["submission_set"],
                fields.get("Submitter", ""),
                fields.get("Modeling Approach", ""),
                fields.get("Algorithm Type", ""),
                fields.get("Reference", ""),
            ]
        ).lower()
        rows.append(
            f"""<tr data-problem="{escape(result["problem_dir"])}" data-modeling="{escape(fields.get("Modeling Approach", ""))}" data-algorithm="{escape(fields.get("Algorithm Type", ""))}" data-search="{escape(search_text)}">
  <td><a href="{prefix}problems/{escape(result["problem_dir"])}/">{escape(result["problem_title"])}</a></td>
  <td>{escape(result["instance"])}</td>
  <td>{escape(result["submission_set"])}</td>
  <td>{escape(fields.get("Submitter", ""))}</td>
  <td data-sort="{escape(result["date_key"])}">{escape(fields.get("Date", ""))}</td>
  <td data-sort="{escape(sort_number(fields.get("Best Objective Value", "")))}">{escape(fields.get("Best Objective Value", ""))}</td>
  <td>{escape(fields.get("Modeling Approach", ""))}</td>
  <td>{escape(fields.get("Algorithm Type", ""))}</td>
  <td data-sort="{escape(sort_number(fields.get("Total Runtime", "")))}">{escape(fields.get("Total Runtime", ""))}</td>
  <td><a href="{escape(result["summary_url"])}">CSV</a></td>
</tr>"""
        )

    return f"""<div class="table-wrap">
  <table class="data-table" data-filter-table="{escape(filter_name)}" data-sort-table>
    <thead>
      <tr>
        <th>Problem</th>
        <th>Instance</th>
        <th>Submission</th>
        <th>Submitter</th>
        <th>Date</th>
        <th>Objective</th>
        <th>Model</th>
        <th>Algorithm</th>
        <th>Total runtime</th>
        <th>Source</th>
      </tr>
    </thead>
    <tbody>
      {"".join(rows)}
    </tbody>
  </table>
</div>"""


def render_submissions(dataset: dict[str, Any]) -> str:
    results = dataset["results"]
    submission_sets = dataset["submission_sets"]
    modeling_options = sorted({result["fields"].get("Modeling Approach", "") for result in results if result["fields"].get("Modeling Approach", "")})
    algorithm_options = sorted({result["fields"].get("Algorithm Type", "") for result in results if result["fields"].get("Algorithm Type", "")})
    problem_options = [(problem["name"], problem["title"]) for problem in dataset["problems"]]
    submitters = sorted({result["fields"].get("Submitter", "") for result in results if result["fields"].get("Submitter", "")})
    represented = len({result["problem_dir"] for result in results})
    stats = "\n".join(
        [
            stat_card("Submission packages", format_count(len(submission_sets))),
            stat_card("Submitted instances", format_count(len({(result["problem_dir"], result["instance"]) for result in results}))),
            stat_card("Problems represented", format_count(represented)),
            stat_card("Submitters", format_count(len(submitters))),
        ]
    )
    body = f"""    <section class="page-title">
      <p class="eyebrow">Community results</p>
      <h1>Instance submissions</h1>
      <p>{format_count(len(results))} parsed result rows from canonical QOBLIB summary CSV files, grouped by submission package.</p>
    </section>
    <section class="stats-grid section-stats">{stats}</section>
    {render_submit_callout(dataset)}
    <section class="section">
      <div class="section-heading">
        <h2>Submission packages</h2>
        <p>Top-level submission directories as received through repository contributions.</p>
      </div>
      <section class="filters" data-filter-scope="packages" aria-label="Submission package filters">
        <label>
          Search
          <input type="search" data-search placeholder="Package, submitter, method">
        </label>
        <label>
          Problem
          <select data-problem-filter>
            <option value="">All problems</option>
            {"".join(f'<option value="{escape(name)}">{escape(title)}</option>' for name, title in problem_options)}
          </select>
        </label>
        <output data-result-count data-result-label="packages">{format_count(len(submission_sets))} packages</output>
      </section>
      {submission_sets_table(submission_sets, 1, "packages")}
    </section>
    <section class="section">
      <div class="section-heading">
        <h2>Result rows</h2>
        <p>Instance-level rows parsed from each submitted summary CSV.</p>
      </div>
      <section class="filters" data-filter-scope="results" aria-label="Submission result filters">
      <label>
        Search
        <input type="search" data-search placeholder="Instance, submitter, method, reference">
      </label>
      <label>
        Problem
        <select data-problem-filter>
          <option value="">All problems</option>
          {"".join(f'<option value="{escape(name)}">{escape(title)}</option>' for name, title in problem_options)}
        </select>
      </label>
      <label>
        Model
        <select data-modeling-filter>
          <option value="">All models</option>
          {"".join(filter_option(value) for value in modeling_options)}
        </select>
      </label>
      <label>
        Algorithm
        <select data-algorithm-filter>
          <option value="">All algorithms</option>
          {"".join(filter_option(value) for value in algorithm_options)}
        </select>
      </label>
        <output data-result-count data-result-label="rows">{format_count(len(results))} rows</output>
      </section>
      {submissions_table(results, 1, "results")}
    </section>
"""
    return page_layout("Submissions", body, 1, dataset)


def submission_sets_table(sets: list[dict[str, Any]], depth: int, filter_name: str = "packages") -> str:
    prefix = root_prefix(depth)
    rows = []
    for submission_set in sets:
        submitters = ", ".join(submission_set.get("submitters", []))
        approaches = ", ".join(submission_set.get("modeling_approaches", []))
        search_text = " ".join(
            [
                submission_set["name"],
                submission_set["problem_title"],
                submitters,
                approaches,
                ", ".join(submission_set.get("algorithm_types", [])),
            ]
        ).lower()
        rows.append(
            f"""<tr data-problem="{escape(submission_set["problem_dir"])}" data-search="{escape(search_text)}">
  <td><a href="{prefix}problems/{escape(submission_set["problem_dir"])}/">{escape(submission_set["problem_title"])}</a></td>
  <td>{escape(submission_set["name"])}</td>
  <td>{escape(submitters)}</td>
  <td data-sort="{escape(submission_set["date_key"])}">{escape(submission_set["date_key"][:10])}</td>
  <td data-sort="{escape(submission_set["submitted_instance_count"])}">{format_count(submission_set["submitted_instance_count"])}</td>
  <td data-sort="{escape(submission_set["result_count"])}">{format_count(submission_set["result_count"])}</td>
  <td><a href="{escape(submission_set["source_url"])}">Directory</a></td>
</tr>"""
        )
    return f"""<div class="table-wrap">
  <table class="data-table compact-table" data-filter-table="{escape(filter_name)}" data-sort-table>
    <thead><tr><th>Problem</th><th>Submission set</th><th>Submitter</th><th>Date key</th><th>Instances</th><th>Rows</th><th>Source</th></tr></thead>
    <tbody>{"".join(rows)}</tbody>
  </table>
</div>"""


def render_submission_sets(sets: list[dict[str, Any]]) -> str:
    return submission_sets_table(sets, 2, "problem-packages")


def source_links_for_instance(instance: dict[str, Any]) -> str:
    links = []
    if instance.get("source_url"):
        links.append(f'<a href="{escape(instance["source_url"])}">Instance</a>')
    if instance.get("solution_url"):
        links.append(f'<a href="{escape(instance["solution_url"])}">Solution</a>')
    if instance.get("best_summary_url"):
        links.append(f'<a href="{escape(instance["best_summary_url"])}">Best submission</a>')
    return " ".join(links) if links else ""


def render_instances(dataset: dict[str, Any]) -> str:
    instances = dataset["instances"]
    problem_options = [(problem["name"], problem["title"]) for problem in dataset["problems"]]
    status_counts = Counter(instance["status"] for instance in instances)
    stats = "\n".join(
        [
            stat_card("Instances", format_count(len(instances))),
            stat_card("Optimal", format_count(status_counts["optimal"])),
            stat_card("Best known", format_count(status_counts["best_known"])),
            stat_card("Open", format_count(status_counts["open"])),
        ]
    )
    rows = []
    for instance in instances:
        search_text = " ".join(
            [
                instance["instance"],
                instance["problem_title"],
                instance.get("family", ""),
                instance.get("best_submitter", ""),
                instance.get("best_submission", ""),
                instance.get("format", ""),
                instance.get("why_care", ""),
                instance.get("paper_context", ""),
            ]
        ).lower()
        context_line = (
            f'<span class="paper-context">Paper: {escape(instance["paper_context"])}</span>'
            if instance.get("paper_context")
            else ""
        )
        rows.append(
            f"""<tr data-problem="{escape(instance["problem_dir"])}" data-status="{escape(instance["status"])}" data-search="{escape(search_text)}">
  <td>{escape(instance["instance"])}</td>
  <td><a href="../problems/{escape(instance["problem_dir"])}/">{escape(instance["problem_title"])}</a></td>
  <td>{escape(instance.get("why_care", ""))}{context_line}</td>
  <td>{escape(instance.get("family", ""))}</td>
  <td>{escape(instance.get("format", ""))}</td>
  <td><span class="status-tag status-{escape(instance["status"])}">{escape(instance["status_label"])}</span></td>
  <td data-sort="{escape("" if instance.get("best_numeric") is None else instance["best_numeric"])}">{escape(instance.get("best_value", ""))}</td>
  <td>{escape(instance.get("best_submitter", ""))}</td>
  <td data-sort="{escape(instance.get("submission_count", 0))}">{format_count(instance.get("submission_count", 0))}</td>
  <td>{source_links_for_instance(instance)}</td>
</tr>"""
        )

    body = f"""    <section class="page-title">
      <p class="eyebrow">Benchmark data</p>
      <h1>Instance browser</h1>
      <p>Repository instances, known solution-status markers, and submitted results in one searchable table.</p>
    </section>
    <section class="stats-grid section-stats">{stats}</section>
    {render_submit_callout(dataset, "Submit results for an instance")}
    <section class="filters" data-filter-scope="instances" aria-label="Instance filters">
      <label>
        Search
        <input type="search" data-search placeholder="Instance, problem, submitter">
      </label>
      <label>
        Problem
        <select data-problem-filter>
          <option value="">All problems</option>
          {"".join(f'<option value="{escape(name)}">{escape(title)}</option>' for name, title in problem_options)}
        </select>
      </label>
      <label>
        Status
        <select data-status-filter>
          <option value="">All statuses</option>
          <option value="optimal">Optimal</option>
          <option value="best_known">Best known</option>
          <option value="submitted">Submitted</option>
          <option value="open">Open</option>
        </select>
      </label>
      <output data-result-count data-result-label="instances">{format_count(len(instances))} instances</output>
    </section>
    <div class="table-wrap">
      <table class="data-table instance-table" data-filter-table="instances" data-sort-table>
        <thead>
          <tr>
            <th>Instance</th>
            <th>Problem</th>
            <th>Why benchmark it</th>
            <th>Family</th>
            <th>Format</th>
            <th>Status</th>
            <th>Best submitted objective</th>
            <th>Submitter</th>
            <th>Rows</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>{"".join(rows)}</tbody>
      </table>
    </div>
"""
    return page_layout("Instances", body, 1, dataset)


def render_leaderboard(dataset: dict[str, Any]) -> str:
    entries = dataset["leaderboard"]
    problem_options = [(problem["name"], problem["title"]) for problem in dataset["problems"]]
    ranked_instances = len({(entry["problem_dir"], entry["instance"]) for entry in entries})
    submitters = len({entry["submitter"] for entry in entries if entry["submitter"]})
    stats = "\n".join(
        [
            stat_card("Ranked entries", format_count(len(entries))),
            stat_card("Ranked instances", format_count(ranked_instances)),
            stat_card("Submitters", format_count(submitters)),
            stat_card("Problem classes", format_count(len({entry["problem_dir"] for entry in entries}))),
        ]
    )
    rows = []
    for entry in entries:
        search_text = " ".join(
            [
                entry["instance"],
                entry["problem_title"],
                entry["submitter"],
                entry["submission_set"],
                entry["modeling"],
                entry["algorithm"],
            ]
        ).lower()
        rows.append(
            f"""<tr data-problem="{escape(entry["problem_dir"])}" data-search="{escape(search_text)}">
  <td data-sort="{escape(entry["rank"])}">{escape(entry["rank"])}</td>
  <td>{escape(entry["instance"])}</td>
  <td><a href="../problems/{escape(entry["problem_dir"])}/">{escape(entry["problem_title"])}</a></td>
  <td data-sort="{escape(entry["numeric_objective"])}">{escape(entry["objective"])}</td>
  <td>{escape(entry["direction"])}</td>
  <td>{escape(entry["submitter"])}</td>
  <td data-sort="{escape(entry["date_key"])}">{escape(entry["date"])}</td>
  <td>{escape(entry["modeling"])}</td>
  <td>{escape(entry["algorithm"])}</td>
  <td><a href="{escape(entry["summary_url"])}">CSV</a></td>
</tr>"""
        )

    body = f"""    <section class="page-title">
      <p class="eyebrow">Community results</p>
      <h1>Leaderboard</h1>
      <p>Numeric submitted objectives ranked per problem instance, using each problem class objective direction.</p>
    </section>
    <section class="stats-grid section-stats">{stats}</section>
    {render_submit_callout(dataset, "Add a result to the leaderboard")}
    <section class="filters" data-filter-scope="leaderboard" aria-label="Leaderboard filters">
      <label>
        Search
        <input type="search" data-search placeholder="Instance, submitter, algorithm">
      </label>
      <label>
        Problem
        <select data-problem-filter>
          <option value="">All problems</option>
          {"".join(f'<option value="{escape(name)}">{escape(title)}</option>' for name, title in problem_options)}
        </select>
      </label>
      <output data-result-count data-result-label="entries">{format_count(len(entries))} entries</output>
    </section>
    <div class="table-wrap">
      <table class="data-table" data-filter-table="leaderboard" data-sort-table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Instance</th>
            <th>Problem</th>
            <th>Objective</th>
            <th>Direction</th>
            <th>Submitter</th>
            <th>Date</th>
            <th>Model</th>
            <th>Algorithm</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>{"".join(rows)}</tbody>
      </table>
    </div>
"""
    return page_layout("Leaderboard", body, 1, dataset)


def render_problem_page(problem: dict[str, Any], dataset: dict[str, Any]) -> str:
    results = [result for result in dataset["results"] if result["problem_dir"] == problem["name"]]
    sets = [submission_set for submission_set in dataset["submission_sets"] if submission_set["problem_dir"] == problem["name"]]
    counts = problem["counts"]
    stats = "\n".join(
        [
            stat_card("Instances", format_count(counts["instances"])),
            stat_card("Model files", format_count(counts["model_files"])),
            stat_card("Solution files", format_count(counts["solution_files"])),
            stat_card("Result rows", format_count(counts["results"])),
        ]
    )
    quick_links = []
    for label, key in (
        ("README", "README.md"),
        ("Instances", "instances"),
        ("Models", "models"),
        ("Solutions", "solutions"),
        ("Submissions", "submissions"),
        ("Checkers", "check"),
    ):
        url = problem["links"].get(key)
        if url:
            quick_links.append(f'<a class="button" href="{escape(url)}">{escape(label)}</a>')

    body = f"""    <section class="page-title problem-title">
      <p class="eyebrow">Problem class {escape(problem["number"])}</p>
      <h1>{escape(problem["title"])}</h1>
      <p>{escape(problem["description"])}</p>
      <p>{escape(problem["why_care"])}</p>
      <div class="hero-actions">{"".join(quick_links)}</div>
    </section>
    <section class="stats-grid section-stats">{stats}</section>
    <section class="callout">
      <div>
        <p class="eyebrow">Why benchmark these instances</p>
        <h2>{escape(problem["short"])}</h2>
        <p>{escape(problem["instance_interest"])}</p>
      </div>
      <div class="callout-actions">
        <a class="button primary" href="../../instances/">Browse all instances</a>
        <a class="button" href="../../leaderboard/">Compare results</a>
      </div>
    </section>
    {render_submit_callout(dataset, f"Submit a {problem['short']} result")}
    <section class="section">
      <div class="section-heading">
        <h2>Submission sets</h2>
        <p>Top-level community submission directories for this problem class.</p>
      </div>
      {render_submission_sets(sets)}
    </section>
    <section class="section">
      <div class="section-heading">
        <h2>Result rows</h2>
        <p>Parsed instance-level summary CSV rows for this problem class.</p>
      </div>
      {submissions_table(results, 2)}
    </section>
"""
    return page_layout(problem["title"], body, 2, dataset)


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def prepare_output_dir(root: Path, out_dir: Path) -> Path:
    root = root.resolve()
    out_dir = out_dir.resolve()
    if out_dir == root or out_dir == out_dir.parent:
        raise ValueError(f"Refusing to use unsafe output directory: {out_dir}")
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)
    return out_dir


def copy_static_assets(root: Path, out_dir: Path) -> list[dict[str, str]]:
    asset_dir = out_dir / "assets"
    asset_dir.mkdir(parents=True, exist_ok=True)
    source_asset_dir = root / "misc" / "site_assets"
    if source_asset_dir.is_dir():
        for source in sorted(source_asset_dir.iterdir()):
            if source.is_file():
                shutil.copy2(source, asset_dir / source.name)

    copied_images: list[dict[str, str]] = []
    image_out_dir = asset_dir / "images"
    for source_rel in PAPER_IMAGE_PATHS:
        source = root / source_rel
        if not source.exists():
            continue
        image_out_dir.mkdir(parents=True, exist_ok=True)
        target = image_out_dir / source.name
        shutil.copy2(source, target)
        copied_images.append(
            {
                "source_path": source_rel.as_posix(),
                "asset_path": f"assets/images/{source.name}",
            }
        )
    return copied_images


def write_site(root: Path, out_dir: Path, dataset: dict[str, Any]) -> None:
    write_text(out_dir / "index.html", render_home(dataset))
    write_text(out_dir / "instances" / "index.html", render_instances(dataset))
    write_text(out_dir / "submissions" / "index.html", render_submissions(dataset))
    write_text(out_dir / "leaderboard" / "index.html", render_leaderboard(dataset))
    for problem in dataset["problems"]:
        write_text(out_dir / "problems" / problem["name"] / "index.html", render_problem_page(problem, dataset))
    write_text(out_dir / "assets" / "qoblib-data.json", json.dumps(dataset, indent=2, sort_keys=True) + "\n")
    write_text(out_dir / ".nojekyll", "")


def build_site(
    root: Path,
    out_dir: Path,
    repo_url: str = DEFAULT_REPO_URL,
    ref: str = DEFAULT_REF,
    generated_at: str | None = None,
) -> dict[str, Any]:
    root = root.resolve()
    out_dir = prepare_output_dir(root, out_dir)
    dataset = build_dataset(root, repo_url, ref, generated_at)
    dataset["images"] = copy_static_assets(root, out_dir)
    write_site(root, out_dir, dataset)
    return dataset


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True, type=Path, help="Output directory for generated site files.")
    parser.add_argument("--repo-url", default=DEFAULT_REPO_URL, help="Repository URL used for source links.")
    parser.add_argument("--ref", default=DEFAULT_REF, help="Git ref used for source links.")
    parser.add_argument("--root", default=Path(__file__).resolve().parents[1], type=Path, help="QOBLIB repository root.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    dataset = build_site(args.root, args.out, args.repo_url, args.ref)
    print(
        "Built QOBLIB site with "
        f"{dataset['counts']['problems']} problems, "
        f"{dataset['counts']['instances']} instances, "
        f"{dataset['counts']['submission_sets']} submission sets, "
        f"{dataset['counts']['results']} result rows, "
        f"{dataset['counts']['leaderboard_entries']} leaderboard entries."
    )
    if dataset["warnings"]:
        print(f"Warnings: {len(dataset['warnings'])}")
        for warning in dataset["warnings"]:
            print(f"  - {warning}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
