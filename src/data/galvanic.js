/* ============================================================
   GALVANIC COMPATIBILITY (MIL-STD-889C)
   ============================================================
   Twenty anodic groups (A = magnesium, sacrificial → T = graphite,
   noble) with pair-wise compatibility per environment:
     G — same group, no galvanic concern
     C — compatible (negligible galvanic interaction bare)
     I — incompatible (significant galvanic corrosion bare)
   Surface treatment numbers (1–13) point into SURFACE_TREATMENTS,
   listing recommended coatings in descending order of effectivity.

   Data condensed from MIL-STD-889C, Table I and Appendix A.3.
   ============================================================ */

export const GALVANIC_GROUPS = {
  A: { label: 'A', name: 'Magnesium',                     note: 'most anodic, sacrificial' },
  B: { label: 'B', name: 'Zinc / zinc coating',           note: 'anodic' },
  C: { label: 'C', name: 'Cadmium, beryllium',            note: 'anodic' },
  D: { label: 'D', name: 'Aluminium (pure, Mg/Zn alloys)', note: 'anodic' },
  E: { label: 'E', name: 'Aluminium (Cu alloys: 2024, 7075)', note: 'anodic' },
  F: { label: 'F', name: 'Carbon and low-alloy steel',    note: 'mildly anodic' },
  G: { label: 'G', name: 'Lead',                          note: 'mildly anodic' },
  H: { label: 'H', name: 'Tin, tin-lead, indium',         note: 'mildly anodic' },
  I: { label: 'I', name: 'Stainless 400-series (martensitic/ferritic)', note: 'borderline' },
  J: { label: 'J', name: 'Chromium, molybdenum, tungsten', note: 'borderline' },
  K: { label: 'K', name: 'Stainless 300-series (austenitic, PH)', note: 'cathodic' },
  L: { label: 'L', name: 'Brass (Pb), bronze',            note: 'cathodic' },
  M: { label: 'M', name: 'Brass / bronze (low Cu)',       note: 'cathodic' },
  N: { label: 'N', name: 'Brass / bronze (high Cu), pure Cu', note: 'cathodic' },
  O: { label: 'O', name: 'Copper-nickel, Monel',          note: 'cathodic' },
  P: { label: 'P', name: 'Nickel, cobalt, Inconel',       note: 'cathodic' },
  Q: { label: 'Q', name: 'Titanium and titanium alloys',  note: 'noble' },
  R: { label: 'R', name: 'Silver',                        note: 'noble' },
  S: { label: 'S', name: 'Pd, Rh, Au, Pt',                note: 'most noble (precious)' },
  T: { label: 'T', name: 'Graphite, carbon fibre',        note: 'most cathodic, conductive composite' },
};

/* ============================================================
   PAIR_MATRIX — keyed as 'A-B' with the two letters sorted.
   Values: rating per environment, plus finish-group references.
     sea — submerged sea water
     mar — marine atmosphere (humid, saline)
     ind — industrial atmosphere (dry-ish, sheltered)
   fin: [groupA_finish, groupB_finish] — indices into SURFACE_TREATMENTS.
   ============================================================ */

