'use strict';
// Plan de relance (v2.0) — simulation d'équilibrage, hors jeu (graines reproductibles).
// Usage : node tests/relance.sim.js [--n 2000] [--out fichier]
// Des cases en déclin (usure, part de la case, pression, saisons difficiles passées tirées au
// hasard) jouent 4 saisons avec cinq stratégies fixes : toujours autopromo, toujours digital,
// toujours renfort, toujours attendre, étude puis meilleure branche selon le pronostic. Les
// cartes, coûts, tirages et effets sont ceux du jeu (composeRelanceStories, chooseDilemmaOption,
// carrière du programme, moteur d'audience) ; seule la part de la case est rapportée à sa part
// de départ (ratio = ratio initial × part / part initiale) pour fixer le profil de déclin.
// Mesures : audience cumulée de la case sur 4 saisons, trésorerie dépensée, bascule vers la
// refonte, jauges finales. Second scénario : trois cases en déclin sur la même grille.
const fs = require('node:fs');
const vm = require('node:vm');
const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def; };
const N = +arg('--n', 2000), OUT = arg('--out', null);
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).slice(0, -1).join('\n');
const harness = String.raw`
render = () => {};
globalThis.localStorage = { d: {}, setItem(k, v) { this.d[k] = String(v); }, getItem(k) { return k in this.d ? this.d[k] : null; } };
let rng = 7;
const rand = () => { rng = (Math.imul(rng, 1103515245) + 12345) >>> 0; return rng / 4294967296; };
Math.random = rand;
const STRATS = ['autopromo', 'digital', 'renfort', 'attendre', 'etude'];
const PIDS = ['p009', 'p020', 'p028'];
resetGame();
{ const p = gameState.player; p.name = 'Sim'; p.type = 'generaliste'; p.target = 'a2549';
  finalizeChannelSetup(); launchFirstSeason(); gameState.seasonKickoffPending = false; gameState.mercatoPending = false; p.tresorerie = 5000;
  PIDS.forEach(id => { const x = PROGRAM_CATALOG.find(c => c.id === id); const q = quoteProgram(x.slot, id, 'interne'); executeProgramSigning(x.slot, q);
    const c = p.contracts[x.slot]; migrateProgramCareer(c, x.slot); c.career.seasonsCount = 3; c.end = gameState.season + 10; }); }
const BASE = JSON.stringify(gameState);
const slotOf = id => PROGRAM_CATALOG.find(c => c.id === id).slot;
const shareOf = slot => getCalculatedPDAs().find(r => r.channel === gameState.player).slots[slot][gameState.player.target];
function caseCtx(cs) {
  const p = gameState.player, contract = p.contracts[cs.slot];
  const base = programStoryContext(cs.slot, contract, getCalculatedPDAs());
  const ratio = cs.ratio0 * shareOf(cs.slot) / cs.share0;
  const last = cs.history.at(-1);
  const form = ratio <= PROGRAM_STORY_TUNING.struggleRatio || (last && last.performance - last.expected <= PROGRAM_STORY_TUNING.struggleGap) ? 'difficulte'
    : ratio >= PROGRAM_STORY_TUNING.successRatio ? 'succes' : 'stable';
  const g = relanceGravity({ form, ratio, wear: contract.career.wear, pressure: cs.pressure, history: cs.history, season: gameState.season });
  return { ...base, ratio, form, pressure: cs.pressure, gravity: g.gravity, declineDepth: g.declineDepth };
}
function pickChoice(d, strat, ctx) {
  const L = d.c.map(c => c.l), find = re => L.findIndex(l => re.test(l));
  const step = Number(d.storyDefId.split('_')[2]);
  const branchRe = { autopromo: /autopromo/i, digital: /réseaux|plateforme/i, renfort: /Renforcer/, attendre: /Attendre/ };
  if (step === 1) {
    let s = strat;
    if (strat === 'etude') {
      if (step === 1 && find(/étude/i) >= 0) return find(/étude/i);
      // Pronostic : favorable ou incertain → la campagne la plus prometteuse ; sinon le fond.
      // Pronostic de l'étude : un public qui ne connaît pas le programme appelle la promotion
      // la plus prometteuse ; un public qui s'en lasse, le travail de fond.
      const best = ['autopromo', 'digital'].map(b => ({ b, p: relanceOdds(ctx, b).succes })).sort((a, b) => b.p - a.p)[0];
      s = best.p >= RELANCE_TUNING.pronostic.incertain && relanceHealth(ctx.wear) >= RELANCE_TUNING.pronostic.health ? best.b : 'renfort';
    }
    const i = find(branchRe[s]);
    return i >= 0 ? i : find(/autopromo/i) >= 0 ? find(/autopromo/i) : 0;
  }
  // Déroulé et bilan : poursuivre l'effort engagé (première option).
  return 0;
}
function play(d, i) {
  gameState.dilemmaQueue = [d, DILEMMA_BANK[0], DILEMMA_BANK[1]]; gameState.currentDilemmaIndex = 0; gameState.dilemmaPhase = 'choosing'; gameState.step = 6;
  const f = d.c[i].finance;
  chooseDilemmaOption(i);
  return f;
}
function runTrial(cases, stratOf, seed) {
  gameState = JSON.parse(BASE); gameState.campaign.seed = seed;
  const p = gameState.player, out = cases.map(() => ({ audience: 0, late: 0, spent: 0, refonte: false, cards: 0, antennaMax: 0 }));
  cases.forEach(cs => { const c = p.contracts[cs.slot].career; c.wear = cs.wear; cs.share0 = shareOf(cs.slot); cs.gravity0 = caseCtx(cs).gravity; });
  for (let season = 0; season < 4; season++) {
    cases.forEach((cs, k) => {
      const ctx = caseCtx(cs), defs = composeRelanceStories(ctx);
      if (!defs.length) return;
      const r = genericStoryCheck(defs[0], ctx);
      if (!r.ok) return;
      const d = buildProgramStoryDilemma({ def: defs[0], slot: cs.slot, contract: p.contracts[cs.slot], ctx, arc: r.arc, choices: r.choices });
      // Dépense sur l'horizon : achats, plus la hausse (ou l'économie) du coût annuel pour les
      // saisons restantes de la simulation.
      const f = play(d, pickChoice(d, stratOf(k), ctx));
      out[k].spent += (f.purchase || 0) + (f.recurring || 0) * (4 - season); out[k].cards++;
      // Étude : le diagnostic arrive dans la même saison, juste après.
      const diag = gameState.dilemmaQueue[1];
      if (diag?.storyDefId === 'gs_relance_1_etude') {
        continueAfterConsequence();
        const j = pickChoice(diag, stratOf(k), caseCtx(cs)), g = diag.c[j].finance;
        chooseDilemmaOption(j); out[k].spent += (g.purchase || 0) + (g.recurring || 0) * (4 - season); out[k].cards++;
      }
      if (globalThis.TRACE) console.log('  S' + season, d.storyDefId, '→', d.c[gameState.dilemmaQueue[0].resolvedOutcome?.choice ?? 0]?.l, gameState.dilemmaQueue[0].resolvedOutcome?.key || '', 'g=' + ctx.gravity, 'wear=' + Math.round(p.contracts[cs.slot].career.wear));
      if ((p.storyArcs || []).some(a => a.arcId === 'refonte' && a.entity.id === p.contracts[cs.slot].id)) out[k].refonte = true;
    });
    cases.forEach((cs, k) => {
      const ratio = cs.ratio0 * shareOf(cs.slot) / cs.share0;
      out[k].audience += shareOf(cs.slot);
      if (season >= 2) out[k].late += shareOf(cs.slot);
      out[k].antennaMax = Math.max(out[k].antennaMax, relanceGauges(null).antennaFatigue);
      cs.history.push({ season: gameState.season, performance: 0, expected: ratio <= PROGRAM_STORY_TUNING.struggleRatio ? 2 : 0 });
    });
    evolveProgramCareers();
    gameState.season++;
    Object.values(p.contracts).forEach(c => { c.end = Math.max(c.end, gameState.season + 4); });
    updateStoryArcs();
  }
  const g = relanceGauges(null);
  return out.map(o => ({ ...o, antenna: g.antennaFatigue, credibility: g.promoCredibility }));
}
const R = { single: [], grid: [] };
if (globalThis.TRACE) { for (const strat of ['autopromo','renfort','etude']) { console.log(strat); const cs = { slot: slotOf('p020'), wear: 25, ratio0: 0.7, pressure: true, history: [{ season: gameState.season - 1, performance: 0, expected: 2 }] }; const [o] = runTrial([cs], () => strat, 99); console.log('  audience', o.audience.toFixed(2)); } }
for (let t = 0; t < N; t++) {
  const profile = { wear: Math.round(15 + rand() * 75), ratio0: 0.6 + rand() * 0.35, pressure: rand() < 0.5, hardPrev: Math.floor(rand() * 3) };
  const seed = (t * 2654435761) >>> 0 || 1;
  STRATS.forEach(strat => {
    const cs = { slot: slotOf('p020'), ...profile, history: Array.from({ length: profile.hardPrev }, (_, i) => ({ season: -i, performance: 0, expected: 2 })) };
    cs.history.forEach((h, i) => { h.season = gameState.season - profile.hardPrev + i; });
    const [o] = runTrial([cs], () => strat, seed);
    R.single.push({ strat, ...profile, ...o, gravity0: cs.gravity0 });
  });
}
// Grille : trois cases en déclin, même stratégie partout.
for (let t = 0; t < Math.ceil(N / 4); t++) {
  const seed = (t * 40503 + 17) >>> 0 || 1, profiles = PIDS.map(() => ({ wear: Math.round(25 + rand() * 50), ratio0: 0.65 + rand() * 0.25, pressure: rand() < 0.3 }));
  STRATS.forEach(strat => {
    const cases = PIDS.map((id, k) => ({ slot: slotOf(id), ...profiles[k], history: [] }));
    const out = runTrial(cases, () => strat, seed);
    R.grid.push({ strat, audience: out.reduce((a, o) => a + o.audience, 0), late: out.reduce((a, o) => a + o.late, 0), spent: out.reduce((a, o) => a + o.spent, 0),
      antenna: out[0].antennaMax, credibility: out[0].credibility });
  });
}
globalThis.__R = R;
`;
const ctx = { console, structuredClone, URLSearchParams, N };
vm.createContext(ctx);
const t0 = Date.now();
vm.runInContext(scripts + '\n' + harness, ctx, { filename: 'relance-sim.js' });
const R = ctx.__R, STRATS = ['autopromo', 'digital', 'renfort', 'attendre', 'etude'];
const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
const f2 = v => v.toFixed(2).replace('.', ','), pc = v => `${Math.round(v * 100)} %`;
// Le renfort n'est proposé qu'en Crise et en Urgence : la comparaison promo / renfort se lit
// sur ces régimes (en Alerte, « toujours renfort » se replie sur l'autopromo légère).
const groups = { 'toutes les cases': () => true, 'crise ou urgence': r => r.gravity0 >= 3,
  'usure ≥ 70 (crise ou urgence)': r => r.wear >= 70 && r.gravity0 >= 3, 'usure ≤ 30 (crise ou urgence)': r => r.wear <= 30 && r.gravity0 >= 3,
  'alerte': r => r.gravity0 <= 2,
  'sous pression': r => r.pressure, 'décrochage fort (ratio ≤ 0,75)': r => r.ratio0 <= 0.75 };
