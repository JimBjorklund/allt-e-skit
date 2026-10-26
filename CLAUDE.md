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
Expose window.__game in dev and test builds: position, speed, state, breakdown count, frustration level, fps, and a forceBreakdown() helper for tests.
After every change run: npm test. Done = all tests pass and the browser shows no console errors.
Browser tests must: load the page, fail on any console error, check the canvas is not blank (pixel check), press throttle and check the moped moves, force a breakdown and check the fix sequence works, max out frustration and check the shout appears, reach the finish and check the finish screen.
Every browser test run saves screenshots to test-results/screens/. Look at them and fix anything that looks wrong.
If headless Chromium shows a blank canvas, run Playwright headed.
Keep 60 fps on a mid-range PC: low-poly, few lights, instanced meshes.
git commit after each working step.
Commands
npm run dev: play locally
npm test: all tests
npm run build: production build into dist/