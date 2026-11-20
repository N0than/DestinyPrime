'use strict';
// Lot 2 — diversité des saisons : mêmes indicateurs mesurés sur la version courante et sur la
// version de référence (lot 1), en jouant des choix aléatoires.
// Usage : node tests/narrative-diversity.sim.js [--seasons 500] [--seeds 5] [--rev 615e519] [--out fichier]
// Pour chaque type de chaîne et chaque graine, des parties successives sont jouées jusqu'à
// totaliser --seasons saisons (6 types × graines × saisons). Les thèmes de la version de
// référence sont calculés avec la taxonomie courante (bloc « THÈMES NARRATIFS » injecté).
const fs = require('node:fs');
const vm = require('node:vm');
const { execSync } = require('node:child_process');

const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def; };
const SEASONS = +arg('--seasons', 500), SEEDS = +arg('--seeds', 5), REV = arg('--rev', '615e519'), OUT = arg('--out', null);
const scriptsOf = html => [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).slice(0, -1).join('\n');
const current = fs.readFileSync('index.html', 'utf8');
const reference = execSync(`git show ${REV}:index.html`, { maxBuffer: 64 << 20 }).toString();
const themesBlock = (() => {
  const a = current.indexOf('// ——— THÈMES NARRATIFS (début) ———'), b = current.indexOf('// ——— THÈMES NARRATIFS (fin) ———');
  return current.slice(a, b);
})();

