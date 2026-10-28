'use strict';
// Approches de chaînes concurrentes et changement de direction : calendrier, éligibilité
// (audience OU rentabilité), tirage mémorisé, refus, transfert atomique (six chaînes, actifs,
// contrats, talents, droits, engagements, trésorerie + apport), ancienne chaîne sous IA,
// historiques, mandat, sauvegarde, scénario carrière.
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const tests = String.raw`
const ok=(v,m)=>{if(!v) throw Error(m)};
const near=(a,b,e=1e-6)=>Math.abs(a-b)<e;
render=()=>{};
globalThis.localStorage={d:{},setItem(k,v){this.d[k]=String(v)},getItem(k){return k in this.d?this.d[k]:null}};
let rng=1;
function partie(type='generaliste', seed=4242){
  rng=seed>>>0; Math.random=()=>{rng=(Math.imul(rng,1103515245)+12345)>>>0; return rng/4294967296;};
  resetGame(); const p=gameState.player; p.name='Ma Chaîne'; p.type=type; p.target='a2549';
  finalizeChannelSetup(); gameState.campaign.seed=seed; p.tresorerie+=300; launchFirstSeason();
  return p;
}
function randomIdx(d){ const o=(d.c||[]).map((c,i)=>c.disabled?-1:i).filter(i=>i>=0); return o.length?o[Math.floor(Math.random()*o.length)]:0; }
function joue(){ gameState.seasonKickoffPending=false; gameState.mercatoPending=false;
  for(let g=0;gameState.step===6&&g<80;g++){ const q=gameState.dilemmaQueue, cur=q[gameState.currentDilemmaIndex]; if(!cur) break;
    if(gameState.dilemmaPhase==='choosing'&&cur.type==='sports_rights_auction'){ startSportsRightsAuction(cur.rightsEventId,cur.id); sportsAuctionPass(); }
    if(gameState.dilemmaPhase==='choosing'){ if(q.slice(gameState.currentDilemmaIndex).some(d=>!narrativeValid(d))) revalidateNarrativeQueue(); materializeCurrentDilemma();
      for(let k=0;k<7&&gameState.dilemmaPhase==='choosing';k++) chooseDilemmaOption(randomIdx(gameState.dilemmaQueue[gameState.currentDilemmaIndex])); }
    continueAfterConsequence(); }
  ok(gameState.history.some(h=>h.season===gameState.season),'saison '+gameState.season+' clôturée'); }
function suivante(){ gameState.step=7; gameState.renewalDue=false; startNewSeason(); }
// Mesure hors événements de la saison close des chaînes données (règle de popularité propre au joueur).
function horsEvenements(names,fn){ const recs=(gameState.sportsRights?.owned||[]).filter(o=>o.broadcastSeason===gameState.season&&names.includes(o.ownerName)); recs.forEach(o=>o.suppressed=true); try { return fn(); } finally { recs.forEach(o=>delete o.suppressed); } }
const perf=(o)=>({channel:gameState.player.name,pda4:10,pdaTarget:10,rank:3,rankTarget:3,revenue:50,operating:-5,margin:-0.1,treasury:50,commitments:0,exceptional:0,...o});
const CA=CHANNEL_APPROACH;

// ——— 1. Calendrier : aucune approche avant trois saisons, attente initiale tirée ———
{ partie(); const d=ensureDirector();
  ok(d.approach.nextEvalSeason>=CA.minSeasons&&d.approach.nextEvalSeason<=CA.minSeasons+CA.initialWait[1],'première évaluation entre la saison 3 et la saison 6 : '+d.approach.nextEvalSeason);
  joue(); ok(!d.approach.evaluated[1]&&!d.approach.offer,'saison 1 : aucune évaluation');
  const firsts=new Set(); for(let k=1;k<=24;k++){ partie('generaliste',k*7919); firsts.add(ensureDirector().approach.nextEvalSeason); }
  ok([...firsts].every(v=>v>=3&&v<=6)&&firsts.size>=3,'attente initiale variable : '+[...firsts]); }

// ——— 2. Éligibilité : audience seule, rentabilité seule, apports exclus ———
{ partie();
  const aud=approachScores([perf({pda4:2,pdaTarget:2,rank:6}),perf({pda4:3.5,pdaTarget:3.5,rank:5}),perf({pda4:5,pdaTarget:5.5,rank:4})]);
  ok(aud.audience>=CA.threshold&&aud.finance===0&&aud.base>=CA.threshold&&aud.path==='audience','réussite d’audience seule (pertes) : éligible');
  const lead=approachScores([perf({pda4:24,rank:1}),perf({pda4:23.5,rank:1}),perf({pda4:23.8,rank:1})]);
  ok(lead.audience>=CA.threshold,'leader installé sans progression : éligible');
  const fin=approachScores([perf({operating:4,margin:0.08}),perf({operating:7,margin:0.14}),perf({operating:10,margin:0.2,treasury:60})]);
  ok(fin.finance>=CA.threshold&&fin.audience<CA.threshold&&fin.base>=CA.threshold&&fin.path==='finance','réussite financière seule (audience stable) : éligible');
  const crash=approachScores([perf({pda4:10,operating:4,margin:0.2}),perf({pda4:8,operating:7,margin:0.2}),perf({pda4:6,operating:10,margin:0.2})]);
  ok(crash.finance<fin.finance,'rentabilité au prix d’un effondrement de l’antenne : contextualisée');
  const sick=approachScores([perf({operating:4,margin:0.2}),perf({operating:7,margin:0.2}),perf({operating:10,margin:0.2,treasury:-5})]);
  ok(sick.finance===0,'trésorerie négative : pas de réputation de gestionnaire');
  const both=approachScores([perf({pda4:4,pdaTarget:4,rank:6,operating:4,margin:0.1}),perf({pda4:4.7,pdaTarget:4.7,rank:6,operating:5,margin:0.1}),perf({pda4:5.4,pdaTarget:5.4,rank:5,operating:6,margin:0.1})]);
  ok(both.base>Math.max(both.audience,both.finance)&&both.base<=1,'réussite dans les deux voies : bonus limité');
  ok(approachProbability(0.4)===0&&approachProbability(1)<=CA.maxProbability&&approachProbability(1)>approachProbability(0.6),'probabilité bornée et croissante');
  // Apport d'actionnaire et recette exceptionnelle n'entrent pas dans le résultat d'exploitation.
  const p=gameState.player; p.revenusPubFinals=40; p.commercialSaison=10; p.exceptionalSaison=10; p.coutGrilleEngageSaison=30; p.achatsSaison=5;
  const a=directorSeasonPerf(); p.tresorerie+=50; const b=directorSeasonPerf();
  ok(near(a.operating,5)&&near(a.operating,b.operating),'apport : trésorerie en hausse, résultat inchangé ; cession de format exclue'); }

// ——— 3. Tirage mémorisé, délais ———
{ partie(); for(let s=0;s<3;s++){ joue(); if(s<2) suivante(); }
  const d=ensureDirector(); d.approach.nextEvalSeason=gameState.season; delete d.approach.evaluated[gameState.season]; d.approach.offer=null;
  // Fenêtre favorable fabriquée sur les bilans figés (audience en forte hausse).
  gameState.history.slice(-3).forEach((h,i)=>{ h.perf={...h.perf,pda4:2+i*3,pdaTarget:2+i*3,rank:6-i}; });
  const save=JSON.stringify(gameState);
  const offer=evaluateChannelApproach(), rec=JSON.stringify(d.approach.evaluated[gameState.season]);
  ok(evaluateChannelApproach()===null&&JSON.stringify(d.approach.evaluated[gameState.season])===rec,'une seule évaluation par saison');
  gameState=JSON.parse(save); const offer2=evaluateChannelApproach();
  ok(JSON.stringify(gameState.director.approach.evaluated[gameState.season])===rec&&!!offer===!!offer2,'rechargement : même tirage, même résultat');
  const r=JSON.parse(rec); ok(r.eligible&&r.probability>0&&r.probability<=CA.maxProbability,'éligible, probabilité bornée');
  if(!offer2){ const w=gameState.director.approach.nextEvalSeason-gameState.season; ok(w>=CA.noOfferWait[0]&&w<=CA.noOfferWait[1],'sans offre : attente de 1 à 2 saisons'); } }

// ——— 4. Refus : chaîne et comptes conservés, attente 2 à 3 saisons ———
{ const p=partie(); for(let s=0;s<3;s++){ joue(); if(s<2) suivante(); }
  const d=ensureDirector(); d.approach.offer=buildChannelOffer({audience:0.8,finance:0.1,base:0.82,path:'audience'});
  ok(pendingChannelOffer()&&d.approach.offer.channelName!==p.name,'offre d’un concurrent réel');
  const snap=JSON.stringify([gameState.player,gameState.competitors]);
  ok(declineChannelOffer(),'refus');
  ok(JSON.stringify([gameState.player,gameState.competitors])===snap,'refus : aucune modification de chaîne ni de comptes');
  const w=d.approach.nextEvalSeason-gameState.season; ok(w>=CA.refusalWait[0]&&w<=CA.refusalWait[1],'refus : attente de 2 à 3 saisons');
  ok(!declineChannelOffer()&&!acceptChannelOffer().ok,'plus d’offre en cours'); }

// ——— 5. Transfert : six chaînes, actifs, coûts, droits, engagements ———
function transfert(type='generaliste', seed=4242, scores={audience:0.8,finance:0.1,base:0.82,path:'audience'}){
  const p=partie(type,seed); for(let s=0;s<3;s++){ joue(); if(s<2) suivante(); }
  const d=ensureDirector(); d.approach.offer=buildChannelOffer(scores);
  return { p, d, o:d.approach.offer };
}
{ const { p:oldP, d, o }=transfert();
  const c=gameState.competitors.find(x=>x.name===o.channelName);
  const before={ playerCash:oldP.tresorerie, compCash:c.budget,
    compCharges:competitorAnnualCharges(c).total, compRevenue:horsEvenements([c.name,oldP.name],()=>competitorAdRevenue(c)), playerGrid:oldP.coutGrilleEngageSaison,
    compContracts:Object.fromEntries(Object.entries(c.contracts).map(([s,k])=>[s,{id:k.id,end:k.end,cost:Math.round(competitorContractAnnual(k)*100)/100,obj:k}])),
    oldContracts:Object.fromEntries(Object.entries(oldP.contracts).map(([s,k])=>[s,{id:k.id,end:k.end,annual:k.annual,obj:k}])),
    compTalents:(c.talents||[]).map(t=>t.id+'|'+t.annual+'|'+t.until).sort().join(), oldTalents:(oldP.talents||[]).map(t=>t.id+'|'+t.annual+'|'+t.until).sort().join(),
    rights:(gameState.sportsRights.owned||[]).filter(r=>[oldP.name,c.name].includes(r.ownerName)).length,
    // Hors événement de la saison close (pondéré par la popularité chez le joueur, pas chez une IA).
    audience:transferSnapshot(oldP,c).audience, terms:takeoverContractTerms(c), adRevenue:competitorAdRevenue(c) };
  // Engagement différé de l'ancienne chaîne : il la suit.
  registerCommitment({ kind:'adGuarantee', key:'test-guarantee', amount:2, season:gameState.season });
  const S0=gameState.season;
  const r=acceptChannelOffer(); ok(r.ok,'acceptation : '+r.reason);
  ok(!acceptChannelOffer().ok,'pas de double acceptation');
  const np=gameState.player, ai=gameState.competitors.find(x=>x.name===oldP.name);
  ok(np===c&&ai===oldP&&gameState.competitors.length===5,'six chaînes : rôles échangés, objets conservés');
  ok(near(np.tresorerie,before.compCash+o.contribution)&&near(ai.budget,before.playerCash),'trésoreries conservées (+ apport explicite)');
  ok(transferSnapshot(np,ai).audience===before.audience,'audiences inchangées : aucun bonus');
  // Contrats repris au prix du marché (jamais sous leur coût), échéance de la saison close prolongée d'une saison.
  Object.entries(before.compContracts).forEach(([s,k])=>{ const n=np.contracts[s], tm=before.terms[s];
    ok(n===k.obj&&n.id===k.id&&near(n.annual,tm.annual,0.011)&&n.annual>=k.cost-0.011,'contrat repris au prix du marché : '+s);
    ok(n.end===(k.end===S0?S0+1:k.end),'échéance de reprise : '+s); });
  const sumBase=Object.values(before.terms).reduce((a,x)=>a+x.base,0), marketGrid=Object.values(before.terms).reduce((a,x)=>a+x.annual,0);
  ok(marketGrid>=sumBase-0.01&&(before.adRevenue*CHANNEL_APPROACH.market.gridShare<=sumBase||marketGrid>sumBase),'grille réévaluée au prix du marché ('+sumBase.toFixed(1)+' → '+marketGrid.toFixed(1)+' M€)');
  Object.entries(before.oldContracts).forEach(([s,k])=>{ const n=ai.contracts[s]; ok(n===k.obj&&n.end===k.end&&near(competitorContractAnnual(n),k.annual),'contrat de l’ancienne chaîne conservé : '+s); });
  ok((np.talents||[]).map(t=>t.id+'|'+t.annual+'|'+t.until).sort().join()===before.compTalents&&(ai.talents||[]).map(t=>t.id+'|'+t.annual+'|'+t.until).sort().join()===before.oldTalents,'talents et salaires conservés');
  // Coût de grille reporté : tous les contrats (hors pause) et les talents ; expireContracts et
  // expireTalents en retirent les échus à l'ouverture, comme pour tout joueur.
  const S=gameState.season;
  const next=Object.values(np.contracts).filter(k=>k.end>=S+1).reduce((a,k)=>a+k.annual,0)+(np.talents||[]).filter(t=>t.until>=S+1).reduce((a,t)=>a+t.annual,0);
  ok(near(horsEvenements([np.name,ai.name],()=>computeRevenusPub(getCalculatedPDAs().find(x=>x.channel===np).adPda[np.target],np.target,np.popularite,np.puissanceCommerciale,np)+regieRevenueTotal(np)),before.compRevenue,1e-6),'mêmes recettes avec le moteur du joueur');
  ok(ai.commitments.some(e=>e.key==='test-guarantee')&&!(np.commitments||[]).some(e=>e.key==='test-guarantee'),'engagements différés : restent à leur chaîne');
  const seen=new Set(); [np,...gameState.competitors].forEach(ch=>Object.values(ch.contracts).forEach(k=>{ ok(!seen.has(k.id),'programme non dupliqué '+k.id); seen.add(k.id); }));
  ok(d.transfers.length===1&&d.since===gameState.season+1&&d.mandate?.status==='running','parcours du dirigeant et mandat');
  const w=d.approach.nextEvalSeason-gameState.season; ok(w>=CA.transferWait[0]&&w<=CA.transferWait[1],'après transfert : attente de trois saisons au moins');
  // Saison suivante : une seule ouverture par chaîne, sans refacturation.
  const cashNp=np.tresorerie, grid=np.coutGrilleEngageSaison;
  suivante();
  ok(near(np.budgetGrilleAnnuel,next+sportsRightsGridAnnual(gameState.season),0.05),'grille facturée au joueur = contrats et talents en cours de la chaîne ('+np.budgetGrilleAnnuel+' / '+next+')');
  ok(near(np.tresorerie,cashNp-np.coutGrilleEngageSaison+np.revenusPubPrevisionnels-(np.achatsSaison||0)+(np.commercialSaison||0),0.5),'ouverture : grille payée, recettes créditées une fois');
  ok(np.grillePayeeSaison===gameState.season&&ai.finance.openedSeason===gameState.season,'saison ouverte une fois pour chaque chaîne');
  ok(ai.finance.season.recurring>0&&ai.finance.season.ad>0,'ancienne chaîne : charges et recettes de la saison sous IA');
  ok(!openCompetitorSeason(ai),'ouverture idempotente');
  joue(); ok(gameState.history.at(-1).perf.channel===np.name,'bilan rattaché à la nouvelle chaîne');
  ok(directorWindow()===null,'évaluations futures : seulement des saisons entièrement dirigées dans la nouvelle chaîne');
  const h=ai.finance.history.at(-1); ok(h.season===gameState.season&&near(h.opening+h.adRevenue+h.otherIncome+h.contributions-h.recurring-h.sportsRights-h.sportsProduction-h.oneOff-h.distributions,h.closing,0.01),'ancienne chaîne : comptes IA cohérents');
  ok(ai.commitments.find(e=>e.key==='test-guarantee').status!=='pending','engagement de l’ancienne chaîne réglé sur ses comptes');
  // Sauvegarde après transfert : rechargement et saison suivante.
  gameState=JSON.parse(JSON.stringify(gameState)); suivante(); joue();
  ok(gameState.player.name===np.name&&gameState.competitors.some(x=>x.name===oldP.name)&&gameState.competitors.length===5,'rechargement après transfert : partie poursuivie'); }

// ——— 6. Droits sportifs : titulaire, sommes dues, aucune refacturation ———
{ const { o }=transfert('sport',99);
  const c=gameState.competitors.find(x=>x.name===o.channelName), ev=Object.values(SPORT_RIGHTS_EVENTS).find(e=>!e.category&&!e.recurring);
  acquireSportsRight(ev.id,{owner:c,price:9,term:2}); // saison suivante payée, la seconde due
  const paidBefore=c.finance.season.sportsRights;
  ok(acceptChannelOffer().ok,'acceptation');
  const recs=gameState.sportsRights.owned.filter(x=>x.eventId===ev.id&&x.ownerName===c.name);
  ok(recs.every(x=>x.ownerId==='player')&&recs[0].priceSettled===true&&recs[1].priceSettled===false&&recs[1].payOnAir,'droits : titulaire joueur, première saison réglée, seconde due');
  const cash=gameState.player.tresorerie; suivante();
  const p=gameState.player; ok(p.achatsSaison>=ev.productionCost-1e-9,'saison de diffusion : production payée par le joueur');
  ok(near(paidBefore,9),'prix initial payé une seule fois (par la chaîne avant la reprise)'); }

// ——— 7. Atomicité : échec de validation → état initial ———
{ const { o }=transfert('cinema',77,{audience:0.1,finance:0.8,base:0.82,path:'finance'});
  const snap=JSON.stringify(gameState);
  const real=validateTransfer; validateTransfer=()=>{ throw Error('test'); };
  const r=acceptChannelOffer(); validateTransfer=real;
  ok(!r.ok&&JSON.stringify({...gameState,director:{...gameState.director,approach:{...gameState.director.approach,offer:{...gameState.director.approach.offer,error:undefined}}}})===JSON.stringify({...JSON.parse(snap),director:{...JSON.parse(snap).director,approach:{...JSON.parse(snap).director.approach,offer:{...JSON.parse(snap).director.approach.offer,error:undefined}}}}),'échec : état initial restauré');
  ok(pendingChannelOffer(),'offre toujours en cours après échec');
  const o2=pendingChannelOffer(); o2.contribution=5;
  const cash=gameState.competitors.find(x=>x.name===o2.channelName).budget;
  ok(acceptChannelOffer().ok&&near(gameState.player.tresorerie,cash+5)&&o2.contributionPaid,'apport versé une fois à la prise de fonction');
  ok(gameState.player.shareholder.contributions.length===1,'apport historisé'); }

// ——— 8. Ancienne chaîne sous IA sur plusieurs saisons ; distribution ———
{ const { o }=transfert('jeunesse',31);
  ok(acceptChannelOffer().ok,'acceptation');
  const ai=gameState.competitors.find(x=>x.finance?.history?.some(h=>h.directedByPlayer));
  ok(ai,'ancienne chaîne : historique propre reconstitué');
  competitorBook(ai,'income',400,'Recette test');
  for(let k=0;k<3;k++){ suivante(); joue(); }
  ok(ai.finance.history.slice(-3).every(h=>h.season>gameState.season-3),'ancienne chaîne clôturée chaque saison');
  ok(ai.finance.history.some(h=>h.distributions>0),'politique de distribution appliquée à l’ancienne chaîne');
  ok(TIME_SLOTS.every(({key})=>ai.contracts[key]||competitorSportsRightOn(ai,key)),'ancienne chaîne : grille complète sous IA'); }

// ——— 9. Mandat évalué sur les saisons dirigées ———
{ const { d }=transfert('generaliste',555);
  ok(acceptChannelOffer().ok,'acceptation');
  const m=d.mandate, rep=d.reputation;
  for(let k=0;k<CA.mandateSeasons;k++){ suivante(); joue(); }
  ok(!d.mandate&&d.mandates.length===1&&['success','failure'].includes(d.mandates[0].status),'mandat jugé à son terme : '+d.mandates[0].status);
  ok(d.reputation===rep+(d.mandates[0].status==='success'?CA.reputation.success:CA.reputation.failure),'réputation mise à jour');
  if(d.mandates[0].status==='failure') ok(d.approach.malusUntil>gameState.season,'échec : approches moins probables pendant une période'); }

// ——— 10. Scénario carrière actif : pas d'approche ———
{ partie(); gameState.career={ scenarioId: 1, status: 'active', startSeason: 1 };
  const d=ensureDirector(); d.approach.nextEvalSeason=1;
  gameState.history.push({season:1,perf:perf({})},{season:0,perf:perf({})});
  ok(evaluateChannelApproach()===null&&!d.approach.evaluated[1],'défi en cours : approche différée sans consommer l’évaluation');
  gameState.career.status='won'; }

// ——— 11. Ancienne sauvegarde : pas de bilan inventé, pas d'offre rétroactive ———
{ partie(); for(let s=0;s<3;s++){ joue(); if(s<2) suivante(); }
  delete gameState.director; gameState.history.forEach(h=>{ delete h.perf; delete h.channel; });
  const d=ensureDirector(); d.approach.nextEvalSeason=1;
  ok(evaluateChannelApproach()===null&&!Object.keys(d.approach.evaluated).length,'bilans non documentés : aucune évaluation');
  suivante(); joue(); ok(directorWindow()===null,'il faut trois saisons documentées'); }
`;
const context = { console };
vm.runInNewContext(scripts.slice(0, -1).join('\n') + tests, context, { filename: 'audience-masters-channel-approach.js' });
console.log('OK channel approach: calendar, audience-only and finance-only eligibility, contributions excluded, memorized draw, waits, refusal, atomic transfer (6 channels, assets, contracts, talents, rights, commitments, contribution once), old channel under AI, distribution, mandate, reload, career guard, old saves');
