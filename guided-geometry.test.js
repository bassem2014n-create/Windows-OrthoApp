/* Run:  node guided-geometry.test.js   — geometry + every template, with known coordinates. */
'use strict';
const assert = require('assert');
const fs = require('fs'), path = require('path');
const G = require('./guided-geometry.js');
const T = require('./measurement-templates.js');

let n = 0;
const near = (a, b, tol, msg) => { n++; assert.ok(Math.abs(a - b) <= (tol == null ? 1e-6 : tol), `${msg || ''} expected ${b}, got ${a}`); };
const P = (x, y) => ({ x, y });
const rad = (d) => d * Math.PI / 180;
const ev = (id, pts, o) => G.evaluate(T.byId(id), pts, o);
const CAL = { mmPerPx: 0.5 };

/* ---- primitives identical to the app's Radiology tool (extract its source and compare) ---- */
{
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const grab = (re) => { const m = html.match(re); assert.ok(m, 'app source not found: ' + re); return m[0]; };
  const src = 'const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));' +
    grab(/const dist = \(a, b\) => Math\.hypot[^\n]*/) + grab(/function angleAt\(a, v, b\) \{[\s\S]*?\n  \}/) + grab(/function lineAngle\(p1, p2, p3, p4\) \{[\s\S]*?\n  \}/) +
    ';return {dist,angleAt,lineAngle}';
  const A = new Function(src)();
  for (let i = 0; i < 200; i++) {
    const r = () => P(Math.random() * 500, Math.random() * 500), a = r(), b = r(), c = r(), d = r();
    near(G.dist(a, b), A.dist(a, b), 1e-9, 'dist');
    near(G.angleAt(a, b, c), A.angleAt(a, b, c), 1e-9, 'angleAt');
    near(G.lineAngle(a, b, c, d), A.lineAngle(a, b, c, d), 1e-9, 'lineAngle');
  }
}

/* ---- midpoint & circle centre ---- */
{
  const m = G.midpoint(P(0, 0), P(10, 4)); near(m.x, 5); near(m.y, 2);
  const c = G.circleCenter(P(110, 50), P(50, 110), P(-10, 50)); // circle centre (50,50) r 60
  near(c.x, 50); near(c.y, 50); near(c.r, 60);
  const c2 = G.circleCenter(P(0, 0), P(10, 0), P(5, 5)); near(c2.x, 5); near(c2.y, 0); near(c2.r, 5);
  assert.strictEqual(G.circleCenter(P(0, 0), P(1, 1), P(2, 2)), null); n++;
}

/* ---- Cobb ---- */
{
  const a = rad(25);                                   // line 1 tilted 25° one way, line 2 tilted 0
  const r = ev('cobb', [P(0, 0), P(100 * Math.cos(a), 100 * Math.sin(a)), P(0, 200), P(100, 200)]);
  near(r.value, 25, 1e-9); assert.ok(/scoliosis/i.test(r.interpretation)); n++;
  const r2 = ev('cobb', [P(0, 0), P(100, 0), P(0, 200), P(100, 200 + 100 * Math.tan(rad(5)))]);
  near(r2.value, 5, 1e-9); assert.ok(/below/i.test(r2.interpretation)); n++;
  // tilting the other way gives the same magnitude (left- vs right-sided curve)
  near(ev('cobb', [P(100, 0), P(0, 0), P(100, 200), P(0, 200 + 100 * Math.tan(rad(-30)))]).value, 30, 1e-9);
}

/* ---- Insall–Salvati ---- */
{
  const r = ev('insall-salvati', [P(0, 0), P(0, 50), P(0, 50), P(0, 116)]);
  near(r.value, 1.32, 1e-9); assert.strictEqual(r.text, '1.32 ratio'); n++;
  assert.strictEqual(r.status, 'high'); assert.ok(/alta/i.test(r.interpretation)); n++;
  assert.strictEqual(r.summary, 'Insall–Salvati ratio 1.32 – Normal 0.8–1.2 → Patella alta'); n++;
  assert.ok(/baja/i.test(ev('insall-salvati', [P(0, 0), P(0, 50), P(0, 50), P(0, 80)]).interpretation)); n++;
  assert.ok(/normal/i.test(ev('insall-salvati', [P(0, 0), P(0, 50), P(0, 50), P(0, 100)]).interpretation)); n++;
}