const harness = String.raw`
render = () => {};
globalThis.localStorage = { d: {}, setItem(k, v) { this.d[k] = String(v); }, getItem(k) { return k in this.d ? this.d[k] : null; } };
let rng = 1;
Math.random = () => { rng = (Math.imul(rng, 1103515245) + 12345) >>> 0; return rng / 4294967296; };
globalThis.crypto = { getRandomValues: a => { a[0] = Math.floor(Math.random() * 4294967295); return a; } };
const M = { seasons: 0, perType: {}, themes: {}, dominant: 0, dupTheme: 0, dupProgram: 0, crisisSeasons: 0, crisisTwice: 0,
  calm: 0, struggling: 0, strugglingCalm: 0, stories: 0, bank: 0, sources: {}, lostRight: 0, lostRenewal: 0, postponedEvents: 0,
  empty: 0, blocked: 0, errors: [] };
const bump = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
const optionalSource = d => d.isProgramStory ? 'story' : d.isProducerPitch ? 'producer' : d.isBiddingWar ? 'biddingWar'
  : d.isCrisis ? 'crisis' : d.isRegieOpportunity ? 'regie' : null;
const isMandatory = d => d.type === 'sports_rights_auction' || d.requiresRight || STORY_EVENTS.some(e => e.id === d.id) || d.isCareerScripted;

const realPick = pickDilemmaQueue;
pickDilemmaQueue = function () {
  ensureCampaign();
  const p = gameState.player;
  const right = getEligibleDilemmas().find(d => d.requiresRight);
  const event = STORY_EVENTS.find(e => e.eligible(p) && !p.eventsSeen.includes(e.id));
  const struggling = p.tresorerie < 15 || p.popularite < 40;
  const q = realPick();
  const rdv = q.filter(d => !isRenewalDilemma(d));
  M.seasons++; bump(M.perType, p.type);
  const infos = rdv.map(d => ({ d, ...(narrativeDescribe(d) || { theme: 'autre', tone: 'neutral' }) }));
  const counts = {};
  infos.forEach(x => { bump(M.themes, x.theme); bump(counts, x.theme); });
  M.dominant += Math.max(...Object.values(counts)) / Math.max(1, rdv.length);
  if (Object.values(counts).some(n => n > 1)) M.dupTheme++;
  const programs = infos.map(x => x.programId).filter(Boolean);
  if (new Set(programs).size < programs.length) M.dupProgram++;
  const crises = infos.filter(x => x.theme === 'crise' && !isMandatory(x.d)).length;
  if (crises >= 1) M.crisisSeasons++;
  if (crises >= 2) M.crisisTwice++;
  const calm = infos.some(x => x.tone !== 'negative');
  if (calm) M.calm++;
  if (struggling) { M.struggling++; if (calm) M.strugglingCalm++; }
  rdv.forEach(d => { const s = optionalSource(d); if (s === 'story') M.stories++; else if (!s && !isMandatory(d)) M.bank++; });
  new Set(rdv.map(optionalSource).filter(Boolean)).forEach(s => bump(M.sources, s));
  if (right && !q.some(d => d.id === right.id)) M.lostRight++;
  if (event && !q.some(d => d.id === event.id)) { M.postponedEvents++; if (p.eventsSeen.includes(event.id)) M.lostRight++; }
  const r = buildRenewalDilemmas();
  if (q.filter(isRenewalDilemma).length !== r.main.length + (r.talent ? 1 : 0)) M.lostRenewal++;
  return q;
};
function randomIdx(d) {
  const ok = (d.c || []).map((c, i) => c.disabled ? -1 : i).filter(i => i >= 0);
  return ok.length ? ok[Math.floor(Math.random() * ok.length)] : 0;
}
function playSeason() {
  for (let guard = 0; gameState.step === 6 && guard < 60; guard++) {
    const queue = gameState.dilemmaQueue || [];
    if (!queue.length) { M.empty++; return false; }
    const cur = queue[gameState.currentDilemmaIndex];
    if (!cur) { M.blocked++; return false; }
    if (gameState.dilemmaPhase === 'choosing' && cur.type === 'sports_rights_auction') { startSportsRightsAuction(cur.rightsEventId, cur.id); sportsAuctionPass(); }
    if (gameState.dilemmaPhase === 'choosing') {
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
  while (played < SEASONS && game < 400) {
    game++;
    rng = (seed * 7919 + game * 104729 + type.length) >>> 0;
    try {
      resetGame();
      const p = gameState.player; p.type = type; p.target = ['j1524', 'a2549', 's50', 'csp'][(seed + game) % 4]; p.name = 'Sim';
      finalizeChannelSetup(); gameState.campaign.seed = (seed * 2654435761 + game * 40503) >>> 0 || 1; launchFirstSeason();
      for (let s = 0; s < 40 && played < SEASONS; s++) {
        gameState.seasonKickoffPending = false; gameState.mercatoPending = false;
        if (!playSeason()) break;
        played++;
        if (![7, 9, 10].includes(gameState.step)) break;
        gameState.step = 7; startNewSeason();
      }
    } catch (e) { M.errors.push(type + '#' + seed + '/' + game + ' : ' + e.message + ' ' + (e.stack || '').split('\n')[1]); if (M.errors.length > 20) break; }
  }
}
globalThis.__M = M;
`;
function run(html, withThemes) {
  const ctx = { console, structuredClone, URLSearchParams, SEASONS, SEEDS };
  vm.createContext(ctx);
  vm.runInContext(scriptsOf(html) + '\n' + (withThemes ? themesBlock : '') + '\n' + harness, ctx);
  return ctx.__M;
}
const t0 = Date.now();
const now = run(current, false);
// Taxonomie injectée seulement si la référence ne l'a pas (lot 1) ; une référence du lot 2 ou
// plus garde la sienne.
const ref = run(reference, !reference.includes('const NARRATIVE_THEMES'));
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + ' %' : '—';
const row = (label, f, target) => `| ${label} | ${f(ref)} | ${f(now)} | ${target} |`;
const themeDist = m => Object.entries(m.themes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v, Object.values(m.themes).reduce((s, x) => s + x, 0))}`).join(', ');
const lines = [
  `Diversité des saisons (${SEEDS} graines × ${SEASONS} saisons × 6 types, choix aléatoires) ; référence : ${REV}`,
  `Saisons jouées : référence ${ref.seasons}, version courante ${now.seasons} — ${Math.round((Date.now() - t0) / 1000)} s`,
  '',
  `| Indicateur | Référence (${REV}) | Version courante | Cible proposée |`,
  '|---|---|---|---|',
  row('Part moyenne du thème dominant par saison', m => (100 * m.dominant / m.seasons).toFixed(1) + ' %', '≤ 45 % (33 % = trois thèmes distincts)'),
  row('Saisons avec deux dilemmes du même thème', m => pct(m.dupTheme, m.seasons), '≤ 10 %'),
  row('Saisons avec deux sollicitations du même programme', m => pct(m.dupProgram, m.seasons), '≤ 1 %'),
  row('Saisons avec une crise facultative', m => pct(m.crisisSeasons, m.seasons), '20 à 35 %'),
  row('Saisons avec deux crises facultatives ou plus', m => pct(m.crisisTwice, m.seasons), '0 %'),
  row('Saisons avec au moins un dilemme neutre ou positif', m => pct(m.calm, m.seasons), '≥ 60 %'),
  row('… chaînes en difficulté (trésorerie < 15 M€ ou popularité < 40)', m => `${pct(m.strugglingCalm, m.struggling)} (${m.struggling} saisons)`, '≥ 60 %'),
  row('Histoires contextuelles / (histoires + banque générale)', m => pct(m.stories, m.stories + m.bank), '15 à 35 %'),
  row('Saisons avec démarchage', m => pct(m.sources.producer || 0, m.seasons), 'proche du lot 1'),
  row('Saisons avec mise en concurrence', m => pct(m.sources.biddingWar || 0, m.seasons), 'proche du lot 1'),
  row('Saisons avec opportunité régie', m => pct(m.sources.regie || 0, m.seasons), 'proche du lot 1'),
  row('Saisons avec crise contextuelle', m => pct(m.sources.crisis || 0, m.seasons), 'proche du lot 1'),
  row('Saisons avec histoire de programme', m => pct(m.sources.story || 0, m.seasons), 'proche du lot 1'),
  row('Obligations perdues (droit diffusé, événement consommé sans être joué)', m => String(m.lostRight), '0'),
  row('Renouvellements dus absents', m => String(m.lostRenewal), '0'),
  row('Événements de campagne reportés (non consommés)', m => pct(m.postponedEvents, m.seasons), 'information'),
  row('Files vides / bloquées', m => `${m.empty} / ${m.blocked}`, '0 / 0'),
  row('Erreurs', m => String(m.errors.length), '0'),
  '',
  `Distribution des thèmes — référence : ${themeDist(ref)}`,
  `Distribution des thèmes — version courante : ${themeDist(now)}`,
  ...(now.errors.length ? ['Erreurs lot 2 : ' + now.errors.slice(0, 3).join(' ; ')] : []),
  ...(ref.errors.length ? ['Erreurs lot 1 : ' + ref.errors.slice(0, 3).join(' ; ')] : [])
];
const text = lines.join('\n');
console.log(text);
if (OUT) fs.writeFileSync(OUT, text + '\n');
process.exitCode = now.errors.length || now.empty || now.blocked || now.lostRight || now.lostRenewal ? 1 : 0;
