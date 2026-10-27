const $ = (id) => document.getElementById(id);
const ARROW_CHARS = { up: '↑', down: '↓', left: '←', right: '→' };
const SHOUT_SECONDS = 3.5;
const GAUGE_MAX_KMH = 60;

export function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function faceFor(level) {
  return level < 25 ? '🙂' : level < 50 ? '😐' : level < 75 ? '😠' : '🤬';
}

// round speedometer drawn on a canvas
function drawGauge(ctx, kmh, size, reversing = false) {
  const c = size / 2, r = size * 0.45;
  const a0 = Math.PI * 0.75, sweep = Math.PI * 1.5;
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath(); ctx.arc(c, c, r + 8, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(14,20,36,.72)'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.stroke();
  // coloured arc up to the current speed
  const frac = Math.min(1, kmh / GAUGE_MAX_KMH);
  ctx.lineCap = 'round';
  ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(255,255,255,.12)';
  ctx.beginPath(); ctx.arc(c, c, r - 14, a0, a0 + sweep); ctx.stroke();
  const g = ctx.createLinearGradient(0, size, size, 0);
  g.addColorStop(0, '#7bd34b'); g.addColorStop(0.6, '#ffd93b'); g.addColorStop(1, '#e8452c');
  ctx.strokeStyle = g;
  if (frac > 0.001) { ctx.beginPath(); ctx.arc(c, c, r - 14, a0, a0 + sweep * frac); ctx.stroke(); }
  // ticks and labels
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${size * 0.065}px "Segoe UI", sans-serif`;
  for (let v = 0; v <= GAUGE_MAX_KMH; v += 10) {
    const a = a0 + sweep * (v / GAUGE_MAX_KMH);
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(c + Math.cos(a) * (r - 28), c + Math.sin(a) * (r - 28)); ctx.lineTo(c + Math.cos(a) * (r - 20), c + Math.sin(a) * (r - 20)); ctx.stroke();
    ctx.fillText(String(v), c + Math.cos(a) * (r - 52), c + Math.sin(a) * (r - 52));
  }
  // needle
  const na = a0 + sweep * frac;
  ctx.strokeStyle = '#ff4a30'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(c - Math.cos(na) * 12, c - Math.sin(na) * 12); ctx.lineTo(c + Math.cos(na) * (r - 28), c + Math.sin(na) * (r - 28)); ctx.stroke();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(c, c, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff4a30'; ctx.beginPath(); ctx.arc(c, c, 5, 0, Math.PI * 2); ctx.fill();
  // digital readout
  ctx.fillStyle = '#fff'; ctx.font = `900 ${size * 0.14}px "Segoe UI", sans-serif`;
  ctx.fillText((reversing ? 'R ' : '') + String(Math.round(kmh)), c, c + r * 0.52);
  ctx.font = `700 ${size * 0.05}px "Segoe UI", sans-serif`; ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.fillText('KM/H', c, c + r * 0.72);
}

function confetti(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  const cols = ['#ffd93b', '#e8452c', '#3c8de8', '#5cc85a', '#ff7bd0', '#fff'];
  const bits = Array.from({ length: 160 }, (_, i) => ({
    x: Math.random() * canvas.width, y: -Math.random() * canvas.height, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 4,
    w: 6 + Math.random() * 8, h: 4 + Math.random() * 6, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, col: cols[i % cols.length],
  }));
  let alive = true;
  (function tick() {
    if (!alive || !canvas.isConnected || canvas.offsetParent === null) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const b of bits) {
      b.x += b.vx; b.y += b.vy; b.rot += b.vr;
      if (b.y > canvas.height + 20) { b.y = -20; b.x = Math.random() * canvas.width; }
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.fillStyle = b.col; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.restore();
    }
    requestAnimationFrame(tick);
  })();
  return () => { alive = false; };
}

export function createHud(game, { onRestart }) {
  const el = {
    time: $('time'), fill: $('track-fill'), dot: $('rider-dot'),
    meter: $('meter').firstElementChild, meterWrap: $('meter-wrap'), face: $('face'),
    fix: $('fix-panel'), fixTitle: $('fix-title'), fixText: $('fix-text'), fixKeys: $('fix-keys'), fixBar: $('fix-bar').firstElementChild,
    shout: $('shout-bubble'), finish: $('finish-screen'), joke: $('joke'),
  };
  const gauge = $('gauge').getContext('2d');
  let shoutLeft = 0;
  let jokeLeft = 0;
  let shownBreakdown = null;
  let lastFace = '';
  let stopConfetti = null;
  let smoothKmh = 0;

  $('ride-again').addEventListener('click', () => {
    onRestart();
    $('ride-again').blur();
  });

  const TEXT = {
    engine: ['Engine died!', 'Hammer to kick-start'],
    chain: ['Chain fell off!', 'Press the arrow keys in order'],
    tyre: ['Flat tyre!', 'Hold for 3 seconds'],
  };

  return {
    showShout(text) {
      el.shout.hidden = true;
      void el.shout.offsetWidth; // restart the pop animation
      el.shout.textContent = text;
      el.shout.hidden = false;
      shoutLeft = SHOUT_SECONDS;
    },
    showJoke(text) {
      el.joke.hidden = true;
      void el.joke.offsetWidth;
      el.joke.textContent = text;
      el.joke.hidden = false;
      jokeLeft = 4;
    },
    update(dt) {
      el.time.textContent = formatTime(game.time);
      const pct = Math.min(100, (game.moped.z / game.length) * 100);
      el.fill.style.width = `${pct}%`;
      el.dot.style.left = `${pct}%`;
      smoothKmh += (game.moped.speed * 3.6 - smoothKmh) * Math.min(1, dt * 10);
      drawGauge(gauge, Math.abs(smoothKmh), 340, smoothKmh < -0.5);
      const lvl = game.frustration.level;
      el.meter.style.width = `${lvl}%`;
      const face = faceFor(lvl);
      if (face !== lastFace) { el.face.textContent = face; lastFace = face; }
      el.meterWrap.classList.toggle('rage', lvl > 75);

      if (shoutLeft > 0) {
        shoutLeft -= dt;
        if (shoutLeft <= 0) el.shout.hidden = true;
      }
      if (jokeLeft > 0) {
        jokeLeft -= dt;
        if (jokeLeft <= 0) el.joke.hidden = true;
      }

      const b = game.breakdown;
      el.fix.hidden = !b;
      el.fix.style.opacity = shoutLeft > 0 ? '0' : '1'; // keep the rider's face clear during the shout close-up
      if (b) {
        if (b !== shownBreakdown) {
          shownBreakdown = b;
          el.fixTitle.textContent = TEXT[b.type][0];
          el.fixText.textContent = TEXT[b.type][1];
          el.fixKeys.innerHTML = b.type === 'chain'
            ? b.sequence.map((k) => `<span class="key arrow arrow-${k}">${ARROW_CHARS[k]}</span>`).join('')
            : `<span class="key big">${b.type === 'engine' ? 'SPACE' : 'E'}</span>`;
        }
        if (b.type === 'chain') {
          [...el.fixKeys.children].forEach((a, i) => {
            a.classList.toggle('done', i < b.index);
            a.classList.toggle('next', i === b.index);
          });
        }
        el.fixBar.style.width = `${b.progress * 100}%`;
      } else {
        shownBreakdown = null;
      }

      const done = game.state === 'finished';
      if (done && el.finish.hidden) {
        $('f-time').textContent = formatTime(game.time);
        $('f-breakdowns').textContent = game.breakdowns;
        $('f-shouts').textContent = game.shoutCount;
        el.finish.hidden = false;
        stopConfetti = confetti($('confetti'));
      } else if (!done && !el.finish.hidden) {
        el.finish.hidden = true;
        if (stopConfetti) stopConfetti();
      }
    },
  };
}
