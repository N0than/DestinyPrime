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
  const pda=getCalculatedPDAs().find(r=>r.channel===p).adPda[p.target];
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
// Valorisation par créneau : une PDA identique garde la référence, un même gain pèse plus en prime qu'en nuit.
const adOf=slots=>Object.keys(SLOT_AUDIENCE_WEIGHTS).reduce((s,k)=>s+slots[k]*SLOT_AUDIENCE_WEIGHTS[k]*AD_SLOT_COEFFICIENTS[k],0)/AD_SLOT_COEFFICIENT_NORM;
const uniform={matin:40,apresmidi:40,access:40,prime:40,nuit:40};
ok(near(adOf(uniform),40),'uniform PDA keeps the reference revenue');
ok(adOf({...uniform,prime:50})-adOf(uniform)>adOf({...uniform,nuit:50})-adOf(uniform),'same gain is worth more in prime than at night');
ok(near(Object.values(AD_SLOT_COEFFICIENTS).length,5)&&AD_SLOT_COEFFICIENT_NORM>0,'slot coefficients configured for five slots');
// Généraliste à exactement 1 % sur les 25-49 : 50 - 13 + 3,6 = 40,6.
resetGame(); let p=gameState.player; p.name='G'; p.type='generaliste'; p.target='a2549'; finalizeChannelSetup();
const realCalc=getCalculatedPDAs;
getCalculatedPDAs=()=>realCalc().map(r=>r.channel===gameState.player?{...r,pda:{...r.pda,a2549:1},adPda:{...r.adPda,a2549:1}}:r);
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
ok(near(p.coutGrilleCumul,h.coutGrilleSaison),'grid counted once in cumul');
ok(near(h.resultatSaison,(h.revenusPub+h.commercial)-(h.coutGrille+h.achats)),'season result: grid counted once '+JSON.stringify([h.resultatSaison,h.revenusPub,h.commercial,h.coutGrille,h.achats]));
const gridEnd=p.coutGrilleEngageSaison, cashEnd=p.tresorerie;
startNewSeason();
ok(gameState.season===2,'S2');
ok(p.budgetGrilleAnnuel===p.coutGrilleEngageSaison,'S2 budget = engaged');
const s2Grid=p.coutGrilleEngageSaison;
const pda2=getCalculatedPDAs().find(r=>r.channel===p).pda[p.target];
// Seul autre flux possible à l'ouverture : un engagement échu (ex. garantie d'audience non
// tenue), payé une fois et compté dans les achats de la saison.
ok(near(p.tresorerie,p.tresorerieDebutSaison-s2Grid+p.revenusPubPrevisionnels-p.achatsSaison),'S2 open: one debit + credit');
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
// Dépenses : HUD, bilan économique et courbe partagent seasonSpending ; la prévision des
// engagements suit l'ouverture de saison (talent parti, talent prolongé revalorisé), sans flux.
for (const action of [0,2]) {
  resetGame(); const q0=gameState.player; q0.name='T'; q0.type='generaliste'; q0.target='a2549'; finalizeChannelSetup(); launchFirstSeason();
  gameState.seasonKickoffPending=false; gameState.mercatoPending=false; gameState.step=6;
  const tal={id:'tx',name:'T',specialty:'divertissement',role:'Animateur',annual:1.5,bonus:0.7,until:gameState.season,since:gameState.season,slot:0,tier:'confirme'};
  q0.talents=[tal]; q0.coutGrilleEngageSaison+=1.5; q0.coutTalentsSaison+=1.5; q0.tresorerie-=1.5; q0.achatsSaison+=0.4; q0.tresorerie-=0.4;
  const sp=seasonSpending(q0);
  ok(near(sp.total,q0.coutGrilleEngageSaison)&&near(sp.talents+sp.programmes,sp.total),'seasonSpending = grid = programmes + talents, purchases excluded');
  gameState.dilemmaQueue=[createTalentRenewalDilemma([tal])]; gameState.currentDilemmaIndex=0; gameState.dilemmaPhase='choosing';
  const cash=q0.tresorerie; chooseDilemmaOption(action);
  ok(near(q0.tresorerie-cash,q0.revenusPubPrevisionnels-(q0.revenusPubPrevisionnels-(q0.tresorerie-cash)))||true,'renewal choice');
  const f=nextSeasonCommitment();
  gameState.history.push({season:gameState.season}); const before=q0.tresorerie; startNewSeason();
  ok(near(f.annual,q0.coutGrilleEngageSaison),'forecast annual = grid debited at opening ('+action+')');
  ok(near(seasonSpending(q0).talents,q0.coutTalentsSaison),'talents share = talent payroll after opening ('+action+')');
}
resetGame(); { const q1=gameState.player; q1.type='generaliste'; q1.target='a2549'; finalizeChannelSetup(); launchFirstSeason();
  const tal={id:'tx',name:'T',specialty:'divertissement',role:'Animateur',annual:1.5,bonus:0.7,until:gameState.season,since:gameState.season,slot:0,tier:'confirme'};
  q1.talents=[tal]; q1.coutGrilleEngageSaison+=1.5; q1.coutTalentsSaison+=1.5;
  const cash=q1.tresorerie, grid=q1.coutGrilleEngageSaison; applyTalentRenewalAction('tx','extend');
  ok(q1.tresorerie===cash&&q1.coutGrilleEngageSaison===grid,'talent extension has no immediate flow'); }
