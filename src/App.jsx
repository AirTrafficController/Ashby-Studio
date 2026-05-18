import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import Papa from 'papaparse';
import {
  Upload, Download, Eye, EyeOff, Trash2, X, Plus,
  Layers, Grid3x3, ZoomIn, ZoomOut, Maximize2, Sparkles,
  Info, Target, Settings2, Dot, ChevronDown, Zap,
  FlaskConical, Compass, Wrench,
} from 'lucide-react';

import { THEME, PALETTE } from './theme.js';
import {
  MATERIALS, PROPERTY_META, clusterPoints,
} from './data/materials.js';
import SelectionWizard from './components/SelectionWizard.jsx';
import CustomMaterialModal from './components/CustomMaterialModal.jsx';
import SpacesuitBuilder from './components/SpacesuitBuilder.jsx';
import ResizeHandle from './components/ResizeHandle.jsx';
import CompatibilityMatrix from './components/CompatibilityMatrix.jsx';
import Tour from './components/Tour.jsx';

/* ============================================================
   SUPER-FAMILY GROUPING
   Maps each material's fine-grained `family` into the broad
   class shown as a tinted background region on the chart.
   ============================================================ */

const SUPERFAMILY = {
  'Aluminium alloy':         'Metals & alloys',
  'Copper alloy':            'Metals & alloys',
  'Cu-Al alloy':             'Metals & alloys',
  'Magnesium alloy':         'Metals & alloys',
  'Ni-superalloy':           'Metals & alloys',
  'Titanium alloy':          'Metals & alloys',
  'Non-oxide ceramic':       'Ceramics',
  'Oxide ceramic':           'Ceramics',
  'Ceramic foam':            'Ceramics',
  'Glass':                   'Glasses',
  'Aramid composite':        'Composites',
  'Carbon fibre composite':  'Composites',
  'Glass fibre composite':   'Composites',
  'Composite':               'Composites',
  'Laminate':                'Composites',
  'PTFE-coated fibreglass':  'Composites',
  'Laminated fabric':        'Composites',
  'Thermoplastic':           'Polymers',
  'Fluoropolymer':           'Polymers',
  'Chlorinated polymer':     'Polymers',
  'Polyimide film':          'Polymers',
  'PVDC laminate film':      'Polymers',
  'Aluminised film':         'Polymers',
  'Membrane':                'Polymers',
  'Fluoroelastomer':         'Elastomers',
  'Perfluoroelastomer':      'Elastomers',
  'Polychloroprene rubber':  'Elastomers',
  'Silicone elastomer':      'Elastomers',
  'Synthetic elastomer':     'Elastomers',
  'Synthetic rubber':        'Elastomers',
  'Thermoplastic elastomer': 'Elastomers',
  'Aramid fibre':            'Fibres',
  'High-performance fibre':  'Fibres',
};

const FAMILY_COLORS = {
  'Metals & alloys': '#C44545',
  'Ceramics':        '#E07845',
  'Glasses':         '#8B5A7A',
  'Composites':      '#5A6B95',
  'Polymers':        '#3D7F88',
  'Elastomers':      '#5FA85A',
  'Fibres':          '#A89A45',
};

const FAMILY_ORDER = [
  'Metals & alloys', 'Ceramics', 'Glasses', 'Composites',
  'Polymers', 'Elastomers', 'Fibres',
];

/* Inflate a hull radially in log space so the region visually
   encloses its members with a bit of breathing room. */
function inflateLogHull(hull, factor = 0.18) {
  if (hull.length < 3) return hull;
  const logged = hull.map(p => [Math.log10(p[0]), Math.log10(p[1])]);
  const cx = d3.mean(logged, d => d[0]);
  const cy = d3.mean(logged, d => d[1]);
  return logged.map(([x, y]) => {
    const dx = x - cx, dy = y - cy;
    const r = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = cx + dx * (1 + factor) + (dx / r) * 0.05;
    const ny = cy + dy * (1 + factor) + (dy / r) * 0.05;
    return [Math.pow(10, nx), Math.pow(10, ny)];
  });
}

/* ============================================================
   GEOMETRY HELPERS
   Hulls computed in log space so edges are visually straight
   on log axes before the closed-curve smoothing is applied.
   ============================================================ */

function logHull(points) {
  if (points.length < 3) return points.slice();
  const logged = points.map(p => [Math.log10(p[0]), Math.log10(p[1])]);
  const h = d3.polygonHull(logged);
  if (!h) return points.slice();
  return h.map(p => [Math.pow(10, p[0]), Math.pow(10, p[1])]);
}

function logCentroid(hull) {
  const logged = hull.map(p => [Math.log10(p[0]), Math.log10(p[1])]);
  const cx = d3.mean(logged, d => d[0]);
  const cy = d3.mean(logged, d => d[1]);
  return [Math.pow(10, cx), Math.pow(10, cy)];
}

/* ============================================================
   NUMBER FORMATTING
   ============================================================ */

function fmt(n, digits = 3) {
  if (!isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1000 || abs < 0.01) return n.toExponential(2);
  return n.toPrecision(digits);
}

/* ============================================================
   CSV PARSING — original convention preserved
   ============================================================ */

function parseCSV(text, fallbackName) {
  const res = Papa.parse(text.trim(), { skipEmptyLines: true });
  if (!res.data.length) return [];
  let rows = res.data;
  if (rows[0] && typeof rows[0][0] === 'string') {
    rows[0][0] = rows[0][0].replace(/^\uFEFF/, '');
  }
  const first = rows[0].map(c => String(c).trim());
  const numericish = first.filter(c => c !== '' && !isNaN(parseFloat(c)));
  const hasHeader = numericish.length < first.filter(c => c !== '').length;
  if (hasHeader) rows = rows.slice(1);

  const points = [];
  for (const row of rows) {
    if (!row || row.length < 2) continue;
    let x, y;
    if (row.length >= 3 && isNaN(parseFloat(row[0]))) {
      x = parseFloat(row[1]);
      y = parseFloat(row[2]);
    } else {
      x = parseFloat(row[0]);
      y = parseFloat(row[1]);
    }
    if (!isFinite(x) || !isFinite(y) || x <= 0 || y <= 0) continue;
    points.push([x, y]);
  }
  return points.length ? [{ name: fallbackName, points }] : [];
}

/* ============================================================
   PROPERTY-SPEC CSV PARSING
   ============================================================
   For full materials with all properties. Header row required.
   Recognised columns (case-insensitive, alternates accepted):
     name, family, environment(s), layer(s),
     density, modulus, strength, tmax, cost, chemres, notes
   Multi-valued cells (environments, layers) use ';' as separator.
   ============================================================ */

const COLUMN_ALIASES = {
  name: ['name', 'material'],
  family: ['family', 'class'],
  environments: ['environments', 'environment', 'env'],
  layers: ['layers', 'layer'],
  density: ['density', 'rho', 'density_gcc'],
  modulus: ['modulus', 'youngs_modulus', 'e_gpa', 'modulus_gpa'],
  strength: ['strength', 'tensile_strength', 'sigma_mpa', 'strength_mpa'],
  tMax: ['tmax', 't_max', 'tmax_c', 'max_use_temp'],
  cost: ['cost'],
  chemRes: ['chemres', 'chem_res', 'chemical_resistance'],
  notes: ['notes', 'note', 'comment'],
};

