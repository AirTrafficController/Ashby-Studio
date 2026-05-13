/* ============================================================
   MULTI-CRITERIA DECISION MAKING
   ============================================================
   - AHP (Saaty)        : pairwise comparisons → criterion weights
   - TOPSIS (Hwang/Yoon): rank alternatives by closeness to ideal
   - Pugh matrix         : qualitative vs baseline validation
   ============================================================ */

/* ---- AHP --------------------------------------------------- */

// Saaty's Random Index (Saaty 1980), used for consistency ratio
const SAATY_RI = {
  1: 0.00, 2: 0.00, 3: 0.58, 4: 0.90, 5: 1.12,
  6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49,
};

/**
 * Build a Saaty pairwise matrix from upper-triangular comparison values.
 * `upper` is a flat array of length n*(n-1)/2 containing the values for
 * positions (0,1),(0,2),...,(0,n-1),(1,2),... in row-major order.
 * Each value is on the Saaty scale: 1 = equal, 9 = first criterion absolutely
 * dominates the second. Use 1/k for the inverse direction (k > 1).
 */
export function buildPairwise(n, upper) {
  const M = Array.from({ length: n }, () => new Array(n).fill(1));
  let k = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const v = Number(upper[k]) || 1;
      M[i][j] = v;
      M[j][i] = 1 / v;
      k++;
    }
  }
  return M;
}

/**
 * AHP weights via the principal eigenvector (power iteration).
 * Returns weights, lambda_max, consistency index CI, and consistency ratio CR.
 * CR < 0.10 is conventionally acceptable.
 */
export function ahpWeights(matrix) {
  const n = matrix.length;
  if (n === 0) return { weights: [], lambdaMax: 0, CI: 0, CR: 0 };
  if (n === 1) return { weights: [1], lambdaMax: 1, CI: 0, CR: 0 };

  let w = new Array(n).fill(1 / n);
  for (let iter = 0; iter < 100; iter++) {
    const next = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) next[i] += matrix[i][j] * w[j];
    }
    const sum = next.reduce((a, b) => a + b, 0) || 1;
    const normalised = next.map((v) => v / sum);
    let delta = 0;
    for (let i = 0; i < n; i++) delta += Math.abs(normalised[i] - w[i]);
    w = normalised;
    if (delta < 1e-9) break;
  }

  // lambda_max via Aw / w
  let lambdaMax = 0;
  for (let i = 0; i < n; i++) {
    let row = 0;
    for (let j = 0; j < n; j++) row += matrix[i][j] * w[j];
    lambdaMax += row / (w[i] || 1e-12);
  }
  lambdaMax /= n;

  const CI = n > 1 ? (lambdaMax - n) / (n - 1) : 0;
  const RI = SAATY_RI[n] ?? 1.49;
  const CR = RI > 0 ? CI / RI : 0;

  return { weights: w, lambdaMax, CI, CR };
}

/* ---- TOPSIS ------------------------------------------------ */

/**
 * TOPSIS ranking.
 * @param alternatives  array of { id, name, props: { [criterionKey]: value } }
 * @param criteria      array of { key, beneficial }
 * @param weights       array of numbers (same length as criteria, sum = 1)
 * @returns sorted array of { id, name, score, sPlus, sMinus, ranks: [...] }
 *          highest score first.
 */
