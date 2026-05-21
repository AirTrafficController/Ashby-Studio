import React, { useMemo, useState, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, AlertTriangle, Check,
  Sliders, Filter, ListOrdered, Scale,
} from 'lucide-react';
import { THEME } from '../theme.js';
import {
  MATERIALS, ENVIRONMENTS, LAYERS, ENV_LABEL, LAYER_LABEL,
  PROPERTY_META, matchesEnvironment,
  MORPHOLOGIES, MORPHOLOGY_LABEL, FLEXIBLE_LAYERS,
} from '../data/materials.js';
import {
  buildPairwise, ahpWeights, topsis, pughMatrix,
  sliderToSaaty, saatyLabel,
} from '../lib/mcdm.js';
import ResizeHandle from './ResizeHandle.jsx';

/* Default criteria sets per layer. Order matters for stable display
   and matches the property-table priorities in the project brief. */
const LAYER_CRITERIA = {
  outer_shell:      ['density', 'strength', 'tMax', 'cost'],
  thermal:          ['density', 'tMax', 'cost'],
  pressure_bladder: ['density', 'strength', 'chemRes', 'cost'],
  inner_liner:      ['density', 'tMax', 'chemRes', 'cost'],
  gloves:           ['density', 'strength', 'chemRes', 'cost'],
  helmet:           ['density', 'modulus', 'tMax', 'cost'],
  seals_joints:     ['density', 'strength', 'tMax', 'chemRes'],
};

const STEPS = [
  { key: 'spec',   label: 'Specify',  Icon: Filter      },
  { key: 'weight', label: 'Weight',   Icon: Sliders     },
  { key: 'rank',   label: 'Rank',     Icon: ListOrdered },
  { key: 'pugh',   label: 'Validate', Icon: Scale       },
];

const fmt = (n, d = 2) => {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1000) return n.toFixed(0);
  if (Math.abs(n) >= 10)   return n.toFixed(1);
  return n.toFixed(d);
};

