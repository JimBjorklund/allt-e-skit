const $ = (id) => document.getElementById(id);
const ARROW_CHARS = { up: '↑', down: '↓', left: '←', right: '→' };
const SHOUT_SECONDS = 3.5;

export function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function createHud(game, { onRestart }) {
  const el = {
    time: $('time'), speed: $('speed-val'), progress: $('progress').firstElementChild,
    meter: $('meter').firstElementChild, fix: $('fix-panel'), fixTitle: $('fix-title'),
    fixText: $('fix-text'), fixArrows: $('fix-arrows'), fixBar: $('fix-bar').firstElementChild,
    shout: $('shout-bubble'), finish: $('finish-screen'), joke: $('joke'),
  };
  let shoutLeft = 0;
  let jokeLeft = 0;
  let shownBreakdown = null;

  $('ride-again').addEventListener('click', () => {
    onRestart();
    $('ride-again').blur();
  });

  const TEXT = {
    engine: ['Engine died!', 'Hammer SPACE to kick-start'],
    chain: ['Chain fell off!', 'Press the arrow keys in order'],
    tyre: ['Flat tyre!', 'Hold E for 3 seconds'],
  };

  return {
    showShout(text) {
      el.shout.textContent = text;
      el.shout.hidden = false;
      shoutLeft = SHOUT_SECONDS;
    },
    showJoke(text) {
      el.joke.textContent = text;
      el.joke.hidden = false;
      jokeLeft = 4;
    },
    update(dt) {
      el.time.textContent = formatTime(game.time);
      el.speed.textContent = Math.round(game.moped.speed * 3.6);
      el.progress.style.width = `${Math.min(100, (game.moped.z / game.length) * 100)}%`;
      el.meter.style.width = `${game.frustration.level}%`;

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
      if (b) {
        if (b !== shownBreakdown) {
          shownBreakdown = b;
          el.fixTitle.textContent = TEXT[b.type][0];
          el.fixText.textContent = TEXT[b.type][1];
          el.fixArrows.innerHTML = b.type === 'chain'
            ? b.sequence.map((k) => `<span class="arrow">${ARROW_CHARS[k]}</span>`).join('')
            : '';
          el.fixArrows.hidden = b.type !== 'chain';
        }
        if (b.type === 'chain') {
          [...el.fixArrows.children].forEach((a, i) => {
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
      }
      el.finish.hidden = !done;
      if (!done) return;
    },
  };
}