/* ---- LCEA: right and left hip, mirrored images ---- */
{
  // head centre C=(0,0) r=40 ; teardrops on a horizontal line y=60 ; vertical = up (−y)
  const head = [P(40, 0), P(0, -40), P(-40, 0)];
  const build = (side /* +1: measured hip on the image-right, lateral = +x */, angDeg) => {
    const a = rad(angDeg);
    const edge = P(side * 90 * Math.sin(a), -90 * Math.cos(a));   // lateral edge, angDeg lateral of vertical
    return [...head, edge, P(side * 20, 60), P(side * -200, 60)];  // this-hip teardrop is nearer the measured side
  };
  for (const side of [1, -1]) {
    near(ev('lcea', build(side, 30)).value, 30, 1e-9, 'lcea side ' + side);
    near(ev('lcea', build(side, 12)).value, 12, 1e-9);
    near(ev('lcea', build(side, -8)).value, -8, 1e-9, 'edge medial to the centre → negative');
  }
  assert.ok(/dysplasia/i.test(ev('lcea', build(1, 12)).interpretation)); n++;
  assert.ok(/borderline/i.test(ev('lcea', build(1, 22)).interpretation)); n++;
  assert.ok(/normal/i.test(ev('lcea', build(-1, 30)).interpretation)); n++;
  assert.ok(/pincer|over/i.test(ev('lcea', build(1, 45)).interpretation)); n++;
  // pelvis tilted 10°: teardrop line rotated, edge rotated by the same amount → same LCEA
  const rot = (p, d) => P(p.x * Math.cos(rad(d)) - p.y * Math.sin(rad(d)), p.x * Math.sin(rad(d)) + p.y * Math.cos(rad(d)));
  near(ev('lcea', build(1, 30).map((p) => rot(p, 10))).value, 30, 1e-9, 'rotation invariant');
}

/* ---- Tönnis ---- */
{
  // medial edge (0,0), lateral edge higher by 7° ; teardrop line horizontal → +7
  const t = (d) => [P(0, 0), P(100 * Math.cos(rad(d)), -100 * Math.sin(rad(d))), P(0, 80), P(200, 80)];
  near(ev('tonnis', t(7)).value, 7, 1e-9); assert.strictEqual(ev('tonnis', t(7)).text, '+7.0°'); n++;
  near(ev('tonnis', t(15)).value, 15, 1e-9); assert.ok(/obliquity|dysplasia/i.test(ev('tonnis', t(15)).interpretation)); n++;
  near(ev('tonnis', t(-4)).value, -4, 1e-9); assert.ok(/negative/i.test(ev('tonnis', t(-4)).interpretation)); n++;
  // mirrored image (medial edge on the right) – the roof still rises laterally → still positive
  const m = t(7).map((p) => P(-p.x, p.y)); near(ev('tonnis', m).value, 7, 1e-9, 'mirrored');
}

/* ---- Neck–shaft ---- */
{
  // neck axis makes angle ns with the PROXIMAL shaft direction (0,−1): neck dir = (sin(ns)·f , −cos(ns)) ; mirror flips the side
  const build = (ns, mirror) => {
    const f = mirror ? -1 : 1, r = 40;
    const nk = P(f * Math.sin(rad(ns)), -Math.cos(rad(ns)));
    const nm = P(nk.x * 80, nk.y * 80), perp = P(-nk.y, nk.x);
    return [P(r, 0), P(0, -r), P(-r, 0), P(nm.x + perp.x * 15, nm.y + perp.y * 15), P(nm.x - perp.x * 15, nm.y - perp.y * 15),
      P(nm.x, nm.y + 60), P(nm.x, nm.y + 200)];                     // shaft straight down from the neck
  };
  for (const mirror of [false, true]) {
    near(ev('neck-shaft', build(130, mirror)).value, 130, 1e-9, 'neck-shaft');
    near(ev('neck-shaft', build(118, mirror)).value, 118, 1e-9);
  }
  assert.ok(/vara/i.test(ev('neck-shaft', build(118)).interpretation)); n++;
  assert.ok(/valga/i.test(ev('neck-shaft', build(142)).interpretation)); n++;
  assert.ok(/normal/i.test(ev('neck-shaft', build(130)).interpretation)); n++;
}

