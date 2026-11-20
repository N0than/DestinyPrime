'use strict';
// Lot 1 — vérifications headless de la file narrative (collecte, sélection, engagement).
// Usage : node tests/narrative-queue.sim.js [saisonsParType=220] [--out fichier]
//
// 1. Équivalence : à chaque tirage de file, l'ancien sélecteur (pickDilemmaQueueLegacy, extrait
//    de la révision de référence et gardé ici, hors du jeu) et le nouveau partent du même état
//    cloné ; on compare les files (ids, ordre), la graine de campagne et le flux des droits.
// 2. Pureté : instantané JSON de gameState identique avant et après toutes les collect…Candidates().
// 3. Crises : une crise mûre finit jouée, en attente, ou résolue explicitement (expirée,
//    corrigée), jamais perdue en silence ; scénario forcé d'expiration.
// 4. Ancienne sauvegarde : un état sérialisé par l'ancienne version en milieu de saison se
//    charge dans la nouvelle et se joue jusqu'au bout.
// 5. Files : jamais vides ni bloquées ; renouvellements présents quand ils sont dus ;
//    décisions scénarisées du mode Carrière conservées.
const fs = require('node:fs');
const vm = require('node:vm');
const { execSync } = require('node:child_process');

const BASE_REV = '6fdce0a'; // dernière révision avant le Lot 1
const args = process.argv.slice(2);
const SEASONS_PER_TYPE = +(args.find(a => /^\d+$/.test(a)) || 220);
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
// Comparaison avec l'ancien sélecteur : pertinente pour le lot 1 seulement (le lot 2 change
// volontairement la sélection) ; activée par --compare.
const COMPARE = args.includes('--compare');

const scriptsOf = html => [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).slice(0, -1).join('\n');
const newHtml = fs.readFileSync('index.html', 'utf8');
const oldHtml = execSync(`git show ${BASE_REV}:index.html`, { maxBuffer: 64 << 20 }).toString();

// Extraction d'une fonction de premier niveau de l'ancienne version : elle se termine à la
// première accolade fermante en début de ligne.
function extract(src, name) {
  const i = src.indexOf(`\nfunction ${name}(`);
  if (i < 0) throw Error('fonction introuvable : ' + name);
  const end = src.indexOf('\n}\n', i);
  return src.slice(i + 1, end + 2);
}
const LEGACY = ['pickDilemmaQueue', 'placeProgramStories', 'scheduleSportsAuction', 'pickProducerPitch',
  'createProducerPitchDilemma', 'pickBiddingWar', 'createBiddingWarDilemma'];
const rename = text => [...LEGACY, 'producerDraw'].reduce((t, n) => t.replace(new RegExp(`\\b${n}\\b`, 'g'), n + 'Legacy'), text);
const legacyCode = 'const producerDrawLegacy = () => Math.random() < 0.5;\n' + LEGACY.map(n => rename(extract(oldHtml, n))).join('\n');

