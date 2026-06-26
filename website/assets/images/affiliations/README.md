# Affiliation logos

Logos shown in the **affiliations carousel** on the homepage
([`website/index.html`](../../../index.html)). The carousel is rendered by
[`website/assets/index.js`](../../index.js).

This folder is intentionally (almost) empty for now — the site already works
without logos by showing each institution's name as text. Drop logo files in
here over time and they will appear automatically.

## How to add a logo

1. Add the image file to this folder (see naming + format below).
2. In [`website/assets/index.js`](../../index.js), find the matching entry in
   the `COMMUNITY_CONTRIBUTORS` array and add a `logo` field with the filename:

   ```js
   {
       name: "Zuse Institute Berlin",
       short: "ZIB",
       url: "https://www.zib.de",
       role: "Berlin, Germany",
       logo: "zib.svg",          // <-- file in this folder
   },
   ```

That's it. The chip will show the logo instead of the name. If the file is
missing or fails to load, the carousel falls back to the institution name, so a
typo or a not-yet-added file never breaks the layout.

The folder location is configured once via `AFFILIATION_LOGO_DIR` at the top of
`index.js`; the `logo` field is just the filename, not a full path.

## File format

- **Prefer SVG.** Otherwise use a PNG/WebP with a **transparent background**.
- Logos are rendered at up to **42px tall** (`object-fit: contain`), so a wide
  aspect ratio (wordmark) works well. Include a little internal padding.
- **Dark mode:** the carousel background follows the site theme. Use a logo that
  reads on both light and dark surfaces (e.g. a logo with its own color, or a
  duotone/outline mark). Pure-black marks may disappear in dark mode.
- Use lowercase, hyphenated filenames.

## Suggested filenames

One row per current affiliation (order matches the paper's author list). IBM
Quantum sites can share a single `ibm-quantum.svg`.

| Affiliation                                   | Suggested filename     |
| --------------------------------------------- | ---------------------- |
| Zuse Institute Berlin                         | `zib.svg`              |
| Technische Universität Berlin                 | `tu-berlin.svg`        |
| Davidson School of Chemical Eng., Purdue      | `purdue.svg`           |
| National University of Singapore              | `nus.svg`              |
| E.ON Digital Technology GmbH                  | `eon.svg`              |
| IBM Quantum, IBM Research Europe – Zurich     | `ibm-quantum.svg`      |
| NTT Data                                      | `ntt-data.svg`         |
| Kipu Quantum GmbH                             | `kipu-quantum.svg`     |
| University of the Basque Country UPV/EHU      | `upv-ehu.svg`          |
| University of Southern California             | `usc.svg`              |
| IBM Quantum, IBM Research Tokyo               | `ibm-quantum.svg`      |
| Quantagonia GmbH                              | `quantagonia.svg`      |
| Federal University of Rio de Janeiro          | `ufrj.svg`             |
| Forschungszentrum Jülich                      | `fz-juelich.svg`       |
| Hiroshima University                          | `hiroshima.svg`        |
| T-Systems International GmbH                  | `t-systems.svg`        |
| IBM Quantum, IBM Research Europe – Dublin     | `ibm-quantum.svg`      |
| Ghent University                              | `ghent.svg`            |

These are only suggestions — any filename works as long as the `logo` field in
`index.js` matches.
