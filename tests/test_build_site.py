from __future__ import annotations

import csv
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "misc" / "build_site.py"
SPEC = importlib.util.spec_from_file_location("build_site", MODULE_PATH)
build_site = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(build_site)


CANONICAL_COLUMNS = [
    "Problem",
    "Submitter",
    "Date",
    "Reference",
    "Best Objective Value",
    "Optimality Bound",
    "Modeling Approach",
    "# Decision Variables",
    "# Binary Variables",
    "# Integer Variables",
    "# Continuous Variables",
    "# Non-Zero Coefficients",
    "Coefficients Type",
    "Coefficients Range",
    "Workflow",
    "Algorithm Type",
    "# Runs",
    "# Feasible Runs",
    "# Successful Runs",
    "Success Threshold",
    "Hardware Specifications",
    "Total Runtime",
    "CPU Runtime",
    "GPU Runtime",
    "QPU Runtime",
    "Other HW Runtime",
    "Remarks",
]


class BuildSiteTests(unittest.TestCase):
    def make_fixture(self, root: Path) -> None:
        (root / "misc").mkdir(parents=True)
        (root / "misc" / "submission_template.csv").write_text(
            "\ufeff" + ",".join(CANONICAL_COLUMNS) + "\n",
            encoding="utf-8",
        )
        (root / "README.md").write_text(
            "\n".join(
                [
                    "# QOBLIB",
                    "",
                    "| # | Problem Class | Description | Link |",
                    "| --- | --- | --- | --- |",
                    "| 01 | **Demo Problem** | Synthetic benchmark class | [Details](01-demo) |",
                    "",
                ]
            ),
            encoding="utf-8",
        )

        problem = root / "01-demo"
        for child in ("instances", "models", "solutions", "check"):
            (problem / child).mkdir(parents=True)
        (problem / "README.md").write_text("# 01 - Demo Problem\n", encoding="utf-8")
        (problem / "instances" / "demo001.dat").write_text("instance\n", encoding="utf-8")
        (problem / "models" / "demo001.lp").write_text("model\n", encoding="utf-8")
        (problem / "solutions" / "demo001.sol").write_text("solution\n", encoding="utf-8")

        sparse_set = problem / "submissions" / "20260202_Notes_Only"
        sparse_set.mkdir(parents=True)
        (sparse_set / "README.md").write_text("# Notes only\n", encoding="utf-8")

        result_dir = problem / "submissions" / "20260101_Method_Author" / "demo001"
        result_dir.mkdir(parents=True)
        row = {column: "N/A" for column in CANONICAL_COLUMNS}
        row.update(
            {
                "Problem": "demo001",
                "Submitter": "Ada Example",
                "Date": "2026-01-02 03:04:05",
                "Reference": "https://example.invalid/method",
                "Best Objective Value": "42",
                "Optimality Bound": "40",
                "Modeling Approach": "Binary Linear Program",
                "# Decision Variables": "10",
                "# Binary Variables": "10",
                "# Integer Variables": "0",
                "# Continuous Variables": "0",
                "# Non-Zero Coefficients": "55",
                "Coefficients Type": "Integer",
                "Coefficients Range": "1 - 9",
                "Workflow": "Generate, solve, validate",
                "Algorithm Type": "Deterministic",
                "# Runs": "1",
                "# Feasible Runs": "1",
                "# Successful Runs": "1",
                "Success Threshold": "0",
                "Hardware Specifications": "Local test machine",
                "Total Runtime": "0.1",
                "CPU Runtime": "0.1",
                "GPU Runtime": "N/A",
                "QPU Runtime": "N/A",
                "Other HW Runtime": "N/A",
                "Remarks": "Fixture row",
            }
        )
        with (result_dir / "demo001_summary.csv").open("w", newline="", encoding="utf-8") as file:
            writer = csv.DictWriter(file, fieldnames=CANONICAL_COLUMNS)
            writer.writeheader()
            writer.writerow(row)

    def test_template_header_uses_utf8_sig(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.make_fixture(root)
            self.assertEqual(build_site.read_template_columns(root), CANONICAL_COLUMNS)

    def test_sparse_submission_readmes_do_not_fail(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.make_fixture(root)
            dataset = build_site.build_dataset(
                root,
                repo_url="https://github.com/example/QOBLIB",
                ref="main",
                generated_at="2026-01-01T00:00:00Z",
            )
            self.assertEqual(len(dataset["results"]), 1)
            self.assertEqual(len(dataset["submission_sets"]), 2)
            sparse = [item for item in dataset["submission_sets"] if item["name"] == "20260202_Notes_Only"][0]
            self.assertEqual(sparse["result_count"], 0)

    def test_build_site_outputs_expected_pages_and_data(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "repo"
            out = Path(tmp) / "site"
            root.mkdir()
            self.make_fixture(root)
            build_site.build_site(
                root,
                out,
                repo_url="https://github.com/example/QOBLIB",
                ref="main",
                generated_at="2026-01-01T00:00:00Z",
            )
            self.assertTrue((out / "index.html").is_file())
            self.assertTrue((out / "submissions" / "index.html").is_file())
            self.assertTrue((out / "problems" / "01-demo" / "index.html").is_file())
            data = json.loads((out / "assets" / "qoblib-data.json").read_text(encoding="utf-8"))
            self.assertEqual(data["generated_at"], "2026-01-01T00:00:00Z")
            self.assertEqual(data["counts"]["results"], 1)
            self.assertEqual(data["problems"][0]["title"], "Demo Problem")

    def test_source_links_use_repository_blob_paths(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.make_fixture(root)
            dataset = build_site.build_dataset(root, repo_url="https://github.com/example/QOBLIB", ref="main")
            result = dataset["results"][0]
            self.assertEqual(
                result["summary_csv"],
                "01-demo/submissions/20260101_Method_Author/demo001/demo001_summary.csv",
            )
            self.assertEqual(
                result["summary_url"],
                "https://github.com/example/QOBLIB/blob/main/01-demo/submissions/20260101_Method_Author/demo001/demo001_summary.csv",
            )


if __name__ == "__main__":
    unittest.main()
