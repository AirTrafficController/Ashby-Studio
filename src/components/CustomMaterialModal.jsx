import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { THEME } from '../theme.js';
import { ENVIRONMENTS, ENV_LABEL, LAYERS, LAYER_LABEL } from '../data/materials.js';

/* ============================================================
   CustomMaterialModal
   ============================================================
   Dialog for entering a single material's full property spec.
   Calls `onAdd(material)` on submit; the parent decides where
   to insert it. All numeric fields are validated before the
   handler is invoked.
   ============================================================ */

export default function CustomMaterialModal({ open, onClose, onAdd }) {
  const [form, setForm] = useState(initialForm());
  const [error, setError] = useState(null);

  if (!open) return null;

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleArray = (k, value) => {
    setForm((f) => {
      const cur = f[k] ?? [];
      const next = cur.includes(value)
        ? cur.filter((x) => x !== value)
        : [...cur, value];
      return { ...f, [k]: next };
    });
  };

  const submit = () => {
    setError(null);
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    if (form.environments.length === 0) {
      setError('Pick at least one environment.');
      return;
    }
    if (form.layers.length === 0) {
      setError('Pick at least one suit layer.');
      return;
    }
    const props = {
      density: parseFloat(form.density),
      modulus: parseFloat(form.modulus),
      strength: parseFloat(form.strength),
      tMax: parseFloat(form.tMax),
      cost: parseInt(form.cost, 10),
      chemRes: parseInt(form.chemRes, 10),
    };
    for (const k of ['density', 'modulus', 'strength', 'tMax']) {
      if (!Number.isFinite(props[k]) || props[k] <= 0) {
        setError(`${k} must be a positive number.`);
        return;
      }
    }
    onAdd({
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: form.name.trim(),
      family: form.family.trim() || 'Custom',
      environments: form.environments,
      layers: form.layers,
      props,
      notes: form.notes.trim(),
    });
    setForm(initialForm());
    onClose();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(28,25,23,0.45)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative"
        style={{
          background: THEME.paperLight,
          border: `1px solid ${THEME.ink}`,
          padding: '24px 28px',
          width: 560, maxWidth: '95vw',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
        }}
      >
        <button
          onClick={onClose}
          className="absolute"
          style={{
            top: 10, right: 10,
            background: 'transparent', border: 'none',
            cursor: 'pointer', color: THEME.inkMuted,
          }}
        >
          <X size={16} />
        </button>

        <div className="font-display italic mb-1" style={{ fontSize: 20 }}>
          Add custom material
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest mb-4"
             style={{ color: THEME.inkFaint }}>
          full property spec
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Name" span={2}>
            <Input value={form.name} onChange={(v) => update('name', v)}
                   placeholder="e.g. Custom CFRP grade" />
          </Field>
          <Field label="Family">
            <Input value={form.family} onChange={(v) => update('family', v)}
                   placeholder="e.g. Composite" />
          </Field>
          <Field label="Notes (optional)">
            <Input value={form.notes} onChange={(v) => update('notes', v)}
                   placeholder="provenance, caveats" />
          </Field>

          <Field label="Environment(s)" span={2}>
            <div className="flex gap-1.5 flex-wrap">
              {ENVIRONMENTS.map((e) => (
                <Chip key={e}
                      active={form.environments.includes(e)}
                      onClick={() => toggleArray('environments', e)}>
                  {ENV_LABEL[e]}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="Suit layer(s)" span={2}>
            <div className="flex gap-1.5 flex-wrap">
              {LAYERS.map((l) => (
                <Chip key={l}
                      active={form.layers.includes(l)}
                      onClick={() => toggleArray('layers', l)}>
                  {LAYER_LABEL[l]}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="Density (g/cc)">
            <Input value={form.density} onChange={(v) => update('density', v)}
                   placeholder="e.g. 1.60" type="number" />
          </Field>
          <Field label="Young's modulus (GPa)">
            <Input value={form.modulus} onChange={(v) => update('modulus', v)}
                   placeholder="e.g. 70" type="number" />
          </Field>
          <Field label="Tensile strength (MPa)">
            <Input value={form.strength} onChange={(v) => update('strength', v)}
                   placeholder="e.g. 600" type="number" />
          </Field>
          <Field label="Max use temp (°C)">
            <Input value={form.tMax} onChange={(v) => update('tMax', v)}
                   placeholder="e.g. 200" type="number" />
          </Field>
          <Field label="Cost (1 low → 4 very high)">
            <select
              value={form.cost}
              onChange={(e) => update('cost', e.target.value)}
              style={selectStyle}
            >
              <option value="1">1 — low</option>
              <option value="2">2 — moderate</option>
              <option value="3">3 — high</option>
              <option value="4">4 — very high</option>
            </select>
          </Field>
          <Field label="Chemical resistance (1 → 4)">
            <select
              value={form.chemRes}
              onChange={(e) => update('chemRes', e.target.value)}
              style={selectStyle}
            >
              <option value="1">1 — poor</option>
              <option value="2">2 — fair</option>
              <option value="3">3 — good</option>
              <option value="4">4 — excellent</option>
            </select>
          </Field>
        </div>

        {error && (
          <div className="mt-3 text-xs"
               style={{ color: THEME.accent }}>
            {error}
          </div>
        )}

        <div className="flex items-center gap-2 mt-5">
          <div className="flex-1 font-mono text-[10px]"
               style={{ color: THEME.inkFaint }}>
            Material is added to the database for this session only.
          </div>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit}>
            <Plus size={12} /> Add material
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   helpers
   ============================================================ */

function initialForm() {
  return {
    name: '', family: '',
    environments: ['space'],
    layers: ['outer_shell'],
    density: '', modulus: '', strength: '', tMax: '',
    cost: '2', chemRes: '2',
    notes: '',
  };
}

const selectStyle = {
  width: '100%',
  padding: '5px 7px',
  fontSize: 12,
  fontFamily: 'IBM Plex Mono, monospace',
  border: `1px solid ${THEME.border}`,
  background: THEME.paperLight,
  color: THEME.ink,
  borderRadius: 3,
};

function Field({ label, children, span }) {
  return (
    <label
      className="flex flex-col gap-1"
      style={{ gridColumn: span ? `span ${span}` : undefined }}
    >
      <span
        className="font-mono uppercase"
        style={{ fontSize: 9, letterSpacing: '0.1em', color: THEME.inkFaint }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function Input({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="font-mono"
      style={{
        fontSize: 12,
        padding: '5px 7px',
        border: `1px solid ${THEME.border}`,
        background: THEME.paperLight,
        color: THEME.ink,
        borderRadius: 3,
        outline: 'none',
      }}
    />
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 10px',
        fontSize: 11,
        fontFamily: 'IBM Plex Sans, system-ui, sans-serif',
        border: `1px solid ${active ? THEME.ink : THEME.border}`,
        background: active ? THEME.ink : THEME.paperLight,
        color: active ? THEME.paperLight : THEME.ink,
        borderRadius: 3,
        cursor: 'pointer',
        transition: 'all 120ms ease',
      }}
    >
      {children}
    </button>
  );
}