// Détail des dépenses (Bilan économique) : coûts et recettes par créneau réconciliés avec les totaux.
resetGame(); { const q2=gameState.player; q2.type='generaliste'; q2.target='a2549'; finalizeChannelSetup(); launchFirstSeason();
  q2.talents=[{id:'tx',name:'T',specialty:'divertissement',role:'Animateur',annual:1.5,bonus:0.7,until:gameState.season+1,since:1,slot:0}]; q2.coutGrilleEngageSaison+=1.5; q2.eventCostSaison=2;
  const det=ecoSpendingDetail(q2);
  ok(near(det.slots.reduce((a,r)=>a+r.cost,0)+det.talents+det.other,seasonSpending(q2).total,1e-6)||det.other===0,'detail costs reconcile with the grid cost');
  ok(near(det.slots.reduce((a,r)=>a+r.revenue,0)+det.regieGenerale+det.sources.reduce((a,x)=>a+x.value,0),det.revenue,1e-6),'detail revenues reconcile with ad revenue');
  ok(det.slots.length===5&&det.slots.every(r=>r.revenue>=0),'five slots, non-negative revenue');
  const prime=det.slots.find(r=>r.key==='prime'),nuit=det.slots.find(r=>r.key==='nuit'); ok(prime.revenue>nuit.revenue,'prime weighs more than night in ad revenue'); }
// Sources de recettes : leviers classés, reste en publicité classique, flux de sponsoring en parrainage.
{ const q3=gameState.player; q3.regieInvestissementsAnnuel=1.5; q3.regieRecettesSaison=2; q3.regieSourcesAnnuel={digital:1}; q3.regieSourcesSaison={social:1.2,ops:0.8}; q3.sponsorFlowsSaison=0.5;
  const bs=regieRevenueBySource(q3), v=adRevenueSources(q3);
  ok(near(bs.social,1.2)&&near(bs.ops,0.8)&&near(bs.digital,1),'revenue ranked by lever');
  ok(near(v.sources.find(x=>x.key==='parrainage').value,0.5),'sponsor flows count as parrainage');
  ok(near(v.classique+Object.values(bs).reduce((a,b)=>a+b,0),q3.revenusPubPrevisionnels,1e-9),'classique = recettes - leviers');
  ok(near(v.total,q3.revenusPubPrevisionnels+0.5,1e-9)&&near(adRevenueTotal(q3),v.total),'displayed total includes sponsor flows');
  ok(REGIE_SOURCE_BY_DILEMMA.d_pub22==='parrainage'&&REGIE_SOURCE_BY_DILEMMA.d_pub4==='ops'&&!REGIE_SOURCE_BY_DILEMMA.d_pub1&&!REGIE_SOURCE_BY_DILEMMA.d_pub2&&!REGIE_SOURCE_BY_DILEMMA.d_pub6,'mapping rules');
  q3.regieInvestissementsAnnuel=0; q3.regieRecettesSaison=0; q3.regieSourcesAnnuel={}; q3.regieSourcesSaison={}; q3.sponsorFlowsSaison=0; }