/* ---- Posterior tibial slope ---- */
{
  // shaft vertical (x=100…); plateau slopes down posteriorly by `s` degrees.
  const mk = (s, anteriorOnLeft) => {
    const f = anteriorOnLeft ? 1 : -1, c = rad(s);                  // lateral knee can face either way
    const a = P(100 - f * 40 * Math.cos(c), -40 * Math.sin(c)), p = P(100 + f * 40 * Math.cos(c), 40 * Math.sin(c));
    return [P(60, 100), P(140, 100), P(60, 300), P(140, 300), a, p];  // posterior edge LOWER (larger y) → positive
  };
  near(ev('tibial-slope', mk(8, true)).value, 8, 1e-9, 'slope 8');
  near(ev('tibial-slope', mk(8, false)).value, 8, 1e-9, 'slope 8 mirrored');
  near(ev('tibial-slope', mk(14, true)).value, 14, 1e-9);
  assert.ok(/increased/i.test(ev('tibial-slope', mk(14, true)).interpretation)); n++;
  assert.ok(/reduced/i.test(ev('tibial-slope', mk(2, true)).interpretation)); n++;
  near(ev('tibial-slope', mk(-5, true)).value, -5, 1e-9, 'anterior slope negative');
  // shaft tilted 20° in the image: the answer must not change (plateau rotated with it)
  const rot = (p, d) => P(p.x * Math.cos(rad(d)) - p.y * Math.sin(rad(d)), p.x * Math.sin(rad(d)) + p.y * Math.cos(rad(d)));
  near(ev('tibial-slope', mk(8, true).map((p) => rot(p, 20))).value, 8, 1e-9, 'rotation invariant');
}

/* ---- HKA: right & left limb, varus / valgus, mirrored ---- */
{
  // hip (0,0), ankle (0,1000), knee at y=500 displaced sideways by dx so the knee angle is 180 − dev
  const knee = (dev) => 500 * Math.tan(rad(dev) / 2);
  const head = [P(40, 0), P(0, -40), P(-40, 0)];                    // centre (0,0)
  const pts = (dx) => [...head, P(dx, 500), P(-30, 1000), P(30, 1000)];
  const dx = knee(5);                                              // ≈5° deviation
  // RIGHT limb (patient's right = image left): lateral = −x. knee at −dx → varus ; +dx → valgus
  let r = ev('hka', pts(-dx), { side: 'R' }); near(r.dev, 5, 1e-6); near(r.value, 175, 1e-6); assert.ok(/varus/i.test(r.detail)); assert.ok(/Varus alignment/.test(r.interpretation)); n += 2;
  r = ev('hka', pts(dx), { side: 'R' }); near(r.dev, -5, 1e-6); assert.ok(/valgus/i.test(r.detail)); assert.ok(/Valgus alignment/.test(r.interpretation)); n += 2;
  // LEFT limb (image right): lateral = +x. knee at +dx → varus
  r = ev('hka', pts(dx), { side: 'L' }); near(r.dev, 5, 1e-6); assert.ok(/varus/i.test(r.detail)); n++;
  r = ev('hka', pts(-dx), { side: 'L' }); near(r.dev, -5, 1e-6); assert.ok(/valgus/i.test(r.detail)); n++;
  // neutral (within ±3°)
  r = ev('hka', pts(knee(1.5)), { side: 'L' }); assert.strictEqual(r.status, 'normal'); assert.ok(/neutral/i.test(r.interpretation)); n += 2;
  r = ev('hka', pts(0), { side: 'R' }); near(r.value, 180, 1e-6); n++;
  // order of the head-contour points / ankle edges does not matter
  r = ev('hka', [...head.slice().reverse(), P(-dx, 500), P(30, 1000), P(-30, 1000)], { side: 'R' }); near(r.dev, 5, 1e-6, 'order independent');
}