function looksLikePropertySpec(headerRow) {
  if (!Array.isArray(headerRow)) return false;
  const norm = headerRow.map((c) => String(c).trim().toLowerCase().replace(/[\s\-]/g, '_'));
  // Need 'name' plus at least two of the four core numeric fields
  if (!COLUMN_ALIASES.name.some((a) => norm.includes(a))) return false;
  const numericFound = ['density', 'modulus', 'strength', 'tMax']
    .filter((k) => COLUMN_ALIASES[k].some((a) => norm.includes(a))).length;
  return numericFound >= 2;
}

function parsePropertyCSV(text) {
  const res = Papa.parse(text.trim(), { skipEmptyLines: true });
  if (!res.data.length) return { materials: [], errors: ['Empty CSV.'] };
  const rows = res.data.slice();
  if (rows[0] && typeof rows[0][0] === 'string') {
    rows[0][0] = rows[0][0].replace(/^\uFEFF/, '');
  }
  const headerRaw = rows[0].map((c) => String(c).trim());
  const header = headerRaw.map((c) => c.toLowerCase().replace(/[\s\-]/g, '_'));

  // Build a map: standard key → column index
  const colIdx = {};
  for (const [stdKey, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const a of aliases) {
      const i = header.indexOf(a);
      if (i >= 0) { colIdx[stdKey] = i; break; }
    }
  }
  if (!('name' in colIdx)) {
    return { materials: [], errors: ['Header must contain a "name" column.'] };
  }

  const cell = (row, key) => {
    const i = colIdx[key];
    if (i === undefined) return undefined;
    const v = row[i];
    return v === undefined ? '' : String(v).trim();
  };
  const num = (row, key) => {
    const v = cell(row, key);
    if (v === '' || v === undefined) return null;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };
  const list = (row, key) => {
    const v = cell(row, key);
    if (!v) return [];
    return v.split(/[;|]/).map((x) => x.trim()).filter(Boolean);
  };

  const materials = [];
  const errors = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;
    const name = cell(row, 'name');
    if (!name) continue;

    const props = {
      density: num(row, 'density'),
      modulus: num(row, 'modulus'),
      strength: num(row, 'strength'),
      tMax: num(row, 'tMax'),
      cost: num(row, 'cost') ?? 2,
      chemRes: num(row, 'chemRes') ?? 2,
    };
    const missing = ['density', 'modulus', 'strength', 'tMax']
      .filter((k) => !Number.isFinite(props[k]) || props[k] <= 0);
    if (missing.length) {
      errors.push(`Row ${r + 1} (${name}): missing or invalid ${missing.join(', ')}.`);
      continue;
    }

    materials.push({
      id: `csv-${Date.now()}-${r}-${Math.random().toString(36).slice(2, 5)}`,
      name,
      family: cell(row, 'family') || 'Custom',
      environments: list(row, 'environments').length ? list(row, 'environments') : ['space'],
      layers: list(row, 'layers').length ? list(row, 'layers') : ['outer_shell'],
      props,
      notes: cell(row, 'notes') || '',
    });
  }
  return { materials, errors };
}

/* ============================================================
   INITIAL MATERIAL SET — derived from the suit-materials database
   ============================================================ */

function buildInitialMaterials() {
  return MATERIALS.map((m, i) => ({
    id: m.id,
    name: m.name,
    color: PALETTE[i % PALETTE.length],
    family: m.family,
    environment: m.environment,
    layers: m.layers,
    props: m.props,
    notes: m.notes,
    visible: true,
    isUserCSV: false,
  }));
}

/* ============================================================
   GLOBAL STYLES — fonts + custom bits
   ============================================================ */

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

.font-display { font-family: 'IBM Plex Serif', Georgia, serif; font-feature-settings: "liga" 1, "dlig" 1; }
.font-body    { font-family: 'IBM Plex Sans', system-ui, sans-serif; }
.font-mono    { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-feature-settings: "tnum" 1; }

.scroll-thin::-webkit-scrollbar { width: 8px; }
.scroll-thin::-webkit-scrollbar-thumb { background: ${THEME.border}; border-radius: 4px; }
.scroll-thin::-webkit-scrollbar-track { background: transparent; }

.paper-grain {
  background-color: ${THEME.paper};
  background-image:
    radial-gradient(ellipse at 20% 20%, rgba(156, 143, 122, 0.04), transparent 60%),
    radial-gradient(ellipse at 80% 70%, rgba(139, 38, 53, 0.025), transparent 60%);
}

.chart-grid line { stroke: ${THEME.borderSoft}; stroke-width: 0.5; }
.chart-grid .tick-major line { stroke: ${THEME.border}; stroke-width: 0.8; }
.axis path, .axis line { stroke: ${THEME.ink}; }
.axis text { fill: ${THEME.inkMuted}; font-family: 'IBM Plex Mono', monospace; font-size: 10px; }

.envelope { transition: opacity 180ms ease, stroke-width 180ms ease; cursor: pointer; }

.label-box { pointer-events: none; }
.label-box rect {
  fill: ${THEME.paperLight};
  stroke: ${THEME.ink};
  stroke-width: 0.6;
}
.label-box text {
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 11px;
  font-weight: 500;
  fill: ${THEME.ink};
  text-anchor: middle;
  dominant-baseline: central;
}
.label-box.rank-label rect { stroke-width: 1.4; }
.label-box.rank-label text { font-weight: 600; }

.index-line { stroke-dasharray: 2 3; stroke: ${THEME.accent}; stroke-width: 0.9; opacity: 0.55; fill: none; }
.index-label {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9.5px;
  fill: ${THEME.accent};
  font-weight: 500;
}

.btn {
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.01em;
  padding: 7px 12px;
  border-radius: 4px;
  border: 1px solid ${THEME.border};
  background: ${THEME.paperLight};
  color: ${THEME.ink};
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 120ms ease;
}
.btn:hover { background: ${THEME.paperDark}; border-color: ${THEME.inkMuted}; }
.btn:active { transform: translateY(0.5px); }
.btn:disabled { cursor: not-allowed; }
.btn-primary { background: ${THEME.ink}; color: ${THEME.paperLight}; border-color: ${THEME.ink}; }
.btn-primary:hover { background: #2D2824; border-color: #2D2824; }
.btn-ghost { background: transparent; border-color: transparent; padding: 5px 7px; }
.btn-ghost:hover { background: ${THEME.paperDark}; }

input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  width: 100%;
  height: 18px;
}
input[type="range"]::-webkit-slider-runnable-track {
  height: 2px; background: ${THEME.border}; border-radius: 2px;
}
input[type="range"]::-moz-range-track {
  height: 2px; background: ${THEME.border}; border-radius: 2px;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 14px; height: 14px; border-radius: 50%;
  background: ${THEME.ink}; margin-top: -6px; cursor: grab;
}
input[type="range"]::-moz-range-thumb {
  width: 14px; height: 14px; border-radius: 50%;
  background: ${THEME.ink}; border: none; cursor: grab;
}

.checkbox {
  appearance: none;
  width: 14px; height: 14px;
  border: 1px solid ${THEME.inkMuted};
  border-radius: 2px;
  position: relative;
  cursor: pointer;
  background: ${THEME.paperLight};
  flex-shrink: 0;
}
.checkbox:checked { background: ${THEME.ink}; border-color: ${THEME.ink}; }
.checkbox:checked::after {
  content: ''; position: absolute;
  left: 3px; top: 0px; width: 4px; height: 8px;
  border: solid ${THEME.paperLight};
  border-width: 0 1.5px 1.5px 0;
  transform: rotate(45deg);
}

.drop-zone { transition: all 150ms ease; }
.drop-zone-active { background: ${THEME.paperDark}; border-color: ${THEME.ink}; }