const harness = String.raw`
render = () => {};
const store = { d: {}, setItem(k, v) { this.d[k] = String(v); }, getItem(k) { return k in this.d ? this.d[k] : null; }, removeItem(k) { delete this.d[k]; } };
globalThis.localStorage = store;
let rng = 1;
Math.random = () => { rng = (Math.imul(rng, 1103515245) + 12345) >>> 0; return rng / 4294967296; };
globalThis.crypto = { getRandomValues: a => { a[0] = Math.floor(Math.random() * 4294967295); return a; } };
const xorshift = x => { x >>>= 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return x >>> 0; };
const report = { calls: 0, sameQueue: 0, sameSeed: 0, seedGenderOnly: 0, sameSports: 0, diffs: [], reasons: {},
  purity: { checks: 0, fails: [] }, crisis: { pending: 0, placed: 0, waited: 0, expired: 0, resolved: 0, played: 0, silent: [], waitingAtEnd: 0 },
  queue: { checks: 0, empty: 0, blocked: [], renewalMissing: [], careerScriptedLost: [] }, seasons: {}, games: 0, errors: [] };
const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };

// ——— Ancien sélecteur, gardé pour la comparaison ———
__LEGACY_CODE__

// Copie de l'état qui garde l'identité des objets de référence (banque, événements, catalogue).
function cloneState(state) {
  const seen = new Map();
  [...DILEMMA_BANK, ...STORY_EVENTS, ...PROGRAM_CATALOG, ...Object.values(SPORT_RIGHTS_EVENTS)].forEach(o => seen.set(o, o));
  return cloneGameStateValue(state, seen);
}
const narrativeEvents = [];
console.log = ((log) => (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('[narratif')) narrativeEvents.push(a); else log(...a); })(console.log);
NARRATIVE_DEBUG = true;

// ——— Comparaison à chaque tirage de file ———
const realPick = pickDilemmaQueue;
let comparing = COMPARE; // comparaison limitée aux parties libres (pas aux scénarios forcés)
pickDilemmaQueue = function () {
  // Pureté : toutes les collectes, sans écriture.
  ensureCampaign();
  const before = JSON.stringify(gameState), lsBefore = JSON.stringify(store.d);
  collectNarrativeCandidates();
  report.purity.checks++;
  if (JSON.stringify(gameState) !== before || JSON.stringify(store.d) !== lsBefore) {
    const a = JSON.parse(before), b = JSON.parse(JSON.stringify(gameState));
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
    const pk = keys.includes('player') ? Object.keys(b.player).filter(k => JSON.stringify(a.player[k]) !== JSON.stringify(b.player[k])) : [];
    report.purity.fails.push({ season: gameState.season, keys, player: pk });
  }
  if (!comparing) {
    const pending = gameState.pendingCrisis?.key || null;
    const q = realPick();
    report.calls++;
    if (pending) {
      report.crisis.pending++;
      if (q.some(d => d.isCrisis && d.crisisKey === pending)) report.crisis.placed++;
      else if (gameState.pendingCrisis?.key === pending) report.crisis.waited++;
    }
    const r = buildRenewalDilemmas();
    if (q.filter(isRenewalDilemma).length !== r.main.length + (r.talent ? 1 : 0)) report.queue.renewalMissing.push({ season: gameState.season });
    return q;
  }
  // Ancien sélecteur sur une copie de l'état (mêmes flux aléatoires, même mémoire locale).
  const ls = JSON.stringify(store.d), rngBefore = rng, real = gameState;
  gameState = cloneState(real);
  let legacy;
  try {
    const q = pickDilemmaQueueLegacy();
    legacy = { ids: q.map(d => d.id), seed: gameState.campaign.seed, sports: JSON.stringify(gameState.sportsRights) };
  } catch (e) { legacy = { error: e.message }; }
  gameState = real; store.d = JSON.parse(ls); rng = rngBefore;
  // Nouveau sélecteur sur l'état réel.
  const pending = gameState.pendingCrisis?.key || null;
  const q = realPick();
  report.calls++;
  const ids = q.map(d => d.id);
  const sameQueue = !legacy.error && ids.join('|') === legacy.ids.join('|');
  if (sameQueue) report.sameQueue++;
  if (!legacy.error && JSON.stringify(gameState.sportsRights) === legacy.sports) report.sameSports++;
  // Graine : un tirage de plus par démarchage ou mise en concurrence construits (genre).
  const genderDraws = q.filter(d => d.isProducerPitch || d.isBiddingWar).length;
  let expected = legacy.seed;
  for (let k = 0; k < genderDraws; k++) expected = xorshift(expected);
  if (gameState.campaign.seed === legacy.seed) report.sameSeed++;
  else if (gameState.campaign.seed === expected) report.seedGenderOnly++;
  if (!sameQueue) {
    bump(report.reasons, legacy.error ? 'erreur ancien sélecteur : ' + legacy.error : 'file différente');
    if (report.diffs.length < 12) report.diffs.push({ type: gameState.player.type, season: gameState.season, legacy: legacy.ids, nouveau: ids });
  }
  // Crises.
  if (pending) {
    report.crisis.pending++;
    if (q.some(d => d.isCrisis && d.crisisKey === pending)) report.crisis.placed++;
    else if (gameState.pendingCrisis?.key === pending) report.crisis.waited++;
  }
  // Renouvellements dus : présents en fin de file.
  const r = buildRenewalDilemmas();
  const due = r.main.length + (r.talent ? 1 : 0);
  if (q.filter(isRenewalDilemma).length !== due) report.queue.renewalMissing.push({ season: gameState.season, due, got: q.filter(isRenewalDilemma).length });
  return q;
};
const realCarry = carryPendingCrisis;
carryPendingCrisis = function (waiting, fresh) {
  const mark = narrativeEvents.length;
  const out = realCarry(waiting, fresh);
  if (waiting && out?.key !== waiting.key) {
    const logs = narrativeEvents.slice(mark).map(a => a[0]);
    if (logs.some(l => /crise expirée/.test(l))) report.crisis.expired++;
    else if (logs.some(l => /crise abandonnée/.test(l))) report.crisis.resolved++;
    else report.crisis.silent.push({ season: gameState.season, key: waiting.key });
  }
  return out;
};

// ——— Politique de jeu « gestion » ———
function pickIdx(d) {
  const ok = (d.c || []).map((c, i) => c.disabled ? -1 : i).filter(i => i >= 0);
  if (!ok.length) return 0;
  const left = Math.max(1, 6 - gameState.season);
  const score = i => { const ch = d.c[i], f = ch.finance || {}; const pda = Object.values(ch.pda || {}).reduce((a, b) => a + b, 0) / 4;
    return (f.commercial || 0) - (f.purchase || 0) - (f.recurring || 0) * left + pda * 6 + (ch.pop || 0) * 0.3 + (Math.random() - 0.5); };
  return ok.slice().sort((a, b) => score(b) - score(a))[0];
}
function playDilemmas(maxSteps = 60) {
  let guard = 0;
  while (gameState.step === 6 && guard++ < maxSteps) {
    report.queue.checks++;
    const queue = gameState.dilemmaQueue || [];
    if (!queue.length) { report.queue.empty++; return false; }
    const cur = queue[gameState.currentDilemmaIndex];
    if (!cur) { report.queue.blocked.push({ season: gameState.season, index: gameState.currentDilemmaIndex, length: queue.length }); return false; }
    if (gameState.dilemmaPhase === 'choosing' && cur.type === 'sports_rights_auction') { startSportsRightsAuction(cur.rightsEventId, cur.id); sportsAuctionPass(); }
    if (gameState.dilemmaPhase === 'choosing') {
      materializeCurrentDilemma();
      chooseDilemmaOption(pickIdx(gameState.dilemmaQueue[gameState.currentDilemmaIndex]));
      for (let k = 0; k < 6 && gameState.dilemmaPhase === 'choosing'; k++) chooseDilemmaOption(pickIdx(gameState.dilemmaQueue[gameState.currentDilemmaIndex]));
    }
    if (gameState.dilemmaPhase === 'choosing') { report.queue.blocked.push({ season: gameState.season, id: cur.id, raison: 'choix impossible' }); return false; }
    continueAfterConsequence();
  }
  if (gameState.step === 6) { report.queue.blocked.push({ season: gameState.season, raison: 'saison sans fin' }); return false; }
  return true;
}
function seasonOpen() { gameState.seasonKickoffPending = false; gameState.mercatoPending = false; }
// Partie libre : jouée jusqu'à la fin (faillite, échéance) ou maxSeasons.
function playGame(type, seed, maxSeasons = 12) {
  rng = seed * 7919 + 17;
  resetGame();
  const p = gameState.player; p.type = type; p.target = ['j1524', 'a2549', 's50', 'csp'][seed % 4]; p.name = 'Chaîne ' + seed;
  finalizeChannelSetup(); gameState.campaign.seed = (seed * 2654435761) >>> 0 || 1; launchFirstSeason(); seasonOpen();
  report.games++;
  let played = 0;
  while (played < maxSeasons) {
    if (!playDilemmas()) break;
    played++; bump(report.seasons, type);
    if (gameState.step === 7 || gameState.step === 9 || gameState.step === 10) { gameState.step = 7; startNewSeason(); seasonOpen(); continue; }
    break;
  }
  if (gameState.pendingCrisis) report.crisis.waitingAtEnd++;
  report.crisis.played += (gameState.player.crisisHistory || []).length;
  return played;
}
// ——— 1, 2, 3, 5 : parties libres, six types de chaîne ———
for (const type of Object.keys(CHANNEL_TYPES)) {
  let seed = 1;
  while ((report.seasons[type] || 0) < SEASONS_PER_TYPE && seed < 400) {
    try { playGame(type, seed); } catch (e) { report.errors.push(type + '#' + seed + ' : ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
    seed++;
  }
}
// ——— 3 bis : crise sans place, attente puis expiration explicite ———
comparing = false;
{
  rng = 99; resetGame(); const p = gameState.player; p.type = 'generaliste'; p.name = 'Crise';
  finalizeChannelSetup(); launchFirstSeason(); seasonOpen(); playDilemmas();
  const crisisWeight = NARRATIVE_TUNING.sourceWeight.crisis;
  NARRATIVE_TUNING.sourceWeight.crisis = 0; // la crise n'est jamais retenue
  const crisisLife = [];
  for (let s = 0; s < 7 && gameState.step === 7; s++) {
    p.tresorerie = -5; // vulnérabilité « trésorerie » entretenue
    startNewSeason(); seasonOpen();
    const w = p.crisisWatch?.cash;
    crisisLife.push({ season: gameState.season, pending: gameState.pendingCrisis?.key || null, since: gameState.pendingCrisis?.waitingSince ?? null,
      expired: w?.expired ?? null, inQueue: gameState.dilemmaQueue.some(d => d.isCrisis) });
    playDilemmas();
    if (gameState.step === 8) { gameState.step = 7; gameState.gameOverReason = null; }
  }
  NARRATIVE_TUNING.sourceWeight.crisis = crisisWeight;
  report.forcedCrisis = crisisLife;
}
// ——— 5 bis : mode Carrière, décisions scénarisées conservées (et tirages comparés) ———
comparing = COMPARE;
{
  const lost = [];
  for (let id = 1; id <= CAREER_SCENARIOS.length; id++) for (const seed of [3, 11]) {
    try {
      rng = seed * 31 + id; startCareerGame(id); seasonOpen();
      for (let s = 0; s < 8; s++) {
        const scripted = gameState.dilemmaQueue.filter(d => d.isCareerScripted).map(d => d.id);
        if (!playDilemmas()) break;
        const played = new Set(gameState.dilemmaQueue.map(d => d.id));
        scripted.forEach(x => { if (!played.has(x)) lost.push(id + ':' + x); });
        if (gameState.step !== 7) break;
        startNewSeason(); seasonOpen();
      }
    } catch (e) { report.errors.push('carrière ' + id + ' : ' + e.message); }
  }
  report.queue.careerScriptedLost = lost;
}
globalThis.__report = report;
`;

