import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, ChevronUp, ChevronDown, Search, X, AlertCircle, Info } from 'lucide-react';
import { THEME, PALETTE } from '../theme.js';
import { MATERIALS } from '../data/materials.js';

const fmt = (n, d = 2) => {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1000) return n.toFixed(0);
  if (Math.abs(n) >= 10) return n.toFixed(1);
  return n.toFixed(d);
};

let _seq = 0;
function uid() { return `sl-${++_seq}-${Math.random().toString(36).slice(2, 5)}`; }
function makeSlot() { return { id: uid(), materialId: null, plies: 1 }; }
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

function SlotRow({ slot, pool, onUpdate, onRemove, canRemove, layerName, norms }) {
  const material = slot.materialId ? pool.find(m => m.id === slot.materialId) : null;
  const score = material ? wsmScore(material, layerName, norms) : null;

  return (
    <div className="flex flex-col gap-1.5 rounded px-2 py-2"
      style={{ background: THEME.paper, border: `1px solid ${THEME.borderSoft}` }}>
      <div className="flex items-center gap-1.5">
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

      {material && (
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

function LayerCard({ layer, index, total, pool, color, onUpdate, onRemove, onMove, norms }) {
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
   MAIN EXPORT
   ============================================================ */

export default function SpacesuitBuilder({ materials: liveMaterials }) {
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

  const addLayer = () =>
    setLayers(prev => [...prev, makeLayer(`Layer ${prev.length + 1}`)]);

  const removeLayer = id =>
    setLayers(prev => prev.filter(l => l.id !== id));

  const updateLayer = (id, patch) =>
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));

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
          <div className="font-display italic" style={{ fontSize: 16, color: THEME.ink }}>Suit Configuration</div>
          <div className="font-mono text-[9px] uppercase tracking-widest mt-0.5" style={{ color: THEME.inkFaint }}>
            {layers.length} layer{layers.length !== 1 ? 's' : ''} · outer to inner · each layer supports multiple materials
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
        <SuitSummary layers={layers} pool={pool} norms={norms} />
      </main>

    </div>
  );
}