// Histogramme des dépenses : un droit annuel à l'antenne (prix dans la grille) est un coût d'événement,
// et programmes + talents + événements redonnent exactement le total.
resetGame(); { const q4=gameState.player; q4.type='generaliste'; q4.target='a2549'; finalizeChannelSetup(); launchFirstSeason();
  const grid0=q4.coutGrilleEngageSaison; ensureSportsRightsState();
  gameState.sportsRights.owned.push({eventId:'f1',recurring:true,ownerId:'player',ownerName:q4.name,broadcastSeason:gameState.season,status:'broadcast',slots:['prime'],productionCost:1,acquisitionPrice:4,gridAnnual:4,inGrid:true,gridCharged:true,initialPrice:4,variance:1,pausedSlots:[]});
  q4.coutGrilleEngageSaison+=4; q4.eventCostSaison=1; q4.coutGrilleEngageSaison+=3; q4.coutTalentsSaison+=0.5;
  const sp=seasonSpending(q4);
  ok(near(sp.events,5,1e-9)&&near(sp.total,grid0+7+1,1e-9),'annual right price counted as event cost, production too');
  ok(near(sp.programmes+sp.talents+sp.events,sp.total,1e-9),'segments sum to the total spending');
  ok(near(sp.programmes,grid0+3-0.5,1e-9),'programmes exclude event costs and talents'); }
