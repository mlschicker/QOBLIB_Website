"use strict";

const {
    esc: qEsc,
    fmtNum: qFmtNum,
    fmtInt: qFmtInt,
    fmtMaybeNum: qFmtMaybeNum,
    fmtText: qFmtText,
    parseDate: qParseDate,
    fmtDate: qFmtDate,
    loadProblemData: qLoadProblemData,
    submissionUrl: qSubmissionUrl,
    problemUrl: qProblemUrl,
    statusPill: qStatusPill,
    detailModelList: qDetailModelList,
    renderMath: qRenderMath,
    showError: qShowError,
    enableTableSorting: qEnableTableSorting,
    initCommon: qInitCommon,
    classifySubmission: qClassify,
    SUBMISSION_CATEGORIES: qCATS,
    setPageMeta: qSetPageMeta,
    enhanceFigures: qEnhanceFigures,
} = window.QOBLIB;

// ---------------------------------------------------------------------------
// Submission-history plots, each split into the three compute paradigms:
// real quantum hardware, simulated quantum, and classical.
// ---------------------------------------------------------------------------

const CAT_ORDER = ["classical", "quantum_sim", "quantum_hw"];

function catOf(s) {
    return (s && s.category) || qClassify(s);
}

function catBadge(cat) {
    const c = qCATS[cat] || qCATS.classical;
    return `<span class="cat-badge"><span class="cat-dot" style="background:${c.color}"></span>${qEsc(c.short)}</span>`;
}

function pNum(v) {
    if (v == null || v === "") return NaN;
    return Number(String(v).replace(/,/g, "").trim());
}

function pDate(v) {
    return qParseDate(v);
}

function isInfeasibleSub(s) {
    const nf = pNum(s.n_feasible);
    return Number.isFinite(nf) && nf === 0;
}

function fmtTick(v) {
    const a = Math.abs(v);
    if (a !== 0 && (a >= 1e5 || a < 1e-3)) return v.toExponential(1);
    const dp = a < 10 ? 3 : a < 1000 ? 1 : 0;
    return Number(v.toFixed(dp)).toLocaleString();
}

