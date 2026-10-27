import { createMoped, stepMoped } from './driving.js';
import { createBreakdown, BREAKDOWN_TYPES } from './breakdown.js';
import { createFrustration, pickShout } from './frustration.js';
import { roadCenterX, ROAD_LENGTH } from './road.js';
import { terrainY } from './terrain.js';
import { generateRamps, rampHeight } from './ramps.js';
import { generatePickups, nearbyPickups, PICKUP_HEIGHT } from './pickups.js';
import { createWeather } from './weather.js';
import { mulberry32 } from './random.js';

export const BREAKDOWN_FRUSTRATION = 25;
export const KICK_FAIL_FRUSTRATION = 10;
export const SCARE_FRUSTRATION = 10; // a lightning strike right next to you
export const COFFEE_CALM = 30;
export const NITRO_SECONDS = 4;
export const PETROL_DELAY = 20; // seconds added before the next breakdown
export const TAPE_HEAD_START = 0.6;
export const CRASH_IMPACT = 10; // m/s downwards: a landing this hard breaks something
export const SPUTTER_SECONDS = 1.5;
const FUEL_PUSH_METRES = 0.7; // how far one good shove moves the moped
const FIRST_BREAKDOWN = [10, 20]; // seconds of riding
const NEXT_BREAKDOWN = [14, 26];
const NO_BREAKDOWN_NEAR_FINISH = 80; // metres
const MIN_AIR_FOR_A_JUMP = 0.4; // seconds in the air that count as a jump

export function createGame({
  rng = Math.random,
  shouts = [],
  length = ROAD_LENGTH,
  breakdownsEnabled = true,
  pickups = generatePickups(length, mulberry32(11)),
  ramps = generateRamps(length),
  surface = (x, z) => terrainY(x, z) + rampHeight(x, z, ramps), // ground height: hills, mountains and ramps
} = {}) {
  const between = ([a, b]) => a + rng() * (b - a);
  let events = [];

  const game = {
    length,
    shouts,
    breakdownsEnabled,
    pickups,
    ramps,
    surface,
    state: 'riding', // riding | broken | finished
    moped: createMoped(),
    frustration: createFrustration(),
    weather: createWeather(mulberry32(4242)),
    breakdown: null,
    breakdowns: 0,
    shoutCount: 0,
    lastShout: null,
    time: 0,
    sputtering: false,
    countdown: 0,
    collected: new Set(),
    boostLeft: 0, // seconds of nitro left
    tape: false, // duct tape in the pocket for the next breakdown
    stats: { jumps: 0, bestAir: 0 },

    restart() {
      game.state = 'riding';
      game.moped = createMoped();
      game.frustration.reset();
      game.weather = createWeather(mulberry32(4242));
      game.breakdown = null;
      game.breakdowns = 0;
      game.shoutCount = 0;
      game.lastShout = null;
      game.time = 0;
      game.sputtering = false;
      game.collected = new Set();
      game.boostLeft = 0;
      game.tape = false;
      game.stats = { jumps: 0, bestAir: 0 };
      game.countdown = between(FIRST_BREAKDOWN);
      events = [];
    },

    // put the moped somewhere (used by tests and the debug helper)
    teleport(x, z, heading = 0) {
      const m = game.moped;
      m.x = x; m.z = z; m.heading = heading;
      m.y = surface(x, z); m.vy = 0; m.air = false; m.airTime = 0;
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
      if (game.tape) {
        game.breakdown.headStart(TAPE_HEAD_START);
        game.tape = false;
        events.push({ type: 'tape-used' });
      }
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

    strikeLightning({ scary = false } = {}) {
      events.push({ type: 'lightning', scary });
      if (scary) {
        events.push({ type: 'scare' });
        game.addFrustration(SCARE_FRUSTRATION);
      }
    },

    collectPickup(p) {
      game.collected.add(p.id);
      if (p.kind === 'coffee') game.frustration.reduce(COFFEE_CALM);
      else if (p.kind === 'tape') game.tape = true;
      else if (p.kind === 'nitro') game.boostLeft = Math.min(2 * NITRO_SECONDS, game.boostLeft + NITRO_SECONDS);
      else if (p.kind === 'petrol') game.countdown += PETROL_DELAY;
      events.push({ type: 'pickup', kind: p.kind, id: p.id });
    },

    // a landing: count the jump, and a really hard one breaks the moped
    handleLanding(r) {
      if (!r.landed) return;
      events.push({ type: 'land', impact: r.impact, airTime: r.airTime });
      if (r.airTime >= MIN_AIR_FOR_A_JUMP) {
        game.stats.jumps += 1;
        game.stats.bestAir = Math.max(game.stats.bestAir, r.airTime);
      }
      if (r.impact >= CRASH_IMPACT && game.state === 'riding') {
        events.push({ type: 'crash', impact: r.impact });
        game.forceBreakdown();
      }
    },

    update(dt, input) {
      if (game.state === 'finished') return;
      const inp = { throttle: false, brake: false, steer: 0, fixHeld: false, presses: [], ...input, boost: game.boostLeft > 0 };
      game.time += dt;
      game.boostLeft = Math.max(0, game.boostLeft - dt);

      for (const e of game.weather.update(dt)) {
        if (e.type === 'lightning') game.strikeLightning(e);
        else events.push(e);
      }

      if (game.state === 'broken') {
        // dead moped: coast to a halt, no throttle
        game.handleLanding(stepMoped(game.moped, { throttle: false, brake: game.moped.speed > 0, steer: 0 }, dt, roadCenterX, surface));
        const res = game.breakdown.update(dt, inp);
        if (res.pushed) {
          const m = game.moped;
          m.x += Math.sin(m.heading) * FUEL_PUSH_METRES * res.pushed;
          m.z += Math.cos(m.heading) * FUEL_PUSH_METRES * res.pushed;
        }
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

      game.handleLanding(stepMoped(game.moped, inp, dt, roadCenterX, surface));

      // grab anything close enough (not while flying high above it)
      const m = game.moped;
      for (const p of nearbyPickups(game.pickups, m.x, m.z, game.collected)) {
        if (Math.abs(m.y + 0.6 - (surface(p.x, p.z) + PICKUP_HEIGHT)) < 3) game.collectPickup(p);
      }

      if (game.moped.z >= game.length) {
        game.state = 'finished';
        game.sputtering = false;
        events.push({ type: 'finish' });
        return;
      }

      if (game.state === 'riding' && game.breakdownsEnabled && game.moped.z < game.length - NO_BREAKDOWN_NEAR_FINISH) {
        game.countdown -= dt * game.weather.breakdownRate; // rain makes breakdowns come sooner
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
