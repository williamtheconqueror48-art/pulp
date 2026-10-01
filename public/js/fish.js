/* PULP — "the deep": original ASCII fish scene on canvas.
   Dark water, drifting plankton, rising bubbles, a hand-drawn ASCII fish
   that swims with a sine sway, per-character phosphor flicker, and big
   dim P U L P letters drifting behind. All art drawn in code. */
(function () {
  const canvas = document.getElementById('deep');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const FONT = 15;                    // px monospace
  const CW = FONT * 0.62, CH = FONT * 1.18;
  let COLS = 0, ROWS = 0, W = 0, H = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    COLS = Math.ceil(W / CW); ROWS = Math.ceil(H / CH);
  }
  resize();
  window.addEventListener('resize', resize);

  // --- original fish art, drawn as (dx,dy,ch) strokes ---
  // a deep-water fish, side view, facing left
  const FISH = [
    "              ____",
    "          ___/    \\___",
    "       __/    o        \\__",
    "   __ /                    \\",
    "  <                            >",
    "   \\__                    __/",
    "       \\__            __/",
    "          \\___ __ ___/",
    "               \\/"
  ];
  // tail fin strokes appended at right
  const TAIL = [
    "  \\\\",
    "   \\\\",
    "    >",
    "   //",
    "  //"
  ];

  function hash(x, y, t) {
    let h = Math.sin(x * 127.1 + y * 311.7 + t * 0.7) * 43758.5453;
    return h - Math.floor(h);
  }

  // plankton specks
  const specks = [];
  for (let i = 0; i < 90; i++) specks.push({
    x: Math.random(), y: Math.random(),
    s: 0.2 + Math.random() * 0.8,
    ch: Math.random() < 0.7 ? '.' : '·'
  });
  // bubbles
  const bubbles = [];
  for (let i = 0; i < 26; i++) bubbles.push({
    x: Math.random(), y: Math.random(),
    s: 0.25 + Math.random() * 0.75,
    ch: Math.random() < 0.5 ? 'o' : '°'
  });

  let t0 = performance.now();
  let fishX = -0.35;               // -0.5..1.5 across screen
  const FISH_SPEED = 0.028;        // fraction of width per second

  function drawFish(t) {
    const scale = Math.max(1, Math.floor(W / 900));   // bigger fish on wide screens
    const fx = fishX * W;
    const fy = H * 0.42 + Math.sin(t * 0.5) * H * 0.03;
    const sway = (dy) => Math.sin(t * 2.2 + dy * 0.55) * (3 + dy * 0.55);

    ctx.font = `${FONT * scale}px ui-monospace, Menlo, monospace`;
    ctx.textBaseline = 'top';

    const rows = FISH.map((line, i) => ({ line, dy: i - 4 }));
    // draw tail separately so it sways harder
    const all = rows.concat(TAIL.map((line, i) => ({ line, dy: i - 2, tail: true, tx: 30 })));

    all.forEach(({ line, dy, tail, tx }) => {
      const y = fy + dy * CH * scale + (tail ? Math.sin(t * 2.2) * 6 : 0);
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === ' ') continue;
        const x = fx + (tx || 0) * scale + i * CW * scale + sway(dy) * (tail ? 1.6 : 0.5);
        const fl = hash(i, dy * 7 + (tail ? 99 : 0), t);
        const a = 0.45 + fl * 0.55;                       // flicker
        const glow = fl > 0.93 ? 1 : 0;
        ctx.fillStyle = glow
          ? `rgba(235,255,240,${a})`
          : `rgba(178,224,196,${a * 0.9})`;
        ctx.fillText(ch, x, y);
      }
    });
    // eye glint
    const ex = fx + 13 * CW * scale + sway(-2) * 0.5, ey = fy - 2 * CH * scale;
    ctx.fillStyle = `rgba(240,255,244,${0.5 + 0.5 * hash(7, 7, t)})`;
    ctx.fillText('●', ex, ey);
  }

  function drawLetters(t) {
    // giant dim P U L P drifting behind the fish
    const size = Math.min(W * 0.16, 190);
    ctx.font = `600 ${size}px ui-monospace, Menlo, monospace`;
    ctx.textBaseline = 'middle';
    const word = 'PULP';
    const totalW = ctx.measureText('P U L P').width;
    let x = (W - totalW) / 2 + Math.sin(t * 0.12) * 24;
    const y = H * 0.44 + Math.cos(t * 0.09) * 14;
    for (const ch of word) {
      const fl = hash(ch.charCodeAt(0), 3, t * 1.4);
      const a = 0.05 + fl * 0.075;                        // very dim, breathing
      ctx.fillStyle = `rgba(150,200,175,${a})`;
      ctx.fillText(ch, x, y);
      x += ctx.measureText(ch + ' ').width;
    }
  }

  function frame(now) {
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);

    // faint depth gradient shimmer
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(10,26,43,0.25)');
    g.addColorStop(1, 'rgba(1,2,4,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    drawLetters(t);

    // plankton drift
    ctx.font = `${FONT * 0.8}px ui-monospace, Menlo, monospace`;
    specks.forEach(s => {
      s.x -= 0.00012 * s.s; if (s.x < 0) s.x = 1;
      const a = 0.10 + 0.12 * hash(s.x * 999, s.y * 999, t);
      ctx.fillStyle = `rgba(140,190,165,${a})`;
      ctx.fillText(s.ch, s.x * W, s.y * H);
    });

    // bubbles rise
    bubbles.forEach(b => {
      b.y -= 0.0006 * b.s; if (b.y < -0.02) { b.y = 1.02; b.x = Math.random(); }
      const bx = (b.x + Math.sin(t * 1.3 + b.y * 20) * 0.004) * W;
      ctx.fillStyle = `rgba(170,215,190,${0.14 + 0.1 * b.s})`;
      ctx.fillText(b.ch, bx, b.y * H);
    });

    drawFish(t);

    fishX += FISH_SPEED / 8;
    if (fishX > 1.45) fishX = -0.45;

    if (!document.getElementById('landing').classList.contains('gone')) {
      requestAnimationFrame(frame);
    }
  }
  requestAnimationFrame(frame);

  const landing = document.getElementById('landing');

  // deep-link: #studio skips the landing (testing / screenshots)
  if (window.location.hash === '#studio') {
    landing.classList.add('gone');
    const studio = document.getElementById('studio');
    studio.hidden = false;
    requestAnimationFrame(() => studio.classList.add('on'));
    return;
  }

  // dive in
  const diveBtn = document.getElementById('dive');
  function dive() {
    if (landing.classList.contains('diving')) return;
    landing.classList.add('diving');
    const studio = document.getElementById('studio');
    studio.hidden = false;
    requestAnimationFrame(() => studio.classList.add('on'));
    setTimeout(() => {
      landing.classList.add('gone');
      if (window.PulpStudio) window.PulpStudio.focus();
    }, 1250);
  }
  diveBtn.addEventListener('click', (e) => { e.stopPropagation(); dive(); });
  landing.addEventListener('click', dive);
})();
