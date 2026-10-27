# GAME.md: the spec (edit freely, Claude builds from this)

## Working title
Allt e skit

## Idea
You ride a tiny 1998-style mini moped (like a Honda Monkey, no logos) along a road.
It keeps breaking down. Each breakdown makes the rider more frustrated, and at full
frustration he shouts one of the shout lines below.

## Version 1
- One road from start to finish, about 2 minutes of riding.
- Setting: countryside village (fields, farms, houses, trees).
- Breakdowns happen at random: engine dies, chain falls off, flat tyre, out of petrol, fouled spark plug.
- Fixing: engine = hammer Space to kick-start; chain = press the arrow keys (or A/D for left/right)
  shown on screen in order; tyre = hold E for 3 seconds; out of petrol = push the moped by
  alternating A and D (it really moves); spark plug = hold E for 1.5 seconds, then hammer Space.
- Frustration meter goes up with every breakdown and failed kick-start.
- Full frustration: the rider shouts (big speech bubble + the browser's speech voice if available),
  then the meter resets.
- Finish screen: time, number of breakdowns, number of shouts, "Ride again" button.

## Free roaming
- You can ride anywhere, not only on the road. Riding off the road is only a little slower
  (about 70% of road top speed), never crawling.
- Scenery is NOT solid: houses, trees, fences, animals and signs can be ridden straight through.
  (Things near the moped and the camera fade out so it stays readable.)
- The ground is real: rolling hills and mountains. The moped stands on top of them, tilts with
  the slope, slows going uphill and speeds up downhill, and can climb them (steep cliffs are
  too steep).
- You can reverse and turn all the way round. The only edges are far away.

## Crazy extras
- Pickups float along the road and out in the fields (so roaming is rewarded):
  coffee = calms the rider (-30 frustration), duct tape = the next fix starts 60% done,
  nitro = 4 seconds of boost, petrol can = the next breakdown is delayed by 20 seconds.
- Jump ramps (striped wooden wedges) on and beside the road. You really fly: the moped leaves
  the ground, has little steering control in the air and lands again. An ordinary jump is safe;
  a landing from too high or too fast (nitro off a ramp, big drops) breaks the moped.
- Weather: rain comes and goes by itself. Rain makes breakdowns more likely (up to 1.7x), makes the
  road shiny, darkens the sky, and brings lightning with thunder. A strike close by scares the
  rider (+10 frustration).
- Crazy landmarks: a giant rubber duck, a very proud moose statue and a crashed, smouldering UFO.
- The finish screen also shows jumps and the best air time.

## Controls
- W / Up: throttle
- S / Down: brake (hold it at a standstill to reverse)
- A / D or Left / Right: steer (A/D and the arrows also count as left/right presses for fixes)
- Space: kick-start
- E: fix

## Shout lines (one is picked at random)
Written one per line in `public/shouts.txt` (placeholders for now; replace them).

## Internal jokes to include
Written one per line in `public/jokes.txt` (placeholders for now; replace them). They appear on roadside signs.

## Look and sound
- Bright colours, made in code. Looks and frame rate are NOT a priority; the idea and mechanics are.
- Engine sound that sputters before a breakdown.

## Later (not in version 1)
- <IDEAS FOR LATER>