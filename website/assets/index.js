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
        kind: "Affiliation 1",
        url: "https://www.zib.de",
        role: "Berlin, Germany",
    },
    {
        name: "Technische Universität Berlin",
        short: "TU Berlin",
        mark: "TU Berlin",
        kind: "Affiliation 2",
        url: "https://www.tu.berlin",
        role: "Berlin, Germany",
    },
    {
        name: "Davidson School of Chemical Engineering, Purdue University",
        short: "Purdue ChE",
        mark: "Purdue ChE",
        kind: "Affiliation 3",
        url: "https://engineering.purdue.edu/ChE",
        role: "West Lafayette, IN, USA",
    },
    {
        name: "Department of Mathematics & Risk Management Institute, National University of Singapore",
        short: "NUS",
        mark: "NUS",
        kind: "Affiliation 4",
        url: "https://www.nus.edu.sg",
        role: "Singapore, Singapore",
    },
    {
        name: "E.ON Digital Technology GmbH",
        short: "E.ON",
        mark: "E.ON",
        kind: "Affiliation 5",
        url: "https://www.eon.com",
        role: "Essen, Germany",
    },
    {
        name: "IBM Quantum, IBM Research Europe - Zurich",
        short: "IBM Zurich",
        mark: "IBM Zurich",
        kind: "Affiliation 6",
        url: "https://research.ibm.com/labs/zurich",
        role: "Zurich, Switzerland",
    },
    {
        name: "NTT Data",
        short: "NTT Data",
        mark: "NTT Data",
        kind: "Affiliation 7",
        url: "https://www.nttdata.com",
        role: "Tokyo, Japan",
    },
    {
        name: "Kipu Quantum GmbH",
        short: "Kipu Quantum",
        mark: "Kipu Quantum",
        kind: "Affiliation 8",
        url: "https://kipu-quantum.com",
        role: "Karlsruhe, Germany",
    },
    {
        name: "University of the Basque Country UPV/EHU",
        short: "UPV/EHU",
        mark: "UPV/EHU",
        kind: "Affiliation 9",
        url: "https://www.ehu.eus/en",
        role: "Leioa, Spain",
    },
    {
        name: "University of Southern California",
        short: "USC",
        mark: "USC",
        kind: "Affiliation 10",
        url: "https://www.usc.edu",
        role: "Los Angeles, CA, USA",
    },
    {
        name: "IBM Quantum, IBM Research Tokyo",
        short: "IBM Tokyo",
        mark: "IBM Tokyo",
        kind: "Affiliation 11",
        url: "https://research.ibm.com/labs/tokyo",
        role: "Tokyo, Japan",
    },
    {
        name: "Quantagonia GmbH",
        short: "Quantagonia",
        mark: "Quantagonia",
        kind: "Affiliation 12",
        url: "https://www.quantagonia.com",
        role: "Bad Homburg, Germany",
    },
    {
        name: "Federal University of Rio de Janeiro",
        short: "UFRJ",
        mark: "UFRJ",
        kind: "Affiliation 13",
        url: "https://ufrj.br/en",
        role: "Rio de Janeiro, Brazil",
    },
    {
        name: "Forschungszentrum Jülich",
        short: "FZJ",
        mark: "FZ Jülich",
        kind: "Affiliation 14",
        url: "https://www.fz-juelich.de/en",
        role: "Jülich, Germany",
    },
    {
        name: "Hiroshima University",
        short: "Hiroshima",
        mark: "Hiroshima",
        kind: "Affiliation 15",
        url: "https://www.hiroshima-u.ac.jp/en",
        role: "Higashihiroshima, Japan",
    },
    {
        name: "T-Systems International GmbH",
        short: "T-Systems",
        mark: "T-Systems",
        kind: "Affiliation 16",
        url: "https://www.t-systems.com",
        role: "Frankfurt am Main, Germany",
    },
    {
        name: "IBM Quantum, IBM Research Europe - Dublin",
        short: "IBM Dublin",
        mark: "IBM Dublin",
        kind: "Affiliation 17",
        url: "https://research.ibm.com/labs/dublin",
        role: "Dublin, Republic of Ireland",
    },
    {
        name: "Ghent University",
        short: "Ghent",
        mark: "Ghent",
        kind: "Affiliation 18",
        url: "https://www.ugent.be/en",
        role: "Ghent, Belgium",
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
