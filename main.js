/* Colorpoop — a page you can scribble on, a desktop of windows, hash-routed sections. No dependencies. */
(() => {
  const body = document.body;
  const pc = document.getElementById('pc');
  const film = document.getElementById('film');
  const pad = document.getElementById('pad');
  const ctx = pc.getContext && pc.getContext('2d');
  const wins = [...document.querySelectorAll('.win')];
  const lights = document.getElementById('lights');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SECTIONS = wins.map(a => a.hash.slice(1));

  const PALETTE = {
    dark: ['#ff7fd0', '#b9a3ff', '#8ff0c8', '#ffe36b', '#6f7bff', '#fff4fb'],
    light: ['#1c27e6', '#2330f0', '#3a45ff', '#1c27e6', '#5a2be0', '#2330f0'],
  };
  const FILM = {
    dark: { base: [10, 6, 18], blobs: [[58, 34, 150], [120, 36, 120], [24, 30, 150], [40, 90, 110]], gain: .55 },
    light: { base: [246, 214, 246], blobs: [[176, 160, 255], [255, 196, 236], [196, 176, 255], [214, 226, 255]], gain: .9 },
  };

  let W = 0, H = 0, DPR = 1, N = 0, M = 0, CAP = 0, head = 0;
  let X, Y, VX, VY, TX, TY, SEED;
  let state = 'home', current = null, scrollOff = 0, dustA = .4;
  let mode = 'dark', drawing = false, seeded = false;
  const ptr = { x: -9999, y: -9999 };

  try { if (localStorage.getItem('cp-lights') === 'on') setMode('light'); } catch (e) {}
  if (!ctx) body.classList.add('no-fx');

  /* ---------- routing ---------- */
  function route() {
    const h = location.hash.slice(1), prev = current, was = state;
    if (SECTIONS.includes(h)) { state = 'sec'; current = h; } else { state = 'home'; current = null; }
    body.dataset.state = state;
    document.querySelectorAll('.sec').forEach(s => {
      const on = s.id === 'sec-' + current;
      if (on) {
        s.classList.add('on');
        if (prev !== current) s.scrollTop = 0;
        requestAnimationFrame(() => requestAnimationFrame(() => s.classList.add('in')));
      } else s.classList.remove('on', 'in');
    });
    document.title = current ? `${activeSec().querySelector('h2').textContent} — Colorpoop` : 'Colorpoop';
    if (state === 'sec') { retarget(); activeSec().focus({ preventScroll: true }); }
    else if (was === 'sec') { release(); seedDoodle(); }
  }
  const activeSec = () => document.getElementById('sec-' + current);
  const goHome = () => { history.pushState(null, '', location.pathname + location.search); route(); };

  addEventListener('hashchange', route);
  addEventListener('keydown', e => { if (e.key === 'Escape' && state === 'sec') goHome(); });
  document.getElementById('mark').addEventListener('click', e => { e.preventDefault(); goHome(); });
  document.querySelectorAll('.sec').forEach(s => {
    s.tabIndex = -1;
    s.style.outline = 'none';
    s.addEventListener('scroll', () => { if (s.id === 'sec-' + current) scrollOff = s.scrollTop; }, { passive: true });
  });

  /* ---------- lights ---------- */
  function setMode(m) {
    mode = m;
    body.classList.toggle('light', m === 'light');
    lights.setAttribute('aria-pressed', String(m === 'light'));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = m === 'light' ? '#efd3f6' : '#0a0612';
  }
  lights.addEventListener('click', () => {
    setMode(mode === 'dark' ? 'light' : 'dark');
    try { localStorage.setItem('cp-lights', mode === 'light' ? 'on' : 'off'); } catch (e) {}
    drawFilm(performance.now(), true);
  });

  /* ---------- desktop windows: drag them around, click to open ---------- */
  let topZ = 1;
  wins.forEach(win => {
    let down = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
    win.addEventListener('pointerdown', e => {
      win.style.zIndex = ++topZ;
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; moved = false; sx = e.clientX; sy = e.clientY;
      ox = parseFloat(win.style.getPropertyValue('--dx')) || 0;
      oy = parseFloat(win.style.getPropertyValue('--dy')) || 0;
      win.setPointerCapture(e.pointerId);
    });
    win.addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.hypot(dx, dy) < 5) return;
      moved = true; win.classList.add('drag');
      win.style.setProperty('--dx', ox + dx + 'px');
      win.style.setProperty('--dy', oy + dy + 'px');
    });
    const end = () => { down = false; win.classList.remove('drag'); };
    win.addEventListener('pointerup', end);
    win.addEventListener('pointercancel', end);
    win.addEventListener('click', e => { if (moved) { e.preventDefault(); moved = false; } });
    win.addEventListener('dragstart', e => e.preventDefault());
  });

  /* ---------- drag-to-scroll photo strips ---------- */
  document.querySelectorAll('.strip').forEach(strip => {
    let down = false, sx = 0, sl = 0;
    strip.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse') return;
      down = true; sx = e.clientX; sl = strip.scrollLeft;
    });
    addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 4) strip.classList.add('drag');
      strip.scrollLeft = sl - dx;
    });
    addEventListener('pointerup', () => { down = false; strip.classList.remove('drag'); });
    strip.addEventListener('dragstart', e => e.preventDefault());
  });

  /* ---------- background: low-res drifting colour, upscaled into big pixels ---------- */
  const fctx = film.getContext && film.getContext('2d');
  let lastFilm = 0;
  function sizeFilm() {
    const cell = innerWidth < 720 ? 26 : 44;
    film.width = Math.max(8, Math.round(innerWidth / cell));
    film.height = Math.max(8, Math.round(innerHeight / cell));
  }
  function drawFilm(t, force) {
    if (!fctx || (!force && t - lastFilm < 90)) return;
    lastFilm = t;
    const f = FILM[mode], w = film.width, h = film.height;
    const img = fctx.createImageData(w, h), d = img.data, s = t * .00012;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let r = f.base[0], g = f.base[1], b = f.base[2];
      const u = x / w, v = y / h;
      for (let k = 0; k < f.blobs.length; k++) {
        const cx = .5 + .45 * Math.sin(s * (1.3 + k * .7) + k * 2.1);
        const cy = .5 + .45 * Math.cos(s * (1.1 + k * .5) + k * 1.3);
        const dd = (u - cx) * (u - cx) + (v - cy) * (v - cy);
        const a = Math.max(0, 1 - dd * 5.5) * f.gain;
        const c = f.blobs[k];
        r += (c[0] - r) * a; g += (c[1] - g) * a; b += (c[2] - b) * a;
      }
      const n = (hash(x * 7 + y * 131 + Math.floor(t / 420) * 17) - .5) * (mode === 'dark' ? 14 : 12);
      const i = (y * w + x) * 4;
      d[i] = r + n; d[i + 1] = g + n; d[i + 2] = b + n; d[i + 3] = 255;
    }
    fctx.putImageData(img, 0, 0);
  }
  function hash(n) { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); }

  /* ---------- particles: dust that becomes your drawing, then the section title ---------- */
  function resize() {
    sizeFilm(); drawFilm(performance.now(), true);
    if (!ctx) return;
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    pc.width = Math.round(W * DPR); pc.height = Math.round(H * DPR);
    const n = Math.round(Math.min(12000, Math.max(3500, W * H / 95)));
    if (n !== N) {
      N = n; CAP = Math.floor(N * .9);
      X = new Float32Array(N); Y = new Float32Array(N); VX = new Float32Array(N); VY = new Float32Array(N);
      TX = new Float32Array(N); TY = new Float32Array(N); SEED = new Float32Array(N);
      for (let i = 0; i < N; i++) { X[i] = Math.random() * W; Y[i] = Math.random() * H; SEED[i] = Math.random() * 6.283; }
      M = 0; head = 0; seeded = false;
    }
    if (state === 'sec') retarget(); else seedDoodle();
  }

  function bakeScroll() {
    if (ctx && scrollOff) for (let i = 0; i < M; i++) Y[i] -= scrollOff;
    scrollOff = 0;
  }

  /* let go of every particle: the shape bursts back into dust */
  function release() {
    if (!ctx) return;
    bakeScroll();
    for (let i = 0; i < M; i++) { VX[i] += (Math.random() - .5) * 14; VY[i] += (Math.random() - .5) * 14; }
    M = 0; head = 0; seeded = false;
  }

  /* pull dust onto a brush stroke; when the dust runs out, the oldest ink is reused */
  function ink(x0, y0, x1, y1, r) {
    if (!ctx || !N) return;
    const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(10, Math.round(len * 1.7));
    for (let k = 0; k < n; k++) {
      let i;
      if (M < CAP) i = M++; else { i = head; head = (head + 1) % CAP; }
      const t = Math.random(), a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * r;
      TX[i] = x0 + (x1 - x0) * t + Math.cos(a) * d;
      TY[i] = y0 + (y1 - y0) * t + Math.sin(a) * d;
      if (reduce) { X[i] = TX[i]; Y[i] = TY[i]; VX[i] = VY[i] = 0; }
    }
  }
  const brush = () => (W < 720 ? 3.5 : 5);

  /* something stupid to start from: a little swirl with eyes */
  function seedDoodle() {
    if (!ctx || seeded || state !== 'home' || !N) return;
    seeded = true;
    const small = W < 720;
    const cx = small ? W * .5 : W * .2, by = small ? H * .56 : H * .56, s = small ? Math.min(W, H) * .0011 : Math.min(W, H) * .0013;
    let px, py;
    for (let k = 0; k <= 150; k++) {
      const t = k / 150, a = t * Math.PI * 5.5 + Math.PI, rx = (96 - 84 * t) * s * 1.25;
      const x = cx + Math.cos(a) * rx, y = by - t * 118 * s + Math.sin(a) * rx * .34;
      if (k) ink(px, py, x, y, brush() * .8);
      px = x; py = y;
    }
    ink(px, py, px + 16 * s, py - 22 * s, brush() * .7);
    const ey = by - 4 * s;
    for (let k = 0; k < 5; k++) {
      ink(cx - 30 * s, ey, cx - 30 * s, ey + 1, brush() * 1.2);
      ink(cx + 30 * s, ey, cx + 30 * s, ey + 1, brush() * 1.2);
    }
  }

  let lx = 0, ly = 0;
  pad.addEventListener('pointerdown', e => {
    if (e.button) return;
    drawing = true; lx = e.clientX; ly = e.clientY;
    pad.setPointerCapture(e.pointerId);
    ink(lx, ly, lx, ly, brush());
    e.preventDefault();
  });
  pad.addEventListener('pointermove', e => {
    if (!drawing) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const c of (evs.length ? evs : [e])) { ink(lx, ly, c.clientX, c.clientY, brush()); lx = c.clientX; ly = c.clientY; }
  });
  const stop = () => { drawing = false; };
  pad.addEventListener('pointerup', stop);
  pad.addEventListener('pointercancel', stop);
  document.getElementById('flush').addEventListener('click', release);

  const off = document.createElement('canvas');
  const octx = off.getContext('2d', { willReadFrequently: true });

  /* sample a heading's glyphs into target points */
  function textPoints(el, step) {
    const pts = [], r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return pts;
    const padPx = 6, w = Math.ceil(r.width) + padPx * 2, h = Math.ceil(r.height) + padPx * 2;
    off.width = w; off.height = h;
    const cs = getComputedStyle(el);
    octx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    if ('letterSpacing' in octx) octx.letterSpacing = cs.letterSpacing;
    octx.textBaseline = 'middle';
    octx.fillStyle = '#fff';
    octx.fillText(el.textContent, padPx, padPx + r.height / 2 + parseFloat(cs.fontSize) * .04);
    const d = octx.getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
      if (d[((y | 0) * w + (x | 0)) * 4 + 3] > 110) pts.push(r.left - padPx + x, r.top - padPx + y);
    }
    return pts;
  }

  /* section opened: whatever was drawn rearranges itself into the title */
  function retarget() {
    if (!ctx || !N || state !== 'sec') return;
    bakeScroll();
    const h2 = activeSec().querySelector('h2');
    let step = 2, pts = textPoints(h2, step);
    while (pts.length / 2 > CAP && step < 8) { step *= 1.15; pts = textPoints(h2, step); }
    const count = Math.min(pts.length / 2, CAP);
    const order = new Uint32Array(pts.length / 2);
    for (let i = 0; i < order.length; i++) order[i] = i;
    for (let i = order.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = order[i]; order[i] = order[j]; order[j] = t; }
    const sy = activeSec().scrollTop;
    for (let i = 0; i < count; i++) { const p = order[i] * 2; TX[i] = pts[p]; TY[i] = pts[p + 1] + sy; }
    if (sy) for (let i = 0; i < count; i++) Y[i] += sy;
    scrollOff = sy;
    for (let i = count; i < M; i++) { VX[i] += (Math.random() - .5) * 9; VY[i] += (Math.random() - .5) * 9; }
    M = count; head = 0;
    if (reduce) for (let i = 0; i < M; i++) { X[i] = TX[i]; Y[i] = TY[i]; VX[i] = VY[i] = 0; }
  }

  function frame(t) {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    if (!reduce) drawFilm(t);
    if (!ctx || !N) return;
    const cols = PALETTE[mode], K = cols.length;
    const px = ptr.x, py = ptr.y + scrollOff, R = 86, R2 = R * R;
    const jit = reduce ? 0 : state === 'sec' ? .26 : .34;
    const push = !drawing;

    for (let i = 0; i < M; i++) {
      let vx = (VX[i] + (TX[i] - X[i]) * .055) * .82 + (Math.random() - .5) * jit;
      let vy = (VY[i] + (TY[i] - Y[i]) * .055) * .82 + (Math.random() - .5) * jit;
      if (push) {
        const dx = X[i] - px, dy = Y[i] - py, d2 = dx * dx + dy * dy;
        if (d2 < R2 && d2 > .01) { const f = (1 - d2 / R2) * 2.6 / Math.sqrt(d2); vx += dx * f; vy += dy * f; }
      }
      VX[i] = vx; VY[i] = vy; X[i] += vx; Y[i] += vy;
    }
    if (!reduce) {
      const s = t * .0004;
      for (let i = M; i < N; i++) {
        let vx = VX[i] * .96 + Math.cos(SEED[i] + s + Y[i] * .004) * .012;
        let vy = VY[i] * .96 + Math.sin(SEED[i] * 1.7 + s + X[i] * .004) * .012 + .004;
        const dx = X[i] - ptr.x, dy = Y[i] - ptr.y, d2 = dx * dx + dy * dy;
        if (d2 < R2 && d2 > .01) { const f = (1 - d2 / R2) * .9 / Math.sqrt(d2); vx += dx * f; vy += dy * f; }
        VX[i] = vx; VY[i] = vy; X[i] += vx; Y[i] += vy;
        if (X[i] < -4) X[i] += W + 8; else if (X[i] > W + 4) X[i] -= W + 8;
        if (Y[i] < -4) Y[i] += H + 8; else if (Y[i] > H + 4) Y[i] -= H + 8;
      }
    }
    dustA += ((state === 'sec' ? 0 : (mode === 'dark' ? .42 : .5)) - dustA) * .06;

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const sz = W < 720 ? 1.6 : 2;
    ctx.globalAlpha = 1;
    for (let k = 0; k < K; k++) {
      ctx.fillStyle = cols[k];
      for (let i = k; i < M; i += K) ctx.fillRect(X[i], Y[i] - scrollOff, sz, sz);
    }
    if (dustA > .01) {
      ctx.globalAlpha = dustA;
      for (let k = 0; k < K; k++) {
        ctx.fillStyle = cols[k];
        for (let i = M + k; i < N; i += K) ctx.fillRect(X[i], Y[i], sz, sz);
      }
    }
  }

  addEventListener('pointermove', e => { ptr.x = e.clientX; ptr.y = e.clientY; }, { passive: true });
  addEventListener('pointerdown', e => { ptr.x = e.clientX; ptr.y = e.clientY; }, { passive: true });
  addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') ptr.x = ptr.y = -9999; }, { passive: true });
  document.addEventListener('pointerleave', () => { ptr.x = ptr.y = -9999; });

  let rz;
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(resize, 120); });

  /* ---------- boot ---------- */
  resize();
  route();
  requestAnimationFrame(frame);
  if (document.fonts && document.fonts.ready) {
    Promise.all([document.fonts.load('500 80px "Space Grotesk"'), document.fonts.ready]).then(retarget, retarget);
  }
})();
