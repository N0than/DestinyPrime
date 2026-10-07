'use strict';
// Rachat d'un programme concurrent (mécanique v2) : public transféré = max(0, PDA vendeur −
// PDA habituelle chez l'acheteur) × taux du statut × compatibilité × talent ; la PDA
// d'arrivée devient la PDA effective après normalisation ; application unique, acquis
// conservé et évolution normale ensuite ; prévisualisation identique au réel.
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const tests = String.raw`
const ok=(v,m)=>{if(!v) throw Error(m)};
const near=(a,b,e=1e-6)=>Math.abs(a-b)<e;
render=()=>{};
const cfg=GAME_BALANCE.programTransfer;
const rowOf=ch=>getCalculatedPDAs().find(r=>r.channel===ch);
const share=(slot='prime',t)=>{const p=gameState.player;return rowOf(p).slots[slot][t||p.target];};

// Partie neuve : programme généraliste du prime placé chez un concurrent, avec son statut.
function scenario({ seasonsCount=2, historic=false, target='a2549', talent=null, slot='prime' }={}) {
  resetGame(); const p=gameState.player; p.name='Acheteur'; p.type='generaliste'; p.target='a2549';
  finalizeChannelSetup(); launchFirstSeason();
  gameState.seasonKickoffPending=false; gameState.mercatoPending=false; p.tresorerie=500;
  gameState.step=6; gameState.dilemmaPhase='choosing'; gameState.currentDilemmaIndex=0;
  const prog=PROGRAM_CATALOG.filter(x=>x.channelType==='generaliste'&&x.slot===slot&&x.target===target&&x.years>=2
    &&!programHolder(x)&&!sameProgram(p.contracts[slot],x)).sort((a,b)=>b.power-a.power)[0];
  const seller=gameState.competitors[0];
  seller.contracts[slot]=makeCompetitorContract(seller,prog,slot,3,{seasonsCount});
  if(historic) seller.contracts[slot].career.historic=true;
  if(talent) seller.contracts[slot].talent=talent;
  return { p, prog, seller, slot };
}
// Remet le transfert en attente (même rachat) avec une PDA vendeur imposée.
function rearm(k, sellerPda, extra={}){ k.transfer={...k.transfer,applied:false,acquired:undefined,view:undefined,sellerPda,...extra}; }

// ---------- Rachat réel : instantané, grilles, finances, normalisation ----------
let { p, prog, seller } = scenario();
const sellerPdaBefore=slotPdaByTarget(seller,'prime');
const cash0=p.tresorerie, revBefore=p.revenusPubPrevisionnels;
const quote=quoteProgram('prime',prog.id,'interne');
ok(quote.holder&&quote.buyout>0,'held programme quoted with buyout');
const stateBefore=JSON.stringify(gameState), playerRef=gameState.player;
const pv=previewProgramBuyout('prime',prog.id,'interne');
ok(JSON.stringify(gameState)===stateBefore&&gameState.player===playerRef,'preview leaves finances, grids and state untouched');
ok(signProgram('prime',prog.id,'interne'),'buyout signed');
const c=p.contracts.prime, tr=c.transfer, T=p.target;
ok(tr.version===2&&tr.applied&&tr.programId===prog.id&&tr.sellerName===seller.name&&tr.slot==='prime'&&tr.signatureSeason===gameState.season&&tr.firstBroadcastSeason===gameState.season,'snapshot and state saved');
ok(AUDIENCE_DEMOS.every(t=>near(tr.sellerPda[t],sellerPdaBefore[t],1e-9)),'last seller PDA before the buyout');
ok(c.id===prog.id&&seller.contracts.prime.id!==prog.id&&!programHolder(prog),'same slot at the buyer, seller replaced');
ok(near(p.tresorerie,cash0-quote.recurring-quote.finance.purchase+(p.revenusPubPrevisionnels-revBefore)),'existing financial rules, ad revenue delta only');
AUDIENCE_DEMOS.forEach(t=>{const v=tr.view[t];
  ok(near(v.transferred,Math.max(0,v.sellerPda-v.habitual)*tr.effectiveRate,1e-9)&&near(v.arrival,v.habitual+v.transferred,1e-9),'formula '+t);
  ok(near(share('prime',t),v.arrival,1e-6),'arrival is the effective PDA after normalisation '+t);});
ok(near(pv.sellerPda,tr.view[T].sellerPda,1e-9)&&near(pv.habitual,tr.view[T].habitual,1e-9)&&near(pv.transferred,tr.view[T].transferred,1e-9)&&near(pv.arrival,tr.view[T].arrival,1e-9),'preview matches the real buyout');

// ---------- Cas de référence : 18,3 % chez le vendeur, 4,03 % habituels chez l'acheteur ----------
// PDA habituelle calée à 4,03 % (assise de la chaîne), PDA vendeur fixée à 18,3 %.
function calibrate(k){
  rearm(k,{j1524:null,a2549:null,s50:null,csp:null});k.transfer.applied=true;k.transfer.acquired={};
  let lo=0,hi=p.pda[T]*4||40;for(let i=0;i<80;i++){const mid=(lo+hi)/2;p.pda[T]=mid;if(share('prime',T)>4.03)hi=mid;else lo=mid;}p.pda[T]=(lo+hi)/2;
}
for (const [status,expT,expA] of [['lancement',3.5675,7.5975],['croissance',7.135,11.165],['franchise historique',10.7025,14.7325]]) {
  ({ p, prog, seller } = scenario()); signProgram('prime',prog.id,'interne'); const k=p.contracts.prime;
  calibrate(k); ok(near(share('prime',T),4.03,1e-6),'habitual 4.03 %');
  const others=getAllChannels().filter(ch=>ch!==p), eBefore=others.map(ch=>rowOf(ch).expectedSlots.prime[T]);
  const otherSlots=()=>JSON.stringify(getAllChannels().map(ch=>['matin','apresmidi','access','nuit'].map(sl=>rowOf(ch).slots[sl][T].toFixed(9))));
  const slotsBefore=otherSlots();
  rearm(k,{j1524:18.3,a2549:18.3,s50:18.3,csp:18.3},{careerStatus:status,talent:null});
  ok(programTransferRate(k,k.transfer).compatibilityFactor===1,'strong compatibility');
  ok(applyProgramTransfer('prime'),'applied '+status);
  const v=k.transfer.view[T];
  ok(near(v.gap,14.27,1e-6)&&near(v.transferred,expT,1e-6)&&near(v.arrival,expA,1e-6),status+' : +'+expT+' → '+expA);
  ok(near(share('prime',T),expA,1e-5),status+' : effective PDA after normalisation '+share('prime',T));
  // Redistribution : les autres acteurs (vendeur compris) gardent leurs proportions, total 100 %.
  const eAfter=others.map(ch=>rowOf(ch).expectedSlots.prime[T]);
  const ratios=eAfter.map((e,i)=>e/eBefore[i]);
  ok(ratios.every(r=>near(r,ratios[0],1e-9))&&ratios[0]<1,'others scaled proportionally, seller not penalised twice');
  ok(near(getAllChannels().reduce((s,ch)=>s+rowOf(ch).expectedSlots.prime[T],0),100,1e-9),'total audience kept');
  ok(otherSlots()===slotsBefore,'other slots untouched, no extra lead-in effect');
}

// ---------- Coefficients, écart nul, données absentes ----------
({ p, prog, seller } = scenario()); signProgram('prime',prog.id,'interne'); let k=p.contracts.prime;
for (const [status,rate] of [['lancement',0.25],['croissance',0.5],['maturité',0.5],['usure',0.5],['franchise historique',0.75]])
  ok(programTransferRate(k,{careerStatus:status}).rate===rate,'rate '+status);
ok(programTransferCompatibility({editorial:{genre:'fiction'},target:'a2549'},{type:'generaliste',target:'a2549'}).factor===1,'strong x1');
ok(programTransferCompatibility({editorial:{genre:'fiction'},target:'j1524'},{type:'generaliste',target:'a2549'}).factor===0.75,'medium x0.75 (off target)');
ok(programTransferCompatibility({editorial:{genre:'fiction'},target:'a2549'},{type:'culture',target:'a2549'}).factor===0.75,'medium x0.75 (partial genre)');
ok(programTransferCompatibility({editorial:{genre:'fiction'},target:'j1524'},{type:'culture',target:'a2549'}).factor===0.5,'weak x0.5');
ok(programTransferRate(k,{careerStatus:'croissance',talent:'Léa Martin'}).talentFactor===0.8,'talent not kept x0.8');
ok(programTransferRate({...k,talent:'Léa Martin'},{careerStatus:'croissance',talent:'Léa Martin'}).talentFactor===1,'talent kept x1');
ok(programTransferRate(k,{careerStatus:'croissance',talent:null}).talentFactor===1,'no talent x1');
ok(near(programTransferRate({...k,target:'j1524'},{careerStatus:'franchise historique',talent:'X'}).effective,0.75*0.75*0.8,1e-12),'effective rate = status x compatibility x talent');
const hab=()=>{rearm(k,{j1524:null,a2549:null,s50:null,csp:null});applyProgramTransfer('prime');return share('prime',T);};
const h0=hab();
rearm(k,{j1524:h0-1,a2549:h0-1,s50:h0-1,csp:h0-1});applyProgramTransfer('prime');
ok(k.transfer.view[T].transferred===0&&near(share('prime',T),h0,1e-9),'non-positive gap: no transfer, no penalty');
rearm(k,{j1524:null,a2549:NaN,s50:null,csp:undefined});applyProgramTransfer('prime');
ok(AUDIENCE_DEMOS.every(t=>k.transfer.view[t].transferred===0)&&near(share('prime',T),h0,1e-9),'no reliable seller PDA: habitual potential kept');
({ p, prog, seller } = scenario());
acquireSportsRight('world_cup',{owner:seller,price:1});const ev=gameState.sportsRights.owned.at(-1);ev.broadcastSeason=gameState.season;ev.status='broadcast';
ok(AUDIENCE_DEMOS.every(t=>snapshotProgramTransfer(programHolder(prog)||{competitor:seller,slot:'prime',contract:seller.contracts.prime}).sellerPda[t]===null),'event on the seller slot: PDA not reliable');

// ---------- Non-cumul, paiements, recettes ----------
({ p, prog, seller } = scenario()); signProgram('prime',prog.id,'interne');
const s0=share(), acq0=JSON.stringify(p.contracts.prime.transfer.acquired), cash1=p.tresorerie, rev1=p.revenusPubPrevisionnels;
for(let i=0;i<3;i++){getCalculatedPDAs();applyPendingProgramTransfers();applyProgramTransfer('prime');reevaluateAdRevenue();}
ok(near(share(),s0)&&JSON.stringify(p.contracts.prime.transfer.acquired)===acq0,'no accumulation after recalculations');
ok(near(p.tresorerie,cash1)&&near(p.revenusPubPrevisionnels,rev1),'recalculations credit nothing more');
ok(!signProgram('prime',prog.id,'interne')&&near(p.tresorerie,cash1),'no double confirmation or payment');

// ---------- Saison suivante : acquis conservé, évolution normale, renouvellement ----------
getAllChannels().forEach(ch=>{ch.slotInvestments={};(ch.talents||[]).forEach(t=>{t.until=99;});Object.values(ch.contracts||{}).forEach(x=>{x.end=Math.max(x.end,99);});});
const sEnd=share();
gameState.season++;
ok(near(share(),sEnd,1e-9)&&JSON.stringify(p.contracts.prime.transfer.acquired)===acq0,'season 2 starts from the season-1 PDA, transfer kept');
applyPendingProgramTransfers();ok(near(share(),sEnd,1e-9),'no recalculation at season change');
evolveProgramCareers();ok(!near(share(),sEnd,1e-6)&&JSON.stringify(p.contracts.prime.transfer.acquired)===acq0,'normal evolution from the acquired audience');
const keep=JSON.stringify(p.contracts.prime.transfer);applyCareerDilemmaChoice({careerSlot:'prime',programId:prog.id},{careerAction:'renew'});
ok(JSON.stringify(p.contracts.prime.transfer)===keep,'renewal: no new transfer');
// Saison complète réelle.
({ p, prog, seller } = scenario()); signProgram('prime',prog.id,'interne');const acqA=JSON.stringify(p.contracts.prime.transfer.acquired);
while(gameState.step===6){if(gameState.dilemmaPhase==='result')continueAfterConsequence();else{const d=gameState.dilemmaQueue[gameState.currentDilemmaIndex];if(d.type==='sports_rights_auction'){startSportsRightsAuction(d.rightsEventId,d.id);sportsAuctionPass();}chooseDilemmaOption(0);}}
gameState.renewalDue=false;startNewSeason();
ok(p.contracts.prime?.id===prog.id&&p.contracts.prime.transfer.applied&&JSON.stringify(p.contracts.prime.transfer.acquired)===acqA,'full season change keeps the acquired audience');

// ---------- Retrait : aucune contribution résiduelle ----------
({ p, prog, seller } = scenario()); const deltas0=JSON.stringify(p.slotAudienceDeltas||{}); signProgram('prime',prog.id,'interne');
const other=availablePrograms('generaliste','prime').find(x=>x.id!==prog.id&&!programHolder(x));
ok(signProgram('prime',other.id,'interne')&&!p.contracts.prime.transfer,'replacement carries no transfer');
ok(!JSON.stringify({...p,contracts:null}).includes('"acquired"')&&JSON.stringify(p.slotAudienceDeltas||{})===deltas0,'no points left on the slot or the channel');

// ---------- Activation différée ----------
({ p, prog, seller } = scenario());
acquireSportsRight('world_cup',{owner:'player',price:1});const rec=gameState.sportsRights.owned.at(-1);rec.broadcastSeason=gameState.season;rec.status='broadcast';
const sellerSnap=slotPdaByTarget(seller,'prime'); // dernière diffusion chez le vendeur, juste avant le rachat
ok(signProgram('prime',prog.id,'interne')&&!p.contracts.prime.transfer.applied,'pending while the slot is preempted');
ok(previewProgramBuyout('prime',prog.id,'interne')===null,'no preview once bought');
gameState.season++;closeSportsBroadcasts();
ok(applyPendingProgramTransfers()===1&&p.contracts.prime.transfer.firstBroadcastSeason===gameState.season,'applied at the first effective broadcast');
ok(AUDIENCE_DEMOS.every(t=>near(p.contracts.prime.transfer.sellerPda[t],sellerSnap[t],1e-9)),'last broadcast PDA before the transfer');
ok(near(share(),p.contracts.prime.transfer.view[p.target].arrival,1e-6)&&applyPendingProgramTransfers()===0,'arrival reached once');

// ---------- Sauvegardes ----------
({ p, prog, seller } = scenario()); signProgram('prime',prog.id,'interne');const sSave=share();
p.contracts=JSON.parse(JSON.stringify(p.contracts));
ok(!applyProgramTransfer('prime')&&near(share(),sSave,1e-9)&&p.contracts.prime.transfer.version===2,'reload: no re-application, acquired kept');
// Ancienne mécanique (v1) : audience acquise préservée, pas de nouveau calcul.
const v1={programId:prog.id,applied:true,acquired:{j1524:0.1,a2549:0.5,s50:0.1,csp:0.1},sellerContribution:{a2549:1.3}};
p.contracts.prime.transfer=v1;const sV1=share();applyPendingProgramTransfers();
ok(p.contracts.prime.transfer===v1&&near(share(),sV1,1e-12),'old save: acquired audience preserved');
p.contracts.prime.transfer={programId:prog.id,applied:false,sellerContribution:{a2549:5}};applyProgramTransfer('prime');
ok(p.contracts.prime.transfer.applied&&!Object.values(p.contracts.prime.transfer.acquired).some(v=>v>0),'old pending transfer: no retroactive calculation');
delete p.contracts.prime.transfer;ok(applyPendingProgramTransfers()===0,'contract without transfer: nothing attributed');
console.log('OK program transfer v2: reference case, rates, coefficients, gap, no data, slot, redistribution, preview, no accumulation, deferred, season 2, evolution, removal, saves, payments');
`;
const source = scripts.slice(0, -1).join('\n') + '\n' + tests;
vm.runInNewContext(source, { console }, { filename: 'audience-masters-program-transfer.js' });
