"use strict";

const {
    esc: qEsc,
    fmtBytes: qFmtBytes,
    fmtNum: qFmtNum,
    fmtText: qFmtText,
    fmtDate: qFmtDate,
    parseDate: qParseDate,
    loadProblemData: qLoadProblemData,
    loadProblemSubmissionGroups: qLoadProblemSubmissionGroups,
    instanceUrl: qInstanceUrl,
    problemUrl: qProblemUrl,
    submissionUrl: qSubmissionUrl,
    statusPill: qStatusPill,
    catBadge: qCatBadge,
    modelLinks: qModelLinks,
    renderMarkdown: qRenderMarkdown,
    renderMath: qRenderMath,
    showError: qShowError,
    initCommon: qInitCommon,
    classifySubmission: qClassify,
    SUBMISSION_CATEGORIES: qCATS,
    downloadCsv: qDownloadCsv,
} = window.QOBLIB;

// ---------------------------------------------------------------------------
// Performance section for the problem's instance family — three charts that
// share one "by paradigm / by submission" grouping toggle (so a given method
// keeps the same colour across all three):
//   • Cactus — runtime to reach the best-known objective.
//   • Performance profile — share of instances within a given optimality gap.
//   • Scaling — fastest feasible runtime versus instance size.
// "By submission" plots one curve per submission, i.e. per method.
// ---------------------------------------------------------------------------

const CACTUS_CATS = ["classical", "quantum_sim", "quantum_hw"];
const CACTUS_PALETTE = ["#2f6db0", "#c0504d", "#9bbb59", "#8064a2", "#4bacc6", "#f79646", "#7f6084", "#5a7d2c"];

let PERF = null;
let PERF_MODE = "paradigm";
let currentProblem = null;

// Submission dirs follow `date_method_author` (e.g. 20241206_Gurobi-Flow_Schicker).
// Use the method portion as the curve label; fall back to the raw id if it does
// not match, and disambiguate by author when two methods share a label.
function submissionMethod(dir) {
    const m = String(dir || "").match(/^\d{6,8}_(.+)_([^_]+)$/);
    return m ? m[1] : String(dir || "Unknown");
}
function submissionAuthor(dir) {
    const m = String(dir || "").match(/^\d{6,8}_.+_([^_]+)$/);
    return m ? m[1] : "";
}

