'use strict';
// Lot 3 (et consolidation) — simulation headless des histoires génériques et des arcs.
// Usage : node tests/narrative-arcs.sim.js [--seeds 5] [--seasons 120] [--out fichier] [--rev REV]
// --rev : simule la version d'index.html d'un commit (git show REV:index.html), pour comparer
// avant / après sur les mêmes graines et les mêmes règles.
//
// Règles de la partie simulée (inchangées depuis le lot 3) : six types de chaînes × graines,
// choix aléatoires uniformes parmi les options disponibles ; la grille est garnie en début de
// saison (programmes du catalogue signés sur les cases libres, comme un joueur actif), un
// talent est recruté en saison 2, une partie sur trois devient plateforme (graine multiple de 3).
// États artificiels : trésorerie +150 au départ (pour garnir la grille), plateforme forcée.
//
// Instrumentation externe, sans toucher aux règles : la collecte des candidats est observée
// (enveloppe de collectStoryCandidates), la file à sa création (enveloppe de pickDilemmaQueue),
// les arcs par comparaison de l'état saison après saison. Les diagnostics d'exclusion appellent
// genericStoryCheck (ou, sur une version antérieure, une reconstitution équivalente) : la
// simulation vérifie qu'ils ne consomment aucun tirage et n'écrivent rien (pureté).
//
// Par arc :
//   ouvertures éligibles    (saison, programme) où une ouverture de l'arc était candidate ;
//   ouvertures proposées    (saison, programme) où un dilemme de la file pouvait ouvrir l'arc ;
//   ouverts                 arcs effectivement ouverts (dont par une histoire propre au titre) ;
//   occasions de suite      (saison, arc ouvert) où une suite était candidate (une par saison) ;
//   suites proposées        (saison, arc ouvert) où une suite figurait dans la file ;
//   suites jouées           étapes ajoutées à un arc ;
//   résolus, expirés (sans suite devenue éligible / suites éligibles non retenues),
//   abandonnés, ouverts en fin de partie, cohorte (arcs ouverts assez tôt pour atteindre
//   leur échéance avant la fin de la partie).
const fs = require('node:fs');
const vm = require('node:vm');
const { execSync } = require('node:child_process');

const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def; };
const SEEDS = +arg('--seeds', 5), SEASONS = +arg('--seasons', 120), OUT = arg('--out', null), REV = arg('--rev', null);
const html = REV ? execSync(`git show ${REV}:index.html`, { maxBuffer: 64 << 20 }).toString() : fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).slice(0, -1).join('\n');

