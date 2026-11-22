/* Colorpoop — particle wordmark, scattered menu, hash-routed sections. No dependencies. */
(() => {
  const body = document.body;
  const pc = document.getElementById('pc');
  const film = document.getElementById('film');
  const ctx = pc.getContext && pc.getContext('2d');
  const logoImg = document.querySelector('#logo img');
  const wordLinks = [...document.querySelectorAll('#words a')];
  const lights = document.getElementById('lights');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SECTIONS = wordLinks.map(a => a.hash.slice(1));

  const PALETTE = {
    dark: ['#ff7fd0', '#b9a3ff', '#8ff0c8', '#ffe36b', '#6f7bff', '#fff4fb'],
    light: ['#1c27e6', '#2330f0', '#3a45ff', '#1c27e6', '#5a2be0', '#2330f0'],
  };
  const FILM = {
    dark: { base: [10, 6, 18], blobs: [[58, 34, 150], [120, 36, 120], [24, 30, 150], [40, 90, 110]], gain: .55 },
    light: { base: [246, 214, 246], blobs: [[176, 160, 255], [255, 196, 236], [196, 176, 255], [214, 226, 255]], gain: .9 },
  };

  let W = 0, H = 0, DPR = 1, N = 0, M = 0;
  let X, Y, VX, VY, TX, TY, G, SEED;
  let state = 'rest', current = null, hover = -1, scrollOff = 0, dustA = .4;
  let mode = 'dark';
  const ptr = { x: -9999, y: -9999 };

  try { if (localStorage.getItem('cp-lights') === 'on') setMode('light'); } catch (e) {}

  if (!ctx) { body.classList.add('no-fx'); }

  /* ---------- routing ---------- */
  function route() {
    const h = location.hash.slice(1);
    const prev = current;
    if (SECTIONS.includes(h)) { state = 'sec'; current = h; }
    else if (h === 'menu') { state = 'menu'; current = null; }
    else { state = 'rest'; current = null; }
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
    hover = -1;
    retarget();
    if (state === 'sec') activeSec().focus({ preventScroll: true });
  }
  const activeSec = () => document.getElementById('sec-' + current);

  document.getElementById('logo').addEventListener('click', () => { location.hash = 'menu'; });
  addEventListener('hashchange', route);
  addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (state === 'sec') location.hash = 'menu';
    else if (state === 'menu') history.pushState(null, '', location.pathname + location.search), route();
  });
  document.getElementById('mark').addEventListener('click', e => {
    if (state === 'menu') { e.preventDefault(); history.pushState(null, '', location.pathname + location.search); route(); }
  });
  wordLinks.forEach((a, i) => {
    a.addEventListener('pointerenter', () => { hover = i; });
    a.addEventListener('pointerleave', () => { hover = -1; });
    a.addEventListener('focus', () => { hover = i; });
    a.addEventListener('blur', () => { hover = -1; });
  });
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

  /* ---------- drag-to-scroll photo strips ---------- */
  document.querySelectorAll('.strip').forEach(strip => {
    let down = false, sx = 0, sl = 0, moved = false;
    strip.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse') return;
      down = true; moved = false; sx = e.clientX; sl = strip.scrollLeft;
    });
    addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 4) { moved = true; strip.classList.add('drag'); }
      strip.scrollLeft = sl - dx;
    });
    addEventListener('pointerup', () => { down = false; strip.classList.remove('drag'); });
    strip.addEventListener('dragstart', e => e.preventDefault());
  });

  /* ---------- background film: low-res drifting colour, upscaled into big pixels ---------- */
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
      // per-cell flicker keeps the mosaic alive, like film noise at a huge scale
      const n = (hash(x * 7 + y * 131 + Math.floor(t / 420) * 17) - .5) * (mode === 'dark' ? 14 : 12);
      const i = (y * w + x) * 4;
      d[i] = r + n; d[i + 1] = g + n; d[i + 2] = b + n; d[i + 3] = 255;
    }
    fctx.putImageData(img, 0, 0);
  }
  function hash(n) { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); }

  /* ---------- particles ---------- */
  function resize() {
    sizeFilm(); drawFilm(performance.now(), true);
    if (!ctx) return;
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    pc.width = Math.round(W * DPR); pc.height = Math.round(H * DPR);
    const n = Math.round(Math.min(12000, Math.max(3500, W * H / 95)));
    if (n !== N) {
      N = n;
      X = new Float32Array(N); Y = new Float32Array(N); VX = new Float32Array(N); VY = new Float32Array(N);
      TX = new Float32Array(N); TY = new Float32Array(N); G = new Int16Array(N); SEED = new Float32Array(N);
      for (let i = 0; i < N; i++) { X[i] = Math.random() * W; Y[i] = Math.random() * H; SEED[i] = Math.random() * 6.283; }
      M = 0;
    }
    retarget();
  }

  function bakeScroll() {
    if (!ctx || !scrollOff) { scrollOff = 0; return; }
    for (let i = 0; i < M; i++) Y[i] -= scrollOff;
    scrollOff = 0;
  }

  const off = document.createElement('canvas');
  const octx = off.getContext('2d', { willReadFrequently: true });

  /* Sample the visible shape of each element (image or text) into target points. */
  function shapePoints(items, step) {
    const pts = [];
    items.forEach((it, gi) => {
      const r = it.el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      const pad = 6, w = Math.ceil(r.width) + pad * 2, h = Math.ceil(r.height) + pad * 2;
      off.width = w; off.height = h;
      octx.clearRect(0, 0, w, h);
      if (it.el.tagName === 'IMG') {
        if (!it.el.complete || !it.el.naturalWidth) return;
        octx.drawImage(it.el, pad, pad, r.width, r.height);
      } else {
        const cs = getComputedStyle(it.el);
        octx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        if ('letterSpacing' in octx) octx.letterSpacing = cs.letterSpacing;
        octx.textBaseline = 'middle';
        octx.fillStyle = '#fff';
        octx.fillText(it.el.textContent, pad, pad + r.height / 2 + parseFloat(cs.fontSize) * .04);
      }
      let d;
      try { d = octx.getImageData(0, 0, w, h).data; }
      catch (e) {
        // opened straight from disk: the image taints the canvas, so draw the name as text instead
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const x = c.getContext('2d'), fs = r.width / 6.6;
        x.font = `600 ${fs}px "Space Grotesk", system-ui, sans-serif`;
        x.textBaseline = 'middle'; x.textAlign = 'center'; x.fillStyle = '#fff';
        x.fillText((it.el.alt || '').toUpperCase(), w / 2, h / 2, r.width);
        d = x.getImageData(0, 0, w, h).data;
      }
      for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
        if (d[((y | 0) * w + (x | 0)) * 4 + 3] > 110) pts.push(r.left - pad + x, r.top - pad + y, gi);
      }
    });
    return pts;
  }

  function retarget() {
    if (!ctx || !N) return;
    bakeScroll();
    let items = [];
    if (state === 'rest') items = [{ el: logoImg }];
    else if (state === 'menu') items = wordLinks.map(a => ({ el: a.firstElementChild }));
    else if (current) items = [{ el: activeSec().querySelector('h2') }];
    let step = state === 'sec' ? 2 : 2.4, pts = shapePoints(items, step);
    while (pts.length / 3 > N * .9 && step < 8) { step *= 1.15; pts = shapePoints(items, step); }
    const count = Math.min(pts.length / 3, Math.floor(N * .9));
    // shuffle so every transition is a fresh scramble
    const order = new Uint32Array(pts.length / 3);
    for (let i = 0; i < order.length; i++) order[i] = i;
    for (let i = order.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = order[i]; order[i] = order[j]; order[j] = t; }
    const sy = state === 'sec' ? activeSec().scrollTop : 0;
    for (let i = 0; i < count; i++) {
      const p = order[i] * 3;
      TX[i] = pts[p]; TY[i] = pts[p + 1] + sy; G[i] = pts[p + 2];
    }
    scrollOff = sy;
    if (sy) for (let i = 0; i < count; i++) Y[i] += sy;
    // particles released from a shape get a kick so they drift off as dust
    for (let i = count; i < M; i++) { VX[i] += (Math.random() - .5) * 9; VY[i] += (Math.random() - .5) * 9; }
    M = count;
    if (reduce) for (let i = 0; i < M; i++) { X[i] = TX[i]; Y[i] = TY[i]; VX[i] = VY[i] = 0; }
  }

  function frame(t) {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    if (!reduce) drawFilm(t);
    if (!ctx || !N) return;
    const cols = PALETTE[mode], K = cols.length;
    const px = ptr.x, py = ptr.y + scrollOff, R = 86, R2 = R * R;
    const jit = reduce ? 0 : state === 'sec' ? .26 : W < 720 ? .4 : .55;

    for (let i = 0; i < M; i++) {
      const hot = G[i] === hover;
      let vx = (VX[i] + (TX[i] - X[i]) * .055) * .82;
      let vy = (VY[i] + (TY[i] - Y[i]) * .055) * .82;
      const j = hot ? jit * 3.2 : jit;
      vx += (Math.random() - .5) * j; vy += (Math.random() - .5) * j;
      const dx = X[i] - px, dy = Y[i] - py, d2 = dx * dx + dy * dy;
      if (d2 < R2 && d2 > .01) { const f = (1 - d2 / R2) * 2.6 / Math.sqrt(d2); vx += dx * f; vy += dy * f; }
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
  if (logoImg.complete) retarget(); else logoImg.addEventListener('load', retarget);
  if (document.fonts && document.fonts.ready) {
    Promise.all([document.fonts.load('500 80px "Space Grotesk"'), document.fonts.ready]).then(retarget, retarget);
  }
})();