function cNum(v) {
    if (v == null || v === "") return NaN;
    const n = Number(String(v).replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : NaN;
}

function cIsFeasible(s) {
    const nf = cNum(s.n_feasible);
    return !(Number.isFinite(nf) && nf === 0);
}

// A feasibility problem (e.g. Market Split, Sports Tournament): the goal is to
// find a feasible point, so every known best-value is 0. On such problems a
// feasible submission counts as solved even when it reports no objective value.
function isFeasibilityProblem(p) {
    let sawZero = false;
    for (const i of p.instances || []) {
        const bv = cNum(i.best_value ?? i.bkv);
        if (!Number.isFinite(bv)) continue;
        if (bv !== 0) return false; // a real non-zero objective ⇒ optimization problem
        sawZero = true;
    }
    return sawZero;
}

function cFmtTime(v) {
    const a = Math.abs(v);
    if (a !== 0 && (a >= 1e5 || a < 1e-3)) return v.toExponential(1);
    const dp = a < 10 ? 2 : a < 1000 ? 1 : 0;
    return Number(v.toFixed(dp)).toLocaleString();
}

// Reference best objective for an instance: the recorded best-known value,
// tightened by the best feasible value actually submitted (guards stale data).
function refBest(inst, feasSubs, minimize) {
    let ref = cNum(inst.best_value ?? inst.bkv);
    feasSubs.forEach((s) => {
        const v = cNum(s.value);
        if (!Number.isFinite(v)) return;
        if (!Number.isFinite(ref)) ref = v;
        else ref = minimize ? Math.min(ref, v) : Math.max(ref, v);
    });
    return ref;
}

// Where the scaling x-axis comes from. The instance-level `vars` field is
// unreliable — for Market Split it holds the coefficient range, for others it is
// an instance index or zero — so size is read from the problem's metric columns:
// an explicit "variables" count when present, otherwise the natural size metric
// (length, nodes, assets, dimension, …).
function sizeSource(p) {
    const cols = (Array.isArray(p.columns) ? p.columns : []).filter((c) => c.numeric);
    const varCol = cols.find((c) => /^(num[_-]?|n[_-]?)?vars?$|^variables$/i.test(c.key));
    const sizeCol = varCol || cols.find((c) => /length|node|dimension|grid|asset|customer|size|qubit/i.test(c.key)) || cols[0];
    if (sizeCol) return { label: sizeCol.label, get: (i) => cNum(i.metrics?.[sizeCol.key]) };
    return { label: "size", get: () => NaN };
}

function cFmtGap(pct) {
    const a = Math.abs(pct);
    const dp = a < 1 ? 2 : a < 10 ? 1 : 0;
    return `${Number(pct.toFixed(dp)).toLocaleString()}%`;
}

function cFmtSize(v) {
    const a = Math.abs(v);
    const dp = a < 10 ? 1 : 0;
    return Number(v.toFixed(dp)).toLocaleString();
}

// Build, for one grouping mode, the per-group datasets feeding all three charts:
//   times  – fastest runtime that reached the best-known objective, per solved
//            instance (cactus);
//   gaps   – smallest optimality gap %, per feasible instance (profile);
//   points – {size, runtime} of the fastest feasible run, per instance (scaling).
function buildPerfMode(p, mode) {
    const instances = p.instances || [];
    const entries = p.instance_submissions || {};
    const minimize = p.minimize !== false;
    const feas = isFeasibilityProblem(p);
    const sz = sizeSource(p);
    const groupKey = (s) =>
        mode === "submission" ? (s._source_dir || s.submitter || s.author || "Unknown") : (s.category || qClassify(s));

    const groups = new Map();
    const G = (k) => {
        if (!groups.has(k)) groups.set(k, { times: [], gaps: [], points: [] });
        return groups.get(k);
    };

    instances.forEach((inst) => {
        const subs = (entries[inst.name] || []).filter(cIsFeasible);
        if (!subs.length) return;
        const target = cNum(inst.best_value ?? inst.bkv);
        const ref = feas ? 0 : refBest(inst, subs, minimize);
        const size = sz.get(inst);

        const bestRt = new Map(); // group -> fastest runtime that reached best-known
        const minGap = new Map(); // group -> smallest optimality gap %
        const feasRt = new Map(); // group -> fastest feasible runtime (scaling)

        subs.forEach((s) => {
            const k = groupKey(s);
            const val = cNum(s.value);
            const rt = cNum(s.runtime_total);

            let reached;
            if (feas) reached = !Number.isFinite(val) || Math.abs(val) <= 1e-9;
            else if (Number.isFinite(val) && Number.isFinite(target)) {
                const scale = Math.max(1, Math.abs(target), Math.abs(val));
                reached = Math.abs(val - target) <= 1e-9 * scale;
            } else reached = false;
            if (reached && Number.isFinite(rt)) {
                const pr = bestRt.get(k);
                if (pr == null || rt < pr) bestRt.set(k, rt);
            }

            if (!feas && Number.isFinite(val) && Number.isFinite(ref)) {
                const gap = Math.max(0, ((minimize ? val - ref : ref - val) / Math.max(1, Math.abs(ref))) * 100);
                const pr = minGap.get(k);
                if (pr == null || gap < pr) minGap.set(k, gap);
            }

            if (Number.isFinite(size) && Number.isFinite(rt)) {
                const pr = feasRt.get(k);
                if (pr == null || rt < pr) feasRt.set(k, rt);
            }
        });

        bestRt.forEach((rt, k) => G(k).times.push(rt));
        minGap.forEach((g, k) => G(k).gaps.push(g));
        feasRt.forEach((rt, k) => G(k).points.push({ size, rt }));
    });

    const finalize = (key, name, color) => {
        const g = groups.get(key);
        return {
            key,
            name,
            color,
            times: g.times.slice().sort((x, y) => x - y),
            gaps: g.gaps.slice().sort((x, y) => x - y),
            points: g.points.slice(),
        };
    };

    if (mode === "submission") {
        const keys = [...groups.keys()].sort(
            (a, b) => groups.get(b).points.length - groups.get(a).points.length || String(a).localeCompare(String(b)),
        );
        const labelCounts = {};
        keys.forEach((k) => {
            const l = submissionMethod(k);
            labelCounts[l] = (labelCounts[l] || 0) + 1;
        });
        return keys.map((k, i) => {
            let name = submissionMethod(k);
            if (labelCounts[name] > 1) {
                const a = submissionAuthor(k);
                name = a ? `${name} (${a})` : k;
            }
            return finalize(k, name, CACTUS_PALETTE[i % CACTUS_PALETTE.length]);
        });
    }
    return CACTUS_CATS.filter((k) => groups.has(k)).map((k) => finalize(k, qCATS[k].label, qCATS[k].color));
}

function buildCactusChart(series) {
    const live = series.filter((s) => s.times.length);
    const allTimes = live.flatMap((s) => s.times);
    if (!allTimes.length) return "";

    const W = 720;
    const H = 300;
    const m = { t: 16, r: 18, b: 44, l: 66 };
    const maxN = Math.max(...live.map((s) => s.times.length));
    const pos = allTimes.filter((t) => t > 0);
    const floor = pos.length ? Math.min(...pos) : 1e-3;
    const clamp = (t) => (t > 0 ? t : floor); // log axis cannot show 0 / instant solves

    let lo = Math.log10(Math.min(...allTimes.map(clamp)));
    let hi = Math.log10(Math.max(...allTimes.map(clamp)));
    if (lo === hi) { lo -= 1; hi += 1; } else { const pad = (hi - lo) * 0.08; lo -= pad; hi += pad; }

    const xMax = Math.max(maxN, 1);
    const xPx = (c) => m.l + (W - m.l - m.r) * (xMax <= 1 ? 0.5 : c / xMax);
    const yPx = (t) => H - m.b - (H - m.t - m.b) * ((Math.log10(clamp(t)) - lo) / ((hi - lo) || 1));

    const yticks = [];
    for (let i = 0; i <= 4; i++) {
        const val = Math.pow(10, lo + (hi - lo) * (i / 4));
        yticks.push({ v: val, py: yPx(val) });
    }
    const xticks = [];
    const step = Math.max(1, Math.ceil(xMax / 6));
    for (let c = 0; c <= xMax; c += step) xticks.push(c);
    if (xticks[xticks.length - 1] !== xMax) xticks.push(xMax);

    const grid = yticks
        .map((t) => `<line class="conv-grid" x1="${m.l}" y1="${t.py.toFixed(1)}" x2="${W - m.r}" y2="${t.py.toFixed(1)}" />`)
        .join("");
    const yLabels = yticks
        .map((t) => `<text class="conv-tick" text-anchor="end" x="${m.l - 8}" y="${(t.py + 3).toFixed(1)}">${qEsc(cFmtTime(t.v))}</text>`)
        .join("");
    const xLabels = xticks
        .map((c) => `<text class="conv-tick" text-anchor="middle" x="${xPx(c).toFixed(1)}" y="${H - m.b + 16}">${c}</text>`)
        .join("");
    const axes =
        `<line class="conv-axis-line" x1="${m.l}" y1="${m.t}" x2="${m.l}" y2="${H - m.b}" />` +
        `<line class="conv-axis-line" x1="${m.l}" y1="${H - m.b}" x2="${W - m.r}" y2="${H - m.b}" />`;
    const xTitle = `<text class="conv-axis-title" text-anchor="middle" x="${((m.l + (W - m.r)) / 2).toFixed(1)}" y="${H - 5}">instances solved →</text>`;
    const yTitle = `<text class="conv-axis-title" text-anchor="middle" transform="rotate(-90 14 ${((m.t + (H - m.b)) / 2).toFixed(1)})" x="14" y="${((m.t + (H - m.b)) / 2).toFixed(1)}">runtime (s, log)</text>`;

    const drawn = live
        .map((s) => {
            const pts = s.times.map((t, i) => ({ px: xPx(i + 1), py: yPx(t), c: i + 1, t }));
            let d = "";
            pts.forEach((p, i) => { d += `${i === 0 ? "M" : "L"} ${p.px.toFixed(1)} ${p.py.toFixed(1)} `; });
            const line = `<path d="${d.trim()}" fill="none" style="stroke:${s.color}" stroke-width="2" stroke-linejoin="round" />`;
            const dots = pts
                .map((p) => `<circle cx="${p.px.toFixed(1)}" cy="${p.py.toFixed(1)}" r="3.2" style="fill:${s.color}"><title>${qEsc(s.name)} · solved ${p.c} · ${qEsc(cFmtTime(p.t))} s</title></circle>`)
                .join("");
            return line + dots;
        })
        .join("");

    return `<svg class="conv-svg" viewBox="0 0 ${W} ${H}" role="img" preserveAspectRatio="xMidYMid meet">${grid}${axes}${yLabels}${xLabels}${xTitle}${yTitle}${drawn}</svg>`;
}

// Performance profile: share of instances each group brings within a given
// optimality gap of the best-known objective. x = gap on a log(1+gap%) axis so
// exact solves sit at the left edge; y = fraction of reference instances.
function buildProfileChart(groups, refN) {
    const live = groups.filter((g) => g.gaps.length);
    const all = live.flatMap((g) => g.gaps);
    if (!all.length || !refN) return "";

    const W = 720;
    const H = 300;
    const m = { t: 16, r: 18, b: 44, l: 66 };
    const gMax = Math.max(...all);
    const hi = gMax > 0 ? Math.log10(1 + gMax) : Math.log10(2); // all-exact view → nominal best…+100% axis
    const axisMaxGap = Math.pow(10, hi) - 1;
    const xPx = (gap) => m.l + (W - m.l - m.r) * (Math.log10(1 + Math.max(0, gap)) / hi);
    const yPx = (f) => H - m.b - (H - m.t - m.b) * f;

    const yticks = [0, 0.25, 0.5, 0.75, 1];
    const grid = yticks
        .map((f) => `<line class="conv-grid" x1="${m.l}" y1="${yPx(f).toFixed(1)}" x2="${W - m.r}" y2="${yPx(f).toFixed(1)}" />`)
        .join("");
    const yLabels = yticks
        .map((f) => `<text class="conv-tick" text-anchor="end" x="${m.l - 8}" y="${(yPx(f) + 3).toFixed(1)}">${Math.round(f * 100)}%</text>`)
        .join("");
    const xticks = [];
    for (let i = 0; i <= 4; i++) xticks.push(Math.pow(10, hi * (i / 4)) - 1);
    const xLabels = xticks
        .map((gap) => `<text class="conv-tick" text-anchor="middle" x="${xPx(gap).toFixed(1)}" y="${H - m.b + 16}">${gap <= 1e-9 ? "best" : "+" + qEsc(cFmtGap(gap))}</text>`)
        .join("");
    const axes =
        `<line class="conv-axis-line" x1="${m.l}" y1="${m.t}" x2="${m.l}" y2="${H - m.b}" />` +
        `<line class="conv-axis-line" x1="${m.l}" y1="${H - m.b}" x2="${W - m.r}" y2="${H - m.b}" />`;
    const xTitle = `<text class="conv-axis-title" text-anchor="middle" x="${((m.l + (W - m.r)) / 2).toFixed(1)}" y="${H - 5}">optimality gap from best-known →</text>`;
    const yTitle = `<text class="conv-axis-title" text-anchor="middle" transform="rotate(-90 14 ${((m.t + (H - m.b)) / 2).toFixed(1)})" x="14" y="${((m.t + (H - m.b)) / 2).toFixed(1)}">instances solved (%)</text>`;

    const drawn = live
        .map((g) => {
            const sorted = g.gaps.slice().sort((a, b) => a - b);
            const steps = [];
            let cum = 0;
            for (let i = 0; i < sorted.length; i++) {
                cum++;
                if (i + 1 < sorted.length && sorted[i + 1] === sorted[i]) continue; // collapse ties
                steps.push({ gap: sorted[i], frac: cum / refN });
            }
            let prevY = yPx(0);
            let d = `M ${xPx(0).toFixed(1)} ${prevY.toFixed(1)}`;
            const dots = [];
            steps.forEach((st) => {
                const X = xPx(st.gap);
                const Y = yPx(st.frac);
                d += ` L ${X.toFixed(1)} ${prevY.toFixed(1)} L ${X.toFixed(1)} ${Y.toFixed(1)}`;
                dots.push(`<circle cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="2.6" style="fill:${g.color}"><title>${qEsc(g.name)} · within ${st.gap <= 1e-9 ? "best" : "+" + qEsc(cFmtGap(st.gap))} · ${Math.round(st.frac * 100)}%</title></circle>`);
                prevY = Y;
            });
            d += ` L ${xPx(axisMaxGap).toFixed(1)} ${prevY.toFixed(1)}`; // extend the plateau to the right edge
            return `<path d="${d}" fill="none" style="stroke:${g.color}" stroke-width="2" stroke-linejoin="round" />${dots.join("")}`;
        })
        .join("");

    return `<svg class="conv-svg" viewBox="0 0 ${W} ${H}" role="img" preserveAspectRatio="xMidYMid meet">${grid}${axes}${yLabels}${xLabels}${xTitle}${yTitle}${drawn}</svg>`;
}

// Scaling: fastest feasible runtime per instance versus instance size (log-log).
function buildScalingChart(groups, sizeLabel) {
    const live = groups.filter((g) => g.points.length);
    const pts = live.flatMap((g) => g.points);
    const sizes = pts.map((p) => p.size).filter((s) => s > 0);
    if (!pts.length || !sizes.length) return "";

    const W = 720;
    const H = 300;
    const m = { t: 16, r: 18, b: 44, l: 70 };
    const rts = pts.map((p) => p.rt);
    const rpos = rts.filter((r) => r > 0);
    const rfloor = rpos.length ? Math.min(...rpos) : 1e-3;
    const clampR = (r) => (r > 0 ? r : rfloor);

    let xlo = Math.log10(Math.min(...sizes));
    let xhi = Math.log10(Math.max(...sizes));
    if (xlo === xhi) { xlo -= 0.5; xhi += 0.5; } else { const pad = (xhi - xlo) * 0.06; xlo -= pad; xhi += pad; }
    let ylo = Math.log10(Math.min(...rts.map(clampR)));
    let yhi = Math.log10(Math.max(...rts.map(clampR)));
    if (ylo === yhi) { ylo -= 1; yhi += 1; } else { const pad = (yhi - ylo) * 0.08; ylo -= pad; yhi += pad; }

    const xPx = (s) => m.l + (W - m.l - m.r) * ((Math.log10(Math.max(s, 1e-9)) - xlo) / ((xhi - xlo) || 1));
    const yPx = (r) => H - m.b - (H - m.t - m.b) * ((Math.log10(clampR(r)) - ylo) / ((yhi - ylo) || 1));

    const xticks = [];
    const yticks = [];
    for (let i = 0; i <= 4; i++) {
        xticks.push(Math.pow(10, xlo + (xhi - xlo) * (i / 4)));
        yticks.push(Math.pow(10, ylo + (yhi - ylo) * (i / 4)));
    }
    const grid = yticks
        .map((v) => `<line class="conv-grid" x1="${m.l}" y1="${yPx(v).toFixed(1)}" x2="${W - m.r}" y2="${yPx(v).toFixed(1)}" />`)
        .join("");
    const yLabels = yticks
        .map((v) => `<text class="conv-tick" text-anchor="end" x="${m.l - 8}" y="${(yPx(v) + 3).toFixed(1)}">${qEsc(cFmtTime(v))}</text>`)
        .join("");
    const xLabels = xticks
        .map((v) => `<text class="conv-tick" text-anchor="middle" x="${xPx(v).toFixed(1)}" y="${H - m.b + 16}">${qEsc(cFmtSize(v))}</text>`)
        .join("");
    const axes =
        `<line class="conv-axis-line" x1="${m.l}" y1="${m.t}" x2="${m.l}" y2="${H - m.b}" />` +
        `<line class="conv-axis-line" x1="${m.l}" y1="${H - m.b}" x2="${W - m.r}" y2="${H - m.b}" />`;
    const xTitle = `<text class="conv-axis-title" text-anchor="middle" x="${((m.l + (W - m.r)) / 2).toFixed(1)}" y="${H - 5}">${qEsc(sizeLabel)} (log) →</text>`;
    const yTitle = `<text class="conv-axis-title" text-anchor="middle" transform="rotate(-90 14 ${((m.t + (H - m.b)) / 2).toFixed(1)})" x="14" y="${((m.t + (H - m.b)) / 2).toFixed(1)}">runtime (s, log)</text>`;

    const drawn = live
        .map((g) =>
            g.points
                .filter((pt) => pt.size > 0)
                .map((pt) => `<circle cx="${xPx(pt.size).toFixed(1)}" cy="${yPx(pt.rt).toFixed(1)}" r="3" style="fill:${g.color};fill-opacity:0.78"><title>${qEsc(g.name)} · ${qEsc(sizeLabel)} ${qEsc(cFmtSize(pt.size))} · ${qEsc(cFmtTime(pt.rt))} s</title></circle>`)
                .join(""),
        )
        .join("");

    return `<svg class="conv-svg" viewBox="0 0 ${W} ${H}" role="img" preserveAspectRatio="xMidYMid meet">${grid}${axes}${yLabels}${xLabels}${xTitle}${yTitle}${drawn}</svg>`;
}

function performanceSection(p) {
    const minimize = p.minimize !== false;
    const feas = isFeasibilityProblem(p);
    const sz = sizeSource(p);
    const entries = p.instance_submissions || {};

    let refN = 0; // instances with a defined optimization reference (profile denominator)
    if (!feas) {
        (p.instances || []).forEach((inst) => {
            const subs = (entries[inst.name] || []).filter(cIsFeasible);
            if (subs.length && Number.isFinite(refBest(inst, subs, minimize))) refN++;
        });
    }

    const modes = { paradigm: buildPerfMode(p, "paradigm"), submission: buildPerfMode(p, "submission") };
    const any = (field) => modes.paradigm.some((g) => g[field].length) || modes.submission.some((g) => g[field].length);
    const hasCactus = any("times");
    const hasProfile = !feas && refN > 0 && any("gaps");
    const hasScaling = any("points");
    if (!hasCactus && !hasProfile && !hasScaling) return "";

    PERF = { sizeLabel: sz.label, refN, modes, hasCactus, hasProfile, hasScaling };
    PERF_MODE = "paradigm";

    const card = (id, title, desc) =>
        `<section class="tw chart-card"><div class="chart-head"><div><h3>${qEsc(title)}</h3><p>${qEsc(desc)}</p></div></div><div id="${id}"></div></section>`;

    return `<div class="perf-toolbar">
            <div class="seg-toggle" role="tablist" aria-label="Grouping">
                <button type="button" class="seg-btn on" data-mode="paradigm">By paradigm</button>
                <button type="button" class="seg-btn" data-mode="submission">By submission</button>
            </div>
        </div>
        <div class="perf-charts">
            ${hasCactus ? card("cactus-body", "Runtime to reach the best-known objective", "Each curve sorts a group's solved instances by total runtime — a point (x, y) means it reached the best-known objective on x instances, each within y seconds. Lower and further right is better.") : ""}
            ${hasProfile ? card("profile-body", "Solution quality (performance profile)", "Share of instances each group brings within a given optimality gap of the best-known objective. Higher is better; the value at “best” is the share solved exactly.") : ""}
            ${hasScaling ? card("scaling-body", "Runtime scaling with instance size", `Fastest feasible runtime per instance versus ${sz.label}, both on log scales — shows how each group scales.`) : ""}
        </div>`;
}

function renderInto(id, svg, groups, field, emptyMsg) {
    const body = document.getElementById(id);
    if (!body) return;
    if (!svg) {
        body.innerHTML = `<div class="empty-state">${qEsc(emptyMsg)}</div>`;
        return;
    }
    const legend = groups
        .filter((g) => g[field].length)
        .map((g) => `<span class="conv-leg"><span class="conv-dot" style="background:${g.color}"></span>${qEsc(g.name)} (${g[field].length})</span>`)
        .join("");
    body.innerHTML = `<div class="conv-legend" style="margin:.1rem 0 .5rem">${legend}</div>${svg}`;
}

function renderPerf() {
    if (!PERF) return;
    const groups = PERF.modes[PERF_MODE] || [];
    if (PERF.hasCactus) {
        renderInto("cactus-body", buildCactusChart(groups), groups, "times", "No group reached the best-known objective with a recorded runtime in this view.");
    }
    if (PERF.hasProfile) {
        renderInto("profile-body", buildProfileChart(groups, PERF.refN), groups, "gaps", "No optimality-gap data in this view.");
    }
    if (PERF.hasScaling) {
        renderInto("scaling-body", buildScalingChart(groups, PERF.sizeLabel), groups, "points", "No instance-size / runtime data in this view.");
    }
}

function wirePerformance() {
    const tb = document.querySelector(".perf-toolbar");
    if (!tb || !PERF) return;
    tb.querySelectorAll(".seg-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            tb.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("on", b === btn));
            PERF_MODE = btn.dataset.mode;
            renderPerf();
        });
    });
    renderPerf();
}

