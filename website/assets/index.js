"use strict";

const {
    esc: qEsc,
    loadIndex: qLoadIndex,
    problemCard: qProblemCard,
    animateCount: qAnimateCount,
    showError: qShowError,
    initCommon: qInitCommon,
    enhanceFigures: qEnhanceFigures,
    attachFigureExpand: qAttachFigureExpand,
} = window.QOBLIB;

// Affiliation logos live in this folder (path is relative to the website root).
// Any entry below may set an optional `logo` field naming a file in that folder,
// e.g. `logo: "zib.svg"`. When present the carousel shows the image (and falls
// back to the institution name if the file is missing or fails to load); when
// absent it shows the name as text. See the folder's README.md for the naming
// convention and the suggested filename for each affiliation.
const AFFILIATION_LOGO_DIR = "assets/images/affiliations/";

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

function contributorMedia(entry) {
    const name = qEsc(entry.name);
    // The name span is always present so it can act as the fallback when a
    // logo is configured but the image is missing/broken (see the error
    // handler in renderCommunityContributors).
    const nameEl = `<span class="community-name">${name}</span>`;
    if (entry.logo) {
        const src = qEsc(AFFILIATION_LOGO_DIR + entry.logo);
        return (
            '<span class="community-card-media has-logo">' +
            `<img class="community-logo" src="${src}" alt="${name} logo" loading="lazy" />` +
            nameEl +
            "</span>"
        );
    }
    return `<span class="community-card-media">${nameEl}</span>`;
}

function contributorCard(entry) {
    const name = qEsc(entry.name);
    const body = `${contributorMedia(entry)}<span class="community-role">${qEsc(entry.role)}</span>`;
    if (entry.url) {
        const externalAttrs = entry.url.startsWith("http") ? ' target="_blank" rel="noopener"' : "";
        return `<a class="community-card" href="${qEsc(entry.url)}"${externalAttrs} title="${name}">${body}</a>`;
    }
    return `<div class="community-card" title="${name}">${body}</div>`;
}

function renderCommunityContributors() {
    const grid = document.getElementById("community-grid");
    if (!grid) return;
    // Build an auto-scrolling marquee: the card set is rendered twice so the
    // track can loop seamlessly via a -50% translate. The second copy is a
    // visual duplicate only, hidden from assistive tech.
    const cards = COMMUNITY_CONTRIBUTORS.map(contributorCard).join("");
    grid.innerHTML =
        '<div class="community-track">' +
        `<div class="community-group">${cards}</div>` +
        // The second copy only exists so the marquee can loop seamlessly. `inert`
        // (alongside aria-hidden) keeps its duplicate links out of the tab order
        // and off assistive tech, instead of exposing every contributor twice.
        `<div class="community-group" aria-hidden="true" inert>${cards}</div>` +
        "</div>";
    // If a configured logo is missing or fails to load, reveal the text name.
    grid.querySelectorAll("img.community-logo").forEach((img) => {
        const markFailed = () => {
            const media = img.closest(".community-card-media");
            if (media) media.classList.add("logo-failed");
        };
        img.addEventListener("error", markFailed);
        if (img.complete && img.naturalWidth === 0) markFailed();
    });
}

// The whole card's content (main scatter + legend + inset sub-plots + caption),
// wrapped for the lightbox so an expanded landscape keeps everything the card
// shows — not just the first SVG.
function landscapeFigureHtml(card) {
    const inner = Array.from(card.children)
        .filter((c) => !c.classList.contains("fig-expand"))
        .map((c) => c.outerHTML)
        .join("");
    return inner ? `<div class="landscape-expanded">${inner}</div>` : "";
}

// Inject the pre-rendered complexity-landscape scatter SVGs (built once by
// misc/site_builder/landscape.py → data/landscape.json) into the two plot cards.
async function renderLandscape() {
    const targets = [
        ["landscape-mip", "mip"],
        ["landscape-qubo", "qubo"],
    ].map(([id, key]) => [document.getElementById(id), key]);
    if (!targets.some(([el]) => el)) return;

    const fill = (el, html) => {
        if (!el) return;
        el.innerHTML = html || '<div class="empty-state" style="padding:2rem">No data available.</div>';
    };
    try {
        const res = await fetch("data/landscape.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        targets.forEach(([el, key]) => fill(el, data[key]));
        // Expand to the full card (main scatter + legend + inset sub-plots +
        // caption), not just the first SVG, so nothing is lost when enlarged.
        targets.forEach(([el]) => {
            if (el && el.querySelector("svg")) {
                qAttachFigureExpand(el, { html: () => landscapeFigureHtml(el) });
            }
        });
        qEnhanceFigures(document); // any other figures on the page
    } catch (error) {
        targets.forEach(([el]) => {
            if (el) el.innerHTML = '<div class="empty-state" style="padding:2rem">Could not load the landscape plot.</div>';
        });
    }
}

async function initHomePage() {
    qInitCommon();
    renderCommunityContributors();
    renderLandscape();
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
        // Clear the perpetual "…" loading spinner on the stat numbers so a failed
        // load reads as an error state rather than a hang.
        ["s-inst", "s-subs", "s-solved"].forEach((id) => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.remove("loading-val");
                el.textContent = "—";
            }
        });
        qShowError(document.getElementById("pgrid"), error.message);
    }
}

initHomePage();
