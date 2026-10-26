/* ===========================================================================
 * Guided measurements — geometry + template evaluator (no UI, no DOM).
 *
 * Loaded by index.html BEFORE the Radiology module, and by guided-geometry.test.js in Node.
 * All coordinates are IMAGE pixels, y pointing DOWN (like the canvas). "Up" therefore means smaller y.
 *
 * A template (see measurement-templates.js) is pure data:
 *   points[]   ordered list the user taps; they are addressed as p1 … pN
 *   derived[]  { id, op: 'midpoint' | 'circleCenter', of: [refs] }
 *   draw[]     what to draw live: segment / line / circle / perp / cross
 *   compute    { fn, ...args } – one of the functions in FUNCS below
 *   normal, interpret, unit, decimals, detail, needsCalibration, needsSide
 *
 * Adding a measurement = adding a template entry. Adding a NEW kind of calculation = one entry in FUNCS.
 * The app passes its own dist / angleAt / lineAngle through opts.prims so the radiology tool and the
 * guided mode always share the same primitives.
 * ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuidedGeometry = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEG = 180 / Math.PI;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ------------------------------ vector helpers ------------------------------ */
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const len = (a) => Math.hypot(a.x, a.y);
  const unit = (a) => { const l = len(a); return l ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 }; };
  const neg = (a) => ({ x: -a.x, y: -a.y });

  /* --------------------------- primitives (same maths as the radiology tool) --------------------------- */
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  /** angle at vertex v between the arms to a and b, 0–180° */
  function angleAt(a, v, b) {
    const ux = a.x - v.x, uy = a.y - v.y, wx = b.x - v.x, wy = b.y - v.y;
    const d = Math.hypot(ux, uy) * Math.hypot(wx, wy);
    return d ? Math.acos(clamp((ux * wx + uy * wy) / d, -1, 1)) * DEG : null;
  }
  /** angle between line p1→p2 and line p3→p4, folded to 0–90° (Cobb-style) */
  function lineAngle(p1, p2, p3, p4) {
    const a = Math.atan2(p2.y - p1.y, p2.x - p1.x), b = Math.atan2(p4.y - p3.y, p4.x - p3.x);
    const d = (Math.abs(a - b) * DEG) % 180;
    return d > 90 ? 180 - d : d;
  }

  /* ------------------------------ new geometry ------------------------------ */
  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  /** circle through three points → { x, y, r } (null if the points are collinear) */
  function circleCenter(a, b, c) {
    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if (Math.abs(d) < 1e-9) return null;
    const a2 = a.x * a.x + a.y * a.y, b2 = b.x * b.x + b.y * b.y, c2 = c.x * c.x + c.y * c.y;
    const x = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
    const y = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
    return { x, y, r: Math.hypot(a.x - x, a.y - y) };
  }

  /** unit perpendicular of line c→d that points UP in the image (smaller y) */
  function upPerp(c, d) {
    const r = unit(sub(d, c));
    let n = { x: r.y, y: -r.x };
    if (n.y > 0) n = neg(n);
    return n;
  }

  /** angle between directed vectors u and v, 0–180° */
  function angleBetweenVectors(u, v) {
    const d = len(u) * len(v);
    return d ? Math.acos(clamp(dot(u, v) / d, -1, 1)) * DEG : null;
  }

  /** signed tilt of line a→b against reference line c→d, 0–90°; positive when b is higher (image up) than a */
  function lineTiltUp(a, b, c, d) {
    const v = sub(b, a), r = unit(sub(d, c)), n = upPerp(c, d);
    const mag = Math.atan2(Math.abs(dot(v, n)), Math.abs(dot(v, r))) * DEG;
    return dot(v, n) >= 0 ? mag : -mag;
  }

  /**
   * Angle between line a→b and the PERPENDICULAR of axis c→d (0–90°), signed by which end of a→b lies further
   * along the distal direction. `distal` says which way is distal: 'line' = the a→b line sits distal to the axis
   * levels (wrist rim vs shaft), 'axis' = the axis levels sit distal to the line (tibial shaft vs plateau).
   * positive: 'last-distal' → positive when b is more distal than a; 'first-distal' → positive when a is.
   */
  function tiltFromPerpendicular(a, b, c, d, distal, positive) {
    const v = sub(b, a), ax = unit(sub(d, c));
    const mag = Math.atan2(Math.abs(dot(v, ax)), Math.abs(dot(v, { x: -ax.y, y: ax.x }))) * DEG;
    const lm = midpoint(a, b), am = midpoint(c, d);
    const toward = distal === 'axis' ? sub(am, lm) : sub(lm, am);       // vector pointing distally
    const D = dot(ax, toward) >= 0 ? ax : neg(ax);
    const s = dot(v, D);
    const sign = positive === 'first-distal' ? -Math.sign(s || 1) : Math.sign(s || 1);
    return sign >= 0 ? mag : -mag;
  }

  /** distance from p to q measured ALONG axis c→d, positive when q is further in the distal direction */
  function distanceAlongAxis(p, q, c, d, distalFrom, distalTo) {
    const ax = unit(sub(d, c));
    const D = dot(ax, sub(distalTo, distalFrom)) >= 0 ? ax : neg(ax);
    return dot(sub(q, p), D);
  }

  /**
   * Hip–knee–ankle alignment. Returns the angle at the knee (≈180°) and a signed deviation:
   * dev > 0 varus (knee displaced laterally), dev < 0 valgus. `side` is the limb being measured; the image is
   * assumed to be in standard orientation (patient's right on the left of the image).
   */
  function hka(H, K, A, side) {
    const angle = angleAt(H, K, A);
    if (angle == null) return null;
    const dev = 180 - angle;
    const dy = A.y - H.y;
    const t = dy ? (K.y - H.y) / dy : 0;
    const xChord = H.x + t * (A.x - H.x);
    const lateral = side === 'L' ? 1 : -1;                  // L limb: lateral = +x ; R limb: lateral = −x
    const off = (K.x - xChord) * lateral;
    return { angle, dev: off >= 0 ? dev : -dev };
  }

  /* ------------------------------- template engine ------------------------------- */
  const isPt = (p) => p && typeof p.x === 'number' && typeof p.y === 'number';

  /** pN → user points; derived ids → derived values. Anything not available yet is simply missing. */
  function resolve(tpl, pts) {
    const env = {};
    (pts || []).forEach((p, i) => { if (isPt(p)) env['p' + (i + 1)] = p; });
    (tpl.derived || []).forEach((d) => {
      const refs = (d.of || []).map((r) => env[r]);
      if (refs.some((r) => !isPt(r))) return;
      if (d.op === 'midpoint') env[d.id] = midpoint(refs[0], refs[1]);
      else if (d.op === 'circleCenter') { const c = circleCenter(refs[0], refs[1], refs[2]); if (c) env[d.id] = c; }
    });
    return env;
  }

  const getAll = (env, refs) => { const o = (refs || []).map((r) => env[r]); return o.every(isPt) ? o : null; };

  /** the calculations a template can ask for; each returns { value, dev?, extra? } or null */
  const FUNCS = {
    /** angle between two lines, folded 0–90° (Cobb, hallux valgus, IMA …) */
    angleBetweenLines(a, env, o) {
      const [p1, p2] = getAll(env, a.l1) || [], [p3, p4] = getAll(env, a.l2) || [];
      return p1 && p3 ? { value: o.prims.lineAngle(p1, p2, p3, p4) } : null;
    },
    /** signed angle between two lines; positive when l1's second point is higher (image up) than its first */
    lineTiltUp(a, env) {
      const l = getAll(env, a.line), r = getAll(env, a.ref);
      return l && r ? { value: lineTiltUp(l[0], l[1], r[0], r[1]) } : null;
    },
    /** angle at a vertex between two arms (CSA) */
    angleAtVertex(a, env, o) {
      const p = getAll(env, [a.a, a.v, a.b]);
      return p ? { value: o.prims.angleAt(p[0], p[1], p[2]) } : null;
    },
    /** angle between two directed vectors; each is {from,to} or {axis:[a,b], awayFrom|towardRef:ref} (axis oriented) */
    angleBetweenVectors(a, env) {
      const vec = (v) => {
        if (v.from) { const p = getAll(env, [v.from, v.to]); return p ? sub(p[1], p[0]) : null; }
        const ax = getAll(env, v.axis); if (!ax) return null;
        const dir = unit(sub(ax[1], ax[0])), mid = midpoint(ax[0], ax[1]);
        if (v.awayFrom) { const r = env[v.awayFrom]; if (!isPt(r)) return null; return dot(dir, sub(mid, r)) >= 0 ? dir : neg(dir); }
        if (v.towardRef) { const r = env[v.towardRef]; if (!isPt(r)) return null; return dot(dir, sub(r, mid)) >= 0 ? dir : neg(dir); }
        return dir;
      };
      const u = vec(a.v1), w = vec(a.v2);
      return u && w ? { value: angleBetweenVectors(u, w) } : null;
    },
    /** distance(a)/distance(b) */
    ratio(a, env, o) {
      const n = getAll(env, a.a), d = getAll(env, a.b);
      if (!n || !d) return null;
      const den = o.prims.dist(d[0], d[1]);
      return den ? { value: o.prims.dist(n[0], n[1]) / den } : null;
    },
    /** distance between two points, in mm through the image calibration */
    distance(a, env, o) {
      const p = getAll(env, a.pts); if (!p) return null;
      const px = o.prims.dist(p[0], p[1]);
      return o.calibration && o.calibration.mmPerPx ? { value: px * o.calibration.mmPerPx } : { value: null, uncalibrated: true };
    },
    /** distance p→q measured parallel to an axis (mm); positive when q is further distal */
    distanceAlongAxis(a, env, o) {
      const pq = getAll(env, a.pts), ax = getAll(env, a.axis), dl = getAll(env, a.distalLine);
      if (!pq || !ax || !dl) return null;
      if (!(o.calibration && o.calibration.mmPerPx)) return { value: null, uncalibrated: true };
      const mm = distanceAlongAxis(pq[0], pq[1], ax[0], ax[1], midpoint(ax[0], ax[1]), midpoint(dl[0], dl[1]));
      return { value: mm * o.calibration.mmPerPx };
    },
    /** line a→b vs the perpendicular of an axis, signed by the distal direction (radial inclination, volar tilt, tibial slope) */
    tiltFromPerpendicular(a, env) {
      const l = getAll(env, a.line), ax = getAll(env, a.axis);
      return l && ax ? { value: tiltFromPerpendicular(l[0], l[1], ax[0], ax[1], a.distal, a.positive) } : null;
    },
    /** lateral centre-edge angle: vertical (perpendicular to the teardrop line, up) → centre→lateral sourcil edge */
    lcea(a, env) {
      const c = env[a.center], e = env[a.edge], r = getAll(env, a.ref);
      if (!isPt(c) || !isPt(e) || !r) return null;
      const n = upPerp(r[0], r[1]), v = sub(e, c);
      const ang = angleBetweenVectors(n, v);
      if (ang == null) return null;
      const lateral = sub(r[0], r[1]);                      // measured-side teardrop minus opposite teardrop
      return { value: dot(v, lateral) >= 0 ? ang : -ang };
    },
    /** hip–knee–ankle angle with varus/valgus deviation */
    hka(a, env, o) {
      const p = getAll(env, [a.hip, a.knee, a.ankle]); if (!p) return null;
      const r = hka(p[0], p[1], p[2], o.side || 'R');
      return r ? { value: r.angle, dev: r.dev } : null;
    },
  };

  const fmtNum = (v, dp) => (Math.round((v + Number.EPSILON) * 10 ** dp) / 10 ** dp).toFixed(dp);

  const matches = (cond, v) => {
    if (cond.else) return true;
    const c = cond.if || {};
    if ('lt' in c && !(v < c.lt)) return false;
    if ('lte' in c && !(v <= c.lte)) return false;
    if ('gt' in c && !(v > c.gt)) return false;
    if ('gte' in c && !(v >= c.gte)) return false;
    return true;
  };

  const UNIT = { degrees: '°', mm: ' mm', ratio: ' ratio' };

  /**
   * Evaluate a template for the points placed so far.
   * @returns {{complete, ok, value, text, detail, normal, status, interpretation, summary, uncalibrated, needsCalibration, env}}
   */
  function evaluate(tpl, pts, opts) {
    const o = Object.assign({ calibration: null, side: null, prims: {} }, opts || {});
    o.prims = Object.assign({ dist, angleAt, lineAngle }, o.prims);
    const need = tpl.points.length, placed = (pts || []).length;
    const env = resolve(tpl, pts);
    const res = { complete: placed >= need, ok: false, value: null, text: '', detail: '', normal: null, status: null, interpretation: '', summary: '', uncalibrated: false, needsCalibration: !!tpl.needsCalibration, env };
    if (!res.complete) return res;
    const fn = FUNCS[tpl.compute.fn];
    if (!fn) return res;
    const r = fn(tpl.compute, env, o);
    if (!r) return res;
    if (r.uncalibrated) { res.uncalibrated = true; res.text = 'needs calibration'; return res; }
    if (r.value == null || !isFinite(r.value)) return res;
    res.ok = true; res.value = r.value; res.dev = r.dev;
    const dp = tpl.decimals != null ? tpl.decimals : (tpl.unit === 'ratio' ? 2 : 1);
    const sign = tpl.signed && r.value > 0 ? '+' : '';
    res.text = sign + fmtNum(r.value, dp) + (UNIT[tpl.unit] || '');
    const on = (tpl.interpretOn || (tpl.normal && tpl.normal.on) || 'value');
    const ov = on === 'dev' ? r.dev : r.value;
    if (tpl.detail && ov != null) {
      const dd = tpl.detail.on === 'dev' ? r.dev : r.value;
      res.detail = `${dd >= 0 ? tpl.detail.pos : tpl.detail.neg} ${fmtNum(Math.abs(dd), dp)}${UNIT[tpl.unit] || ''}`.trim();
    }
    if (tpl.normal) {
      const n = tpl.normal, nv = (n.on === 'dev' ? r.dev : r.value);
      res.normal = { text: n.text, min: n.min, max: n.max };
      res.status = (n.min != null && nv < n.min) ? 'low' : (n.max != null && nv > n.max) ? 'high' : 'normal';
    }
    const rule = (tpl.interpret || []).find((c) => matches(c, ov));
    res.interpretation = rule ? rule.text : '';
    res.summary = `${tpl.name} ${res.text.replace(/ ratio$/, '')}${res.detail ? ' (' + res.detail + ')' : ''}${res.normal ? ' – Normal ' + res.normal.text : ''}${res.interpretation ? ' → ' + res.interpretation : ''}`;
    return res;
  }

  /**
   * Live drawing plan (image coordinates) for the points placed so far. Only elements whose inputs exist are returned.
   * kinds: seg {a,b,style} · line {a,b,style} (infinite, caller extends) · circle {c,r} · cross {p} · perp {a,b,style}
   */
  function plan(tpl, pts) {
    const env = resolve(tpl, pts), out = [];
    (tpl.draw || []).forEach((d) => {
      if (d.op === 'segment' || d.op === 'line') {
        const p = getAll(env, [d.a, d.b]); if (p) out.push({ k: d.op === 'line' ? 'line' : 'seg', a: p[0], b: p[1], style: d.style || 'solid' });
      } else if (d.op === 'circle') {
        const c = env[d.of]; if (c && typeof c.r === 'number') out.push({ k: 'circle', c: { x: c.x, y: c.y }, r: c.r });
      } else if (d.op === 'cross') {
        const c = env[d.ref]; if (isPt(c)) out.push({ k: 'cross', p: { x: c.x, y: c.y } });
      } else if (d.op === 'perp') {
        const t = getAll(env, d.to), th = env[d.through];
        if (t && isPt(th)) {
          const n = upPerp(t[0], t[1]), L = Math.max(30, dist(t[0], t[1]) / 2);
          out.push({ k: 'seg', a: { x: th.x, y: th.y }, b: { x: th.x + n.x * L, y: th.y + n.y * L }, style: d.style || 'dashed' });
        }
      }
    });
    return out;
  }

  return {
    // primitives + new geometry (exported for tests and for the app)
    dist, angleAt, lineAngle, midpoint, circleCenter, angleBetweenVectors, lineTiltUp, tiltFromPerpendicular, distanceAlongAxis, hka, upPerp,
    // template engine
    FUNCS, resolve, evaluate, plan,
  };
});
