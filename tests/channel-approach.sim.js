'use strict';
// Approches de chaînes concurrentes — simulation de calibration (graines reproductibles).
// Usage : node tests/channel-approach.sim.js [--seeds 3] [--seasons 30] [--out fichier]
// Six formats × trois politiques de jeu (aléatoire, audience : choix qui rapporte le plus
// d'audience, économe : choix le moins coûteux) × graines. La moitié des trajectoires acceptent
// la première offre, l'autre moitié refusent tout. Mesures : distribution des scores aux
// évaluations, saison de première approche, offres par carrière, voie (audience / rentabilité),
// formats éligibles, transferts, comptes avant et après la reprise.
const fs = require('node:fs');
const vm = require('node:vm');
const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def; };
const SEEDS = +arg('--seeds', 3), SEASONS = +arg('--seasons', 30), OUT = arg('--out', null);
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).slice(0, -1).join('\n');
const harness = String.raw`
render = () => {};
globalThis.localStorage = { d: {}, setItem(k, v) { this.d[k] = String(v); }, getItem(k) { return k in this.d ? this.d[k] : null; } };
let rng = 1;
Math.random = () => { rng = (Math.imul(rng, 1103515245) + 12345) >>> 0; return rng / 4294967296; };
globalThis.crypto = { getRandomValues: a => { a[0] = Math.floor(Math.random() * 4294967295); return a; } };
const M = { careers: [], evals: [], errors: [], blocked: 0, threshold: CHANNEL_APPROACH.threshold };
const POLICIES = {
  aleatoire: d => { const ok = (d.c || []).map((c, i) => c.disabled ? -1 : i).filter(i => i >= 0); return ok.length ? ok[Math.floor(Math.random() * ok.length)] : 0; },
  audience: d => { const t = gameState.player.target; let best = 0, v = -Infinity;
    (d.c || []).forEach((c, i) => { if (c.disabled) return; const s = (c.pda?.[t] || 0) + (c.audienceImpacts || []).reduce((a, x) => a + (x.targets?.[t] || 0), 0) + (c.story?.boost || 0) * 20; if (s > v) { v = s; best = i; } }); return best; },
  econome: d => { let best = 0, v = Infinity;
    (d.c || []).forEach((c, i) => { if (c.disabled) return; const f = c.finance || {}; const s = (f.purchase || 0) + Math.max(0, f.recurring || 0) * 2 - (f.commercial || 0) + (f.recurring < 0 ? f.recurring * 2 : 0); if (s < v) { v = s; best = i; } }); return best; }
};
function playSeason(policy) {
  gameState.seasonKickoffPending = false; gameState.mercatoPending = false;
  for (let g = 0; gameState.step === 6 && g < 80; g++) {
    const q = gameState.dilemmaQueue || [], cur = q[gameState.currentDilemmaIndex];
    if (!cur) { M.blocked++; return false; }
    if (gameState.dilemmaPhase === 'choosing' && cur.type === 'sports_rights_auction') { startSportsRightsAuction(cur.rightsEventId, cur.id); sportsAuctionPass(); }
    if (gameState.dilemmaPhase === 'choosing') {
      if (q.slice(gameState.currentDilemmaIndex).some(d => !narrativeValid(d))) revalidateNarrativeQueue();
      materializeCurrentDilemma();
      for (let k = 0; k < 7 && gameState.dilemmaPhase === 'choosing'; k++) {
        const d = gameState.dilemmaQueue[gameState.currentDilemmaIndex];
        chooseDilemmaOption(k === 0 ? POLICIES[policy](d) : POLICIES.aleatoire(d));
      }
    }
    if (gameState.dilemmaPhase === 'choosing') { M.blocked++; return false; }
    continueAfterConsequence();
  }
  return gameState.step !== 6;
}
for (const type of Object.keys(CHANNEL_TYPES)) for (const policy of Object.keys(POLICIES)) for (let seed = 1; seed <= SEEDS; seed++) {
  const accept = seed % 2 === 1;
  rng = (seed * 7919 + type.length * 104729 + policy.length * 31) >>> 0;
  const career = { type, policy, seed, accept, offers: [], transfers: [], first: null, seasons: 0, bankrupt: false };
  try {
    resetGame();
    const p = gameState.player; p.type = type; p.target = ['j1524', 'a2549', 's50', 'csp'][seed % 4]; p.name = 'Sim';
    finalizeChannelSetup(); gameState.campaign.seed = (seed * 2654435761 + type.length) >>> 0 || 1;
    p.tresorerie += 150;
    launchFirstSeason();
    for (let s = 0; s < SEASONS; s++) {
      if (!playSeason(policy)) break;
      career.seasons++;
      if (gameState.step === 8) { career.bankrupt = true; break; }
      const d = gameState.director, rec = d?.approach?.evaluated?.[gameState.season];
      if (rec?.scores) M.evals.push({ type: gameState.player.type, policy, season: gameState.season, ...rec.scores, probability: rec.probability, offered: rec.offered, transfers: d.transfers.length });
      const o = pendingChannelOffer();
      if (o) {
        career.offers.push({ season: gameState.season, path: o.path, motive: o.motive, mandate: o.mandate, from: gameState.player.type, to: o.type });
        career.first ??= gameState.season;
        const beforeCash = gameState.player.tresorerie;
        if (accept && !career.transfers.length) {
          const r = acceptChannelOffer();
          if (r.ok) career.transfers.push({ season: gameState.season, from: o.current.name, to: o.channelName, cashBefore: beforeCash, cashAfter: gameState.player.tresorerie, contribution: o.contribution });
          else M.errors.push('transfert : ' + r.reason);
        } else declineChannelOffer();
      }
      if (![7, 9, 10, 11].includes(gameState.step)) break;
      gameState.step = 7; gameState.renewalDue = false; startNewSeason();
    }
    const d = gameState.director;
    career.mandates = (d?.mandates || []).map(m => m.status);
    career.finalCash = gameState.player.tresorerie;
    career.channels = 1 + gameState.competitors.length;
  } catch (e) { M.errors.push(type + '/' + policy + '#' + seed + ' : ' + e.message + ' ' + (e.stack || '').split('\n')[1]); }
  M.careers.push(career);
}
globalThis.__M = M;
`;
const ctx = { console, structuredClone, URLSearchParams, SEEDS, SEASONS };
vm.createContext(ctx);
const t0 = Date.now();
vm.runInContext(scripts + '\n' + harness, ctx, { filename: 'channel-approach-sim.js' });
const M = ctx.__M;
const pct = (a, b) => b ? `${Math.round(100 * a / b)} %` : '—';
const q = (arr, p) => { const v = [...arr].sort((a, b) => a - b); return v.length ? v[Math.min(v.length - 1, Math.floor(p * v.length))] : null; };
const f2 = v => v == null ? '—' : v.toFixed(2).replace('.', ',');
const C = M.careers, E = M.evals;
const lines = [`Approches de chaînes concurrentes — 6 formats × 3 politiques × ${SEEDS} graines × ${SEASONS} saisons — ${Math.round((Date.now() - t0) / 1000)} s`,
  `Carrières : ${C.length} ; saisons jouées : ${C.reduce((a, c) => a + c.seasons, 0)} ; évaluations : ${E.length} ; faillites : ${C.filter(c => c.bankrupt).length}`, '',
  'Distribution des scores aux évaluations (p25 / p50 / p75 / p90) :',
  `- audience : ${[0.25, 0.5, 0.75, 0.9].map(p => f2(q(E.map(e => e.audience), p))).join(' / ')}`,
  `- rentabilité : ${[0.25, 0.5, 0.75, 0.9].map(p => f2(q(E.map(e => e.finance), p))).join(' / ')}`,
  `- score retenu : ${[0.25, 0.5, 0.75, 0.9].map(p => f2(q(E.map(e => e.base), p))).join(' / ')}`,
  `Évaluations éligibles : ${pct(E.filter(e => e.base >= M.threshold).length, E.length)} ; offres : ${pct(E.filter(e => e.offered).length, E.length)} des évaluations`, '',
  '| Politique | Carrières avec offre | 1re approche (médiane, min–max) | Offres par carrière (moy.) | Voie audience / rentabilité | Transferts |',
  '|---|---:|---:|---:|---:|---:|'];