export const PAIR_MATRIX = {
  'A-A':{sea:'G',mar:'G',ind:'G',fin:[1,1]},'A-B':{sea:'I',mar:'C',ind:'C',fin:[1,2]},
  'A-C':{sea:'I',mar:'C',ind:'C',fin:[1,3]},'A-D':{sea:'I',mar:'I',ind:'I',fin:[1,4]},
  'A-E':{sea:'I',mar:'I',ind:'I',fin:[1,4]},'A-F':{sea:'I',mar:'I',ind:'I',fin:[1,5]},
  'A-G':{sea:'I',mar:'I',ind:'I',fin:[1,6]},'A-H':{sea:'I',mar:'I',ind:'I',fin:[1,6]},
  'A-I':{sea:'I',mar:'I',ind:'I',fin:[1,7]},'A-J':{sea:'I',mar:'I',ind:'I',fin:[1,8]},
  'A-K':{sea:'I',mar:'I',ind:'I',fin:[1,9]},'A-L':{sea:'I',mar:'I',ind:'I',fin:[1,9]},
  'A-M':{sea:'I',mar:'I',ind:'I',fin:[1,9]},'A-N':{sea:'I',mar:'I',ind:'I',fin:[1,9]},
  'A-O':{sea:'I',mar:'I',ind:'I',fin:[1,9]},'A-P':{sea:'I',mar:'I',ind:'I',fin:[1,9]},
  'A-Q':{sea:'I',mar:'I',ind:'I',fin:[1,10]},'A-R':{sea:'I',mar:'I',ind:'I',fin:[1,11]},
  'A-S':{sea:'I',mar:'I',ind:'I',fin:[1,12]},'A-T':{sea:'I',mar:'I',ind:'I',fin:[1,13]},
  'B-B':{sea:'G',mar:'G',ind:'G',fin:[2,2]},'B-C':{sea:'C',mar:'C',ind:'C',fin:[2,3]},
  'B-D':{sea:'I',mar:'C',ind:'C',fin:[2,4]},'B-E':{sea:'I',mar:'C',ind:'C',fin:[2,4]},
  'B-F':{sea:'I',mar:'I',ind:'I',fin:[2,5]},'B-G':{sea:'I',mar:'I',ind:'I',fin:[2,6]},
  'B-H':{sea:'I',mar:'I',ind:'I',fin:[2,6]},'B-I':{sea:'I',mar:'I',ind:'I',fin:[2,7]},
  'B-J':{sea:'I',mar:'I',ind:'I',fin:[2,8]},'B-K':{sea:'I',mar:'I',ind:'I',fin:[2,9]},
  'B-L':{sea:'I',mar:'I',ind:'I',fin:[2,9]},'B-M':{sea:'I',mar:'I',ind:'I',fin:[2,9]},
  'B-N':{sea:'I',mar:'I',ind:'I',fin:[2,9]},'B-O':{sea:'I',mar:'I',ind:'I',fin:[2,9]},
  'B-P':{sea:'I',mar:'I',ind:'I',fin:[2,9]},'B-Q':{sea:'I',mar:'I',ind:'I',fin:[2,10]},
  'B-R':{sea:'I',mar:'I',ind:'I',fin:[2,11]},'B-S':{sea:'I',mar:'I',ind:'I',fin:[2,12]},
  'B-T':{sea:'I',mar:'I',ind:'I',fin:[2,13]},'C-C':{sea:'G',mar:'G',ind:'G',fin:[3,3]},
  'C-D':{sea:'I',mar:'C',ind:'C',fin:[3,4]},'C-E':{sea:'I',mar:'C',ind:'C',fin:[3,4]},
  'C-F':{sea:'I',mar:'I',ind:'I',fin:[3,5]},'C-G':{sea:'I',mar:'I',ind:'I',fin:[3,6]},
  'C-H':{sea:'I',mar:'I',ind:'I',fin:[3,6]},'C-I':{sea:'I',mar:'I',ind:'I',fin:[3,7]},
  'C-J':{sea:'I',mar:'I',ind:'I',fin:[3,8]},'C-K':{sea:'I',mar:'I',ind:'I',fin:[3,9]},
  'C-L':{sea:'I',mar:'I',ind:'I',fin:[3,9]},'C-M':{sea:'I',mar:'I',ind:'I',fin:[3,9]},
  'C-N':{sea:'I',mar:'I',ind:'I',fin:[3,9]},'C-O':{sea:'I',mar:'I',ind:'I',fin:[3,9]},
  'C-P':{sea:'I',mar:'I',ind:'I',fin:[3,9]},'C-Q':{sea:'I',mar:'I',ind:'I',fin:[3,10]},
  'C-R':{sea:'I',mar:'I',ind:'I',fin:[3,11]},'C-S':{sea:'I',mar:'I',ind:'I',fin:[3,12]},
  'C-T':{sea:'I',mar:'I',ind:'I',fin:[3,13]},'D-D':{sea:'G',mar:'G',ind:'G',fin:[4,4]},
  'D-E':{sea:'C',mar:'C',ind:'C',fin:[4,4]},'D-F':{sea:'I',mar:'I',ind:'I',fin:[4,5]},
  'D-G':{sea:'I',mar:'I',ind:'I',fin:[4,6]},'D-H':{sea:'I',mar:'I',ind:'I',fin:[4,6]},
  'D-I':{sea:'I',mar:'I',ind:'I',fin:[4,7]},'D-J':{sea:'I',mar:'I',ind:'I',fin:[4,8]},
  'D-K':{sea:'I',mar:'I',ind:'I',fin:[4,9]},'D-L':{sea:'I',mar:'I',ind:'I',fin:[4,9]},
  'D-M':{sea:'I',mar:'I',ind:'I',fin:[4,9]},'D-N':{sea:'I',mar:'I',ind:'I',fin:[4,9]},
  'D-O':{sea:'I',mar:'I',ind:'I',fin:[4,9]},'D-P':{sea:'I',mar:'I',ind:'I',fin:[4,9]},
  'D-Q':{sea:'I',mar:'I',ind:'I',fin:[4,10]},'D-R':{sea:'I',mar:'I',ind:'I',fin:[4,11]},
  'D-S':{sea:'I',mar:'I',ind:'I',fin:[4,12]},'D-T':{sea:'I',mar:'I',ind:'I',fin:[4,13]},
  'E-E':{sea:'G',mar:'G',ind:'G',fin:[4,4]},'E-F':{sea:'I',mar:'I',ind:'I',fin:[4,5]},
  'E-G':{sea:'I',mar:'I',ind:'I',fin:[4,6]},'E-H':{sea:'I',mar:'I',ind:'I',fin:[4,6]},
  'E-I':{sea:'I',mar:'I',ind:'I',fin:[4,7]},'E-J':{sea:'I',mar:'I',ind:'I',fin:[4,8]},
  'E-K':{sea:'I',mar:'I',ind:'I',fin:[4,9]},'E-L':{sea:'I',mar:'I',ind:'I',fin:[4,9]},
  'E-M':{sea:'I',mar:'I',ind:'I',fin:[4,9]},'E-N':{sea:'I',mar:'I',ind:'I',fin:[4,9]},
  'E-O':{sea:'I',mar:'I',ind:'I',fin:[4,9]},'E-P':{sea:'I',mar:'I',ind:'I',fin:[4,9]},
  'E-Q':{sea:'I',mar:'I',ind:'I',fin:[4,10]},'E-R':{sea:'I',mar:'I',ind:'I',fin:[4,11]},
  'E-S':{sea:'I',mar:'I',ind:'I',fin:[4,12]},'E-T':{sea:'I',mar:'I',ind:'I',fin:[4,13]},
  'F-F':{sea:'G',mar:'G',ind:'G',fin:[5,5]},'F-G':{sea:'I',mar:'I',ind:'C',fin:[5,6]},
  'F-H':{sea:'I',mar:'I',ind:'I',fin:[5,5]},'F-I':{sea:'I',mar:'I',ind:'I',fin:[5,7]},
  'F-J':{sea:'I',mar:'I',ind:'I',fin:[5,8]},'F-K':{sea:'I',mar:'I',ind:'I',fin:[5,9]},
  'F-L':{sea:'I',mar:'I',ind:'I',fin:[5,9]},'F-M':{sea:'I',mar:'I',ind:'I',fin:[5,9]},
  'F-N':{sea:'I',mar:'I',ind:'I',fin:[5,9]},'F-O':{sea:'I',mar:'I',ind:'I',fin:[5,9]},
  'F-P':{sea:'I',mar:'C',ind:'C',fin:[5,9]},'F-Q':{sea:'I',mar:'I',ind:'I',fin:[5,10]},
  'F-R':{sea:'I',mar:'I',ind:'I',fin:[5,11]},'F-S':{sea:'I',mar:'I',ind:'I',fin:[5,12]},
  'F-T':{sea:'I',mar:'I',ind:'I',fin:[5,13]},'G-G':{sea:'G',mar:'G',ind:'G',fin:[6,6]},
  'G-H':{sea:'C',mar:'C',ind:'C',fin:[6,6]},'G-I':{sea:'I',mar:'C',ind:'C',fin:[6,7]},
  'G-J':{sea:'I',mar:'C',ind:'C',fin:[6,8]},'G-K':{sea:'I',mar:'C',ind:'C',fin:[6,9]},
  'G-L':{sea:'I',mar:'C',ind:'C',fin:[6,9]},'G-M':{sea:'I',mar:'I',ind:'I',fin:[6,9]},
  'G-N':{sea:'I',mar:'I',ind:'C',fin:[6,9]},'G-O':{sea:'I',mar:'I',ind:'C',fin:[6,9]},
  'G-P':{sea:'I',mar:'I',ind:'C',fin:[6,9]},'G-Q':{sea:'I',mar:'I',ind:'C',fin:[6,10]},
  'G-R':{sea:'I',mar:'C',ind:'C',fin:[6,11]},'G-S':{sea:'I',mar:'I',ind:'C',fin:[6,12]},
  'G-T':{sea:'I',mar:'I',ind:'C',fin:[6,13]},'H-H':{sea:'G',mar:'G',ind:'G',fin:[6,6]},
  'H-I':{sea:'I',mar:'I',ind:'I',fin:[6,7]},'H-J':{sea:'I',mar:'I',ind:'C',fin:[6,8]},
  'H-K':{sea:'I',mar:'I',ind:'C',fin:[6,9]},'H-L':{sea:'I',mar:'C',ind:'C',fin:[6,9]},
  'H-M':{sea:'I',mar:'C',ind:'C',fin:[6,9]},'H-N':{sea:'I',mar:'C',ind:'C',fin:[6,9]},
  'H-O':{sea:'I',mar:'C',ind:'C',fin:[6,9]},'H-P':{sea:'C',mar:'C',ind:'C',fin:[6,9]},
  'H-Q':{sea:'I',mar:'C',ind:'C',fin:[6,10]},'H-R':{sea:'C',mar:'C',ind:'C',fin:[6,11]},
  'H-S':{sea:'I',mar:'I',ind:'I',fin:[6,12]},'H-T':{sea:'I',mar:'I',ind:'I',fin:[6,13]},
  'I-I':{sea:'G',mar:'G',ind:'G',fin:[7,7]},'I-J':{sea:'I',mar:'I',ind:'C',fin:[7,8]},
  'I-K':{sea:'I',mar:'I',ind:'I',fin:[7,9]},'I-L':{sea:'I',mar:'I',ind:'I',fin:[7,9]},
  'I-M':{sea:'I',mar:'I',ind:'C',fin:[7,9]},'I-N':{sea:'I',mar:'I',ind:'I',fin:[7,9]},
  'I-O':{sea:'I',mar:'I',ind:'I',fin:[7,9]},'I-P':{sea:'I',mar:'I',ind:'I',fin:[7,9]},
  'I-Q':{sea:'I',mar:'I',ind:'I',fin:[7,10]},'I-R':{sea:'I',mar:'I',ind:'I',fin:[7,11]},
  'I-S':{sea:'I',mar:'I',ind:'I',fin:[7,12]},'I-T':{sea:'I',mar:'I',ind:'I',fin:[7,13]},
  'J-J':{sea:'G',mar:'G',ind:'G',fin:[8,8]},'J-K':{sea:'C',mar:'C',ind:'C',fin:[8,9]},
  'J-L':{sea:'I',mar:'C',ind:'C',fin:[8,9]},'J-M':{sea:'I',mar:'I',ind:'C',fin:[8,9]},
  'J-N':{sea:'I',mar:'I',ind:'I',fin:[8,9]},'J-O':{sea:'I',mar:'C',ind:'C',fin:[8,9]},
  'J-P':{sea:'I',mar:'C',ind:'C',fin:[8,9]},'J-Q':{sea:'I',mar:'C',ind:'C',fin:[8,10]},
  'J-R':{sea:'I',mar:'C',ind:'C',fin:[8,11]},'J-S':{sea:'I',mar:'C',ind:'C',fin:[8,12]},
  'J-T':{sea:'I',mar:'C',ind:'C',fin:[8,13]},'K-K':{sea:'G',mar:'G',ind:'G',fin:[9,9]},
  'K-L':{sea:'I',mar:'I',ind:'I',fin:[9,9]},'K-M':{sea:'I',mar:'I',ind:'I',fin:[9,9]},
  'K-N':{sea:'I',mar:'I',ind:'I',fin:[9,9]},'K-O':{sea:'I',mar:'C',ind:'C',fin:[9,9]},
  'K-P':{sea:'I',mar:'C',ind:'C',fin:[9,9]},'K-Q':{sea:'I',mar:'C',ind:'C',fin:[9,10]},
  'K-R':{sea:'I',mar:'C',ind:'C',fin:[9,11]},'K-S':{sea:'I',mar:'C',ind:'C',fin:[9,12]},
  'K-T':{sea:'I',mar:'C',ind:'C',fin:[9,13]},'L-L':{sea:'G',mar:'G',ind:'G',fin:[9,9]},
  'L-M':{sea:'I',mar:'C',ind:'C',fin:[9,9]},'L-N':{sea:'I',mar:'C',ind:'C',fin:[9,9]},
  'L-O':{sea:'I',mar:'I',ind:'C',fin:[9,9]},'L-P':{sea:'I',mar:'C',ind:'C',fin:[9,9]},
  'L-Q':{sea:'I',mar:'I',ind:'C',fin:[9,10]},'L-R':{sea:'I',mar:'C',ind:'C',fin:[9,11]},
  'L-S':{sea:'I',mar:'C',ind:'C',fin:[9,12]},'L-T':{sea:'I',mar:'C',ind:'C',fin:[9,13]},
  'M-M':{sea:'G',mar:'G',ind:'G',fin:[9,9]},'M-N':{sea:'I',mar:'C',ind:'C',fin:[9,9]},
  'M-O':{sea:'I',mar:'C',ind:'C',fin:[9,9]},'M-P':{sea:'I',mar:'C',ind:'C',fin:[9,9]},
  'M-Q':{sea:'I',mar:'I',ind:'C',fin:[9,10]},'M-R':{sea:'I',mar:'C',ind:'C',fin:[9,11]},
  'M-S':{sea:'I',mar:'I',ind:'C',fin:[9,12]},'M-T':{sea:'I',mar:'I',ind:'C',fin:[9,13]},
  'N-N':{sea:'G',mar:'G',ind:'G',fin:[9,9]},'N-O':{sea:'I',mar:'I',ind:'C',fin:[9,9]},
  'N-P':{sea:'I',mar:'C',ind:'C',fin:[9,9]},'N-Q':{sea:'I',mar:'I',ind:'C',fin:[9,10]},
  'N-R':{sea:'I',mar:'C',ind:'C',fin:[9,11]},'N-S':{sea:'I',mar:'I',ind:'C',fin:[9,12]},
  'N-T':{sea:'I',mar:'I',ind:'C',fin:[9,13]},'O-O':{sea:'G',mar:'G',ind:'G',fin:[9,9]},
  'O-P':{sea:'I',mar:'C',ind:'C',fin:[9,9]},'O-Q':{sea:'I',mar:'C',ind:'C',fin:[9,10]},
  'O-R':{sea:'I',mar:'C',ind:'C',fin:[9,11]},'O-S':{sea:'I',mar:'C',ind:'C',fin:[9,12]},
  'O-T':{sea:'I',mar:'C',ind:'C',fin:[9,13]},'P-P':{sea:'G',mar:'G',ind:'G',fin:[9,9]},
  'P-Q':{sea:'I',mar:'C',ind:'C',fin:[9,10]},'P-R':{sea:'I',mar:'C',ind:'C',fin:[9,11]},
  'P-S':{sea:'I',mar:'C',ind:'C',fin:[9,12]},'P-T':{sea:'I',mar:'C',ind:'C',fin:[9,13]},
  'Q-Q':{sea:'G',mar:'G',ind:'G',fin:[10,10]},'Q-R':{sea:'I',mar:'C',ind:'C',fin:[10,11]},
  'Q-S':{sea:'I',mar:'C',ind:'C',fin:[10,12]},'Q-T':{sea:'I',mar:'C',ind:'C',fin:[10,13]},
  'R-R':{sea:'G',mar:'G',ind:'G',fin:[11,11]},'R-S':{sea:'C',mar:'C',ind:'C',fin:[11,12]},
  'R-T':{sea:'I',mar:'C',ind:'C',fin:[11,13]},'S-S':{sea:'G',mar:'G',ind:'G',fin:[12,12]},
  'S-T':{sea:'C',mar:'C',ind:'C',fin:[12,13]},'T-T':{sea:'G',mar:'G',ind:'G',fin:[13,13]},
};

