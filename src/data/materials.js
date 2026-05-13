/* ============================================================
   MATERIALS DATABASE
   ============================================================
   Nominal properties for protective-suit materials across three
   environment regimes. Order-of-magnitude values intended for
   screening only — verify against data sheets before design.

   Units:
     density   g/cc   (= kg/m³ / 1000)
     modulus   GPa
     strength  MPa    (tensile or yield, see notes)
     tMax      °C
     cost      ordinal  1=low, 2=med, 3=high, 4=very high
     chemRes   ordinal  1=poor, 2=fair, 3=good, 4=excellent
   ============================================================ */

export const ENVIRONMENTS = ['space', 'deep_sea', 'chemical'];

export const LAYERS = [
  'outer_shell', 'thermal', 'pressure_bladder',
  'inner_liner', 'gloves', 'helmet', 'seals_joints',
];

export const LAYER_LABEL = {
  outer_shell: 'Outer shell',
  thermal: 'Thermal',
  pressure_bladder: 'Pressure bladder',
  inner_liner: 'Inner liner',
  gloves: 'Gloves',
  helmet: 'Helmet (visor)',
  seals_joints: 'Seals / joints',
};

export const ENV_LABEL = {
  space: 'Space',
  deep_sea: 'Deep sea',
  chemical: 'Chemical / CBRN',
};

/* Each material lists which suit layers it is plausibly suited for,
   based on the reference candidate set in the project brief. */

