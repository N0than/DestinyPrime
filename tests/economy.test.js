'use strict';
// Rééquilibrage économique : coût de grille par format, grille payée dès la saison 1,
// recettes publicitaires (VOLUME_PUB = 3) créditées une fois puis réévaluées à l'écart.
const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('index.html','utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
// Validité syntaxique de chaque script.
scripts.forEach((src,i)=>{ new vm.Script(src,{filename:'script'+i}); });
const tests=String.raw`
const out=[]; const ok=(c,m)=>{ if(!c) throw Error(m); };
const near=(a,b,e=1e-9)=>Math.abs(a-b)<e;
render=()=>{};
// Repères de calcul (popularité 50, puissance 1, sans sport ni régie).
ok(near(computeRevenusPub(1,'a2549',50,1),3.6),'1% -> 3.6');
ok(near(computeRevenusPub(3,'a2549',50,1),10.8),'3% -> 10.8');
ok(near(computeRevenusPub(5,'a2549',50,1),18),'5% -> 18');
ok(VOLUME_PUB===3,'VOLUME_PUB 3');
const expected={generaliste:[50,13],cinema:[40,11],culture:[25,7],jeunesse:[25,6.5],sport:[35,8.5],info:[25,8]};
for (const [type,[cap,grid]] of Object.entries(expected)) {
  resetGame(); const p=gameState.player; p.name='Test '+type; p.type=type; p.target='a2549';
  finalizeChannelSetup();
  ok(p.tresorerie===cap,'capital '+type); ok(CHANNEL_TYPES[type].baseBudget===cap,'baseBudget '+type);
  ok(p.budgetGrilleAnnuel===grid&&p.coutGrilleEngageSaison===grid,'grid '+type);
  ok(computeNextBudgetGrille(p)>=grid*0.5,'next budget socle');
  launchFirstSeason();
  const pda=getCalculatedPDAs().find(r=>r.channel===p).pda[p.target];
  const rev=computeRevenusPub(pda,p.target,p.popularite,p.puissanceCommerciale);
  ok(p.tresorerieDebutSaison===cap,'tresorerieDebutSaison '+type);
  ok(near(p.tresorerie,cap-grid+rev),'S1 open '+type+' '+p.tresorerie);
  ok(p.achatsSaison===0,'grid not in purchases '+type);
  ok(near(p.revenusPubPrevisionnels,rev),'revenue credited once '+type);
  // Réévaluation : seul l'écart est crédité.
  p.slotAudienceDeltas.prime={[p.target]:2};
  const revAvant=p.revenusPubPrevisionnels, tAvant=p.tresorerie; reevaluateAdRevenue();
  ok(near(p.tresorerie-tAvant,p.revenusPubPrevisionnels-revAvant),'reevaluation delta '+type);
  reevaluateAdRevenue(); ok(near(p.tresorerie,tAvant+p.revenusPubPrevisionnels-revAvant),'no double credit '+type);
  out.push({type,cap,grid,pdaCible:+pda.toFixed(3),recettes:+rev.toFixed(2),tresoS1:+(cap-grid+rev).toFixed(2)});
}
// Généraliste à exactement 1 % sur les 25-49 : 50 - 13 + 3,6 = 40,6.
resetGame(); let p=gameState.player; p.name='G'; p.type='generaliste'; p.target='a2549'; finalizeChannelSetup();
const realCalc=getCalculatedPDAs;
getCalculatedPDAs=()=>realCalc().map(r=>r.channel===gameState.player?{...r,pda:{...r.pda,a2549:1}}:r);
launchFirstSeason(); ok(near(p.tresorerie,40.6),'Généraliste 1% -> 40.6 : '+p.tresorerie);
const t406=p.tresorerie;
getCalculatedPDAs=realCalc;
// Saison 1 complète puis passage en saison 2 : le coût réel de grille est reconduit.
gameState.seasonKickoffPending=false;
let guard=0; while(gameState.step===6&&guard++<12){
  const cur=gameState.dilemmaQueue[gameState.currentDilemmaIndex];
  // Enchère de droits sportifs (F1 possible dès la S1) : le joueur passe son tour.
  if(gameState.dilemmaPhase==='choosing'&&cur?.type==='sports_rights_auction'){ startSportsRightsAuction(cur.rightsEventId,cur.id); sportsAuctionPass(); }
  if(gameState.dilemmaPhase==='choosing') chooseDilemmaOption(0); continueAfterConsequence(); }
ok(gameState.step===7,'end of S1');
const h=gameState.history.at(-1);
ok(near(p.coutGrilleCumul,h.coutGrille),'grid counted once in cumul');
ok(near(h.resultatSaison,(h.revenusPub+h.commercial)-(h.coutGrille+h.achats)),'season result: grid counted once '+JSON.stringify([h.resultatSaison,h.revenusPub,h.commercial,h.coutGrille,h.achats]));
const gridEnd=p.coutGrilleEngageSaison, cashEnd=p.tresorerie;
startNewSeason();
ok(gameState.season===2,'S2');
ok(p.budgetGrilleAnnuel===p.coutGrilleEngageSaison,'S2 budget = engaged');
const s2Grid=p.coutGrilleEngageSaison;
const pda2=getCalculatedPDAs().find(r=>r.channel===p).pda[p.target];
ok(near(p.tresorerie,p.tresorerieDebutSaison-s2Grid+p.revenusPubPrevisionnels),'S2 open: one debit + credit');
ok(p.grillePayeeSaison===2,'S2 grid flagged paid');
out.push({S1_fin_grille:gridEnd,S2_grille_payee:s2Grid,lancement:13,S2_reprend_du_reel:s2Grid!==13||gridEnd===13});
// Seuil de faillite à l'ouverture : jugé après le crédit des recettes publicitaires.
function openWithCash(target){
  const q=nextSeasonCommitment();
  ok(q.adRevenue>0,'recettes attendues positives');
  p.tresorerie+=target(q)-q.cash;
  if(!gameState.history.some(h=>h.season===gameState.season)) gameState.history.push({season:gameState.season});
  startNewSeason();
}
openWithCash(q=>TRESORERIE_CRITIQUE-q.adRevenue/2);
ok(p.tresorerie-p.revenusPubPrevisionnels<TRESORERIE_CRITIQUE,'sous le seuil après paiement de la grille');
ok(gameState.step===6&&p.tresorerie>=TRESORERIE_CRITIQUE,'pas de faillite : recettes pub créditées avant le contrôle');
ok(p.revenusPubPrevisionnels>0,'recettes pub créditées');
gameState.step=6;
openWithCash(q=>TRESORERIE_CRITIQUE-q.adRevenue*2);
ok(gameState.step===8&&gameState.gameOverReason==='tresorerie','faillite si les recettes ne suffisent pas');
console.log('OK economy: grid per format, S1 grid paid once, ad revenue credited once, reevaluation delta, S2 carry-over, single count, bankruptcy after ad revenue');
`;
vm.runInNewContext(scripts.slice(0,-1).join('\n')+'\n'+tests,{console},{filename:'eco.js'});
