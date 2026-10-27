Moped game: a small 3D browser game
Goal

Build the game described in GAME.md. It must run in any modern desktop browser and be shareable as a link. GAME.md is the spec. If something there is unclear, ask me before guessing.

Tech (do not change without asking me)
JavaScript (ES modules), no TypeScript.
three.js for 3D, Vite for the dev server and build.
Vitest for logic tests, Playwright (Chromium) for browser tests.
All models, textures and sounds are made in code. No downloaded assets, no brand logos.
Rules
Keep game logic (driving, breakdowns, frustration, scoring) in plain modules under src/logic/ with no three.js imports, so it can be unit tested.
Priority: the idea and the mechanics matter more than looks and frame rate. There is NO fps requirement. Do not spend effort on fps or graphics tuning; spend it on making the game work and feel right.
Expose window.__game in dev and test builds: position, speed, state, breakdown count, frustration level, and a forceBreakdown() helper for tests.
After every change run: npm test. Done = all tests pass and the browser shows no console errors.
Browser tests must: load the page, fail on any console error, check the canvas is not blank (pixel check), press throttle and check the moped moves, hold brake at a standstill and check it reverses, ride off the road and check the speed stays high, ride straight through a house (scenery is not solid), check the moped stands on top of hills and can climb a mountain, force a breakdown and check the fix sequence works, max out frustration and check the shout appears, reach the finish and check the finish screen.
Every browser test run saves screenshots to test-results/screens/. Look at them and fix anything that looks wrong.
If headless Chromium shows a blank canvas, run Playwright headed.
Free roaming (my instructions, keep them): you can ride anywhere, not only on the road. Off-road is only a little slower than the road. Houses, trees, fences and other scenery are NOT solid, you ride straight through them. Hills and mountains are real ground: the moped stands on them, tilts with them and can climb them. The moped can reverse and can turn all the way round.
git commit after each working step.
Commands
npm run dev: play locally
npm test: all tests
npm run build: production build into dist/