/* ============================================================
   SURFACE_TREATMENTS — MIL-STD-889C, Appendix A.3
   Coatings listed in descending order of effectivity.
   ============================================================ */

export const SURFACE_TREATMENTS = {
  1: { for: 'Magnesium', coatings: [
    'Anodic coating (ASTM D1732) post-treated with alkali-resistant paint or resin.',
    'Chromate conversion coating (SAE AMS-M-3171) post-treated with paint or resin. Alternate: anodic coating without organic top-coat.',
    'Electroless nickel (SAE AMS-C-26074) with cadmium overplating, for electrical/thermal conduction in dry conditions.',
    'Chromate treatment, in assured condensation-free, acid-free service.',
  ], notes: ['Bare magnesium should not be used.'] },
  2: { for: 'Zinc / Zn coating', coatings: [
    'Anodic coating post-treated with paint or resin (primarily for castings).',
    'Chromate conversion (MIL-C-17711) post-treated with paint or resin; or anodic coating only for non-persistent wet conditions.',
    'Chromate conversion coating without organic top-coat.',
  ], notes: ['Bare or plated zinc should not be used in marine environments.'] },
  3: { for: 'Cadmium, beryllium', coatings: [
    'Chromate conversion coating (SAE AMS-QQ-P-416 / AMS-C-8837 / AMS-C-81562) with paint or resin top-coat.',
    'Chromate conversion alone, in mild non-persistent wet atmosphere or for thermal/electrical conduction.',
  ], notes: ['For Be at high temperature, chromate conversion is recommended to mitigate catastrophic oxidation.'] },
  4: { for: 'Aluminium alloys', coatings: [
    'Anodic coating (MIL-A-8625) with paint or resin top-coat.',
    'Chromate conversion (MIL-DTL-5541) with paint or resin; or sealed anodic coating. For porous castings: resin-impregnate before treatment.',
    'Chromate conversion without organic top-coat, for thermal/electrical conduction in mild conditions.',
    'Bare aluminium acceptable only when treatment would interfere with function and conditions are dry. Seal faying edges to prevent crevice corrosion.',
  ], notes: [] },
  5: { for: 'Carbon and low-alloy steel', coatings: [
    'Sacrificial metallic coating (Zn or Cd) with passivation, or non-sacrificial (Cu, Ni), plus paint/resin top-coat. For steels > 220 ksi use non-electrolytic deposition.',
    'Metallic coating without paint, for direct contact / minimum potential difference. Avoid electrolytic plating for steels > 220 ksi.',
    'Zinc phosphate (TT-C-490) with paint/resin. Stress relief required before phosphating for 150–220 ksi steels; prohibited above 220 ksi.',
    'Pretreatment primer (MIL-C-8514) with paint/resin top-coat.',
    'Heavy phosphate conversion (MIL-DTL-16232) with supplemental treatment.',
  ], notes: [] },
  6: { for: 'Lead / tin / indium', coatings: [
    'Apply paint or resin coating system. Electroplated coatings should be flowed before painting.',
    'Electroplate with another metal to reduce potential difference where direct electrical contact is required.',
  ], notes: ['These metals are commonly applied to other metals by hot-dipping, fusing, or plating.'] },
  7: { for: 'Stainless 400-series', coatings: [
    'Apply paint or resin coating system.',
    'May be plated or used bare in non-persistent wet/marine conditions; for electrical/thermal conduction. Seal faying edges to prevent crevice corrosion.',
  ], notes: ['~12% Cr stainlesses will stain and lightly rust in corrosive service; still far better than carbon steel.'] },
  8: { for: 'Cr, Mo, W', coatings: [
    'Paint/resin top-coat to reduce corrosion at chromium-plating voids or staining of Mo / W surfaces.',
    'Use bare for electrical, wear, or thermal conduction. Seal faying edges against crevice attack.',
  ], notes: [] },
  9: { for: 'Stainless 300-series / brass / bronze / Cu / Ni', coatings: [
    'Apply metallic coating to minimise potential difference, plus paint/resin top-coat. Reduces ion contamination onto more anodic neighbours.',
    'Metallic coating alone, for thermal/electrical conduction. Optionally overcoat assembly.',
    'Paint or resin coating with sealed faying edges.',
    'Use bare with sealed faying edges only when no more-anodic metal is in contact or runoff path.',
    'Select galvanically compatible metals at high temperature where metallic/organic coatings are impractical.',
  ], notes: [] },
  10: { for: 'Titanium', coatings: [
    'Anodise for anti-galling and wear resistance.',
    'Metallic coating (Cd, Zn prohibited; Ag-over-Ni acceptable) with paint/resin top-coat.',
    'Metallic coating with sealed faying edges, for electrical/thermal conduction.',
    'Bare titanium with sealed faying edges, against anything except Mg, Zn, Cd.',
  ], notes: [] },
  11: { for: 'Silver', coatings: [
    'Silver electrical contacts to be over-plated with Rh, Pd, or Au.',
    'May be used in stationary electrical assemblies (connectors, PCBs) under sulphur-free conformal coating.',
    'Apply chromate conversion with corrosion-inhibiting fluid film on plug/receptacle parts.',
  ], notes: [] },
  12: { for: 'Au, Pt, Pd, Rh', coatings: [
    'Use bare with sealant at faying edges, or envelope dissimilar metal joints in conformal coating.',
  ], notes: [] },
  13: { for: 'Graphite, carbon fibre', coatings: [
    'Plate graphite to minimise potential difference with the metal it contacts. Seal faying edges to prevent contact-surface corrosion. Apply conformal coating for electrical service.',
    'May be used bare for electrical or thermal conduction, conditions permitting. Seal faying edges.',
  ], notes: ['Critical for CFRP-aluminium joints — a classic aerospace galvanic failure mode.'] },
};

