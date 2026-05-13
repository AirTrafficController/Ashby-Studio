import React, { useState, useMemo } from 'react';
import { X, AlertTriangle, Check, HelpCircle } from 'lucide-react';
import { THEME } from '../theme.js';
import {
  GALVANIC_GROUPS, ENV_TO_MIL, MIL_ENV_LABEL,
  compatibility, RATING_LABEL, RATING_COLOR, SURFACE_TREATMENTS,
} from '../data/galvanic.js';
import { ENV_LABEL } from '../data/materials.js';

/* ============================================================
   CompatibilityMatrix
   ============================================================
   Modal showing pairwise galvanic compatibility (MIL-STD-889C)
   for currently-visible conductive materials. Cells are colour-
   coded by rating; clicking an "Incompatible" cell reveals the
   recommended surface treatments for both metals.

   Non-conductive materials (polymers, ceramics, glass) are
   excluded from the axes — galvanic corrosion is only meaningful
   when both members are electrical conductors in an electrolyte.
   ============================================================ */

const ENV_OPTIONS = [
  { key: 'space',    label: 'Space (dry / vac)',   milKey: 'ind' },
  { key: 'deep_sea', label: 'Deep sea (submerged)', milKey: 'sea' },
  { key: 'chemical', label: 'Chemical (humid)',     milKey: 'mar' },
];