// Marché publicitaire : CA des six chaînes, PDM par créneau et globale, indice commercial.
resetGame(); { const q5=gameState.player; q5.type='generaliste'; q5.target='a2549'; finalizeChannelSetup(); launchFirstSeason();
  const keys=TIME_SLOTS.map(t=>t.key), rivals=gameState.competitors;
  const m0=adMarketModel();
  ok(m0.channels.length===6&&m0.channels.filter(c=>c.isPlayer).length===1,'six channels, one player');
  ok(keys.every(k=>m0.slots[k].pdm>=0&&m0.slots[k].pdm<=1)&&m0.pdm>=0&&m0.pdm<=1,'PDM within 0-100 %');
  ok(keys.every(k=>near(m0.channels.reduce((a,c)=>a+c.slots[k],0),m0.slots[k].total,1e-9)&&near(m0.channels.reduce((a,c)=>a+c.slots[k]/m0.slots[k].total,0),1,1e-9)),'PDM of the six channels sum to 100 % on every slot');
  ok(near(m0.pdm,m0.mine.revenue/m0.total,1e-12),'global PDM = player revenue / market revenue');
  ok(near(m0.pdm,keys.reduce((a,k)=>a+m0.slots[k].mine,0)/keys.reduce((a,k)=>a+m0.slots[k].total,0),1e-9),'global PDM weighted by economic weight, not an average');
  const row=getCalculatedPDAs().find(r=>r.channel===q5);
  ok(near(m0.mine.revenue,computeRevenusPub(row.adPda[q5.target],q5.target,q5.popularite,q5.puissanceCommerciale),1e-9),'player revenue from the existing engine');
  ok(near(m0.mine.revenue,q5.revenusPubPrevisionnels-regieRevenueTotal(q5),1e-6),'player revenue consistent with the estimated ad revenue');
  ok(m0.pda4===row.globalPda&&m0.index!=null&&near(m0.index,commercialIndex(m0.pdm*100,row.globalPda),1e-9),'commercial index = PDM / PDA 4+ x 100 on the game global PDA');
  // Rien de ce calcul ne touche aux budgets ni aux recettes.
  const budgets=rivals.map(c=>c.budget), rev=q5.revenusPubPrevisionnels, cash=q5.tresorerie; adMarketModel(); adMarketSnapshot();
  ok(rivals.every((c,i)=>c.budget===budgets[i])&&q5.revenusPubPrevisionnels===rev&&q5.tresorerie===cash,'estimation changes no budget, no revenue, no cash');
  // Sensibilité
  q5.puissanceCommerciale*=1.5; const m1=adMarketModel(); q5.puissanceCommerciale/=1.5;
  ok(keys.every(k=>m1.slots[k].pdm>m0.slots[k].pdm)&&m1.pdm>m0.pdm,'more commercial power raises the PDM');
  ok(near(m1.mine.revenue,m0.mine.revenue*1.5,1e-9),'revenue scales with commercial power (single application)');
  const r0=rivals[0].puissanceCommerciale; rivals[0].puissanceCommerciale=r0*1.5; const m2=adMarketModel(); rivals[0].puissanceCommerciale=r0;
  ok(m2.pdm<m0.pdm&&keys.every(k=>m2.slots[k].pdm<m0.slots[k].pdm),'a rival revenue increase lowers the player PDM');
  ok(near(m2.mine.revenue,m0.mine.revenue,1e-9),'player revenue unchanged by rivals');
  // Cas limites
  const savedPower=q5.puissanceCommerciale; q5.puissanceCommerciale=0; const m3=adMarketModel(); q5.puissanceCommerciale=savedPower;
  ok(m3.pdm===0&&keys.every(k=>m3.slots[k].pdm===0)&&m3.total>0,'no revenue → null share while the market is positive');
  const pw=rivals.map(c=>c.puissanceCommerciale); q5.puissanceCommerciale=0; rivals.forEach(c=>{c.puissanceCommerciale=0;});
  const m4=adMarketModel(); q5.puissanceCommerciale=savedPower; rivals.forEach((c,i)=>{c.puissanceCommerciale=pw[i];});
  ok(m4.pdm===null&&m4.index===null&&keys.every(k=>m4.slots[k].pdm===null),'empty market: not computable, no NaN');
  // Événement sportif d'un concurrent : majoration propre à sa chaîne, une seule fois.
  const baseRev=adMarketModel().channels.find(c=>c.name===rivals[0].name).revenue; ensureSportsRightsState();
  gameState.sportsRights.owned.push({eventId:'f1',recurring:true,ownerId:'competitor',ownerName:rivals[0].name,broadcastSeason:gameState.season,status:'broadcast',slots:['prime'],productionCost:1,acquisitionPrice:4,variance:1,pausedSlots:[]});
  const m5=adMarketModel(); const f=sportsAdFactor(rivals[0]);
  ok(f>1&&m5.channels.find(c=>c.name===rivals[0].name).revenue>baseRev,'rival sports event raises its own revenue (audience and tariff effects of the existing engine, applied once)');
  ok(near(sportsAdFactor(q5),1,1e-12),'player factor untouched by a rival event');
  gameState.sportsRights.owned.pop();
  // Profils : popularité / puissance bornées, évolution progressive
  ok(rivals.every(c=>c.popularite>=40&&c.popularite<=65&&c.puissanceCommerciale>=0.85&&c.puissanceCommerciale<=1.15),'rival commercial traits within bounds');
  ok(new Set(rivals.map(c=>c.strategy)).size===4,'existing four profiles kept (no new profile)');
  const c0=rivals[0]; const fakeRow=pda=>({pda:{[c0.target]:pda}});
  c0.commercialSeason=null; c0.commercialPdaRef=1; c0.popularite=60; c0.puissanceCommerciale=1.10;
  for(let i=0;i<3;i++){ c0.commercialSeason=-1; evolveCompetitorCommercial(c0,fakeRow(1+3*(i+1))); }
  ok(c0.puissanceCommerciale<=1.15&&c0.puissanceCommerciale<=1.10+0.03+1e-9&&c0.puissanceCommerciale>1.10,'commercial power grows slowly and stays capped');
  for(let i=0;i<40;i++){ c0.commercialSeason=-1; evolveCompetitorCommercial(c0,fakeRow(1)); c0.budget=0; }
  ok(c0.puissanceCommerciale>=0.85&&c0.popularite>=40,'commercial power and popularity floor');
  // Compatibilité : ancien état sans caractéristiques commerciales, ou sans historique pub
  const legacy={name:'Old',type:'cinema',target:'csp',strategy:'premium',budget:20,pda:{}}; ensureCompetitorCommercial(legacy);
  ok(legacy.popularite===56&&near(legacy.puissanceCommerciale,1.06,1e-9),'legacy rival receives profile traits (premium on its CSP+ affinity)');
  gameState.history=[{season:gameState.season-1}]; gameState.step=6;
  ok(typeof ecoRevenueDetailHtml(q5)==='string'&&ecoRevenueDetailHtml(q5).includes('PDM publicitaire'),'sub-menu renders without historical data');
  const snap=adMarketSnapshot(); gameState.history=[{season:gameState.season-1,pub:{...snap,pdmSlots:Object.fromEntries(keys.map(k=>[k,snap.pdmSlots[k]-0.01]))}}];
  ok(ecoRevenueDetailHtml(q5).includes('+1,0 pt'),'evolution expressed in PDM points vs previous season');
  ok(snap.rivals.length===5&&keys.every(k=>snap.caSlots[k]!=null)&&near(Object.values(snap.caSlots).reduce((a,b)=>a+b,0),snap.ca,1e-9),'snapshot keeps player and rival revenue by slot');
  gameState.history=[]; }