// Wrap a page section in a native <details> so it can be collapsed. Open by
// default; `count` is shown as a subtle "(N)" after the title.
function collapsibleSection(title, bodyHtml, count = null) {
    const label = count != null ? `${qEsc(title)} <span class="ps-count">(${count})</span>` : qEsc(title);
    return `<details class="prob-section" open>
        <summary class="prob-section-head">${label}</summary>
        <div class="prob-section-body">${bodyHtml}</div>
    </details>`;
}

// Submission packages for this problem, newest first. Each row links to the
// package's detail page; mirrors the global submissions table, scoped here.
function submissionsSection(p, groups) {
    if (!groups.length) {
        return `<div class="empty-state">No submissions for this problem yet. <a class="sh-link" href="submit.html">Submit one →</a></div>`;
    }
    const sorted = [...groups].sort((a, b) => {
        const ta = qParseDate(a.profile?.date);
        const tb = qParseDate(b.profile?.date);
        return (Number.isFinite(tb) ? tb : -Infinity) - (Number.isFinite(ta) ? ta : -Infinity) ||
            String(a.id).localeCompare(String(b.id));
    });
    const rows = sorted
        .map((g) => {
            const prof = g.profile || {};
            const cat = g.category || qClassify(prof);
            return `<tr>
                <td class="mono"><a class="rlink mono" href="${qSubmissionUrl(p.id, g.id)}">${qEsc(g.id)}</a></td>
                <td>${qFmtText(prof.submitter)}</td>
                <td class="mono">${qEsc(qFmtDate(prof.date))}</td>
                <td title="${qEsc((qCATS[cat] || qCATS.classical).label)}">${qCatBadge(cat)}</td>
                <td class="num">${(g.instances || []).length.toLocaleString()}</td>
                <td class="num">${(g.source_files || []).length.toLocaleString()}</td>
            </tr>`;
        })
        .join("");
    return `<div class="tw"><table>
        <thead>
            <tr>
                <th>Package</th>
                <th>Submitter</th>
                <th>Date</th>
                <th>Type</th>
                <th style="text-align:right">Instances</th>
                <th style="text-align:right">Files</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    </table></div>`;
}