/* ---- mLDFA / MPTA ---- */
{
  // femur: hip (0,0) → knee (0,450). Condylar line medial → lateral
  const head = [P(40, 0), P(0, -40), P(-40, 0)];
  const mldfa = (deg, lateralSign) => {                              // lateral angle between proximal axis (up) and joint line
    const a = rad(deg);                                              // direction medial→lateral makes `deg` with UP
    const d = P(lateralSign * Math.sin(a), -Math.cos(a));
    const med = P(-d.x * 40, 450 - d.y * 40 + 0), lat = P(d.x * 40, 450 + d.y * 40);
    return [...head, P(0, 450), med, lat];
  };
  near(ev('mldfa', mldfa(87, -1)).value, 87, 1e-9); near(ev('mldfa', mldfa(87, 1)).value, 87, 1e-9, 'mirrored limb');
  assert.ok(/valgus distal femur/i.test(ev('mldfa', mldfa(80, -1)).interpretation)); n++;
  assert.ok(/varus distal femur/i.test(ev('mldfa', mldfa(94, -1)).interpretation)); n++;
  assert.ok(/normal/i.test(ev('mldfa', mldfa(88, 1)).interpretation)); n++;

  // tibia: knee centre (0,0) → ankle (0,400). plateau, medial → lateral. Medial angle with the DISTAL axis (down).
  const mpta = (deg, medialSign) => {
    const a = rad(deg);                                              // medial direction makes `deg` with DOWN
    const m = P(medialSign * Math.sin(a), Math.cos(a));              // unit vector lateral→medial from the centre
    return [P(m.x * 40, m.y * 40), P(-m.x * 40, -m.y * 40), P(0, 0), P(-25, 400), P(25, 400)];
  };
  near(ev('mpta', mpta(87, -1)).value, 87, 1e-9); near(ev('mpta', mpta(87, 1)).value, 87, 1e-9, 'mirrored');
  assert.ok(/varus proximal tibia/i.test(ev('mpta', mpta(80, 1)).interpretation)); n++;
  assert.ok(/valgus proximal tibia/i.test(ev('mpta', mpta(93, 1)).interpretation)); n++;
}

/* ---- Foot ---- */
{
  const lines = (deg) => [P(0, 0), P(0, 100), P(50, 0), P(50 + 100 * Math.sin(rad(deg)), 100 * Math.cos(rad(deg)))];
  near(ev('hva', lines(12)).value, 12, 1e-9); assert.ok(/normal/i.test(ev('hva', lines(12)).interpretation)); n++;
  assert.ok(/mild/i.test(ev('hva', lines(17)).interpretation)); assert.ok(/moderate/i.test(ev('hva', lines(30)).interpretation)); assert.ok(/severe/i.test(ev('hva', lines(45)).interpretation)); n += 3;
  near(ev('ima', lines(8)).value, 8, 1e-9); assert.ok(/normal/i.test(ev('ima', lines(8)).interpretation)); assert.ok(/mild/i.test(ev('ima', lines(10)).interpretation)); n += 2;
  assert.ok(/moderate/i.test(ev('ima', lines(13)).interpretation)); assert.ok(/severe/i.test(ev('ima', lines(20)).interpretation)); n += 2;
}