.mat-row:hover { background: ${THEME.paperDark}; }
.mat-row:hover .mat-actions { opacity: 1; }
.mat-actions { opacity: 0; transition: opacity 120ms ease; }

.mode-tab {
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
  padding: 5px 11px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 120ms ease;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid transparent;
}
.mode-tab-active   { background: ${THEME.ink}; color: ${THEME.paperLight}; }
.mode-tab-inactive { background: transparent; color: ${THEME.inkMuted}; border-color: ${THEME.border}; }
.mode-tab-inactive:hover { background: ${THEME.paperDark}; color: ${THEME.ink}; }

/* Sidebar resize handle: 6px hit area straddling the panel edge,
   with a 1px central rule that darkens on hover or while dragging. */
.resize-handle {
  cursor: col-resize;
  transition: background 120ms ease;
}
.resize-handle::after {
  content: '';
  position: absolute;
  top: 0; bottom: 0; left: 50%;
  width: 1px;
  background: transparent;
  transition: background 150ms ease;
  pointer-events: none;
}
.resize-handle:hover::after,
.resize-handle.dragging::after {
  background: ${THEME.ink};
}

/* Collapsible section header chevron rotation */
.section-chevron {
  transition: transform 150ms ease;
}
`;

/* ============================================================
   CHART COMPONENT
   Modified to support ranking highlights: materials with
   `highlightRank` (1, 2, or 3) render with thicker stroke and
   full opacity; others fade if any rank is active.
   ============================================================ */

function AshbyChart({
  materials, showPoints, showGrid, showLabels, showFamilies,
  indices, axisConfig, hoverId, setHoverId, focusId, setFocusId,
  onGalvanic,
}) {
  const wrapperRef = useRef(null);
  const svgRef = useRef(null);
  const gRef = useRef(null);
  const [size, setSize] = useState({ w: 900, h: 700 });
  const [transform, setTransform] = useState(d3.zoomIdentity);
  const zoomRef = useRef(null);
  const [mousePos, setMousePos] = useState(null);

  useEffect(() => {
    if (!wrapperRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        setSize({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });
    ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, []);

  const margin = { top: 28, right: 24, bottom: 48, left: 64 };
  const iw = Math.max(100, size.w - margin.left - margin.right);
  const ih = Math.max(100, size.h - margin.top - margin.bottom);

  const xScaleBase = useMemo(
    () => d3.scaleLog().domain(axisConfig.xDomain).range([0, iw]),
    [axisConfig.xDomain, iw]
  );
  const yScaleBase = useMemo(
    () => d3.scaleLog().domain(axisConfig.yDomain).range([ih, 0]),
    [axisConfig.yDomain, ih]
  );

  const xScale = useMemo(() => transform.rescaleX(xScaleBase), [xScaleBase, transform]);
  const yScale = useMemo(() => transform.rescaleY(yScaleBase), [yScaleBase, transform]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom()
      .scaleExtent([0.5, 20])
      .translateExtent([[-iw, -ih], [iw * 2, ih * 2]])
      .on('zoom', (event) => setTransform(event.transform));
    svg.call(zoom);
    zoomRef.current = zoom;
    return () => svg.on('.zoom', null);
  }, [iw, ih]);

  const lineGen = useMemo(() => d3.line()
    .x(d => xScale(d[0]))
    .y(d => yScale(d[1]))
    .curve(d3.curveCatmullRomClosed.alpha(0.5)),
    [xScale, yScale]);

  const geometry = useMemo(() => {
    return materials.map(m => {
      const hull = logHull(m.points || []);
      const centroid = hull.length >= 3 ? logCentroid(hull) : (m.points?.[0] ?? [1, 1]);
      return { ...m, hull, centroid };
    });
  }, [materials]);

  const hasHighlight = materials.some(m => m.highlightRank);

  /* Aggregate points by super-family, build an inflated log-hull
     per family, and label at the hull centroid. Recomputed only
     when the underlying geometry changes. */
  const familyRegions = useMemo(() => {
    if (!showFamilies) return [];
    const groups = new Map();
    for (const m of geometry) {
      if (!m.visible) continue;
      const sf = SUPERFAMILY[m.family];
      if (!sf) continue;
      if (!groups.has(sf)) groups.set(sf, []);
      const bucket = groups.get(sf);
      for (const p of (m.hull && m.hull.length >= 3 ? m.hull : (m.points || []))) {
        bucket.push(p);
      }
    }
    const out = [];
    for (const name of FAMILY_ORDER) {
      const pts = groups.get(name);
      if (!pts || pts.length < 3) continue;
      const tight = logHull(pts);
      if (tight.length < 3) continue;
      const hull = inflateLogHull(tight, 0.22);
      const centroid = logCentroid(hull);
      out.push({ name, hull, centroid, color: FAMILY_COLORS[name] });
    }
    return out;
  }, [geometry, showFamilies]);

  const xTicks = useMemo(() => {
    const [a, b] = xScale.domain();
    return d3.range(Math.floor(Math.log10(a)), Math.ceil(Math.log10(b)) + 1)
      .map(p => Math.pow(10, p))
      .filter(t => t >= a * 0.99 && t <= b * 1.01);
  }, [xScale]);

  const yTicks = useMemo(() => {
    const [a, b] = yScale.domain();
    return d3.range(Math.floor(Math.log10(a)), Math.ceil(Math.log10(b)) + 1)
      .map(p => Math.pow(10, p))
      .filter(t => t >= a * 0.99 && t <= b * 1.01);
  }, [yScale]);

  const xTickMinor = useMemo(() => logMinorTicks(xScale.domain()), [xScale]);
  const yTickMinor = useMemo(() => logMinorTicks(yScale.domain()), [yScale]);

  const indexPaths = useMemo(() => {
    if (!indices.visible) return { path: null };
    const slope = indices.mode === 'tie' ? 1 : indices.mode === 'beam' ? 2 : 3;
    const [xMin, xMax] = xScale.domain();
    const samples = 80;
    const pts = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const x = Math.exp(Math.log(xMin) + t * (Math.log(xMax) - Math.log(xMin)));
      const y = indices.constant * Math.pow(x, slope);
      pts.push([xScale(x), yScale(y)]);
    }
    const path = d3.line()(pts);
    return { path, slope, label: indexLabel(indices.mode) };
  }, [indices, xScale, yScale]);

  const onWrapperMouseMove = useCallback((evt) => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const mx = evt.clientX - rect.left - margin.left;
    const my = evt.clientY - rect.top - margin.top;
    if (mx < 0 || my < 0 || mx > iw || my > ih) {
      setMousePos(null);
      return;
    }
    const dx = xScale.invert(mx);
    const dy = yScale.invert(my);
    setMousePos({ mx, my, dx, dy });
  }, [iw, ih, xScale, yScale, margin.left, margin.top]);

  const zoomIn  = () => d3.select(svgRef.current).transition().duration(200).call(zoomRef.current.scaleBy, 1.6);
  const zoomOut = () => d3.select(svgRef.current).transition().duration(200).call(zoomRef.current.scaleBy, 1 / 1.6);
  const resetView = () => d3.select(svgRef.current).transition().duration(220).call(zoomRef.current.transform, d3.zoomIdentity);

  const exportPNG = () => {
    const svg = svgRef.current;
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    // Inject the styles that classed elements (axis text, grid lines,
    // index lines) depend on. Without this, the browser's <img> tag
    // renders the SVG with its own defaults and labels fall back to
    // black-fill rects with no visible text.
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = `
      .chart-grid line { stroke: ${THEME.borderSoft}; stroke-width: 0.5; }
      .chart-grid .tick-major line { stroke: ${THEME.border}; stroke-width: 0.8; }
      .axis line { stroke: ${THEME.ink}; }
      .axis text {
        fill: ${THEME.inkMuted};
        font-family: 'IBM Plex Mono', ui-monospace, monospace;
        font-size: 10px;
      }
      .index-line {
        stroke-dasharray: 2 3;
        stroke: ${THEME.accent};
        stroke-width: 0.9;
        opacity: 0.55;
        fill: none;
      }
      .index-label {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 9.5px;
        fill: ${THEME.accent};
        font-weight: 500;
      }
    `;
    clone.insertBefore(styleEl, clone.firstChild);

    const data = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = 2.5;
      canvas.width = size.w * scale;
      canvas.height = size.h * scale;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = THEME.paper;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(b => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = 'ashby-chart.png';
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    img.src = url;
  };

  return (
    <div
      ref={wrapperRef}
      className="relative w-full h-full paper-grain"
      onMouseMove={onWrapperMouseMove}
      onMouseLeave={() => setMousePos(null)}
    >
      <svg ref={svgRef} width={size.w} height={size.h} style={{ display: 'block' }}>
        <g transform={`translate(${margin.left},${margin.top})`} ref={gRef}>
          <defs>
            <clipPath id="plot-clip">
              <rect x="-2" y="-2" width={iw + 4} height={ih + 4} />
            </clipPath>
          </defs>

          <rect x="0" y="0" width={iw} height={ih} fill={THEME.paperLight} stroke="none" />

          {showGrid && (
            <g className="chart-grid" clipPath="url(#plot-clip)">
              {xTickMinor.map((t, i) => (
                <line key={`xm-${i}`} x1={xScale(t)} x2={xScale(t)} y1={0} y2={ih} />
              ))}
              {yTickMinor.map((t, i) => (
                <line key={`ym-${i}`} x1={0} x2={iw} y1={yScale(t)} y2={yScale(t)} />
              ))}
              {xTicks.map((t, i) => (
                <g className="tick-major" key={`xM-${i}`}>
                  <line x1={xScale(t)} x2={xScale(t)} y1={0} y2={ih} />
                </g>
              ))}
              {yTicks.map((t, i) => (
                <g className="tick-major" key={`yM-${i}`}>
                  <line x1={0} x2={iw} y1={yScale(t)} y2={yScale(t)} />
                </g>
              ))}
            </g>
          )}

          <rect x="0" y="0" width={iw} height={ih} fill="none" stroke={THEME.ink} strokeWidth="1" />

          {indices.visible && indexPaths.path && (
            <g clipPath="url(#plot-clip)">
              <path d={indexPaths.path} className="index-line" />
              <text
                className="index-label"
                x={iw - 6}
                y={(() => {
                  const [, xMax] = xScale.domain();
                  const yAtRight = indices.constant * Math.pow(xMax, indexPaths.slope);
                  const y = yScale(yAtRight);
                  return Math.max(12, Math.min(ih - 4, y - 6));
                })()}
                textAnchor="end"
              >
                {indexPaths.label} = {fmt(indices.constant, 3)}
              </text>
            </g>
          )}

          {/* Super-family background regions — broad material classes
              rendered as tinted blobs underneath individual envelopes. */}
          {showFamilies && (
            <g clipPath="url(#plot-clip)" style={{ pointerEvents: 'none' }}>
              {familyRegions.map(r => {
                const path = lineGen(r.hull);
                return (
                  <path
                    key={`fr-${r.name}`}
                    d={path}
                    fill={r.color}
                    opacity={0.13}
                    stroke={r.color}
                    strokeOpacity={0.35}
                    strokeWidth={1.2}
                  />
                );
              })}
            </g>
          )}

          {/* Envelopes — sorted so highlighted render last (on top) */}
          <g clipPath="url(#plot-clip)">
            {[...geometry]
              .filter(m => m.visible && m.hull.length >= 3)
              .sort((a, b) => (a.highlightRank ? 1 : 0) - (b.highlightRank ? 1 : 0))
              .map(m => {
                const isHL = !!m.highlightRank;
                const userDimmed = (focusId && focusId !== m.id) || (hoverId && hoverId !== m.id);
                const focused = focusId === m.id || hoverId === m.id;
                const opacity = isHL
                  ? 1
                  : (hasHighlight ? 0.18 : (userDimmed ? 0.18 : (focused ? 1 : 0.85)));
                const strokeWidth = isHL
                  ? (m.highlightRank === 1 ? 3 : 2.2)
                  : (focused ? 2 : 1.2);
                const dashArray = isHL ? 'none' : (focused ? 'none' : '3 3');
                const path = lineGen(m.hull);
                return (
                  <g
                    key={m.id}
                    style={{ opacity, transition: 'opacity 200ms ease, stroke-width 200ms ease' }}
                    onMouseEnter={() => setHoverId(m.id)}
                    onMouseLeave={() => setHoverId(null)}
                    onClick={() => setFocusId(focusId === m.id ? null : m.id)}
                    className="envelope"
                  >
                    <path
                      d={path}
                      fill={m.color}
                      opacity={isHL ? 0.32 : 0.22}
                      stroke="none"
                    />
                    <path
                      d={path}
                      fill="none"
                      stroke={m.color}
                      strokeWidth={strokeWidth}
                      strokeDasharray={dashArray}
                    />
                    {showPoints && m.points.map((p, i) => (
                      <circle
                        key={i}
                        cx={xScale(p[0])} cy={yScale(p[1])}
                        r={2} fill={m.color} opacity={0.7}
                      />
                    ))}
                  </g>
                );
              })}
          </g>

          {/* Labels */}
          {showLabels && geometry.filter(m => m.visible && m.hull.length >= 3).map(m => {
            const lx = xScale(m.centroid[0]);
            const ly = yScale(m.centroid[1]);
            if (lx < 0 || ly < 0 || lx > iw || ly > ih) return null;
            const isHL = !!m.highlightRank;
            const userDimmed = (focusId && focusId !== m.id) || (hoverId && hoverId !== m.id);
            const labelOpacity = isHL
              ? 1
              : (hasHighlight ? 0.25 : (userDimmed ? 0.35 : 1));
            const name = isHL ? `#${m.highlightRank}  ${m.name}` : m.name;
            const w = Math.max(48, name.length * 6.2 + 14);
            const h = 18;
            return (
              <g
                key={`lab-${m.id}`}
                className={`label-box ${isHL ? 'rank-label' : ''}`}
                transform={`translate(${lx - w/2}, ${ly - h/2})`}
                opacity={labelOpacity}
              >
                <rect
                  width={w} height={h} rx={3}
                  fill={THEME.paperLight}
                  stroke={isHL ? m.color : THEME.ink}
                  strokeWidth={isHL ? 1.4 : 0.6}
                />
                <text
                  x={w/2} y={h/2}
                  fill={THEME.ink}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily="'IBM Plex Sans', -apple-system, system-ui, sans-serif"
                  fontSize="11"
                  fontWeight={isHL ? 600 : 500}
                >
                  {name}
                </text>
              </g>
            );
          })}

          {/* Super-family labels — pill-shaped chips at each region's
              centroid, sized for the family name. */}
          {showFamilies && familyRegions.map(r => {
            const lx = xScale(r.centroid[0]);
            const ly = yScale(r.centroid[1]);
            if (lx < 0 || ly < 0 || lx > iw || ly > ih) return null;
            const w = r.name.length * 7.2 + 18;
            const h = 22;
            return (
              <g
                key={`fl-${r.name}`}
                transform={`translate(${lx - w/2}, ${ly - h/2})`}
                style={{ pointerEvents: 'none' }}
              >
                <rect
                  width={w} height={h} rx={11}
                  fill={r.color}
                  opacity={0.92}
                  stroke={THEME.paperLight}
                  strokeWidth={1.2}
                />
                <text
                  x={w/2} y={h/2 + 0.5}
                  fill="white"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily="'IBM Plex Sans', -apple-system, system-ui, sans-serif"
                  fontSize="11.5"
                  fontWeight={600}
                  letterSpacing="0.01em"
                >
                  {r.name}
                </text>
              </g>
            );
          })}
        </g>

        <g transform={`translate(${margin.left},${margin.top + ih})`} className="axis">
          <line x1="0" x2={iw} y1="0" y2="0" stroke={THEME.ink} strokeWidth="1" />
          {xTicks.map((t, i) => (
            <g key={i} transform={`translate(${xScale(t)},0)`}>
              <line y2="6" stroke={THEME.ink} />
              <text y="20" textAnchor="middle">{fmt(t, 2)}</text>
            </g>
          ))}
          <text
            x={iw / 2} y={38}
            textAnchor="middle"
            className="font-body"
            style={{ fill: THEME.ink, fontSize: 12, fontWeight: 500 }}
          >
            {axisConfig.xLabel}
          </text>
        </g>

        <g transform={`translate(${margin.left},${margin.top})`} className="axis">
          <line x1="0" x2="0" y1="0" y2={ih} stroke={THEME.ink} strokeWidth="1" />
          {yTicks.map((t, i) => (
            <g key={i} transform={`translate(0,${yScale(t)})`}>
              <line x2="-6" stroke={THEME.ink} />
              <text x="-10" dy="0.32em" textAnchor="end">{fmt(t, 2)}</text>
            </g>
          ))}
          <text
            transform={`translate(${-48},${ih / 2}) rotate(-90)`}
            textAnchor="middle"
            className="font-body"
            style={{ fill: THEME.ink, fontSize: 12, fontWeight: 500 }}
          >
            {axisConfig.yLabel}
          </text>
        </g>
      </svg>

      {mousePos && (
        <div
          className="pointer-events-none absolute font-mono"
          style={{
            left: mousePos.mx + margin.left + 12,
            top: mousePos.my + margin.top + 12,
            background: THEME.ink,
            color: THEME.paperLight,
            padding: '6px 9px',
            fontSize: 10,
            borderRadius: 3,
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}
        >
          x {fmt(mousePos.dx, 3)} &nbsp;·&nbsp; y {fmt(mousePos.dy, 3)}
        </div>
      )}

      <div
        className="absolute"
        style={{
          top: 12, right: 12,
          display: 'flex', gap: 4,
          background: THEME.paperLight,
          border: `1px solid ${THEME.border}`,
          borderRadius: 4,
          padding: 3,
        }}
      >
        <button className="btn btn-ghost" title="Zoom in" onClick={zoomIn}>
          <ZoomIn size={14} />
        </button>
        <button className="btn btn-ghost" title="Zoom out" onClick={zoomOut}>
          <ZoomOut size={14} />
        </button>
        <button className="btn btn-ghost" title="Reset view" onClick={resetView}>
          <Maximize2 size={14} />
        </button>
        <div style={{ width: 1, background: THEME.border, margin: '3px 2px' }} />
        {onGalvanic && (
          <button className="btn btn-ghost" title="Galvanic compatibility (MIL-STD-889C)" onClick={onGalvanic}>
            <Zap size={14} />
          </button>
        )}
        <button className="btn btn-ghost" title="Export PNG" onClick={exportPNG}>
          <Download size={14} />
        </button>
      </div>
    </div>
  );
}