function getProblemRawBase(problem) {
    const url = String(problem?.github_url || "");
    const match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(tree|blob)\/([^/]+)\/(.+)$/i);
    if (!match) return null;
    const owner = match[1];
    const repo = match[2];
    const branch = match[4];
    const path = match[5];
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}/`;
}

function rewriteDescriptionImageSources(html, problem) {
    if (!html) return html;

    // A bespoke inline figure (assets/problem_figures.js) replaces the README
    // image entirely — strip it so the browser never fetches a PNG we'd discard.
    if ((window.QOBLIB_PROBLEM_FIGURES || {})[problem?.slug]) {
        return html.replace(/<img\b[^>]*>/gi, "");
    }

    const rawBase = getProblemRawBase(problem);
    if (!rawBase) return html;

    return html.replace(/(<img\b[^>]*\bsrc\s*=\s*["'])([^"']+)(["'][^>]*>)/gi, (full, prefix, src, suffix) => {
        const normalized = String(src || "").trim();
        const isAbsolute = /^(?:https?:)?\/\//i.test(normalized) || normalized.startsWith("/") || normalized.startsWith("data:");
        if (isAbsolute) return full;

        const cleaned = normalized.replace(/^\.\//, "");
        return `${prefix}${rawBase}${cleaned}${suffix}`;
    });
}

function layoutDescriptionImage(descRoot, problem) {
    if (!descRoot) return;

    // Prefer our own theme-aware inline SVG (assets/problem_figures.js), keyed by
    // the problem slug. It replaces any figure embedded in the README so every
    // problem shows a figure in the site colour scheme, light or dark.
    const figureSvg = (window.QOBLIB_PROBLEM_FIGURES || {})[problem?.slug];

    const content = document.createElement("div");
    content.className = "d-desc-content";
    while (descRoot.firstChild) {
        content.appendChild(descRoot.firstChild);
    }

    // Drop the README's own image (we render our own visual instead).
    const readmeImg = content.querySelector("img");
    if (readmeImg) {
        const imgContainer = readmeImg.closest("figure, p, div");
        if (imgContainer && imgContainer !== content &&
            (imgContainer.tagName.toLowerCase() === "p" ||
             (imgContainer.children.length === 1 && imgContainer.textContent.trim() === ""))) {
            imgContainer.remove();
        } else {
            readmeImg.remove();
        }
    }

    const visual = document.createElement("div");
    visual.className = "d-desc-visual";
    if (figureSvg) {
        visual.innerHTML = figureSvg;
    } else if (readmeImg) {
        // No bespoke figure for this problem — fall back to the README image.
        const visualImg = readmeImg.cloneNode(true);
        visualImg.removeAttribute("align");
        visualImg.removeAttribute("width");
        visualImg.removeAttribute("height");
        visual.appendChild(visualImg);
    } else {
        // Nothing to show alongside — leave the description full-width.
        descRoot.appendChild(content);
        return;
    }

    const firstElement = content.firstElementChild;
    const leadHeading =
        firstElement && /^(H1|H2|H3)$/i.test(firstElement.tagName) ? firstElement : null;

    const columns = document.createElement("div");
    columns.className = "d-desc-columns";
    columns.appendChild(content);
    columns.appendChild(visual);

    descRoot.innerHTML = "";
    descRoot.classList.add("d-desc-layout");
    if (leadHeading) descRoot.appendChild(leadHeading);
    descRoot.appendChild(columns);
}

async function initProblemPage() {
    qInitCommon();
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id") || "";
    const container = document.getElementById("prob-detail");

    if (!id) {
        qShowError(container, "Missing problem id in URL.");
        return;
    }

    try {
        const [p, submissionGroups] = await Promise.all([
            qLoadProblemData(id),
            qLoadProblemSubmissionGroups(id).catch(() => []),
        ]);
        currentProblem = p;
        const solved = (p.instances || []).filter((i) => ["optimal", "solved"].includes(i.status)).length;
        const renderedDesc = p.description_md ? rewriteDescriptionImageSources(qRenderMarkdown(p.description_md), p) : null;

        // Problem-specific instance columns (e.g. Nodes / Edges for MIS).
        const metricCols = Array.isArray(p.columns) ? p.columns : [];
        const metricHead = metricCols
            .map((c) => `<th${c.numeric ? ' style="text-align:right"' : ""}>${qEsc(c.label)}</th>`)
            .join("");
        const metricCells = (inst) =>
            metricCols
                .map((c) => {
                    const v = inst.metrics ? inst.metrics[c.key] : undefined;
                    if (v == null || v === "") return `<td${c.numeric ? ' class="num"' : ""}>-</td>`;
                    return `<td${c.numeric ? ' class="num"' : ""}>${c.numeric ? qFmtNum(v) : qEsc(v)}</td>`;
                })
                .join("");

        // Build once (performanceSection records module state used by wirePerformance).
        const perfBody = performanceSection(p);

        container.innerHTML = `
            <div class="dh">
                <div>
                    <div class="d-num">${String(p.id).padStart(2, "0")} / ${qEsc(p.slug)}</div>
                    <div class="d-title">${qEsc(p.name)}</div>
                    <div class="d-sub">${qEsc(p.short)}</div>
                    <div class="pcard-foot">
                        <span class="badge b-type">${qEsc(p.type)}</span>
                        <span class="badge b-form">${qEsc(p.formulation)}</span>
                        ${(p.tags || []).map((t) => `<span class="badge b-tag">${qEsc(t)}</span>`).join("")}
                    </div>
                </div>
                <div class="d-meta">
                    <div class="mr"><span class="mk">Instances</span><span class="mv">${p.instance_count}</span></div>
                    <div class="mr"><span class="mk">Optimally solved</span><span class="mv">${solved} / ${p.instance_count}</span></div>
                    ${p.vars_min != null ? `<div class="mr"><span class="mk">Variable range</span><span class="mv">${p.vars_min}-${p.vars_max}</span></div>` : ""}
                    <div class="mr"><span class="mk">Objective</span><span class="mv">${p.minimize ? "minimize" : "maximize"}</span></div>
                </div>
            </div>
            ${p.description_md ? `<div class="d-desc">${renderedDesc}</div>` : p.description ? `<p class="d-desc">${qEsc(p.description)}</p>` : ""}
            ${!p.description_md && p.formula ? `<div class="formula">${qEsc(p.formula)}</div>` : ""}

            ${perfBody ? collapsibleSection("Performance", perfBody) : ""}

            ${collapsibleSection("Submissions", submissionsSection(p, submissionGroups), submissionGroups.length)}

            ${collapsibleSection("Instances", `
                <div style="display:flex;justify-content:flex-end;margin-bottom:0.7rem">
                    <button class="btn btn-ghost btn-sm" type="button" onclick="downloadProblemInstancesCsv()">⬇ Download CSV</button>
                </div>
                <div class="tw">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                ${metricHead}
                                <th style="text-align:right">Best objective</th>
                                <th>Source</th>
                                <th>Status</th>
                                <th>Download</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(p.instances || [])
                                .map(
                                    (i) => `
                                    <tr>
                                        <td class="mono"><a class="rlink mono" href="${qInstanceUrl(p.id, i.name)}">${qEsc(i.name)}</a></td>
                                        ${metricCells(i)}
                                        <td class="num">${i.best_is_optimal ? `<strong>${qFmtNum(i.best_value ?? i.bkv)}</strong>` : qFmtNum(i.best_value ?? i.bkv)}</td>
                                        <td>${i.best_source_url ? `<a class="dl" href="${qEsc(i.best_source_url)}" target="_blank">${qEsc(i.best_source_label || i.best_source_type || "source")}</a>` : "-"}</td>
                                        <td>${qStatusPill(i.status)}</td>
                                        <td><a class="dl" href="${qEsc(i.raw_url)}" target="_blank">↓ raw</a>${i.models?.length ? ` ${qModelLinks(i.models)}` : ""}</td>
                                    </tr>`,
                                )
                                .join("")}
                        </tbody>
                    </table>
                </div>`, p.instance_count)}

            <div class="hero-actions" style="margin-top:1.5rem">
                <a class="btn btn-ghost" href="${qEsc(p.github_url)}" target="_blank">View on GitHub ↗</a>
                <a class="btn btn-navy" href="leaderboard.html">View Leaderboard</a>
                <a class="btn btn-ghost" href="instances.html">Browse All Instances</a>
            </div>
        `;

        wirePerformance();

        const desc = container.querySelector(".d-desc");
        if (desc) {
            layoutDescriptionImage(desc, p);
            qRenderMath(desc);
        }
    } catch (error) {
        qShowError(container, error.message);
    }
}

function downloadProblemInstancesCsv() {
    const p = currentProblem;
    if (!p) return;
    const cols = Array.isArray(p.columns) ? p.columns : [];
    const headers = ["Instance", ...cols.map((c) => c.label), "Best objective", "Optimal", "Status", "Source", "Source URL", "Raw URL"];
    const data = (p.instances || []).map((i) => [
        i.name,
        ...cols.map((c) => (i.metrics && i.metrics[c.key] != null ? i.metrics[c.key] : "")),
        i.best_value ?? i.bkv ?? "",
        i.best_is_optimal ? "yes" : "",
        i.status,
        i.best_source_label || i.best_source_type || "",
        i.best_source_url || "",
        i.raw_url || "",
    ]);
    qDownloadCsv(`qoblib_${p.slug || p.id}_instances.csv`, headers, data);
}

window.downloadProblemInstancesCsv = downloadProblemInstancesCsv;

initProblemPage();
