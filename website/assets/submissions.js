"use strict";

const {
    esc: qEsc,
    parseDate: qParseDate,
    fmtDate: qFmtDate,
    loadIndex: qLoadIndex,
    loadAllSubmissionGroups: qLoadAllSubmissionGroups,
    problemUrl: qProblemUrl,
    submissionUrl: qSubmissionUrl,
    initCommon: qInitCommon,
    classifySubmission: qClassify,
    SUBMISSION_CATEGORIES: qCATS,
    catBadge: qCatBadge,
    downloadCsv: qDownloadCsv,
} = window.QOBLIB;

let allGroups = [];
let problemIndex = new Map();

// Compute-paradigm of a submission package. The builder tags each package with
// a `category` (the dominant paradigm of its rows); fall back to classifying
// the collapsed profile so the page still works against older data payloads.
function groupCategory(group) {
    return group.category || qClassify(group.profile || {});
}

function groupSearchText(group, problem) {
    const profile = group.profile || {};
    const sourceFiles = (group.source_files || []).join(" ");
    const instanceNames = (group.instances || []).map((item) => item.instance).join(" ");
    const cat = qCATS[groupCategory(group)] || qCATS.classical;
    return [
        group.id,
        group.source_dir,
        problem?.name,
        problem?.slug,
        profile.submitter,
        profile.date,
        qFmtDate(profile.date),
        profile.workflow,
        profile.hardware,
        profile.modeling_approach,
        profile.algorithm_type,
        cat.label,
        cat.short,
        sourceFiles,
        instanceNames,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
}

function formatProblemLabel(problem) {
    if (!problem) return "-";
    return `${String(problem.id).padStart(2, "0")} - ${problem.name}`;
}

function renderStats(groups) {
    const totalInstances = groups.reduce((sum, group) => sum + (group.instances || []).length, 0);
    const problems = new Set(groups.map((group) => group.problem_id)).size;
    const authors = new Set(groups.map((group) => group.profile?.submitter || "").filter(Boolean)).size;
    document.getElementById("sub-stat-packages").textContent = groups.length.toLocaleString();
    document.getElementById("sub-stat-instances").textContent = totalInstances.toLocaleString();
    document.getElementById("sub-stat-problems").textContent = problems.toLocaleString();
    document.getElementById("sub-stat-authors").textContent = authors.toLocaleString();
}

function populateProblemFilter(indexData) {
    const select = document.getElementById("sub-prob");
    (indexData.problems || []).forEach((problem) => {
        const option = document.createElement("option");
        option.value = problem.id;
        option.textContent = formatProblemLabel(problem);
        select.appendChild(option);
    });
}

function getFilteredGroups() {
    const search = document.getElementById("sub-search").value.trim().toLowerCase();
    const problemId = document.getElementById("sub-prob").value || "";
    const category = document.getElementById("sub-cat").value || "";
    const sortMode = document.getElementById("sub-sort").value || "latest";

    const filtered = allGroups.filter((group) => {
        if (problemId && group.problem_id !== problemId) return false;
        if (category && groupCategory(group) !== category) return false;
        if (!search) return true;
        const problem = problemIndex.get(group.problem_id);
        return groupSearchText(group, problem).includes(search);
    });

    filtered.sort((a, b) => {
        // Compare on parsed timestamps so mixed source formats order correctly;
        // unparseable dates sort last. Newest first.
        const tsA = qParseDate(a.profile?.date);
        const tsB = qParseDate(b.profile?.date);
        const byDateDesc = (Number.isFinite(tsB) ? tsB : -Infinity) - (Number.isFinite(tsA) ? tsA : -Infinity);
        const instA = (a.instances || []).length;
        const instB = (b.instances || []).length;

        if (sortMode === "problem") {
            return String(a.problem_id).localeCompare(String(b.problem_id)) || byDateDesc || String(a.id).localeCompare(String(b.id));
        }
        if (sortMode === "instances") {
            return instB - instA || String(a.problem_id).localeCompare(String(b.problem_id)) || String(a.id).localeCompare(String(b.id));
        }
        if (sortMode === "package") {
            return String(a.id).localeCompare(String(b.id)) || String(a.problem_id).localeCompare(String(b.problem_id));
        }
        return byDateDesc || String(a.problem_id).localeCompare(String(b.problem_id)) || String(a.id).localeCompare(String(b.id));
    });

    return filtered;
}

function renderSubmissions() {
    const filtered = getFilteredGroups();
    document.getElementById("sub-count").textContent = `${filtered.length} submission${filtered.length !== 1 ? "s" : ""}`;

    const body = document.getElementById("sub-tbody");
    if (!filtered.length) {
        body.innerHTML = '<tr><td colspan="8" class="loading">No submissions match the current filters</td></tr>';
        return;
    }

    body.innerHTML = filtered
        .map((group) => {
            const problem = problemIndex.get(group.problem_id);
            const submitter = group.profile?.submitter || "-";
            const date = group.profile?.date ? qFmtDate(group.profile.date) : "-";
            const instanceCount = (group.instances || []).length;
            const fileCount = (group.source_files || []).length;
            return `
                <tr>
                    <td class="mono">
                        <a class="rlink mono" href="${qSubmissionUrl(group.problem_id, group.id)}">${qEsc(group.id)}</a>
                    </td>
                    <td><a class="badge b-type" href="${qProblemUrl(group.problem_id)}">${qEsc(formatProblemLabel(problem))}</a></td>
                    <td>${qCatBadge(groupCategory(group))}</td>
                    <td>${qEsc(submitter)}</td>
                    <td class="mono">${qEsc(date)}</td>
                    <td class="num">${instanceCount.toLocaleString()}</td>
                    <td class="num">${fileCount.toLocaleString()}</td>
                    <td><a class="dl" href="${qSubmissionUrl(group.problem_id, group.id)}">Open</a></td>
                </tr>`;
        })
        .join("");
}

async function initSubmissionsPage() {
    qInitCommon();

    try {
        const [indexData, groups] = await Promise.all([qLoadIndex(), qLoadAllSubmissionGroups()]);
        problemIndex = new Map((indexData.problems || []).map((problem) => [problem.id, problem]));
        allGroups = [...groups];

        populateProblemFilter(indexData);
        renderStats(allGroups);
        renderSubmissions();
    } catch (error) {
        document.getElementById("submissions-table").innerHTML = `<div class="error-box">Failed to load data: ${qEsc(error.message)}</div>`;
    }
}

function downloadSubmissionsCsv() {
    const groups = getFilteredGroups();
    const headers = [
        "Package", "Problem ID", "Problem", "Paradigm", "Submitter", "Date",
        "Instances", "Files", "Workflow", "Algorithm", "Hardware", "Source files",
    ];
    const data = groups.map((group) => {
        const problem = problemIndex.get(group.problem_id);
        const profile = group.profile || {};
        return [
            group.id,
            String(group.problem_id).padStart(2, "0"),
            problem?.name || "",
            (qCATS[groupCategory(group)] || qCATS.classical).label,
            profile.submitter || "",
            profile.date ? qFmtDate(profile.date) : "",
            (group.instances || []).length,
            (group.source_files || []).length,
            profile.workflow || "",
            profile.algorithm_type || "",
            profile.hardware || "",
            (group.source_files || []).join("; "),
        ];
    });
    qDownloadCsv("qoblib_submissions.csv", headers, data);
}

window.renderSubmissions = renderSubmissions;
window.downloadSubmissionsCsv = downloadSubmissionsCsv;
initSubmissionsPage();