export const MATERIALS = [
  // ===== SPACE =====
  {
    id: 'vectran-ht', name: 'Vectran HT', family: 'High-performance fibre',
    environment: 'space', layers: ['outer_shell', 'pressure_bladder', 'gloves'],
    props: { density: 1.40, modulus: 75, strength: 3200, tMax: 330, cost: 3, chemRes: 2 },
    morphology: 'soft',
    notes: 'Excellent cut resistance.',
  },
  {
    id: 'kevlar-29', name: 'Kevlar 29', family: 'Aramid fibre',
    environment: 'space', layers: ['outer_shell', 'gloves'],
    props: { density: 1.44, modulus: 70, strength: 2900, tMax: 300, cost: 2, chemRes: 2 },
    morphology: 'soft',
    notes: 'UV degrades, requires cover layer.',
  },
  {
    id: 'nomex-iiia', name: 'Nomex IIIA', family: 'Aramid fibre',
    environment: 'space', layers: ['outer_shell', 'inner_liner'],
    props: { density: 1.38, modulus: 17, strength: 600, tMax: 370, cost: 2, chemRes: 2 },
    morphology: 'soft',
    notes: 'Chars on burn rather than melting.',
  },
  {
    id: 'gore-tex', name: 'Gore-Tex (ePTFE)', family: 'Membrane',
    environment: 'space', layers: ['pressure_bladder', 'inner_liner'],
    props: { density: 2.15, modulus: 0.5, strength: 30, tMax: 260, cost: 3, chemRes: 4 },
    morphology: 'soft',
    notes: 'Gas-permeable membrane, not a pressure barrier alone.',
  },
  {
    id: 'beta-cloth', name: 'Beta cloth', family: 'PTFE-coated fibreglass',
    environment: 'space', layers: ['outer_shell', 'thermal'],
    props: { density: 1.60, modulus: 5, strength: 200, tMax: 650, cost: 3, chemRes: 4 },
    morphology: 'semi_rigid',
    notes: 'MMOD-resistant outer, used on Apollo and ISS suits.',
  },
  {
    id: 'kapton', name: 'Kapton (polyimide)', family: 'Polyimide film',
    environment: 'space', layers: ['thermal'],
    props: { density: 1.42, modulus: 2.5, strength: 230, tMax: 400, cost: 3, chemRes: 3 },
    morphology: 'semi_rigid',
    notes: 'Wide thermal range, becomes brittle at cryogenic T.',
  },
  {
    id: 'mylar', name: 'Mylar (PET)', family: 'Aluminised film',
    environment: 'space', layers: ['thermal'],
    props: { density: 1.39, modulus: 4, strength: 200, tMax: 150, cost: 1, chemRes: 2 },
    morphology: 'semi_rigid',
    notes: 'Standard MLI film, low temperature ceiling.',
  },
  {
    id: 'polycarb-space', name: 'Polycarbonate', family: 'Thermoplastic',
    environment: 'space', layers: ['helmet'],
    props: { density: 1.20, modulus: 2.4, strength: 65, tMax: 135, cost: 1, chemRes: 1 },
    morphology: 'rigid',
    notes: 'High-impact visor, scratch coating required.',
  },
  {
    id: 'silica-aerogel', name: 'Silica aerogel', family: 'Ceramic foam',
    environment: 'space', layers: ['thermal'],
    props: { density: 0.10, modulus: 0.001, strength: 0.1, tMax: 600, cost: 4, chemRes: 3 },
    morphology: 'semi_rigid',
    notes: 'Lowest thermal conductivity solid, fragile, requires encapsulation.',
  },

  // ===== DEEP SEA =====
  {
    id: 'ti-6al-4v', name: 'Ti-6Al-4V', family: 'Titanium alloy',
    environment: 'deep_sea', layers: ['outer_shell', 'helmet', 'seals_joints'],
    props: { density: 4.43, modulus: 114, strength: 880, tMax: 400, cost: 4, chemRes: 4 },
    morphology: 'rigid', galvanicGroup: 'Q',
    notes: 'Hard suit shell, exceptional seawater corrosion resistance.',
  },
  {
    id: 'al-bronze', name: 'Aluminium-bronze', family: 'Cu-Al alloy',
    environment: 'deep_sea', layers: ['outer_shell', 'seals_joints'],
    props: { density: 7.70, modulus: 120, strength: 380, tMax: 400, cost: 2, chemRes: 4 },
    morphology: 'rigid', galvanicGroup: 'N',
    notes: 'Proven in saturation diving hulls and ROV joints.',
  },
  {
    id: 'inconel-718', name: 'Inconel 718', family: 'Ni-superalloy',
    environment: 'deep_sea', layers: ['seals_joints'],
    props: { density: 8.19, modulus: 200, strength: 1100, tMax: 700, cost: 4, chemRes: 4 },
    morphology: 'rigid', galvanicGroup: 'P',
    notes: 'Bearings and high-load joints, expensive.',
  },
  {
    id: 'syntactic-foam', name: 'Syntactic foam', family: 'Composite',
    environment: 'deep_sea', layers: ['thermal'],
    props: { density: 0.70, modulus: 4, strength: 70, tMax: 80, cost: 3, chemRes: 3 },
    morphology: 'rigid',
    notes: 'Buoyancy and thermal stand-off, depth-rated grades only.',
  },
  {
    id: 'neoprene', name: 'Neoprene', family: 'Polychloroprene rubber',
    environment: 'deep_sea', layers: ['inner_liner', 'gloves'],
    props: { density: 1.23, modulus: 0.005, strength: 25, tMax: 120, cost: 1, chemRes: 2 },
    morphology: 'soft',
    notes: 'Wetsuit material, compresses with depth.',
  },
  {
    id: 'butyl-rubber', name: 'Butyl rubber', family: 'Synthetic rubber',
    environment: 'deep_sea', layers: ['pressure_bladder', 'inner_liner'],
    props: { density: 0.92, modulus: 0.003, strength: 17, tMax: 100, cost: 2, chemRes: 3 },
    morphology: 'soft',
    notes: 'Outstanding gas barrier, drysuit base.',
  },
  {
    id: 'trilaminate', name: 'Trilaminate (butyl)', family: 'Laminated fabric',
    environment: 'deep_sea', layers: ['outer_shell'],
    props: { density: 1.10, modulus: 0.4, strength: 50, tMax: 100, cost: 2, chemRes: 3 },
    morphology: 'semi_rigid',
    notes: 'Cordura/butyl/nylon drysuit shell.',
  },
  {
    id: 'pmma', name: 'PMMA acrylic', family: 'Thermoplastic',
    environment: 'deep_sea', layers: ['helmet'],
    props: { density: 1.18, modulus: 3.3, strength: 70, tMax: 80, cost: 1, chemRes: 2 },
    morphology: 'rigid',
    notes: 'Submersible viewports, depth-tested.',
  },
  {
    id: 'borosilicate', name: 'Borosilicate glass', family: 'Glass',
    environment: 'deep_sea', layers: ['helmet'],
    props: { density: 2.23, modulus: 64, strength: 70, tMax: 500, cost: 2, chemRes: 4 },
    morphology: 'rigid',
    notes: 'Scratch-resistant viewports.',
  },

  // ===== CHEMICAL =====
  {
    id: 'ptfe', name: 'PTFE', family: 'Fluoropolymer',
    environment: 'chemical', layers: ['outer_shell', 'inner_liner', 'seals_joints'],
    props: { density: 2.20, modulus: 0.5, strength: 25, tMax: 260, cost: 3, chemRes: 4 },
    morphology: 'semi_rigid',
    notes: 'Universal chemical resistance, low mechanical strength.',
  },
  {
    id: 'fep', name: 'FEP', family: 'Fluoropolymer',
    environment: 'chemical', layers: ['outer_shell', 'helmet'],
    props: { density: 2.15, modulus: 0.6, strength: 23, tMax: 200, cost: 3, chemRes: 4 },
    morphology: 'semi_rigid',
    notes: 'Optically clear PTFE alternative, lower T ceiling.',
  },
  {
    id: 'viton-fkm', name: 'Viton (FKM)', family: 'Fluoroelastomer',
    environment: 'chemical', layers: ['seals_joints'],
    props: { density: 1.85, modulus: 0.01, strength: 14, tMax: 200, cost: 3, chemRes: 4 },
    morphology: 'soft',
    notes: 'Broad-spectrum chemical seal, not for ketones or amines.',
  },
  {
    id: 'ffkm', name: 'FFKM', family: 'Perfluoroelastomer',
    environment: 'chemical', layers: ['seals_joints'],
    props: { density: 1.90, modulus: 0.01, strength: 16, tMax: 325, cost: 4, chemRes: 4 },
    morphology: 'soft',
    notes: 'Aggressive chemical service, very high cost.',
  },
  {
    id: 'tychem-6000', name: 'Tychem 6000', family: 'Laminate',
    environment: 'chemical', layers: ['outer_shell'],
    props: { density: 1.30, modulus: 0.3, strength: 30, tMax: 80, cost: 2, chemRes: 4 },
    morphology: 'semi_rigid',
    notes: 'Hazmat barrier laminate, single-use grade common.',
  },
  {
    id: 'saranex', name: 'Saranex', family: 'PVDC laminate film',
    environment: 'chemical', layers: ['inner_liner'],
    props: { density: 1.30, modulus: 0.5, strength: 30, tMax: 80, cost: 2, chemRes: 3 },
    morphology: 'semi_rigid',
    notes: 'Inner barrier film for vapour permeation.',
  },
  {
    id: 'cpe', name: 'Chlorinated PE', family: 'Chlorinated polymer',
    environment: 'chemical', layers: ['inner_liner'],
    props: { density: 1.25, modulus: 0.4, strength: 25, tMax: 100, cost: 1, chemRes: 3 },
    morphology: 'semi_rigid',
    notes: 'Chemical liner, moderate flexibility.',
  },

  /* ===== COMPOSITES (cross-environment) ===== */
  {
    id: 'cfrp-ud', name: 'CFRP (UD laminate)', family: 'Carbon fibre composite',
    environments: ['space', 'deep_sea'], layers: ['outer_shell', 'helmet', 'pressure_bladder'],
    props: { density: 1.60, modulus: 135, strength: 1500, tMax: 200, cost: 4, chemRes: 3 },
    morphology: 'rigid', galvanicGroup: 'T',
    notes: 'Properties along fibre direction; transverse modulus is far lower.',
  },
  {
    id: 'cfrp-woven', name: 'CFRP (woven)', family: 'Carbon fibre composite',
    environments: ['space', 'deep_sea'], layers: ['outer_shell', 'helmet'],
    props: { density: 1.55, modulus: 70, strength: 600, tMax: 200, cost: 4, chemRes: 3 },
    morphology: 'rigid', galvanicGroup: 'T',
    notes: 'Quasi-isotropic in-plane, lower stiffness than UD laminates.',
  },
  {
    id: 'gfrp', name: 'GFRP (E-glass/epoxy)', family: 'Glass fibre composite',
    environments: ['space', 'deep_sea', 'chemical'], layers: ['outer_shell', 'pressure_bladder'],
    props: { density: 2.00, modulus: 35, strength: 1000, tMax: 200, cost: 2, chemRes: 3 },
    morphology: 'rigid',
    notes: 'Lower stiffness than carbon, much cheaper, electrically insulating.',
  },
  {
    id: 'aramid-epoxy', name: 'Aramid-epoxy', family: 'Aramid composite',
    environments: ['space'], layers: ['outer_shell', 'helmet'],
    props: { density: 1.40, modulus: 30, strength: 1400, tMax: 180, cost: 3, chemRes: 3 },
    morphology: 'rigid',
    notes: 'High specific strength, poor compressive performance.',
  },

  /* ===== STRUCTURAL CERAMICS ===== */
  {
    id: 'alumina', name: 'Alumina (Al₂O₃)', family: 'Oxide ceramic',
    environments: ['space', 'chemical'], layers: ['helmet', 'seals_joints'],
    props: { density: 3.95, modulus: 380, strength: 350, tMax: 1700, cost: 2, chemRes: 4 },
    morphology: 'rigid',
    notes: 'Strength is flexural; low fracture toughness, brittle failure.',
  },
  {
    id: 'zirconia', name: 'Zirconia (YSZ)', family: 'Oxide ceramic',
    environments: ['space', 'chemical'], layers: ['thermal', 'seals_joints'],
    props: { density: 6.00, modulus: 200, strength: 900, tMax: 1500, cost: 3, chemRes: 4 },
    morphology: 'rigid',
    notes: 'Tougher than alumina, common as thermal-barrier coating.',
  },
  {
    id: 'sic', name: 'Silicon carbide (SiC)', family: 'Non-oxide ceramic',
    environments: ['space', 'chemical'], layers: ['helmet', 'thermal'],
    props: { density: 3.20, modulus: 410, strength: 450, tMax: 1600, cost: 3, chemRes: 4 },
    morphology: 'rigid',
    notes: 'High thermal conductivity for a ceramic, used in armour and optics.',
  },
  {
    id: 'b4c', name: 'Boron carbide (B₄C)', family: 'Non-oxide ceramic',
    environments: ['space'], layers: ['outer_shell', 'helmet'],
    props: { density: 2.50, modulus: 460, strength: 350, tMax: 1500, cost: 3, chemRes: 4 },
    morphology: 'rigid',
    notes: 'Hardest mass-produced ceramic, ballistic and MMOD shielding.',
  },

  /* ===== ADVANCED ELASTOMERS ===== */
  {
    id: 'silicone', name: 'Silicone rubber', family: 'Silicone elastomer',
    environments: ['space', 'chemical'], layers: ['seals_joints', 'inner_liner', 'gloves'],
    props: { density: 1.20, modulus: 0.005, strength: 10, tMax: 250, cost: 2, chemRes: 3 },
    morphology: 'soft',
    notes: 'Wide service temperature, poor abrasion resistance.',
  },
  {
    id: 'epdm', name: 'EPDM rubber', family: 'Synthetic elastomer',
    environments: ['chemical'], layers: ['seals_joints', 'inner_liner'],
    props: { density: 0.90, modulus: 0.005, strength: 17, tMax: 130, cost: 1, chemRes: 3 },
    morphology: 'soft',
    notes: 'Excellent ozone and weathering resistance, poor for hydrocarbons.',
  },
  {
    id: 'tpu', name: 'Polyurethane (TPU)', family: 'Thermoplastic elastomer',
    environments: ['space', 'deep_sea'], layers: ['pressure_bladder', 'inner_liner'],
    props: { density: 1.20, modulus: 0.05, strength: 50, tMax: 100, cost: 2, chemRes: 2 },
    morphology: 'semi_rigid',
    notes: 'Tough, abrasion-resistant, common pressure-bladder coating.',
  },

  /* ===== LIGHT ALLOYS (avionics, structures) ===== */
  {
    id: 'al-6061', name: 'Aluminium 6061-T6', family: 'Aluminium alloy',
    environments: ['space', 'deep_sea'], layers: ['outer_shell', 'helmet', 'seals_joints'],
    props: { density: 2.70, modulus: 69, strength: 310, tMax: 200, cost: 1, chemRes: 2 },
    morphology: 'rigid', galvanicGroup: 'D',
    notes: 'General-purpose structural aluminium, weldable, anodisable.',
  },
  {
    id: 'al-7075', name: 'Aluminium 7075-T6', family: 'Aluminium alloy',
    environments: ['space'], layers: ['outer_shell', 'seals_joints'],
    props: { density: 2.81, modulus: 72, strength: 570, tMax: 180, cost: 2, chemRes: 1 },
    morphology: 'rigid', galvanicGroup: 'E',
    notes: 'High strength aerospace grade, susceptible to stress corrosion.',
  },
  {
    id: 'mg-az31', name: 'Magnesium AZ31', family: 'Magnesium alloy',
    environments: ['space'], layers: ['outer_shell'],
    props: { density: 1.78, modulus: 45, strength: 260, tMax: 200, cost: 2, chemRes: 1 },
    morphology: 'rigid', galvanicGroup: 'A',
    notes: 'Lowest-density structural metal, galvanic corrosion risk.',
  },
  {
    id: 'cu-c101', name: 'Copper C101', family: 'Copper alloy',
    environments: ['space', 'deep_sea'], layers: ['thermal', 'seals_joints'],
    props: { density: 8.94, modulus: 117, strength: 220, tMax: 400, cost: 2, chemRes: 3 },
    morphology: 'rigid', galvanicGroup: 'N',
    notes: 'High thermal and electrical conductivity, soft.',
  },
];