const harness = String.raw`
render = () => {};
globalThis.localStorage = { d: {}, setItem(k, v) { this.d[k] = String(v); }, getItem(k) { return k in this.d ? this.d[k] : null; } };
let rng = 1;
Math.random = () => { rng = (Math.imul(rng, 1103515245) + 12345) >>> 0; return rng / 4294967296; };
globalThis.crypto = { getRandomValues: a => { a[0] = Math.floor(Math.random() * 4294967295); return a; } };
const ARCS = Object.keys(NARRATIVE_ARCS);
const row = () => ({ eligibleOpen: 0, proposedOpen: 0, opened: 0, bySpecific: 0, followOccasions: 0, followProposed: 0, followPlayed: 0,
  resolved: 0, expiredNoFollow: 0, expiredNotSelected: 0, abandoned: 0, openAtEnd: 0, cohort: 0, cohortResolved: 0, reasons: {}, followReasons: {} });
const M = { seasons: 0, perType: {}, games: 0, arcs: Object.fromEntries(ARCS.map(a => [a, row()])), capRefused: 0,
  maxOpen: 0, maxOpenPerProgram: 0, openSum: 0, doubleOpen: 0, stories: 0, generic: 0, specific: 0, followUps: 0,
  genericBreakdown: {}, genericBySituation: {}, priorityViolations: 0, closeCauseMismatch: 0,
  contextual: { talent: 0, platform: 0, partner: 0, reducible: 0, rival: 0, rights: 0 },
  samePrograms: 0, repeatDef: 0, badText: [], empty: 0, blocked: 0, errors: [], impure: 0, checks: 0,
  uncertain: {}, outcomeErrors: 0 };
const bump = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
const NEW = typeof genericStoryCheck === 'function';
const LINKS = typeof SPECIFIC_ARC_LINKS !== 'undefined' ? SPECIFIC_ARC_LINKS : {};
console.log = ((log) => (...a) => {
  if (typeof a[0] === 'string' && a[0].startsWith('[narratif')) { if (/arc non ouvert/.test(a[0])) M.capRefused++; return; }
  log(...a);
})(console.log);
NARRATIVE_DEBUG = true;

// Version antérieure : motif d'exclusion reconstitué avec les fonctions de la version.
function legacyCheck(def, ctx, keys) {
  const T = NARRATIVE_TUNING;
  if (def.genres && !def.genres.some(g => ctx.genres.includes(g))) return 'genre';
  if (def.excludeGenres?.some(g => ctx.genres.includes(g))) return 'genre';
  if (def.slots && !def.slots.includes(ctx.slot)) return 'case';
  if (def.channelTypes && !def.channelTypes.includes(gameState.player.type)) return 'type de chaîne';
  const miss = (def.requires || []).find(r => !STORY_RESOURCES[r](ctx));
  if (miss) return 'ressource : ' + miss;
  if (def.arc) {
    const open = openStoryArcs(ctx.contract.id).find(a => a.arcId === def.arc.id);
    if (!open || open.step !== def.arc.step - 1) return 'arc : pas à cette étape';
    if (gameState.season - open.lastSeason < T.arcs.followUpDelay) return 'arc : délai';
    if (def.arc.branch && !def.arc.branch.includes(open.branch)) return 'arc : branche';
    if (def.arc.outcome && !def.arc.outcome.includes(storyArcOutcome(open, ctx))) return 'arc : évolution';
  }
  if (!programStoryMatches(def, ctx)) return 'conditions';
  if (!def.arc) {
    if (def.genericKey && keys.has(def.genericKey)) return 'priorité : histoire propre éligible';
    if (def.genericKey && (storyKeyPlayedRecently(ctx.record, def.genericKey, false) || storyKeyPlayedRecently(ctx.record, def.genericKey, true))) return 'fenêtre de situation';
    if (def.opensArc && (openStoryArcs(ctx.contract.id).length >= T.arcs.maxOpenPerProgram || openStoryArcs().length >= T.arcs.maxOpen)) return 'plafond d’arcs';
  }
  return genericStoryMatches(def, ctx, keys) ? null : 'choix ou variable';
}
const reasonOf = (def, ctx, keys, steps) => NEW ? (r => r.ok ? null : r.reason)(genericStoryCheck(def, ctx, keys, steps)) : legacyCheck(def, ctx, keys);
// Ouvertures possibles d'une candidate : variante générique (opensArc) ou histoire propre
// au titre reliée à un arc (choix dont l'ouverture est possible).
function opensOf(c) {
  if (c.def.isGeneric) return c.def.opensArc && !c.arc ? [c.def.opensArc] : [];
  const link = LINKS[c.def.id];
  if (!link || link.arc) return [];
  return [...new Set(Object.values(link.choices || {}).filter(l => typeof l === 'object' && storyLinkOpenable(l, c.ctx)).map(l => l.open))];
}

// Observation de la collecte (une fois par saison et par programme, quelle que soit la
// fréquence des appels).
const seen = new Set(), key = (...k) => M.games + ':' + gameState.season + ':' + k.join(':');
let lastCandidates = [];
const realCollect = collectStoryCandidates;
collectStoryCandidates = function (...args) {
  const before = JSON.stringify([gameState.player.programStories || null, gameState.player.storyArcs || null]), r0 = rng;
  const list = realCollect.apply(this, args);
  if (rng !== r0 || JSON.stringify([gameState.player.programStories || null, gameState.player.storyArcs || null]) !== before) M.impure++;
  M.checks++;
  lastCandidates = list;
  const r1 = rng;
  try { observe(list); } finally { if (rng !== r1) M.impure++; }
  return list;
};
function observe(list) {
  const p = gameState.player, rows = getCalculatedPDAs();
  list.forEach(c => {
    const s = c.story;
    opensOf(s).forEach(a => { if (!seen.has(key('o', s.contract.id, a))) { seen.add(key('o', s.contract.id, a)); M.arcs[a].eligibleOpen++; } });
    if (s.arc && !seen.has(key('f', s.contract.id, s.arc.arcId))) { seen.add(key('f', s.contract.id, s.arc.arcId)); M.arcs[s.arc.arcId].followOccasions++; occasion(s.contract.id, s.arc.arcId); }
  });
  // Motifs : ouvertures génériques non candidates, suites attendues d'un arc ouvert.
  TIME_SLOTS.forEach(({ key: slot }) => {
    const contract = p.contracts?.[slot];
    if (!contract || contract.isSportsEvent || !programStoryAirs(slot, contract.id) || seen.has(key('r', contract.id))) return;
    seen.add(key('r', contract.id));
    const ctx = programStoryContext(slot, contract, rows);
    const mine = list.filter(c => c.programId === contract.id).map(c => c.story);
    const keys = new Set(mine.filter(c => !c.def.isGeneric).map(c => c.def.genericKey).filter(Boolean));
    const steps = new Set(mine.filter(c => !c.def.isGeneric && c.arc).map(c => c.arc.arcId));
    GENRE_STORY_BANK.filter(d => d.opensArc).forEach(def => {
      const r = reasonOf(def, ctx, keys, steps);
      if (r) bump(M.arcs[def.opensArc].reasons, r);
    });
    openStoryArcs(contract.id).forEach(arc => {
      if (mine.some(c => c.arc?.arcId === arc.arcId)) return;
      const next = GENRE_STORY_BANK.filter(d => d.arc?.id === arc.arcId && d.arc.step === arc.step + 1);
      // Motif le plus avancé parmi les suites de l'étape : délai, branche, évolution, conditions.
      const rs = next.map(d => reasonOf(d, ctx, keys, steps)).filter(Boolean);
      const order = ['arc : délai', 'arc : branche', 'arc : évolution'];
      const best = rs.find(r => !order.includes(r) && r !== 'arc : pas à cette étape') || order.find(o => rs.includes(o)) || rs[0] || 'aucune';
      bump(M.arcs[arc.arcId].followReasons, best);
    });
  });
}
// Occasions de suite par arc (objet), notées par la simulation pour classer les expirations
// de la même façon sur les deux versions.
const occ = new WeakMap();
function occasion(pid, arcId) {
  const arc = openStoryArcs(pid).find(a => a.arcId === arcId);
  if (!arc) return;
  if (!occ.has(arc)) occ.set(arc, []);
  occ.get(arc).push(gameState.season);
}
const realPick = pickDilemmaQueue;
pickDilemmaQueue = function () {
  const q = realPick.apply(this, arguments);
  (q || []).filter(d => d?.isProgramStory).forEach(d => {
    const opens = new Set((d.c || []).map(c => c.story?.arc?.open).filter(Boolean));
    opens.forEach(a => { if (!seen.has(key('po', d.programId, a))) { seen.add(key('po', d.programId, a)); M.arcs[a].proposedOpen++; } });
    if (d.storyArc && !seen.has(key('pf', d.programId, d.storyArc.arcId))) { seen.add(key('pf', d.programId, d.storyArc.arcId)); M.arcs[d.storyArc.arcId].followProposed++; }
  });
  return q;
};

// Histoires jouées.
const realApply = applyProgramStoryChoice;
const playedThisSeason = {};
applyProgramStoryChoice = function (dilemma, choice) {
  M.stories++;
  const def = programStoryDef(dilemma.storyDefId);
  if (dilemma.storyGeneric) {
    M.generic++; bump(M.genericBySituation, dilemma.storyDefId);
    // Répartition : format original, programme sans histoire propre, histoires propres
    // épuisées, histoires propres encore jouables sur d'autres situations.
    const program = findProgram(dilemma.programId), own = PROGRAM_STORIES_BY_PROGRAM[dilemma.programId] || [];
    const rec = gameState.player.programStories?.[dilemma.programId] || { log: [] };
    const left = own.filter(d => (d.repeat ?? 'unique') !== 'unique' || !rec.log.some(l => l.id === d.id));
    bump(M.genericBreakdown, program?.original ? 'format original' : !own.length ? 'programme sans histoire propre'
      : !left.length ? 'histoires propres épuisées' : 'histoires propres encore jouables (autres situations)');
    if (!def?.arc && lastCandidates.some(c => c.programId === dilemma.programId && !c.story.def.isGeneric && c.story.def.genericKey && c.story.def.genericKey === def?.genericKey)) M.priorityViolations++;
  } else M.specific++;
  if (dilemma.storyArc) M.followUps++;
  // Issues incertaines (lot 4) : probabilités affichées (somme des p) et issues observées.
  if (choice.story?.uncertain) {
    const u = choice.story.uncertain, o = choice.story.outcome, T = NARRATIVE_TUNING.outcomes;
    const row = M.uncertain[u.model] ??= { n: 0, expected: {}, observed: {} };
    row.n++;
    u.outcomes.forEach(x => { row.expected[x.key] = (row.expected[x.key] || 0) + x.p; });
    if (o) row.observed[o.key] = (row.observed[o.key] || 0) + 1;
    const sum = u.outcomes.reduce((a, x) => a + x.p, 0);
    if (!o || !dilemma.resolvedOutcome || dilemma.resolvedOutcome.key !== o.key || Math.abs(sum - 1) > 1e-5
      || u.outcomes.some(x => x.p < T.min - 1e-6 || x.p > T.max + 1e-6)) M.outcomeErrors++;
  }
  const spec = def?.c[choice.story?.index];
  if (spec?.needs) bump(M.contextual, spec.needs);
  const k = M.games + ':' + gameState.season + ':' + dilemma.programId;
  if (playedThisSeason[k]) M.samePrograms++;
  playedThisSeason[k] = true;
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
// Suivi des arcs par comparaison d'état.
let known = new Map();
function trackArcs() {
  const arcs = gameState.player.storyArcs || [], open = arcs.filter(a => a.state === 'open');
  arcs.forEach(a => {
    const k = known.get(a), r = M.arcs[a.arcId];
    if (!k) { r.opened++; if (/^ps_/.test(a.history[0]?.defId || '')) r.bySpecific++; known.set(a, { steps: a.history.length, state: a.state }); r.followPlayed += a.history.length - 1; closeObs(a, 'open'); return; }
    r.followPlayed += a.history.length - k.steps; k.steps = a.history.length;
    closeObs(a, k.state); k.state = a.state;
  });
  M.maxOpen = Math.max(M.maxOpen, open.length);
  M.openSum += open.length;
  const per = {}; open.forEach(a => { bump(per, a.entity.id); });
  M.maxOpenPerProgram = Math.max(M.maxOpenPerProgram, ...Object.values(per), 0);
  const pairs = new Set(); open.forEach(a => { const k = a.entity.id + a.arcId; if (pairs.has(k)) M.doubleOpen++; pairs.add(k); });
}
function closeObs(a, prev) {
  if (prev !== 'open' || a.state === 'open') return;
  const r = M.arcs[a.arcId];
  if (a.state === 'resolu') r.resolved++;
  else if (a.state === 'abandonne') r.abandoned++;
  else if (a.state === 'expire') {
    const missed = (occ.get(a) || []).some(s => s > a.lastSeason);
    if (missed) r.expiredNotSelected++; else r.expiredNoFollow++;
    if (a.closeCause && a.closeCause !== (missed ? 'non_retenue' : 'sans_suite')) M.closeCauseMismatch++;
  }
}
function endGame() {
  trackArcs();
  const T = NARRATIVE_TUNING.arcs, end = gameState.season;
  [...known.keys()].forEach(a => {
    const r = M.arcs[a.arcId];
    if (a.state === 'open') r.openAtEnd++;
    // Cohorte : ouverts assez tôt pour que leur échéance soit passée en fin de partie.
    if (a.openedSeason + T.maxDuration < end) { r.cohort++; if (a.state === 'resolu') r.cohortResolved++; }
  });
  known = new Map();
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
      p.tresorerie += 150;
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
      }
      endGame();
    } catch (e) { known = new Map(); M.errors.push(type + '#' + seed + '/' + game + ' : ' + e.message + ' ' + (e.stack || '').split('\n')[1]); if (M.errors.length > 20) break; }
  }
}
globalThis.__M = M;
`;
const ctx = { console, structuredClone, URLSearchParams, SEASONS, SEEDS };
vm.createContext(ctx);
const t0 = Date.now();
vm.runInContext(scripts + '\n' + harness, ctx, { filename: 'narrative-arcs-sim.js' });
const M = ctx.__M;
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + ' %' : '—';
const A = M.arcs, ids = Object.keys(A);
const sum = k => ids.reduce((s, a) => s + A[a][k], 0);
const col = (label, k, fmt = v => v) => `| ${label} | ${ids.map(a => fmt(A[a][k], A[a])).join(' | ')} | ${fmt(sum(k), Object.fromEntries(Object.keys(A[ids[0]]).map(kk => [kk, typeof A[ids[0]][kk] === 'number' ? sum(kk) : 0])))} |`;
const top = o => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v}`).join(' ; ') || '—';
const lines = [
  `Histoires génériques et arcs${REV ? ` — version ${REV}` : ''} (${SEEDS} graines × ${SEASONS} saisons × 6 types, choix aléatoires) — ${Math.round((Date.now() - t0) / 1000)} s`,
  `Saisons jouées : ${M.seasons} ${JSON.stringify(M.perType)} ; parties : ${M.games}`,
  '',
  `| Par arc | ${ids.join(' | ')} | total |`,
  `|---|${ids.map(() => '---:').join('|')}|---:|`,
  col('Ouvertures éligibles (saison × programme)', 'eligibleOpen'),
  col('Ouvertures proposées dans la file', 'proposedOpen'),
  col('Arcs ouverts', 'opened'),
  col('… dont par une histoire propre au titre', 'bySpecific'),
  col('Occasions de suite (saison × arc ouvert)', 'followOccasions'),
  col('Suites proposées dans la file', 'followProposed'),
  col('Suites jouées (étapes)', 'followPlayed'),
  col('Résolus', 'resolved', (v, r) => `${v} (${pct(v, r.opened)})`),
  col('Expirés sans suite devenue éligible', 'expiredNoFollow'),
  col('Expirés malgré des suites éligibles non retenues', 'expiredNotSelected'),
  col('Abandonnés (programme retiré)', 'abandoned'),
  col('Ouverts en fin de partie', 'openAtEnd'),
  col('Cohorte (échéance atteinte avant la fin)', 'cohort'),
  col('… dont résolus', 'cohortResolved', (v, r) => `${v} (${pct(v, r.cohort)})`),
  '',
  'Motifs d’exclusion des ouvertures génériques (saison × programme × définition) :',
  ...ids.map(a => `- ${a} : ${top(A[a].reasons)}`),
  'Motifs d’absence de suite pour un arc ouvert (saison × arc) :',
  ...ids.map(a => `- ${a} : ${top(A[a].followReasons)}`),
  '',
  '| Contrôles | Valeur |',
  '|---|---|',
  `| Histoires de programmes jouées | ${M.stories} (${(M.stories / M.seasons).toFixed(2)} par saison) |`,
  `| … propres au titre / génériques | ${M.specific} / ${M.generic} (${pct(M.generic, M.stories)} génériques) |`,
  `| … dont suites d'arcs | ${M.followUps} |`,
  `| Génériques : ${Object.keys(M.genericBreakdown).length ? Object.entries(M.genericBreakdown).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v} (${pct(v, M.generic)})`).join(' ; ') : '—'} | |`,
  `| Génériques jouées alors qu'une histoire propre de la même situation était éligible | ${M.priorityViolations} |`,
  `| Ouvertures refusées au moment du choix (plafond) | ${M.capRefused} |`,
  `| Arcs ouverts simultanés : maximum / moyenne par saison | ${M.maxOpen} / ${(M.openSum / Math.max(1, M.seasons)).toFixed(2)} (plafond 3) |`,
  `| Arcs ouverts sur un même programme (maximum) / même arc ouvert deux fois | ${M.maxOpenPerProgram} (plafond 1) / ${M.doubleOpen} |`,
  `| Cause d'expiration enregistrée ≠ cause observée | ${M.closeCauseMismatch} |`,
  `| Deux histoires du même programme dans une saison | ${M.samePrograms} |`,
  `| Même histoire rejouée sur un programme avant son délai | ${M.repeatDef} |`,
  `| Options contextuelles retenues (talent / plateforme / partenaire / commande réduite / concurrent / droits) | ${['talent', 'platform', 'partner', 'reducible', 'rival', 'rights'].map(k => M.contextual[k] || 0).join(' / ')} |`,
  `| Collecte ou diagnostic impur (tirage ou écriture) | ${M.impure} sur ${M.checks} collectes |`,
  `| Textes incomplets | ${M.badText.length} |`,
  ...(M.uncertain && Object.keys(M.uncertain).length ? [`| Issues incertaines : anomalies (non tirée, non enregistrée, hors bornes, somme ≠ 1) | ${M.outcomeErrors} |`] : []),
  `| Files vides / bloquées / erreurs | ${M.empty} / ${M.blocked} / ${M.errors.length} |`,
  '',
  ...(M.uncertain && Object.keys(M.uncertain).length ? ['', '| Issues incertaines (lot 4) | choix joués | issues : observé / attendu (somme des probabilités affichées) |', '|---|---:|---|',
    ...Object.entries(M.uncertain).map(([k, r]) => `| ${k} | ${r.n} | ${Object.keys(r.expected).map(o => `${o} ${r.observed[o] || 0} / ${r.expected[o].toFixed(1)}`).join(' ; ')} |`), ''] : []),
  'Situations génériques jouées : ' + Object.entries(M.genericBySituation).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '),
  ...(M.badText.length ? ['Textes : ' + M.badText.join(' | ')] : []),
  ...(M.errors.length ? ['Erreurs : ' + M.errors.slice(0, 3).join(' ; ')] : [])
];
const text = lines.join('\n');
console.log(text);
if (OUT) fs.writeFileSync(OUT, text + '\n');
process.exitCode = M.outcomeErrors || M.errors.length || M.empty || M.blocked || M.badText.length || M.maxOpen > 3 || M.maxOpenPerProgram > 1 || M.doubleOpen || M.impure ? 1 : 0;
