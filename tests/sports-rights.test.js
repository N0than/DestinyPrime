'use strict';
// Enchères de droits sportifs : fréquence, sélection, moteur d'enchère, économie, audience,
// concurrence et compatibilité d'état (copie JSON de gameState).
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const tests = String.raw`
const assert=(v,m)=>{if(!v) throw Error(m)};
render=()=>{};
const demos={j1524:10,a2549:10,s50:10,csp:10};
const mk=(name,strategy='offensive',type='generaliste',budget=50)=>({name,type,target:'a2549',pda:{...demos},budget,contracts:{},slotAudienceDeltas:{},strategy,slotInvestments:{},strategyHistory:[]});
function setup(type='generaliste',seed=123456789){
  delete gameState.sportsRights;
  gameState.player=Object.assign(mk('Joueur','offensive',type),{grilleOverrides:{},talents:[],tresorerie:60,coutGrilleEngageSaison:0,coutTalentsSaison:0,achatsSaison:0,commercialSaison:0,
    eventsSeen:[],decisionHistory:[],popularite:50,puissanceCommerciale:1,revenusPubPrevisionnels:0,revenusPubFinals:0,regieRecettesSaison:0,pdaHistorySeason:[],pdaMoyenneSaison:0,pdaFinSaison:0});
  gameState.competitors=[mk('Off','offensive'),mk('Rent','rentable','culture',25),mk('Jeune','jeune','jeunesse'),mk('Prem','premium','sport'),mk('Autre','rentable','info',25)];
  gameState.season=1;gameState.competitorEvents=[];gameState.campaign={deadline:5,status:'active',seed:1,marketSeed:7};gameState.history=[];gameState.logs=[];gameState.seenDilemmaIds=[];
  gameState.step=6;gameState.dilemmaPhase='choosing';gameState.currentDilemmaIndex=0;
  gameState.sportsRights={owned:[],history:[],lastAuctionSeason:null,nextAuctionSeason:null,activeAuction:null,seed};
  ensureSportsRightsState();
}
const sr=()=>gameState.sportsRights;

// ---------- Fréquence ----------
setup();
assert([2,3].includes(sr().nextAuctionSeason),'first auction in season 2 or 3');
function calendar(seed){
  setup('generaliste',seed);const seasons=[];
  for(let s=1;s<=40;s++){gameState.season=s;if(sportsAuctionDue()){seasons.push(s);sr().lastAuctionSeason=s;sr().nextAuctionSeason=s+sportsChoice([2,3]);}}
  return seasons;
}
const cal=calendar(42);
assert(cal.length>=12&&cal.length<=20,'about one auction every 2-3 seasons: '+cal.length);
for(let i=1;i<cal.length;i++) assert([2,3].includes(cal[i]-cal[i-1]),'gap 2 or 3 seasons');
assert(new Set(cal).size===cal.length,'never two auctions in a season');
assert(JSON.stringify(calendar(42))===JSON.stringify(cal),'same seed, same calendar');
// Copie / rechargement de l'état : même échéance et même suite de tirages.
setup('generaliste',99);const snapshot=JSON.stringify(gameState.sportsRights);const a1=[sportsChoice([2,3]),sportsChoice([2,3]),sportsChoice([1,2,3,4])];
gameState.sportsRights=JSON.parse(snapshot);const a2=[sportsChoice([2,3]),sportsChoice([2,3]),sportsChoice([1,2,3,4])];
assert(JSON.stringify(a1)===JSON.stringify(a2)&&JSON.parse(snapshot).nextAuctionSeason===gameState.sportsRights.nextAuctionSeason,'reload keeps calendar');
// Ancienne partie sans état sportif : première enchère 1 ou 2 saisons plus tard.
setup();delete gameState.sportsRights;gameState.season=6;ensureCampaign();
assert([7,8].includes(gameState.sportsRights.nextAuctionSeason),'old game gets a delayed first auction');

// ---------- Sélection et file de la saison ----------
setup();
const seen=new Set();
for(let s=1;s<=60;s++){
  gameState.season=s;gameState.seenDilemmaIds=[];gameState.player.eventsSeen=[];gameState.player.lastRegieOpportunity=s;
  const q=pickDilemmaQueue();
  const auctions=q.filter(d=>d.type==='sports_rights_auction');
  assert(q.length===3,'still three dilemmas');
  assert(auctions.length<=1,'max one auction per season');
  if(auctions.length){
    assert(s===sr().nextAuctionSeason,'auction only on scheduled season');
    seen.add(auctions[0].rightsEventId);
    const last=[...sr().history].reverse()[0];
    if(last) assert(last.eventId!==auctions[0].rightsEventId,'no immediate repeat');
    // Résolution sans le joueur pour avancer le calendrier.
    gameState.dilemmaQueue=q;gameState.currentDilemmaIndex=1;startSportsRightsAuction(auctions[0].rightsEventId,auctions[0].id);
    sportsAuctionPass();recordSportsAuctionOutcome(auctions[0]);
  } else assert(!q.some(d=>SPORT_RIGHTS_DILEMMA_IDS.includes(d.id)),'auction dilemma never drawn normally');
}
assert(['roland_garros','world_cup','olympic_games'].every(id=>seen.has(id)),'every event can be selected: '+[...seen]);
// Chaîne Sport : ses dilemmes dédiés (d89, d145) sont préférés.
setup('sport');gameState.season=sr().nextAuctionSeason;const sq=pickDilemmaQueue().find(d=>d.type==='sports_rights_auction');
assert(sq&&(['d89','d145','d2'].includes(sq.id)),'sport channel auction dilemma');
// Un dilemme sport éditorial ou de production n'est pas converti.
['d79','d165','d20','d244','d76','d77','d92','d148'].forEach(id=>assert(!DILEMMA_BANK.find(d=>d.id===id).type,'not converted '+id));
assert(DILEMMA_BANK.find(d=>d.id==='d2').titre.includes('Coupe du monde'),'d2 rewritten as World Cup');

// ---------- Moteur d'enchère ----------
const ev=SPORT_RIGHTS_EVENTS.world_cup;
// Isole l'effet de l'enchère : recettes à jour et pas de réaction concurrente aléatoire.
function settle(){const p=gameState.player;p.revenusPubPrevisionnels=computeRevenusPub(getCalculatedPDAs().find(r=>r.channel===p).pda[p.target],p.target,p.popularite,p.puissanceCommerciale)+regieRevenueTotal(p);}
function auctionSetup(budgets){
  setup();seededRandom=()=>.999;gameState.competitors.forEach((c,i)=>c.budget=budgets[i]);
  const d=DILEMMA_BANK.find(x=>x.id==='d2');gameState.dilemmaQueue=[d,DILEMMA_BANK[0],DILEMMA_BANK[2]];gameState.currentDilemmaIndex=0;
  return startSportsRightsAuction('world_cup','d2');
}
// IA : profils et budgets façonnent les plafonds.
setup();
const off=computeCompetitorSportsMaxBid({...mk('A','offensive'),budget:200},ev),rent=computeCompetitorSportsMaxBid({...mk('B','rentable'),budget:200},ev);
assert(off>rent,'offensive bids higher than profitable');
const poor=computeCompetitorSportsMaxBid({...mk('C','offensive'),budget:10},ev);assert(poor<ev.reservePrice,'small budget cannot follow');
const young=computeCompetitorSportsMaxBid({...mk('D','jeune'),budget:200},ev),youngTennis=computeCompetitorSportsMaxBid({...mk('E','jeune'),budget:200},SPORT_RIGHTS_EVENTS.roland_garros);
assert(young/ev.estimatedValueMax>youngTennis/SPORT_RIGHTS_EVENTS.roland_garros.estimatedValueMax,'young profile prefers football');
// Passer : les IA se départagent ; le gagnant possède réellement les droits.
let a=auctionSetup([80,80,0,0,0]);a.rivals.forEach((r,i)=>{r.max=[20,17,0,0,0][i];r.status=r.max>=ev.reservePrice?'in':'out';});
sportsAuctionPass();assert(a.phase==='verdict'&&a.result.outcome==='declined'&&a.leader===0,'pass: rivals settle');
assert(a.result.price>=17&&a.result.price<=20,'second price plus increment');
assert(a.result.reveal.length===2&&a.result.reveal[0].amount===20,'pass reveals rival offers');
settle();let cash0=gameState.player.tresorerie;chooseDilemmaOption(0);
assert(gameState.player.tresorerie===cash0,'declined auction costs nothing');
assert(sr().owned.length===1&&sr().owned[0].ownerName==='Off'&&sr().owned[0].broadcastSeason===2,'competitor owns the right');
assert(gameState.competitors[0].budget===80-a.result.price,'competitor pays');
assert(sr().history.at(-1).result==='declined'&&sr().history.at(-1).winnerId==='Off','history declined');
// Exclusivité : un droit en cours n'est pas remis en vente.
assert(sportsRightBusy('world_cup')&&!selectNextSportsRightsEventIds().includes('world_cup'),'exclusive right not resold');
function selectNextSportsRightsEventIds(){const out=new Set();for(let i=0;i<30;i++){const p=selectNextSportsRightsEvent();if(p)out.add(p.event.id);}return [...out];}
// Offre unique sous pli : un seul tour ; gagner = un seul débit, aucune PDA, aucune recette.
const setMax=(a,maxes)=>a.rivals.forEach((r,i)=>{r.max=maxes[i];r.status=r.max>=ev.reservePrice?'in':'out';});
a=auctionSetup([80,80,0,0,0]);setMax(a,[15,13,0,0,0]);
sportsAuctionParticipate();assert(a.phase==='bidding'&&a.price===null&&a.leader===null,'single sealed round opens');
let gb=sportsGaugeBounds(a);assert(gb.min===ev.reservePrice&&gb.max>gb.estMax&&gb.canBid&&a.draft===gb.suggested&&gb.suggested>=gb.estMin&&gb.suggested<=gb.estMax,'gauge bounds and suggestion');
assert(sportsGaugeFeedback(a,gb.min).zone==='low'&&sportsGaugeFeedback(a,gb.estMax+1).zone==='high'&&sportsGaugeFeedback(a,gb.suggested).zone==='fair','gauge zones');
settle();const pdaBefore=getCalculatedPDAs().find(r=>r.channel===gameState.player).pda.a2549;
const revBefore=gameState.player.revenusPubPrevisionnels;
sportsAuctionSealedBid(18,true);
assert(a.phase==='verdict'&&a.result.outcome==='won','player wins in one round');
assert(a.result.price>15&&a.result.price<=18&&a.result.playerLastBid===18,'pays just above the second offer');
assert(a.result.reveal.length===3&&a.result.reveal[0].isPlayer&&a.result.reveal[1].amount===15&&a.result.reveal[2].amount===13,'sealed offers revealed in order');
cash0=gameState.player.tresorerie;const achats0=gameState.player.achatsSaison;
chooseDilemmaOption(0);
assert(Math.abs(gameState.player.tresorerie-(cash0-a.result.price))<1e-9,'rights debited once');
assert(Math.abs(gameState.player.achatsSaison-achats0-a.result.price)<1e-9,'counted as purchase');
assert(Math.abs(getCalculatedPDAs().find(r=>r.channel===gameState.player).pda.a2549-pdaBefore)<1e-9,'no PDA at acquisition');
assert(gameState.player.revenusPubPrevisionnels===revBefore,'no ad revenue at acquisition');
assert(gameState.lastConsequence.sportsAuction.outcome==='won'&&gameState.lastConsequence.sportsAuction.reveal.length===3&&gameState.currentDilemmaIndex===1,'continues the season');
assert(renderSportsVerdictInline(gameState.lastConsequence).includes('Ouverture des plis'),'verdict reveals the sealed offers');
assert(sr().owned.at(-1).ownerId==='player'&&sr().owned.at(-1).acquisitionPrice===a.result.price,'player owns the right');
chooseDilemmaOption(0);assert(sr().owned.filter(o=>o.ownerId==='player').length===1,'no double record');
// Défaite : l'offre la plus haute gagne et paie juste au-dessus de la nôtre.
a=auctionSetup([80,80,0,0,0]);setMax(a,[24,0,0,0,0]);
sportsAuctionParticipate();sportsAuctionSealedBid(20,true);assert(a.result.outcome==='lost'&&a.result.price>20&&a.result.price<=24&&a.result.playerLastBid===20,'lower offer loses');
// Égalité : le concurrent l'emporte.
a=auctionSetup([80,80,0,0,0]);setMax(a,[20,0,0,0,0]);
sportsAuctionParticipate();sportsAuctionSealedBid(20,true);assert(a.result.outcome==='lost'&&a.result.price===20,'tie goes to the rival');
// Offres concurrentes jamais exposées avant l'ouverture des plis.
a=auctionSetup([80,80,0,0,0]);setMax(a,[13.5,0,0,0,0]);sportsAuctionParticipate();
const zoneHtml=renderSportsAuctionZone(DILEMMA_BANK.find(x=>x.id==='d2'));
assert(zoneHtml.includes('data-sa-range')&&!zoneHtml.includes('13,5'),'gauge shown, rival offers sealed');
// Hors des bornes de la jauge : ignoré.
const sealedBefore=JSON.stringify(a);sportsAuctionSealedBid(sportsGaugeBounds(a).max+5,true);sportsAuctionSealedBid(ev.reservePrice-1,true);
assert(JSON.stringify(a)===sealedBefore,'out of range offer ignored');
// Se retirer.
a=auctionSetup([80,80,0,0,0]);setMax(a,[18,16,0,0,0]);
sportsAuctionParticipate();sportsAuctionWithdraw();assert(a.result.outcome==='withdrawn'&&a.leader===0&&a.result.reveal.length===2,'withdraw');
// Aucun intérêt IA : le joueur l'emporte au prix de départ.
a=auctionSetup([0,0,0,0,0]);assert(a.rivals.every(r=>r.status==='out'),'no rival interested');
sportsAuctionParticipate();sportsAuctionSealedBid(sportsGaugeBounds(a).suggested,true);assert(a.result.outcome==='won'&&a.result.price===ev.reservePrice,'win at reserve');
// Budget insuffisant : offre bloquée ; offre risquée : confirmation demandée.
a=auctionSetup([80,80,0,0,0]);setMax(a,[15,0,0,0,0]);
sportsAuctionParticipate();gameState.player.tresorerie=-50;
assert(!sportsGaugeBounds(a).canBid,'cannot bid without funds');
const before=JSON.stringify(a);sportsAuctionSealedBid(ev.reservePrice,true);assert(JSON.stringify(a)===before,'blocked bid ignored');
gameState.player.tresorerie=-40;gb=sportsGaugeBounds(a);assert(gb.canBid&&gb.max<sportsGaugeBounds(a).estMax*1.5&&playerCanAfford(gb.max)&&!playerCanAfford(gb.max+0.5),'gauge capped by treasury');
gameState.player.tresorerie=20;gb=sportsGaugeBounds(a);assert(sportsGaugeFeedback(a,gb.max).risky,'risky top of the gauge');
sportsAuctionSealedBid(gb.max);assert(a.pending&&a.pending.amount===gb.max&&a.phase==='bidding','risky offer asks confirmation');
sportsAuctionCancelPending();assert(!a.pending,'confirmation cancelled');
sportsAuctionSealedBid(gb.max);sportsAuctionSealedBid(a.pending.amount,true);assert(a.phase==='verdict'&&a.result.outcome==='won','confirmed risky offer');

// ---------- Diffusion la saison suivante ----------
setup();gameState.player.tresorerie=80;
const progA={id:'p-test',name:'Talk test',slot:'prime',format:'magazine',power:3,target:'a2549',annual:5,talent:'Équipe',talentAnnual:0,end:2,editorial:programEditorialProfile({name:'Talk test',channelType:'generaliste',slot:'prime'})};
gameState.player.contracts.prime={...progA,career:createProgramCareer(progA,'prime')};gameState.player.coutGrilleEngageSaison=5;
acquireSportsRight('world_cup',{owner:'player',price:18});
const rec=sr().owned.at(-1);
const s1=getCalculatedPDAs().find(r=>r.channel===gameState.player);
assert(!sportsBroadcastOn(gameState.player,'prime'),'not broadcast during acquisition season');
gameState.season=2;gameState.player.tresorerie=50;gameState.player.coutGrilleEngageSaison=5;gameState.player.achatsSaison=0;
const popBefore=gameState.player.popularite,factorBefore=sportsAdFactor();
activateSportsBroadcasts();
assert(rec.status==='broadcast'&&sportsBroadcastOn(gameState.player,'prime'),'broadcast next season on its slot');
assert(['access','prime','nuit'].every(k=>activeContract(gameState.player,k)?.isSportsEvent)&&!sportsBroadcastOn(gameState.player,'apresmidi'),'world cup preempts access, prime and night');
assert(gameState.player.contracts.prime.end===3&&gameState.player.contracts.prime.sportsPause===2,'program paused and extended');
assert(Math.abs(gameState.player.tresorerie-(50+5-ev.productionCost))<1e-9&&gameState.player.coutGrilleEngageSaison===0,'paused program free, production debited');
assert(gameState.player.achatsSaison===ev.productionCost,'production is a distinct cost');
assert(sportsAdFactor()>factorBefore&&gameState.player.popularite>popBefore,'attractiveness and popularity only on air');
const s2=getCalculatedPDAs().find(r=>r.channel===gameState.player);
assert(s2.slots.prime.a2549>s1.slots.prime.a2549&&Math.abs(s2.slots.matin.a2549-s1.slots.matin.a2549)<0.6,'audience gained on the event slot');
const fitPrime=calculateSportsEventAudience(ev,gameState.player,'prime',rec),fitNight=calculateSportsEventAudience(SPORT_RIGHTS_EVENTS.olympic_games,gameState.player,'nuit',rec);
assert(fitPrime.a2549!==fitPrime.csp,'impact differs by target');
assert(calculateSportsEventAudience(SPORT_RIGHTS_EVENTS.olympic_games,gameState.player,'prime',rec).a2549>fitNight.a2549,'impact differs by slot');
// Bilan : performance mesurée avec / sans l'événement.
evaluateSportsBroadcasts();assert(rec.perf&&rec.perf.pdaGain>0&&rec.perf.revenueGain>0&&rec.status==='done','broadcast evaluated');
assert(renderSportsRightsBilanHtml().includes(rec.perf.verdict),'season report shows verdict');
// Saison suivante : le programme reprend et son coût revient dans la grille.
gameState.season=3;restorePausedPrograms();assert(gameState.player.coutGrilleEngageSaison===5&&!gameState.player.contracts.prime.sportsPause,'program resumes');
assert(!sportsBroadcastOn(gameState.player,'prime'),'event over');
// Droit gagné par un concurrent : diffusé sur sa chaîne.
setup();acquireSportsRight('olympic_games',{owner:gameState.competitors[0],price:15});gameState.season=2;activateSportsBroadcasts();
assert(activeContract(gameState.competitors[0],'apresmidi')?.isSportsEvent&&!sportsBroadcastOn(gameState.player,'apresmidi'),'competitor broadcasts its right');
// Bilan : aucun bloc « Marché des droits » sans droit diffusé ni à venir.
setup();assert(renderSportsRightsBilanHtml()==='','no rights card without rights');
// Concurrent vainqueur : grille de la saison suivante, audiences et budget.
setup();seededRandom=()=>.999;planCompetitorSeasons();
const rv=gameState.competitors[0];rv.contracts.prime.end=3;const pausedName=rv.contracts.prime.name;
rv.budget=50;acquireSportsRight('world_cup',{owner:rv,price:20});assert(rv.budget===30,'competitor pays the rights at acquisition');
gameState.season=2;rv.budget=1;planCompetitorSeasons();
assert(rv.plan.slots.prime.tag==='evenement'&&rv.plan.slots.prime.isSportsEvent&&rv.plan.slots.prime.level===3,'event planned on the competitor prime');
assert(rv.contracts.prime.name===pausedName&&rv.contracts.prime.sportsPause===2&&rv.contracts.prime.end===4,'competitor program paused and extended');
const offView=competitorView(rv).find(v=>v.slot==='prime');assert(offView.name==='Coupe du monde'&&offView.icon&&offView.pausedName===pausedName,'competitor grid shows the event');
const wcSlots=SPORT_RIGHTS_EVENTS.world_cup.preferredSlots;
assert(wcSlots.every(k=>rv.plan.slots[k].tag==='evenement')&&Object.keys(rv.plan.slots).filter(k=>!wcSlots.includes(k)).every(k=>rv.plan.slots[k].tag!=='evenement'),'event slots preempted, other slots planned normally');
rv.budget=10;activateSportsBroadcasts();assert(rv.budget===10-SPORT_RIGHTS_EVENTS.world_cup.productionCost,'competitor pays production on air');
const offRec=sr().owned.find(o=>o.ownerName==='Off');
const offPrime=()=>getCalculatedPDAs().find(r=>r.channel===rv).slots.prime[rv.target];
const playerPrime=()=>getCalculatedPDAs().find(r=>r.channel===gameState.player).slots.prime[gameState.player.target];
const withEv=offPrime(),playerWith=playerPrime();offRec.suppressed=true;const withoutEv=offPrime(),playerWithout=playerPrime();delete offRec.suppressed;
assert(withEv>withoutEv+1&&playerWith<playerWithout,'competitor event lifts its audience and weighs on the player');
assert(sportsAdFactor(rv)>1&&sportsAdFactor(gameState.player)===1,'commercial attractiveness only for the broadcaster');
assert(computeMarketWeather().items[0].title.includes('Off'),'market weather announces the competitor event');
const budgetBefore=rv.budget;evaluateSportsBroadcasts();
assert(offRec.status==='done'&&offRec.perf.pdaGain>0&&offRec.perf.revenueGain>0&&offRec.perf.playerImpact<0,'competitor broadcast evaluated');
assert(Math.abs(rv.budget-budgetBefore-offRec.perf.revenueGain)<1e-9,'extra revenue credited to the competitor budget');
assert(renderSportsRightsBilanHtml().includes('CONCURRENT'),'season report shows the competitor broadcast');
const budgetAfter=rv.budget;evaluateSportsBroadcasts();assert(rv.budget===budgetAfter,'competitor revenue credited once');
gameState.season=3;rv.budget=50;planCompetitorSeasons();
assert(rv.plan.slots.prime.tag!=='evenement'&&!activeContract(rv,'prime')?.isSportsEvent,'event over for the competitor');
assert(rv.plan.slots.prime.name===pausedName||rv.contracts.prime.end>=3,'paused competitor program resumes');
console.log('OK sports rights: frequency, selection, auction, economy, broadcast, competitors, state');
`;
const source = scripts.slice(0, -1).join('\n') + '\n' + tests;
vm.runInNewContext(source, { console }, { filename: 'audience-masters-sports-rights.js' });
