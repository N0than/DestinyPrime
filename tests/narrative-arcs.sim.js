'use strict';
// Lot 3 — simulation headless des histoires génériques et des arcs narratifs.
// Usage : node tests/narrative-arcs.sim.js [--seeds 5] [--seasons 120] [--out fichier]
// Six types de chaînes × graines ; choix aléatoires. Pour que les histoires de programmes
// aient matière, la grille est garnie en début de saison (programmes du catalogue signés sur
// les cases libres, comme un joueur actif), un talent est recruté en saison 2 et une partie
// sur trois devient plateforme (graine multiple de 3), pour exercer les options contextuelles.
// Mesures : ouvertures, suites, résolutions, expirations et abandons d'arcs, arcs ouverts
// simultanés, répétitions par programme, textes incomplets, files vides ou bloquées.
const fs = require('node:fs');
const vm = require('node:vm');

const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def; };
const SEEDS = +arg('--seeds', 5), SEASONS = +arg('--seasons', 120), OUT = arg('--out', null);
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).slice(0, -1).join('\n');

const harness = String.raw`
render = () => {};
globalThis.localStorage = { d: {}, setItem(k, v) { this.d[k] = String(v); }, getItem(k) { return k in this.d ? this.d[k] : null; } };
let rng = 1;
Math.random = () => { rng = (Math.imul(rng, 1103515245) + 12345) >>> 0; return rng / 4294967296; };
globalThis.crypto = { getRandomValues: a => { a[0] = Math.floor(Math.random() * 4294967295); return a; } };
const M = { seasons: 0, perType: {}, games: 0, events: {}, maxOpen: 0, maxOpenPerProgram: 0, openSum: 0,
  stories: 0, generic: 0, followUps: 0, contextual: { talent: 0, platform: 0, partner: 0, reducible: 0 },
  samePrograms: 0, repeatDef: 0, badText: [], empty: 0, blocked: 0, errors: [], arcsByType: {}, situations: {}, abandonedFollowUp: 0 };
const bump = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
console.log = ((log) => (...a) => {
  if (typeof a[0] === 'string' && a[0].startsWith('[narratif')) { const ev = a[0].replace(/^\[narratif S\d+\] /, ''); if (/^arc /.test(ev)) bump(M.events, ev); return; }
  log(...a);
})(console.log);
NARRATIVE_DEBUG = true;

// Histoires jouées : variantes génériques, suites d'arcs, options contextuelles retenues.
const realApply = applyProgramStoryChoice;
const playedThisSeason = {};
applyProgramStoryChoice = function (dilemma, choice) {
  M.stories++;
  if (dilemma.storyGeneric) { M.generic++; bump(M.situations, dilemma.storyDefId); }
  if (dilemma.storyArc) M.followUps++;
  const def = programStoryDef(dilemma.storyDefId);
  const spec = def?.c[choice.story?.index];
  if (spec?.needs) bump(M.contextual, spec.needs);
  const key = M.games + ':' + gameState.season + ':' + dilemma.programId; // partie, saison, programme
  if (playedThisSeason[key]) M.samePrograms++;
  playedThisSeason[key] = true;
  const rec = gameState.player.programStories?.[dilemma.programId];
  if (rec?.log.some(l => l.id === (dilemma.storyDefId ?? dilemma.id) && def?.repeat && gameState.season - l.season < def.repeat)) M.repeatDef++;
  const all = [dilemma.titre, dilemma.desc, dilemma.storyContext || '', dilemma.storyRecall || '', choice.l, choice.r].join(' ');
  if (/undefined|null|NaN|\{\w+\}/.test(all) && M.badText.length < 5) M.badText.push(all.slice(0, 200));
  return realApply(dilemma, choice);
};
function randomIdx(d) {
  const ok = (d.c || []).map((c, i) => c.disabled ? -1 : i).filter(i => i >= 0);
  return ok.length ? ok[Math.floor(Math.random() * ok.length)] : 0;
}
// Grille garnie : un programme du catalogue abordable sur chaque case libre.
function fillGrid() {
  const p = gameState.player;
  TIME_SLOTS.forEach(({ key }) => {
    if (p.contracts?.[key] || slotTakenByEvent(key)) return;
    const pool = PROGRAM_CATALOG.filter(x => x.channelType === p.type && x.slot === key && !programHolder(x))
      .map(x => ({ x, q: quoteProgram(key, x.id, 'interne') }))
      .filter(o => o.q?.allowed && p.tresorerie - (o.q.finance.purchase || 0) - (o.q.annual || 0) > 20);
    if (!pool.length) return;
    const o = pool[Math.floor(Math.random() * pool.length)];
    signProgram(key, o.x.id, 'interne'); reevaluateAdRevenue();
  });
}
function hireTalent() {
  const p = gameState.player;
  const genres = TIME_SLOTS.map(({ key }) => channelSlotProfile(p, key).genre);
  const t = MERCATO_TALENTS.find(m => genres.includes(m.specialty) && !(p.talents || []).some(x => x.id === m.id));
  if (t) signTalent({ ...t, annual: 1.2, bonus: 0.4 }, 'p1');
}
function trackArcs() {
  const open = openStoryArcs();
  M.maxOpen = Math.max(M.maxOpen, open.length);
  M.openSum += open.length;
  const per = {}; open.forEach(a => bump(per, a.entity.id));
  M.maxOpenPerProgram = Math.max(M.maxOpenPerProgram, ...Object.values(per), 0);
}
function playSeason() {
  for (let guard = 0; gameState.step === 6 && guard < 60; guard++) {
    const queue = gameState.dilemmaQueue || [];
    if (!queue.length) { M.empty++; return false; }
    const cur = queue[gameState.currentDilemmaIndex];
    if (!cur) { M.blocked++; return false; }
    if (gameState.dilemmaPhase === 'choosing' && cur.type === 'sports_rights_auction') { startSportsRightsAuction(cur.rightsEventId, cur.id); sportsAuctionPass(); }
    if (gameState.dilemmaPhase === 'choosing') {
      if ((gameState.dilemmaQueue || []).slice(gameState.currentDilemmaIndex).some(d => !narrativeValid(d))) revalidateNarrativeQueue();
      materializeCurrentDilemma();
      for (let k = 0; k < 7 && gameState.dilemmaPhase === 'choosing'; k++) chooseDilemmaOption(randomIdx(gameState.dilemmaQueue[gameState.currentDilemmaIndex]));
    }
    if (gameState.dilemmaPhase === 'choosing') { M.blocked++; return false; }
    continueAfterConsequence();
  }
  if (gameState.step === 6) { M.blocked++; return false; }
  return true;
}
for (const type of Object.keys(CHANNEL_TYPES)) for (let seed = 1; seed <= SEEDS; seed++) {
  let played = 0, game = 0;
  while (played < SEASONS && game < 200) {
    game++; M.games++;
    rng = (seed * 7919 + game * 104729 + type.length * 31) >>> 0;
    try {
      resetGame();
      const p = gameState.player; p.type = type; p.target = ['j1524', 'a2549', 's50', 'csp'][(seed + game) % 4]; p.name = 'Sim';
      finalizeChannelSetup(); gameState.campaign.seed = (seed * 2654435761 + game * 40503) >>> 0 || 1;
      p.tresorerie += 150; // de quoi garnir la grille
      if (seed % 3 === 0) p.isPlatform = true;
      fillGrid(); launchFirstSeason();
      for (let s = 0; s < 30 && played < SEASONS; s++) {
        gameState.seasonKickoffPending = false; gameState.mercatoPending = false;
        if (gameState.season === 2) hireTalent();
        trackArcs();
        if (!playSeason()) break;
        played++; M.seasons++; bump(M.perType, type);
        if (![7, 9, 10].includes(gameState.step)) break;
        gameState.step = 7; startNewSeason(); fillGrid();
        // Les arcs restent bornés et rattachés à un programme présent.
        (gameState.player.storyArcs || []).filter(a => a.state === 'open').forEach(a => {
          if (!Object.values(gameState.player.contracts || {}).some(c => c?.id === a.entity.id)) M.abandonedFollowUp++;
        });
      }
      (gameState.player.storyArcs || []).forEach(a => bump(M.arcsByType, a.arcId + ':' + a.state));
    } catch (e) { M.errors.push(type + '#' + seed + '/' + game + ' : ' + e.message + ' ' + (e.stack || '').split('\n')[1]); if (M.errors.length > 20) break; }
  }
}
globalThis.__M = M;
`;
const ctx = { console, structuredClone, URLSearchParams, SEASONS, SEEDS };
vm.createContext(ctx);
const t0 = Date.now();
vm.runInContext(scripts + '\n' + harness, ctx, { filename: 'narrative-arcs-sim.js' });
const M = ctx.__M;
const e = M.events, opened = e['arc ouvert'] || 0;
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + ' %' : '—';
const lines = [
  `Lot 3 — histoires génériques et arcs (${SEEDS} graines × ${SEASONS} saisons × 6 types, choix aléatoires) — ${Math.round((Date.now() - t0) / 1000)} s`,
  `Saisons jouées : ${M.seasons} ${JSON.stringify(M.perType)} ; parties : ${M.games}`,
  '',
  '| Mesure | Valeur |',
  '|---|---|',
  `| Histoires de programmes jouées | ${M.stories} (${(M.stories / M.seasons).toFixed(2)} par saison) |`,
  `| … dont variantes génériques par genre | ${M.generic} (${pct(M.generic, M.stories)}) |`,
  `| … dont suites d'arcs | ${M.followUps} |`,
  `| Arcs ouverts | ${opened} (${pct(opened, M.seasons)} des saisons) |`,
  `| Étapes intermédiaires (arc avancé) | ${e['arc avancé'] || 0} |`,
  `| Arcs résolus | ${e['arc résolu'] || 0} (${pct(e['arc résolu'] || 0, opened)} des ouvertures) |`,
  `| Arcs expirés | ${e['arc expiré'] || 0} (${pct(e['arc expiré'] || 0, opened)}) |`,
  `| Arcs abandonnés (programme retiré) | ${e['arc abandonné'] || 0} (${pct(e['arc abandonné'] || 0, opened)}) |`,
  `| Ouvertures refusées (plafond) | ${e['arc non ouvert'] || 0} |`,
  `| Arcs ouverts simultanés : maximum / moyenne par saison | ${M.maxOpen} / ${(M.openSum / Math.max(1, M.seasons)).toFixed(2)} (plafond ${3}) |`,
  `| Arcs ouverts sur un même programme (maximum) | ${M.maxOpenPerProgram} (plafond 1) |`,
  `| Arc ouvert sur un programme absent de la grille | ${M.abandonedFollowUp} |`,
  `| Deux histoires du même programme dans une saison | ${M.samePrograms} |`,
  `| Même histoire rejouée sur un programme avant son délai | ${M.repeatDef} |`,
  `| Options contextuelles retenues (talent / plateforme / partenaire / commande réduite) | ${M.contextual.talent} / ${M.contextual.platform} / ${M.contextual.partner} / ${M.contextual.reducible} |`,
  `| Textes incomplets (undefined, variable non remplacée) | ${M.badText.length} |`,
  `| Files vides / bloquées / erreurs | ${M.empty} / ${M.blocked} / ${M.errors.length} |`,
  '',
  'Situations génériques jouées : ' + Object.entries(M.situations).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '),
  'États finaux des arcs (par arc) : ' + Object.entries(M.arcsByType).sort().map(([k, v]) => `${k} ${v}`).join(', '),
  ...(M.badText.length ? ['Textes : ' + M.badText.join(' | ')] : []),
  ...(M.errors.length ? ['Erreurs : ' + M.errors.slice(0, 3).join(' ; ')] : [])
];
const text = lines.join('\n');
console.log(text);
if (OUT) fs.writeFileSync(OUT, text + '\n');
process.exitCode = M.errors.length || M.empty || M.blocked || M.badText.length || M.maxOpen > 3 || M.maxOpenPerProgram > 1 || M.abandonedFollowUp ? 1 : 0;