export function topsis(alternatives, criteria, weights) {
  const m = alternatives.length;
  const n = criteria.length;
  if (m === 0 || n === 0) return [];
  if (weights.length !== n) {
    throw new Error('weights length must equal criteria length');
  }

  // Build decision matrix
  const X = alternatives.map((a) =>
    criteria.map((c) => Number(a.props[c.key]) || 0)
  );

  // Vector normalisation per column (Hwang & Yoon's original)
  const denom = new Array(n).fill(0);
  for (let j = 0; j < n; j++) {
    let s = 0;
    for (let i = 0; i < m; i++) s += X[i][j] * X[i][j];
    denom[j] = Math.sqrt(s) || 1;
  }
  const R = X.map((row) => row.map((v, j) => v / denom[j]));

  // Weighted normalised
  const V = R.map((row) => row.map((v, j) => v * weights[j]));

  // Ideal best A* and ideal worst A-
  const aStar = new Array(n).fill(0);
  const aMinus = new Array(n).fill(0);
  for (let j = 0; j < n; j++) {
    const col = V.map((r) => r[j]);
    if (criteria[j].beneficial) {
      aStar[j] = Math.max(...col);
      aMinus[j] = Math.min(...col);
    } else {
      aStar[j] = Math.min(...col);
      aMinus[j] = Math.max(...col);
    }
  }

  // Distances and closeness coefficient
  const out = alternatives.map((a, i) => {
    let sPlus = 0;
    let sMinus = 0;
    const contributions = [];
    for (let j = 0; j < n; j++) {
      const dStar = V[i][j] - aStar[j];
      const dMinus = V[i][j] - aMinus[j];
      sPlus += dStar * dStar;
      sMinus += dMinus * dMinus;
      contributions.push({
        key: criteria[j].key,
        weighted: V[i][j],
        normalised: R[i][j],
        raw: X[i][j],
      });
    }
    sPlus = Math.sqrt(sPlus);
    sMinus = Math.sqrt(sMinus);
    const score = sPlus + sMinus > 0 ? sMinus / (sPlus + sMinus) : 0;
    return { id: a.id, name: a.name, score, sPlus, sMinus, contributions };
  });

  out.sort((a, b) => b.score - a.score);
  out.forEach((r, i) => { r.rank = i + 1; });
  return out;
}

/* ---- Pugh matrix ------------------------------------------- */

/**
 * Pugh concept-selection matrix.
 * Each candidate scored per criterion against the baseline:
 *    +1 better, 0 same, -1 worse
 * Uses a 5% tolerance band on the baseline value as the "same" zone.
 * Returns weighted totals (using the supplied criterion weights) and
 * raw +/0/- counts for each candidate.
 */
export function pughMatrix(baseline, candidates, criteria, weights) {
  const out = candidates.map((c) => {
    const cells = criteria.map((cr, j) => {
      const cv = Number(c.props[cr.key]);
      const bv = Number(baseline.props[cr.key]);
      const tol = Math.abs(bv) * 0.05;
      let score = 0;
      if (Number.isFinite(cv) && Number.isFinite(bv)) {
        const better = cr.beneficial ? cv > bv + tol : cv < bv - tol;
        const worse = cr.beneficial ? cv < bv - tol : cv > bv + tol;
        if (better) score = 1;
        else if (worse) score = -1;
      }
      return { key: cr.key, score, candidateValue: cv, baselineValue: bv };
    });
    const plus = cells.filter((s) => s.score > 0).length;
    const minus = cells.filter((s) => s.score < 0).length;
    const same = cells.length - plus - minus;
    const weighted = cells.reduce(
      (sum, s, i) => sum + s.score * (weights[i] ?? 1),
      0,
    );
    return {
      id: c.id, name: c.name, cells, plus, minus, same, weighted,
    };
  });
  out.sort((a, b) => b.weighted - a.weighted);
  return out;
}

/* ---- Saaty scale helpers ----------------------------------- */

// Slider position -8..+8 maps to a Saaty value.
//   +k (k=1..8) → (k+1)         (so +1 → 2, +8 → 9)
//    0          → 1   (equal)
//   -k          → 1/(k+1)
export function sliderToSaaty(s) {
  if (s === 0) return 1;
  const k = Math.abs(s) + 1;
  return s > 0 ? k : 1 / k;
}

export function saatyLabel(s) {
  const v = sliderToSaaty(s);
  if (s === 0) return 'equal';
  const k = Math.abs(s);
  const tags = ['', 'slightly', 'moderately', 'moderately+', 'strongly',
                'strongly+', 'very strongly', 'very strongly+', 'absolutely'];
  return s > 0
    ? `A ${tags[k]} > B (${v.toFixed(0)})`
    : `B ${tags[k]} > A (1/${(1 / v).toFixed(0)})`;
}