const context = { console, structuredClone, URLSearchParams, SEASONS_PER_TYPE, COMPARE };
vm.createContext(context);
vm.runInContext(scriptsOf(newHtml) + '\n' + harness.replace('__LEGACY_CODE__', () => legacyCode), context, { filename: 'narrative-sim.js' });
const report = context.__report;

// ——— 4 : ancienne sauvegarde chargée en milieu de saison ———
// L'ancienne version (révision de référence) joue jusqu'au milieu de la saison 3 ; son état
// sérialisé (JSON, comme une sauvegarde) est rechargé dans la nouvelle, qui finit la partie.
const oldCtx = { console };
vm.createContext(oldCtx);
vm.runInContext(scriptsOf(oldHtml) + String.raw`
render = () => {};
globalThis.localStorage = { d: {}, setItem(k, v) { this.d[k] = String(v); }, getItem(k) { return k in this.d ? this.d[k] : null; } };
let r = 4242; Math.random = () => { r = (Math.imul(r, 1103515245) + 12345) >>> 0; return r / 4294967296; };
const saves = [];
for (const [type, seed] of [['generaliste', 5], ['sport', 6], ['jeunesse', 7], ['culture', 8], ['cinema', 9], ['info', 10]]) {
  resetGame(); gameState.player.type = type; gameState.player.name = 'Ancienne ' + seed;
  finalizeChannelSetup(); gameState.campaign.seed = seed * 1000003; launchFirstSeason();
  for (let guard = 0; guard < 200; guard++) {
    gameState.seasonKickoffPending = false; gameState.mercatoPending = false;
    if (gameState.season === 3 && gameState.currentDilemmaIndex === 1 && gameState.step === 6) break;
    if (gameState.step === 6) {
      const cur = gameState.dilemmaQueue[gameState.currentDilemmaIndex];
      if (gameState.dilemmaPhase === 'choosing' && cur.type === 'sports_rights_auction') { startSportsRightsAuction(cur.rightsEventId, cur.id); sportsAuctionPass(); }
      if (gameState.dilemmaPhase === 'choosing') { chooseDilemmaOption(0); if (gameState.dilemmaPhase === 'choosing') chooseDilemmaOption(1); }
      continueAfterConsequence(); continue;
    }
    if (gameState.step === 7) { startNewSeason(); continue; }
    break;
  }
  saves.push(JSON.stringify(gameState));
}
globalThis.__saves = saves;`, oldCtx);
const loadCtx = { console, structuredClone, URLSearchParams, SAVES: oldCtx.__saves };
vm.createContext(loadCtx);
vm.runInContext(scriptsOf(newHtml) + String.raw`
render = () => {};
globalThis.localStorage = { d: {}, setItem(k, v) { this.d[k] = String(v); }, getItem(k) { return k in this.d ? this.d[k] : null; } };
const results = [];
for (const json of SAVES) {
  const saved = JSON.parse(json);
  gameState = saved;
  const start = { season: gameState.season, index: gameState.currentDilemmaIndex, queue: gameState.dilemmaQueue.map(d => d.id) };
  let ok = true, why = '', seasons = 0;
  try {
    for (let guard = 0; guard < 300 && seasons < 4; guard++) {
      gameState.seasonKickoffPending = false; gameState.mercatoPending = false;
      if (gameState.step === 6) {
        if (gameState.dilemmaPhase === 'choosing') {
          // Revalidation avant affichage, comme au rendu réel.
          if ((gameState.dilemmaQueue || []).slice(gameState.currentDilemmaIndex).some(d => !narrativeValid(d))) revalidateNarrativeQueue();
          materializeCurrentDilemma();
        }
        const cur = gameState.dilemmaQueue[gameState.currentDilemmaIndex];
        if (!cur) { ok = false; why = 'file bloquée'; break; }
        if (gameState.dilemmaPhase === 'choosing' && cur.type === 'sports_rights_auction') { startSportsRightsAuction(cur.rightsEventId, cur.id); sportsAuctionPass(); }
        if (gameState.dilemmaPhase === 'choosing') { chooseDilemmaOption(0); if (gameState.dilemmaPhase === 'choosing') chooseDilemmaOption(1); }
        continueAfterConsequence(); continue;
      }
      if (gameState.step === 7) { seasons++; startNewSeason(); continue; }
      break;
    }
  } catch (e) { ok = false; why = e.message + ' ' + (e.stack || '').split('\n')[1]; }
  results.push({ type: saved.player.type, start, end: { season: gameState.season, step: gameState.step }, seasons, ok, why });
}
globalThis.__load = results;`, loadCtx);
report.oldSaves = loadCtx.__load;