/* ---- Wrist: radial inclination, volar tilt, ulnar variance (shaft vertical, distal = down) ---- */
{
  // PA wrist, shaft x=0, levels y=−200 and −100 (proximal = up). radial styloid is distal & radial.
  const ri = (deg, radialSign) => {                                   // styloid more distal than the ulnar corner; radialSign = which image side is radial
    const a = rad(deg), len = 100;
    const ulnar = P(0, 0), sty = P(radialSign * len * Math.cos(a), len * Math.sin(a));   // styloid LOWER (distal) by sin(a)
    return [sty, ulnar, P(0, -200), P(0, -100)];
  };
  near(ev('radial-inclination', ri(23, 1)).value, 23, 1e-9); near(ev('radial-inclination', ri(23, -1)).value, 23, 1e-9, 'mirrored (left wrist)');
  assert.strictEqual(ev('radial-inclination', ri(23, 1)).status, 'normal'); n++;
  assert.ok(/reduced/i.test(ev('radial-inclination', ri(10, 1)).interpretation)); n++;
  near(ev('radial-inclination', ri(-5, 1)).value, -5, 1e-9, 'reversed inclination negative');
  // shaft given in the opposite order (distal level first) must not change anything
  const rv = ri(23, 1); near(ev('radial-inclination', [rv[0], rv[1], rv[3], rv[2]]).value, 23, 1e-9, 'axis order independent');

  // lateral wrist: volar rim more distal than dorsal rim → positive (volar). dorsal side can be left or right.
  const vt = (deg, volarSign) => {
    const a = rad(deg), len = 60;
    const dorsal = P(-volarSign * len / 2 * Math.cos(a), -len / 2 * Math.sin(a)), volar = P(volarSign * len / 2 * Math.cos(a), len / 2 * Math.sin(a));
    return [dorsal, volar, P(0, -200), P(0, -100)];
  };
  near(ev('volar-tilt', vt(11, 1)).value, 11, 1e-9); near(ev('volar-tilt', vt(11, -1)).value, 11, 1e-9, 'mirrored');
  assert.ok(/^Volar/.test(ev('volar-tilt', vt(11, 1)).detail)); assert.strictEqual(ev('volar-tilt', vt(11, 1)).text, '+11.0°'); n += 2;
  near(ev('volar-tilt', vt(-12, 1)).value, -12, 1e-9, 'dorsal tilt negative'); assert.ok(/^Dorsal/.test(ev('volar-tilt', vt(-12, 1)).detail)); assert.ok(/dorsal tilt/i.test(ev('volar-tilt', vt(-12, 1)).interpretation)); n += 2;
  assert.ok(/excessive/i.test(ev('volar-tilt', vt(30, -1)).interpretation)); n++;

  // ulnar variance in mm (needs calibration), measured PARALLEL to the radial axis even when the shaft is tilted
  const uv = (mmPlus, tiltDeg) => {
    const px = mmPlus / CAL.mmPerPx, base = [P(0, -200), P(0, -100), P(0, 0), P(60, px)];
    const rot = (p) => P(p.x * Math.cos(rad(tiltDeg)) - p.y * Math.sin(rad(tiltDeg)), p.x * Math.sin(rad(tiltDeg)) + p.y * Math.cos(rad(tiltDeg)));
    return base.map(rot);
  };
  assert.strictEqual(ev('ulnar-variance', uv(2, 0)).uncalibrated, true); n++;                        // asks for calibration
  assert.strictEqual(ev('ulnar-variance', uv(2, 0)).ok, false); n++;
  near(ev('ulnar-variance', uv(2, 0), { calibration: CAL }).value, 2, 1e-9);
  near(ev('ulnar-variance', uv(-3, 0), { calibration: CAL }).value, -3, 1e-9, 'ulna shorter = negative');
  near(ev('ulnar-variance', uv(2.5, 25), { calibration: CAL }).value, 2.5, 1e-9, 'tilted shaft');
  near(ev('ulnar-variance', uv(2.5, 180), { calibration: CAL }).value, 2.5, 1e-9, 'image rotated 180°');
  assert.strictEqual(ev('ulnar-variance', uv(2.5, 0), { calibration: CAL }).text, '+2.5 mm'); n++;
  assert.ok(/impaction/i.test(ev('ulnar-variance', uv(3.5, 0), { calibration: CAL }).interpretation)); n++;
  assert.ok(/kienb/i.test(ev('ulnar-variance', uv(-3.5, 0), { calibration: CAL }).interpretation)); n++;
  assert.ok(/neutral/i.test(ev('ulnar-variance', uv(1, 0), { calibration: CAL }).interpretation)); n++;
}

/* ---- Critical shoulder angle ---- */
{
  const csa = (deg) => [P(0, 0), P(0, 40), P(100 * Math.sin(rad(deg)), 40 - 100 * Math.cos(rad(deg)))];
  near(ev('csa', csa(33)).value, 33, 1e-9); assert.ok(/normal/i.test(ev('csa', csa(33)).interpretation)); n++;
  assert.ok(/rotator cuff/i.test(ev('csa', csa(38)).interpretation)); assert.ok(/osteoarthritis/i.test(ev('csa', csa(26)).interpretation)); n += 2;
  const r = ev('csa', csa(33)); assert.strictEqual(r.summary, 'Critical shoulder angle 33.0° – Normal 30–35° → Normal critical shoulder angle'); n++;
}

/* ---- engine behaviour ---- */
{
  const tpl = T.byId('insall-salvati');
  assert.strictEqual(G.evaluate(tpl, [P(0, 0)]).complete, false); n++;                 // partial → no result yet
  assert.strictEqual(G.plan(tpl, [P(0, 0), P(0, 10)]).length, 1); n++;                 // only the first segment can be drawn yet
  assert.strictEqual(G.plan(tpl, [P(0, 0), P(0, 10), P(0, 10), P(0, 20)]).length, 2); n++;
  // live recalculation: moving one point changes the result
  const a = ev('cobb', [P(0, 0), P(100, 0), P(0, 200), P(100, 200)]).value, b = ev('cobb', [P(0, 0), P(100, 0), P(0, 200), P(100, 220)]).value;
  assert.ok(a === 0 && b > 10); n++;
  // plan: circle & perpendicular for the LCEA
  const lp = G.plan(T.byId('lcea'), [P(40, 0), P(0, -40), P(-40, 0), P(60, -50), P(20, 60), P(-200, 60)]).map((e) => e.k).sort();
  assert.deepStrictEqual(lp, ['circle', 'cross', 'line', 'seg', 'seg']); n++;
}

