import { createMoped, stepMoped } from './driving.js';
import { createBreakdown, BREAKDOWN_TYPES } from './breakdown.js';
import { createFrustration, pickShout } from './frustration.js';
import { roadCenterX, ROAD_LENGTH } from './road.js';

export const BREAKDOWN_FRUSTRATION = 25;
export const KICK_FAIL_FRUSTRATION = 10;
export const SPUTTER_SECONDS = 1.5;
const FIRST_BREAKDOWN = [10, 20]; // seconds of riding
const NEXT_BREAKDOWN = [14, 26];
const NO_BREAKDOWN_NEAR_FINISH = 80; // metres

export function createGame({ rng = Math.random, shouts = [], length = ROAD_LENGTH, breakdownsEnabled = true } = {}) {
  const between = ([a, b]) => a + rng() * (b - a);
  let events = [];

  const game = {
    length,
    shouts,
    breakdownsEnabled,
    state: 'riding', // riding | broken | finished
    moped: createMoped(),
    frustration: createFrustration(),
    breakdown: null,
    breakdowns: 0,
    shoutCount: 0,
    lastShout: null,
    time: 0,
    sputtering: false,
    countdown: 0,

    restart() {
      game.state = 'riding';
      game.moped = createMoped();
      game.frustration.reset();
      game.breakdown = null;
      game.breakdowns = 0;
      game.shoutCount = 0;
      game.lastShout = null;
      game.time = 0;
      game.sputtering = false;
      game.countdown = between(FIRST_BREAKDOWN);
      events = [];
    },

    drainEvents() {
      const e = events;
      events = [];
      return e;
    },

    forceBreakdown(type) {
      if (game.state !== 'riding') return;
      type = type || BREAKDOWN_TYPES[Math.floor(rng() * BREAKDOWN_TYPES.length) % BREAKDOWN_TYPES.length];
      game.state = 'broken';
      game.sputtering = false;
      game.breakdown = createBreakdown(type, rng);
      game.breakdowns += 1;
      events.push({ type: 'breakdown', kind: type });
      game.addFrustration(BREAKDOWN_FRUSTRATION);
    },

    addFrustration(n) {
      if (game.frustration.add(n)) {
        game.shoutCount += 1;
        game.lastShout = pickShout(game.shouts, rng);
        events.push({ type: 'shout', text: game.lastShout });
      }
    },

    update(dt, input) {
      if (game.state === 'finished') return;
      const inp = { throttle: false, brake: false, steer: 0, fixHeld: false, presses: [], ...input };
      game.time += dt;

      if (game.state === 'broken') {
        // dead moped: coast to a halt, no throttle
        stepMoped(game.moped, { throttle: false, brake: true, steer: 0 }, dt, roadCenterX);
        const res = game.breakdown.update(dt, inp);
        if (res.failedKick) {
          events.push({ type: 'kickFail' });
          game.addFrustration(KICK_FAIL_FRUSTRATION);
        }
        if (res.fixed) {
          game.breakdown = null;
          game.state = 'riding';
          game.countdown = between(NEXT_BREAKDOWN);
          events.push({ type: 'fixed' });
        }
        return;
      }

      stepMoped(game.moped, inp, dt, roadCenterX);

      if (game.moped.z >= game.length) {
        game.state = 'finished';
        game.sputtering = false;
        events.push({ type: 'finish' });
        return;
      }

      if (game.breakdownsEnabled && game.moped.z < game.length - NO_BREAKDOWN_NEAR_FINISH) {
        game.countdown -= dt;
        game.sputtering = game.countdown <= SPUTTER_SECONDS;
        if (game.countdown <= 0) game.forceBreakdown();
      } else {
        game.sputtering = false;
      }
    },
  };

  game.restart();
  return game;
}