/* ============================================================
   ENVIRONMENT MAPPING
   ============================================================
   Our suit environments map to the closest MIL-STD column:
     space      → industrial (dry, sheltered, no electrolyte)
     deep_sea   → sea (submerged sea water)
     chemical   → marine (humid + saline/aggressive)
   ============================================================ */

export const ENV_TO_MIL = {
  space: 'ind',
  deep_sea: 'sea',
  chemical: 'mar',
};

export const MIL_ENV_LABEL = {
  sea: 'Sea water (submerged)',
  mar: 'Marine atmosphere',
  ind: 'Industrial atmosphere',
};

/* ============================================================
   API
   ============================================================
   compatibility(groupA, groupB, milEnv)
   Returns the rating and treatment refs for a pair under the
   chosen MIL environment column. Pass milEnv = 'sea' | 'mar' | 'ind'.

   Codes:
     'G' — same group (no concern)
     'C' — compatible
     'I' — incompatible
     null — at least one group missing (non-conductive)
   ============================================================ */

export function compatibility(groupA, groupB, milEnv = 'ind') {
  if (!groupA || !groupB) {
    return { rating: null, label: 'N/A (non-conductive)' };
  }
  const [a, b] = [groupA, groupB].sort();
  const entry = PAIR_MATRIX[`${a}-${b}`];
  if (!entry) return { rating: null, label: 'N/A' };
  const rating = entry[milEnv];
  return {
    rating,
    label: RATING_LABEL[rating] ?? rating,
    finishA: entry.fin[a === groupA ? 0 : 1],
    finishB: entry.fin[a === groupA ? 1 : 0],
    treatmentsA: SURFACE_TREATMENTS[entry.fin[a === groupA ? 0 : 1]],
    treatmentsB: SURFACE_TREATMENTS[entry.fin[a === groupA ? 1 : 0]],
  };
}

export const RATING_LABEL = {
  G: 'Same group',
  C: 'Compatible',
  I: 'Incompatible',
};

export const RATING_COLOR = {
  G: '#9C8F7A',  // neutral
  C: '#5C8C5F',  // muted green
  I: '#A04D55',  // muted red (our accent family)
};