/* ---- library integrity ---- */
{
  const ids = new Set();
  T.TEMPLATES.forEach((t) => {
    assert.ok(!ids.has(t.id), 'duplicate id ' + t.id); ids.add(t.id);
    assert.ok(T.VIEWS.some((v) => v.region === t.region && v.view === t.view), 'unknown view for ' + t.id);
    assert.ok(['degrees', 'mm', 'ratio'].includes(t.unit), 'unit ' + t.id);
    t.points.forEach((p) => assert.ok(p.label && p.instruction, 'point text ' + t.id));
    assert.ok(G.FUNCS[t.compute.fn], 'compute fn ' + t.id);
    const known = new Set(t.points.map((_, i) => 'p' + (i + 1)));
    (t.derived || []).forEach((d) => { d.of.forEach((r) => assert.ok(known.has(r), t.id + ' derived ref ' + r)); known.add(d.id); });
    const refsOk = (x) => (Array.isArray(x) ? x : [x]).forEach((r) => { if (typeof r === 'string') assert.ok(known.has(r), t.id + ' draw/compute ref ' + r); });
    (t.draw || []).forEach((d) => { ['a', 'b', 'of', 'ref', 'through'].forEach((k) => d[k] && refsOk(d[k])); d.to && refsOk(d.to); });
    n += 6;
  });
  assert.strictEqual(T.TEMPLATES.length, 19); n++;
  // thesis auto-fill wiring
  const FIELDS = ['extMm', 'widthMm', 'osteoMm', 'mtfa', 'mldfa', 'mpta', 'mpts'];
  const mapped = T.TEMPLATES.filter((t) => t.thesis).map((t) => t.thesis.field).sort();
  assert.deepStrictEqual(mapped, FIELDS.slice().sort()); n++;
  assert.deepStrictEqual(T.forView('thesis').map((t) => t.id), ['th-ext', 'th-width', 'mldfa', 'mpta', 'mtfa', 'tibial-slope', 'th-osteo']); n++;
  const C = { calibration: { mmPerPx: 0.5 } };
  const ext = G.evaluate(T.byId('th-ext'), [P(0, 0), P(100, 0), P(50, 10), P(58, 10)], C); near(ext.value, 4, 1e-9); n++;
  const ext2 = G.evaluate(T.byId('th-ext'), [P(0, 0), P(100, 0), P(50, 10), P(46, 10)], C); near(ext2.value, -2, 1e-9); n++;   // inside the margin = negative
  const ext3 = G.evaluate(T.byId('th-ext'), [P(100, 0), P(0, 0), P(50, 10), P(42, 10)], C); near(ext3.value, 4, 1e-9); n++;    // mirrored image, axis flips with it
  assert.ok(G.evaluate(T.byId('th-ext'), [P(0, 0), P(100, 0), P(50, 10), P(58, 10)], {}).uncalibrated); n++;
  near(G.evaluate(T.byId('th-width'), [P(0, 0), P(30, 40)], { calibration: { mmPerPx: 0.2 } }).value, 10, 1e-9); n++;
  near(G.evaluate(T.byId('th-osteo'), [P(0, 0), P(6, 8)], { calibration: { mmPerPx: 0.5 } }).value, 5, 1e-9); n++;
  const lim = (kx) => [P(90, 0), P(110, 20), P(90, 40), P(kx, 500), P(90, 1000), P(120, 1000)];
  const mv = G.evaluate(T.byId('mtfa'), lim(105), {}), mr = G.evaluate(T.byId('mtfa'), lim(90), {});
  assert.ok(mv.value > 0 && mv.value < 90 && mr.value > 0 && mr.value < 90 && mv.dev * mr.dev < 0); n += 2;                 // acute, never signed
  near(G.evaluate(T.byId('mtfa'), lim(105), { side: 'L' }).value, mv.value, 1e-9); n++;
  T.VIEWS.forEach((v) => assert.ok(T.forView(v.id).length >= 1, 'view without measurements: ' + v.id)); n++;
}

console.log(`guided-geometry: ${n} assertions passed (${T.TEMPLATES.length} templates, ${T.VIEWS.length} views)`);
