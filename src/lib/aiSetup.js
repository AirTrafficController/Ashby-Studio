/* ============================================================
   AI-ASSISTED WIZARD SETUP
   ============================================================
   Turns a free-text mission description into a structured
   pre-fill for the Selection wizard (step 1 spec + a first-pass
   AHP importance vector). The model only *seeds* the form — the
   user reviews and adjusts every field before it drives any
   ranking, so an imperfect guess is never silently authoritative.

   Bring-your-own-key: the caller passes an Anthropic API key that
   the user entered in the UI (kept in their own browser only). No
   key is bundled into the app, so the deployed static site holds
   no secret — it is safe to host publicly (e.g. GitHub Pages).
   Each user's key is sent from their own browser straight to the
   Anthropic API and billed to their own account.
   ============================================================ */

const MODEL = 'claude-sonnet-4-6';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';

const ENVIRONMENTS = ['space', 'deep_sea', 'chemical'];
const LAYERS = [
  'outer_shell', 'thermal', 'pressure_bladder',
  'inner_liner', 'gloves', 'helmet', 'seals_joints',
];
const MORPHOLOGIES = ['any', 'rigid', 'semi_rigid', 'soft'];
const PROPS = ['density', 'modulus', 'strength', 'tMax', 'cost', 'chemRes'];

const SYSTEM_PROMPT = `You configure a protective-suit material-selection wizard from a short mission brief.

Return ONLY a single JSON object (no prose, no markdown fences) with these fields:

{
  "environment": one of ["space","deep_sea","chemical"],
  "layer": one of ["outer_shell","thermal","pressure_bladder","inner_liner","gloves","helmet","seals_joints"],
  "tMin": number or null  // minimum service temperature in Celsius, if the brief implies one
  "tMax": number or null  // minimum REQUIRED max-use temperature in Celsius (candidates must tolerate at least this)
  "morphology": one of ["any","rigid","semi_rigid","soft"],
  "useLayerFilter": boolean,  // true only if the brief clearly targets one suit layer
  "maxCost": integer 1-4,     // cost ceiling; 1=low only ... 4=no limit
  "minChemRes": integer 1-4,  // chemical-resistance floor; 1=no limit ... 4=excellent required
  "importance": {             // relative importance 1-9 (9=most critical) of each property for THIS use case
    "density": 1-9, "modulus": 1-9, "strength": 1-9,
    "tMax": 1-9, "cost": 1-9, "chemRes": 1-9
  },
  "rationale": "one short sentence explaining the key tradeoff"
}

Property meanings: density g/cc (lower better), modulus GPa stiffness (higher better), strength MPa (higher better), tMax max-use temp C (higher better), cost ordinal 1-4 (lower better), chemRes chemical resistance 1-4 (higher better).
Use sensible engineering judgement. If the brief is vague, choose reasonable defaults rather than refusing.`;

function clampInt(v, lo, hi, fallback) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
}

function oneOf(v, allowed, fallback) {
  return allowed.includes(v) ? v : fallback;
}

/* Extract the first balanced JSON object from a string, tolerating
   stray prose or code fences the model might add despite instructions. */
function extractJson(text) {
  const start = text.indexOf('{');
  if (start === -1) throw new Error('No JSON object in model response');
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return JSON.parse(text.slice(start, i + 1));
    }
  }
  throw new Error('Unbalanced JSON in model response');
}

function sanitize(raw) {
  const imp = raw.importance && typeof raw.importance === 'object' ? raw.importance : {};
  const importance = {};
  for (const k of PROPS) importance[k] = clampInt(imp[k], 1, 9, 5);

  const num = (v) => (v === null || v === undefined || v === '' ? '' : (Number.isFinite(Number(v)) ? String(Number(v)) : ''));

  return {
    environment: oneOf(raw.environment, ENVIRONMENTS, 'space'),
    layer: oneOf(raw.layer, LAYERS, 'outer_shell'),
    tMin: num(raw.tMin),
    tMax: num(raw.tMax),
    morphology: oneOf(raw.morphology, MORPHOLOGIES, 'any'),
    useLayerFilter: !!raw.useLayerFilter,
    maxCost: clampInt(raw.maxCost, 1, 4, 4),
    minChemRes: clampInt(raw.minChemRes, 1, 4, 1),
    importance,
    rationale: typeof raw.rationale === 'string' ? raw.rationale.slice(0, 240) : '',
  };
}

export async function generateWizardSetup(missionText, apiKey) {
  if (!apiKey) {
    throw new Error('Add your Anthropic API key first (the field above).');
  }
  const text = String(missionText || '').trim();
  if (!text) throw new Error('Describe the mission first.');

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }],
      }),
    });
  } catch (e) {
    throw new Error('Network error reaching the Anthropic API.');
  }

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error?.message || ''; } catch { /* ignore */ }
    throw new Error(`API error ${res.status}${detail ? `: ${detail}` : ''}`);
  }

  const data = await res.json();
  const out = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return sanitize(extractJson(out));
}
