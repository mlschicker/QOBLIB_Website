"use strict";

const {
    esc: qEsc,
    fmtBytes: qFmtBytes,
    fmtNum: qFmtNum,
    loadIndex: qLoadIndex,
    loadProblemData: qLoadProblemData,
    instanceUrl: qInstanceUrl,
    problemUrl: qProblemUrl,
    statusPill: qStatusPill,
    modelLinks: qModelLinks,
    showError: qShowError,
    initCommon: qInitCommon,
    downloadCsv: qDownloadCsv,
} = window.QOBLIB;

let allInstances = [];
let visibleMipModels = new Set();

const PROBLEM_COLORS = {
    "01": { fill: "#2E6F95", stroke: "#1C4A65" },
    "02": { fill: "#B85C38", stroke: "#7D3D25" },
    "03": { fill: "#5D8A66", stroke: "#3E5F45" },
    "04": { fill: "#7A6EA8", stroke: "#514A75" },
    "05": { fill: "#C58A24", stroke: "#875E17" },
    "06": { fill: "#3F8D7E", stroke: "#2A6156" },
    "07": { fill: "#A14F7A", stroke: "#6D3552" },
    "08": { fill: "#4E7FB9", stroke: "#34577E" },
    "09": { fill: "#B66A46", stroke: "#7E4931" },
    "10": { fill: "#6F9E44", stroke: "#4D6D30" },
};

function colorForProblem(problemId) {
    return PROBLEM_COLORS[String(problemId || "").padStart(2, "0")] || { fill: "#1f6f6c", stroke: "#0e4f4d" };
}

