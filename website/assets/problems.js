"use strict";

const {
    esc: qEsc,
    loadIndex: qLoadIndex,
    problemUrl: qProblemUrl,
    problemCard: qProblemCard,
    showError: qShowError,
    initCommon: qInitCommon,
} = window.QOBLIB;

async function initProblemsPage() {
    qInitCommon();
    try {
        const idx = await qLoadIndex();
        const problems = idx.problems || [];

        // Quick-jump chips: a compact, scannable index that links straight to
        // any of the ten problem detail pages without scrolling the cards.
        const jump = document.getElementById("prob-jump");
        if (jump) {
            jump.innerHTML = problems
                .map(
                    (p) => `
                <a class="jump-chip" href="${qProblemUrl(p.id)}">
                    <span class="jump-num">${String(p.id).padStart(2, "0")}</span>
                    <span class="jump-name">${qEsc(p.name)}</span>
                </a>`,
                )
                .join("");
        }

        const grid = document.getElementById("pgrid");
        grid.innerHTML = problems.map(qProblemCard).join("");
    } catch (error) {
        qShowError(document.getElementById("pgrid"), error.message);
    }
}

initProblemsPage();