// ——— Rapport ———
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + ' %' : '—';
const c = report.crisis, lines = [];
lines.push(`Lot 1 — simulation headless, référence ${BASE_REV}`);
lines.push(`Parties libres : ${report.games} ; saisons jouées par type : ${JSON.stringify(report.seasons)}`);
lines.push('');
lines.push('1. Équivalence avec l’ancien sélecteur (même état d’entrée à chaque tirage)' + (COMPARE ? '' : ' — non demandée (--compare), tirages comptés seulement'));
lines.push(`   tirages ${COMPARE ? 'comparés' : 'joués'} : ${report.calls}`);
if (COMPARE) {
lines.push(`   files identiques (ids et ordre) : ${report.sameQueue} (${pct(report.sameQueue, report.calls)})`);
lines.push(`   graine de campagne identique : ${report.sameSeed} ; identique au tirage du genre près : ${report.seedGenderOnly} ; total ${pct(report.sameSeed + report.seedGenderOnly, report.calls)}`);
lines.push(`   flux et calendrier des droits sportifs identiques : ${report.sameSports} (${pct(report.sameSports, report.calls)})`);
lines.push(`   divergences : ${JSON.stringify(report.reasons)}`);
report.diffs.forEach(d => lines.push(`     ${d.type} S${d.season} : ancien ${d.legacy?.join(',')} / nouveau ${d.nouveau.join(',')}`));
}
lines.push('');
lines.push('2. Pureté des collectes (JSON de gameState et mémoire locale avant/après)');
lines.push(`   contrôles : ${report.purity.checks} ; écarts : ${report.purity.fails.length}`);
report.purity.fails.slice(0, 5).forEach(f => lines.push(`     S${f.season} : ${f.keys.join(',')} ${f.player.join(',')}`));
lines.push('');
lines.push('3. Crises');
lines.push(`   tirages avec crise mûre : ${c.pending} ; placées : ${c.placed} ; mises en attente : ${c.waited}`);
lines.push(`   sorties de l’attente : expirées ${c.expired}, résolues (corrigées ou jouées) ${c.resolved}, perdues en silence ${c.silent.length}`);
lines.push(`   crises jouées (historique) : ${c.played} ; en attente en fin de partie : ${c.waitingAtEnd}`);
lines.push('   scénario forcé (aucune place) : ' + report.forcedCrisis.map(x => `S${x.season} ${x.pending || '—'}${x.since != null ? ' depuis S' + x.since : ''}${x.expired != null ? ' expirée S' + x.expired : ''}`).join(' | '));
lines.push('');
lines.push('4. Ancienne sauvegarde (état sérialisé par ' + BASE_REV + ' en milieu de saison 3)');
report.oldSaves.forEach(r => lines.push(`   ${r.type} : S${r.start.season} dilemme ${r.start.index + 1}/${r.start.queue.length} → S${r.end.season} (étape ${r.end.step}), ${r.seasons} saison(s) terminée(s) ${r.ok ? 'OK' : 'ÉCHEC ' + r.why}`));
lines.push('');
lines.push('5. Files');
lines.push(`   contrôles : ${report.queue.checks} ; vides : ${report.queue.empty} ; bloquées : ${report.queue.blocked.length}`);
lines.push(`   renouvellements dus absents : ${report.queue.renewalMissing.length}`);
lines.push(`   décisions scénarisées du mode Carrière perdues (38 défis × 2 graines) : ${report.queue.careerScriptedLost.length}`);
lines.push(`   erreurs : ${report.errors.length}${report.errors.length ? ' — ' + report.errors.slice(0, 3).join(' ; ') : ''}`);
const text = lines.join('\n');
console.log(text);
if (OUT) fs.writeFileSync(OUT, text + '\n');
const failed = report.purity.fails.length || c.silent.length || report.queue.empty || report.queue.blocked.length
  || report.queue.renewalMissing.length || report.queue.careerScriptedLost.length || report.errors.length || report.oldSaves.some(r => !r.ok);
process.exitCode = failed ? 1 : 0;
