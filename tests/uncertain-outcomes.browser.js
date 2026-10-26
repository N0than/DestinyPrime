'use strict';
// Lot 4 — vérification dans Chromium (Playwright) : la carte d'un dilemme à issue incertaine
// (intitulés seuls) est rendue plusieurs fois sans aucun tirage (compteur NARRATIVE_RANDOM_CALLS du diagnostic),
// le clic de validation tire une seule fois, l'issue s'affiche, et les re-rendus de l'écran de
// résultat ne tirent rien. Captures mobile (390 px) et desktop (1280 px).
// Usage : node tests/uncertain-outcomes.browser.js [--shots dossier]
const path = require('node:path');
const { chromium } = require('playwright');
const i = process.argv.indexOf('--shots'), SHOTS = i > 0 ? process.argv[i + 1] : null;

(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const [label, viewport] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('file://' + path.resolve('index.html') + '?narrativeDebug=1');
    const setup = await page.evaluate(() => {
      console.log = () => {};
      resetGame(); const p = gameState.player; p.name = 'Test'; p.type = 'generaliste'; p.target = 'a2549';
      finalizeChannelSetup(); gameState.campaign.seed = 2654435761; launchFirstSeason();
      gameState.seasonKickoffPending = false; gameState.mercatoPending = false; p.tresorerie = 900;
      const x = PROGRAM_CATALOG.find(q => q.id === 'p284'), q = quoteProgram(x.slot, 'p284', 'interne'); executeProgramSigning(x.slot, q);
      const c = p.contracts[x.slot]; migrateProgramCareer(c, x.slot); c.career.seasonsCount = 3; c.end = gameState.season + 3;
      c.career.awareness = 75; c.career.loyalty = 65;
      const def = GENRE_STORY_BANK.find(d => d.id === 'gs_finale_exceptionnelle');
      const ctx = { ...programStoryContext(x.slot, c, getCalculatedPDAs()), form: 'succes' };
      const r = genericStoryCheck(def, ctx);
      const d = buildProgramStoryDilemma({ def, slot: x.slot, contract: c, ctx, arc: r.arc, choices: r.choices });
      gameState.dilemmaQueue = [d, DILEMMA_BANK[0], DILEMMA_BANK[1]]; gameState.currentDilemmaIndex = 0; gameState.dilemmaPhase = 'choosing'; gameState.step = 6;
      NARRATIVE_DEBUG = true; NARRATIVE_RANDOM_CALLS.count = 0;
      for (let k = 0; k < 10; k++) render();
      return { calls: NARRATIVE_RANDOM_CALLS.count, odds: d.c[0].story.uncertain.outcomes.map(o => `${o.label} ${Math.round(o.p * 100)} %`) };
    });
    await page.waitForTimeout(600);
    // Les choix n'affichent que leur intitulé (et leur pastille de coût), sans encart d'issues.
    const card = await page.locator('.choice[data-idx="0"]').innerText();
    const encart = await page.locator('.choice-uncertain').count();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/lot4-carte-${label}.png`, fullPage: true });
    // Validation par un vrai clic : un seul tirage.
    await page.locator('.choice[data-idx="0"]').click();
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => {
      const n = NARRATIVE_RANDOM_CALLS.count, d = gameState.dilemmaQueue[0];
      for (let k = 0; k < 10; k++) render();
      return { callsAtValidation: n, callsAfterRerender: NARRATIVE_RANDOM_CALLS.count, outcome: d.resolvedOutcome, shown: document.querySelector('.story-outcome')?.innerText };
    });
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/lot4-issue-${label}.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    results.push({ label, renderCalls: setup.calls, odds: setup.odds, card, encart, ...after, overflow, errors });
    await page.close();
  }
  await browser.close();
  console.log(JSON.stringify(results, null, 1));
  // Le clic de validation peut déclencher d'autres tirages du jeu après celui de l'issue
  // (réactions concurrentes) : on vérifie qu'aucun rendu n'en ajoute.
  const bad = results.filter(r => r.renderCalls !== 0 || r.callsAfterRerender !== r.callsAtValidation || !r.outcome || !r.shown || r.overflow || r.errors.length || r.encart || /Certain|incertaine|chances/.test(r.card));
  if (bad.length) { console.error('ÉCHEC', bad.map(b => b.label)); process.exitCode = 1; }
  else console.log('OK browser: 10 renders without draw, one validation, choices show labels only, outcome shown, 10 result renders without draw, no horizontal overflow (mobile, desktop)');
})();
