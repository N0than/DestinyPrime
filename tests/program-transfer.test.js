'use strict';
// Rachat d'un programme concurrent : transfert de public (taux selon le statut de carrière,
// compatibilité, talent, plafond initial unique), application à la première diffusion,
// audience acquise conservée et évolution normale ensuite, sauvegardes et non-cumul.
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const tests = String.raw`
const ok=(v,m)=>{if(!v) throw Error(m)};
const near=(a,b,e=1e-6)=>Math.abs(a-b)<e;
render=()=>{};
const cfg=GAME_BALANCE.programTransfer;
const share=(slot='prime',t)=>{const p=gameState.player;return getCalculatedPDAs().find(r=>r.channel===p).slots[slot][t||p.target];};
const ownNoTransfer=(c,t)=>{const tr=c.transfer;c.transfer=null;const v=programOwnContribution(c,t);c.transfer=tr;return v;};

// Partie neuve : programme généraliste du prime placé chez un concurrent, avec son statut.
function scenario({ seasonsCount=2, historic=false, target='a2549', talent=null, slot='prime' }={}) {
  resetGame(); const p=gameState.player; p.name='Acheteur'; p.type='generaliste'; p.target='a2549';
  finalizeChannelSetup(); launchFirstSeason();
  gameState.seasonKickoffPending=false; gameState.mercatoPending=false; p.tresorerie=500;
  gameState.step=6; gameState.dilemmaPhase='choosing'; gameState.currentDilemmaIndex=0;
  const prog=PROGRAM_CATALOG.find(x=>x.channelType==='generaliste'&&x.slot===slot&&x.target===target&&x.years>=2
    &&!programHolder(x)&&!sameProgram(p.contracts[slot],x));
  const seller=gameState.competitors[0];
  seller.contracts[slot]=makeCompetitorContract(seller,prog,slot,2,{seasonsCount});
  if(historic) seller.contracts[slot].career.historic=true;
  if(talent) seller.contracts[slot].talent=talent;
  return { p, prog, seller, slot };
}

// ---------- Rachat : instantané, grilles, transfert ----------
let { p, prog, seller } = scenario();
const sellerContract=seller.contracts.prime;
const expectedSeller=Object.fromEntries(AUDIENCE_DEMOS.map(t=>[t,programOwnContribution(sellerContract,t)]));
const deltasBefore=JSON.stringify(p.slotAudienceDeltas||{});
const cash0=p.tresorerie, revBefore=p.revenusPubPrevisionnels;const quote=quoteProgram('prime',prog.id,'interne');
ok(quote.holder&&quote.buyout>0,'held programme quoted with buyout');
ok(signProgram('prime',prog.id,'interne'),'buyout signed');
const c=p.contracts.prime, tr=c.transfer;
// Règles financières inchangées : droits + rachat + écart de grille, puis seul l'écart de recettes.
ok(near(p.tresorerie,cash0-quote.recurring-quote.finance.purchase+(p.revenusPubPrevisionnels-revBefore)),'buyout paid once, ad revenue delta only');
// Instantané pris avant la grille du vendeur.
ok(tr&&tr.programId===prog.id&&tr.sellerName===seller.name&&tr.slot==='prime'&&tr.careerStatus==='croissance'&&tr.transferSeason===gameState.season,'snapshot kept');
ok(AUDIENCE_DEMOS.every(t=>near(tr.sellerContribution[t],expectedSeller[t],1e-3)),'seller own contribution, not slot audience');
// Grilles : le créneau d'origine est conservé ; le vendeur a remplacé son programme.
ok(c.id===prog.id&&tr.slot==='prime'&&seller.contracts.prime.id!==prog.id&&!programHolder(prog),'slot kept, seller replaced');
ok(JSON.stringify(p.slotAudienceDeltas||{})===deltasBefore,'no channel-level points added');
// Transfert appliqué à la première diffusion (immédiate) : formule et plafond par cible.
ok(tr.applied&&tr.firstBroadcastSeason===gameState.season&&tr.category==='installe'&&tr.rate===0.5,'installed programme: 50 %');
AUDIENCE_DEMOS.forEach(t=>{
  const usual=ownNoTransfer(c,t), seller=tr.sellerContribution[t];
  const expected=seller>0&&usual>0?Math.min(seller*tr.rate*tr.compatibilityFactor*tr.talentFactor,usual*cfg.initialCapShare):0;
  ok(near(tr.acquired[t],expected,2e-3)&&near(tr.habitual[t],usual,2e-3),'formula and initial cap '+t);
  ok(near(programOwnContribution(c,t),usual+tr.acquired[t],1e-9),'acquired audience joins the programme base '+t);
});
ok(tr.acquired[p.target]>0,'positive transfer on the target');

// ---------- Taux 25 / 50 / 75 % et coefficients ----------
for (const [opts,cat,rate] of [[{seasonsCount:0},'recent',0.25],[{seasonsCount:1},'recent',0.25],[{seasonsCount:3},'installe',0.5],[{seasonsCount:2,historic:true},'culte',0.75]]) {
  ({ p, prog, seller } = scenario(opts)); ok(signProgram('prime',prog.id,'interne'),'sign '+cat);
  const t=p.contracts.prime.transfer; ok(t.category===cat&&t.rate===rate,'rate '+cat+' '+rate);
}
// Taux isolé sans plafond : apport vendeur unitaire, compatibilité forte, sans talent.
for (const [status,rate] of [['lancement',0.25],['croissance',0.5],['maturité',0.5],['usure',0.5],['franchise historique',0.75]]) {
  ({ p, prog, seller } = scenario()); signProgram('prime',prog.id,'interne');
  const k=p.contracts.prime;k.transfer={...k.transfer,applied:false,careerStatus:status,talent:null,sellerContribution:{j1524:0.1,a2549:0.1,s50:0.1,csp:0.1}};
  ok(applyProgramTransfer('prime')&&near(k.transfer.acquired.a2549,0.1*rate*1,1e-3),'uncapped rate '+status);
}
// Compatibilité : seuils centralisés, genre × cible.
ok(programTransferCompatibility({editorial:{genre:'fiction'},target:'a2549'},{type:'generaliste',target:'a2549'}).factor===1,'strong compatibility x1');
ok(programTransferCompatibility({editorial:{genre:'fiction'},target:'j1524'},{type:'generaliste',target:'a2549'}).factor===0.75,'medium compatibility x0.75 (off target)');
ok(programTransferCompatibility({editorial:{genre:'fiction'},target:'a2549'},{type:'culture',target:'a2549'}).factor===0.75,'medium compatibility x0.75 (partial genre)');
ok(programTransferCompatibility({editorial:{genre:'fiction'},target:'j1524'},{type:'culture',target:'a2549'}).factor===0.5,'weak compatibility x0.5');
ok(programTransferCompatibility({editorial:{genre:'sport'},target:'a2549'},{type:'info',target:'a2549'}).factor===0.5,'weak compatibility (genre)');
// Talent : conservé x1, non conservé x0,8, sans talent x1 ; aucun recrutement automatique.
({ p, prog, seller } = scenario({ talent:'Léa Martin' })); signProgram('prime',prog.id,'interne');
ok(p.contracts.prime.transfer.talent==='Léa Martin'&&p.contracts.prime.transfer.talentFactor===0.8&&p.contracts.prime.talent!=='Léa Martin','talent not kept x0.8, not recruited');
const k2=p.contracts.prime;k2.talent='Léa Martin';k2.transfer={...k2.transfer,applied:false};applyProgramTransfer('prime');
ok(k2.transfer.talentFactor===1,'talent kept x1');
({ p, prog, seller } = scenario()); signProgram('prime',prog.id,'interne');ok(p.contracts.prime.transfer.talentFactor===1,'no talent x1');

// ---------- Plafond initial unique, données inexploitables ----------
({ p, prog, seller } = scenario()); signProgram('prime',prog.id,'interne');
let k=p.contracts.prime;k.transfer={...k.transfer,applied:false,sellerContribution:{j1524:100,a2549:100,s50:100,csp:100}};applyProgramTransfer('prime');
ok(AUDIENCE_DEMOS.every(t=>near(k.transfer.acquired[t],ownNoTransfer(k,t)*0.5,2e-3)),'cap = 50 % of the usual contribution');
const capped=k.transfer.acquired.a2549;
k.career.awareness+=40;k.career.potential+=2; // le programme progresse ensuite
ok(!applyProgramTransfer('prime')&&k.transfer.acquired.a2549===capped&&programOwnContribution(k,'a2549')>ownNoTransfer(k,'a2549')+capped-1e-9,'cap not reapplied on later evolution');
k.transfer={...k.transfer,applied:false,sellerContribution:{j1524:null,a2549:NaN,s50:-3,csp:0}};applyProgramTransfer('prime');
ok(AUDIENCE_DEMOS.every(t=>k.transfer.acquired[t]===0),'no usable or non-positive seller data: no transfer');
k.transfer={...k.transfer,applied:false,sellerContribution:{j1524:5,a2549:5,s50:5,csp:5}};k.power=-20;applyProgramTransfer('prime');
ok(AUDIENCE_DEMOS.every(t=>k.transfer.acquired[t]===0),'non-positive usual contribution at the buyer: no transfer');

// ---------- Non-cumul, recettes et paiements ----------
({ p, prog, seller } = scenario()); signProgram('prime',prog.id,'interne');
const s0=share(), acq0=JSON.stringify(p.contracts.prime.transfer.acquired), cash1=p.tresorerie, rev1=p.revenusPubPrevisionnels;
for(let i=0;i<3;i++){getCalculatedPDAs();applyPendingProgramTransfers();applyProgramTransfer('prime');reevaluateAdRevenue();}
ok(near(share(),s0)&&JSON.stringify(p.contracts.prime.transfer.acquired)===acq0,'no accumulation after recalculations');
ok(near(p.tresorerie,cash1)&&near(p.revenusPubPrevisionnels,rev1),'recalculations credit nothing more');
ok(!signProgram('prime',prog.id,'interne')&&near(p.tresorerie,cash1),'no double confirmation or payment');
// Sans transfert, le créneau serait plus bas : l'apport est bien compté, une seule fois.
const saved=p.contracts.prime.transfer;p.contracts.prime.transfer=null;const sNo=share();p.contracts.prime.transfer=saved;
ok(sNo<s0,'transfer raises the slot audience');

// ---------- Saison suivante : audience acquise conservée, évolution normale ----------
// Environnement figé (investissements ponctuels, talents et contrats datés des chaînes) pour isoler le programme.
getAllChannels().forEach(ch=>{ch.slotInvestments={};(ch.talents||[]).forEach(t=>{t.until=99;});Object.values(ch.contracts||{}).forEach(k=>{k.end=Math.max(k.end,99);});});
const ownEnd=programOwnContribution(p.contracts.prime,p.target);
const sEnd=share();                       // fin de première saison (ex. 10 % sur le créneau)
gameState.season++;                       // changement de saison, environnement inchangé
ok(near(programOwnContribution(p.contracts.prime,p.target),ownEnd)&&near(share(),sEnd)&&JSON.stringify(p.contracts.prime.transfer.acquired)===acq0&&p.contracts.prime.transfer.firstBroadcastSeason===gameState.season-1,'season 2 starts from the season-1 audience, transfer included');
applyPendingProgramTransfers();ok(near(share(),sEnd),'no re-application at season change');
const ownBefore=programOwnContribution(p.contracts.prime,p.target);evolveProgramCareers();
ok(!near(programOwnContribution(p.contracts.prime,p.target),ownBefore)&&JSON.stringify(p.contracts.prime.transfer.acquired)===acq0,'normal career evolution on top of the acquired audience');
// Renouvellement : aucun nouveau transfert.
const renewed=JSON.stringify(p.contracts.prime.transfer);applyCareerDilemmaChoice({careerSlot:'prime',programId:prog.id},{careerAction:'renew'});
ok(JSON.stringify(p.contracts.prime.transfer)===renewed,'renewal keeps the transfer as is');
// Saison complète réelle : le transfert reste appliqué une fois.
({ p, prog, seller } = scenario()); signProgram('prime',prog.id,'interne');const acqA=JSON.stringify(p.contracts.prime.transfer.acquired);
while(gameState.step===6){if(gameState.dilemmaPhase==='result')continueAfterConsequence();else{const d=gameState.dilemmaQueue[gameState.currentDilemmaIndex];if(d.type==='sports_rights_auction'){startSportsRightsAuction(d.rightsEventId,d.id);sportsAuctionPass();}chooseDilemmaOption(0);}}
gameState.renewalDue=false;startNewSeason();
ok(p.contracts.prime?.id===prog.id&&p.contracts.prime.transfer.applied&&JSON.stringify(p.contracts.prime.transfer.acquired)===acqA&&p.contracts.prime.transfer.firstBroadcastSeason===gameState.season-1,'full season change keeps the acquired audience');

// ---------- Retrait : aucune contribution résiduelle ----------
({ p, prog, seller } = scenario()); signProgram('prime',prog.id,'interne');
const other=availablePrograms('generaliste','prime').find(x=>x.id!==prog.id&&!programHolder(x));
ok(signProgram('prime',other.id,'interne')&&!p.contracts.prime.transfer,'replacement carries no transfer');
ok(!JSON.stringify({...p,contracts:null}).includes('"acquired"')&&JSON.stringify(p.slotAudienceDeltas||{})===deltasBefore,'no audience left attached to the channel');
ok(near(programOwnContribution(p.contracts.prime,p.target),ownNoTransfer(p.contracts.prime,p.target)),'no residual contribution after removal');

// ---------- Activation différée (case prise par un événement cette saison) ----------
({ p, prog, seller } = scenario());
acquireSportsRight('world_cup',{owner:'player',price:1});const rec=gameState.sportsRights.owned.at(-1);rec.broadcastSeason=gameState.season;rec.status='broadcast';
ok(signProgram('prime',prog.id,'interne')&&p.contracts.prime.transfer&&!p.contracts.prime.transfer.applied,'pending while the slot is preempted');
ok(programOwnContribution(p.contracts.prime,p.target)===ownNoTransfer(p.contracts.prime,p.target),'nothing counted before the first broadcast');
gameState.season++;closeSportsBroadcasts();ok(applyPendingProgramTransfers()===1&&p.contracts.prime.transfer.applied&&p.contracts.prime.transfer.firstBroadcastSeason===gameState.season,'applied at the first effective broadcast');
ok(applyPendingProgramTransfers()===0,'applied once');

// ---------- Sauvegardes ----------
({ p, prog, seller } = scenario()); signProgram('prime',prog.id,'interne');const sSave=share();
p.contracts=JSON.parse(JSON.stringify(p.contracts));
ok(!applyProgramTransfer('prime')&&near(share(),sSave)&&p.contracts.prime.transfer.applied,'reload: no re-application, acquired kept');
// Ancienne sauvegarde : contrats sans transfert, rien d'attribué rétroactivement.
delete p.contracts.prime.transfer;ok(applyPendingProgramTransfers()===0&&!p.contracts.prime.transfer,'old save: no retroactive transfer');
console.log('OK program transfer: rates, compatibility, talent, cap once, no data, grids, no accumulation, deferred, season 2, evolution, removal, saves, no double payment');
`;
const source = scripts.slice(0, -1).join('\n') + '\n' + tests;
vm.runInNewContext(source, { console }, { filename: 'audience-masters-program-transfer.js' });