export default function CompatibilityMatrix({ open, onClose, materials, defaultEnv = 'space' }) {
  const [env, setEnv] = useState(defaultEnv);
  const [selected, setSelected] = useState(null); // { aId, bId, rating, ... }

  // Conductive materials present in the set (regardless of visibility)
  const allConductive = useMemo(() => {
    return (materials || []).filter(
      (m) => m.galvanicGroup && GALVANIC_GROUPS[m.galvanicGroup]
    );
  }, [materials]);

  // Only conductive AND visible materials make it onto the matrix axes
  const conductive = useMemo(() => {
    return allConductive.filter((m) => m.visible);
  }, [allConductive]);

  if (!open) return null;

  const milEnv = ENV_OPTIONS.find((o) => o.key === env)?.milKey ?? 'ind';

  // Build matrix data
  const cells = conductive.map((rowMat) =>
    conductive.map((colMat) => {
      const result = compatibility(rowMat.galvanicGroup, colMat.galvanicGroup, milEnv);
      return { rowMat, colMat, ...result };
    })
  );

  const incompatibleCount = cells.flat().filter(
    (c) => c.rating === 'I' && c.rowMat.id !== c.colMat.id
  ).length / 2;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(28,25,23,0.45)' }}
      onClick={() => { setSelected(null); onClose(); }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative"
        style={{
          background: THEME.paperLight,
          border: `1px solid ${THEME.ink}`,
          padding: '22px 26px',
          width: 'min(840px, 95vw)',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
        }}
      >
        <button
          onClick={() => { setSelected(null); onClose(); }}
          className="absolute"
          style={{
            top: 10, right: 10,
            background: 'transparent', border: 'none',
            cursor: 'pointer', color: THEME.inkMuted,
          }}
        >
          <X size={16} />
        </button>

        <div className="font-display italic" style={{ fontSize: 20 }}>
          Galvanic compatibility
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest mt-0.5 mb-4"
             style={{ color: THEME.inkFaint }}>
          MIL-STD-889C, Table I · {conductive.length} conductive material{conductive.length === 1 ? '' : 's'}
        </div>

        {/* Environment selector */}
        <div className="flex items-center gap-2 mb-4">
          <span className="font-mono text-[10px] uppercase tracking-wider"
                style={{ color: THEME.inkMuted }}>
            Environment
          </span>
          <div className="flex gap-1">
            {ENV_OPTIONS.map((opt) => {
              const active = opt.key === env;
              return (
                <button
                  key={opt.key}
                  onClick={() => { setEnv(opt.key); setSelected(null); }}
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    border: `1px solid ${active ? THEME.ink : THEME.border}`,
                    background: active ? THEME.ink : THEME.paperLight,
                    color: active ? THEME.paperLight : THEME.ink,
                    borderRadius: 3,
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div className="flex-1" />
          {conductive.length >= 2 && (
            <span className="font-mono text-[10px]"
                  style={{ color: incompatibleCount > 0 ? THEME.accent : '#5C8C5F' }}>
              {incompatibleCount === 0
                ? '✓ no galvanic clashes'
                : `${incompatibleCount} incompatible pair${incompatibleCount === 1 ? '' : 's'}`}
            </span>
          )}
        </div>

        {/* Empty state */}
        {conductive.length < 2 ? (
          <div className="px-4 py-8 text-center"
               style={{ background: THEME.paper, border: `1px solid ${THEME.borderSoft}`, borderRadius: 3 }}>
            <HelpCircle size={20} style={{ color: THEME.inkFaint, margin: '0 auto 8px' }} />

            {conductive.length === 0 && allConductive.length === 0 && (
              <>
                <div className="text-sm" style={{ color: THEME.ink }}>
                  No conductive materials in the current set.
                </div>
                <div className="font-mono text-[10px] mt-2" style={{ color: THEME.inkFaint, lineHeight: 1.6 }}>
                  Click <strong style={{ color: THEME.ink }}>Reset</strong> in the Materials sidebar
                  to load the built-in suit-material set. The metals and CFRP grades
                  carry MIL-STD-889C anodic group tags. Custom materials added via
                  the modal can also include a galvanic group.
                </div>
              </>
            )}

            {conductive.length === 0 && allConductive.length > 0 && (
              <>
                <div className="text-sm" style={{ color: THEME.ink }}>
                  {allConductive.length} conductive material{allConductive.length === 1 ? ' is' : 's are'} loaded
                  but hidden.
                </div>
                <div className="font-mono text-[10px] mt-2" style={{ color: THEME.inkFaint }}>
                  Toggle visibility in the Materials sidebar (eye icon) to bring them into the matrix:
                </div>
                <ul className="mt-2 flex flex-wrap gap-1 justify-center">
                  {allConductive.map(m => (
                    <li key={m.id}
                        className="font-mono text-[10px] px-1.5 py-0.5"
                        style={{
                          background: THEME.paperLight,
                          border: `1px solid ${THEME.borderSoft}`,
                          borderRadius: 3,
                          color: THEME.inkMuted,
                        }}>
                      {m.name} <span style={{ color: THEME.inkFaint }}>({m.galvanicGroup})</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {conductive.length === 1 && (
              <>
                <div className="text-sm" style={{ color: THEME.ink }}>
                  Only one conductive material visible — need two or more to check pair compatibility.
                </div>
                {allConductive.length > 1 && (
                  <div className="font-mono text-[10px] mt-2" style={{ color: THEME.inkFaint }}>
                    Other conductive materials are loaded but hidden — un-hide them in the sidebar.
                  </div>
                )}
              </>
            )}

            <div className="font-mono text-[10px] mt-3" style={{ color: THEME.inkFaint }}>
              Galvanic corrosion only occurs between two conductive metals in contact under an electrolyte.
            </div>
          </div>
        ) : (
          <>
            {/* Matrix */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={cornerCell}></th>
                    {conductive.map((m) => (
                      <th key={m.id} style={headerCell} title={`Group ${m.galvanicGroup} — ${GALVANIC_GROUPS[m.galvanicGroup].name}`}>
                        <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', padding: '6px 2px' }}>
                          {m.name}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cells.map((row, i) => (
                    <tr key={conductive[i].id}>
                      <th style={rowHeaderCell} title={`Group ${conductive[i].galvanicGroup} — ${GALVANIC_GROUPS[conductive[i].galvanicGroup].name}`}>
                        {conductive[i].name}
                        <span className="font-mono text-[9px] ml-1"
                              style={{ color: THEME.inkFaint }}>
                          ({conductive[i].galvanicGroup})
                        </span>
                      </th>
                      {row.map((cell, j) => {
                        const isSelf = i === j;
                        const isSelected = selected
                          && selected.aId === cell.rowMat.id
                          && selected.bId === cell.colMat.id;
                        const bg = isSelf
                          ? THEME.paperDark
                          : (cell.rating
                              ? RATING_COLOR[cell.rating]
                              : THEME.paperDark);
                        return (
                          <td
                            key={j}
                            onClick={() => {
                              if (isSelf) return;
                              setSelected(cell);
                            }}
                            style={{
                              ...dataCell,
                              background: bg,
                              color: cell.rating === 'I' || cell.rating === 'C'
                                ? 'white'
                                : THEME.ink,
                              cursor: isSelf ? 'default' : 'pointer',
                              opacity: isSelected ? 1 : 0.92,
                              outline: isSelected ? `2px solid ${THEME.ink}` : 'none',
                              outlineOffset: -2,
                            }}
                            title={`${cell.rowMat.name} × ${cell.colMat.name}: ${cell.label ?? '—'}`}
                          >
                            {cell.rating ?? '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 font-mono text-[10px]"
                 style={{ color: THEME.inkMuted }}>
              <span>Legend:</span>
              <Swatch color={RATING_COLOR.G} label="G — same group" />
              <Swatch color={RATING_COLOR.C} label="C — compatible" />
              <Swatch color={RATING_COLOR.I} label="I — incompatible" />
              <span style={{ flex: 1, textAlign: 'right' }}>
                {MIL_ENV_LABEL[milEnv]}
              </span>
            </div>

            {/* Selected pair detail */}
            {selected && selected.rating === 'I' && (
              <div
                className="mt-4 p-3"
                style={{
                  background: '#FAEBEC',
                  border: `1px solid ${THEME.accentSoft}`,
                  borderRadius: 3,
                }}
              >
                <div className="flex items-start gap-2 mb-2">
                  <AlertTriangle size={14} style={{ color: THEME.accent, marginTop: 2, flexShrink: 0 }} />
                  <div className="text-xs" style={{ color: THEME.ink }}>
                    <strong>{selected.rowMat.name}</strong> ({selected.rowMat.galvanicGroup})
                    {' × '}
                    <strong>{selected.colMat.name}</strong> ({selected.colMat.galvanicGroup})
                    {' '}— galvanic corrosion expected under {MIL_ENV_LABEL[milEnv].toLowerCase()}.
                    Apply dielectric isolation or one of the surface treatments below.
                  </div>
                </div>
                <TreatmentList material={selected.rowMat} treatments={selected.treatmentsA} />
                <TreatmentList material={selected.colMat} treatments={selected.treatmentsB} />
              </div>
            )}

            {selected && selected.rating === 'C' && (
              <div
                className="mt-4 p-3"
                style={{
                  background: '#E8F0E5',
                  border: `1px solid #9DB59A`,
                  borderRadius: 3,
                }}
              >
                <div className="flex items-start gap-2">
                  <Check size={14} style={{ color: '#2D5F3F', marginTop: 2, flexShrink: 0 }} />
                  <div className="text-xs" style={{ color: THEME.ink }}>
                    <strong>{selected.rowMat.name}</strong> × <strong>{selected.colMat.name}</strong>{' '}
                    — compatible bare under {MIL_ENV_LABEL[milEnv].toLowerCase()}.
                    Sealing faying edges still recommended to mitigate crevice corrosion.
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Caveats */}
        <div className="mt-4 font-mono text-[9px]"
             style={{ color: THEME.inkFaint, lineHeight: 1.5 }}>
          Galvanic ratings condensed from MIL-STD-889C, Table I and Appendix A.3.
          Non-conductive materials (polymers, ceramics, glass) are omitted —
          galvanic corrosion requires both members to be conductive metals
          (CFRP is treated as carbon/graphite, group T). Treat as a screening
          aid only; coatings, geometry, and electrolyte chemistry govern real-
          world severity.
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   sub-components
   ============================================================ */

function TreatmentList({ material, treatments }) {
  if (!treatments) return null;
  return (
    <div className="mt-2">
      <div className="font-mono text-[10px] uppercase tracking-wider mb-1"
           style={{ color: THEME.inkMuted }}>
        Recommended for {material.name}
      </div>
      <ol style={{ paddingLeft: 18, margin: 0 }}>
        {treatments.coatings.slice(0, 3).map((c, i) => (
          <li key={i} className="text-[11px] mb-0.5" style={{ color: THEME.ink, lineHeight: 1.45 }}>
            {c}
          </li>
        ))}
      </ol>
      {treatments.notes && treatments.notes.length > 0 && treatments.notes[0] !== 'None' && (
        <div className="text-[10px] mt-1 italic" style={{ color: THEME.inkMuted }}>
          {treatments.notes.join(' ')}
        </div>
      )}
    </div>
  );
}

function Swatch({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span style={{ width: 10, height: 10, background: color, display: 'inline-block', borderRadius: 2 }} />
      {label}
    </span>
  );
}

const cornerCell = {
  padding: '6px',
  background: THEME.paper,
  border: `1px solid ${THEME.border}`,
};

const headerCell = {
  padding: 0,
  background: THEME.paper,
  border: `1px solid ${THEME.border}`,
  color: THEME.inkMuted,
  fontWeight: 500,
  fontSize: 10,
  minWidth: 28,
  maxWidth: 28,
  height: 110,
  verticalAlign: 'bottom',
  textAlign: 'center',
};

const rowHeaderCell = {
  padding: '4px 8px',
  background: THEME.paper,
  border: `1px solid ${THEME.border}`,
  color: THEME.ink,
  fontWeight: 500,
  textAlign: 'left',
  whiteSpace: 'nowrap',
  fontSize: 11,
};

const dataCell = {
  padding: 0,
  border: `1px solid ${THEME.border}`,
  width: 28,
  height: 28,
  minWidth: 28,
  textAlign: 'center',
  fontFamily: 'IBM Plex Mono, monospace',
  fontWeight: 600,
  fontSize: 11,
  userSelect: 'none',
};
