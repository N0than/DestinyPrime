'use strict';
// Économie des concurrents IA — simulation headless (graines reproductibles).
// Usage : node tests/competitor-economy.sim.js [--seeds 4] [--seasons 30] [--out fichier]
// Six types de chaînes pour le joueur × graines ; choix aléatoires (générateur déterministe).
// Mesures par profil de concurrent : trésorerie, recettes, charges, résultat, investissements
// (droits d'entrée, droits sportifs, ripostes), apports d'actionnaire, PDA ; contrôle de
// l'identité comptable de chaque saison clôturée ; détection des dérives.
const fs = require('node:fs');
const vm = require('node:vm');
const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def; };
const SEEDS = +arg('--seeds', 4), SEASONS = +arg('--seasons', 30), OUT = arg('--out', null);
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).slice(0, -1).join('\n');
const harness = String.raw`
render = () => {};
globalThis.localStorage = { d: {}, setItem(k, v) { this.d[k] = String(v); }, getItem(k) { return k in this.d ? this.d[k] : null; } };
let rng = 1;
Math.random = () => { rng = (Math.imul(rng, 1103515245) + 12345) >>> 0; return rng / 4294967296; };
globalThis.crypto = { getRandomValues: a => { a[0] = Math.floor(Math.random() * 4294967295); return a; } };
const M = { games: 0, seasons: 0, rows: [], identity: 0, identityChecks: 0, errors: [], blocked: 0, unrenewed: 0 };
function randomIdx(d) { const ok = (d.c || []).map((c, i) => c.disabled ? -1 : i).filter(i => i >= 0); return ok.length ? ok[Math.floor(Math.random() * ok.length)] : 0; }
function playSeason() {
  for (let guard = 0; gameState.step === 6 && guard < 60; guard++) {
    const queue = gameState.dilemmaQueue || [], cur = queue[gameState.currentDilemmaIndex];
    if (!cur) { M.blocked++; return false; }
    if (gameState.dilemmaPhase === 'choosing' && cur.type === 'sports_rights_auction') { startSportsRightsAuction(cur.rightsEventId, cur.id); sportsAuctionPass(); }
    if (gameState.dilemmaPhase === 'choosing') {
      if (queue.slice(gameState.currentDilemmaIndex).some(d => !narrativeValid(d))) revalidateNarrativeQueue();
      materializeCurrentDilemma();
      for (let k = 0; k < 7 && gameState.dilemmaPhase === 'choosing'; k++) chooseDilemmaOption(randomIdx(gameState.dilemmaQueue[gameState.currentDilemmaIndex]));
    }
    if (gameState.dilemmaPhase === 'choosing') { M.blocked++; return false; }
    continueAfterConsequence();
  }
  return gameState.step !== 6;
}
for (const type of Object.keys(CHANNEL_TYPES)) for (let seed = 1; seed <= SEEDS; seed++) {
  M.games++;
  rng = (seed * 7919 + type.length * 104729) >>> 0;
  try {
    resetGame();
    const p = gameState.player; p.type = type; p.target = ['j1524', 'a2549', 's50', 'csp'][seed % 4]; p.name = 'Sim';
    finalizeChannelSetup(); gameState.campaign.seed = (seed * 2654435761) >>> 0 || 1;
    p.tresorerie += 400; // le joueur ne fait pas faillite : la partie dure
    launchFirstSeason();
    for (let s = 0; s < SEASONS; s++) {
      gameState.seasonKickoffPending = false; gameState.mercatoPending = false;
      if (!playSeason()) break;
      M.seasons++;
      gameState.competitors.forEach(c => {
        const h = c.finance.history.at(-1);
        if (!h || h.season !== gameState.season) return;
        M.identityChecks++;
        const expected = h.opening + h.adRevenue + h.otherIncome + h.contributions - h.recurring - h.sportsRights - h.sportsProduction - h.oneOff - h.distributions;
        if (Math.abs(expected - h.closing) > 0.01) M.identity++;
        const row = getCalculatedPDAs().find(r => r.channel === c);
        M.rows.push({ type, seed, season: gameState.season, name: c.name, profile: c.strategy, ctype: c.type, ...h,
          pda: row.pda[c.target], levels: Object.values(c.contracts).map(k => k.investLevel ?? 0).reduce((a, b) => a + b, 0),
          rightsOwned: (gameState.sportsRights?.owned || []).filter(o => o.ownerName === c.name && o.broadcastSeason >= gameState.season).length,
          austerity: competitorAusterity(c) });
        if (TIME_SLOTS.some(({ key }) => !c.contracts[key] && !competitorSportsRightOn(c, key))) M.unrenewed++;
      });
      if (![7, 9, 10].includes(gameState.step)) break;
      gameState.step = 7; startNewSeason();
    }
  } catch (e) { M.errors.push(type + '#' + seed + ' : ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
}
globalThis.__M = M;
`;
const ctx = { console, structuredClone, URLSearchParams, SEEDS, SEASONS };
vm.createContext(ctx);
const t0 = Date.now();
vm.runInContext(scripts + '\n' + harness, ctx, { filename: 'competitor-economy-sim.js' });
const M = ctx.__M;
const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
const f1 = v => (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');
const by = (key, rows) => rows.reduce((o, r) => { (o[r[key]] ??= []).push(r); return o; }, {});
const lines = [`Économie des concurrents IA — ${SEEDS} graines × 6 types (joueur) × ${SEASONS} saisons, choix aléatoires — ${Math.round((Date.now() - t0) / 1000)} s`,
  `Parties : ${M.games} ; saisons jouées : ${M.seasons} ; saisons-concurrent clôturées : ${M.rows.length}`, '',
  '| Profil | Trésorerie moy. (fin) | Trésorerie min / max | Recettes pub moy. | Charges récurrentes moy. | Ponctuel moy. (droits, ripostes) | Droits + prod. sportifs moy. | Résultat moy. | Saisons en déficit | Apports (nb / M€) | Distributions moy. | Saisons sous austérité | PDA moy. |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|'];
Object.entries(by('profile', M.rows)).forEach(([profile, rows]) => {
  const last = rows.filter(r => r.season === Math.max(...rows.filter(x => x.type === r.type && x.seed === r.seed && x.name === r.name).map(x => x.season)));
  const contrib = rows.filter(r => r.contributions > 0);
  lines.push(`| ${profile} | ${f1(avg(last.map(r => r.closing)))} | ${f1(Math.min(...rows.map(r => r.closing)))} / ${f1(Math.max(...rows.map(r => r.closing)))} | ${f1(avg(rows.map(r => r.adRevenue)))} | ${f1(avg(rows.map(r => r.recurring)))} | ${f1(avg(rows.map(r => r.oneOff)))} | ${f1(avg(rows.map(r => r.sportsRights + r.sportsProduction)))} | ${f1(avg(rows.map(r => r.result)))} | ${Math.round(100 * rows.filter(r => r.result < 0).length / rows.length)} % | ${contrib.length} / ${f1(contrib.reduce((s, r) => s + r.contributions, 0))} | ${f1(avg(rows.map(r => r.distributions)))} | ${Math.round(100 * rows.filter(r => r.austerity).length / rows.length)} % | ${f1(avg(rows.map(r => r.pda)))} |`);
});
lines.push('', '| Type de chaîne (concurrent) | Trésorerie moy. (fin) | Recettes pub moy. | Charges récurrentes moy. | Résultat moy. | PDA moy. |', '|---|---:|---:|---:|---:|---:|');
Object.entries(by('ctype', M.rows)).forEach(([t, rows]) => {
  const last = rows.filter(r => r.season === SEASONS || r.season === Math.max(...rows.map(x => x.season)));
  lines.push(`| ${t} | ${f1(avg(last.map(r => r.closing)))} | ${f1(avg(rows.map(r => r.adRevenue)))} | ${f1(avg(rows.map(r => r.recurring)))} | ${f1(avg(rows.map(r => r.result)))} | ${f1(avg(rows.map(r => r.pda)))} |`);
});
// Trajectoire moyenne de la trésorerie (toutes chaînes) par saison.
const bySeason = by('season', M.rows);
lines.push('', 'Trésorerie moyenne par saison : ' + Object.keys(bySeason).map(Number).sort((a, b) => a - b).filter(s => s === 1 || s % 5 === 0).map(s => `S${s} ${f1(avg(bySeason[s].map(r => r.closing)))}`).join(' · '));
// Dérives : enrichissement (trésorerie > 5 × charges annuelles), déficits systématiques (5 saisons de suite).
const trajectories = by('key', M.rows.map(r => ({ ...r, key: `${r.type}#${r.seed}#${r.name}` })));
let rich = 0, chronic = 0;
Object.values(trajectories).forEach(rows => {
  const last = rows.at(-1), mid = rows[Math.floor(rows.length / 2)];
  // Enrichissement continu : la trésorerie de fin dépasse de moitié celle de mi-partie et
  // trois fois les charges annuelles.
  if (rows.length >= 10 && last.closing > 1.5 * Math.max(1, mid.closing) && last.closing > 3 * Math.max(1, last.recurring)) rich++;
  let run = 0, worst = 0; rows.forEach(r => { run = r.result < 0 ? run + 1 : 0; worst = Math.max(worst, run); });
  if (worst >= 5) chronic++;
});
lines.push(`Trajectoires : ${Object.keys(trajectories).length} ; enrichissement continu (fin > 1,5 × mi-partie et > 3 × charges) : ${rich} ; ≥ 5 déficits consécutifs : ${chronic}`);
lines.push(`Identité comptable (clôture = ouverture + recettes + apports − dépenses) : ${M.identityChecks - M.identity}/${M.identityChecks} saisons conformes`);
lines.push(`Cases sans programme (hors événement) en fin de saison : ${M.unrenewed} ; files bloquées : ${M.blocked} ; erreurs : ${M.errors.length}`);
if (M.errors.length) lines.push('Erreurs : ' + M.errors.slice(0, 3).join(' ; '));
const text = lines.join('\n');
console.log(text);
if (OUT) fs.writeFileSync(OUT, text + '\n');
process.exitCode = M.identity || M.errors.length || M.blocked ? 1 : 0;
