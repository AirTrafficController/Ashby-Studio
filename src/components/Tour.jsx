import React, { useState, useEffect } from 'react';
import {
  X, ChevronLeft, ChevronRight,
  Sparkles, FlaskConical, Layers, Grid3x3, Zap, Settings2,
} from 'lucide-react';
import { THEME } from '../theme.js';

/* ============================================================
   Tour
   ============================================================
   First-launch onboarding overlay. Opens automatically when the
   localStorage flag `ashby:tourSeen` is absent. User can advance
   with Next, retreat with Back, or dismiss at any time with Skip
   or the × in the top-right. Replay from the About modal.

   Centered card layout — no DOM-position spotlighting — so it's
   robust to resizable sidebars and collapsed sections. Step copy
   tells you where each feature lives in the UI.
   ============================================================ */

const STEPS = [
  {
    icon: Sparkles,
    title: 'Welcome to MSRS',
    body: (
      <>
        The <strong>Material Selection &amp; Ranking System</strong> — a
        workbench for protective-suit design. Two modes you toggle in the
        top bar: <strong>Select</strong> runs a 4-step ranking pipeline;
        <strong>Browse</strong> is the classical Ashby-style chart explorer.
        The current set has 40 built-in materials — metals, composites,
        ceramics, advanced textiles, elastomers.
      </>
    ),
  },
  {
    icon: FlaskConical,
    title: 'The selection pipeline',
    body: (
      <>
        In <strong>Select</strong> mode, the right-hand panel steps through:
        <ul className="mt-1.5 ml-4" style={{ listStyle: 'disc', lineHeight: 1.7 }}>
          <li><strong>Specify</strong> — environment, suit layer, morphology, T-window</li>
          <li><strong>Weight</strong> — pairwise AHP comparisons (Saaty 1–9 scale, consistency ratio shown)</li>
          <li><strong>Rank</strong> — TOPSIS produces a top-10; the top 3 highlight on the chart</li>
          <li><strong>Validate</strong> — Pugh matrix vs a baseline material</li>
        </ul>
      </>
    ),
  },
  {
    icon: Layers,
    title: 'Materials database',
    body: (
      <>
        Each material carries density, Young's modulus, tensile strength,
        max-use temperature, ordinal cost, chemical resistance, and an anodic
        group where applicable. Add your own with the{' '}
        <strong>Add custom material</strong> button in the Materials sidebar,
        or drag a property-spec CSV onto the drop zone. The{' '}
        <strong>CSV spec template</strong> button downloads a working example
        file you can fill in.
      </>
    ),
  },
  {
    icon: Grid3x3,
    title: 'The Ashby chart',
    body: (
      <>
        Log-log envelopes around each material's nominal point. Switch axes
        in <strong>Chart axes</strong> on the left sidebar to compare any pair
        of density / modulus / strength / max-use temperature. Scroll to zoom,
        drag to pan, click an envelope to focus. The download icon in the
        chart's top-right toolbar exports a high-resolution PNG with readable
        labels.
      </>
    ),
  },
  {
    icon: Zap,
    title: 'Galvanic & morphology',
    body: (
      <>
        Click the <strong>⚡</strong> button in the chart toolbar to open the
        MIL-STD-889C galvanic compatibility matrix for currently-visible
        conductive metals. Pick an environment, scan for red cells (I —
        incompatible), and click any of them to see the standard's
        recommended surface treatments.
        <br /><br />
        In Select mode, the <strong>Morphology</strong> filter in step 1
        (Rigid / Semi / Soft) enforces kinematic constraints before AHP runs —
        useful when designing flexible joints or bladders.
      </>
    ),
  },
  {
    icon: Settings2,
    title: 'Customise your workspace',
    body: (
      <>
        Drag the inner edge of either sidebar to resize. Click any section
        header (<strong>Materials</strong>, <strong>Appearance</strong>,{' '}
        <strong>Chart axes</strong>, <strong>Performance Index</strong>) to
        collapse or expand. Your layout persists across reloads.
        <br /><br />
        To replay this tour later, click the <strong>i</strong> icon in the
        top-right corner and choose <strong>Show tour again</strong>.
      </>
    ),
  },
];

export default function Tour({ open, onClose }) {
  const [step, setStep] = useState(0);

  // Reset to step 0 every time the tour reopens
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  // Keyboard navigation: Esc dismisses, arrows step
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') {
        setStep((s) => Math.min(STEPS.length - 1, s + 1));
      } else if (e.key === 'ArrowLeft') {
        setStep((s) => Math.max(0, s - 1));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const { icon: Icon, title, body } = STEPS[step];

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
          width: 'min(520px, 92vw)',
          maxHeight: '88vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute"
          style={{
            top: 12, right: 12,
            background: 'transparent', border: 'none',
            cursor: 'pointer', color: THEME.inkMuted,
            padding: 4,
          }}
          title="Skip tour"
        >
          <X size={16} />
        </button>

        {/* Body */}
        <div style={{ padding: '32px 36px 22px' }}>
          {/* Icon + step indicator */}
          <div className="flex items-center justify-between mb-3">
            <div
              style={{
                width: 36, height: 36,
                borderRadius: 18,
                background: THEME.paper,
                border: `1px solid ${THEME.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: THEME.ink,
              }}
            >
              <Icon size={16} />
            </div>
            <DotIndicator current={step} total={STEPS.length} />
          </div>

          {/* Title */}
          <div
            className="font-display italic"
            style={{ fontSize: 22, color: THEME.ink, lineHeight: 1.25 }}
          >
            {title}
          </div>
          <div
            className="font-mono uppercase tracking-widest mt-1"
            style={{ fontSize: 9, color: THEME.inkFaint }}
          >
            Step {step + 1} of {STEPS.length}
          </div>

          {/* Body content */}
          <div
            className="mt-4 text-sm"
            style={{ color: THEME.ink, lineHeight: 1.65 }}
          >
            {body}
          </div>
        </div>

        {/* Footer navigation */}
        <div
          className="flex items-center gap-2"
          style={{
            padding: '14px 24px',
            background: THEME.paper,
            borderTop: `1px solid ${THEME.border}`,
          }}
        >
          {!isLast && (
            <button
              className="btn btn-ghost"
              onClick={onClose}
              style={{ fontSize: 11, color: THEME.inkMuted }}
            >
              Skip tour
            </button>
          )}
          <div className="flex-1" />
          {!isFirst && (
            <button
              className="btn"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              <ChevronLeft size={12} /> Back
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={() => (isLast ? onClose() : setStep((s) => s + 1))}
          >
            {isLast ? (
              <>Done</>
            ) : (
              <>Next <ChevronRight size={12} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   DotIndicator
   ============================================================ */

function DotIndicator({ current, total }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          style={{
            width: i === current ? 14 : 6,
            height: 6,
            borderRadius: 3,
            background: i === current ? THEME.ink : THEME.border,
            transition: 'all 180ms ease',
          }}
        />
      ))}
    </div>
  );
}