function prettyModelLabel(label) {
    return String(label || "model")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function modelKeyForPoint(point) {
    return `${String(point.problem_id || "").padStart(2, "0")}::${String(point.model_approach || point.model_kind || point.model_label || "model")}`;
}

function renderProblemLegend(points) {
    const legendRoot = document.getElementById("mip-chart-legend");
    if (!legendRoot) return;

    const classInfo = new Map();
    points.forEach((point) => {
        const pid = String(point.problem_id || "").padStart(2, "0");
        const modelLabel = prettyModelLabel(point.model_approach || point.model_kind || point.model_label || "model");
        const key = modelKeyForPoint(point);
        if (!pid || !modelLabel || classInfo.has(key)) return;
        classInfo.set(key, { pid, model: modelLabel });
    });

    const keys = [...classInfo.keys()].sort((a, b) => a.localeCompare(b));
    if (!keys.length) {
        legendRoot.innerHTML = "";
        return;
    }

    if (!visibleMipModels.size) {
        visibleMipModels = new Set(keys);
    }

    legendRoot.innerHTML = keys
        .map((key) => {
            const meta = classInfo.get(key) || {};
            const color = colorForProblem(meta.pid);
            const active = visibleMipModels.has(key);
            return `
                <button type="button" class="legend-item${active ? " on" : " off"}" data-model-key="${qEsc(key)}" aria-pressed="${active ? "true" : "false"}">
                    <span class="dot" style="background:${qEsc(color.fill)};border-color:${qEsc(color.stroke)}"></span>
                    <span class="legend-text"><strong>${qEsc(meta.pid)}</strong> ${qEsc(meta.model || "model")}</span>
                </button>`;
        })
        .join("");

    legendRoot.querySelectorAll(".legend-item").forEach((button) => {
        button.addEventListener("click", () => {
            const key = String(button.dataset.modelKey || "");
            if (!key) return;
            const allVisible = keys.every((itemKey) => visibleMipModels.has(itemKey));
            if (allVisible) {
                visibleMipModels = new Set([key]);
            } else if (visibleMipModels.has(key)) {
                visibleMipModels.delete(key);
                if (!visibleMipModels.size) {
                    visibleMipModels = new Set(keys);
                }
            } else {
                visibleMipModels.add(key);
            }
            updateMipPointVisibility();
        });
    });
}

function updateMipPointVisibility() {
    const root = document.getElementById("mip-chart");
    const legendRoot = document.getElementById("mip-chart-legend");
    if (!root || !legendRoot) return;

    root.querySelectorAll(".mip-point").forEach((point) => {
        const key = String(point.dataset.modelKey || "");
        point.classList.toggle("hidden", !visibleMipModels.has(key));
    });

    legendRoot.querySelectorAll(".legend-item").forEach((button) => {
        const key = String(button.dataset.modelKey || "");
        const active = visibleMipModels.has(key);
        button.classList.toggle("on", active);
        button.classList.toggle("off", !active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
    });
}

function normalizePortfolioLambda(name) {
    return String(name || "")
        .replaceAll("_l0.000001", "_l1e-06")
        .replaceAll("_l0.00001", "_l1e-05")
        .replaceAll("_l0.00005", "_l5e-05")
        .replace(/_l0$/, "_l0.0");
}

function modelStemFromName(name) {
    const base = String(name || "").replace(/\.(xz|gz|bz2)$/i, "").replace(/\.(lp|mps)$/i, "");
    return normalizePortfolioLambda(base.replace(/^bqp_/, "").replace(/^uqo_/, ""));
}

function metricsUrlFromModelUrl(modelUrl) {
    try {
        const url = new URL(modelUrl, window.location.href);
        const parts = url.pathname.split("/").filter(Boolean);
        const metricDirIdx = parts.findIndex((part) => part === "lp_files" || part === "qs_files");
        if (metricDirIdx >= 0) {
            url.pathname = `/${parts.slice(0, metricDirIdx + 1).join("/")}/metrics.csv`;
            return url.toString();
        }
        url.pathname = `/${parts.slice(0, -1).join("/")}/metrics.csv`;
        return url.toString();
    } catch {
        return String(modelUrl || "").replace(/\/[^/]+$/, "/metrics.csv");
    }
}

function csvToRows(text) {
    const lines = String(text || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    if (!lines.length) return [];

    const parseLine = (line) => {
        const cells = [];
        let cur = "";
        let quoted = false;
        for (let i = 0; i < line.length; i += 1) {
            const ch = line[i];
            if (ch === '"') {
                if (quoted && line[i + 1] === '"') {
                    cur += '"';
                    i += 1;
                } else {
                    quoted = !quoted;
                }
            } else if (ch === "," && !quoted) {
                cells.push(cur);
                cur = "";
            } else {
                cur += ch;
            }
        }
        cells.push(cur);
        return cells;
    };

    const header = parseLine(lines[0]).map((h) => h.trim());
    return lines.slice(1).map((line) => {
        const cells = parseLine(line);
        const row = {};
        header.forEach((h, idx) => {
            row[h] = (cells[idx] || "").trim();
        });
        return row;
    });
}

function formatDensity(v) {
    if (!Number.isFinite(v)) return "-";
    if (v === 0) return "0";
    if (Math.abs(v) < 1e-4) return v.toExponential(2);
    return v.toLocaleString(undefined, { maximumSignificantDigits: 5 });
}

async function loadMetricsMaps(instances) {
    const metricsUrls = new Set();
    instances.forEach((inst) => {
        (inst.models || [])
            .filter((m) => m.kind === "lp" && typeof m.raw_url === "string")
            .forEach((m) => {
                const csvUrl = metricsUrlFromModelUrl(m.raw_url);
                metricsUrls.add(csvUrl);
            });
    });

    const entries = await Promise.all(
        [...metricsUrls].map(async (url) => {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const rows = csvToRows(await response.text());
                const metricsByStem = new Map();
                rows.forEach((row) => {
                    const fileCell = row.file || "";
                    const stem = modelStemFromName(fileCell);
                    const numVars = Number(row.num_vars);
                    const density = Number(row.density);
                    if (!stem || !Number.isFinite(numVars) || !Number.isFinite(density)) return;
                    metricsByStem.set(stem, {
                        num_vars: numVars,
                        density,
                    });
                });
                return [url, metricsByStem];
            } catch {
                return [url, new Map()];
            }
        }),
    );
    return new Map(entries);
}

async function buildMipPoints(instances) {
    const metricsMaps = await loadMetricsMaps(instances);
    const points = [];

    instances.forEach((inst) => {
        (inst.models || [])
            .filter((m) => m.kind === "lp" && m.raw_url)
            .forEach((model, modelIndex) => {
                const csvUrl = metricsUrlFromModelUrl(model.raw_url);
                const rowMap = metricsMaps.get(csvUrl);
                if (!rowMap) return;

                const stem = modelStemFromName(model.name || model.raw_url.split("/").pop() || "");
                const metric = rowMap.get(stem);
                if (!metric) return;

                points.push({
                    problem_id: inst.problem_id,
                    problem_name: inst.problem_name,
                    name: inst.name,
                    num_vars: metric.num_vars,
                    density: metric.density,
                    model_approach: model.approach || model.kind || "model",
                    model_kind: model.kind || "model",
                    model_label: model.name || stem,
                    model_index: modelIndex,
                    model_key: `${String(inst.problem_id || "").padStart(2, "0")}::${String(model.approach || model.kind || "model")}`,
                });
            });
    });

    return points;
}

function renderMipChart(points) {
    const root = document.getElementById("mip-chart");
    if (!root) return;

    const positivePoints = points.filter((p) => p.num_vars > 0 && p.density > 0);
    visibleMipModels = new Set([...new Set(positivePoints.map((p) => p.model_key).filter(Boolean))]);
    renderProblemLegend(positivePoints);

    if (!positivePoints.length) {
        root.innerHTML = '<div class="empty-state" style="padding:2rem">No LP metrics found for the current dataset.</div>';
        return;
    }

    const width = 940;
    const height = 460;
    const margin = { top: 16, right: 18, bottom: 52, left: 68 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;

    const log10 = (v) => Math.log(v) / Math.log(10);

    const xMinRaw = Math.min(...positivePoints.map((p) => p.num_vars));
    const xMaxRaw = Math.max(...positivePoints.map((p) => p.num_vars));
    const yMinRaw = Math.min(...positivePoints.map((p) => p.density));
    const yMaxRaw = Math.max(...positivePoints.map((p) => p.density));

    const xMinPow = Math.floor(log10(xMinRaw));
    const xMaxPow = Math.ceil(log10(xMaxRaw));
    const yMinPow = Math.floor(log10(yMinRaw));
    const yMaxPow = Math.ceil(log10(yMaxRaw));

    const xMin = 10 ** xMinPow;
    const xMax = 10 ** xMaxPow;
    const yMin = 10 ** yMinPow;
    const yMax = 10 ** yMaxPow;

    const xRange = Math.max(1e-12, log10(xMax) - log10(xMin));
    const yRange = Math.max(1e-12, log10(yMax) - log10(yMin));

    const xPos = (v) => margin.left + ((log10(v) - log10(xMin)) / xRange) * plotW;
    const yPos = (v) => margin.top + (1 - (log10(v) - log10(yMin)) / yRange) * plotH;

    const buildLogTicks = (pMin, pMax) => {
        const ticks = [];
        for (let p = pMin; p <= pMax; p += 1) ticks.push(10 ** p);
        if (ticks.length <= 8) return ticks;
        const step = Math.ceil(ticks.length / 8);
        return ticks.filter((_, idx) => idx % step === 0 || idx === ticks.length - 1);
    };

    const formatLogTick = (v) => {
        const p = Math.round(log10(v));
        if (p >= -2 && p <= 4) return qFmtNum(v);
        return `1e${p}`;
    };

    const xTickValues = buildLogTicks(xMinPow, xMaxPow);
    const yTickValues = buildLogTicks(yMinPow, yMaxPow);

    const gridX = xTickValues
        .map((v) => `<line class="mip-grid-line" x1="${xPos(v)}" y1="${margin.top}" x2="${xPos(v)}" y2="${height - margin.bottom}" />`)
        .join("");
    const gridY = yTickValues
        .map((v) => `<line class="mip-grid-line" x1="${margin.left}" y1="${yPos(v)}" x2="${width - margin.right}" y2="${yPos(v)}" />`)
        .join("");
    const labelsX = xTickValues
        .map((v) => `<text class="mip-axis-tick" text-anchor="middle" x="${xPos(v)}" y="${height - margin.bottom + 15}">${qEsc(formatLogTick(v))}</text>`)
        .join("");
    const labelsY = yTickValues
        .map((v) => `<text class="mip-axis-tick" text-anchor="end" x="${margin.left - 8}" y="${yPos(v) + 3}">${qEsc(formatLogTick(v))}</text>`)
        .join("");

    const circles = positivePoints
        .map((p, idx) => {
            const href = qInstanceUrl(p.problem_id, p.name);
            const color = colorForProblem(p.problem_id);
            return `
                <circle
                    class="mip-point"
                    id="mip-point-${idx}"
                    data-idx="${idx}"
                    data-name="${qEsc(p.name)}"
                    data-problem="${qEsc(p.problem_id)}"
                    data-model-key="${qEsc(p.model_key || modelKeyForPoint(p))}"
                    data-vars="${p.num_vars}"
                    data-density="${p.density}"
                    data-model="${qEsc(p.model_approach || p.model_kind || "model")}"
                    data-url="${qEsc(href)}"
                    cx="${xPos(p.num_vars)}"
                    cy="${yPos(p.density)}"
                    style="--p-fill:${qEsc(color.fill)};--p-stroke:${qEsc(color.stroke)}"
                    r="4"
                    tabindex="0"
                    role="link"
                    aria-label="${qEsc(p.name)}"
                ></circle>`;
        })
        .join("");

    root.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" aria-label="MIP instance scatter plot">
            ${gridX}
            ${gridY}
            <line class="mip-axis-line" x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" />
            <line class="mip-axis-line" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" />
            ${labelsX}
            ${labelsY}
            <text class="mip-axis-label" text-anchor="middle" x="${margin.left + plotW / 2}" y="${height - 10}">Number of Variables (log scale)</text>
            <text class="mip-axis-label" text-anchor="middle" transform="translate(16 ${margin.top + plotH / 2}) rotate(-90)">Density (log scale)</text>
            ${circles}
        </svg>
        <div class="mip-tooltip" id="mip-tooltip">
            <div class="mip-tooltip-title">Hover or focus a point</div>
            <div class="mip-tooltip-row"><span>Instance</span><strong>-</strong></div>
            <div class="mip-tooltip-row"><span>Variables</span><strong>-</strong></div>
            <div class="mip-tooltip-row"><span>Density</span><strong>-</strong></div>
        </div>`;

    const tooltip = document.getElementById("mip-tooltip");
    const pointsEls = Array.from(root.querySelectorAll(".mip-point"));

    const activatePoint = (el) => {
        pointsEls.forEach((pEl) => pEl.classList.remove("active"));
        el.classList.add("active");
        tooltip.innerHTML = `
            <div class="mip-tooltip-title">${qEsc(el.dataset.name || "")}</div>
            <div class="mip-tooltip-row"><span>Problem</span><strong>${qEsc(el.dataset.problem || "")}</strong></div>
            <div class="mip-tooltip-row"><span>Model</span><strong>${qEsc(prettyModelLabel(el.dataset.model || "model"))}</strong></div>
            <div class="mip-tooltip-row"><span>Variables</span><strong>${qEsc(qFmtNum(Number(el.dataset.vars || 0)))}</strong></div>
            <div class="mip-tooltip-row"><span>Density</span><strong>${qEsc(formatDensity(Number(el.dataset.density || 0)))}</strong></div>`;
    };

    pointsEls.forEach((el) => {
        el.addEventListener("mouseenter", () => activatePoint(el));
        el.addEventListener("focus", () => activatePoint(el));
        el.addEventListener("click", () => {
            const href = el.dataset.url;
            if (href) window.location.href = href;
        });
        el.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                const href = el.dataset.url;
                if (href) window.location.href = href;
            }
        });
    });

    if (pointsEls[0]) activatePoint(pointsEls[0]);
    updateMipPointVisibility();
}

async function initInstancesPage() {
    qInitCommon();
    try {
        const idx = await qLoadIndex();
        const filter = document.getElementById("i-prob");
        (idx.problems || []).forEach((p) => {
            const o = document.createElement("option");
            o.value = p.id;
            o.textContent = `${String(p.id).padStart(2, "0")} - ${p.name}`;
            filter.appendChild(o);
        });

        const problems = await Promise.all((idx.problems || []).map((p) => qLoadProblemData(p.id)));
        allInstances = problems.flatMap((p) => {
            const cols = Array.isArray(p.columns) ? p.columns : [];
            return (p.instances || []).map((inst) => ({
                ...inst,
                problem_id: p.id,
                problem_name: p.name,
                metrics_text: cols
                    .filter((c) => inst.metrics && inst.metrics[c.key] != null && inst.metrics[c.key] !== "")
                    .map((c) => `${qEsc(c.label)} ${c.numeric ? qFmtNum(inst.metrics[c.key]) : qEsc(inst.metrics[c.key])}`)
                    .join(" · "),
                metrics_plain: cols
                    .filter((c) => inst.metrics && inst.metrics[c.key] != null && inst.metrics[c.key] !== "")
                    .map((c) => `${c.label} ${inst.metrics[c.key]}`)
                    .join(" · "),
            }));
        });

        const mipPoints = await buildMipPoints(allInstances);
        renderMipChart(mipPoints);

        renderInstances();
    } catch (error) {
        qShowError(document.getElementById("instances-table"), error.message);
        qShowError(document.getElementById("mip-chart"), error.message);
    }
}

function getFilteredInstances() {
    const q = (document.getElementById("i-search").value || "").toLowerCase();
    const pid = document.getElementById("i-prob").value || "";
    const st = document.getElementById("i-status").value || "";
    const srt = document.getElementById("i-sort").value || "name";

    let rows = allInstances.filter(
        (r) =>
            (!q || r.name.toLowerCase().includes(q) || r.problem_name.toLowerCase().includes(q)) &&
            (!pid || r.problem_id === pid) &&
            (!st || r.status === st),
    );

    if (srt === "best_asc") rows.sort((a, b) => (a.best_value ?? a.bkv ?? Number.POSITIVE_INFINITY) - (b.best_value ?? b.bkv ?? Number.POSITIVE_INFINITY));
    else if (srt === "best_desc") rows.sort((a, b) => (b.best_value ?? b.bkv ?? Number.NEGATIVE_INFINITY) - (a.best_value ?? a.bkv ?? Number.NEGATIVE_INFINITY));
    else rows.sort((a, b) => a.name.localeCompare(b.name));

    return rows;
}

function downloadInstancesCsv() {
    const rows = getFilteredInstances();
    const headers = ["Problem ID", "Problem", "Instance", "Parameters", "Best objective", "Optimal", "Source", "Source URL", "Status", "Raw URL"];
    const data = rows.map((r) => [
        String(r.problem_id).padStart(2, "0"),
        r.problem_name,
        r.name,
        r.metrics_plain || "",
        r.best_value ?? r.bkv ?? "",
        r.best_is_optimal ? "yes" : "",
        r.best_source_label || r.best_source_type || "",
        r.best_source_url || "",
        r.status,
        r.raw_url || "",
    ]);
    qDownloadCsv("qoblib_instances.csv", headers, data);
}

function renderInstances() {
    const rows = getFilteredInstances();

    document.getElementById("i-count").textContent =
        `${rows.length.toLocaleString()} instance${rows.length !== 1 ? "s" : ""}`;

    document.getElementById("i-tbody").innerHTML =
        rows
            .map(
                (r) => `
                <tr>
                    <td><a class="rlink mono" href="${qInstanceUrl(r.problem_id, r.name)}">${qEsc(r.name)}</a></td>
                    <td><a class="badge b-type" href="${qProblemUrl(r.problem_id)}">${String(r.problem_id).padStart(2, "0")} ${qEsc(r.problem_name)}</a></td>
                    <td class="notes-cell" title="${r.metrics_text || ""}">${r.metrics_text || "-"}</td>
                    <td class="num">${r.best_is_optimal ? `<strong>${qFmtNum(r.best_value ?? r.bkv)}</strong>` : qFmtNum(r.best_value ?? r.bkv)}</td>
                    <td>${r.best_source_url ? `<a class="dl" href="${qEsc(r.best_source_url)}" target="_blank">${qEsc(r.best_source_label || r.best_source_type || "source")}</a>` : "-"}</td>
                    <td>${qStatusPill(r.status)}</td>
                    <td><a class="dl" href="${qEsc(r.raw_url)}" target="_blank">↓ raw</a>${r.models?.length ? ` ${qModelLinks(r.models)}` : ""}</td>
                </tr>`,
            )
            .join("") || '<tr><td colspan="7" class="text-center padded">No instances match the current filters.</td></tr>';
}

window.renderInstances = renderInstances;
window.downloadInstancesCsv = downloadInstancesCsv;
initInstancesPage();
