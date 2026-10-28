'use strict';
// Prêt de sauvetage : proposé au dépôt de bilan (pendant les dilemmes, à la clôture, à
// l'ouverture), montant 1–60 M€, durée 1–10 saisons, taux tiré une fois, capacité
// d'endettement (annuités ≤ 33 % des recettes d'une saison), reprise au bon endroit,
// remboursement à l'ouverture annoncé dans les engagements, exclusions (ARCOM, Carrière).
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const tests = String.raw`
const ok=(v,m)=>{if(!v) throw Error(m)};
const near=(a,b,e=1e-6)=>Math.abs(a-b)<e;
render=()=>{};
globalThis.localStorage={d:{},setItem(k,v){this.d[k]=String(v)},getItem(k){return k in this.d?this.d[k]:null}};
function partie(seed=4242){
  let r=seed>>>0; Math.random=()=>{r=(Math.imul(r,1103515245)+12345)>>>0; return r/4294967296;};
  resetGame(); const p=gameState.player; p.name='Joueur'; p.type='generaliste'; p.target='a2549';
  finalizeChannelSetup(); gameState.campaign.seed=seed; launchFirstSeason();
  gameState.seasonKickoffPending=false; gameState.mercatoPending=false; p.tresorerie=400;
  return p;
}
// Joue un dilemme (premier choix possible) ; la file avance comme dans le jeu.
function unDilemme(){
  if(gameState.dilemmaPhase==='choosing'){
    const q=gameState.dilemmaQueue[gameState.currentDilemmaIndex];
    if(q?.type==='sports_rights_auction'){ startSportsRightsAuction(q.rightsEventId,q.id); sportsAuctionPass(); }
    if(gameState.dilemmaPhase==='choosing') {
      if(gameState.dilemmaQueue.slice(gameState.currentDilemmaIndex).some(d=>!narrativeValid(d))) revalidateNarrativeQueue();
      materializeCurrentDilemma();
      for(let k=0;k<6&&gameState.dilemmaPhase==='choosing';k++){ const d=gameState.dilemmaQueue[gameState.currentDilemmaIndex];
        const ok=d.c.map((c,i)=>c.disabled?-1:i).filter(i=>i>=0); chooseDilemmaOption(ok[k%Math.max(1,ok.length)]??0); }
    }
  }
  continueAfterConsequence();
}
function saison(){ gameState.seasonKickoffPending=false; gameState.mercatoPending=false;
  for(let g=0; gameState.step===6 && g<40; g++) unDilemme(); }

// ——— 1. Dépôt de bilan à l'ouverture : offre, refus motivés, signature, reprise ———
{ const p=partie(); saison(); ok(gameState.step===7,'saison 1 close');
  const revenue=gameState.history.at(-1).revenusPub; ok(revenue>0,'recettes de la saison');
  p.tresorerie=-300; startNewSeason();
  ok(gameState.step===8&&gameState.gameOverReason==='tresorerie'&&gameState.bankruptcy.phase==='open','dépôt de bilan à l’ouverture');
  p.tresorerie=TRESORERIE_CRITIQUE-12;
  const o=loanOffer(); ok(o&&o.rate>=0.03&&o.rate<=0.09,'taux tiré entre 3 et 9 % ('+o.rate+')');
  ok(near(o.capacity,Math.round(revenue*0.33*100)/100)&&o.existing===0,'capacité : 33 % des recettes d’une saison');
  ok(o.needed===12,'montant minimal pour sortir de la tutelle');
  ok(loanOffer().rate===o.rate,'taux stable (pas de nouveau tirage)');
  const saved=JSON.stringify(gameState); gameState=JSON.parse(saved); ok(loanOffer().rate===o.rate,'taux stable après rechargement');
  ok(!takeLoan(5,10).ok,'refus : montant insuffisant');
  ok(!loanCheck(o,60,1).ok&&/capacité/.test(loanCheck(o,60,1).reasons.join()),'refus : annuité au-delà de la capacité');
  ok(near(loanAnnuity(10,0.05,2),5.38),'annuité constante (10 M€, 5 %, 2 saisons)');
  const before=gameState.player.tresorerie, r=takeLoan(12,10);
  ok(r.ok,'prêt signé : '+r.reason);
  const P=gameState.player, l=P.loans[0];
  ok(near(P.tresorerie,before+12)&&l.amount===12&&l.years===10&&l.rate===o.rate&&near(l.annuity,loanAnnuity(12,o.rate,10)),'trésorerie créditée, prêt enregistré');
  ok(gameState.step===6&&!gameState.gameOverReason&&!gameState.bankruptcy,'la saison reprend');
  ok(gameState.mercatoPending||gameState.seasonKickoffPending||gameState.mercato===null,'ouverture de saison complétée (mercato ou conférence)');
  // Engagements de la saison suivante : l'annuité est annoncée et déduite.
  ok(near(nextSeasonCommitment().loans,l.annuity)&&/échéance 1\/10/.test(loanCommitmentHtml()),'remboursement annoncé dans les engagements');
  P.tresorerie+=200; saison(); ok(gameState.step===7,'saison jouée après le prêt');
  P.tresorerie=500; const t0=P.tresorerie, s0=gameState.season;
  startNewSeason(); ok(gameState.season===s0+1&&l.paid===1&&l.paidSeason===gameState.season,'première annuité prélevée à l’ouverture');
  const t1=P.tresorerie; repayLoans(); ok(P.tresorerie===t1,'jamais prélevée deux fois');
  ok(P.seasonSignals.some(x=>/Remboursement du prêt/.test(x.text)),'remboursement notifié');
}
// ——— 2. Capacité d'endettement : les annuités en cours réduisent la marge ———
{ const p=partie(); saison(); p.tresorerie=-300; startNewSeason(); p.tresorerie=TRESORERIE_CRITIQUE-1;
  p.loans=[{id:'x',season:gameState.season-1,amount:30,rate:0.05,years:10,annuity:loanOffer().capacity-0.5,paid:1}];
  const o=loanOffer(); ok(near(o.room,0.5),'marge restante');
  ok(!takeLoan(10,1).ok&&!loanCheck(o,10,10).ok,'nouveau prêt refusé au-delà de la capacité');
  ok(loanCheck(o,1,10).ok===(loanAnnuity(1,o.rate,10)<=0.5+1e-9),'petit prêt dans la marge');
  ok(loanFeasible()===(loanMaxAmount(o,10)>=o.needed),'faisabilité : montant minimal finançable sur 10 saisons');
  p.loans[0].annuity=o.capacity; ok(!loanFeasible(),'aucune hypothèse possible : bouton masqué');
  p.loans[0].annuity=0; p.tresorerie=TRESORERIE_CRITIQUE-80; ok(!loanFeasible(),'besoin supérieur à 60 M€ : bouton masqué');
}
// ——— 3. Faillite pendant les dilemmes : reprise au dilemme suivant ———
{ const p=partie(); gameState.seasonKickoffPending=false; gameState.mercatoPending=false;
  ok(gameState.dilemmaQueue.length>=2,'file de dilemmes');
  p.tresorerie=TRESORERIE_CRITIQUE-5;
  unDilemme();
  ok(gameState.step===8&&gameState.bankruptcy?.phase==='dilemma'&&gameState.currentDilemmaIndex===1,'faillite en cours de saison');
  p.tresorerie=TRESORERIE_CRITIQUE-1; ok(takeLoan(1,10).ok,'prêt signé (dans la capacité)');
  ok(gameState.step===6&&gameState.dilemmaPhase==='choosing'&&gameState.currentDilemmaIndex===1,'reprise au dilemme suivant');
  gameState.player.tresorerie+=200; saison(); ok(gameState.step===7,'saison menée à son terme');
}
// ——— 4. Faillite au dernier dilemme : la saison est close, reprise au bilan ———
{ const p=partie(); gameState.seasonKickoffPending=false; gameState.mercatoPending=false;
  while(gameState.currentDilemmaIndex<gameState.dilemmaQueue.length-1) unDilemme();
  p.tresorerie=TRESORERIE_CRITIQUE-80; unDilemme();
  ok(gameState.step===8&&gameState.bankruptcy?.phase==='close'&&gameState.history.some(h=>h.season===gameState.season),'saison close avant le dépôt de bilan');
  gameState.player.tresorerie=TRESORERIE_CRITIQUE-1; ok(takeLoan(1,10).ok,'prêt signé (dans la capacité)');
  ok(gameState.step===7,'reprise au bilan de la saison');
  startNewSeason(); ok(gameState.player.loans[0].paid===1,'annuité prélevée à l’ouverture suivante');
}
// ——— 5. Exclusions : autorisation retirée, mode Carrière ———
{ partie(); saison(); gameState.gameOverReason='arcom'; gameState.step=8; gameState.bankruptcy=null; ok(!loanOffer(),'aucun prêt pour un retrait d’autorisation');
  const p=partie(); saison(); p.tresorerie=-300; startNewSeason(); ok(loanOffer(),'prêt possible hors Carrière');
  gameState.career={status:'active'}; ok(!loanOffer(),'aucun prêt en mode Carrière'); delete gameState.career;
  resetGame(); ok(!gameState.bankruptcy&&!gameState.loanPanelOpen,'nouvelle partie sans dépôt de bilan en mémoire'); }
console.log('OK loan: bankruptcy at opening / during dilemmas / at close, amount and duration bounds, drawn rate stable on reload, 33 % debt capacity, resume where stopped, repayment at opening announced in commitments, exclusions');
`;
vm.runInNewContext(scripts.slice(0, -1).join('\n') + tests, { console, structuredClone, URLSearchParams }, { filename: 'audience-masters-loan.js' });