for (const policy of ['aleatoire', 'audience', 'econome']) {
  const cs = C.filter(c => c.policy === policy), withOffer = cs.filter(c => c.offers.length);
  const firsts = withOffer.map(c => c.first), offers = cs.flatMap(c => c.offers);
  lines.push(`| ${policy} | ${withOffer.length}/${cs.length} | ${firsts.length ? `S${q(firsts, 0.5)} (S${Math.min(...firsts)}–S${Math.max(...firsts)})` : '—'} | ${(offers.length / Math.max(1, cs.length)).toFixed(2).replace('.', ',')} | ${offers.filter(o => o.path === 'audience').length} / ${offers.filter(o => o.path === 'finance').length} | ${cs.filter(c => c.transfers.length).length} |`);
}
lines.push('', '| Format de départ | Carrières avec offre | Offres | Évaluations éligibles |', '|---|---:|---:|---:|');
for (const type of [...new Set(C.map(c => c.type))]) {
  const cs = C.filter(c => c.type === type), ev = E.filter(e => e.type === type);
  lines.push(`| ${type} | ${cs.filter(c => c.offers.length).length}/${cs.length} | ${cs.reduce((a, c) => a + c.offers.length, 0)} | ${pct(ev.filter(e => e.base >= M.threshold).length, ev.length)} |`);
}
const offers = C.flatMap(c => c.offers);
const count = k => Object.entries(offers.reduce((o, x) => (o[x[k]] = (o[x[k]] || 0) + 1, o), {})).map(([a, b]) => `${a} ${b}`).join(', ');
lines.push('', `Motifs : ${count('motive') || '—'}`, `Mandats : ${count('mandate') || '—'}`, `Formats des chaînes qui approchent : ${count('to') || '—'}`);
const tr = C.flatMap(c => c.transfers.map(t => ({ ...t, career: c })));
lines.push(`Transferts : ${tr.length} ; trésorerie avant → après la reprise (moy.) : ${tr.length ? `${(tr.reduce((a, t) => a + t.cashBefore, 0) / tr.length).toFixed(1)} → ${(tr.reduce((a, t) => a + t.cashAfter, 0) / tr.length).toFixed(1)} M€` : '—'} ; apports : ${tr.filter(t => t.contribution > 0).length}`);
lines.push(`Mandats jugés : ${C.flatMap(c => c.mandates || []).join(', ') || '—'}`);
lines.push(`Six chaînes en fin de partie : ${C.every(c => c.channels === 6) ? 'oui' : 'NON'} ; files bloquées : ${M.blocked} ; erreurs : ${M.errors.length}`);
if (M.errors.length) lines.push('Erreurs : ' + M.errors.slice(0, 3).join(' ; '));
const text = lines.join('\n');
console.log(text);
if (OUT) fs.writeFileSync(OUT, text + '\n');
process.exitCode = M.errors.length || C.some(c => c.channels !== 6) ? 1 : 0;
