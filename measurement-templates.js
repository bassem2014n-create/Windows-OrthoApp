/* ===========================================================================
 * Guided measurements — the measurement LIBRARY (data only, no logic).
 *
 * To add a measurement: append one object to TEMPLATES. Nothing else needs to change.
 * (A brand-new KIND of calculation needs one function in guided-geometry.js → FUNCS.)
 *
 *   id, name, region, view          what it is and where it lives in the region/view selector
 *   unit                            'degrees' | 'mm' | 'ratio'
 *   points[]                        ordered taps → p1 … pN   { label, instruction }
 *   derived[]                       { id, op:'midpoint'|'circleCenter', of:[refs] }   (refs = pN or earlier ids)
 *   draw[]                          live drawing: {op:'segment'|'line', a, b, style?} {op:'circle', of} {op:'cross', ref}
 *                                   {op:'perp', through, to:[a,b]}
 *   compute                         { fn, …args } – see FUNCS in guided-geometry.js
 *   normal                          { min, max, text, on? }  (on:'dev' tests the deviation instead of the value)
 *   interpret[]                     first match wins: { if:{lt|lte|gt|gte}, text } or { else:true, text }
 *   signed, decimals, detail        formatting extras
 *   needsCalibration, needsSide     the UI asks for calibration / limb side first
 *
 * Image coordinates: y points DOWN. Directions (varus/valgus, volar/dorsal …) are derived from the anatomy of the
 * points the user taps, not from the image being left or right — except HKA, which needs the limb side.
 * ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MeasurementTemplates = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VIEWS = [
    { id: 'spine-ap',        region: 'Spine',    view: 'AP',               label: 'Spine – AP' },
    { id: 'hip-ap-pelvis',   region: 'Hip',      view: 'AP pelvis',        label: 'Hip – AP pelvis' },
    { id: 'knee-lateral',    region: 'Knee',     view: 'Lateral',          label: 'Knee – Lateral' },
    { id: 'knee-longleg-ap', region: 'Knee',     view: 'Long-leg AP',      label: 'Knee – Long-leg AP (standing)' },
    { id: 'foot-wb-ap',      region: 'Foot',     view: 'Weight-bearing AP', label: 'Foot – Weight-bearing AP' },
    { id: 'wrist-pa',        region: 'Wrist',    view: 'PA',               label: 'Wrist – PA' },
    { id: 'wrist-lateral',   region: 'Wrist',    view: 'Lateral',          label: 'Wrist – Lateral' },
    { id: 'shoulder-true-ap', region: 'Shoulder', view: 'True AP (Grashey)', label: 'Shoulder – True AP (Grashey)' },
  ];

  const HEAD = (n) => [
    { label: 'Femoral head – point 1', instruction: 'Tap point 1 on the contour of the femoral head.' },
    { label: 'Femoral head – point 2', instruction: 'Tap point 2 on the femoral-head contour, well apart from point 1.' },
    { label: 'Femoral head – point 3', instruction: 'Tap point 3 on the femoral-head contour – the three points define the head circle and its centre.' },
  ];

  const TEMPLATES = [
    /* ------------------------------------------------------------ SPINE – AP */
    {
      id: 'cobb', name: 'Cobb angle', region: 'Spine', view: 'AP', unit: 'degrees',
      points: [
        { label: 'Upper end-plate – left edge', instruction: 'Tap the LEFT edge of the superior end-plate of the upper end vertebra.' },
        { label: 'Upper end-plate – right edge', instruction: 'Tap the RIGHT edge of the superior end-plate of the upper end vertebra.' },
        { label: 'Lower end-plate – left edge', instruction: 'Tap the LEFT edge of the inferior end-plate of the lower end vertebra.' },
        { label: 'Lower end-plate – right edge', instruction: 'Tap the RIGHT edge of the inferior end-plate of the lower end vertebra.' },
      ],
      draw: [
        { op: 'line', a: 'p1', b: 'p2' },
        { op: 'line', a: 'p3', b: 'p4' },
      ],
      compute: { fn: 'angleBetweenLines', l1: ['p1', 'p2'], l2: ['p3', 'p4'] },
      normal: { max: 10, text: '< 10°' },
      interpret: [
        { if: { gte: 10 }, text: 'Scoliosis (Cobb ≥ 10°)' },
        { else: true, text: 'Below the scoliosis threshold' },
      ],
    },

    /* ------------------------------------------------------------ HIP – AP pelvis */
    {
      id: 'lcea', name: 'Lateral centre-edge angle (Wiberg)', region: 'Hip', view: 'AP pelvis', unit: 'degrees', needsSide: false,
      points: [
        ...HEAD(),
        { label: 'Lateral edge of sourcil', instruction: 'Tap the most LATERAL edge of the weight-bearing acetabular sourcil (roof) of the hip you are measuring.' },
        { label: 'Teardrop tip – this hip', instruction: 'Tap the inferior tip of the teardrop on the SAME side as the hip you are measuring.' },
        { label: 'Teardrop tip – opposite hip', instruction: 'Tap the inferior tip of the teardrop on the OPPOSITE side.' },
      ],
      derived: [{ id: 'hc', op: 'circleCenter', of: ['p1', 'p2', 'p3'] }],
      draw: [
        { op: 'circle', of: 'hc' },
        { op: 'cross', ref: 'hc' },
        { op: 'line', a: 'p5', b: 'p6', style: 'dashed' },
        { op: 'perp', through: 'hc', to: ['p5', 'p6'] },
        { op: 'segment', a: 'hc', b: 'p4' },
      ],
      compute: { fn: 'lcea', center: 'hc', edge: 'p4', ref: ['p5', 'p6'] },
      normal: { min: 25, max: 40, text: '25–40°' },
      interpret: [
        { if: { lt: 20 }, text: 'Hip dysplasia (LCEA < 20°)' },
        { if: { lt: 25 }, text: 'Borderline dysplasia (20–25°)' },
        { if: { gt: 40 }, text: 'Over-coverage / pincer morphology (> 40°)' },
        { else: true, text: 'Normal acetabular coverage' },
      ],
    },
    {
      id: 'tonnis', name: 'Tönnis angle (acetabular index)', region: 'Hip', view: 'AP pelvis', unit: 'degrees', signed: true,
      points: [
        { label: 'Medial edge of sourcil', instruction: 'Tap the MEDIAL edge of the weight-bearing acetabular sourcil (roof).' },
        { label: 'Lateral edge of sourcil', instruction: 'Tap the LATERAL edge of the weight-bearing acetabular sourcil.' },
        { label: 'Teardrop tip – this hip', instruction: 'Tap the inferior tip of the teardrop on the same side.' },
        { label: 'Teardrop tip – opposite hip', instruction: 'Tap the inferior tip of the teardrop on the opposite side.' },
      ],
      draw: [
        { op: 'segment', a: 'p1', b: 'p2' },
        { op: 'line', a: 'p3', b: 'p4', style: 'dashed' },
      ],
      compute: { fn: 'lineTiltUp', line: ['p1', 'p2'], ref: ['p3', 'p4'] },
      normal: { min: 0, max: 10, text: '0–10°' },
      interpret: [
        { if: { lt: 0 }, text: 'Negative angle – roof slopes downward laterally (over-coverage / pincer)' },
        { if: { gt: 10 }, text: 'Increased acetabular roof obliquity (dysplasia)' },
        { else: true, text: 'Normal acetabular roof inclination' },
      ],
    },
    {
      id: 'neck-shaft', name: 'Neck–shaft angle', region: 'Hip', view: 'AP pelvis', unit: 'degrees',
      points: [
        ...HEAD(),
        { label: 'Neck – superior cortex', instruction: 'Tap the SUPERIOR cortex of the femoral neck at its narrowest point.' },
        { label: 'Neck – inferior cortex', instruction: 'Tap the INFERIOR cortex of the femoral neck at the same level (narrowest point).' },
        { label: 'Shaft centre – upper level', instruction: 'Tap the centre of the femoral shaft (between the cortices) at a PROXIMAL level.' },
        { label: 'Shaft centre – lower level', instruction: 'Tap the centre of the femoral shaft at a DISTAL level, at least a few cm below the first.' },
      ],
      derived: [
        { id: 'hc', op: 'circleCenter', of: ['p1', 'p2', 'p3'] },
        { id: 'nm', op: 'midpoint', of: ['p4', 'p5'] },
      ],
      draw: [
        { op: 'circle', of: 'hc' },
        { op: 'cross', ref: 'hc' },
        { op: 'cross', ref: 'nm' },
        { op: 'line', a: 'hc', b: 'nm' },
        { op: 'line', a: 'p6', b: 'p7' },
      ],
      compute: {
        fn: 'angleBetweenVectors',
        v1: { from: 'hc', to: 'nm' },                       // head → neck (away from the head)
        v2: { axis: ['p6', 'p7'], towardRef: 'nm' },        // shaft axis pointing proximally
      },
      normal: { min: 125, max: 135, text: '125–135°' },
      interpret: [
        { if: { lt: 125 }, text: 'Coxa vara (< 125°)' },
        { if: { gt: 135 }, text: 'Coxa valga (> 135°)' },
        { else: true, text: 'Normal neck–shaft angle' },
      ],
    },

    /* ------------------------------------------------------------ KNEE – Lateral */
    {
      id: 'insall-salvati', name: 'Insall–Salvati ratio', region: 'Knee', view: 'Lateral', unit: 'ratio',
      points: [
        { label: 'Patella – superior pole', instruction: 'Tap the superior pole of the patella.' },
        { label: 'Patella – inferior pole', instruction: 'Tap the inferior pole of the patella (articular end).' },
        { label: 'Patellar tendon – origin', instruction: 'Tap the inferior pole of the patella where the patellar tendon ORIGINATES.' },
        { label: 'Tibial tubercle – insertion', instruction: 'Tap the tibial tubercle at the INSERTION of the patellar tendon.' },
      ],
      draw: [
        { op: 'segment', a: 'p1', b: 'p2' },
        { op: 'segment', a: 'p3', b: 'p4' },
      ],
      compute: { fn: 'ratio', a: ['p3', 'p4'], b: ['p1', 'p2'] },   // tendon length / patellar length
      normal: { min: 0.8, max: 1.2, text: '0.8–1.2' },
      interpret: [
        { if: { gt: 1.2 }, text: 'Patella alta' },
        { if: { lt: 0.8 }, text: 'Patella baja' },
        { else: true, text: 'Normal patellar height' },
      ],
    },
    {
      id: 'tibial-slope', name: 'Posterior tibial slope', region: 'Knee', view: 'Lateral', unit: 'degrees', signed: true,
      points: [
        { label: 'Shaft level 1 – anterior cortex', instruction: 'Tap the ANTERIOR cortex of the proximal tibial shaft (level 1, a few cm below the plateau).' },
        { label: 'Shaft level 1 – posterior cortex', instruction: 'Tap the POSTERIOR cortex of the tibial shaft at the same level.' },
        { label: 'Shaft level 2 – anterior cortex', instruction: 'Tap the ANTERIOR cortex at a more DISTAL level (level 2).' },
        { label: 'Shaft level 2 – posterior cortex', instruction: 'Tap the POSTERIOR cortex at level 2.' },
        { label: 'Medial plateau – anterior edge', instruction: 'Tap the ANTERIOR edge of the medial tibial plateau.' },
        { label: 'Medial plateau – posterior edge', instruction: 'Tap the POSTERIOR edge of the medial tibial plateau.' },
      ],
      derived: [
        { id: 'm1', op: 'midpoint', of: ['p1', 'p2'] },
        { id: 'm2', op: 'midpoint', of: ['p3', 'p4'] },
      ],
      draw: [
        { op: 'cross', ref: 'm1' },
        { op: 'cross', ref: 'm2' },
        { op: 'line', a: 'm1', b: 'm2' },
        { op: 'line', a: 'p5', b: 'p6' },
      ],
      // slope = 90° − angle(plateau line, shaft axis); positive when the plateau falls posteriorly
      compute: { fn: 'tiltFromPerpendicular', line: ['p5', 'p6'], axis: ['m1', 'm2'], distal: 'axis', positive: 'last-distal' },
      normal: { min: 5, max: 10, text: '≈ 5–10°' },
      interpret: [
        { if: { lt: 0 }, text: 'Anterior (reverse) slope' },
        { if: { lt: 5 }, text: 'Reduced posterior slope' },
        { if: { gt: 10 }, text: 'Increased posterior slope (higher ACL injury / graft-failure risk)' },
        { else: true, text: 'Normal posterior tibial slope' },
      ],
    },

    /* ------------------------------------------------------------ KNEE – Long-leg standing AP */
    {
      id: 'hka', name: 'HKA angle', region: 'Knee', view: 'Long-leg AP', unit: 'degrees', needsSide: true,
      points: [
        ...HEAD(),
        { label: 'Knee centre', instruction: 'Tap the centre of the knee – midway between the tibial spines.' },
        { label: 'Talar dome – medial edge', instruction: 'Tap the MEDIAL edge of the talar dome (ankle).' },
        { label: 'Talar dome – lateral edge', instruction: 'Tap the LATERAL edge of the talar dome (ankle).' },
      ],
      derived: [
        { id: 'hc', op: 'circleCenter', of: ['p1', 'p2', 'p3'] },
        { id: 'ac', op: 'midpoint', of: ['p5', 'p6'] },
      ],
      draw: [
        { op: 'circle', of: 'hc' },
        { op: 'cross', ref: 'hc' },
        { op: 'cross', ref: 'ac' },
        { op: 'segment', a: 'hc', b: 'p4' },
        { op: 'segment', a: 'p4', b: 'ac' },
      ],
      compute: { fn: 'hka', hip: 'hc', knee: 'p4', ankle: 'ac' },
      normal: { min: -3, max: 3, on: 'dev', text: '180° ± 3°' },
      interpretOn: 'dev',
      detail: { on: 'dev', pos: 'Varus', neg: 'Valgus' },
      interpret: [
        { if: { gt: 3 }, text: 'Varus alignment' },
        { if: { lt: -3 }, text: 'Valgus alignment' },
        { else: true, text: 'Neutral mechanical alignment' },
      ],
    },
    {
      id: 'mldfa', name: 'mLDFA', region: 'Knee', view: 'Long-leg AP', unit: 'degrees',
      points: [
        ...HEAD(),
        { label: 'Knee centre (femoral)', instruction: 'Tap the centre of the knee at the femoral side (middle of the intercondylar notch).' },
        { label: 'Medial condyle – most distal point', instruction: 'Tap the most DISTAL point of the MEDIAL femoral condyle.' },
        { label: 'Lateral condyle – most distal point', instruction: 'Tap the most DISTAL point of the LATERAL femoral condyle.' },
      ],
      derived: [{ id: 'hc', op: 'circleCenter', of: ['p1', 'p2', 'p3'] }],
      draw: [
        { op: 'circle', of: 'hc' },
        { op: 'cross', ref: 'hc' },
        { op: 'line', a: 'hc', b: 'p4' },
        { op: 'line', a: 'p5', b: 'p6' },
      ],
      // lateral angle between the (proximal) femoral mechanical axis and the condylar line
      compute: { fn: 'angleBetweenVectors', v1: { from: 'p4', to: 'hc' }, v2: { from: 'p5', to: 'p6' } },
      normal: { min: 85, max: 90, text: '85–90°' },
      interpret: [
        { if: { lt: 85 }, text: 'Valgus distal femur (femoral deformity)' },
        { if: { gt: 90 }, text: 'Varus distal femur (femoral deformity)' },
        { else: true, text: 'Normal distal femoral alignment' },
      ],
    },
    {
      id: 'mpta', name: 'MPTA', region: 'Knee', view: 'Long-leg AP', unit: 'degrees',
      points: [
        { label: 'Tibial plateau – medial edge', instruction: 'Tap the MEDIAL edge of the tibial plateau.' },
        { label: 'Tibial plateau – lateral edge', instruction: 'Tap the LATERAL edge of the tibial plateau.' },
        { label: 'Knee centre (tibial)', instruction: 'Tap the centre of the tibial plateau – midway between the tibial spines.' },
        { label: 'Talar dome – edge 1', instruction: 'Tap one edge of the talar dome (ankle).' },
        { label: 'Talar dome – edge 2', instruction: 'Tap the other edge of the talar dome (ankle).' },
      ],
      derived: [{ id: 'ac', op: 'midpoint', of: ['p4', 'p5'] }],
      draw: [
        { op: 'cross', ref: 'ac' },
        { op: 'line', a: 'p3', b: 'ac' },
        { op: 'line', a: 'p1', b: 'p2' },
      ],
      // medial angle between the (distal) tibial mechanical axis and the plateau line
      compute: { fn: 'angleBetweenVectors', v1: { from: 'p3', to: 'ac' }, v2: { from: 'p2', to: 'p1' } },
      normal: { min: 85, max: 90, text: '85–90°' },
      interpret: [
        { if: { lt: 85 }, text: 'Varus proximal tibia (tibial deformity)' },
        { if: { gt: 90 }, text: 'Valgus proximal tibia (tibial deformity)' },
        { else: true, text: 'Normal proximal tibial alignment' },
      ],
    },

    /* ------------------------------------------------------------ FOOT – Weight-bearing AP */
    {
      id: 'hva', name: 'Hallux valgus angle', region: 'Foot', view: 'Weight-bearing AP', unit: 'degrees',
      points: [
        { label: '1st metatarsal – proximal centre', instruction: 'Tap the centre of the 1st metatarsal shaft at its PROXIMAL part.' },
        { label: '1st metatarsal – distal centre', instruction: 'Tap the centre of the 1st metatarsal shaft at its DISTAL part.' },
        { label: 'Proximal phalanx – proximal centre', instruction: 'Tap the centre of the hallux proximal phalanx at its PROXIMAL part.' },
        { label: 'Proximal phalanx – distal centre', instruction: 'Tap the centre of the hallux proximal phalanx at its DISTAL part.' },
      ],
      draw: [
        { op: 'line', a: 'p1', b: 'p2' },
        { op: 'line', a: 'p3', b: 'p4' },
      ],
      compute: { fn: 'angleBetweenLines', l1: ['p1', 'p2'], l2: ['p3', 'p4'] },
      normal: { max: 15, text: '< 15°' },
      interpret: [
        { if: { lt: 15 }, text: 'Normal' },
        { if: { lt: 20 }, text: 'Mild hallux valgus (15–20°)' },
        { if: { lt: 40 }, text: 'Moderate hallux valgus (20–40°)' },
        { else: true, text: 'Severe hallux valgus (> 40°)' },
      ],
    },
    {
      id: 'ima', name: 'Intermetatarsal angle (1–2)', region: 'Foot', view: 'Weight-bearing AP', unit: 'degrees',
      points: [
        { label: '1st metatarsal – proximal centre', instruction: 'Tap the centre of the 1st metatarsal shaft at its PROXIMAL part.' },
        { label: '1st metatarsal – distal centre', instruction: 'Tap the centre of the 1st metatarsal shaft at its DISTAL part.' },
        { label: '2nd metatarsal – proximal centre', instruction: 'Tap the centre of the 2nd metatarsal shaft at its PROXIMAL part.' },
        { label: '2nd metatarsal – distal centre', instruction: 'Tap the centre of the 2nd metatarsal shaft at its DISTAL part.' },
      ],
      draw: [
        { op: 'line', a: 'p1', b: 'p2' },
        { op: 'line', a: 'p3', b: 'p4' },
      ],
      compute: { fn: 'angleBetweenLines', l1: ['p1', 'p2'], l2: ['p3', 'p4'] },
      normal: { max: 9, text: '< 9°' },
      interpret: [
        { if: { lt: 9 }, text: 'Normal' },
        { if: { lt: 11 }, text: 'Mild widening (9–11°)' },
        { if: { lt: 16 }, text: 'Moderate widening (11–16°)' },
        { else: true, text: 'Severe widening (> 16°)' },
      ],
    },

    /* ------------------------------------------------------------ WRIST – PA */
    {
      id: 'radial-inclination', name: 'Radial inclination', region: 'Wrist', view: 'PA', unit: 'degrees', signed: true,
      points: [
        { label: 'Radial styloid tip', instruction: 'Tap the tip of the radial styloid.' },
        { label: 'Ulnar corner of radius', instruction: 'Tap the ULNAR corner of the distal radial articular surface (sigmoid notch edge).' },
        { label: 'Radial shaft centre – level 1', instruction: 'Tap the centre of the radial shaft at a level a few cm proximal to the wrist.' },
        { label: 'Radial shaft centre – level 2', instruction: 'Tap the centre of the radial shaft at a second, more proximal level.' },
      ],
      draw: [
        { op: 'segment', a: 'p1', b: 'p2' },
        { op: 'line', a: 'p3', b: 'p4', style: 'dashed' },
      ],
      // line P1–P2 against the perpendicular of the shaft axis; positive when the styloid is more distal than the ulnar corner
      compute: { fn: 'tiltFromPerpendicular', line: ['p1', 'p2'], axis: ['p3', 'p4'], distal: 'line', positive: 'first-distal' },
      normal: { min: 21, max: 25, text: '≈ 21–25°' },
      interpret: [
        { if: { lt: 21 }, text: 'Reduced radial inclination' },
        { if: { gt: 25 }, text: 'Increased radial inclination' },
        { else: true, text: 'Normal radial inclination' },
      ],
    },
    {
      id: 'ulnar-variance', name: 'Ulnar variance', region: 'Wrist', view: 'PA', unit: 'mm', signed: true, needsCalibration: true,
      points: [
        { label: 'Radial shaft centre – level 1', instruction: 'Tap the centre of the radial shaft at a level a few cm proximal to the wrist.' },
        { label: 'Radial shaft centre – level 2', instruction: 'Tap the centre of the radial shaft at a second, more proximal level.' },
        { label: 'Ulnar corner of radius', instruction: 'Tap the ULNAR corner of the distal radial articular surface.' },
        { label: 'Ulnar head – distal surface', instruction: 'Tap the distal articular surface of the ulnar head.' },
      ],
      draw: [
        { op: 'line', a: 'p1', b: 'p2', style: 'dashed' },
        { op: 'segment', a: 'p3', b: 'p4' },
      ],
      // P3 → P4 measured parallel to the radial axis; positive when the ulna is longer
      compute: { fn: 'distanceAlongAxis', pts: ['p3', 'p4'], axis: ['p1', 'p2'], distalLine: ['p3', 'p4'] },
      decimals: 1,
      normal: { min: -2, max: 2, text: '≈ −2 to +2 mm' },
      interpret: [
        { if: { lt: -2 }, text: 'Ulnar-negative variance (associated with Kienböck disease)' },
        { if: { gt: 2 }, text: 'Ulnar-positive variance (associated with ulnar impaction)' },
        { else: true, text: 'Neutral ulnar variance' },
      ],
    },

    /* ------------------------------------------------------------ WRIST – Lateral */
    {
      id: 'volar-tilt', name: 'Volar tilt', region: 'Wrist', view: 'Lateral', unit: 'degrees', signed: true,
      points: [
        { label: 'Dorsal rim of radius', instruction: 'Tap the DORSAL rim of the distal radial articular surface.' },
        { label: 'Volar rim of radius', instruction: 'Tap the VOLAR (palmar) rim of the distal radial articular surface.' },
        { label: 'Radial shaft centre – level 1', instruction: 'Tap the centre of the radial shaft at a level a few cm proximal to the wrist.' },
        { label: 'Radial shaft centre – level 2', instruction: 'Tap the centre of the radial shaft at a second, more proximal level.' },
      ],
      draw: [
        { op: 'segment', a: 'p1', b: 'p2' },
        { op: 'line', a: 'p3', b: 'p4', style: 'dashed' },
      ],
      // positive = volar tilt (volar rim more distal than the dorsal rim)
      compute: { fn: 'tiltFromPerpendicular', line: ['p1', 'p2'], axis: ['p3', 'p4'], distal: 'line', positive: 'last-distal' },
      detail: { on: 'value', pos: 'Volar', neg: 'Dorsal' },
      normal: { min: 0, max: 22, text: '≈ 11° volar (0–22°)' },
      interpret: [
        { if: { lt: 0 }, text: 'Dorsal tilt (dorsal angulation)' },
        { if: { gt: 22 }, text: 'Excessive volar tilt' },
        { else: true, text: 'Normal volar tilt' },
      ],
    },

    /* ------------------------------------------------------------ SHOULDER – True AP (Grashey) */
    {
      id: 'csa', name: 'Critical shoulder angle', region: 'Shoulder', view: 'True AP (Grashey)', unit: 'degrees',
      points: [
        { label: 'Superior glenoid rim', instruction: 'Tap the SUPERIOR rim of the glenoid.' },
        { label: 'Inferior glenoid rim', instruction: 'Tap the INFERIOR rim of the glenoid.' },
        { label: 'Acromion – inferolateral point', instruction: 'Tap the most INFEROLATERAL point of the acromion.' },
      ],
      draw: [
        { op: 'segment', a: 'p2', b: 'p1' },
        { op: 'segment', a: 'p2', b: 'p3' },
      ],
      compute: { fn: 'angleAtVertex', a: 'p1', v: 'p2', b: 'p3' },
      normal: { min: 30, max: 35, text: '30–35°' },
      interpret: [
        { if: { gt: 35 }, text: 'CSA > 35° – associated with rotator cuff tears' },
        { if: { lt: 30 }, text: 'CSA < 30° – associated with glenohumeral osteoarthritis' },
        { else: true, text: 'Normal critical shoulder angle' },
      ],
    },
  ];

  const byId = (id) => TEMPLATES.find((t) => t.id === id) || null;
  const forView = (viewId) => {
    const v = VIEWS.find((x) => x.id === viewId);
    return v ? TEMPLATES.filter((t) => t.region === v.region && t.view === v.view) : [];
  };

  return { VIEWS, TEMPLATES, byId, forView };
});
