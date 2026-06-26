"use strict";

const {
    esc: qEsc,
    fmtNum: qFmtNum,
    fmtText: qFmtText,
    parseDate: qParseDate,
    fmtDate: qFmtDate,
    loadIndex: qLoadIndex,
    loadProblemData: qLoadProblemData,
    instanceUrl: qInstanceUrl,
    problemUrl: qProblemUrl,
    submissionUrl: qSubmissionUrl,
    statusPill: qStatusPill,
    showError: qShowError,
    initCommon: qInitCommon,
    classifySubmission: qClassify,
    SUBMISSION_CATEGORIES: qCATS,
    catBadge: qCatBadge,
    downloadCsv: qDownloadCsv,
    fmtMaybeNum: qFmtMaybeNum,
    enableTableSorting: qEnableTableSorting,
} = window.QOBLIB;

function lbNum(v) {
    if (v == null || v === "") return NaN;
    const n = Number(String(v).replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : NaN;
}

function lbDate(v) {
    return qParseDate(v);
}

// A submission counts only if it reported at least one feasible solution.
function lbFeasible(s) {
    const nf = lbNum(s.n_feasible);
    return !(Number.isFinite(nf) && nf === 0);
}

// A feasibility problem (e.g. Market Split, Sports Tournament): the goal is a
// feasible point, so every known best-value is 0. There a feasible submission
// counts even when it reports no objective value.
function lbIsFeasibilityProblem(p) {
    let sawZero = false;
    for (const i of p.instances || []) {
        const bv = lbNum(i.best_value ?? i.bkv);
        if (!Number.isFinite(bv)) continue;
        if (bv !== 0) return false;
        sawZero = true;
    }
    return sawZero;
}

let records = [];
let indexData = null;

async function initLeaderboardPage() {
    qInitCommon();

    try {
        indexData = await qLoadIndex();
        const problems = indexData.problems || [];
        const datas = await Promise.all(problems.map((p) => qLoadProblemData(p.id)));

        // Build one record per instance: the best feasible submission (the holder).
        records = [];
        datas.forEach((p) => {
            const minimize = p.minimize !== false;
            const feas = lbIsFeasibilityProblem(p); // feasible point is the goal; no value required
            const entries = p.instance_submissions || {};
            (p.instances || []).forEach((inst) => {
                const subs = (entries[inst.name] || [])
                    .filter(lbFeasible)
                    .map((s) => {
                        const raw = lbNum(s.value);
                        const noValue = !Number.isFinite(raw);
                        // On a feasibility problem a feasible-but-valueless submission
                        // achieves the objective of 0; keep it and score it as 0.
                        const v = noValue && feas ? 0 : raw;
                        return { s, v, noValue, t: lbDate(s.date), rt: lbNum(s.runtime_total) };
                    })
                    .filter((o) => Number.isFinite(o.v));
                if (!subs.length) return; // no usable feasible submission → no record yet

                // Best objective, then earliest to reach it, then fastest.
                subs.sort(
                    (a, b) =>
                        (minimize ? a.v - b.v : b.v - a.v) ||
                        (Number.isFinite(a.t) ? a.t : Infinity) - (Number.isFinite(b.t) ? b.t : Infinity) ||
                        (Number.isFinite(a.rt) ? a.rt : Infinity) - (Number.isFinite(b.rt) ? b.rt : Infinity),
                );
                const champ = subs[0];
                const c = champ.s;
                const bestKnown = lbNum(inst.best_value ?? inst.bkv);
                const scale = Math.max(1, Math.abs(bestKnown), Math.abs(champ.v));
                const reachedBest = feas
                    ? Math.abs(champ.v) <= 1e-9 // a feasible point achieves the 0 objective
                    : Number.isFinite(bestKnown) && Math.abs(champ.v - bestKnown) <= 1e-9 * scale;

                records.push({
                    problem_id: p.id,
                    instance: inst.name,
                    status: inst.status,
                    value: champ.v,
                    noValue: champ.noValue && feas, // feasible point with no reported objective
                    reachedBest,
                    nSubs: subs.length,
                    holder: c.submitter || c.author || "",
                    category: c.category || qClassify(c),
                    date: c.date || "",
                    runtime: c.runtime_total,
                    source_dir: c._source_dir || "",
                });
            });
        });

        const lbProb = document.getElementById("lb-prob");
        problems.forEach((p) => {
            const o = document.createElement("option");
            o.value = p.id;
            o.textContent = `${String(p.id).padStart(2, "0")} - ${p.name}`;
            lbProb.appendChild(o);
        });

        renderLeaderboard();
    } catch (error) {
        qShowError(document.getElementById("lb-content"), error.message);
    }
}

function renderLeaderboard() {
    const pid = document.getElementById("lb-prob").value || "";

    // Repopulate the instance filter for the chosen problem.
    const instSel = document.getElementById("lb-inst");
    const cur = instSel.value;
    instSel.innerHTML = '<option value="">All instances</option>';
    records
        .filter((r) => !pid || r.problem_id === pid)
        .forEach((r) => {
            const o = document.createElement("option");
            o.value = r.instance;
            o.textContent = r.instance;
            instSel.appendChild(o);
        });
    instSel.value = cur;

    const rows = getLeaderboardRows();

    document.getElementById("lb-count").textContent = `${rows.length} record${rows.length !== 1 ? "s" : ""}`;

    const content = document.getElementById("lb-content");
    // This page rebuilds its whole <table> on every filter change, which would
    // otherwise drop any column sort the user picked. Capture it first, then
    // restore it onto the freshly-built table below.
    const prevSort = content.querySelector("table")?.qoblibSort;

    if (!rows.length) {
        const filtering = pid || (document.getElementById("lb-inst").value || "");
        content.innerHTML = `<div class="lb-empty">${filtering ? "No records match the current filters." : "No submissions yet."}</div>`;
        return;
    }

    content.innerHTML = `<div class="tw"><table>
        <thead>
            <tr>
                <th>Instance</th>
                <th>Problem</th>
                <th style="text-align:right">Best objective</th>
                <th>Status</th>
                <th>Holder</th>
                <th>Type</th>
                <th>Date</th>
                <th style="text-align:right">Runtime (s)</th>
                <th style="text-align:right">Subs</th>
            </tr>
        </thead>
        <tbody>
            ${rows
                .map(
                    (r) => `
                        <tr>
                            <td class="mono"><a class="rlink mono" href="${qInstanceUrl(r.problem_id, r.instance)}">${qEsc(r.instance)}</a></td>
                            <td><a class="badge b-type" href="${qProblemUrl(r.problem_id)}">${String(r.problem_id).padStart(2, "0")}</a></td>
                            <td class="num" style="font-weight:600">${r.noValue ? '<span title="A feasible solution was found; this problem reports no objective value">feasible</span>' : qFmtNum(r.value)}${r.reachedBest ? ' <span title="Reaches the best-known objective" style="color:var(--star)">★</span>' : ""}</td>
                            <td>${qStatusPill(r.status)}</td>
                            <td>${r.source_dir ? `<a class="rlink" href="${qSubmissionUrl(r.problem_id, r.source_dir)}">${qFmtText(r.holder)}</a>` : qFmtText(r.holder)}</td>
                            <td>${qCatBadge(r.category)}</td>
                            <td class="mono">${qEsc(qFmtDate(r.date))}</td>
                            <td class="num">${qFmtMaybeNum(r.runtime)}</td>
                            <td class="num">${r.nSubs}</td>
                        </tr>`,
                )
                .join("")}
        </tbody>
    </table></div>
    <div class="table-legend" style="margin:.4rem 0 .6rem;color:var(--muted)">One record per instance: the best feasible submission and who holds it. ★ = reaches the best-known objective. "Subs" counts the ranked feasible submissions for that instance.</div>`;

    // Bind sorting on the new table now (rather than waiting for the async
    // MutationObserver) so we can immediately restore the user's prior sort.
    if (prevSort) {
        const table = content.querySelector("table");
        if (table) {
            qEnableTableSorting(content);
            table.qoblibSort = prevSort;
            table.reapplySort?.();
        }
    }
}

function getLeaderboardRows() {
    const pid = document.getElementById("lb-prob").value || "";
    const iid = document.getElementById("lb-inst").value || "";
    return records
        .filter((r) => (!pid || r.problem_id === pid) && (!iid || r.instance === iid))
        .sort(
            (a, b) =>
                String(a.problem_id).localeCompare(String(b.problem_id)) ||
                String(a.instance).localeCompare(String(b.instance)),
        );
}

function downloadLeaderboardCsv() {
    const rows = getLeaderboardRows();
    const headers = [
        "Problem ID", "Instance", "Best objective", "Reaches best", "Status",
        "Holder", "Type", "Date", "Runtime (s)", "Submissions",
    ];
    const data = rows.map((r) => [
        String(r.problem_id).padStart(2, "0"),
        r.instance,
        r.noValue ? "feasible" : r.value,
        r.reachedBest ? "yes" : "",
        r.status,
        r.holder,
        (qCATS[r.category] || qCATS.classical).label,
        qFmtDate(r.date),
        r.runtime ?? "",
        r.nSubs,
    ]);
    qDownloadCsv("qoblib_leaderboard.csv", headers, data);
}

window.renderLeaderboard = renderLeaderboard;
window.downloadLeaderboardCsv = downloadLeaderboardCsv;

initLeaderboardPage();