function fmtDate(ms) {
    const d = new Date(ms);
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

// Running-best envelope: emit a point each time the record improves → monotone.
function bestOverTime(items, minimize) {
    const sorted = items
        .filter((d) => Number.isFinite(d.t) && Number.isFinite(d.v))
        .sort((a, b) => a.t - b.t);
    const out = [];
    let best = null;
    sorted.forEach((d) => {
        if (best === null || (minimize ? d.v < best : d.v > best)) {
            best = d.v;
            out.push({ x: d.t, y: best });
        }
    });
    return out;
}

function buildConvergenceChart(series, opts) {
    const pts = series.flatMap((s) => s.points);
    if (!pts.length) return "";
    const W = 720;
    const H = 300;
    const m = { t: 16, r: 18, b: 40, l: 66 };
    const xsAll = pts.map((p) => p.x);
    const ysAll = pts.map((p) => p.y);
    let xMin = Math.min(...xsAll);
    let xMax = Math.max(...xsAll);
    if (xMin === xMax) { xMin -= 86400000; xMax += 86400000; }

    const useLog = Boolean(opts.yLog) && ysAll.every((y) => y > 0);
    let yMin = Math.min(...ysAll);
    let yMax = Math.max(...ysAll);
    let lo = 0;
    let hi = 1;
    if (useLog) {
        lo = Math.log10(yMin);
        hi = Math.log10(yMax);
        const pad = (hi - lo || 1) * 0.1;
        lo -= pad; hi += pad;
    } else {
        const span = (yMax - yMin) || Math.abs(yMax) || 1;
        yMin -= span * 0.1; yMax += span * 0.1;
    }

    const xPx = (x) => m.l + (W - m.l - m.r) * ((x - xMin) / ((xMax - xMin) || 1));
    const yPx = (y) => {
        if (useLog) {
            const v = Math.log10(y);
            return H - m.b - (H - m.t - m.b) * ((v - lo) / ((hi - lo) || 1));
        }
        return H - m.b - (H - m.t - m.b) * ((y - yMin) / ((yMax - yMin) || 1));
    };

    const yticks = [];
    for (let i = 0; i <= 4; i++) {
        const val = useLog ? Math.pow(10, lo + (hi - lo) * (i / 4)) : yMin + (yMax - yMin) * (i / 4);
        yticks.push({ y: val, py: yPx(val) });
    }
    const xticks = [];
    const nX = 3;
    for (let i = 0; i <= nX; i++) {
        const x = xMin + (xMax - xMin) * (i / nX);
        xticks.push({ x, px: xPx(x) });
    }

    const grid = yticks
        .map((t) => `<line class="conv-grid" x1="${m.l}" y1="${t.py.toFixed(1)}" x2="${W - m.r}" y2="${t.py.toFixed(1)}" />`)
        .join("");
    const yLabels = yticks
        .map((t) => `<text class="conv-tick" text-anchor="end" x="${m.l - 8}" y="${(t.py + 3).toFixed(1)}">${qEsc(fmtTick(t.y))}</text>`)
        .join("");
    const xLabels = xticks
        .map((t) => `<text class="conv-tick" text-anchor="middle" x="${t.px.toFixed(1)}" y="${H - m.b + 16}">${qEsc(fmtDate(t.x))}</text>`)
        .join("");
    const axes =
        `<line class="conv-axis-line" x1="${m.l}" y1="${m.t}" x2="${m.l}" y2="${H - m.b}" />` +
        `<line class="conv-axis-line" x1="${m.l}" y1="${H - m.b}" x2="${W - m.r}" y2="${H - m.b}" />`;

    const drawn = series
        .map((s) => {
            if (!s.points.length) return "";
            const sp = s.points.slice().sort((a, b) => a.x - b.x);
            let d = "";
            sp.forEach((p, i) => {
                const X = xPx(p.x).toFixed(1);
                const Y = yPx(p.y).toFixed(1);
                if (i === 0) d = `M ${X} ${Y}`;
                else d += ` L ${xPx(p.x).toFixed(1)} ${yPx(sp[i - 1].y).toFixed(1)} L ${X} ${Y}`;
            });
            d += ` L ${xPx(xMax).toFixed(1)} ${yPx(sp[sp.length - 1].y).toFixed(1)}`;
            const line = `<path d="${d}" fill="none" style="stroke:${s.color}" stroke-width="2" stroke-linejoin="round" />`;
            const dots = sp
                .map((p) => `<circle cx="${xPx(p.x).toFixed(1)}" cy="${yPx(p.y).toFixed(1)}" r="3.6" style="fill:${s.color}"><title>${qEsc(s.name)} · ${qEsc(fmtDate(p.x))} · ${qEsc(fmtTick(p.y))}</title></circle>`)
                .join("");
            return line + dots;
        })
        .join("");

    return `<svg class="conv-svg" viewBox="0 0 ${W} ${H}" role="img" preserveAspectRatio="xMidYMid meet">${grid}${axes}${yLabels}${xLabels}${drawn}</svg>`;
}

function convChartCard(title, desc, series, svg) {
    const legend = series
        .filter((s) => s.points.length)
        .map((s) => `<span class="conv-leg"><span class="conv-dot" style="background:${s.color}"></span>${qEsc(s.name)}</span>`)
        .join("");
    return `<section class="tw chart-card">
        <div class="chart-head">
            <div><h3>${qEsc(title)}</h3><p>${qEsc(desc)}</p></div>
            <div class="conv-legend">${legend}</div>
        </div>
        ${svg}
    </section>`;
}

function renderSubmissionPlots(p, inst, submissions) {
    const minimize = p.minimize !== false;
    const parsed = (submissions || [])
        .filter((s) => !isInfeasibleSub(s))
        .map((s) => ({
            v: pNum(s.value),
            t: pDate(s.date),
            rt: pNum(s.runtime_total),
            cat: catOf(s),
        }));

    const makeSeries = (items, isMin, valueKey) =>
        CAT_ORDER.map((key) => {
            const subset = items.filter((d) => d.cat === key).map((d) => ({ t: d.t, v: valueKey(d) }));
            return { name: qCATS[key].label, color: qCATS[key].color, points: bestOverTime(subset, isMin) };
        });

    // Plot 1: best objective value over submission time.
    let plot1 = "";
    const valueItems = parsed.filter((d) => Number.isFinite(d.v) && Number.isFinite(d.t));
    if (valueItems.length) {
        const series = makeSeries(valueItems, minimize, (d) => d.v);
        const svg = buildConvergenceChart(series, { yLog: false });
        if (svg) {
            plot1 = convChartCard(
                "Best objective value over submission time",
                `Best objective reached so far by each approach as submissions arrived (${minimize ? "lower is better, so the line only decreases" : "higher is better, so the line only increases"}).`,
                series,
                svg,
            );
        }
    }

    // Plot 2: runtime to reach the optimum over time (only when several submissions hit the optimum).
    let plot2 = "";
    const optimal = inst.best_is_optimal ? (inst.best_value ?? inst.reference_solution_value ?? inst.bkv ?? null) : null;
    if (optimal != null) {
        const eps = 1e-6 * Math.max(1, Math.abs(Number(optimal)));
        const optItems = parsed.filter(
            (d) => Number.isFinite(d.v) && Math.abs(d.v - Number(optimal)) <= eps && Number.isFinite(d.rt) && d.rt > 0 && Number.isFinite(d.t),
        );
        if (optItems.length >= 2) {
            const series = makeSeries(optItems, true, (d) => d.rt);
            const svg = buildConvergenceChart(series, { yLog: true });
            if (svg) {
                plot2 = convChartCard(
                    "Fastest runtime to reach the optimum over submission time",
                    "Among submissions that reached the optimal objective, the best (lowest) total runtime achieved so far by each approach.",
                    series,
                    svg,
                );
            }
        }
    }

    if (!plot1 && !plot2) return "";
    return `<div class="ss-title">Submission history</div><div class="chart-row">${plot1}${plot2}</div>`;
}

async function initInstancePage() {
    qInitCommon();
    const params = new URLSearchParams(window.location.search);
    const problemId = params.get("problem") || "";
    const instanceName = params.get("name") || "";
    const container = document.getElementById("inst-detail");

    if (!problemId || !instanceName) {
        qShowError(container, "Missing problem or instance in URL.");
        return;
    }

    try {
        const p = await qLoadProblemData(problemId);
        const inst = (p.instances || []).find((i) => i.name === instanceName);
        if (!inst) {
            throw new Error(`Instance \"${instanceName}\" was not found in problem ${problemId}.`);
        }
        qSetPageMeta({ title: `${inst.name} · ${p.name} — QOBLIB` });

        // Problem-specific metric rows (e.g. Nodes / Edges for MIS).
        const metricRows = (Array.isArray(p.columns) ? p.columns : [])
            .filter((c) => inst.metrics && inst.metrics[c.key] != null && inst.metrics[c.key] !== "")
            .map(
                (c) =>
                    `<div class="mr"><span class="mk">${qEsc(c.label)}</span><span class="mv">${c.numeric ? qFmtNum(inst.metrics[c.key]) : qEsc(inst.metrics[c.key])}</span></div>`,
            )
            .join("");

        const submissions = [...(p.instance_submissions?.[instanceName] || [])];
        const parseMaybeNumber = (value) => {
            if (value == null) return Number.NaN;
            return Number(String(value).replace(/,/g, "").trim());
        };
        const parseMaybeDate = (value) => qParseDate(value);
        // Canonical objective direction: treat an unspecified `minimize` as
        // minimize, matching the convergence chart (instance.js makeSeries) so the
        // ranking and the plot never disagree on which way is "better".
        const minimize = p.minimize !== false;
        const isMarketSplit = String(p.id || "").padStart(2, "0") === "01";
        const isInfeasibleSubmission = (submission) => {
            const nFeasible = parseMaybeNumber(submission?.n_feasible);
            return Number.isFinite(nFeasible) && nFeasible === 0;
        };
        submissions.sort((a, b) => {
            const aInfeasible = isInfeasibleSubmission(a);
            const bInfeasible = isInfeasibleSubmission(b);
            if (aInfeasible !== bInfeasible) {
                return aInfeasible ? 1 : -1;
            }

            const av = parseMaybeNumber(a.value);
            const bv = parseMaybeNumber(b.value);
            if (Number.isFinite(av) && Number.isFinite(bv) && av !== bv) {
                return minimize ? av - bv : bv - av;
            }
            if (Number.isFinite(av) !== Number.isFinite(bv)) {
                return Number.isFinite(av) ? -1 : 1;
            }

            const ar = parseMaybeNumber(a.runtime_total);
            const br = parseMaybeNumber(b.runtime_total);
            if (Number.isFinite(ar) && Number.isFinite(br) && ar !== br) {
                return ar - br;
            }
            if (Number.isFinite(ar) !== Number.isFinite(br)) {
                return Number.isFinite(ar) ? -1 : 1;
            }

            const ad = parseMaybeDate(a.date);
            const bd = parseMaybeDate(b.date);
            if (Number.isFinite(ad) && Number.isFinite(bd) && ad !== bd) {
                return ad - bd;
            }
            if (Number.isFinite(ad) !== Number.isFinite(bd)) {
                return Number.isFinite(ad) ? -1 : 1;
            }

            return String(a._source_dir || "").localeCompare(String(b._source_dir || ""));
        });

        const rankSymbol = (rank) => {
            if (rank === 1) return "▲";
            if (rank === 2) return "◆";
            if (rank === 3) return "●";
            return "·";
        };

        const bestKnown = parseMaybeNumber(inst.best_value ?? inst.bkv);
        const isSameObjective = (value, target) => {
            const v = parseMaybeNumber(value);
            if (!Number.isFinite(target) || !Number.isFinite(v)) return false;
            const scale = Math.max(1, Math.abs(target), Math.abs(v));
            return Math.abs(v - target) <= 1e-9 * scale;
        };

        const feasibleSubmissions = submissions.filter((s) => !isInfeasibleSubmission(s));
        const submittedObjectives = feasibleSubmissions.map((s) => parseMaybeNumber(s.value)).filter((v) => Number.isFinite(v));
        const bestSubmittedObjective = submittedObjectives.length
            ? (minimize ? Math.min(...submittedObjectives) : Math.max(...submittedObjectives))
            : Number.NaN;
        const hasBestKnownMatch = feasibleSubmissions.some((s) => isSameObjective(s.value, bestKnown));
        const markerObjective = hasBestKnownMatch ? bestKnown : bestSubmittedObjective;

        const firstBestKnownSubmission = feasibleSubmissions
            .filter((s) => isSameObjective(s.value, markerObjective))
            .map((s) => ({
                s,
                t: parseMaybeDate(s.date),
            }))
            .sort((a, b) => {
                if (Number.isFinite(a.t) && Number.isFinite(b.t) && a.t !== b.t) return a.t - b.t;
                if (Number.isFinite(a.t) !== Number.isFinite(b.t)) return Number.isFinite(a.t) ? -1 : 1;
                const ar = parseMaybeNumber(a.s.runtime_total);
                const br = parseMaybeNumber(b.s.runtime_total);
                if (Number.isFinite(ar) && Number.isFinite(br) && ar !== br) return ar - br;
                if (Number.isFinite(ar) !== Number.isFinite(br)) return Number.isFinite(ar) ? -1 : 1;
                return String(a.s._source_dir || "").localeCompare(String(b.s._source_dir || ""));
            })[0]?.s;

        container.innerHTML = `
            <a class="back" href="${qProblemUrl(p.id)}">← Back to ${String(p.id).padStart(2, "0")} ${qEsc(p.name)}</a>
            <div class="dh">
                <div>
                    <div class="d-num">${String(p.id).padStart(2, "0")} / ${qEsc(p.slug)}</div>
                    <div class="d-title">${qEsc(inst.name)}</div>
                    <div class="d-sub">${qEsc(p.name)}</div>
                    <div class="pcard-foot">
                        <a class="badge b-type" href="${qProblemUrl(p.id)}" title="Open the ${qEsc(p.name)} problem overview">${String(p.id).padStart(2, "0")} ${qEsc(p.name)}</a>
                        ${qStatusPill(inst.status)}
                        ${inst.vars != null ? `<span class="badge b-vars">${qFmtInt(inst.vars)} vars</span>` : ""}
                    </div>
                </div>
                <div class="d-meta">
                    ${metricRows}
                    <div class="mr"><span class="mk">Best objective</span><span class="mv">${qFmtNum(inst.best_value ?? inst.bkv)}</span></div>
                    <div class="mr"><span class="mk">Reference objective</span><span class="mv">${inst.reference_solution_value != null ? qFmtNum(inst.reference_solution_value) : "-"}</span></div>
                    <div class="mr"><span class="mk">Submissions</span><span class="mv">${submissions.length}</span></div>
                    <div class="mr"><span class="mk">Models</span><span class="mv">${(inst.models || []).length}</span></div>
                </div>
            </div>

            <div class="hero-actions" style="margin-bottom:1.5rem">
                ${inst.raw_url ? `<a class="btn btn-ghost" href="${qEsc(inst.raw_url)}" target="_blank" rel="noopener">Download Instance</a>` : ""}
                ${inst.reference_solution_url ? `<a class="btn btn-ghost" href="${qEsc(inst.reference_solution_url)}" target="_blank" rel="noopener">Download Solution</a>` : ""}
            </div>

            ${renderSubmissionPlots(p, inst, submissions)}

            <div class="ss-title">Uploaded Models (${(inst.models || []).length})</div>
            ${qDetailModelList(inst.models || [])}

            <div class="ss-title">Submissions (${submissions.length})</div>
            ${
                submissions.length
                    ? `<div class="tw">
                        <table>
                            <thead>
                                <tr>
                                    <th style="text-align:center">Rank</th>
                                    <th style="text-align:right">Objective</th>
                                    <th>Submitter</th>
                                    <th>Date</th>
                                    <th>Approach</th>
                                    <th>Type</th>
                                    <th>Reference</th>
                                    <th style="text-align:right">Runtime (s)</th>
                                    <th>Remarks</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${submissions
                                    .map(
                                        (s, idx) => {
                                            const infeasible = isInfeasibleSubmission(s);
                                            const showObjective = !(isMarketSplit && infeasible);
                                            return `
                                            <tr>
                                                <td class="mono" style="text-align:center">${idx + 1} ${rankSymbol(idx + 1)}${firstBestKnownSubmission === s ? " ★" : ""}</td>
                                                <td class="num" style="font-weight:600">${showObjective ? qFmtNum(s.value) : "-"}</td>
                                                <td>${s._source_dir ? `<a class="rlink" href="${qSubmissionUrl(p.id, s._source_dir)}">${qFmtText(s.submitter || s.author)}</a>` : qFmtText(s.submitter || s.author)}</td>
                                                <td class="mono">${qEsc(qFmtDate(s.date))}</td>
                                                <td>${qFmtText(s.modeling_approach || s.algorithm_type)}</td>
                                                <td title="${qEsc((qCATS[catOf(s)] || qCATS.classical).label)}">${catBadge(catOf(s))}</td>
                                                <td title="${qEsc(s.reference || "")}">${qFmtText(s.reference)}</td>
                                                <td class="num">${qFmtMaybeNum(s.runtime_total)}</td>
                                                <td title="${qEsc(s.remarks || s.workflow || s.hardware || "")}">${infeasible ? '<span class="badge b-tag">infeasible</span> ' : ""}${qFmtText(s.remarks || s.workflow || s.hardware)}</td>
                                            </tr>`;
                                        },
                                    )
                                    .join("")}
                            </tbody>
                        </table>
                    </div>
                    <div class="table-legend" style="margin:.25rem 0 .6rem;color:var(--muted)">Rank markers: 1 ▲, 2 ◆, 3 ●, ★ = first submission to reach the best known/best submitted objective.</div>
                    `
                    : '<div class="empty-state">No submissions are available for this instance yet.</div>'
            }
        `;

        container.querySelectorAll(".resource-desc").forEach((el) => qRenderMath(el));
        qEnableTableSorting(container);
        qEnhanceFigures(container); // expand affordance on the submission-history charts
    } catch (error) {
        qShowError(container, error.message);
    }
}

initInstancePage();