function indexLabel(mode) {
  if (mode === 'tie')   return 'E/ρ';
  if (mode === 'beam')  return 'E^½/ρ';
  return 'E^⅓/ρ';
}

function logMinorTicks([a, b]) {
  const out = [];
  const lo = Math.floor(Math.log10(a));
  const hi = Math.ceil(Math.log10(b));
  for (let p = lo; p <= hi; p++) {
    for (let m = 2; m <= 9; m++) {
      const t = m * Math.pow(10, p);
      if (t >= a && t <= b) out.push(t);
    }
  }
  return out;
}

/* ============================================================
   MATERIAL ROW
   ============================================================ */

function MaterialRow({ m, onToggle, onDelete, onFocus, isFocus }) {
  return (
    <div
      className="mat-row flex items-center gap-2 py-1.5 px-3 cursor-pointer"
      style={{
        borderLeft: `3px solid ${isFocus ? m.color : 'transparent'}`,
        background: isFocus ? THEME.paperDark : 'transparent',
      }}
      onClick={onFocus}
    >
      <span
        style={{
          width: 10, height: 10,
          background: m.color,
          opacity: m.visible ? 1 : 0.25,
          borderRadius: 2,
          flexShrink: 0,
        }}
      />
      <span className="flex-1 text-xs font-body truncate"
            style={{ color: m.visible ? THEME.ink : THEME.inkFaint, fontWeight: isFocus ? 500 : 400 }}>
        {m.name}
      </span>
      {m.highlightRank && (
        <span
          className="font-mono text-[9px]"
          style={{
            background: m.color, color: 'white',
            padding: '1px 5px', borderRadius: 8,
          }}
        >
          #{m.highlightRank}
        </span>
      )}
      <div className="mat-actions flex items-center gap-1">
        <button
          className="btn btn-ghost"
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          title={m.visible ? 'Hide' : 'Show'}
        >
          {m.visible ? <Eye size={12} /> : <EyeOff size={12} />}
        </button>
        <button
          className="btn btn-ghost"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Remove"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   SECTION HEADER
   When `open` and `onToggle` are passed, the header becomes
   a clickable accordion toggle. Otherwise it's a static label.
   ============================================================ */

function SectionHeader({ icon: Icon, title, right, open, onToggle }) {
  const interactive = typeof onToggle === 'function';
  return (
    <div
      className="flex items-center gap-2 px-4 py-2"
      onClick={interactive ? onToggle : undefined}
      style={{
        borderTop: `1px solid ${THEME.border}`,
        borderBottom: `1px solid ${THEME.border}`,
        background: THEME.paper,
        cursor: interactive ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      {interactive && (
        <ChevronDown
          size={11}
          className="section-chevron"
          style={{
            color: THEME.inkMuted,
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            flexShrink: 0,
          }}
        />
      )}
      {Icon && <Icon size={12} style={{ color: THEME.inkMuted, flexShrink: 0 }} />}
      <span className="font-mono text-[10px] uppercase tracking-wider"
            style={{ color: THEME.inkMuted, fontWeight: 500 }}>
        {title}
      </span>
      <div className="flex-1" />
      {right}
    </div>
  );
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export default function AshbyStudio() {
  const [materials, setMaterials] = useState(buildInitialMaterials);
  const [hoverId, setHoverId] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const [showPoints, setShowPoints] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showFamilies, setShowFamilies] = useState(true);
  const [dragActive, setDragActive] = useState(false);

  // Selection / browse / build mode
  const [mode, setMode] = useState('select'); // 'select' | 'browse' | 'build'

  // Chart axes by property key
  const [chartAxes, setChartAxes] = useState({ xKey: 'density', yKey: 'modulus' });

  // Top-3 ranked material IDs from wizard, in rank order
  const [highlightedIds, setHighlightedIds] = useState([]);

  const [axisConfig, setAxisConfig] = useState({
    xDomain: [0.05, 12],
    yDomain: [0.001, 300],
    xLabel: "Density  ρ  (g/cc)",
    yLabel: "Young's Modulus  E  (GPa)",
  });

  const [indices, setIndices] = useState({
    visible: false,
    mode: 'beam',
    constant: 2.0,
  });

  const [aboutOpen, setAboutOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [galvanicOpen, setGalvanicOpen] = useState(false);
  const [csvErrors, setCsvErrors] = useState([]);
  const fileInputRef = useRef(null);

  /* First-launch tour: open automatically if the user has never
     dismissed it. Replay-able from the About modal. */
  const [tourOpen, setTourOpen] = useState(() => {
    try {
      return localStorage.getItem('ashby:tourSeen') !== '1';
    } catch {
      return true;
    }
  });
  const dismissTour = useCallback(() => {
    setTourOpen(false);
    try { localStorage.setItem('ashby:tourSeen', '1'); } catch {}
  }, []);
  const replayTour = useCallback(() => {
    setAboutOpen(false);
    setTourOpen(true);
  }, []);

  /* Sidebar widths — persisted across reloads. Bounded to keep
     the chart usable on smaller viewports. */
  const [leftWidth, setLeftWidth] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem('ashby:leftWidth') || '', 10);
      return Number.isFinite(v) && v >= 220 && v <= 480 ? v : 280;
    } catch { return 280; }
  });
  const [rightWidth, setRightWidth] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem('ashby:rightWidth') || '', 10);
      return Number.isFinite(v) && v >= 320 && v <= 540 ? v : 360;
    } catch { return 360; }
  });
  useEffect(() => {
    try { localStorage.setItem('ashby:leftWidth', String(leftWidth)); } catch {}
  }, [leftWidth]);
  useEffect(() => {
    try { localStorage.setItem('ashby:rightWidth', String(rightWidth)); } catch {}
  }, [rightWidth]);

  /* Collapsible sidebar sections — each starts open by default */
  const [openSections, setOpenSections] = useState(() => {
    try {
      const raw = localStorage.getItem('ashby:openSections');
      if (raw) return JSON.parse(raw);
    } catch {}
    return { materials: true, appearance: true, axes: true, perfIndex: false };
  });
  useEffect(() => {
    try { localStorage.setItem('ashby:openSections', JSON.stringify(openSections)); } catch {}
  }, [openSections]);
  const toggleSection = useCallback((key) => {
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));
  }, []);

  /* Add a single custom material to the live set */
  const addCustomMaterial = useCallback((m) => {
    setMaterials((prev) => {
      const color = PALETTE[prev.length % PALETTE.length];
      return [
        ...prev,
        {
          ...m,
          color,
          visible: true,
          isUserCustom: true,
        },
      ];
    });
  }, []);

  /* Download a property-spec CSV template the user can fill out */
  const downloadTemplate = useCallback(() => {
    const csv = [
      'name,family,environments,layers,density,modulus,strength,tMax,cost,chemRes,notes',
      'My CFRP grade,Carbon composite,space;deep_sea,outer_shell;helmet,1.55,90,1100,200,4,3,Hand-layup quasi-isotropic',
      'Custom alumina,Oxide ceramic,space;chemical,helmet,3.95,380,350,1700,2,4,Flexural strength reported',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ashby-studio-template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }, []);

  /* Auto-fit when axes or material set changes */
  const computeFit = useCallback((mats, xKey, yKey) => {
    const allPoints = [];
    for (const m of mats) {
      if (!m.visible) continue;
      if (m.props) {
        const x = m.props[xKey];
        const y = m.props[yKey];
        if (Number.isFinite(x) && Number.isFinite(y) && x > 0 && y > 0) {
          allPoints.push([x, y]);
        }
      } else if (m.points && xKey === 'density' && yKey === 'modulus') {
        for (const p of m.points) allPoints.push(p);
      }
    }
    if (!allPoints.length) return null;
    const xExt = d3.extent(allPoints, d => d[0]);
    const yExt = d3.extent(allPoints, d => d[1]);
    return {
      xDomain: [xExt[0] * 0.5, xExt[1] * 2],
      yDomain: [yExt[0] * 0.3, yExt[1] * 3],
    };
  }, []);

  const onAxisRequest = useCallback((xKey, yKey) => {
    setChartAxes((prev) => {
      if (prev.xKey === xKey && prev.yKey === yKey) return prev;
      return { xKey, yKey };
    });
  }, []);

  useEffect(() => {
    const fit = computeFit(materials, chartAxes.xKey, chartAxes.yKey);
    setAxisConfig((c) => ({
      ...c,
      xLabel: `${PROPERTY_META[chartAxes.xKey]?.label ?? chartAxes.xKey}  (${PROPERTY_META[chartAxes.xKey]?.unit ?? ''})`,
      yLabel: `${PROPERTY_META[chartAxes.yKey]?.label ?? chartAxes.yKey}  (${PROPERTY_META[chartAxes.yKey]?.unit ?? ''})`,
      ...(fit || {}),
    }));
  }, [chartAxes, materials, computeFit]);

  /* Derive chart-ready materials with points + highlight */
  const chartMaterials = useMemo(() => {
    return materials.map((m) => {
      let points;
      if (m.props) {
        points = clusterPoints(m, chartAxes.xKey, chartAxes.yKey);
      } else if (m.points && chartAxes.xKey === 'density' && chartAxes.yKey === 'modulus') {
        points = m.points;
      } else {
        points = [];
      }
      const idx = highlightedIds.indexOf(m.id);
      const isHL = idx >= 0;
      return {
        ...m,
        points,
        color: isHL
          ? (idx === 0 ? THEME.rank1 : idx === 1 ? THEME.rank2 : THEME.rank3)
          : m.color,
        highlightRank: isHL ? idx + 1 : null,
      };
    });
  }, [materials, chartAxes, highlightedIds]);

  /* File handling — accepts both legacy scatter CSVs (one file =
     one material's measured points) and property-spec CSVs (one
     row = one full material with properties). The latter participate
     in the selection pipeline. */
  const handleFiles = async (files) => {
    let nextColor = materials.length;
    const additions = [];
    const errors = [];
    for (const file of files) {
      const text = await file.text();
      // Sniff: peek at the first non-empty row's headers
      const peek = Papa.parse(text.trim(), { skipEmptyLines: true, preview: 1 });
      const headerRow = peek.data?.[0];
      if (looksLikePropertySpec(headerRow)) {
        const { materials: parsed, errors: pErrs } = parsePropertyCSV(text);
        for (const m of parsed) {
          additions.push({
            ...m,
            color: PALETTE[nextColor % PALETTE.length],
            visible: true,
            isUserCustom: true,
          });
          nextColor++;
        }
        for (const e of pErrs) errors.push(`${file.name}: ${e}`);
      } else {
        const fallback = file.name.replace(/\.csv$/i, '').replace(/[_-]/g, ' ').toUpperCase();
        const groups = parseCSV(text, fallback);
        for (const g of groups) {
          if (g.points.length < 1) continue;
          additions.push({
            id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: g.name,
            color: PALETTE[nextColor % PALETTE.length],
            points: g.points,
            visible: true,
            isUserCSV: true,
          });
          nextColor++;
        }
      }
    }
    if (additions.length) {
      setMaterials([...materials, ...additions]);
    }
    setCsvErrors(errors);
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragActive(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv'));
    if (files.length) handleFiles(files);
  };

  const clearAll = () => { setMaterials([]); setFocusId(null); setHoverId(null); };
  const resetSamples = () => setMaterials(buildInitialMaterials());

  return (
    <div className="w-full h-screen flex flex-col font-body" style={{ background: THEME.paper, color: THEME.ink }}>
      <style>{GLOBAL_CSS}</style>

      {/* Top bar */}
      <header
        className="flex items-center gap-4 px-6 py-3"
        style={{
          background: THEME.paperLight,
          borderBottom: `1px solid ${THEME.border}`,
        }}
      >
        <div className="flex items-baseline gap-3">
          <div className="font-display italic" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em' }}>
            Ashby Studio
          </div>
          <div className="font-mono uppercase" style={{ fontSize: 9, letterSpacing: '0.15em', color: THEME.inkFaint }}>
            Suit-material selection workbench
          </div>
        </div>

        <div className="flex-1" />

        {/* Mode toggle */}
        <div
          className="flex items-center gap-1 p-1 rounded"
          style={{ background: THEME.paper, border: `1px solid ${THEME.border}` }}
        >
          <button
            className={`mode-tab ${mode === 'select' ? 'mode-tab-active' : 'mode-tab-inactive'}`}
            onClick={() => setMode('select')}
            style={{ border: 'none' }}
          >
            <FlaskConical size={11} />
            Select
          </button>
          <button
            className={`mode-tab ${mode === 'browse' ? 'mode-tab-active' : 'mode-tab-inactive'}`}
            onClick={() => setMode('browse')}
            style={{ border: 'none' }}
          >
            <Compass size={11} />
            Browse
          </button>
          <button
            className={`mode-tab ${mode === 'build' ? 'mode-tab-active' : 'mode-tab-inactive'}`}
            onClick={() => setMode('build')}
            style={{ border: 'none' }}
          >
            <Wrench size={11} />
            Build
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px]" style={{ color: THEME.inkFaint }}>
            {materials.filter(m => m.visible).length}/{materials.length} visible
          </span>
          <button className="btn btn-ghost" onClick={() => setAboutOpen(true)} title="About">
            <Info size={14} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* Build mode — full-width spacesuit builder */}
        {mode === 'build' && (
          <SpacesuitBuilder materials={materials} />
        )}

        {/* Left sidebar — hidden in build mode */}
        <aside
          className="flex flex-col scroll-thin overflow-y-auto relative"
          style={{
            display: mode === 'build' ? 'none' : undefined,
            width: leftWidth, minWidth: leftWidth,
            background: THEME.paperLight,
            borderRight: `1px solid ${THEME.border}`,
          }}
        >
          <ResizeHandle
            width={leftWidth} setWidth={setLeftWidth}
            edge="right" min={220} max={480}
          />

          <SectionHeader
            icon={Layers}
            title="Materials"
            open={openSections.materials}
            onToggle={() => toggleSection('materials')}
            right={
              <button
                className="btn btn-ghost"
                onClick={(e) => { e.stopPropagation(); clearAll(); }}
                title="Clear all"
              >
                <X size={12} />
              </button>
            }
          />

          {openSections.materials && (
          <>
          <div className="flex flex-col">
            {materials.length === 0 && (
              <div className="px-4 py-6 text-center">
                <div className="font-body text-xs mb-3" style={{ color: THEME.inkFaint }}>
                  No materials loaded
                </div>
                <button className="btn btn-primary" onClick={resetSamples}>
                  <Sparkles size={12} /> Load suit-material set
                </button>
              </div>
            )}
            {chartMaterials.map(m => (
              <MaterialRow
                key={m.id}
                m={m}
                isFocus={focusId === m.id}
                onToggle={() => setMaterials(ms => ms.map(x =>
                  x.id === m.id ? { ...x, visible: !x.visible } : x))}
                onDelete={() => {
                  setMaterials(ms => ms.filter(x => x.id !== m.id));
                  if (focusId === m.id) setFocusId(null);
                }}
                onFocus={() => setFocusId(focusId === m.id ? null : m.id)}
              />
            ))}
          </div>

          <div className="px-3 py-3 flex flex-col gap-2">
            <div
              className={`drop-zone ${dragActive ? 'drop-zone-active' : ''} cursor-pointer`}
              style={{
                border: `1.2px dashed ${THEME.inkFaint}`,
                borderRadius: 3,
                padding: '14px 10px',
                textAlign: 'center',
              }}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16} style={{ color: THEME.inkMuted, margin: '0 auto 6px' }} />
              <div className="font-body text-xs" style={{ color: THEME.ink }}>
                Drop CSV here
              </div>
              <div className="font-mono text-[10px] mt-1" style={{ color: THEME.inkFaint }}>
                scatter points or full property spec
              </div>
              <input
                ref={fileInputRef} type="file" accept=".csv" multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = Array.from(e.target.files || []);
                  if (f.length) handleFiles(f);
                  e.target.value = '';
                }}
              />
            </div>

            {csvErrors.length > 0 && (
              <div
                className="font-mono text-[10px] px-2 py-1.5"
                style={{
                  background: '#FAEBEC',
                  color: THEME.accent,
                  border: `1px solid ${THEME.accentSoft}`,
                  borderRadius: 3,
                }}
              >
                {csvErrors.slice(0, 3).map((e, i) => <div key={i}>{e}</div>)}
                {csvErrors.length > 3 && <div>+ {csvErrors.length - 3} more</div>}
              </div>
            )}

            <button
              className="btn"
              onClick={() => setCustomOpen(true)}
            >
              <Plus size={12} /> Add custom material
            </button>

            <div className="flex gap-2">
              <button className="btn flex-1" onClick={resetSamples} title="Reset to built-in suit-material set">
                <Sparkles size={12} /> Reset
              </button>
              <button
                className="btn flex-1"
                onClick={() => {
                  const fit = computeFit(materials, chartAxes.xKey, chartAxes.yKey);
                  if (fit) setAxisConfig(c => ({ ...c, ...fit }));
                }}
              >
                <Target size={12} /> Auto-fit
              </button>
            </div>

            <button
              className="btn btn-ghost"
              style={{ fontSize: 10, justifyContent: 'center' }}
              onClick={downloadTemplate}
              title="Download CSV template for property-spec uploads"
            >
              <Download size={11} /> CSV spec template
            </button>
          </div>
          </>
          )}

          <SectionHeader
            icon={Settings2} title="Appearance"
            open={openSections.appearance}
            onToggle={() => toggleSection('appearance')}
          />
          {openSections.appearance && (
          <div className="px-4 py-3 flex flex-col gap-2.5">
            <label className="flex items-center gap-2.5 cursor-pointer text-sm">
              <input type="checkbox" className="checkbox"
                     checked={showGrid} onChange={e => setShowGrid(e.target.checked)} />
              <span>Gridlines</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer text-sm">
              <input type="checkbox" className="checkbox"
                     checked={showLabels} onChange={e => setShowLabels(e.target.checked)} />
              <span>Material labels</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer text-sm">
              <input type="checkbox" className="checkbox"
                     checked={showPoints} onChange={e => setShowPoints(e.target.checked)} />
              <span>Show data points</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer text-sm">
              <input type="checkbox" className="checkbox"
                     checked={showFamilies} onChange={e => setShowFamilies(e.target.checked)} />
              <span>Family regions</span>
            </label>
          </div>
          )}

          {/* Chart property axes */}
          <SectionHeader
            icon={Grid3x3} title="Chart axes"
            open={openSections.axes}
            onToggle={() => toggleSection('axes')}
          />
          {openSections.axes && (
          <div className="px-4 py-3 grid grid-cols-2 gap-2 text-xs">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase" style={{ color: THEME.inkFaint }}>X</span>
              <select
                value={chartAxes.xKey}
                onChange={(e) => setChartAxes((c) => ({ ...c, xKey: e.target.value }))}
                style={{
                  border: `1px solid ${THEME.border}`,
                  background: THEME.paperLight,
                  borderRadius: 3, padding: '4px 6px',
                }}
              >
                {Object.entries(PROPERTY_META).filter(([, v]) => v.axis).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase" style={{ color: THEME.inkFaint }}>Y</span>
              <select
                value={chartAxes.yKey}
                onChange={(e) => setChartAxes((c) => ({ ...c, yKey: e.target.value }))}
                style={{
                  border: `1px solid ${THEME.border}`,
                  background: THEME.paperLight,
                  borderRadius: 3, padding: '4px 6px',
                }}
              >
                {Object.entries(PROPERTY_META).filter(([, v]) => v.axis).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </label>
          </div>
          )}

          {/* Performance index — only useful for density vs modulus */}
          {chartAxes.xKey === 'density' && chartAxes.yKey === 'modulus' && (
            <>
              <SectionHeader
                icon={Dot} title="Performance Index"
                open={openSections.perfIndex}
                onToggle={() => toggleSection('perfIndex')}
              />
              {openSections.perfIndex && (
              <div className="px-4 py-3 flex flex-col gap-3">
                <label className="flex items-center gap-2.5 cursor-pointer text-sm">
                  <input type="checkbox" className="checkbox"
                         checked={indices.visible}
                         onChange={e => setIndices(s => ({ ...s, visible: e.target.checked }))} />
                  <span>Show iso-performance line</span>
                </label>

                <div className="flex gap-1">
                  {[
                    { key: 'tie',   label: 'E/ρ',   hint: 'tie'   },
                    { key: 'beam',  label: 'E^½/ρ', hint: 'beam'  },
                    { key: 'plate', label: 'E^⅓/ρ', hint: 'plate' },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setIndices(s => ({ ...s, mode: opt.key }))}
                      className="btn flex-1 justify-center"
                      style={{
                        background: indices.mode === opt.key ? THEME.ink : THEME.paperLight,
                        color:      indices.mode === opt.key ? THEME.paperLight : THEME.ink,
                        borderColor: indices.mode === opt.key ? THEME.ink : THEME.border,
                        fontSize: 11, padding: '5px 6px',
                      }}
                      title={`Minimum-mass ${opt.hint}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="font-mono text-[10px]" style={{ color: THEME.inkMuted }}>
                      C
                    </span>
                    <span className="font-mono text-[11px]">{fmt(indices.constant, 3)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.01" max="20" step="0.01"
                    value={indices.constant}
                    onChange={e => setIndices(s => ({ ...s, constant: parseFloat(e.target.value) }))}
                  />
                  <div className="font-mono text-[9px] mt-1" style={{ color: THEME.inkFaint }}>
                    materials above the line outperform those below
                  </div>
                </div>
              </div>
              )}
            </>
          )}

          <div className="flex-1" />

          <div className="px-4 py-3 font-mono text-[9px]" style={{ color: THEME.inkFaint, borderTop: `1px solid ${THEME.border}` }}>
            <div>Drag: pan · Scroll: zoom · Click material: focus</div>
          </div>
        </aside>

        {/* Chart area — hidden in build mode */}
        <main className="flex-1 relative" style={{ display: mode === 'build' ? 'none' : undefined }}>
          <AshbyChart
            materials={chartMaterials}
            showPoints={showPoints}
            showGrid={showGrid}
            showLabels={showLabels}
            showFamilies={showFamilies}
            indices={indices}
            axisConfig={axisConfig}
            hoverId={hoverId} setHoverId={setHoverId}
            focusId={focusId} setFocusId={setFocusId}
            onGalvanic={() => setGalvanicOpen(true)}
          />
        </main>

        {/* Right wizard panel — always mounted so its state
            persists across mode switches; hidden in non-select modes. */}
        <SelectionWizard
          materials={materials}
          width={rightWidth}
          setWidth={setRightWidth}
          onHighlight={setHighlightedIds}
          onAxisRequest={onAxisRequest}
          hidden={mode !== 'select'}
        />
      </div>

      {/* Custom material modal */}
      <CustomMaterialModal
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        onAdd={addCustomMaterial}
      />

      {/* Galvanic compatibility matrix */}
      <CompatibilityMatrix
        open={galvanicOpen}
        onClose={() => setGalvanicOpen(false)}
        materials={chartMaterials}
      />

      {/* First-launch / replay tour */}
      <Tour open={tourOpen} onClose={dismissTour} />

      {/* About modal */}
      {aboutOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ background: 'rgba(28,25,23,0.35)' }}
          onClick={() => setAboutOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="relative"
            style={{
              background: THEME.paperLight,
              border: `1px solid ${THEME.ink}`,
              padding: '28px 30px',
              maxWidth: 580,
              fontSize: 13,
              lineHeight: 1.65,
              boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
            }}
          >
            <button
              onClick={() => setAboutOpen(false)}
              className="absolute"
              style={{ top: 10, right: 10, background: 'transparent', border: 'none', cursor: 'pointer', color: THEME.inkMuted }}
            >
              <X size={16} />
            </button>
            <div className="font-display italic mb-4" style={{ fontSize: 24 }}>
              Ashby Studio
            </div>
            <p className="mb-3">
              A materials-selection workbench for protective-suit design across
              extreme environments (space, deep sea, chemical/CBRN). Combines
              an interactive Ashby chart with a four-step decision pipeline.
            </p>
            <p className="mb-3">
              <span className="font-mono text-xs">Select</span> mode runs the
              full pipeline: hard filtering by environment and layer, AHP pairwise
              weighting (with Saaty consistency ratio), TOPSIS ranking against
              ideal best/worst, and a Pugh matrix to validate the top candidate
              against a chosen baseline.
            </p>
            <p className="mb-3">
              <span className="font-mono text-xs">Browse</span> mode is the
              classical Ashby viewer: log-log envelopes, performance-index guide
              lines for minimum-mass design, and CSV upload for your own data.
            </p>
            <div
              className="font-mono text-[11px] p-2 mt-4 mb-1"
              style={{ background: THEME.paperDark, border: `1px solid ${THEME.border}` }}
            >
              <div style={{ color: THEME.inkMuted }}>CSV format — one file per material</div>
              <div>NAME,DENSITY,MODULUS</div>
              <div>ABS_high_density,3.5,6.1</div>
              <div>ABS_low_density,0.882,0.778</div>
              <div>...</div>
            </div>
            <p className="text-xs" style={{ color: THEME.inkMuted, marginTop: 10 }}>
              Filename becomes the material name. Numerical values in the
              built-in database are nominal, order-of-magnitude only. Verify
              against data sheets before committing to a design.
            </p>
            <div
              className="flex items-center gap-2 mt-4 pt-3"
              style={{ borderTop: `1px solid ${THEME.borderSoft}` }}
            >
              <button className="btn" onClick={replayTour}>
                <Sparkles size={12} /> Show tour again
              </button>
              <div className="flex-1" />
              <button className="btn btn-ghost" onClick={() => setAboutOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