/* ============================================================
   Helper: a material may declare a single primary environment
   (string) OR a list of plausible environments (array). Cross-
   regime materials like CFRP belong in several blocks at once.
   ============================================================ */

export function matchesEnvironment(material, env) {
  if (Array.isArray(material.environments)) {
    return material.environments.includes(env);
  }
  return material.environment === env;
}

/* ============================================================
   Generate a synthetic property cluster around a nominal point
   for chart hull rendering. Deterministic — same material always
   produces the same cluster, so the chart is stable across renders.
   ============================================================ */

export function clusterPoints(material, xKey, yKey, n = 7, frac = 0.10) {
  const x0 = material.props[xKey];
  const y0 = material.props[yKey];
  if (!Number.isFinite(x0) || !Number.isFinite(y0) || x0 <= 0 || y0 <= 0) {
    return [];
  }
  // Hash the id for a deterministic seed
  let seed = 0;
  for (let i = 0; i < material.id.length; i++) seed = (seed * 31 + material.id.charCodeAt(i)) >>> 0;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI + rng() * 0.4;
    const r = frac * (0.5 + 0.5 * rng());
    pts.push([x0 * Math.exp(Math.cos(a) * r), y0 * Math.exp(Math.sin(a) * r)]);
  }
  return pts;
}

