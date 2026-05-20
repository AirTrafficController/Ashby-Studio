# Ashby Studio 

Interactive Ashby chart and materials-selection workbench for protective-suit design across extreme environments (space, deep sea, chemical/CBRN). Built with React + d3.

## Modes

The app has two modes, toggled in the top bar.

**Select** runs a four-step decision pipeline:

1. **Specify** — Pick environment and suit layer, set the operating temperature window. Materials whose max-use temperature falls below your requirement are filtered out.
2. **Weight** — Pairwise comparisons (Saaty 1–9 scale) on the criteria that matter for that layer. The app derives criterion weights via the principal-eigenvector AHP method and reports the consistency ratio (CR < 0.10 acceptable).
3. **Rank** — TOPSIS ranks the surviving candidates by closeness to the ideal best/worst, using the AHP weights. Top 3 are highlighted on the chart.
4. **Validate** — A Pugh matrix scores the top five candidates against a chosen baseline (defaults to the TOPSIS leader; switch to your current industry standard to verify the proposed change is an improvement).

**Browse** is the classical Ashby viewer: log-log envelopes, performance-index guide lines for minimum-mass design, CSV upload for your own data.

## Built-in materials database

Twenty-five suit materials nominal-valued from the project brief, covering:

- **Space**: Vectran, Kevlar, Nomex, Gore-Tex, beta cloth, Kapton, Mylar, polycarbonate, silica aerogel
- **Deep sea**: Ti-6Al-4V, aluminium-bronze, Inconel 718, syntactic foam, neoprene, butyl rubber, trilaminate, PMMA, borosilicate glass
- **Chemical**: PTFE, FEP, Viton (FKM), FFKM, Tychem 6000, Saranex, chlorinated PE

Each material carries density, Young's modulus, tensile strength, max-use temperature, ordinal cost (1–4), and ordinal chemical resistance (1–4), plus the layers it is plausibly suited for. Values are nominal — verify against data sheets before design commitment.

## Chart features

- Log-log convex-hull envelopes computed in log space, smoothed with centripetal Catmull–Rom
- Switchable chart axes by property (density, modulus, strength, max-use temperature)
- Performance-index guide lines for minimum-mass design: `E/ρ` (tie), `E^½/ρ` (beam), `E^⅓/ρ` (plate)
- Top 3 ranked candidates highlighted with rank colours; non-ranked materials fade
- Zoom, pan, hover readout, PNG export
- CSV upload for custom material scatter data

## Develop

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Deploy

Pushes to `main` auto-deploy to GitHub Pages via `.github/workflows/deploy.yml`.

First-time setup:

1. Create a GitHub repo named `ashby-studio` and push this project to it.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main`. First deploy takes 1–2 minutes.
4. Visit `https://<your-username>.github.io/ashby-studio/`.

If you rename the repo, update `base` in `vite.config.js` to match.

## CSV format (browse mode)

One file per material. First column may hold grade labels (ignored), second and third columns are x and y:

```
NAME,DENSITY,MODULUS_OF_ELASTICITY
ABS_low_density,0.882,0.778
ABS_high_density,3.5,6.1
...
```

Two-column files (just `x,y`) also work — the material takes the filename.

## Architecture

```
src/
├── App.jsx                       Top-level layout, mode toggle, chart, sidebars
├── theme.js                      Shared paper/ink palette
├── data/
│   └── materials.js              25-material database, cluster-point synth
├── lib/
│   └── mcdm.js                   AHP, TOPSIS, Pugh
└── components/
    └── SelectionWizard.jsx       4-step right panel
```

`mcdm.js` is dependency-free and unit-testable.
