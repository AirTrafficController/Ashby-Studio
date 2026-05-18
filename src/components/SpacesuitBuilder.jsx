import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, ChevronUp, ChevronDown, Search, X, AlertCircle } from 'lucide-react';
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
   MATERIAL SEARCH — dropdown rendered as a body portal so it
   escapes the overflow:hidden card and overflow:auto scroll
   container without any z-index tricks.
   ============================================================ */

function MaterialSearch({ pool, selectedId, onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [dropRect, setDropRect] = useState(null);
  const anchorRef = useRef(null);
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
    if (!open) return;
    updateRect();
    const onScroll = () => updateRect();
    const onResize = () => updateRect();
    const onMouse = e => {
      if (!anchorRef.current?.contains(e.target)) setOpen(false);
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

  if (selected) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded"
        style={{ border: `1px solid ${THEME.border}`, background: THEME.paper }}>
        <span className="flex-1 text-xs font-body truncate" style={{ color: THEME.ink }}>
          {selected.name}
        </span>
        <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-sm flex-shrink-0"
          style={{ background: THEME.paperDark, color: THEME.inkMuted }}>
          {selected.family}
        </span>
        <button onClick={() => onSelect(null)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: THEME.inkMuted, padding: 2, flexShrink: 0 }}>
          <X size={11} />
        </button>
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
        <div style={{
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
              onMouseEnter={e => { e.currentTarget.style.background = THEME.paperDark; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onSelect(m.id); setQuery(''); setOpen(false); }}
            >
              <span className="text-xs font-body flex-1 truncate" style={{ color: THEME.ink }}>{m.name}</span>
              <span className="font-mono text-[9px] flex-shrink-0" style={{ color: THEME.inkFaint }}>{m.family}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

/* ============================================================
   SLOT ROW — one material + ply count inside a layer
   ============================================================ */

function SlotRow({ slot, pool, onUpdate, onRemove, canRemove }) {
  const material = slot.materialId ? pool.find(m => m.id === slot.materialId) : null;

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
        <div className="flex items-center gap-4 pt-1.5" style={{ borderTop: `1px solid ${THEME.borderSoft}` }}>
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
          <div className="flex gap-3">
            {[['ρ', 'density'], ['E', 'modulus'], ['σ', 'strength'], ['T', 'tMax']].map(([sym, key]) => (
              <div key={key} className="flex flex-col items-center" style={{ minWidth: 26 }}>
                <span className="font-mono" style={{ fontSize: 9, color: THEME.inkFaint }}>{sym}</span>
                <span className="font-mono text-[11px]" style={{ color: THEME.ink, fontWeight: 500 }}>
                  {fmt(material.props[key], key === 'tMax' ? 0 : 2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   LAYER CARD — editable name + N stacked material slots
   ============================================================ */

function LayerCard({ layer, index, total, pool, color, onUpdate, onRemove, onMove }) {
  const addSlot = () => onUpdate({ slots: [...layer.slots, makeSlot()] });
  const removeSlot = id => onUpdate({ slots: layer.slots.filter(s => s.id !== id) });
  const updateSlot = (id, patch) =>
    onUpdate({ slots: layer.slots.map(s => s.id === id ? { ...s, ...patch } : s) });

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

function SuitSummary({ layers, pool }) {
  const allSlots = layers.flatMap(l => l.slots);
  const configuredSlots = allSlots.filter(s => s.materialId);
  const totalPlies = allSlots.reduce((s, sl) => s + sl.plies, 0);
  const configuredLayers = layers.filter(l => l.slots.some(s => s.materialId));

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
                    {['#', 'Layer / Material', 'Family', 'Plies', 'ρ g/cc', 'E GPa', 'σ MPa', 'T_max °C', 'Cost', 'Chem'].map(h => (
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
        <SuitSummary layers={layers} pool={pool} />
      </main>

    </div>
  );
}