/* ============================================================
   Property metadata for axes and ranking criteria.
   `beneficial: true` means higher is better (for TOPSIS).
   ============================================================ */

export const PROPERTY_META = {
  density:  { label: 'Density',          unit: 'g/cc', beneficial: false, axis: true },
  modulus:  { label: "Young's modulus",  unit: 'GPa',  beneficial: true,  axis: true },
  strength: { label: 'Tensile strength', unit: 'MPa',  beneficial: true,  axis: true },
  tMax:     { label: 'Max use temp',     unit: '°C',   beneficial: true,  axis: true },
  cost:     { label: 'Cost',             unit: '(1-4)', beneficial: false, axis: false },
  chemRes:  { label: 'Chemical resist.', unit: '(1-4)', beneficial: true,  axis: false },
};

/* ============================================================
   Default Y-axis property per layer, mirroring the brief.
   ============================================================ */

export const LAYER_DEFAULT_Y = {
  outer_shell: 'strength',
  thermal: 'tMax',
  pressure_bladder: 'strength',
  inner_liner: 'tMax',
  gloves: 'strength',
  helmet: 'modulus',
  seals_joints: 'tMax',
};

/* ============================================================
   Morphology metadata for kinematic filtering.
   ============================================================ */

export const MORPHOLOGIES = ['rigid', 'semi_rigid', 'soft'];

export const MORPHOLOGY_LABEL = {
  rigid: 'Rigid',
  semi_rigid: 'Semi-rigid',
  soft: 'Soft',
};

export const MORPHOLOGY_NOTE = {
  rigid: 'Hard shells, structural composites, ceramics, metals.',
  semi_rigid: 'Stiff films and laminates that flex but hold shape.',
  soft: 'Elastomers and woven fabrics for flexible joints and bladders.',
};

/* Components that require flexibility — kinematic constraint
   suggested by the project brief. Used to default-filter rigid
   materials out when designing dynamic joints, bladders, gloves. */

export const FLEXIBLE_LAYERS = new Set([
  'pressure_bladder', 'inner_liner', 'gloves', 'seals_joints',
]);
