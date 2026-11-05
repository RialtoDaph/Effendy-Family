(function () {
  const PAL = ['#E8D9B5', '#8FB8FF', '#C8A8FF', '#7DD3A0', '#F4F2EC', '#F0957A'], TAU = Math.PI * 2;
  const ss = v => v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v);
  const CAT = [[1150, 2], [380, 0], [58, 1], [135, 0], [600, 3], [917, 4]];
  const MODES = { calm: [1, 0, 1, 1], listen: [1.2, .05, 1.04, 1], think: [4.5, .01, .86, .85], speak: [1.6, .11, 1.08, 1], confirm: [.8, .02, 1, 1], muted: [.4, 0, .92, .3] };

  function makeP(N, W, H) {
    return Array.from({ length: N }, (_, i) => {
      const y = 1 - (i + .5) / N * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996, sx = Math.cos(th) * r, sz = Math.sin(th) * r, r5 = Math.random();
      return { sx, sy: y, sz, lg: Math.floor((Math.atan2(sz, sx) + Math.PI) / (Math.PI / 2)) % 4, g: i % 4, r1: Math.random(), r2: Math.random(), r3: Math.random(), r4: Math.random(), r5, sp: r5 > .975, s: .5 + Math.random() * .75, tw: Math.random() * 50, x: Math.random() * W, y: Math.random() * H, a: 0, c: 0, k: .04 + Math.random() * .05 };
    });
  }

  function build(P, sg, W, H, b, E) {
    const [bx, by, bw, bh] = b, cx = bx + bw / 2, cy = by + bh / 2, m = Math.min(bw, bh);
    if (sg.t === 'orb') { const R = m * .42; return (p, t) => { const a = E.ang, tl = .35, x1 = p.sx * Math.cos(a) + p.sz * Math.sin(a), z1 = -p.sx * Math.sin(a) + p.sz * Math.cos(a), Y = p.sy * Math.cos(tl) - z1 * Math.sin(tl), Z = p.sy * Math.sin(tl) + z1 * Math.cos(tl), r = R * E.rs * (1 + .022 * Math.sin(t * 2 + p.sy * 5) + E.pulse * Math.sin(t * 9 + p.sy * 7 + p.sx * 3)), f = 1.2 / (1.6 - Z * .4); return [cx + x1 * r * f, cy + Y * r * f, p.lg, (.14 + (Z + 1) * .4) * E.al]; }; }
    if (sg.t === 'effi') {
      const R = m * .42, es = sg.e || 1;
      return (p, t) => {
        const hp = E.hp, bl = (t % 3.4) < .12 ? .15 : 1, b = -Math.abs(Math.sin(t * 6)) * hp * R * .12;
        const ex = E.lx * R * .14, ey = -R * .08 + E.ly * R * .12 + b, sp = R * .28, big = 1 + .12 * E.ls, rx = R * .11 * es * big, ry = R * .15 * es * big * bl;
        const jx = Math.sin(t * 1.3 + p.tw) * R * .012, jy = Math.cos(t * 1.1 + p.tw * 1.7) * R * .012;
        if (p.r1 < .14) {
          const s = p.r3 < .5 ? -1 : 1;
          if (hp > .5) {
            if (p.r4 < .25) { const a = p.r5 * TAU * 7, d = Math.sqrt(p.r2); return [cx + s * R * .5 + Math.cos(a) * d * R * .12, cy + b + R * .16 + Math.sin(a) * d * R * .07, 5, .55 * E.al]; }
            const an = -Math.PI * (.1 + p.r2 * .8), rr = R * (.1 + (p.r5 - .5) * .05) * es; return [cx + s * sp + Math.cos(an) * rr, cy + b + R * .02 + Math.sin(an) * rr, 4, E.al, 1.9];
          }
          const a = p.r5 * TAU * 7, d = Math.sqrt(p.r2); return [cx + s * sp + ex + Math.cos(a) * d * rx, cy + ey + Math.sin(a) * d * ry, 4, E.al, 1.9];
        }
        if (E.ls > .5 && p.r4 > .95) { const ph = (t * .7 + p.r5 * 30) % 1, a = p.r5 * TAU * 13, rr = R * (1.04 + ph * .45); return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 0, (1 - ph) * .6 * E.al]; }
        if (E.th > .5 && p.r4 > .965) { const a = t * 2.2 + p.r5 * 60, rr = R * 1.2; return [cx + Math.cos(a) * rr + jx, cy + Math.sin(a) * rr + jy, 4, .7 * E.al]; }
        const a = p.r5 * TAU * 13 + E.ang * .12, rim = p.r1 < .32, d = rim ? 1 - p.r2 * .05 : Math.pow(p.r2, .55);
        const wob = 1 + .035 * Math.sin(3 * a + t * 1.3) + .025 * Math.sin(5 * a - t * 1.7) + E.pulse * Math.sin(t * 9 + a * 4), rr = R * E.rs * wob * d;
        const px = cx + Math.cos(a) * rr + jx, py = cy + b + Math.sin(a) * rr * (1 - .05 * hp) + jy;
        let al = rim ? .75 : .4;
        if (hp < .5) for (const s of [-1, 1]) { const dx = (px - (cx + s * sp + ex)) / (rx * 1.35), dy = (py - (cy + ey)) / (ry * 1.25); if (dx * dx + dy * dy < 1) al *= .12; }
        return [px, py, 0, al * E.al];
      };
    }
    if (sg.t === 'tree') {
      const s = m / 420, root = [cx, by + bh * .1], nodes = [.12, .37, .63, .88].map(f => [bx + bw * f, by + bh * .46]), ly = by + bh * .9, lo = bw * .075;
      return (p, t, i) => {
        const g = p.g, nd = nodes[g], w = Math.sin(t * 1.5 + i) * 1.2 * s, L = [nd[0] + (Math.floor(p.r3 * 3) - 1) * lo, ly];
        const pol = (x0, y0, R) => { const r = R * Math.pow(p.r2, .7), a = p.r5 * TAU * 13; return [x0 + Math.cos(a) * r + w, y0 + Math.sin(a) * r]; };
        if (p.r1 < .1) return [...pol(root[0], root[1], 30 * s), 4, .8];
        if (p.r1 < .32) { const u = (p.r2 + t * .06) % 1, j = (p.r5 - .5) * 6 * s; return [root[0] + (nd[0] - root[0]) * u + j, root[1] + (nd[1] - root[1]) * u, g, .5]; }
        if (p.r1 < .52) return [...pol(nd[0], nd[1], 24 * s), g, .85];
        if (p.r1 < .8) { const u = (p.r2 + t * .08) % 1, j = (p.r5 - .5) * 4 * s; return [nd[0] + (L[0] - nd[0]) * u + j, nd[1] + (L[1] - nd[1]) * u, g, .45]; }
        return [...pol(L[0], L[1], 11 * s), g, .85];
      };
    }
    if (sg.t === 'flow') {
      const x0 = bx + bw * .06, x1 = bx + bw * .94, Hsrc = bh * .36, sy = cy - Hsrc / 2, gap = bh * .05, Hs = bh * .9 - 5 * gap, st0 = by + bh * .05; let cum = 0;
      const cats = CAT.map(([v, col], k) => { const f = v / 3240, o = { f, col, s: cum, top: st0 + cum * Hs + k * gap }; cum += f; return o; });
      return (p, t) => { let k = 0; while (k < 5 && p.r1 > cats[k].s + cats[k].f) k++; const ct = cats[k], ys = sy + (ct.s + p.r2 * ct.f) * Hsrc, yt = ct.top + p.r2 * ct.f * Hs; let u = (p.r3 + t * .1) % 1; const end = p.r5 < .22; if (end) u = p.r3 < .4 ? p.r4 * .02 : 1 - p.r4 * .02; return [x0 + u * (x1 - x0), ys + (yt - ys) * ss(u), ct.col, end ? .95 : ct.col === 4 ? .6 : .42]; };
    }
    if (sg.t === 'fill') {
      const R = m * .42, LV = cy + R - 2 * R * (sg.v ?? .66);
      const F = P.map(() => { let fx, fy, n = 0; do { fx = cx + (Math.random() * 2 - 1) * R; fy = LV + Math.random() * (cy + R - LV); n++; } while (n < 40 && (fx - cx) ** 2 + (fy - cy) ** 2 > (R * .96) ** 2); return [fx, fy]; });
      return (p, t, i) => { if (p.r1 < .14) { const a = p.r2 * TAU + t * .05; return [cx + Math.cos(a) * R, cy + Math.sin(a) * R, 3, .55]; } if (p.r1 < .2) return [cx + (p.r2 - .5) * R * .6, by + ((p.r3 + t * .35) % 1) * (LV - by), 3, .9]; const [fx, fy] = F[i], sf = Math.max(0, 1 - (fy - LV) / (R * .3)); return [fx, fy + Math.sin(fx * .025 + t * 2) * R * .03 * sf, 3, .75]; };
    }
    const o = document.createElement('canvas'); o.width = W; o.height = H;
    const ox = o.getContext('2d'), str = String(sg.s || ''), fs = Math.min(bh * .85, bw / (Math.max(1, str.length) * .52));
    ox.fillStyle = '#fff'; ox.font = `400 ${fs}px 'Instrument Serif', serif`; ox.textAlign = 'center'; ox.textBaseline = 'middle'; ox.fillText(str, cx, cy + fs * .04);
    const dt = ox.getImageData(0, 0, W, H).data, stp = fs > 160 ? 2.5 : 1.5, pts = [];
    for (let y = 0; y < H; y += stp) for (let xx = 0; xx < W; xx += stp) { const yi = y | 0, xi = xx | 0; if (dt[(yi * W + xi) * 4 + 3] > 128) pts.push([xx, y]); }
    for (let i = pts.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [pts[i], pts[j]] = [pts[j], pts[i]]; }
    const A = P.map((_, i) => { const q = pts[i % (pts.length || 1)] || [cx, cy]; return [q[0] + (Math.random() - .5), q[1] + (Math.random() - .5)]; });
    return (p, t, i) => [A[i][0], A[i][1], 0, .92];
  }

  function create(el, opts) {
    const c = document.createElement('canvas'); c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    el.appendChild(c);
    const x = c.getContext('2d'), reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches), per = opts.period || 6.5;
    const E = { ang: 0, spin: 1, pulse: 0, rs: 1, al: 1, tgt: MODES.calm, mode: 'calm', hp: 0, ls: 0, th: 0, lx: 0, ly: 0 };
    let pal = PAL, comp = 'lighter', trail = 'rgba(0,0,0,.3)', fr = 0, dark = true;
    const theme = () => { const host = el.parentElement || el, cs = getComputedStyle(host), m = (cs.backgroundColor.match(/[\d.]+/g) || [0, 0, 0]).map(Number), a = m.length > 3 ? m[3] : 1, lum = (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255, v = k => cs.getPropertyValue(k).trim(); dark = a < .1 || lum < .4; const bg = a < .1 ? [0, 0, 0] : m; trail = 'rgba(' + bg[0] + ',' + bg[1] + ',' + bg[2] + ',.3)'; comp = dark ? 'lighter' : 'source-over'; pal = dark ? PAL : [v('--acc') || '#B4692B', '#3D6FD9', '#7B5BD6', v('--ok') || '#0E9F5B', v('--ink') || '#0B0D10', '#D9694A']; };
    let W = 1, H = 1, P = [], T = [], stages = opts.stages, key = JSON.stringify(stages), k = 0, sw = 0, t = 0, last = performance.now(), raf = 0, vis = true, mouse = null, pend = 0, rz = 0, dead = false;
    const rebuild = () => { const pad = Math.min(W, H) * .06; T = stages.map(sg => build(P, sg, W, H, [pad, pad, W - 2 * pad, H - 2 * pad], E)); };
    const layout = () => {
      const r = el.getBoundingClientRect(); W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height)); if (W < 8 || H < 8) return;
      const d = Math.min(2, window.devicePixelRatio || 1); c.width = W * d; c.height = H * d; x.setTransform(d, 0, 0, d, 0, 0);
      const N = Math.min(opts.n || Math.max(900, Math.min(3200, Math.round(W * H / 52))), 3200); if (P.length !== N) P = makeP(N, W, H); rebuild();
    };
    const go = i => { k = ((i % stages.length) + stages.length) % stages.length; sw = t; opts.onStage && opts.onStage(k); };
    const frame = now => {
      if (dead) return; const dt = Math.min(.1, (now - last) / 1000); last = now;
      if (!vis || document.hidden || W < 8 || H < 8 || !el.isConnected || el.offsetParent === null) { raf = requestAnimationFrame(frame); return; }
      t += dt; if (!reduce && opts.auto !== false && t - sw > per) go(k + 1);
      const tg = E.tgt; E.spin += (tg[0] - E.spin) * .05; E.pulse += (tg[1] - E.pulse) * .08; E.rs += (tg[2] - E.rs) * .06; E.al += (tg[3] - E.al) * .06; E.ang += dt * .3 * E.spin;
      { const md = E.mode, th = md === 'think', lxT = th ? .9 : mouse && isFinite(mouse[0]) ? Math.max(-1, Math.min(1, (mouse[0] / W - .5) * 2.4)) : Math.sin(t * .7) * .5, lyT = th ? -1 : mouse && isFinite(mouse[1]) ? Math.max(-1, Math.min(1, (mouse[1] / H - .5) * 2.4)) : Math.sin(t * .5) * .25; E.lx += (lxT - E.lx) * .08; E.ly += (lyT - E.ly) * .08; E.hp += ((md === 'confirm' ? 1 : 0) - E.hp) * .1; E.ls += ((md === 'listen' ? 1 : 0) - E.ls) * .1; E.th += ((th ? 1 : 0) - E.th) * .1; }
      const fn = T[k], el2 = t - sw, base = opts.sz || 1.1; if (!fn) { raf = requestAnimationFrame(frame); return; }
      if (fr++ % 30 === 0) theme();
      x.globalAlpha = 1; if (fr % 90 === 0) x.clearRect(0, 0, W, H); else { x.globalCompositeOperation = 'destination-out'; x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(0, 0, W, H); } x.globalCompositeOperation = comp;
      for (let i = 0; i < P.length; i++) {
        const p = P[i], g = fn(p, t, i), kk = reduce ? 1 : p.k; p.x += (g[0] - p.x) * kk; p.y += (g[1] - p.y) * kk; p.a += (g[3] - p.a) * (reduce ? 1 : .06); if (reduce || el2 > p.r4 * .9) p.c = g[2];
        if (mouse && opts.repel !== false) { const dx = p.x - mouse[0], dy = p.y - mouse[1], dd = Math.hypot(dx, dy); if (dd < 70 && dd > .1) { const f = (70 - dd) * .25 / dd; p.x += dx * f; p.y += dy * f; } }
        const big = g[4] || 1, tw = big > 1 ? 1 : .72 + .28 * Math.sin(t * 2.2 + p.tw), al = p.a * tw * (dark ? 1 : 1.15);
        x.fillStyle = pal[p.c];
        if (p.sp) { x.globalAlpha = al * .16; x.beginPath(); x.arc(p.x, p.y, base * 2.6, 0, TAU); x.fill(); x.globalAlpha = Math.min(1, al * 1.4); const z = base * 1.5; x.fillRect(p.x - z / 2, p.y - z / 2, z, z); }
        else { x.globalAlpha = al; const z = base * p.s * big; x.fillRect(p.x - z / 2, p.y - z / 2, z, z); }
      }
      raf = requestAnimationFrame(frame);
    };
    const onMove = e => { const r = el.getBoundingClientRect(); mouse = [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; }, onLeave = () => { mouse = null; };
    el.addEventListener('pointermove', onMove); el.addEventListener('pointerleave', onLeave);
    const ro = window.ResizeObserver ? new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(layout, 150); }) : null; ro && ro.observe(el);
    const io = window.IntersectionObserver ? new IntersectionObserver(es => es.forEach(e => { vis = e.isIntersecting; })) : null; io && io.observe(el);
    layout();
    (document.fonts ? document.fonts.load("400 100px 'Instrument Serif'") : Promise.resolve()).then(rebuild, rebuild);
    raf = requestAnimationFrame(frame);
    return {
      go,
      setMode(mode) { E.tgt = MODES[mode] || MODES.calm; E.mode = MODES[mode] ? mode : 'calm'; },
      setStages(st) { const j = JSON.stringify(st); if (j === key) return; key = j; clearTimeout(pend); pend = setTimeout(() => { stages = st; rebuild(); }, 350); },
      destroy() { dead = true; cancelAnimationFrame(raf); clearTimeout(pend); clearTimeout(rz); ro && ro.disconnect(); io && io.disconnect(); el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerleave', onLeave); c.remove(); },
    };
  }

  window.RideffParticles = { create };
})();