const lines = [`Plan de relance v2.0 — ${N} cases × 5 stratégies × 4 saisons (+ ${Math.ceil(N / 4)} grilles à 3 cases) — ${Math.round((Date.now() - t0) / 1000)} s`, ''];
const gains = {};
for (const [label, test] of Object.entries(groups)) {
  const rows = R.single.filter(test), base = avg(rows.filter(r => r.strat === 'attendre').map(r => r.audience));
  lines.push(`**${label}** (${rows.length / 5} cases)`, '', '| Stratégie | Audience cumulée (pts de PDA) | Écart à « attendre » | Dépense (M€) | Bascule refonte | Antenne | Crédibilité |', '|---|---:|---:|---:|---:|---:|---:|');
  gains[label] = {};
  STRATS.forEach(s => {
    const x = rows.filter(r => r.strat === s), a = avg(x.map(r => r.audience));
    gains[label][s] = a;
    lines.push(`| ${s} | ${f2(a)} | ${a >= base ? '+' : ''}${f2(a - base)} | ${f2(avg(x.map(r => r.spent)))} | ${pc(avg(x.map(r => r.refonte ? 1 : 0)))} | ${f2(avg(x.map(r => r.antenna)))} | ${f2(avg(x.map(r => r.credibility)))} |`);
  });
  lines.push('');
}
lines.push('**Grille : trois cases en déclin, même stratégie partout**', '', '| Stratégie | Audience cumulée des 3 cases | Dont saisons 3 et 4 | Dépense (M€) | Antenne (max) | Crédibilité (fin) |', '|---|---:|---:|---:|---:|---:|');
const grid = {};
STRATS.forEach(s => { const x = R.grid.filter(r => r.strat === s); grid[s] = avg(x.map(r => r.late));
  lines.push(`| ${s} | ${f2(avg(x.map(r => r.audience)))} | ${f2(grid[s])} | ${f2(avg(x.map(r => r.spent)))} | ${f2(avg(x.map(r => r.antenna)))} | ${f2(avg(x.map(r => r.credibility)))} |`); });
