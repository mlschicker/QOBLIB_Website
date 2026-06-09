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
from collections import defaultdict
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


def problem_info(root: Path) -> dict[str, dict[str, str]]:
    table_info = parse_problem_table(root)
    info: dict[str, dict[str, str]] = {}
    for problem_dir in problem_dirs(root):
        table = table_info.get(problem_dir.name, {})
        number = table.get("number") or problem_dir.name.split("-", 1)[0]
        title = table.get("title") or read_problem_heading(problem_dir)
        description = table.get("description") or ""
        info[problem_dir.name] = {
            "number": number,
            "title": title,
            "description": description,
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
                    "result_count": len(group),
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
    generated = generated_at or dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    counts = {
        "problems": len(problem_entries),
        "submission_sets": len(submission_sets),
        "results": len(results),
        "instances": sum(problem["counts"]["instances"] for problem in problem_entries),
    }
    return {
        "generated_at": generated,
        "repo_url": repo_url.rstrip("/"),
        "ref": ref,
        "template_columns": columns,
        "counts": counts,
        "problems": problem_entries,
        "submission_sets": submission_sets,
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
        <a href="{prefix}submissions/">Submissions</a>
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


def render_home(dataset: dict[str, Any]) -> str:
    counts = dataset["counts"]
    stats = "\n".join(
        [
            stat_card("Problem classes", format_count(counts["problems"])),
            stat_card("Instance groups", format_count(counts["instances"])),
            stat_card("Submission sets", format_count(counts["submission_sets"])),
            stat_card("Result rows", format_count(counts["results"])),
        ]
    )

    problem_cards = []
    for problem in dataset["problems"]:
        problem_counts = problem["counts"]
        problem_cards.append(
            f"""<article class="problem-card">
  <div class="problem-number">{escape(problem["number"])}</div>
  <h3><a href="{escape(problem["page"])}">{escape(problem["title"])}</a></h3>
  <p>{escape(problem["description"])}</p>
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
          <a class="button primary" href="submissions/">Browse submissions</a>
          <a class="button" href="{escape(dataset["repo_url"])}">View repository</a>
        </div>
      </div>
      <div class="stats-grid">{stats}</div>
    </section>
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


def submissions_table(results: list[dict[str, Any]], depth: int) -> str:
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
  <td>{escape(fields.get("Date", ""))}</td>
  <td>{escape(fields.get("Best Objective Value", ""))}</td>
  <td>{escape(fields.get("Modeling Approach", ""))}</td>
  <td>{escape(fields.get("Algorithm Type", ""))}</td>
  <td>{escape(fields.get("Total Runtime", ""))}</td>
  <td><a href="{escape(result["summary_url"])}">CSV</a></td>
</tr>"""
        )

    return f"""<div class="table-wrap">
  <table class="data-table" data-filter-table>
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
    modeling_options = sorted({result["fields"].get("Modeling Approach", "") for result in results if result["fields"].get("Modeling Approach", "")})
    algorithm_options = sorted({result["fields"].get("Algorithm Type", "") for result in results if result["fields"].get("Algorithm Type", "")})
    problem_options = [(problem["name"], problem["title"]) for problem in dataset["problems"]]
    body = f"""    <section class="page-title">
      <p class="eyebrow">Community results</p>
      <h1>Instance submissions</h1>
      <p>{format_count(len(results))} parsed result rows from canonical QOBLIB summary CSV files.</p>
    </section>
    <section class="filters" aria-label="Submission filters">
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
      <output data-result-count>{format_count(len(results))} rows</output>
    </section>
    {submissions_table(results, 1)}
"""
    return page_layout("Submissions", body, 1, dataset)


def render_submission_sets(sets: list[dict[str, Any]]) -> str:
    rows = []
    for submission_set in sets:
        rows.append(
            f"""<tr>
  <td>{escape(submission_set["name"])}</td>
  <td>{format_count(submission_set["instance_count"])}</td>
  <td>{format_count(submission_set["result_count"])}</td>
  <td>{escape(submission_set["date_key"][:10])}</td>
  <td><a href="{escape(submission_set["source_url"])}">Directory</a></td>
</tr>"""
        )
    return f"""<div class="table-wrap">
  <table class="data-table compact-table">
    <thead><tr><th>Submission set</th><th>Instance dirs</th><th>Result rows</th><th>Date key</th><th>Source</th></tr></thead>
    <tbody>{"".join(rows)}</tbody>
  </table>
</div>"""


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
      <div class="hero-actions">{"".join(quick_links)}</div>
    </section>
    <section class="stats-grid section-stats">{stats}</section>
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
    write_text(out_dir / "submissions" / "index.html", render_submissions(dataset))
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
        f"{dataset['counts']['submission_sets']} submission sets, "
        f"{dataset['counts']['results']} result rows."
    )
    if dataset["warnings"]:
        print(f"Warnings: {len(dataset['warnings'])}")
        for warning in dataset["warnings"]:
            print(f"  - {warning}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