export default function SelectionWizard({
  materials: liveMaterials,
  width = 360,
  setWidth,
  onHighlight,
  onAxisRequest,
  onSnapshot,
  hidden = false,
}) {
  // Pool to draw candidates from. When the host app passes its own
  // materials list (which may include user-added customs), use that;
  // otherwise fall back to the static built-in set.
  const pool = useMemo(() => {
    const src = Array.isArray(liveMaterials) && liveMaterials.length
      ? liveMaterials
      : MATERIALS;
    // Only spec-bearing materials can be ranked — CSV scatter uploads
    // (which have `points` but no `props`) are silently excluded here.
    return src.filter((m) => m.props && typeof m.props.density === 'number');
  }, [liveMaterials]);

  const [step, setStep] = useState(0);

  // ===== Step 1: spec =====
  const [environment, setEnvironment] = useState('space');
  const [layer, setLayer] = useState('outer_shell');
  const [tMin, setTMin] = useState('');   // °C, optional
  const [tMax, setTMax] = useState('');   // °C, optional
  // Morphology filter: 'any' | 'rigid' | 'semi_rigid' | 'soft'
  const [morphology, setMorphology] = useState('any');
  // Opt-in: restrict candidates to the materials our database
  // tags as typical for the chosen layer. Off by default so any
  // material is considered.
  const [useLayerFilter, setUseLayerFilter] = useState(false);
  // Cost ceiling (1=low … 4=very high). 4 = no limit.
  const [maxCost, setMaxCost] = useState(4);
  // Chemical-resistance floor (1=poor … 4=excellent). 1 = no limit.
  const [minChemRes, setMinChemRes] = useState(1);

  // ===== Step 2: weights (AHP) =====
  // Pairwise slider values, indexed by criterion-pair position.
  // Slider range: -8..+8 (Saaty 1/9..9, where 0 = equal).
  const [pairValues, setPairValues] = useState({});  // key 'i_j' → value

  // ===== Step 4: pugh baseline =====
  const [baselineId, setBaselineId] = useState(null);

  /* --- Derived: candidate set after the user-controlled filters.
         Layer membership is opt-in now — the layer choice always
         shapes the AHP criteria but no longer hard-limits which
         materials are considered. */
  const candidates = useMemo(() => {
    return pool.filter((m) => {
      if (!matchesEnvironment(m, environment)) return false;
      if (useLayerFilter && !m.layers.includes(layer)) return false;
      if (morphology !== 'any' && m.morphology !== morphology) return false;
      if (Number.isFinite(m.props.cost) && m.props.cost > maxCost) return false;
      if (Number.isFinite(m.props.chemRes) && m.props.chemRes < minChemRes) return false;
      const hi = parseFloat(tMax);
      if (Number.isFinite(hi) && m.props.tMax < hi) return false;
      // tMin is a "must operate at least this cold" requirement.
      // Without explicit cryogenic data per material, treat tMin as
      // an advisory only — flag rather than filter.
      return true;
    });
  }, [pool, environment, layer, useLayerFilter, morphology, tMin, tMax, maxCost, minChemRes]);

  /* --- Criteria for current layer --- */
  const criteria = useMemo(() => {
    const keys = LAYER_CRITERIA[layer] ?? ['density', 'strength', 'tMax', 'cost'];
    return keys.map((k) => ({
      key: k,
      label: PROPERTY_META[k].label,
      unit: PROPERTY_META[k].unit,
      beneficial: PROPERTY_META[k].beneficial,
    }));
  }, [layer]);

  /* Reset pair values whenever criteria change shape */
  useEffect(() => {
    const init = {};
    for (let i = 0; i < criteria.length; i++) {
      for (let j = i + 1; j < criteria.length; j++) {
        init[`${i}_${j}`] = 0;  // equal by default
      }
    }
    setPairValues(init);
  }, [criteria.length, layer]);

  /* --- Compute AHP weights from current pair values --- */
  const ahp = useMemo(() => {
    const n = criteria.length;
    if (n < 2) return { weights: n === 1 ? [1] : [], CR: 0, CI: 0, lambdaMax: n };
    const upper = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const s = pairValues[`${i}_${j}`] ?? 0;
        // Slider convention: positive = right-side (j) dominant.
        // sliderToSaaty's upper-triangle convention is positive = i dominant,
        // so negate before mapping.
        upper.push(sliderToSaaty(-s));
      }
    }
    const M = buildPairwise(n, upper);
    return ahpWeights(M);
  }, [criteria, pairValues]);

  /* --- TOPSIS ranking --- */
  const ranking = useMemo(() => {
    if (candidates.length === 0 || ahp.weights.length === 0) return [];
    return topsis(candidates, criteria, ahp.weights);
  }, [candidates, criteria, ahp.weights]);

  const top10 = ranking.slice(0, 10);
  const top3Ids = top10.slice(0, 3).map((r) => r.id);

  /* Pugh baseline default = top-ranked TOPSIS result */
  useEffect(() => {
    if (!baselineId && top10.length > 0) setBaselineId(top10[0].id);
    if (baselineId && !candidates.find((c) => c.id === baselineId) && top10.length > 0) {
      setBaselineId(top10[0].id);
    }
  }, [top10, baselineId, candidates]);

  /* --- Pugh matrix --- */
  const pugh = useMemo(() => {
    if (!baselineId || top10.length < 2) return null;
    const baseline = candidates.find((c) => c.id === baselineId);
    if (!baseline) return null;
    const others = top10
      .filter((r) => r.id !== baselineId)
      .slice(0, 5)
      .map((r) => candidates.find((c) => c.id === r.id))
      .filter(Boolean);
    return pughMatrix(baseline, others, criteria, ahp.weights);
  }, [top10, baselineId, candidates, criteria, ahp.weights]);

  /* --- Push highlight to chart. Clear highlights while the
         wizard is hidden so leaving Select mode doesn't leave
         stale rankings on the chart. */
  useEffect(() => {
    if (typeof onHighlight === 'function') {
      onHighlight(!hidden && step >= 2 ? top3Ids : []);
    }
  }, [hidden, step, top3Ids.join('|'), onHighlight]);

  /* --- Push axis request to chart when layer changes --- */
  useEffect(() => {
    if (typeof onAxisRequest === 'function') {
      // Default Y axis property for this layer
      const yKey = LAYER_CRITERIA[layer][1] ?? 'modulus';
      onAxisRequest('density', yKey);
    }
  }, [layer, onAxisRequest]);

  /* --- Expose state to host app (for the PDF report export) --- */
  useEffect(() => {
    if (typeof onSnapshot !== 'function') return;
    onSnapshot({
      step,
      environment,
      layer,
      filters: { tMin, tMax, morphology, useLayerFilter, maxCost, minChemRes },
      candidateCount: candidates.length,
      criteria,
      weights: ahp.weights,
      consistencyRatio: ahp.CR,
      pairValues,
      ranking: ranking.slice(0, 10).map(r => ({
        id: r.id, name: r.name, family: r.family,
        score: r.score, dPlus: r.dPlus, dMinus: r.dMinus,
      })),
      baselineId,
      baselineName: candidates.find(c => c.id === baselineId)?.name ?? null,
      pugh: Array.isArray(pugh) ? pugh : null,
    });
  }, [
    onSnapshot, step, environment, layer, tMin, tMax, morphology, useLayerFilter,
    maxCost, minChemRes, candidates.length, criteria, ahp.weights, ahp.CR,
    pairValues, ranking, baselineId, pugh,
  ]);

  const canAdvance = (() => {
    if (step === 0) return candidates.length > 0;
    if (step === 1) return ahp.weights.length > 0;
    if (step === 2) return ranking.length > 0;
    return true;
  })();

  return (
    <aside
      className="flex flex-col h-full overflow-hidden relative"
      style={{
        display: hidden ? 'none' : 'flex',
        width, minWidth: width,
        background: THEME.paperLight,
        borderLeft: `1px solid ${THEME.border}`,
      }}
    >
      {setWidth && (
        <ResizeHandle
          width={width} setWidth={setWidth}
          edge="left" min={320} max={540}
        />
      )}
      {/* Header */}
      <div
        className="px-4 py-3"
        style={{ borderBottom: `1px solid ${THEME.border}` }}
      >
        <div className="font-display italic" style={{ fontSize: 16, color: THEME.ink }}>
          Selection Studio
        </div>
        <div className="font-mono text-[9px] uppercase tracking-widest mt-0.5" style={{ color: THEME.inkFaint }}>
          AHP · TOPSIS · Pugh
        </div>
      </div>

      {/* Stepper */}
      <div
        className="flex"
        style={{ borderBottom: `1px solid ${THEME.border}`, background: THEME.paper }}
      >
        {STEPS.map((s, i) => {
          const active = step === i;
          const done = step > i;
          return (
            <button
              key={s.key}
              onClick={() => setStep(i)}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors"
              style={{
                background: active ? THEME.paperLight : 'transparent',
                borderBottom: active ? `2px solid ${THEME.ink}` : '2px solid transparent',
                color: active ? THEME.ink : (done ? THEME.inkMuted : THEME.inkFaint),
                cursor: 'pointer',
              }}
            >
              <s.Icon size={13} />
              <span className="font-mono text-[9px] uppercase tracking-wider">
                {i + 1}. {s.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {step === 0 && (
          <SpecPanel
            environment={environment} setEnvironment={setEnvironment}
            layer={layer} setLayer={setLayer}
            tMin={tMin} setTMin={setTMin}
            tMax={tMax} setTMax={setTMax}
            morphology={morphology} setMorphology={setMorphology}
            useLayerFilter={useLayerFilter} setUseLayerFilter={setUseLayerFilter}
            maxCost={maxCost} setMaxCost={setMaxCost}
            minChemRes={minChemRes} setMinChemRes={setMinChemRes}
            candidates={candidates}
            pool={pool}
          />
        )}
        {step === 1 && (
          <WeightPanel
            criteria={criteria}
            pairValues={pairValues}
            setPairValues={setPairValues}
            ahp={ahp}
          />
        )}
        {step === 2 && (
          <RankPanel
            ranking={top10}
            criteria={criteria}
            weights={ahp.weights}
          />
        )}
        {step === 3 && (
          <PughPanel
            ranking={top10}
            candidates={candidates}
            criteria={criteria}
            weights={ahp.weights}
            baselineId={baselineId}
            setBaselineId={setBaselineId}
            pugh={pugh}
          />
        )}
      </div>

      {/* Footer nav */}
      <div
        className="px-3 py-3 flex items-center gap-2"
        style={{ borderTop: `1px solid ${THEME.border}`, background: THEME.paper }}
      >
        <button
          className="btn"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          style={{ opacity: step === 0 ? 0.4 : 1 }}
        >
          <ChevronLeft size={12} /> Back
        </button>
        <div className="flex-1" />
        <button
          className="btn btn-primary"
          onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
          disabled={!canAdvance || step === STEPS.length - 1}
          style={{ opacity: !canAdvance || step === STEPS.length - 1 ? 0.4 : 1 }}
        >
          Next <ChevronRight size={12} />
        </button>
      </div>
    </aside>
  );
}

/* ============================================================
   STEP 1 — Specify
   ============================================================ */

function SpecPanel({
  environment, setEnvironment, layer, setLayer,
  tMin, setTMin, tMax, setTMax,
  morphology, setMorphology,
  useLayerFilter, setUseLayerFilter,
  maxCost, setMaxCost,
  minChemRes, setMinChemRes,
  candidates, pool,
}) {
  // Auto-hint: if the user picks a flexible layer but is on 'rigid',
  // softly suggest relaxing the filter.
  const flexHint = FLEXIBLE_LAYERS.has(layer) && morphology === 'rigid';

  // For display: which candidates are tagged as typical for this layer?
  const layerRecommendedIds = useMemo(
    () => new Set(pool.filter((m) => m.layers?.includes(layer)).map((m) => m.id)),
    [pool, layer],
  );

  const costLabels = { 4: 'any', 3: '≤ high', 2: '≤ moderate', 1: '≤ low' };
  const chemLabels = { 1: 'any', 2: '≥ fair', 3: '≥ good', 4: '= excellent' };

  return (
    <div className="flex flex-col gap-4">
      <FieldGroup label="Environment">
        <SegmentedSelect
          value={environment}
          onChange={setEnvironment}
          options={ENVIRONMENTS.map((e) => ({ value: e, label: ENV_LABEL[e] }))}
        />
      </FieldGroup>

      <FieldGroup label="Suit layer (sets ranking criteria)">
        <select
          className="w-full px-2 py-1.5 text-sm font-body"
          style={{
            border: `1px solid ${THEME.border}`,
            background: THEME.paperLight,
            color: THEME.ink,
            borderRadius: 3,
          }}
          value={layer}
          onChange={(e) => setLayer(e.target.value)}
        >
          {LAYERS.map((l) => (
            <option key={l} value={l}>{LAYER_LABEL[l]}</option>
          ))}
        </select>
        <div className="font-mono text-[9px] mt-1" style={{ color: THEME.inkFaint }}>
          layer choice shapes the AHP criteria — it does not restrict candidates
          unless you enable the filter below
        </div>
      </FieldGroup>

      <FieldGroup label="Operating temperature window (°C)">
        <div className="grid grid-cols-2 gap-2">
          <NumInput placeholder="min" value={tMin} onChange={setTMin} />
          <NumInput placeholder="max" value={tMax} onChange={setTMax} />
        </div>
        <div className="font-mono text-[9px] mt-1" style={{ color: THEME.inkFaint }}>
          materials with T_max below the requested max are filtered out
        </div>
      </FieldGroup>

      {/* ----- FILTERS ----- */}
      <div
        className="rounded px-3 py-3"
        style={{
          background: THEME.paper,
          border: `1px solid ${THEME.borderSoft}`,
        }}
      >
        <div
          className="font-mono uppercase tracking-wider mb-3"
          style={{ fontSize: 10, color: THEME.inkMuted, fontWeight: 500 }}
        >
          Filters
        </div>

        {/* Layer-recommended toggle (the key change) */}
        <label className="flex items-start gap-2 cursor-pointer mb-3 text-xs">
          <input
            type="checkbox" className="checkbox mt-0.5"
            checked={useLayerFilter}
            onChange={(e) => setUseLayerFilter(e.target.checked)}
          />
          <span style={{ color: THEME.ink, lineHeight: 1.4 }}>
            Only show materials typically used for {LAYER_LABEL[layer]}
            <span className="block font-mono mt-0.5"
                  style={{ fontSize: 9, color: THEME.inkFaint }}>
              off by default — any material can be considered for any layer
            </span>
          </span>
        </label>

        {/* Morphology */}
        <div className="mb-3">
          <div className="font-mono uppercase mb-1"
               style={{ fontSize: 9, letterSpacing: '0.1em', color: THEME.inkFaint }}>
            Morphology
          </div>
          <SegmentedSelect
            value={morphology}
            onChange={setMorphology}
            options={[
              { value: 'any',        label: 'Any' },
              { value: 'rigid',      label: 'Rigid' },
              { value: 'semi_rigid', label: 'Semi' },
              { value: 'soft',       label: 'Soft' },
            ]}
          />
          {flexHint && (
            <div className="font-mono text-[9px] mt-1" style={{ color: THEME.accent }}>
              {LAYER_LABEL[layer]} typically needs flexibility — consider Soft or Semi.
            </div>
          )}
        </div>

        {/* Cost ceiling */}
        <div className="mb-3">
          <div className="flex items-baseline justify-between mb-1">
            <span className="font-mono uppercase"
                  style={{ fontSize: 9, letterSpacing: '0.1em', color: THEME.inkFaint }}>
              Max cost
            </span>
            <span className="font-mono text-[10px]" style={{ color: THEME.inkMuted }}>
              {costLabels[maxCost]}
            </span>
          </div>
          <input
            type="range" min={1} max={4} step={1}
            value={maxCost}
            onChange={(e) => setMaxCost(parseInt(e.target.value, 10))}
          />
        </div>

        {/* Chemical resistance floor */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="font-mono uppercase"
                  style={{ fontSize: 9, letterSpacing: '0.1em', color: THEME.inkFaint }}>
              Min chemical resistance
            </span>
            <span className="font-mono text-[10px]" style={{ color: THEME.inkMuted }}>
              {chemLabels[minChemRes]}
            </span>
          </div>
          <input
            type="range" min={1} max={4} step={1}
            value={minChemRes}
            onChange={(e) => setMinChemRes(parseInt(e.target.value, 10))}
          />
        </div>
      </div>

      {/* ----- CANDIDATES SUMMARY ----- */}
      <div
        className="px-3 py-2.5 rounded"
        style={{
          background: THEME.paper,
          border: `1px solid ${THEME.border}`,
        }}
      >
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider"
                style={{ color: THEME.inkMuted }}>
            Candidates
          </span>
          <span className="font-display" style={{ fontSize: 22, color: THEME.ink }}>
            {candidates.length}
          </span>
        </div>
        {candidates.length === 0 && (
          <div className="flex items-start gap-2 mt-2 text-xs" style={{ color: THEME.accent }}>
            <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
            <span>No materials match. Relax a filter or pick a different environment.</span>
          </div>
        )}
        {candidates.length > 0 && (
          <>
            <ul className="mt-2 flex flex-wrap gap-1">
              {candidates.map((c) => {
                const recommended = layerRecommendedIds.has(c.id);
                return (
                  <li
                    key={c.id}
                    className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                    style={{
                      background: recommended ? THEME.paperDark : THEME.paperLight,
                      border: `1px solid ${recommended ? THEME.border : THEME.borderSoft}`,
                      color: recommended ? THEME.ink : THEME.inkMuted,
                      fontWeight: recommended ? 500 : 400,
                    }}
                    title={recommended
                      ? `Typically used for ${LAYER_LABEL[layer]}`
                      : `Not typically used for ${LAYER_LABEL[layer]}, but still considered`}
                  >
                    {recommended && '★ '}{c.name}
                  </li>
                );
              })}
            </ul>
            <div className="font-mono text-[9px] mt-2" style={{ color: THEME.inkFaint }}>
              ★ marks materials typically used for {LAYER_LABEL[layer]}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   STEP 2 — Weight (AHP pairwise)
   ============================================================ */

function WeightPanel({ criteria, pairValues, setPairValues, ahp }) {
  const pairs = [];
  for (let i = 0; i < criteria.length; i++) {
    for (let j = i + 1; j < criteria.length; j++) {
      pairs.push([i, j]);
    }
  }

  const crBadgeColor = ahp.CR < 0.10
    ? THEME.ink
    : ahp.CR < 0.20 ? '#A06B4A' : THEME.accent;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-wider mb-2"
             style={{ color: THEME.inkMuted }}>
          Pairwise comparison (Saaty 1–9)
        </div>
        <div className="flex flex-col gap-3">
          {pairs.map(([i, j]) => {
            const k = `${i}_${j}`;
            const v = pairValues[k] ?? 0;
            const sa = sliderToSaaty(v);
            return (
              <div key={k}
                   className="rounded px-3 py-2"
                   style={{ background: THEME.paper, border: `1px solid ${THEME.borderSoft}` }}>
                <div className="flex items-baseline justify-between text-xs mb-1.5">
                  <span style={{ color: THEME.ink, fontWeight: 500 }}>
                    {criteria[i].label}
                  </span>
                  <span className="font-mono text-[10px]" style={{ color: THEME.inkFaint }}>
                    vs
                  </span>
                  <span style={{ color: THEME.ink, fontWeight: 500 }}>
                    {criteria[j].label}
                  </span>
                </div>
                <input
                  type="range" min={-8} max={8} step={1}
                  value={v}
                  onChange={(e) => setPairValues({ ...pairValues, [k]: parseInt(e.target.value, 10) })}
                />
                <div className="font-mono text-[9px] mt-1" style={{ color: THEME.inkMuted }}>
                  {v === 0 ? 'equal'
                    : v > 0 ? `${criteria[j].label} ${sa.toFixed(0)}× more important`
                    : `${criteria[i].label} ${(1 / sa).toFixed(0)}× more important`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="rounded px-3 py-2.5"
        style={{ background: THEME.paper, border: `1px solid ${THEME.border}` }}
      >
        <div className="flex items-baseline justify-between mb-2">
          <span className="font-mono text-[10px] uppercase tracking-wider"
                style={{ color: THEME.inkMuted }}>
            Resulting weights
          </span>
          <span className="font-mono text-[10px]" style={{ color: crBadgeColor }}>
            CR = {ahp.CR.toFixed(3)}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          {criteria.map((c, i) => {
            const w = ahp.weights[i] ?? 0;
            return (
              <div key={c.key} className="flex items-center gap-2 text-xs">
                <div className="flex-1 truncate" style={{ color: THEME.ink }}>
                  {c.label}
                </div>
                <div
                  className="h-1.5"
                  style={{
                    width: `${Math.max(2, w * 100)}px`,
                    background: THEME.ink,
                    borderRadius: 1,
                  }}
                />
                <span className="font-mono text-[10px] w-8 text-right"
                      style={{ color: THEME.inkMuted }}>
                  {(w * 100).toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
        <div className="font-mono text-[9px] mt-2" style={{ color: THEME.inkFaint }}>
          {ahp.CR < 0.10
            ? '✓ Consistency acceptable (CR < 0.10)'
            : ahp.CR < 0.20
              ? '⚠ Consistency marginal — review most divergent pair'
              : '✗ Consistency poor — judgements contradict, revisit pairs'}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   STEP 3 — Rank (TOPSIS)
   ============================================================ */

function RankPanel({ ranking, criteria, weights }) {
  if (ranking.length === 0) {
    return (
      <div className="text-xs" style={{ color: THEME.inkMuted }}>
        No candidates to rank. Go back to step 1.
      </div>
    );
  }
  const max = ranking[0]?.score ?? 1;
  return (
    <div className="flex flex-col gap-3">
      <div className="font-mono text-[10px] uppercase tracking-wider"
           style={{ color: THEME.inkMuted }}>
        TOPSIS closeness coefficient (higher is better)
      </div>
      <ol className="flex flex-col gap-1.5">
        {ranking.map((r, i) => {
          const isTop3 = i < 3;
          const colour = i === 0 ? THEME.rank1 : i === 1 ? THEME.rank2 : i === 2 ? THEME.rank3 : THEME.inkFaint;
          return (
            <li
              key={r.id}
              className="rounded px-2.5 py-2"
              style={{
                background: isTop3 ? THEME.paperLight : THEME.paper,
                border: `1px solid ${isTop3 ? THEME.border : THEME.borderSoft}`,
              }}
            >
              <div className="flex items-baseline gap-2">
                <span
                  className="font-mono text-[10px] flex items-center justify-center"
                  style={{
                    width: 18, height: 18,
                    borderRadius: 9,
                    background: colour,
                    color: 'white',
                    fontWeight: 600,
                  }}
                >
                  {i + 1}
                </span>
                <span className="text-xs flex-1" style={{ color: THEME.ink, fontWeight: 500 }}>
                  {r.name}
                </span>
                <span className="font-mono text-[10px]" style={{ color: THEME.inkMuted }}>
                  {r.score.toFixed(3)}
                </span>
              </div>
              <div className="mt-1.5 h-1" style={{ background: THEME.borderSoft, borderRadius: 1 }}>
                <div
                  className="h-full"
                  style={{
                    width: `${(r.score / max) * 100}%`,
                    background: colour,
                    borderRadius: 1,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ol>
      <div className="font-mono text-[9px]" style={{ color: THEME.inkFaint }}>
        Top three are highlighted on the chart (rank 1 darkest).
      </div>
    </div>
  );
}

/* ============================================================
   STEP 4 — Validate (Pugh)
   ============================================================ */

function PughPanel({
  ranking, candidates, criteria, weights,
  baselineId, setBaselineId, pugh,
}) {
  if (ranking.length < 2) {
    return (
      <div className="text-xs" style={{ color: THEME.inkMuted }}>
        Need at least 2 candidates for a Pugh comparison.
      </div>
    );
  }

  const baseline = candidates.find((c) => c.id === baselineId);
  const winner = pugh && pugh.length > 0 && pugh[0].weighted > 0 ? pugh[0] : null;

  return (
    <div className="flex flex-col gap-3">
      <FieldGroup label="Baseline (current standard)">
        <select
          className="w-full px-2 py-1.5 text-sm font-body"
          style={{
            border: `1px solid ${THEME.border}`,
            background: THEME.paperLight,
            color: THEME.ink,
            borderRadius: 3,
          }}
          value={baselineId ?? ''}
          onChange={(e) => setBaselineId(e.target.value)}
        >
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </FieldGroup>

      {pugh && (
        <div
          className="rounded overflow-hidden"
          style={{ border: `1px solid ${THEME.border}` }}
        >
          <table className="w-full text-[10px]">
            <thead>
              <tr style={{ background: THEME.paper, color: THEME.inkMuted }}>
                <th className="text-left px-2 py-1.5 font-mono uppercase tracking-wider">
                  vs {baseline?.name}
                </th>
                {criteria.map((c) => (
                  <th key={c.key} className="px-1 py-1.5 font-mono text-center"
                      style={{ width: 28 }}>
                    {c.label.slice(0, 4).toLowerCase()}
                  </th>
                ))}
                <th className="px-2 py-1.5 font-mono text-right">Σw</th>
              </tr>
            </thead>
            <tbody>
              {pugh.map((row) => (
                <tr key={row.id} style={{ borderTop: `1px solid ${THEME.borderSoft}` }}>
                  <td className="px-2 py-1.5" style={{ color: THEME.ink }}>
                    {row.name}
                  </td>
                  {row.cells.map((cell) => (
                    <td key={cell.key} className="text-center font-mono"
                        style={{
                          color: cell.score > 0 ? '#2D5F3F'
                               : cell.score < 0 ? THEME.accent
                               : THEME.inkFaint,
                        }}>
                      {cell.score > 0 ? '+' : cell.score < 0 ? '−' : '0'}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right font-mono"
                      style={{
                        color: row.weighted > 0 ? '#2D5F3F'
                             : row.weighted < 0 ? THEME.accent
                             : THEME.inkMuted,
                        fontWeight: 500,
                      }}>
                    {row.weighted > 0 ? '+' : ''}{row.weighted.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div
        className="rounded px-3 py-3"
        style={{
          background: winner ? '#EAF1E8' : THEME.paper,
          border: `1px solid ${winner ? '#9DB59A' : THEME.border}`,
        }}
      >
        <div className="flex items-start gap-2">
          {winner ? (
            <Check size={14} style={{ color: '#2D5F3F', marginTop: 2 }} />
          ) : (
            <AlertTriangle size={14} style={{ color: THEME.inkMuted, marginTop: 2 }} />
          )}
          <div className="text-xs flex-1" style={{ color: THEME.ink }}>
            {winner ? (
              <>
                <span style={{ fontWeight: 600 }}>{winner.name}</span> outperforms the
                baseline (weighted Σ = {winner.weighted.toFixed(2)},
                {' '}+{winner.plus} / 0×{winner.same} / −{winner.minus}).
                Recommend as primary candidate, subject to data-sheet verification.
              </>
            ) : (
              <>No candidate clearly beats the baseline. The baseline itself remains the
              recommended choice, or revisit the weights in step 2.</>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Small UI helpers (local to wizard)
   ============================================================ */

function FieldGroup({ label, children }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-wider mb-1.5"
           style={{ color: THEME.inkMuted }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function NumInput({ value, onChange, placeholder }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-2 py-1.5 text-sm font-mono"
      style={{
        border: `1px solid ${THEME.border}`,
        background: THEME.paperLight,
        color: THEME.ink,
        borderRadius: 3,
      }}
    />
  );
}

function SegmentedSelect({ value, onChange, options }) {
  return (
    <div className="flex gap-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="flex-1 px-2 py-1.5 text-xs"
            style={{
              background: active ? THEME.ink : THEME.paperLight,
              color: active ? THEME.paperLight : THEME.ink,
              border: `1px solid ${active ? THEME.ink : THEME.border}`,
              borderRadius: 3,
              cursor: 'pointer',
              fontWeight: active ? 500 : 400,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
