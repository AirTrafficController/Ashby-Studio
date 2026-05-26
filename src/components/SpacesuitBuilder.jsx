import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, ChevronUp, ChevronDown, Search, X, AlertCircle, Info, Sparkles, Loader2, CheckCircle2, AlertTriangle, Columns2, Minus } from 'lucide-react';
import { THEME, PALETTE } from '../theme.js';
import { MATERIALS } from '../data/materials.js';
import { analyzeBuild, analyzeComparison } from '../lib/aiAnalyze.js';

const fmt = (n, d = 2) => {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1000) return n.toFixed(0);
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(d);
};

let _seq = 0;
function uid() { return `sl-${++_seq}-${Math.random().toString(36).slice(2, 5)}`; }
function makeSlot() { return { id: uid(), materialId: null, materialIdB: null, plies: 1 }; }
function makeLayer(name) { return { id: uid(), name, slots: [makeSlot()] }; }

const DEFAULT_LAYERS = [
  'Outer Shell',
  'Thermal Insulation',
  'Pressure Bladder',
  'Inner Liner',
];

/* ============================================================
   WSM SCORING — Weighted Sum Model with layer-specific presets
   Each material is scored 0–100 against the pool's range,
   weighted by what matters most in that layer's role.
   Lower-is-better properties (density, cost) are inverted.
   ============================================================ */

const LAYER_WEIGHTS_MAP = {
  'Outer Shell':        { density: 0.10, modulus: 0.15, strength: 0.30, tMax: 0.20, chemRes: 0.20, cost: 0.05 },
  'Thermal Insulation': { density: 0.15, modulus: 0.05, strength: 0.10, tMax: 0.40, chemRes: 0.15, cost: 0.15 },
  'Pressure Bladder':   { density: 0.10, modulus: 0.10, strength: 0.20, tMax: 0.15, chemRes: 0.35, cost: 0.10 },
  'Inner Liner':        { density: 0.25, modulus: 0.05, strength: 0.10, tMax: 0.10, chemRes: 0.25, cost: 0.25 },
};
const DEFAULT_WEIGHTS = { density: 0.15, modulus: 0.15, strength: 0.20, tMax: 0.20, chemRes: 0.20, cost: 0.10 };

const LOWER_BETTER = new Set(['density', 'cost']);

function computeNorms(pool) {
  const keys = ['density', 'modulus', 'strength', 'tMax', 'cost', 'chemRes'];
  const out = {};
  for (const k of keys) {
    const vals = pool.map(m => m.props?.[k]).filter(Number.isFinite);
    out[k] = vals.length
      ? { lo: Math.min(...vals), hi: Math.max(...vals) }
      : { lo: 0, hi: 1 };
  }
  return out;
}

function wsmScore(material, layerName, norms) {
  if (!material?.props || !norms) return null;
  const weights = LAYER_WEIGHTS_MAP[layerName] ?? DEFAULT_WEIGHTS;
  let score = 0;
  for (const [k, w] of Object.entries(weights)) {
    const v = material.props[k];
    const { lo, hi } = norms[k];
    if (!Number.isFinite(v) || hi === lo) { score += w * 0.5; continue; }
    let norm = (v - lo) / (hi - lo);
    if (LOWER_BETTER.has(k)) norm = 1 - norm;
    score += w * norm;
  }
  return Math.round(score * 100);
}

/* Compact, serializable snapshot of the build for the AI reviewer. */
function buildReviewPayload(layers, pool, norms) {
  return {
    layers: layers.map((layer, index) => ({
      index,
      name: layer.name,
      slots: layer.slots.map((s) => {
        const mat = s.materialId ? pool.find((m) => m.id === s.materialId) : null;
        return {
          plies: s.plies,
          name: mat?.name ?? null,
          family: mat?.family ?? null,
          props: mat?.props ?? null,
          score: mat ? wsmScore(mat, layer.name, norms) : null,
        };
      }),
    })),
  };
}

/* Snapshot of both Suit 1 / Suit 2 picks per layer for the comparison reviewer. */
function buildComparisonPayload(layers, pool, norms) {
  const pick = (id, layerName) => {
    const mat = id ? pool.find((m) => m.id === id) : null;
    return mat ? {
      name: mat.name,
      family: mat.family ?? null,
      props: mat.props ?? null,
      score: wsmScore(mat, layerName, norms),
    } : null;
  };
  return {
    overall1: overallFor(layers, pool, norms, 'materialId'),
    overall2: overallFor(layers, pool, norms, 'materialIdB'),
    layers: layers.map((layer, index) => ({
      index,
      name: layer.name,
      suit1: layer.slots.map((s) => ({ plies: s.plies, ...(pick(s.materialId, layer.name) ?? { name: null }) })),
      suit2: layer.slots.map((s) => ({ plies: s.plies, ...(pick(s.materialIdB, layer.name) ?? { name: null }) })),
    })),
  };
}

function scoreColor(s) {
  const hue = Math.max(0, Math.min(120, s * 1.2));
  return `hsl(${hue}, 60%, 42%)`;
}

function ScoreBadge({ score, width = 48 }) {
  if (score == null) return null;
  const c = scoreColor(score);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, maxWidth: '100%' }}>
      <div style={{
        width, height: 4, borderRadius: 2,
        background: THEME.borderSoft, overflow: 'hidden', flexShrink: 1, minWidth: 16,
      }}>
        <div style={{
          width: `${score}%`, height: '100%', background: c,
          borderRadius: 2, transition: 'width 220ms ease',
        }} />
      </div>
      <span className="font-mono" style={{ fontSize: 10, color: c, fontWeight: 600, minWidth: 18, textAlign: 'right', flexShrink: 0 }}>
        {score}
      </span>
    </div>
  );
}

/* ============================================================
   PROPS CARD — portal tooltip showing all material properties
   ============================================================ */

