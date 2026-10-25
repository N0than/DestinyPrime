'use strict';
// Mode Carrière : données des 38 scénarios (9 familles), progression localStorage (stockage
// vide, illisible ou indisponible), déverrouillage, conditions de départ, jauges, décisions
// scénarisées, contraintes et verdicts des 38 scénarios, écrans de victoire et de défaite.
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

// ——— 1. Données : 38 scénarios, 9 familles ———
ok(CAREER_FAMILIES.length===9&&CAREER_SCENARIOS.length===38,'9 familles, 38 scénarios');
ok(CAREER_SCENARIOS.every((s,i)=>s.id===i+1),'numérotation 1 à 38');
ok(CAREER_FAMILIES.map(f=>CAREER_SCENARIOS.filter(s=>s.famille===f.id).length).join()==='5,4,4,6,4,5,5,4,1','répartition : n°33 en sauvetage, n°34 en révolution digitale, n°35 à 38 dans les familles existantes');
CAREER_SCENARIOS.forEach(s=>{
  ok(Number.isInteger(s.difficulte)&&s.difficulte>=1&&s.difficulte<=5,'difficulté 1 à 5 : '+s.id);
  ok(s.jouable===true,'jouable : '+s.id);
  if(s.famille==='courts') ok(s.format&&s.regleSpeciale&&!s.situation&&!s.contrainte,'famille 7 : format et règle spéciale : '+s.id);
  else ok(s.situation&&s.contrainte&&!s.format,'situation et contrainte : '+s.id);
  ok(!!CAREER_RULES[s.id]&&!('bientot' in s),'règles du scénario : '+s.id);
});
ok(CAREER_SCENARIOS.every(s=>s.jouable),'les 38 scénarios sont jouables');
ok(CAREER_SCENARIOS[0].contrainte==='La banque plafonne les dépenses de grille et coupe les crédits à la première saison en perte','texte du scénario 1 recopié');
ok(CAREER_SCENARIOS[25].format==='1 saison, 12 dilemmes'&&CAREER_SCENARIOS[25].regleSpeciale==='Idéal comme tutoriel avancé','texte du scénario 26 recopié');
ok(CAREER_SCENARIOS[13].objectif==='Faire grimper la valorisation de 60 % (PDA × rentabilité × popularité)','texte du scénario 14 recopié');
ok(CAREER_FAMILIES.map(f=>f.nom).join('|')==='Mission sauvetage|Le trône|La conquête|Sous pression|Avis de tempête|Ligne éditoriale|Défis express|Destins de chaînes|La Révolution Digitale','noms des familles');
ok(CAREER_FAMILIES.every((f,i)=>f.numero===String(i+1).padStart(2,'0')&&f.illustration?.genre&&f.accroche),'numéro, illustration et description de chaque famille');
ok(CAREER_FAMILIES[3].accroche==="Vous dirigez l'antenne, mais pas les cordons de la bourse. Entre ambitions éditoriales et exigences des actionnaires, chaque décision se négocie.",'description de famille recopiée');

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
{ ok(!careerLocked(careerScenarioById(35)),'déblocage provisoirement désactivé : tout est ouvert'); CAREER_ALL_UNLOCKED=false;
  const hard=careerScenarioById(28), easy=careerScenarioById(26);
  ok(careerLocked(hard)&&!careerLocked(easy),'défi ★★★★★ verrouillé au départ');
  saveCareerProgress({completed:[1,9],best:{}}); ok(careerLocked(hard),'toujours verrouillé à 2 réussites');
  saveCareerProgress({completed:[1,9,23],best:{}}); ok(!careerLocked(hard),'débloqué à 3 réussites');
  const raider=careerScenarioById(35); ok(careerUnlockCount(raider)===5&&careerLocked(raider),'n°35 : 5 réussites demandées');
  saveCareerProgress({completed:[1,9,23,26,2],best:{}}); ok(!careerLocked(raider),'n°35 : débloqué à 5 réussites');
  saveCareerProgress({completed:[],best:{}}); CAREER_ALL_UNLOCKED=true; }