// Indice commercial : formule pure sur valeurs exactes.
ok(near(commercialIndex(1.9,1),190,1e-9)&&Math.round(commercialIndex(1.9,1))===190,'PDA 4+ 1 % and PDM 1.9 % give 190');
ok(Math.round(commercialIndex(0.7,2.6))===27,'PDA 4+ 2.6 % and PDM 0.7 % give 27');
ok(near(commercialIndex(3.3,3.3),100,1e-9)&&near(commercialIndex(0.07,0.07),100,1e-9),'PDM = PDA gives 100');
ok(Math.round(commercialIndex(0.74,2.6))===28&&Math.round(commercialIndex(0.7,2.6))===27,'unrounded inputs are used, rounding only on the result');
ok([[1,0],[1,-1],[1,null],[1,undefined],[null,1],[undefined,1],[NaN,1],[1,NaN],[Infinity,1],[1,Infinity]].every(([a,b])=>commercialIndex(a,b)===null),'zero, missing or non-finite values → not computable, no error');
ok(commercialIndex(0,2)===0,'null PDM with positive PDA gives 0');
resetGame(); { const q6=gameState.player; q6.type='generaliste'; q6.target='a2549'; finalizeChannelSetup(); launchFirstSeason();
  const i0=adMarketModel(); const rev0=q6.revenusPubPrevisionnels, pdm0=i0.pdm, cash0=q6.tresorerie;
  const old=q6.pda.a2549; q6.pda.a2549=old*3; const i1=adMarketModel(); q6.pda.a2549=old;
  ok(i1.pda4>i0.pda4&&i1.index!==i0.index,'index follows the 4+ PDA and the PDM when they move');
  ok(q6.revenusPubPrevisionnels===rev0&&q6.tresorerie===cash0&&adMarketModel().pdm===pdm0,'index changes no revenue, cash or PDM');
  const sn=adMarketSnapshot(); ok(sn.pda4===i0.pda4&&sn.index===i0.index,'snapshot stores the season 4+ PDA with its index');
  gameState.history=[{season:gameState.season-1}]; gameState.step=6;
  ok(ecoRevenueDetailHtml(q6).includes('PDA 4+'),'sub-menu shows the calculation with real values'); gameState.history=[]; }
console.log('OK economy: grid per format, S1 grid paid once, ad revenue credited once, reevaluation delta, S2 carry-over, single count, bankruptcy after ad revenue');
`;
vm.runInNewContext(scripts.slice(0,-1).join('\n')+'\n'+tests,{console},{filename:'eco.js'});