// Critères de la spec (§9).
const G = gains['toutes les cases'], fixed = ['autopromo', 'digital', 'renfort', 'attendre'];
const bestIn = label => fixed.reduce((b, s) => gains[label][s] > gains[label][b] ? s : b, fixed[0]);
const dominant = fixed.find(s => Object.keys(groups).every(l => fixed.every(o => o === s || gains[l][s] >= gains[l][o])));
const vsFixed = fixed.filter(s => s !== 'attendre').map(s => (G.etude - G.attendre) / Math.max(1e-9, G[s] - G.attendre));
const promoBest = l => Math.max(gains[l].autopromo, gains[l].digital);
lines.push('', 'Critères :',
  `- aucune stratégie fixe ne domine partout : ${dominant ? `NON (${dominant})` : 'oui'} (meilleure par profil : ${Object.keys(groups).map(l => `${l} → ${bestIn(l)}`).join(' ; ')})`,
  `- étude puis meilleure branche : gain d’audience sur « attendre » rapporté à celui de chaque stratégie fixe active : ${fixed.filter(s => s !== 'attendre').map((s, i) => `${s} ×${f2(vsFixed[i])}`).join(', ')} (cible : ×1,05 à ×1,15 face à la meilleure)`,
  `- usure ≥ 70 : renfort ${f2(gains['usure ≥ 70 (crise ou urgence)'].renfort)} vs meilleure promo ${f2(promoBest('usure ≥ 70 (crise ou urgence)'))} → ${gains['usure ≥ 70 (crise ou urgence)'].renfort > promoBest('usure ≥ 70 (crise ou urgence)') ? 'renfort gagne' : 'NON'}`,
  `- usure ≤ 30 : meilleure promo ${f2(promoBest('usure ≤ 30 (crise ou urgence)'))} vs renfort ${f2(gains['usure ≤ 30 (crise ou urgence)'].renfort)} → ${promoBest('usure ≤ 30 (crise ou urgence)') > gains['usure ≤ 30 (crise ou urgence)'].renfort ? 'la promo gagne' : 'NON'}`,
  `- grille, saisons 3 et 4 : « toujours autopromo » ${STRATS.filter(s => s !== 'attendre').every(s => s === 'autopromo' || grid.autopromo <= grid[s]) ? 'est la pire des stratégies actives' : 'n’est PAS la pire des stratégies actives'} (antenne ${f2(avg(R.grid.filter(r => r.strat === 'autopromo').map(r => r.antenna)))})`);
const text = lines.join('\n');
console.log(text);
if (OUT) fs.writeFileSync(OUT, text + '\n');
