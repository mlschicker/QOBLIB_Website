"use strict";

const {
    esc: qEsc,
    loadIndex: qLoadIndex,
    problemCard: qProblemCard,
    animateCount: qAnimateCount,
    showError: qShowError,
    initCommon: qInitCommon,
} = window.QOBLIB;

const COMMUNITY_CONTRIBUTORS = [
    {
        name: "Zuse Institute Berlin",
        short: "ZIB",
        mark: "ZIB",
        kind: "Institute",
        url: "https://www.zib.de",
        role: "Repository stewardship, benchmark maintenance, and website development.",
    },
    {
        name: "IBM Quantum",
        short: "IBM",
        mark: "IBM Quantum",
        kind: "Company",
        url: "https://www.ibm.com/quantum",
        role: "Initiated the Quantum Optimization Working Group effort with partners.",
    },
    {
        name: "Purdue Davidson School of Chemical Engineering",
        short: "Purdue ChE",
        mark: "Purdue ChE",
        kind: "University",
        url: "https://engineering.purdue.edu/ChE",
        role: "Academic contributor affiliation and benchmark community participation.",
    },
    {
        name: "Quantum Optimization Working Group",
        short: "QOWG",
        mark: "QOWG",
        kind: "Working group",
        role: "Core benchmark design, paper contributions, and community coordination.",
    },
    {
        name: "Community submitters",
        short: "PR",
        mark: "Submitters",
        kind: "Submissions",
        url: "submissions.html",
        role: "Benchmark solutions, bounds, and performance records contributed by pull request.",
    },
];

function contributorInitials(entry) {
    if (entry.mark) return entry.mark;
    if (entry.short) return entry.short;
    return String(entry.name || "")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 3)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
}

function contributorLogo(entry) {
    const label = qEsc(entry.name);
    if (entry.logo) {
        return `<img src="${qEsc(entry.logo)}" alt="${label} logo" loading="lazy" />`;
    }
    return `<span>${qEsc(contributorInitials(entry))}</span>`;
}

function contributorCard(entry) {
    const body = `
        <span class="community-logo" aria-hidden="true">${contributorLogo(entry)}</span>
        <span class="community-card-copy">
            <span class="community-kind">${qEsc(entry.kind || "Contributor")}</span>
            <span class="community-name">${qEsc(entry.name)}</span>
            <span class="community-role">${qEsc(entry.role)}</span>
        </span>
    `;
    if (entry.url) {
        const externalAttrs = entry.url.startsWith("http") ? ' target="_blank" rel="noopener"' : "";
        return `<a class="community-card" href="${qEsc(entry.url)}"${externalAttrs}>${body}</a>`;
    }
    return `<div class="community-card">${body}</div>`;
}

function renderCommunityContributors() {
    const grid = document.getElementById("community-grid");
    if (!grid) return;
    grid.innerHTML = COMMUNITY_CONTRIBUTORS.map(contributorCard).join("");
}

async function initHomePage() {
    qInitCommon();
    renderCommunityContributors();
    try {
        const idx = await qLoadIndex();
        qAnimateCount("s-inst", idx.total_instances || 0);
        qAnimateCount("s-subs", idx.total_submissions || 0);
        qAnimateCount(
            "s-solved",
            (idx.problems || []).reduce((sum, p) => sum + (p.solved_count || 0), 0),
        );

        const grid = document.getElementById("pgrid");
        grid.innerHTML = (idx.problems || []).map(qProblemCard).join("");
    } catch (error) {
        qShowError(document.getElementById("pgrid"), error.message);
    }
}

initHomePage();