function PropsCard({ material, top, left }) {
  if (!material) return null;
  const p = material.props;

  const clampedLeft = Math.min(left, window.innerWidth - 210);
  const clampedTop  = Math.min(top,  window.innerHeight - 280);

  const rows = [
    ['Family',    material.family],
    ['Density',   `${fmt(p.density)} g/cc`],
    ['Modulus',   `${fmt(p.modulus)} GPa`],
    ['Strength',  `${fmt(p.strength, 0)} MPa`],
    ['T_max',     `${fmt(p.tMax, 0)} °C`],
    ['Cost',      '■'.repeat(p.cost) + '□'.repeat(4 - p.cost)],
    ['Chem res.', '■'.repeat(p.chemRes) + '□'.repeat(4 - p.chemRes)],
  ];

  return createPortal(
    <div style={{
      position: 'fixed', top: clampedTop, left: clampedLeft,
      zIndex: 10001,
      background: THEME.paper,
      border: `1px solid ${THEME.border}`,
      borderRadius: 5,
      padding: '10px 14px',
      minWidth: 196,
      boxShadow: '0 10px 28px rgba(0,0,0,0.22)',
      pointerEvents: 'none',
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: THEME.ink, marginBottom: 2,
        fontFamily: 'IBM Plex Serif, serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {material.name}
      </div>
      {material.environment && (
        <div style={{ fontSize: 8, color: THEME.inkFaint, marginBottom: 8,
          fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {material.environment.replace('_', ' ')}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.map(([label, val]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 14 }}>
            <span style={{ fontSize: 9, color: THEME.inkFaint,
              fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {label}
            </span>
            <span style={{ fontSize: 10, color: THEME.ink, fontFamily: 'IBM Plex Mono, monospace', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {val}
            </span>
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
}

/* ============================================================
   MATERIAL SEARCH — dropdown rendered as a body portal so it
   escapes the overflow:hidden card and overflow:auto scroll
   container without any z-index tricks.
   ============================================================ */

function MaterialSearch({ pool, selectedId, onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [dropRect, setDropRect] = useState(null);
  const [hoveredMat, setHoveredMat] = useState(null);
  const [hoverItemTop, setHoverItemTop] = useState(0);
  const [chipInfoOpen, setChipInfoOpen] = useState(false);
  const [chipInfoPos, setChipInfoPos] = useState({ top: 0, left: 0 });
  const anchorRef = useRef(null);
  const portalRef = useRef(null);
  const inputRef = useRef(null);

  const selected = pool.find(m => m.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? pool.filter(m =>
          m.name.toLowerCase().includes(q) ||
          (m.family ?? '').toLowerCase().includes(q))
      : pool;
    return base.slice(0, 14);
  }, [pool, query]);

  const updateRect = () => {
    if (anchorRef.current) setDropRect(anchorRef.current.getBoundingClientRect());
  };

  useEffect(() => {
    if (!open) { setHoveredMat(null); return; }
    updateRect();
    const onScroll = () => updateRect();
    const onResize = () => updateRect();
    const onMouse = e => {
      if (
        !anchorRef.current?.contains(e.target) &&
        !portalRef.current?.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    document.addEventListener('mousedown', onMouse);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('mousedown', onMouse);
    };
  }, [open]);

  // close chip info tooltip on outside click
  useEffect(() => {
    if (!chipInfoOpen) return;
    const handler = () => setChipInfoOpen(false);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [chipInfoOpen]);

  if (selected) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded"
        style={{ border: `1px solid ${THEME.border}`, background: THEME.paper, position: 'relative' }}>
        <span className="flex-1 text-xs font-body truncate" style={{ color: THEME.ink }}>
          {selected.name}
        </span>
        <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-sm flex-shrink-0"
          style={{ background: THEME.paperDark, color: THEME.inkMuted }}>
          {selected.family}
        </span>
        <button
          title="View material properties"
          onMouseDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            setChipInfoPos({ top: r.bottom + 4, left: r.left - 180 });
            setChipInfoOpen(v => !v);
          }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: THEME.inkMuted,
            padding: 2, flexShrink: 0, opacity: 0.7, transition: 'opacity 120ms' }}
          onMouseEnter={e => { e.currentTarget.style.opacity = 1; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = 0.7; }}
        >
          <Info size={11} />
        </button>
        <button
          onClick={() => { onSelect(null); setChipInfoOpen(false); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: THEME.inkMuted, padding: 2, flexShrink: 0 }}>
          <X size={11} />
        </button>
        {chipInfoOpen && (
          <PropsCard material={selected} top={chipInfoPos.top} left={chipInfoPos.left} />
        )}
      </div>
    );
  }

  return (
    <div ref={anchorRef}>
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded"
        style={{
          border: `1px solid ${open ? THEME.inkMuted : THEME.border}`,
          background: THEME.paperLight,
          transition: 'border-color 120ms ease',
        }}>
        <Search size={11} style={{ color: THEME.inkFaint, flexShrink: 0 }} />
        <input
          ref={inputRef}
          className="flex-1 text-xs font-body bg-transparent outline-none"
          style={{ color: THEME.ink, minWidth: 0 }}
          placeholder="Search material…"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); updateRect(); }}
          onFocus={() => { setOpen(true); updateRect(); }}
        />
        {query && (
          <button onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: THEME.inkMuted, padding: 2 }}>
            <X size={10} />
          </button>
        )}
      </div>

      {open && dropRect && createPortal(
        <div ref={portalRef} style={{
          position: 'fixed',
          top: dropRect.bottom + 3,
          left: dropRect.left,
          width: dropRect.width,
          zIndex: 9999,
          background: THEME.paperLight,
          border: `1px solid ${THEME.border}`,
          borderRadius: 3,
          maxHeight: 220,
          overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        }}>
          {filtered.length === 0 ? (
            <div className="px-3 py-2.5 text-xs font-body" style={{ color: THEME.inkFaint }}>
              No materials match "{query}"
            </div>
          ) : filtered.map((m, i) => (
            <button
              key={m.id}
              style={{
                width: '100%', textAlign: 'left',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                borderBottom: i < filtered.length - 1 ? `1px solid ${THEME.borderSoft}` : 'none',
                cursor: 'pointer',
                display: 'flex', gap: 8,
                transition: 'background 80ms ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = THEME.paperDark;
                setHoveredMat(m);
                setHoverItemTop(e.currentTarget.getBoundingClientRect().top);
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                setHoveredMat(null);
              }}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onSelect(m.id); setQuery(''); setOpen(false); setHoveredMat(null); }}
            >
              <span className="text-xs font-body flex-1 truncate" style={{ color: THEME.ink }}>{m.name}</span>
              <span className="font-mono text-[9px] flex-shrink-0" style={{ color: THEME.inkFaint }}>{m.family}</span>
            </button>
          ))}
        </div>,
        document.body
      )}

      {/* Hover tooltip to the right of the dropdown */}
      {open && hoveredMat && dropRect && (
        <PropsCard material={hoveredMat} top={hoverItemTop} left={dropRect.right + 8} />
      )}
    </div>
  );
}

/* ============================================================
   SLOT ROW — one material + ply count inside a layer
   ============================================================ */

function CompareCell({ label, color, score, win }) {
  return (
    <div className="flex-1 flex items-center gap-2 rounded px-2 py-1"
      style={{ background: win && score != null ? `${color}14` : THEME.paperLight,
        border: `1px solid ${win && score != null ? color : THEME.borderSoft}`, minWidth: 0 }}>
      <span className="font-mono uppercase flex-shrink-0" style={{ fontSize: 8, letterSpacing: '0.08em', color }}>{label}</span>
      <div className="flex-1 min-w-0">
        {score != null
          ? <ScoreBadge score={score} width={36} />
          : <span className="font-mono" style={{ fontSize: 10, color: THEME.inkFaint }}>—</span>}
      </div>
    </div>
  );
}

function SlotRow({ slot, pool, onUpdate, onRemove, canRemove, layerName, norms, compareMode }) {
  const material = slot.materialId ? pool.find(m => m.id === slot.materialId) : null;
  const score = material ? wsmScore(material, layerName, norms) : null;
  const materialB = slot.materialIdB ? pool.find(m => m.id === slot.materialIdB) : null;
  const scoreB = materialB ? wsmScore(materialB, layerName, norms) : null;

  return (
    <div className="flex flex-col gap-1.5 rounded px-2 py-2"
      style={{ background: THEME.paper, border: `1px solid ${THEME.borderSoft}` }}>
      <div className="flex items-center gap-1.5">
        {compareMode && (
          <span className="font-mono uppercase flex-shrink-0" style={{ fontSize: 8, letterSpacing: '0.08em', color: PALETTE[0], width: 34 }}>Suit 1</span>
        )}
        <div className="flex-1">
          <MaterialSearch
            pool={pool}
            selectedId={slot.materialId}
            onSelect={id => onUpdate({ materialId: id })}
          />
        </div>
        {canRemove && (
          <button
            onClick={onRemove}
            title="Remove this material"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: THEME.accent, padding: '3px 4px', flexShrink: 0 }}>
            <X size={12} />
          </button>
        )}
      </div>

      {compareMode && (
        <div className="flex items-center gap-1.5">
          <span className="font-mono uppercase flex-shrink-0" style={{ fontSize: 8, letterSpacing: '0.08em', color: PALETTE[1], width: 34 }}>Suit 2</span>
          <div className="flex-1">
            <MaterialSearch
              pool={pool}
              selectedId={slot.materialIdB}
              onSelect={id => onUpdate({ materialIdB: id })}
            />
          </div>
          {canRemove && <div style={{ width: 22, flexShrink: 0 }} />}
        </div>
      )}

      {compareMode && (material || materialB) && (
        <div className="flex items-stretch gap-2 pt-1.5" style={{ borderTop: `1px solid ${THEME.borderSoft}` }}>
          <CompareCell label="Suit 1" color={PALETTE[0]} score={score} win={score != null && (scoreB == null || score >= scoreB)} />
          <CompareCell label="Suit 2" color={PALETTE[1]} score={scoreB} win={scoreB != null && (score == null || scoreB > score)} />
        </div>
      )}

      {!compareMode && material && (
        <div className="flex items-center gap-3 pt-1.5 flex-wrap" style={{ borderTop: `1px solid ${THEME.borderSoft}`, minWidth: 0 }}>
          <label className="flex items-center gap-2 flex-shrink-0">
            <span className="font-mono uppercase"
              style={{ fontSize: 9, letterSpacing: '0.1em', color: THEME.inkFaint }}>Plies</span>
            <input
              type="number" min={1} max={20}
              value={slot.plies}
              onChange={e => onUpdate({ plies: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)) })}
              className="font-mono text-center"
              style={{
                width: 44, fontSize: 12, padding: '2px 4px',
                border: `1px solid ${THEME.border}`,
                background: THEME.paperLight,
                color: THEME.ink, borderRadius: 3, outline: 'none',
              }}
            />
          </label>
          <div className="flex gap-3 flex-shrink-0">
            {[['ρ', 'density'], ['E', 'modulus'], ['σ', 'strength'], ['T', 'tMax']].map(([sym, key]) => (
              <div key={key} className="flex flex-col items-center" style={{ minWidth: 26 }}>
                <span className="font-mono" style={{ fontSize: 9, color: THEME.inkFaint }}>{sym}</span>
                <span className="font-mono text-[11px]" style={{ color: THEME.ink, fontWeight: 500 }}>
                  {fmt(material.props[key], key === 'tMax' ? 0 : 2)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex-1" style={{ minWidth: 0 }} />
          <div className="flex-shrink-0 ml-auto" title={`Layer fit score for "${layerName}" (WSM, 0–100)`}>
            <ScoreBadge score={score} width={40} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   LAYER CARD — editable name + N stacked material slots
   ============================================================ */

function LayerCard({ layer, index, total, pool, color, onUpdate, onRemove, onMove, norms, compareMode }) {
  const addSlot = () => onUpdate({ slots: [...layer.slots, makeSlot()] });
  const removeSlot = id => onUpdate({ slots: layer.slots.filter(s => s.id !== id) });
  const updateSlot = (id, patch) =>
    onUpdate({ slots: layer.slots.map(s => s.id === id ? { ...s, ...patch } : s) });

  const layerScores = layer.slots
    .map(s => s.materialId ? pool.find(m => m.id === s.materialId) : null)
    .map(m => m ? wsmScore(m, layer.name, norms) : null)
    .filter(s => s != null);
  const avgScore = layerScores.length
    ? Math.round(layerScores.reduce((a, b) => a + b, 0) / layerScores.length)
    : null;
  const presetMatch = !!LAYER_WEIGHTS_MAP[layer.name];

  return (
    <div className="rounded"
      style={{ border: `1px solid ${THEME.border}`, borderLeft: `3px solid ${color}`, background: THEME.paperLight }}>

      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="font-mono text-[10px] flex items-center justify-center flex-shrink-0"
          style={{ width: 22, height: 22, background: color, color: 'white', borderRadius: 3, fontWeight: 700 }}>
          {index + 1}
        </span>
        <input
          className="flex-1 font-body text-sm bg-transparent outline-none"
          style={{
            color: THEME.ink, fontWeight: 500, border: 'none',
            borderBottom: `1px solid ${THEME.borderSoft}`, padding: '1px 4px', minWidth: 0,
          }}
          value={layer.name}
          onChange={e => onUpdate({ name: e.target.value })}
          placeholder="Layer name…"
        />
        {avgScore != null && (
          <div className="flex-shrink-0" title={presetMatch
            ? `Avg layer score using "${layer.name}" preset weights`
            : `Avg layer score using default weights (rename to a preset for tailored weighting)`}>
            <ScoreBadge score={avgScore} width={36} />
          </div>
        )}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button className="btn btn-ghost" onClick={() => onMove(-1)} disabled={index === 0}
            style={{ opacity: index === 0 ? 0.25 : 1, padding: '3px 5px' }} title="Move outward">
            <ChevronUp size={12} />
          </button>
          <button className="btn btn-ghost" onClick={() => onMove(1)} disabled={index === total - 1}
            style={{ opacity: index === total - 1 ? 0.25 : 1, padding: '3px 5px' }} title="Move inward">
            <ChevronDown size={12} />
          </button>
          <button className="btn btn-ghost" onClick={onRemove}
            style={{ color: THEME.accent, padding: '3px 5px' }} title="Remove layer">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Material slots */}
      <div className="px-3 pb-2.5 flex flex-col gap-2">
        {layer.slots.map(slot => (
          <SlotRow
            key={slot.id}
            slot={slot}
            pool={pool}
            onUpdate={patch => updateSlot(slot.id, patch)}
            onRemove={() => removeSlot(slot.id)}
            canRemove={layer.slots.length > 1}
            layerName={layer.name}
            norms={norms}
            compareMode={compareMode}
          />
        ))}

        <button
          onClick={addSlot}
          className="btn btn-ghost w-full justify-center"
          style={{
            fontSize: 11, color: THEME.inkMuted,
            border: `1px dashed ${THEME.border}`,
            borderRadius: 3, padding: '5px 0',
          }}
        >
          <Plus size={11} /> Add material
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   AI REVIEW PANEL — qualitative second opinion on the build.
   Bring-your-own-key, advisory only; never emits a score.
   ============================================================ */

const VERDICT_STYLE = {
  good:     { icon: CheckCircle2,  color: 'hsl(140,55%,38%)', label: 'Good' },
  workable: { icon: Info,          color: THEME.inkMuted,     label: 'Workable' },
  concern:  { icon: AlertTriangle, color: THEME.accent,       label: 'Concern' },
};

function BuildReviewPanel({ layers, pool, norms }) {
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem('ashby:anthropicKey') || ''; } catch { return ''; }
  });
  useEffect(() => {
    try { localStorage.setItem('ashby:anthropicKey', apiKey); } catch {}
  }, [apiKey]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [review, setReview] = useState(null);

  const hasMaterial = layers.some((l) => l.slots.some((s) => s.materialId));

  async function run() {
    setError('');
    setLoading(true);
    setReview(null);
    try {
      const payload = buildReviewPayload(layers, pool, norms);
      setReview(await analyzeBuild(payload, apiKey.trim()));
    } catch (e) {
      setError(e?.message || 'Review failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-5 rounded" style={{ border: `1px solid ${THEME.border}`, background: THEME.paperLight }}>
      <div className="flex items-center gap-1.5 px-3 py-2" style={{ borderBottom: `1px solid ${THEME.borderSoft}` }}>
        <Sparkles size={12} style={{ color: THEME.accent }} />
        <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: THEME.inkMuted }}>
          AI review
        </span>
        <span className="font-mono text-[9px] ml-auto" style={{ color: THEME.inkFaint }}>
          advisory · qualitative
        </span>
      </div>

      <div className="px-3 py-2.5 flex flex-col gap-2">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Anthropic API key (sk-ant-…)"
          autoComplete="off"
          className="font-mono w-full"
          style={{
            fontSize: 11, padding: '4px 6px',
            border: `1px solid ${THEME.border}`, background: THEME.paper,
            color: THEME.ink, borderRadius: 3, outline: 'none',
          }}
        />
        <div className="font-mono text-[9px] leading-snug" style={{ color: THEME.inkFaint }}>
          stored in this browser only · used for your own calls ·{' '}
          <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{ color: THEME.accent }}>get a key</a>
        </div>
        <button
          className="btn btn-primary"
          onClick={run}
          disabled={loading || !hasMaterial}
          style={{ opacity: loading || !hasMaterial ? 0.5 : 1, justifyContent: 'center' }}
          title={hasMaterial ? 'Ask the model to review this suit configuration' : 'Assign a material to at least one layer first'}
        >
          {loading
            ? <><Loader2 size={12} className="ai-spin" /> Analysing…</>
            : <><Sparkles size={12} /> Analyse this suit</>}
        </button>

        {error && <div className="text-[11px]" style={{ color: THEME.accent }}>{error}</div>}

        {review && (
          <div className="flex flex-col gap-3 pt-1">
            {review.summary && (
              <p className="font-body" style={{ fontSize: 12, lineHeight: 1.5, color: THEME.ink }}>
                {review.summary}
              </p>
            )}

            {review.layers.length > 0 && (
              <div className="flex flex-col gap-2">
                {review.layers.map((l, i) => {
                  const vs = VERDICT_STYLE[l.verdict] ?? VERDICT_STYLE.workable;
                  const VIcon = vs.icon;
                  return (
                    <div key={i} className="rounded px-2.5 py-2" style={{ background: THEME.paper, border: `1px solid ${THEME.borderSoft}` }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <VIcon size={12} style={{ color: vs.color, flexShrink: 0 }} />
                        <span className="font-body truncate" style={{ fontSize: 12, fontWeight: 600, color: THEME.ink }}>{l.name}</span>
                        <span className="font-mono text-[9px] uppercase tracking-wider ml-auto" style={{ color: vs.color }}>{vs.label}</span>
                      </div>
                      {l.note && (
                        <p className="font-body" style={{ fontSize: 11, lineHeight: 1.45, color: THEME.inkMuted }}>{l.note}</p>
                      )}
                      {l.suggestions.length > 0 && (
                        <ul className="mt-1.5 flex flex-col gap-1">
                          {l.suggestions.map((s, j) => (
                            <li key={j} className="font-body flex gap-1.5" style={{ fontSize: 11, lineHeight: 1.4, color: THEME.inkMuted }}>
                              <span style={{ color: THEME.accent }}>→</span>{s}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {review.interactions.length > 0 && (
              <ReviewList title="Cross-layer notes" items={review.interactions} icon={AlertTriangle} color={THEME.accent} />
            )}
            {review.missing.length > 0 && (
              <ReviewList title="Gaps" items={review.missing} icon={AlertCircle} color={THEME.inkMuted} />
            )}

            <div className="font-mono text-[9px] leading-snug" style={{ color: THEME.inkFaint }}>
              AI-generated advisory notes — review against the WSM scores and your own judgement before acting.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewList({ title, items, icon: Icon, color }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} style={{ color }} />
        <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: THEME.inkMuted }}>{title}</span>
      </div>
      <ul className="flex flex-col gap-1">
        {items.map((s, i) => (
          <li key={i} className="font-body flex gap-1.5" style={{ fontSize: 11, lineHeight: 1.4, color: THEME.inkMuted }}>
            <span style={{ color }}>•</span>{s}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ============================================================
   SUIT SUMMARY — right panel
   ============================================================ */

function SuitSummary({ layers, pool, norms }) {
  const allSlots = layers.flatMap(l => l.slots);
  const configuredSlots = allSlots.filter(s => s.materialId);
  const totalPlies = allSlots.reduce((s, sl) => s + sl.plies, 0);
  const configuredLayers = layers.filter(l => l.slots.some(s => s.materialId));

  // Overall suit score: average of each layer's average score, weighted by ply count
  const overallScore = (() => {
    let num = 0, den = 0;
    for (const layer of layers) {
      const layerMatScores = layer.slots
        .map(s => {
          const m = s.materialId ? pool.find(mm => mm.id === s.materialId) : null;
          const sc = m ? wsmScore(m, layer.name, norms) : null;
          return sc != null ? { sc, plies: s.plies } : null;
        })
        .filter(Boolean);
      for (const { sc, plies } of layerMatScores) {
        num += sc * plies;
        den += plies;
      }
    }
    return den > 0 ? Math.round(num / den) : null;
  })();

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Cross-section visual */}
      <div className="px-6 py-5 flex-shrink-0" style={{ borderBottom: `1px solid ${THEME.border}` }}>
        <div className="flex items-baseline gap-3 mb-3">
          <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: THEME.inkMuted }}>
            Suit cross-section
          </span>
          <span className="font-mono text-[9px]" style={{ color: THEME.inkFaint }}>outer → inner</span>
        </div>

        {layers.length === 0 ? (
          <div className="text-xs font-body py-4 text-center" style={{ color: THEME.inkFaint }}>
            Add layers on the left to begin.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {layers.map((layer, idx) => {
              const color = PALETTE[idx % PALETTE.length];
              const layerPlies = layer.slots.reduce((s, sl) => s + sl.plies, 0);
              const barH = 26 + (layerPlies - 1) * 5;
              const assigned = layer.slots.filter(s => s.materialId);
              const names = assigned.map(s => pool.find(m => m.id === s.materialId)?.name ?? '').filter(Boolean);
              return (
                <div key={layer.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: barH }}>
                  <span className="font-mono text-right flex-shrink-0 truncate"
                    style={{ width: 130, fontSize: 10, color: THEME.ink, fontWeight: 500 }}
                    title={layer.name}>
                    {layer.name}
                  </span>
                  <div style={{
                    flex: 1, height: barH,
                    background: assigned.length > 0 ? color : THEME.borderSoft,
                    opacity: assigned.length > 0 ? 0.8 : 0.35,
                    borderRadius: 2,
                    display: 'flex', alignItems: 'center',
                    paddingLeft: 10, paddingRight: 10, overflow: 'hidden',
                  }}>
                    {assigned.length > 0 ? (
                      <span className="font-mono truncate"
                        style={{ fontSize: 10, color: 'white', fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                        {names.join(' + ')}
                        {layerPlies > 1 ? ` (${layerPlies} pl.)` : ''}
                      </span>
                    ) : (
                      <span className="font-mono" style={{ fontSize: 9, color: THEME.inkFaint }}>
                        — no material —
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[9px] flex-shrink-0" style={{ color: THEME.inkFaint, width: 32 }}>
                    {layerPlies > 1 ? `×${layerPlies}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats strip */}
      {layers.length > 0 && (
        <div className="flex items-center gap-6 px-6 py-2 flex-shrink-0"
          style={{ borderBottom: `1px solid ${THEME.border}`, background: THEME.paper }}>
          <Stat label="Layers" value={layers.length} />
          <Stat label="Total plies" value={totalPlies} />
          <Stat label="Assigned" value={`${configuredLayers.length}/${layers.length}`} />
          {configuredSlots.length > 0 && (
            <Stat label="Min T-max °C"
              value={fmt(Math.min(...configuredSlots.map(s =>
                pool.find(m => m.id === s.materialId)?.props.tMax ?? Infinity)), 0)} />
          )}
          {overallScore != null && (
            <div className="flex flex-col">
              <span className="font-mono" style={{ fontSize: 9, color: THEME.inkFaint, letterSpacing: '0.08em' }}>
                SUIT SCORE
              </span>
              <div style={{ marginTop: 4 }}>
                <ScoreBadge score={overallScore} width={64} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Properties table */}
      <div className="flex-1 overflow-y-auto scroll-thin px-6 py-4">
        {configuredSlots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: THEME.inkFaint }}>
            <AlertCircle size={20} style={{ opacity: 0.4 }} />
            <span className="text-xs font-body">
              Select a material for at least one layer to see the properties table.
            </span>
          </div>
        ) : (
          <>
            <div className="font-mono text-[10px] uppercase tracking-wider mb-3" style={{ color: THEME.inkMuted }}>
              Layer properties
            </div>
            <div className="rounded overflow-hidden" style={{ border: `1px solid ${THEME.border}` }}>
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: THEME.paper }}>
                    {['#', 'Layer / Material', 'Family', 'Plies', 'ρ g/cc', 'E GPa', 'σ MPa', 'T_max °C', 'Cost', 'Chem', 'Score'].map(h => (
                      <th key={h} className="font-mono text-left px-2 py-2"
                        style={{ fontSize: 9, letterSpacing: '0.05em', color: THEME.inkMuted, fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {layers.map((layer, idx) => {
                    const color = PALETTE[idx % PALETTE.length];
                    return layer.slots.map((slot, si) => {
                      const mat = slot.materialId ? pool.find(m => m.id === slot.materialId) : null;
                      const isFirst = si === 0;
                      return (
                        <tr key={slot.id} style={{ borderTop: `1px solid ${THEME.borderSoft}` }}>
                          {isFirst && (
                            <td className="px-2 py-2 align-top" rowSpan={layer.slots.length}>
                              <span className="font-mono"
                                style={{ fontSize: 9, background: color, color: 'white', padding: '2px 5px', borderRadius: 2, fontWeight: 600 }}>
                                {idx + 1}
                              </span>
                            </td>
                          )}
                          <td className="px-2 py-2" style={{ maxWidth: 160 }}>
                            {isFirst && (
                              <div className="font-body truncate"
                                style={{ fontSize: 12, color: THEME.ink, fontWeight: 500, marginBottom: 1 }}
                                title={layer.name}>
                                {layer.name}
                              </div>
                            )}
                            <div className="font-body truncate"
                              style={{ fontSize: 11, color: mat ? THEME.inkMuted : THEME.inkFaint }}
                              title={mat?.name}>
                              {mat ? mat.name : '—'}
                            </div>
                          </td>
                          <td className="px-2 py-2 font-mono" style={{ fontSize: 10, color: THEME.inkMuted, whiteSpace: 'nowrap' }}>
                            {mat?.family ?? '—'}
                          </td>
                          <td className="px-2 py-2 font-mono text-center" style={{ fontSize: 11, color: THEME.ink }}>
                            {slot.plies}
                          </td>
                          <td className="px-2 py-2 font-mono text-right" style={{ fontSize: 11, color: THEME.ink }}>
                            {mat ? fmt(mat.props.density) : '—'}
                          </td>
                          <td className="px-2 py-2 font-mono text-right" style={{ fontSize: 11, color: THEME.ink }}>
                            {mat ? fmt(mat.props.modulus) : '—'}
                          </td>
                          <td className="px-2 py-2 font-mono text-right" style={{ fontSize: 11, color: THEME.ink }}>
                            {mat ? fmt(mat.props.strength, 0) : '—'}
                          </td>
                          <td className="px-2 py-2 font-mono text-right" style={{ fontSize: 11, color: THEME.ink }}>
                            {mat ? fmt(mat.props.tMax, 0) : '—'}
                          </td>
                          <td className="px-2 py-2 font-mono text-center" style={{ fontSize: 11, color: THEME.ink }}>
                            {mat ? mat.props.cost : '—'}
                          </td>
                          <td className="px-2 py-2 font-mono text-center" style={{ fontSize: 11, color: THEME.ink }}>
                            {mat ? mat.props.chemRes : '—'}
                          </td>
                          <td className="px-2 py-2" style={{ minWidth: 88 }}>
                            {mat ? <ScoreBadge score={wsmScore(mat, layer.name, norms)} /> : (
                              <span className="font-mono" style={{ fontSize: 11, color: THEME.inkFaint }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
            <div className="font-mono text-[9px] mt-3" style={{ color: THEME.inkFaint }}>
              Cost: 1=low → 4=very high · Chem resistance: 1=poor → 4=excellent · T_max = max continuous use temperature
            </div>
            <div className="font-mono text-[9px] mt-1" style={{ color: THEME.inkFaint }}>
              Score: WSM 0–100 vs. pool range, weighted per layer role (rename a layer to a preset — Outer Shell, Thermal Insulation, Pressure Bladder, Inner Liner — for tailored weights).
            </div>
            <BuildReviewPanel layers={layers} pool={pool} norms={norms} />
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono" style={{ fontSize: 9, color: THEME.inkFaint, letterSpacing: '0.08em' }}>
        {label.toUpperCase()}
      </span>
      <span className="font-display" style={{ fontSize: 20, color: THEME.ink, lineHeight: 1.1 }}>
        {value}
      </span>
    </div>
  );
}

/* ============================================================
   COMPARISON SUMMARY — side-by-side Suit 1 vs Suit 2 diff
   ============================================================ */

function overallFor(layers, pool, norms, key) {
  let num = 0, den = 0;
  for (const layer of layers) {
    for (const s of layer.slots) {
      const m = s[key] ? pool.find(mm => mm.id === s[key]) : null;
      const sc = m ? wsmScore(m, layer.name, norms) : null;
      if (sc != null) { num += sc * s.plies; den += s.plies; }
    }
  }
  return den > 0 ? Math.round(num / den) : null;
}

function avgLayerScore(layer, pool, norms, key) {
  const scores = layer.slots
    .map(s => s[key] ? pool.find(m => m.id === s[key]) : null)
    .map(m => m ? wsmScore(m, layer.name, norms) : null)
    .filter(s => s != null);
  return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
}

function layerNames(layer, pool, key) {
  const names = layer.slots
    .map(s => s[key] ? pool.find(m => m.id === s[key])?.name : null)
    .filter(Boolean);
  return names.length ? names.join(' + ') : null;
}

function DeltaTag({ a, b }) {
  if (a == null || b == null) return <Minus size={11} style={{ color: THEME.inkFaint }} />;
  const d = a - b;
  if (d === 0) return <span className="font-mono text-[10px]" style={{ color: THEME.inkFaint }}>tie</span>;
  const color = d > 0 ? PALETTE[0] : PALETTE[1];
  return (
    <span className="font-mono text-[10px]" style={{ color, fontWeight: 600 }}>
      {d > 0 ? '◄ +' : '+'}{Math.abs(d)}{d > 0 ? '' : ' ►'}
    </span>
  );
}

function ComparisonReviewPanel({ layers, pool, norms }) {
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem('ashby:anthropicKey') || ''; } catch { return ''; }
  });
  useEffect(() => {
    try { localStorage.setItem('ashby:anthropicKey', apiKey); } catch {}
  }, [apiKey]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [review, setReview] = useState(null);

  const hasPick = layers.some((l) => l.slots.some((s) => s.materialId || s.materialIdB));

  async function run() {
    setError('');
    setLoading(true);
    setReview(null);
    try {
      setReview(await analyzeComparison(buildComparisonPayload(layers, pool, norms), apiKey.trim()));
    } catch (e) {
      setError(e?.message || 'Evaluation failed.');
    } finally {
      setLoading(false);
    }
  }

  const recLabel = { '1': 'Suit 1', '2': 'Suit 2', tie: 'Too close to call' };
  const recColor = (r) => (r === '1' ? PALETTE[0] : r === '2' ? PALETTE[1] : THEME.inkMuted);
  const winnerTag = (w) => {
    if (w === '1') return { label: 'Suit 1', color: PALETTE[0] };
    if (w === '2') return { label: 'Suit 2', color: PALETTE[1] };
    return { label: 'Tie', color: THEME.inkFaint };
  };

  return (
    <div className="mt-5 rounded" style={{ border: `1px solid ${THEME.border}`, background: THEME.paperLight }}>
      <div className="flex items-center gap-1.5 px-3 py-2" style={{ borderBottom: `1px solid ${THEME.borderSoft}` }}>
        <Sparkles size={12} style={{ color: THEME.accent }} />
        <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: THEME.inkMuted }}>
          AI evaluation
        </span>
        <span className="font-mono text-[9px] ml-auto" style={{ color: THEME.inkFaint }}>
          advisory · suit 1 vs suit 2
        </span>
      </div>

      <div className="px-3 py-2.5 flex flex-col gap-2">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Anthropic API key (sk-ant-…)"
          autoComplete="off"
          className="font-mono w-full"
          style={{
            fontSize: 11, padding: '4px 6px',
            border: `1px solid ${THEME.border}`, background: THEME.paper,
            color: THEME.ink, borderRadius: 3, outline: 'none',
          }}
        />
        <div className="font-mono text-[9px] leading-snug" style={{ color: THEME.inkFaint }}>
          stored in this browser only · used for your own calls ·{' '}
          <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{ color: THEME.accent }}>get a key</a>
        </div>
        <button
          className="btn btn-primary"
          onClick={run}
          disabled={loading || !hasPick}
          style={{ opacity: loading || !hasPick ? 0.5 : 1, justifyContent: 'center' }}
          title={hasPick ? 'Ask the model to weigh Suit 1 against Suit 2' : 'Assign a material to Suit 1 or Suit 2 first'}
        >
          {loading
            ? <><Loader2 size={12} className="ai-spin" /> Evaluating…</>
            : <><Sparkles size={12} /> Evaluate the comparison</>}
        </button>

        {error && <div className="text-[11px]" style={{ color: THEME.accent }}>{error}</div>}

        {review && (
          <div className="flex flex-col gap-3 pt-1">
            <div className="rounded px-3 py-2.5" style={{ background: THEME.paper, border: `1px solid ${recColor(review.recommendation)}` }}>
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle2 size={12} style={{ color: recColor(review.recommendation), flexShrink: 0 }} />
                <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: THEME.inkMuted }}>Recommendation</span>
                <span className="font-mono text-[10px] uppercase tracking-wider ml-auto" style={{ color: recColor(review.recommendation), fontWeight: 700 }}>
                  {recLabel[review.recommendation]}
                </span>
              </div>
              {review.summary && (
                <p className="font-body" style={{ fontSize: 12, lineHeight: 1.5, color: THEME.ink }}>{review.summary}</p>
              )}
            </div>

            {review.reasoning && (
              <div>
                <div className="font-mono text-[9px] uppercase tracking-wider mb-1" style={{ color: THEME.inkMuted }}>Thinking</div>
                <p className="font-body" style={{ fontSize: 11.5, lineHeight: 1.5, color: THEME.inkMuted }}>{review.reasoning}</p>
              </div>
            )}

            {review.layers.length > 0 && (
              <div className="flex flex-col gap-2">
                {review.layers.map((l, i) => {
                  const wt = winnerTag(l.winner);
                  return (
                    <div key={i} className="rounded px-2.5 py-2" style={{ background: THEME.paper, border: `1px solid ${THEME.borderSoft}` }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="font-body truncate" style={{ fontSize: 12, fontWeight: 600, color: THEME.ink }}>{l.name}</span>
                        <span className="font-mono text-[9px] uppercase tracking-wider ml-auto px-1.5 py-0.5 rounded-sm"
                          style={{ color: 'white', background: wt.color }}>{wt.label}</span>
                      </div>
                      {l.note && (
                        <p className="font-body" style={{ fontSize: 11, lineHeight: 1.45, color: THEME.inkMuted }}>{l.note}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {review.considerations.length > 0 && (
              <ReviewList title="Deciding factors" items={review.considerations} icon={AlertTriangle} color={THEME.accent} />
            )}

            <div className="font-mono text-[9px] leading-snug" style={{ color: THEME.inkFaint }}>
              AI-generated advisory evaluation — weigh it against the WSM scores and your own judgement before deciding.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ComparisonSummary({ layers, pool, norms }) {
  const overallA = overallFor(layers, pool, norms, 'materialId');
  const overallB = overallFor(layers, pool, norms, 'materialIdB');
  const hasAny = overallA != null || overallB != null;
  const winner = overallA != null && overallB != null
    ? (overallA === overallB ? 'tie' : overallA > overallB ? 'A' : 'B')
    : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 flex-shrink-0" style={{ borderBottom: `1px solid ${THEME.border}` }}>
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: THEME.inkMuted }}>
            Suit comparison
          </span>
          <span className="font-mono text-[9px]" style={{ color: THEME.inkFaint }}>Suit 1 vs Suit 2 · per-layer WSM score</span>
        </div>
      </div>

      {/* Overall scores */}
      <div className="flex items-stretch gap-3 px-6 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${THEME.border}`, background: THEME.paper }}>
        {[['Suit 1', overallA, PALETTE[0], 'A'], ['Suit 2', overallB, PALETTE[1], 'B']].map(([label, sc, color, k]) => (
          <div key={k} className="flex-1 rounded px-3 py-2"
            style={{ border: `1px solid ${winner === k ? color : THEME.borderSoft}`,
              background: winner === k ? `${color}10` : THEME.paperLight }}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: '0.08em', color }}>{label}</span>
              {winner === k && <CheckCircle2 size={11} style={{ color }} />}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display" style={{ fontSize: 24, color: THEME.ink, lineHeight: 1 }}>
                {sc != null ? sc : '—'}
              </span>
              <span className="font-mono text-[9px]" style={{ color: THEME.inkFaint }}>/ 100</span>
            </div>
          </div>
        ))}
      </div>

      {/* Per-layer diff */}
      <div className="flex-1 overflow-y-auto scroll-thin px-6 py-4">
        {!hasAny ? (
          <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: THEME.inkFaint }}>
            <Columns2 size={20} style={{ opacity: 0.4 }} />
            <span className="text-xs font-body text-center">
              Assign a material to Suit 1 and/or Suit 2 in a layer to compare them.
            </span>
          </div>
        ) : (
          <>
            <div className="font-mono text-[10px] uppercase tracking-wider mb-3" style={{ color: THEME.inkMuted }}>
              Per-layer scores
            </div>
            <div className="rounded overflow-hidden" style={{ border: `1px solid ${THEME.border}` }}>
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: THEME.paper }}>
                    {['#', 'Layer', 'Suit 1', 'Suit 2', 'Δ'].map(h => (
                      <th key={h} className="font-mono text-left px-2 py-2"
                        style={{ fontSize: 9, letterSpacing: '0.05em', color: THEME.inkMuted, fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {layers.map((layer, idx) => {
                    const color = PALETTE[idx % PALETTE.length];
                    const sa = avgLayerScore(layer, pool, norms, 'materialId');
                    const sb = avgLayerScore(layer, pool, norms, 'materialIdB');
                    const na = layerNames(layer, pool, 'materialId');
                    const nb = layerNames(layer, pool, 'materialIdB');
                    return (
                      <tr key={layer.id} style={{ borderTop: `1px solid ${THEME.borderSoft}` }}>
                        <td className="px-2 py-2 align-top">
                          <span className="font-mono" style={{ fontSize: 9, background: color, color: 'white', padding: '2px 5px', borderRadius: 2, fontWeight: 600 }}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="px-2 py-2 font-body" style={{ fontSize: 12, color: THEME.ink, fontWeight: 500, maxWidth: 120 }}>
                          <div className="truncate" title={layer.name}>{layer.name}</div>
                        </td>
                        <td className="px-2 py-2" style={{ minWidth: 96 }}>
                          <div className="font-body truncate mb-1" style={{ fontSize: 10, color: na ? THEME.inkMuted : THEME.inkFaint, maxWidth: 110 }} title={na ?? ''}>{na ?? '—'}</div>
                          {sa != null ? <ScoreBadge score={sa} width={36} /> : <span className="font-mono" style={{ fontSize: 10, color: THEME.inkFaint }}>—</span>}
                        </td>
                        <td className="px-2 py-2" style={{ minWidth: 96 }}>
                          <div className="font-body truncate mb-1" style={{ fontSize: 10, color: nb ? THEME.inkMuted : THEME.inkFaint, maxWidth: 110 }} title={nb ?? ''}>{nb ?? '—'}</div>
                          {sb != null ? <ScoreBadge score={sb} width={36} /> : <span className="font-mono" style={{ fontSize: 10, color: THEME.inkFaint }}>—</span>}
                        </td>
                        <td className="px-2 py-2 text-center" style={{ whiteSpace: 'nowrap' }}>
                          <DeltaTag a={sa} b={sb} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="font-mono text-[9px] mt-3" style={{ color: THEME.inkFaint }}>
              Δ shows the Suit 1 − Suit 2 score gap. ◄ favors Suit 1, ► favors Suit 2. Scores are per-layer WSM averages (0–100) vs. the active material pool.
            </div>
            <ComparisonReviewPanel layers={layers} pool={pool} norms={norms} />
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   MAIN EXPORT
   ============================================================ */

export default function SpacesuitBuilder({ materials: liveMaterials, onSnapshot }) {
  const pool = useMemo(() => {
    const src = Array.isArray(liveMaterials) && liveMaterials.length
      ? liveMaterials
      : MATERIALS;
    return src.filter(m => m.props && typeof m.props.density === 'number');
  }, [liveMaterials]);

  const norms = useMemo(() => computeNorms(pool), [pool]);

  const [layers, setLayers] = useState(() =>
    DEFAULT_LAYERS.map(name => makeLayer(name))
  );

  const [compareMode, setCompareMode] = useState(false);

  const addLayer = () =>
    setLayers(prev => [...prev, makeLayer(`Layer ${prev.length + 1}`)]);

  const removeLayer = id =>
    setLayers(prev => prev.filter(l => l.id !== id));

  const updateLayer = (id, patch) =>
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));

  /* Push current build state up so the report exporter can summarize
     suit configuration and per-layer scores without owning the state. */
  useEffect(() => {
    if (typeof onSnapshot !== 'function') return;
    const snap = layers.map((layer, idx) => {
      const slots = layer.slots.map(s => {
        const mat = s.materialId ? pool.find(m => m.id === s.materialId) : null;
        return {
          plies: s.plies,
          materialId: s.materialId,
          name: mat?.name ?? null,
          family: mat?.family ?? null,
          props: mat?.props ?? null,
          score: mat ? wsmScore(mat, layer.name, norms) : null,
        };
      });
      const scored = slots.filter(s => s.score != null);
      const avgScore = scored.length
        ? Math.round(scored.reduce((a, b) => a + b.score, 0) / scored.length)
        : null;
      const plies = slots.reduce((s, sl) => s + sl.plies, 0);
      return { index: idx, name: layer.name, slots, plies, avgScore };
    });
    let num = 0, den = 0;
    for (const l of snap) {
      for (const s of l.slots) {
        if (s.score != null) { num += s.score * s.plies; den += s.plies; }
      }
    }
    const overallScore = den > 0 ? Math.round(num / den) : null;
    onSnapshot({ layers: snap, overallScore });
  }, [layers, pool, norms, onSnapshot]);

  const moveLayer = (id, dir) =>
    setLayers(prev => {
      const i = prev.findIndex(l => l.id === id);
      if (i < 0 || (dir === -1 && i === 0) || (dir === 1 && i === prev.length - 1)) return prev;
      const next = [...prev];
      [next[i], next[i + dir]] = [next[i + dir], next[i]];
      return next;
    });

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: layer builder ── */}
      <aside className="flex flex-col overflow-hidden"
        style={{ width: 420, minWidth: 420, background: THEME.paperLight, borderRight: `1px solid ${THEME.border}` }}>

        <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: `1px solid ${THEME.border}` }}>
          <div className="flex items-center gap-2">
            <div className="font-display italic flex-1" style={{ fontSize: 16, color: THEME.ink }}>Suit Configuration</div>
            <button
              className="btn btn-ghost flex-shrink-0"
              onClick={() => setCompareMode(v => !v)}
              title={compareMode ? 'Exit comparison mode' : 'Compare two material picks per layer (Suit 1 vs Suit 2)'}
              style={{
                fontSize: 10, padding: '4px 8px',
                color: compareMode ? 'white' : THEME.inkMuted,
                background: compareMode ? PALETTE[1] : 'transparent',
                border: `1px solid ${compareMode ? PALETTE[1] : THEME.border}`,
                borderRadius: 3,
              }}
            >
              <Columns2 size={11} /> Compare
            </button>
          </div>
          <div className="font-mono text-[9px] uppercase tracking-widest mt-0.5" style={{ color: THEME.inkFaint }}>
            {compareMode
              ? 'comparison mode · pick a material for suit 1 and suit 2 in each layer'
              : `${layers.length} layer${layers.length !== 1 ? 's' : ''} · outer to inner · each layer supports multiple materials`}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scroll-thin px-3 py-3 flex flex-col gap-2">
          {layers.length === 0 && (
            <div className="text-xs font-body py-6 text-center" style={{ color: THEME.inkFaint }}>
              No layers yet — add your first one below.
            </div>
          )}
          {layers.map((layer, idx) => (
            <LayerCard
              key={layer.id}
              layer={layer}
              index={idx}
              total={layers.length}
              pool={pool}
              color={PALETTE[idx % PALETTE.length]}
              onUpdate={patch => updateLayer(layer.id, patch)}
              onRemove={() => removeLayer(layer.id)}
              onMove={dir => moveLayer(layer.id, dir)}
              norms={norms}
              compareMode={compareMode}
            />
          ))}
        </div>

        <div className="px-3 py-3 flex-shrink-0" style={{ borderTop: `1px solid ${THEME.border}` }}>
          <button className="btn w-full justify-center" onClick={addLayer}>
            <Plus size={12} /> Add layer
          </button>
        </div>
      </aside>

      {/* ── Right: visual summary ── */}
      <main className="flex-1 overflow-hidden" style={{ background: THEME.paper }}>
        {compareMode
          ? <ComparisonSummary layers={layers} pool={pool} norms={norms} />
          : <SuitSummary layers={layers} pool={pool} norms={norms} />}
      </main>

    </div>
  );
}