// ——— 4. Lancement : scénario conservé après resetGame, effacé par une partie libre ———
{ resetGame(); ok(!gameState.career,'pas de scénario hors Mode Carrière');
  carriere(1); ok(gameState.career.scenarioId===1&&Number.isFinite(gameState.campaign.seed)&&gameState.campaign.seed>0&&gameState.campaign.deadline===5,'scénario distinct de la campagne (graines et objectifs intacts)');
  resetGame(); ok(!gameState.career,'« Lancer ma chaîne » repart sans scénario');
  gameState.step=6; gameState.homeView='career'; goHome(); ok(gameState.step===1&&gameState.homeView===null&&gameState.resumeStep===6,'goHome rouvre le slider, partie reprenable');
  // « Lancer ce scénario » : la partie commence directement (chaîne configurée d'office).
  gameState.homeView='career'; startCareerGame(9); const p=gameState.player;
  ok(gameState.step===6&&gameState.homeView===null&&gameState.resumeStep===null,'début de partie directement après le lancement');
  ok(careerActive()?.scenarioId===9&&p.name&&GENERATED_NAMES[p.type].includes(p.name)&&p.type==='generaliste'&&p.target==='a2549','chaîne configurée : généraliste, 25-49 ans, nom tiré au sort');
  ok(p.tresorerieDebutSaison===300&&gameState.dilemmaQueue.length>0&&gameState.career.pdaStart>0,'conditions de départ appliquées, saison 1 ouverte');
  ok(/Le milliardaire pressé/.test(careerBannerHtml())&&/Contrainte :/.test(careerBannerHtml()),'bandeau du scénario en jeu'); }

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
{ startCareerGame(23); ok(gameState.player.type==='generaliste','format imposé'); const p=carriere(23); ok(p.type==='generaliste','format imposé');
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
  gameState.pendingNextStep=6; careerAfterChoice({titre:'',desc:''},{l:'',finance:{}});
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

// ——— 12. Les 38 scénarios : lancement direct, jauges, décisions scénarisées, contraintes ———
{ resetGame(); ok(careerAdFactor()===1&&careerAdSlotFactor(gameState.player,'prime')===1&&!careerProgramBlock({},'prime')&&careerHudAttr()==='','aucun effet hors Mode Carrière'); }
function joue(i=0){ gameState.step=6; gameState.dilemmaPhase='choosing'; chooseDilemmaOption(i); for(let k=0;k<6&&gameState.dilemmaPhase==='choosing';k++) chooseDilemmaOption(k%2); continueAfterConsequence(); }
const premier=()=>gameState.dilemmaQueue[gameState.currentDilemmaIndex];
for(let id=1;id<=38;id++){ startCareerGame(id); const rule=CAREER_RULES[id];
  ok(gameState.step===6&&careerActive()?.scenarioId===id&&gameState.dilemmaQueue.length>0,'lancement direct : '+id);
  if(rule.gauges) ok(Object.keys(rule.gauges).every(k=>gameState.career.g[k]===rule.gauges[k]),'jauges de départ : '+id);
  if(rule.type) ok(gameState.player.type===rule.type,'format imposé : '+id);
  ok(careerBannerHtml().includes('défi #'+id+'"'),'bandeau en jeu : '+id); }
{ startCareerGame(2); ok(premier().id.startsWith('career_2_administrateur'),'n°2 : décision imposée en tête de saison'); const m=gameState.career.g.moral; joue(1); ok(gameState.career.g.moral===Math.max(0,m-18),'n°2 : le plan social coûte du moral'); }
{ startCareerGame(3); ok(/Grève/.test(premier().titre),'n°3 : dilemme de grève'); const d={moral:-6}; CAREER_RULES[3].drift(gameState.career,d,{economique:true}); ok(d.moral===-12,'n°3 : décision économique, moral ×2'); }
{ startCareerGame(4); const c=gameState.career; let v; for(let k=0;k<3;k++) v=CAREER_RULES[4].afterChoice(c,{t:{racoleur:true},dilemma:{}}); ok(c.controls===3&&v?.status==='lost','n°4 : 3e contrôle Arcom, fréquence retirée'); }
{ startCareerGame(5); ok(careerRank()===1,'n°5 : leader au départ'); const b=careerPda(); for(let k=0;k<4;k++) CAREER_RULES[5].afterChoice(gameState.career); ok(gameState.career.pillars===3&&b-careerPda()>3,'n°5 : trois piliers partis : '+(b-careerPda())); }
{ let r6=4242; Math.random=()=>{r6=(Math.imul(r6,1103515245)+12345)>>>0; return r6/4294967296;}; startCareerGame(6); ok(near(careerPda(careerRivals()[0]),18.5,0.4)&&near(careerPda(),19,0.4),'n°6 : leader 19 %, dauphin 18,5 %'); const c=gameState.career, d=gameState.competitors.find(r=>r.name===c.dauphin); const b=careerPda(d); c.lastGain=2; gameState.season=2; CAREER_RULES[6].seasonStart(c); ok(careerPda(d)-b>1,'n°6 : le dauphin copie le gain'); }
{ startCareerGame(7); const s0=careerSnapshot(); careerShift(gameState.player,2,['j1524']); const s1=careerSnapshot(); const b=careerPda(gameState.player,'s50'); CAREER_RULES[7].afterChoice(gameState.career,{before:s0,after:s1}); ok(careerPda(gameState.player,'s50')<b-0.5,'n°7 : les 50+ agacés'); }
{ startCareerGame(8); ok(careerRank()===1,'n°8 : leader'); gameState.season=6; ok(careerAdFactor()===0.6,'n°8 : chute de la pub en saison 6'); gameState.season=3; const b=careerPda(gameState.player,'a2549'); CAREER_RULES[8].seasonStart(gameState.career); ok(b-careerPda(gameState.player,'a2549')>2,'n°8 : plateforme en saison 3'); }
{ startCareerGame(10); const prog=PROGRAM_CATALOG.find(x=>x.channelType==='generaliste'&&x.editorial?.origin==='international');
  if(prog){ const q=quoteProgram(prog.slot,prog.id,'interne'); ok(q&&!q.allowed&&/étrangère/.test(q.careerBlocked),'n°10 : programme étranger refusé'); }
  const fr=PROGRAM_CATALOG.find(x=>x.channelType==='generaliste'&&x.editorial?.origin==='FR'); ok(!quoteProgram(fr.slot,fr.id,'interne').careerBlocked,'n°10 : programme français autorisé'); }
{ startCareerGame(11); ok(gameState.player.type==='culture'&&gameState.career.g.credibilite===90,'n°11 : chaîne documentaire'); gameState.career.g.credibilite=55; ok(CAREER_RULES[11].afterChoice(gameState.career,{t:{}}).status==='lost','n°11 : crédibilité sous 60'); }
{ startCareerGame(12); ok(premier().titre==='Étendre la diffusion','n°12 : dilemme d’extension'); joue(0); ok(gameState.career.g.couverture===60,'n°12 : grande extension +40 %'); }
{ startCareerGame(13); const c=gameState.career, cr=c.g.credibilite; joue(0); ok(c.g.credibilite<=cr-12,'n°13 : accepter la faveur coûte de la crédibilité'); }
{ startCareerGame(14); const prog=PROGRAM_CATALOG.find(x=>x.channelType==='generaliste'&&x.editorial?.genre==='fiction'); ok(!quoteProgram(prog.slot,prog.id,'interne').allowed,'n°14 : fiction refusée par le fonds'); ok(gameState.career.val0>0,'n°14 : valorisation de départ'); }
{ startCareerGame(15); const prime=PROGRAM_CATALOG.find(x=>x.channelType==='generaliste'&&x.slot==='prime'); ok(/veto/.test(quoteProgram('prime',prime.id,'interne').careerBlocked),'n°15 : veto du fondateur');
  const m=PROGRAM_CATALOG.find(x=>x.channelType==='generaliste'&&x.slot==='matin'&&quoteProgram('matin',x.id,'interne')?.allowed); ok(signProgram('matin',m.id,'interne')&&gameState.career.g.patience===80,'n°15 : changement de grille, patience −20'); }
{ startCareerGame(16); const c=gameState.career; c.g.blocDivert=22; const d={}; CAREER_RULES[16].drift(c,d,{info:true,divert:false},{pda:{}}); careerGauge(c,'blocInfo',d.blocInfo); careerGauge(c,'blocDivert',d.blocDivert); ok(CAREER_RULES[16].afterChoice(c).status==='lost','n°16 : un bloc sous 20 vend ses parts');
  startCareerGame(16); const b=gameState.dilemmaQueue.find(x=>!x.isCareerScripted&&x.c&&!x.type); ok(b&&/Bloc info/.test(careerChoiceHint(b,b.c[0])),'n°16 : effet sur les blocs affiché sous l’option'); }
{ startCareerGame(17); ok(careerAdSlotFactor(gameState.player,'prime')===0&&careerAdSlotFactor(gameState.player,'access')===1,'n°17 : pas de pub en prime'); ok(/Dotation/.test(gameState.career.note),'n°17 : dotation du Parlement'); }
{ startCareerGame(18); ok(careerAdFactor()===0.6&&premier().titre==="Plan d'économies",'n°18 : hiver publicitaire'); gameState.career.g.effectifs=92; joue(0); ok(gameState.step===8&&gameState.gameOverReason==='career','n°18 : sous 90 % des effectifs, défaite'); }
{ startCareerGame(19); ok(gameState.player.target==='j1524'&&near(careerPda(),18,0.4),'n°19 : 15-24 ans à 18 %'); }
{ startCareerGame(20); const d=gameState.dilemmaQueue.find(x=>x.id.startsWith('career_20_droits')); ok(d&&/18(,0)? M€/.test(d.c[0].l),'n°20 : enchère à 18 M€ au premier cycle'); ok(careerRightsPrice({cycle:2})===22.5,'n°20 : +25 % au cycle suivant'); }
{ startCareerGame(21); ok(gameState.dilemmaQueue.filter(x=>x.isCareerScripted).length===2,'n°21 : débat et accusation de partialité'); }
{ startCareerGame(22); ok(gameState.player.type==='info'&&gameState.player.budgetGrilleAnnuel===22,'n°22 : grille d’info continue à 22 M€'); }
{ startCareerGame(24); ok(gameState.player.type==='jeunesse'&&careerAdFactor()===0.5,'n°24 : pub jeunesse plafonnée'); }
{ startCareerGame(25); ok(gameState.player.tresorerieDebutSaison===30,'n°25 : trésorerie de 30 M€'); }
{ startCareerGame(27); ok(premier().titre==='Une seule jauge','n°27 : choix de la jauge'); joue(1); ok(gameState.career.gauge==='pda'&&careerHudAttr()===' data-career-gauge="pda"','n°27 : tableau de bord masqué sauf la PDA'); }
{ startCareerGame(29); ok(gameState.dilemmaQueue.length===3&&gameState.dilemmaQueue.every(x=>x.isCareerScripted),'n°29 : trois décisions pour la dernière soirée'); finirSaison(); ok(gameState.step===11&&/dernier prime/.test(gameState.career.verdict.reason),'n°29 : épilogue joué'); saveCareerProgress({completed:[],best:{}}); }
{ startCareerGame(30); const c=gameState.career; c.truce=0; const pop=gameState.player.popularite; CAREER_RULES[30].afterChoice(c,{fx:{},dilemma:{}}); ok(gameState.player.popularite===pop-4,'n°30 : fuite dans la presse'); }
{ startCareerGame(31); const c=gameState.career; ok(Number.isInteger(c.mole)&&gameState.dilemmaQueue.at(-1).titre==='Démasquer la taupe','n°31 : accusation en fin de saison'); ok(CAREER_RULES[31].afterChoice(c,{fx:{accuse:c.mole},dilemma:{}}).status==='won','n°31 : taupe démasquée'); }
{ startCareerGame(32); ok(gameState.career.g.moral===30&&premier().id.startsWith('career_32_anciens'),'n°32 : retour, moral 30'); }
// n°33 « Le géant aux pieds d'argile » : départ, charge des contrats historiques, popularité, verdict en saison 4.
{ const p=carriere(33); const c=gameState.career, r=CAREER_RULES[33];
  ok(p.type==='generaliste'&&p.target==='a2549','n°33 : généraliste, 25-49 ans');
  ok(near(careerPda(),16,0.3),'n°33 : 16 % de PDA : '+careerPda());
  ok(p.popularite===65&&near(p.coutGrilleEngageSaison,70),'n°33 : popularité 65, grille 70 M€');
  const q=gameState.dilemmaQueue[gameState.currentDilemmaIndex]; ok(q.id.startsWith('career_33_contrats')&&q.c.length===3,'n°33 : « Les contrats en or » en tête de saison 1');
  const t0=p.tresorerie; r.seasonStart(c); ok(near(t0-p.tresorerie,8),'n°33 : charge de 8 M€ tant que la grille dépasse 45 M€');
  p.coutGrilleEngageSaison=45; const t1=p.tresorerie; r.seasonStart(c); ok(p.tresorerie===t1,'n°33 : plus de charge à 45 M€');
  const pop=p.popularite; r.afterChoice(c,{t:{saving:true},dilemma:{}}); ok(p.popularite===pop-3,'n°33 : une économie coûte 3 points de popularité');
  r.afterChoice(c,{t:{saving:false},dilemma:{}}); ok(p.popularite===pop-3,'n°33 : sans économie, pas de pénalité');
  ok(/Objectif 45 M€/.test(r.status(c)),'n°33 : suivi du coût de grille');
  ok(r.seasonEnd(c,{season:3})===undefined,'n°33 : pas de verdict avant la saison 4');
  p.tresorerie=5; setChannelShare(p,13); p.coutGrilleEngageSaison=44; ok(r.seasonEnd(c,{season:4}).status==='won','n°33 : victoire si les trois conditions sont réunies');
  p.coutGrilleEngageSaison=46; ok(r.seasonEnd(c,{season:4}).status==='lost','n°33 : défaite si la grille dépasse 45 M€');
  p.coutGrilleEngageSaison=44; setChannelShare(p,11); ok(r.seasonEnd(c,{season:4}).status==='lost','n°33 : défaite sous 12 % de PDA');
  setChannelShare(p,13); p.tresorerie=-1; ok(r.seasonEnd(c,{season:4}).status==='lost','n°33 : défaite si la trésorerie reste négative'); }
// Saison 1 : chaque défi s'ouvre sur sa propre décision, sans conférence de rentrée.
{ for(const s of CAREER_SCENARIOS){ startCareerGame(s.id); const q=gameState.dilemmaQueue[0];
    ok(!gameState.seasonKickoffPending&&!gameState.seasonKickoffProposal,'n°'+s.id+' : pas de conférence de rentrée en saison 1');
    ok(q.isCareerScripted,'n°'+s.id+' : décision du défi en ouverture');
    if(CAREER_OPENINGS[s.id]) ok(q.careerLabel===CAREER_OPENINGS[s.id].label&&q.c.length===3,'n°'+s.id+' : décision d’ouverture'); }
  ok(Object.keys(CAREER_OPENINGS).length===22,'22 décisions d’ouverture (les autres défis scénarisent déjà la leur)');
  startCareerGame(26); ok(gameState.dilemmaQueue.length===12,'n°26 : l’ouverture compte parmi les 12 dilemmes');
  resetGame(); gameState.player.name='Libre'; finalizeChannelSetup(); launchFirstSeason(); ok(!gameState.dilemmaQueue[0]?.isCareerScripted,'jeu libre : pas de décision d’ouverture'); }
// Signature avant le premier dilemme (conférence de rentrée, grille) : la décision scénarisée reste.
{ for(const id of [2,34]){ startCareerGame(id); startNewSeason(); const pr=gameState.seasonKickoffProposal; const opt=pr&&pr.options.find(o=>quoteProgram(pr.slot,o.id,'interne')?.allowed);
    if(!opt) continue; signProgram(pr.slot,opt.id,'interne');
    ok(gameState.dilemmaQueue[0].isCareerScripted,'n°'+id+' : décision scénarisée conservée après une signature'); } }
// n°34 « Le tournant du streaming » : érosion, exclusivités, utilisateurs, trésorerie.
{ const p=carriere(34); const c=gameState.career, r=CAREER_RULES[34];
  ok(near(careerPda(),11,0.3)&&c.g.popDigitale===20&&c.g.credibilite===60,'n°34 : 11 % de PDA, popularité digitale 20, crédibilité 60');
  const q=gameState.dilemmaQueue[gameState.currentDilemmaIndex]; ok(q.id.startsWith('career_34_plateforme')&&q.c.length===3,'n°34 : arbitrage de la plateforme en tête de saison');
  r.afterChoice(c,{fx:{exclusif:1}}); ok(near(c.valo,1.15)&&c.exclus===1,'n°34 : un format exclusif valorise la plateforme de 15 %');
  gameState.season=2; const pda0=careerPda(); r.seasonStart(c); ok(near(pda0-careerPda(),1.5,0.2),'n°34 : érosion de 1,5 pt sous 50 de popularité digitale');
  c.g.popDigitale=50; const pda1=careerPda(); r.seasonStart(c); ok(near(careerPda(),pda1,0.01),'n°34 : plus d’érosion à 50');
  const u=c.users; r.seasonEnd(c,{season:2}); ok(c.users===u+Math.round(50*r.usersPerPoint*c.valo),'n°34 : utilisateurs gagnés en fin de saison');
  p.tresorerie=-1; ok(r.afterChoice(c,{fx:{}}).status==='lost','n°34 : trésorerie sous 0, plateforme revendue');
  p.tresorerie=10; c.users=500000; c.pdaEnd=10.2; ok(r.seasonEnd(c,{season:5}).status==='won','n°34 : victoire à 500 k utilisateurs et 10 % de PDA');
  c.users=0; c.pdaEnd=10.2; ok(r.seasonEnd(c,{season:5}).status==='lost','n°34 : défaite sous 500 k utilisateurs');
  // Tarif : moins cher, plus d'utilisateurs ; payant, des abonnements en fin de saison ; volet dédié.
  c.verdict=null; c.users=100000; c.valo=1; c.g.popDigitale=40; c.tarif=r.tarifDefault; const t0=p.tresorerie; const h={season:2};
  r.seasonEnd(c,h); const gainStd=c.users-100000; ok(p.tresorerie>t0&&h.tresorerie===p.tresorerie,'n°34 : abonnements encaissés en fin de saison');
  c.users=100000; c.tarif=0; const t1=p.tresorerie; r.seasonEnd(c,{season:2}); ok(c.users-100000>gainStd&&p.tresorerie===t1,'n°34 : gratuit, plus d’utilisateurs, pas d’abonnements');
  ok(r.adSlotFactor(c,'nuit')>1+c.users/1e6,'n°34 : la version gratuite rapporte davantage en publicité');
  c.tarif=2; careerTarifStep(1); ok(c.tarif===3,'n°34 : tarif réglable'); careerTarifStep(9); careerTarifStep(1); ok(c.tarif===r.tarifs.length-1,'n°34 : tarif plafonné à 9,99 €');
  const html=r.panelHtml(c); ok(/Utilisateurs actifs/.test(html)&&/Crédibilité/.test(html)&&/Popularité dig/.test(html)&&/9,99 €/.test(html)&&/data-career-tarif="1"[^>]*disabled/.test(html),'n°34 : volet utilisateurs, jauges et tarif');
  ok(careerBannerHtml().includes('career-stream')&&!careerBannerHtml().includes('career-gauges'),'n°34 : le volet dédié remplace la ligne de jauges'); }
// n°35 « Le raider de la finance » : vote, action, contrôle du conseil, rédaction et marque.
{ carriere(35); const c=gameState.career, r=CAREER_RULES[35];
  ok(c.g.actionnaires===45&&c.g.moral===60&&c.g.credibilite===60&&c.action===100,'n°35 : jauges de départ et action à 100');
  const q=gameState.dilemmaQueue[gameState.currentDilemmaIndex]; ok(q.id.startsWith('career_35_vote')&&q.c.length===2&&q.c[0].fx.moral===-15&&q.c[0].fx.credibilite===-20&&q.c[1].finance.purchase===10,'n°35 : vote du fonds (accepter : −15 moral, −20 crédibilité ; refuser : 10 M€)');
  ok(r.afterChoice(c,{fx:{action:8}})===null&&near(c.action,108),'n°35 : accepter fait monter l’action');
  c.g.actionnaires=20; ok(r.afterChoice(c,{fx:{}}).status==='lost','n°35 : le fonds prend le contrôle sous 25');
  c.g.actionnaires=50; c.g.moral=8; ok(r.afterChoice(c,{fx:{}}).status==='lost','n°35 : la rédaction démissionne à 10 de moral');
  c.g.moral=50; c.action=140; c.pdaEnd=c.pdaStart=14; ok(r.seasonEnd(c,{season:4,resultatSaison:0}).status==='won','n°35 : victoire à 130 en saison 4');
  c.action=100; ok(r.seasonEnd(c,{season:4,resultatSaison:0}).status==='lost','n°35 : défaite sous 130'); }
// n°36 « Fuite de cerveaux » : rival, malus de l'access, espoirs seulement, soirée à renouveler.
{ startCareerGame(36); const c=gameState.career, r=CAREER_RULES[36], p=gameState.player;
  const rival=gameState.competitors.find(x=>x.name===c.rival);
  ok(p.type==='generaliste'&&rival&&near(careerPda(),9,0.6)&&near(careerPda(rival),14,0.6),'n°36 : 9 % de PDA (moins le malus de l’access), rival à 14 % : '+careerPda()+' / '+careerPda(rival));
  ok(c.accessMalus&&Object.values(c.accessMalus).every(v=>v<=0),'n°36 : access à −20 % les deux premières saisons');
  ok(r.blockTalent(c,{tier:'vedette'})&&r.blockTalent(c,{tier:'confirme'})&&!r.blockTalent(c,{tier:'espoir'}),'n°36 : seulement des espoirs');
  r.programSigned(c,{slot:'access',contract:{name:'X'}}); r.programSigned(c,{slot:'prime',contract:{name:'Y'}});
  ok(c.renewed.length===2&&c.g.notoriete===39,'n°36 : soirée renouvelée, notoriété en hausse');
  setChannelShare(p,15); ok(r.seasonEnd(c,{season:2}).status==='won','n°36 : victoire devant le rival, soirée renouvelée');
  gameState.season=3; const before={...p.slotAudienceDeltas.access}; r.seasonStart(c); ok(!c.accessMalus&&p.slotAudienceDeltas.access[p.target]>before[p.target],'n°36 : malus de l’access levé en saison 3'); }
// n°37 « La chaîne Bas-Carbone » : interdits, surcoût de la 1re saison, score éco, verdict.
{ carriere(37); const c=gameState.career, r=CAREER_RULES[37], p=gameState.player;
  ok(c.g.eco===50&&c.g.credibilite===70&&near(careerPda(),8.5,0.3),'n°37 : éco 50, crédibilité 70, 8,5 % de PDA');
  ok(r.blockProgram(c,{name:'Koh-Lanta',editorial:{origin:'FR'}})&&r.blockProgram(c,{name:'Série US',editorial:{origin:'international'}})&&!r.blockProgram(c,{name:'Magazine régional',editorial:{origin:'FR'}}),'n°37 : aventure et tournages à l’étranger interdits');
  ok(r.blockChoice(c,{},{l:'Tourner à l’étranger'},{spend:3,foreign:false})&&!r.blockChoice(c,{},{l:'Studio local'},{spend:3,foreign:false}),'n°37 : options de tournage à l’étranger refusées');
  const t0=p.tresorerie; r.afterChoice(c,{choice:{finance:{purchase:10}}}); ok(near(t0-p.tresorerie,1.5),'n°37 : +15 % sur la production la première saison');
  gameState.season=2; const t1=p.tresorerie; r.afterChoice(c,{choice:{finance:{purchase:10}}}); ok(p.tresorerie===t1,'n°37 : plus de surcoût ensuite');
  c.g.eco=75; setChannelShare(p,12.5); ok(r.seasonEnd(c,{season:3}).status==='won'&&c.g.eco===83,'n°37 : victoire à 12 % et plus de 80 (après +8 de fin de saison)');
  c.verdict=null; c.g.eco=60; setChannelShare(p,9); ok(r.seasonEnd(c,{season:5}).status==='lost','n°37 : défaite en saison 5'); }
// n°38 « Événement mondial » : Coupe du monde offerte, garantie d'audience, finale, recettes nettes.
{ startCareerGame(38); const c=gameState.career, r=CAREER_RULES[38], p=gameState.player;
  ok(r.maxSeasons===1&&c.g.attention===90&&sportsBroadcastsFor(p).some(o=>o.eventId==='world_cup'),'n°38 : une saison, attention 90, Coupe du monde à l’antenne');
  ok(r.adSlotFactor(c,'prime')>1&&r.adSlotFactor(c,'matin')===1,'n°38 : recettes de soirée dopées par l’attention des médias');
  const t00=p.tresorerie; r.afterChoice(c); ok(c.penalties===0&&p.tresorerie===t00,'n°38 : garantie tenue, pas de remboursement');
  r.guarantee=99; const t0=p.tresorerie; r.afterChoice(c); r.guarantee=12; ok(c.penalties===6&&near(t0-p.tresorerie,6),'n°38 : garantie manquée sur l’access et le prime, 2 × 3 M€ remboursés');
  ok(r.finalPda(c)>(careerRow().slots.prime[p.target]),'n°38 : la finale dépasse l’audience habituelle du prime');
  c.peak=26; c.penalties=0; ok(['won','lost'].includes(r.seasonEnd(c).status),'n°38 : verdict en fin de saison'); }
`;
const context = { console };
vm.runInNewContext(scripts.slice(0, -1).join('\n') + tests, context, { filename: 'audience-masters-career.js' });
console.log('OK career: 38 scenarios, storage, unlocking, launch, start conditions, constraints, verdicts, victory and defeat screens');
