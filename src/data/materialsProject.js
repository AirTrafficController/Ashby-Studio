/* ============================================================
   Materials Project API helper
   ============================================================
   Browser-side lookup against api.materialsproject.org.
   Requires a free user-supplied API key. Only autofills the
   two Ashby fields MP can compute (density, Young's modulus
   derived from bulk + shear). Strength and T_max are not in
   MP — the user must enter those manually from a data sheet.
   ============================================================ */

const MP_BASE = 'https://api.materialsproject.org';

/* The Materials Project API does not send CORS headers, so calls from a
   browser origin (e.g. GitHub Pages) get blocked at the preflight stage.
   We route requests through a public CORS proxy that forwards arbitrary
   headers — including the X-API-KEY the MP API requires. If the first
   proxy is unreachable we fall through to the next one. */
const CORS_PROXIES = [
  (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
];

const FIELDS = [
  'material_id',
  'formula_pretty',
  'density',
  'bulk_modulus',
  'shear_modulus',
  'energy_above_hull',
  'symmetry',
  'elements',
].join(',');

export async function searchByFormula(formula, apiKey, { signal } = {}) {
  if (!apiKey) throw new Error('Materials Project API key required.');
  const f = (formula || '').trim();
  if (!f) throw new Error('Enter a chemical formula.');

  const url = new URL(`${MP_BASE}/materials/summary/`);
  url.searchParams.set('formula', f);
  url.searchParams.set('_fields', FIELDS);
  url.searchParams.set('_limit', '10');

  const res = await fetchViaProxy(url.toString(), {
    headers: { 'X-API-KEY': apiKey, Accept: 'application/json' },
    signal,
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error('API key rejected (check it on materialsproject.org).');
  }
  if (!res.ok) throw new Error(`Materials Project request failed: ${res.status}`);

  const json = await res.json();
  const entries = (json.data || [])
    .map(parseEntry)
    .filter((e) => Number.isFinite(e.density) && e.density > 0)
    .sort((a, b) => a.energyAboveHull - b.energyAboveHull);
  return entries;
}

async function fetchViaProxy(targetUrl, init) {
  let lastErr = null;
  for (const wrap of CORS_PROXIES) {
    try {
      const res = await fetch(wrap(targetUrl), init);
      if (res.status >= 500 && res.status <= 599) {
        lastErr = new Error(`Proxy returned ${res.status}`);
        continue;
      }
      return res;
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      lastErr = err;
    }
  }
  throw lastErr || new Error('All CORS proxies failed.');
}

function parseEntry(d) {
  const K = d.bulk_modulus?.vrh ?? d.bulk_modulus?.voigt ?? null;
  const G = d.shear_modulus?.vrh ?? d.shear_modulus?.voigt ?? null;
  let modulus = null;
  if (Number.isFinite(K) && Number.isFinite(G) && 3 * K + G > 0) {
    modulus = (9 * K * G) / (3 * K + G);
  }
  return {
    mpId: d.material_id,
    formula: d.formula_pretty || '',
    density: d.density ?? null,
    modulus: modulus != null ? Math.round(modulus * 10) / 10 : null,
    bulk: K,
    shear: G,
    energyAboveHull: d.energy_above_hull ?? 0,
    symmetry: d.symmetry?.symbol || '',
    elements: d.elements || [],
  };
}

/* Rough family guess from element list so the form lands on
   something sensible. User can edit it freely afterwards. */
const NONMETALS = new Set([
  'H', 'He', 'B', 'C', 'N', 'O', 'F', 'Ne',
  'Si', 'P', 'S', 'Cl', 'Ar',
  'Se', 'Br', 'Kr', 'Te', 'I', 'Xe', 'At', 'Rn',
]);

export function guessFamily(elements) {
  if (!Array.isArray(elements) || elements.length === 0) return 'Custom';
  const set = new Set(elements);
  if (set.has('O') && elements.some((e) => !NONMETALS.has(e))) return 'Oxide ceramic';
  if (set.has('C') && elements.length === 1) return 'Non-oxide ceramic';
  if (set.has('N') || set.has('C') || set.has('B') || set.has('Si')) {
    const hasMetal = elements.some((e) => !NONMETALS.has(e));
    if (hasMetal) return 'Non-oxide ceramic';
  }
  const allMetals = elements.every((e) => !NONMETALS.has(e));
  if (allMetals) return 'Metal alloy';
  return 'Custom';
}
