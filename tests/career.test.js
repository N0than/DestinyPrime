'use strict';
// Mode Carrière : données des 32 scénarios (8 familles), progression localStorage (stockage
// vide, illisible ou indisponible), déverrouillage, conditions de départ, contraintes et
// verdicts des scénarios jouables, écrans de victoire et de défaite.
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const tests = String.raw`
const ok=(v,m)=>{if(!v) throw Error(m)};
const near=(a,b,e=1e-6)=>Math.abs(a-b)<e;
render=()=>{};
const store={d:{},setItem(k,v){this.d[k]=String(v)},getItem(k){return k in this.d?this.d[k]:null},removeItem(k){delete this.d[k]}};
globalThis.localStorage=store;
function carriere(id, seed=4242, target='a2549'){
  let r=seed>>>0; Math.random=()=>{r=(Math.imul(r,1103515245)+12345)>>>0; return r/4294967296;};
  resetGame();
  gameState.career={scenarioId:id,startSeason:1,status:'active'};
  const rule=CAREER_RULES[id]; if(rule.type) gameState.player.type=rule.type;
  const p=gameState.player; p.name='Joueur'; p.target=target;
  finalizeChannelSetup(); gameState.campaign.seed=seed; launchFirstSeason();
  gameState.seasonKickoffPending=false; gameState.mercatoPending=false;
  return p;
}
function finirSaison(){
  let guard=0; while(gameState.step===6&&guard++<30){
    const cur=gameState.dilemmaQueue[gameState.currentDilemmaIndex];
    if(gameState.dilemmaPhase==='choosing'&&cur?.type==='sports_rights_auction'){ startSportsRightsAuction(cur.rightsEventId,cur.id); sportsAuctionPass(); }
    if(gameState.dilemmaPhase==='choosing'){ chooseDilemmaOption(0); if(gameState.dilemmaPhase==='choosing'&&gameState.dilemmaQueue[gameState.currentDilemmaIndex]===cur) chooseDilemmaOption(1); }
    continueAfterConsequence();
  }
}

// ——— 1. Données : 32 scénarios recopiés, 8 familles ———
ok(CAREER_FAMILIES.length===8&&CAREER_SCENARIOS.length===32,'8 familles, 32 scénarios');
ok(CAREER_SCENARIOS.every((s,i)=>s.id===i+1),'numérotation 1 à 32');
ok(CAREER_FAMILIES.map(f=>CAREER_SCENARIOS.filter(s=>s.famille===f.id).length).join()==='4,4,4,5,4,4,4,3','répartition du document : 5 scénarios pour l’actionnaire, 3 narratifs');
CAREER_SCENARIOS.forEach(s=>{
  ok(Number.isInteger(s.difficulte)&&s.difficulte>=1&&s.difficulte<=5,'difficulté 1 à 5 : '+s.id);
  ok(typeof s.jouable==='boolean','champ jouable : '+s.id);
  if(s.famille==='courts') ok(s.format&&s.regleSpeciale&&!s.situation&&!s.contrainte,'famille 7 : format et règle spéciale : '+s.id);
  else ok(s.situation&&s.contrainte&&!s.format,'situation et contrainte : '+s.id);
  ok(s.jouable ? !!CAREER_RULES[s.id] : (!!s.bientot&&!CAREER_RULES[s.id]),'règles des jouables, raison des « Bientôt » : '+s.id);
});
ok(CAREER_SCENARIOS.filter(s=>s.jouable).map(s=>s.id).join()==='1,9,23,26,28','scénarios jouables');
ok(CAREER_SCENARIOS[0].contrainte==='La banque plafonne les dépenses de grille et coupe les crédits à la première saison en perte','texte du scénario 1 recopié');
ok(CAREER_SCENARIOS[25].format==='1 saison, 12 dilemmes'&&CAREER_SCENARIOS[25].regleSpeciale==='Idéal comme tutoriel avancé','texte du scénario 26 recopié');
ok(CAREER_SCENARIOS[13].objectif==='Faire grimper la valorisation de 60 % (PDA × rentabilité × popularité)','texte du scénario 14 recopié');
ok(CAREER_FAMILIES[3].accroche==="Le patron, ce n'est pas vous : chaque scénario oppose vos choix éditoriaux aux exigences de celui qui paie.",'accroche de famille recopiée');

// ——— 2. Progression : stockage vide, illisible, indisponible ———
ok(loadCareerProgress().completed.length===0,'stockage vide');
store.d[CAREER_STORAGE_KEY]='{pas du json'; ok(loadCareerProgress().completed.length===0,'stockage illisible toléré');
store.d[CAREER_STORAGE_KEY]=JSON.stringify({completed:[1,1,99,'9'],best:{1:1}});
ok(loadCareerProgress().completed.join()==='1,9','identifiants inconnus et doublons écartés');
delete store.d[CAREER_STORAGE_KEY]; careerProgressMemory={completed:[],best:{}};
recordCareerWin(26); recordCareerWin(26);
ok(JSON.parse(store.d[CAREER_STORAGE_KEY]).completed.join()==='26'&&JSON.parse(store.d[CAREER_STORAGE_KEY]).best[26]===1,'réussite enregistrée une fois');
globalThis.localStorage={getItem(){throw Error('bloqué')},setItem(){throw Error('bloqué')}};
recordCareerWin(1); ok(loadCareerProgress().completed.join()==='26,1','sans stockage : progression gardée en mémoire');
globalThis.localStorage=store; delete store.d[CAREER_STORAGE_KEY]; careerProgressMemory={completed:[],best:{}};

// ——— 3. Déverrouillage : ★★★★ et ★★★★★ après 3 scénarios réussis ———
{ const hard=careerScenarioById(28), easy=careerScenarioById(26);
  ok(careerLocked(hard)&&!careerLocked(easy),'défi ★★★★★ verrouillé au départ');
  saveCareerProgress({completed:[1,9],best:{}}); ok(careerLocked(hard),'toujours verrouillé à 2 réussites');
  saveCareerProgress({completed:[1,9,23],best:{}}); ok(!careerLocked(hard),'débloqué à 3 réussites');
  saveCareerProgress({completed:[],best:{}}); }

// ——— 4. Lancement : scénario conservé après resetGame, effacé par une partie libre ———
{ resetGame(); ok(!gameState.career,'pas de scénario hors Mode Carrière');
  carriere(1); ok(gameState.career.scenarioId===1&&Number.isFinite(gameState.campaign.seed)&&gameState.campaign.seed>0&&gameState.campaign.deadline===5,'scénario distinct de la campagne (graines et objectifs intacts)');
  resetGame(); ok(!gameState.career,'« Lancer ma chaîne » repart sans scénario');
  gameState.step=6; gameState.homeView='career'; goHome(); ok(gameState.step===1&&gameState.homeView===null&&gameState.resumeStep===6,'goHome rouvre le slider, partie reprenable'); }

// ——— 5. Scénario 1 : trésorerie −40 M€, 9 % de PDA, plafond de grille, saison en perte ———
{ const p=carriere(1);
  ok(near(careerPda(),9,0.3),'PDA cible de départ ≈ 9 % : '+careerPda());
  ok(near(p.tresorerieDebutSaison,-40),'trésorerie de départ −40 M€');
  ok(gameState.career.gridCap===p.budgetGrilleAnnuel&&gameState.career.pdaStart>0,'plafond de grille et PDA de départ mémorisés');
  const c=gameState.career, r=CAREER_RULES[1];
  ok(r.seasonEnd(c,{season:1,resultatSaison:-0.5}).status==='lost','saison en perte : crédits coupés');
  p.coutGrilleEngageSaison=c.gridCap+1; ok(/plafond/.test(r.seasonEnd(c,{season:1,resultatSaison:2}).reason),'grille au-delà du plafond : défaite');
  p.coutGrilleEngageSaison=c.gridCap; p.tresorerie=-5; ok(!r.seasonEnd(c,{season:2,resultatSaison:2}),'encore en déficit avant la saison 3 : la partie continue');
  ok(r.seasonEnd(c,{season:3,resultatSaison:2}).status==='lost','déficit en fin de saison 3 : défaite');
  p.tresorerie=1; ok(r.seasonEnd(c,{season:2,resultatSaison:2}).status==='won','retour à l’équilibre : victoire'); }

// ——— 6. Scénario 9 : 300 M€, 30 M€ retirés par saison stagnante, licenciement à la 2e ———
{ const p=carriere(9); ok(near(p.tresorerieDebutSaison,300),'300 M€ injectés');
  const c=gameState.career, r=CAREER_RULES[9], h={season:1};
  p.tresorerie=200; c.pdaStart=2; c.pdaEnd=2.5;
  ok(!r.seasonEnd(c,h)&&p.tresorerie===170&&h.tresorerieFin===170&&c.stagnant===1,'saison stagnante : −30 M€');
  c.pdaStart=2.5; c.pdaEnd=4; r.seasonEnd(c,{season:2}); ok(c.stagnant===0&&p.tresorerie===170,'+1,5 pt : pas de retenue, compteur remis à zéro');
  c.pdaStart=4; c.pdaEnd=4.2; r.seasonEnd(c,{season:3}); c.pdaStart=4.2; c.pdaEnd=4.4;
  ok(r.seasonEnd(c,{season:4}).status==='lost'&&p.tresorerie===110,'deux saisons stagnantes d’affilée : licenciement'); }

// ——— 7. Scénario 23 : généraliste à 10 %, −1 pt par saison, télé-réalité interdite ———
{ const p=carriere(23); ok(p.type==='generaliste'&&careerLockedType()==='generaliste','format imposé');
  ok(near(careerPda(),10,0.3),'PDA cible de départ ≈ 10 % : '+careerPda());
  ok(!careerBannedPrograms().length,'grille de départ conforme');
  p.grilleOverrides={...(p.grilleOverrides||{}),access:'Le Loto du soir'}; ok(careerBannedPrograms().length===1,'jeu d’argent détecté');
  p.grilleOverrides.access='Koh-Lanta'; ok(careerBannedPrograms()[0]==='Koh-Lanta','télé-réalité détectée');
  ok(CAREER_RULES[23].seasonEnd(gameState.career,{season:1}).status==='lost','télé-réalité à l’antenne : défaite');
  delete p.grilleOverrides.access;
  const before=careerPda(); gameState.season=2; CAREER_RULES[23].seasonStart(gameState.career);
  ok(before-careerPda()>0.8&&before-careerPda()<1.2,'les rivales prennent 1 point : '+(before-careerPda())); }

// ——— 8. Scénario 26 : 12 dilemmes, verdict au bout de la saison 1 ———
{ carriere(26); ok(gameState.dilemmaQueue.length===12,'12 dilemmes dans la saison : '+gameState.dilemmaQueue.length);
  ok(new Set(gameState.dilemmaQueue.map(d=>d.id)).size===12,'12 dilemmes distincts');
  finirSaison();
  ok(gameState.step===11||gameState.step===8,'issue du scénario à la fin des 100 jours : step '+gameState.step);
  if(gameState.step===11) ok(loadCareerProgress().completed.includes(26)&&gameState.career.resumeStep===7,'victoire enregistrée, reprise au bilan');
  else ok(['career','tresorerie'].includes(gameState.gameOverReason),'défaite : écran de fin de partie');
  saveCareerProgress({completed:[],best:{}}); }

// ——— 9. Scénario 28 : planchers de départ, un seul passage en dessous = défaite ———
{ const p=carriere(28); const c=gameState.career;
  ok(c.floor&&near(c.floor.tresorerie,p.tresorerie)&&near(c.floor.pda,careerPda()),'planchers relevés à l’ouverture');
  ok(!careerFloorBreach(c),'aucune jauge sous son départ');
  p.popularite=c.floor.popularite-1;
  gameState.pendingNextStep=6; careerAfterChoice();
  ok(gameState.pendingNextStep===8&&gameState.gameOverReason==='career'&&c.status==='lost','passage sous le plancher : défaite immédiate');
  ok(/popularité/.test(careerFailureCopy().lead),'raison affichée sur l’écran de fin'); }

// ——— 10. Victoire en cours de partie : l'écran de victoire puis reprise ———
{ carriere(1); const c=gameState.career; c.verdict=careerVerdict('won','ok'); gameState.pendingNextStep=7;
  careerAfterChoice(); ok(gameState.pendingNextStep===11&&c.resumeStep===7&&!careerActive(),'victoire : écran dédié, scénario clos');
  ok(careerBannerHtml(true)==='','plus de bandeau une fois le scénario réussi');
  ok(loadCareerProgress().completed.includes(1),'réussite enregistrée');
  saveCareerProgress({completed:[],best:{}}); }

// ——— 11. Faillite pendant un scénario : la faillite garde la priorité ———
{ carriere(9); gameState.pendingNextStep=8; gameState.gameOverReason='tresorerie'; careerAfterChoice();
  ok(gameState.gameOverReason==='tresorerie'&&gameState.career.status==='lost','faillite prioritaire'); }
`;
const context = { console };
vm.runInNewContext(scripts.slice(0, -1).join('\n') + tests, context, { filename: 'audience-masters-career.js' });
console.log('OK career: 32 scenarios, storage, unlocking, launch, start conditions, constraints, verdicts, victory and defeat screens');
