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
    const evA=SPORT_RIGHTS_EVENTS[auctions[0].rightsEventId];
    if(evA.recurring) assert(s>=sr().recurring[evA.id].nextAuctionSeason,'annual right auctioned on its own calendar');
    else {
      assert(s===sr().nextAuctionSeason,'auction only on scheduled season');
      const last=[...sr().history].reverse().find(h=>h.type==='sports_rights_auction'&&!SPORT_RIGHTS_EVENTS[h.eventId].recurring);
      if(last) assert(last.eventId!==auctions[0].rightsEventId,'no immediate repeat');
    }
    seen.add(auctions[0].rightsEventId);
    // Résolution sans le joueur pour avancer le calendrier.
    gameState.dilemmaQueue=q;gameState.currentDilemmaIndex=1;startSportsRightsAuction(auctions[0].rightsEventId,auctions[0].id);
    sportsAuctionPass();recordSportsAuctionOutcome(auctions[0]);
  } else assert(!q.some(d=>SPORT_RIGHTS_DILEMMA_IDS.includes(d.id)),'auction dilemma never drawn normally');
}
assert(['roland_garros','world_cup','olympic_games','f1','oscars','cannes','cesars','premiere_clair','saga','serie_phenomene'].every(id=>seen.has(id)),'every event can be selected: '+[...seen]);
assert(![...seen].some(id=>['emmys','golden_globes','venise','berlinale','deauville','series_mania'].includes(id)),'cinema-only events never offered to a generalist channel');

// ---------- Championnat du monde de F1 : droit annuel ----------
const f1=SPORT_RIGHTS_EVENTS.f1;
assert(f1.recurring&&f1.preferredSlots.join()==='apresmidi','F1 on the afternoon slot');
const d92=DILEMMA_BANK.find(d=>d.id==='d92');
assert(d92.type==='sports_rights_auction'&&d92.rightsEventId==='f1'&&!/vingt-quatre dimanches/.test(d92.titre),'old F1 dilemma replaced by the auction');
assert(!pickDilemmaQueue.toString().includes('d92'),'no hard-coded F1 dilemma');
// Première enchère F1 tirée au hasard dans les premières saisons.
const firsts=new Set();for(let k=1;k<=40;k++){setup('generaliste',1000+k);firsts.add(sr().recurring.f1.nextAuctionSeason);}
assert([...firsts].every(v=>v>=1&&v<=3)&&firsts.size>1,'first F1 auction in seasons 1-3: '+[...firsts]);
// Généraliste et Sport la reçoivent ; une seule enchère par saison, le marché ordinaire attend.
['generaliste','sport'].forEach(type=>{
  setup(type);gameState.season=sr().recurring.f1.nextAuctionSeason;sr().nextAuctionSeason=gameState.season;
  const q=pickDilemmaQueue();const auc=q.filter(d=>d.type==='sports_rights_auction');
  assert(auc.length===1&&auc[0].rightsEventId==='f1'&&sr().nextAuctionSeason===gameState.season+1,'F1 auction first, ordinary market postponed for '+type);
});
// Joueur gagnant : diffusion l'après-midi la saison suivante, puis reconduction au prix initial.
setup();seededRandom=()=>.999;gameState.season=2;sr().recurring.f1.nextAuctionSeason=2;
gameState.dilemmaQueue=[d92,DILEMMA_BANK[0],DILEMMA_BANK[2]];gameState.currentDilemmaIndex=0;
let fa=startSportsRightsAuction('f1','d92');fa.rivals.forEach((r,i)=>{r.max=[8,6,0,0,0][i];r.status=r.max>=f1.reservePrice?'in':'out';});
sportsAuctionParticipate();sportsAuctionSealedBid(10);assert(fa.result.outcome==='won'&&fa.result.price>8&&fa.result.price<=10,'player wins F1');
chooseDilemmaOption(0);
const f1rec=sr().owned.find(o=>o.eventId==='f1');
assert(f1rec.recurring&&f1rec.broadcastSeason===3&&f1rec.initialPrice===fa.result.price&&f1rec.slots.join()==='apresmidi','F1 right recorded');
assert(sr().recurring.f1.nextAuctionSeason===null&&sportsRightBusy('f1'),'F1 off the market while held');
gameState.season=3;gameState.seenDilemmaIds=[];gameState.player.eventsSeen=[];
const q3=pickDilemmaQueue();const ren=q3.at(-1);
assert(ren.isSportsRenewal&&ren.rightsEventId==='f1'&&ren.c[0].sportsRenewal==='renew'&&ren.c[0].finance.purchase===0&&ren.c[0].finance.recurring===0
  &&ren.c[0].pillLabel.includes(nf1(f1rec.initialPrice)),'renewal offered at the initial price, in the grid cost (no one-off purchase)');
assert(q3.length===3,'single right renewal replaces the last dilemma, like a program');
assert(!q3.some(d=>d.type==='sports_rights_auction'&&d.rightsEventId==='f1'),'no F1 auction while held');
activateSportsBroadcasts();assert(activeContract(gameState.player,'apresmidi')?.isSportsEvent&&!activeContract(gameState.player,'prime')?.isSportsEvent,'F1 airs in the afternoon');
// Choix seul (un dilemme suit encore) : la clôture de saison n'intervient pas ici.
gameState.dilemmaQueue=[ren,DILEMMA_BANK[0]];gameState.currentDilemmaIndex=0;gameState.dilemmaPhase='choosing';gameState.step=6;
settle();const achR=gameState.player.achatsSaison,gridR=gameState.player.coutGrilleEngageSaison,cashR=gameState.player.tresorerie;
const commitR=nextSeasonCommitment().annual;
chooseDilemmaOption(0);
const next=sr().owned.filter(o=>o.eventId==='f1'&&o.broadcastSeason===4);
assert(next.length===1&&next[0].ownerId==='player'&&next[0].acquisitionPrice===f1rec.initialPrice&&next[0].renewal,'renewed for next season at the initial price');
assert(gameState.player.achatsSaison===achR&&gameState.player.coutGrilleEngageSaison===gridR,'renewal is not a one-off purchase and leaves this season grid unchanged');
assert(Math.abs(nextSeasonCommitment().annual-commitR-f1rec.initialPrice)<1e-9&&nextSeasonCommitment().sports===f1rec.initialPrice,'renewal price added to next season grid');
// Ouverture de la saison de diffusion : le prix rejoint le coût de grille, une seule fois.
gameState.season=4;const g4=gameState.player.coutGrilleEngageSaison;rollSportsRightsIntoGrid();rollSportsRightsIntoGrid();
assert(gameState.player.coutGrilleEngageSaison===g4+f1rec.initialPrice&&sportsRightsGridAnnual()===f1rec.initialPrice,'renewed right in the grid cost of its broadcast season');
// Saison suivante : lâcher les droits, ils reviennent sur le marché plus tard.
const q4=pickDilemmaQueue();const ren4=q4.at(-1);assert(ren4.isSportsRenewal,'renewal offered again');
assert(ren4.desc.includes('après 2 saisons'),'seasons held shown');
assert(nextSeasonCommitment().expired>=f1rec.initialPrice&&nextSeasonCommitment().sports===0,'unrenewed right leaves next season grid');
applySportsRenewalChoice('f1','release');
assert([5,6].includes(sr().recurring.f1.nextAuctionSeason)&&!sr().owned.some(o=>o.eventId==='f1'&&o.broadcastSeason===5),'released right back on the market');
const g5=gameState.player.coutGrilleEngageSaison;gameState.season=5;rollSportsRightsIntoGrid();
assert(gameState.player.coutGrilleEngageSaison===g5-f1rec.initialPrice,'released right leaves the grid cost');gameState.season=4;
gameState.season=sr().recurring.f1.nextAuctionSeason;gameState.seenDilemmaIds=[];
assert(pickDilemmaQueue().some(d=>d.rightsEventId==='f1'),'F1 auctioned again later');
// Programme à reconduire en même temps : le droit rejoint les cartes de la grille.
{
  setup();gameState.season=3;acquireSportsRight('f1',{owner:'player',price:9});sr().owned[0].broadcastSeason=3;sr().recurring.f1.nextAuctionSeason=null;
  gameState.player.contracts={prime:{id:'pp',name:'Prime Show',annual:4,talentAnnual:0,power:2,target:'a2549',end:3}};
  gameState.player.coutGrilleEngageSaison=4;
  const gq=withRenewalDilemmas([DILEMMA_BANK[0],DILEMMA_BANK[1],DILEMMA_BANK[2]]);const gr=gq.at(-1);
  assert(gr.isGridRenewal&&gr.gridSports.length===1&&gr.gridSports[0].key==='sport:f1'&&!gq.some(d=>d.isSportsRenewal),'F1 card inside the grid renewal');
  assert(renewalDeck(gr).cards('sport:f1').length===2&&gridRenewalSummary(gr).includes('2 reconduits'),'F1 card choices, renewed by default');
  gr.picks={'sport:f1':1};
  const cc=buildGridRenewalCustomChoice(gr,gr.c[1]);
  assert(cc.sportsPicks[0].choice.sportsRenewal==='release'&&cc.finance.purchase===0&&gridRenewalSummary(gr).includes('1 lâché'),'custom pick releases the right');
  gr.picks={};
  gameState.dilemmaQueue=[gr,DILEMMA_BANK[0]];gameState.currentDilemmaIndex=0;gameState.dilemmaPhase='choosing';
  settle();const a0=gameState.player.achatsSaison;chooseDilemmaOption(0);
  assert(sr().owned.some(o=>o.eventId==='f1'&&o.broadcastSeason===4&&o.gridAnnual===9)&&gameState.player.achatsSaison===a0
    &&gameState.player.contracts.prime.end===4,'renew whole grid keeps the F1 right, priced in the grid');
  gameState.season=4;
}
// Chaîne IA détentrice : reconduction ou abandon selon budget et profil.
setup();gameState.season=3;const ai=gameState.competitors[0];ai.budget=100;
acquireSportsRight('f1',{owner:ai,price:9});sr().owned[0].broadcastSeason=3;sr().recurring.f1.nextAuctionSeason=null;
const sRand=sportsRandom;sportsRandom=()=>0;resolveSportsRenewalsAtSeasonEnd();
assert(sr().owned.some(o=>o.ownerName===ai.name&&o.broadcastSeason===4&&o.acquisitionPrice===9)&&ai.budget===100-9-9,'AI renews at the initial price');
gameState.season=4;ai.budget=5;resolveSportsRenewalsAtSeasonEnd();
assert(!sr().owned.some(o=>o.broadcastSeason===5)&&[5,6].includes(sr().recurring.f1.nextAuctionSeason),'AI without budget releases the right');
sportsRandom=sRand;
// ---------- Courses hippiques : droit annuel du matin, même mécanique que la F1 ----------
{
  const ch=SPORT_RIGHTS_EVENTS.courses_hippiques;
  assert(ch.recurring&&ch.preferredSlots.join()==='matin'&&ch.sport==='hippisme'&&!ch.channelTypes,'horse racing: annual right on the morning slot, generalist and sport');
  const dch=DILEMMA_BANK.find(d=>d.id==='d_droits_courses_hippiques');
  assert(dch&&dch.type==='sports_rights_auction'&&dch.rightsEventId==='courses_hippiques'&&dch.types.join()==='generaliste,sport','horse racing auction dilemma');
  const firstsH=new Set();for(let k=1;k<=40;k++){setup('generaliste',2000+k);firstsH.add(sr().recurring.courses_hippiques.nextAuctionSeason);}
  assert([...firstsH].every(v=>v>=1&&v<=3)&&firstsH.size>1,'first horse racing auction in seasons 1-3');
  for(const type of ['generaliste','sport']){
    setup(type);sr().recurring.f1.nextAuctionSeason=99;gameState.season=sr().recurring.courses_hippiques.nextAuctionSeason;
    const auc=pickDilemmaQueue().filter(d=>d.type==='sports_rights_auction');
    assert(auc.length===1&&auc[0].rightsEventId==='courses_hippiques','horse racing auction for '+type);
  }
  // Une seule enchère par saison : F1 et courses dues en même temps → l'une attend.
  setup();gameState.season=3;sr().recurring.f1.nextAuctionSeason=2;sr().recurring.courses_hippiques.nextAuctionSeason=2;
  const both=pickDilemmaQueue().filter(d=>d.type==='sports_rights_auction');assert(both.length===1,'one auction per season');
  // Diffusion le matin, reconduction dans la grille au prix initial.
  setup();gameState.season=3;acquireSportsRight('courses_hippiques',{owner:'player',price:5});sr().owned[0].broadcastSeason=3;sr().recurring.courses_hippiques.nextAuctionSeason=null;
  activateSportsBroadcasts();
  assert(activeContract(gameState.player,'matin')?.isSportsEvent&&!activeContract(gameState.player,'apresmidi')?.isSportsEvent,'horse racing airs in the morning');
  const rq=withRenewalDilemmas([DILEMMA_BANK[0],DILEMMA_BANK[1],DILEMMA_BANK[2]]).at(-1);
  assert(rq.isSportsRenewal&&rq.rightsEventId==='courses_hippiques','horse racing renewal offered');
  applySportsRenewalChoice('courses_hippiques','renew');
  assert(sr().owned.some(o=>o.eventId==='courses_hippiques'&&o.broadcastSeason===4&&o.gridAnnual===5&&o.ownerId==='player'),'renewed at the initial price, in next season grid');
  setup('culture');gameState.competitors.forEach(c=>c.budget=200);sr().recurring.f1.nextAuctionSeason=99;gameState.season=sr().recurring.courses_hippiques.nextAuctionSeason;
  assert(!pickDilemmaQueue().some(d=>d.rightsEventId==='courses_hippiques')&&sr().history.some(h=>h.eventId==='courses_hippiques'&&h.result==='ai_only'),'horse racing auction among AI channels');
}
// ---------- Ligue 1 et Top 14 (droits annuels), Jeux olympiques d'hiver ----------
{
  const l1=SPORT_RIGHTS_EVENTS.ligue1,t14=SPORT_RIGHTS_EVENTS.top14,wo=SPORT_RIGHTS_EVENTS.winter_olympics;
  assert(l1.recurring&&l1.preferredSlots.join()==='prime'&&l1.sport==='football'&&!l1.channelTypes,'Ligue 1: annual right on prime, generalist and sport');
  assert(t14.recurring&&t14.preferredSlots.join()==='access'&&t14.sport==='rugby'&&!t14.channelTypes,'Top 14: annual right on access, generalist and sport');
  assert(!wo.recurring&&wo.sport==='hiver'&&!wo.channelTypes&&wo.preferredSlots.join()==='matin,apresmidi,access','winter olympics: one-off right');
  [['d_droits_ligue1','ligue1'],['d_droits_top14','top14'],['d_droits_jo_hiver','winter_olympics']].forEach(([id,ev])=>{
    const d=DILEMMA_BANK.find(x=>x.id===id);
    assert(d&&d.type==='sports_rights_auction'&&d.rightsEventId===ev&&d.types.join()==='generaliste,sport','auction dilemma '+id);
  });
  ['generaliste','sport','cinema','culture','jeunesse','info'].forEach(t=>['rugby','hiver'].forEach(k=>assert(SPORT_RIGHTS_TUNING.channelFit[t][k]>0,'channel fit '+t+'/'+k)));
  const firsts=new Set();for(let k=1;k<=40;k++){setup('generaliste',3000+k);firsts.add(sr().recurring.ligue1.nextAuctionSeason);firsts.add(sr().recurring.top14.nextAuctionSeason);}
  assert([...firsts].every(v=>v>=2&&v<=5)&&firsts.size>2,'championships first sold in seasons 2-5');
  for(const [ev,slot] of [['ligue1','prime'],['top14','access']]) for(const type of ['generaliste','sport']){
    setup(type);Object.entries(sr().recurring).forEach(([id,r])=>{if(id!==ev) r.nextAuctionSeason=99;});gameState.season=sr().recurring[ev].nextAuctionSeason;
    const auc=pickDilemmaQueue().filter(d=>d.type==='sports_rights_auction');
    assert(auc.length===1&&auc[0].rightsEventId===ev,ev+' auction for '+type);
    setup(type);gameState.season=3;acquireSportsRight(ev,{owner:'player',price:6});sr().owned[0].broadcastSeason=3;sr().recurring[ev].nextAuctionSeason=null;
    activateSportsBroadcasts();
    assert(activeContract(gameState.player,slot)?.isSportsEvent,ev+' airs on '+slot);
    const rq=withRenewalDilemmas([DILEMMA_BANK[0],DILEMMA_BANK[1],DILEMMA_BANK[2]]).at(-1);
    assert(rq.isSportsRenewal&&rq.rightsEventId===ev,ev+' renewal offered');
    applySportsRenewalChoice(ev,'renew');
    assert(sr().owned.some(o=>o.eventId===ev&&o.broadcastSeason===4&&o.gridAnnual===6&&o.ownerId==='player'),ev+' renewed at the initial price');
  }
  // JO d'hiver : proposés au marché ordinaire de la chaîne Sport.
  setup('sport');Object.values(sr().recurring).forEach(r=>r.nextAuctionSeason=99);gameState.season=sr().nextAuctionSeason;
  Object.values(SPORT_RIGHTS_EVENTS).filter(e=>!e.recurring&&e.id!=='winter_olympics').forEach(e=>sr().history.push({eventId:e.id,season:0}));
  const wq=pickDilemmaQueue().find(d=>d.type==='sports_rights_auction');
  assert(wq&&wq.id==='d_droits_jo_hiver','winter olympics auction for a sport channel');
  // Chaîne Cinéma : un championnat dû se vend entre IA sans lui retirer son enchère de la saison.
  setup('cinema');gameState.competitors.forEach(c=>c.budget=200);Object.entries(sr().recurring).forEach(([id,r])=>r.nextAuctionSeason=id==='ligue1'?2:99);
  gameState.season=2;sr().nextAuctionSeason=2;
  const cq=pickDilemmaQueue().filter(d=>d.type==='sports_rights_auction');
  assert(sr().history.some(h=>h.eventId==='ligue1'&&h.result==='ai_only')&&cq.length===1&&SPORT_RIGHTS_EVENTS[cq[0].rightsEventId].category==='cinema','championship sold among AIs, cinema auction kept');
}
// Joueur hors Généraliste / Sport : la F1 se vend entre chaînes IA.
setup('culture');gameState.competitors.forEach(c=>c.budget=200);gameState.season=sr().recurring.f1.nextAuctionSeason;
assert(!pickDilemmaQueue().some(d=>d.rightsEventId==='f1')&&sr().history.some(h=>h.eventId==='f1'&&h.result==='ai_only'),'F1 auction among AI channels');
// Droits cinéma & séries : la chaîne Cinéma reçoit les 12 événements (jamais de sport), la
// chaîne Sport jamais de cinéma ; les droits hors de portée du joueur se vendent entre IA.
{
  const cine=Object.values(SPORT_RIGHTS_EVENTS).filter(e=>e.category==='cinema');
  assert(cine.length===12&&cine.every(e=>DILEMMA_BANK.some(d=>d.id===e.dilemmaIds[0]&&d.type==='sports_rights_auction'&&d.rightsEventId===e.id)),'12 cinema events with their auction dilemma');
  assert(cine.every(e=>e.illustration.genre==='cinema'&&e.stars>=2&&e.power>0&&e.preferredSlots.every(sl=>e.slotFit[sl]>0)),'cinema events complete');
  for(const [type,ok] of [['cinema',e=>e.category==='cinema'],['sport',e=>e.category!=='cinema']]){
    setup(type);gameState.competitors.forEach(c=>c.budget=200);const got=new Set();let parallel=0;
    for(let s=1;s<=60;s++){gameState.season=s;gameState.seenDilemmaIds=[];gameState.player.eventsSeen=[];gameState.player.lastRegieOpportunity=s;
      const before=sr().history.length;const q=pickDilemmaQueue();const auc=q.find(d=>d.type==='sports_rights_auction');
      parallel+=sr().history.slice(before).filter(h=>h.result==='ai_only'&&!ok(SPORT_RIGHTS_EVENTS[h.eventId])).length;
      if(auc){got.add(auc.rightsEventId);gameState.dilemmaQueue=q;gameState.currentDilemmaIndex=1;startSportsRightsAuction(auc.rightsEventId,auc.id);sportsAuctionPass();recordSportsAuctionOutcome(auc);}}
    assert(got.size>3&&[...got].every(id=>ok(SPORT_RIGHTS_EVENTS[id])),type+' channel gets only its own rights: '+[...got]);
    assert(parallel>0,'rights out of reach of a '+type+' player are sold among AI channels');
  }
  // Diffusion : cases de l'événement, éditorial culture / fiction, popularité selon le potentiel.
  setup('cinema');gameState.season=3;acquireSportsRight('cannes',{owner:'player',price:10});sr().owned[0].broadcastSeason=3;
  const pop0=gameState.player.popularite;activateSportsBroadcasts();
  const cAccess=activeContract(gameState.player,'access'),cPrime=activeContract(gameState.player,'prime');
  assert(cAccess?.isSportsEvent&&cPrime?.isSportsEvent&&!activeContract(gameState.player,'nuit')?.isSportsEvent,'Cannes airs in access and prime');
  assert(cPrime.editorial.genre==='culture'&&cPrime.editorial.mix.prodFR===100&&cPrime.editorial.mix.direct===100&&cPrime.editorial.mix.sport!==100,'Cannes counts as French live culture');
  assert(gameState.player.popularite===pop0+2,'5-star event popularity');
  const film=cinemaEventEditorial(SPORT_RIGHTS_EVENTS.saga,gameState.player,'prime');
  assert(film.genre==='fiction'&&film.mix.prodFR===0&&film.mix.direct===0,'saga counts as international fiction');
  assert(calculateSportsEventAudience(SPORT_RIGHTS_EVENTS.deauville,gameState.player,'access',{variance:1}).a2549<calculateSportsEventAudience(SPORT_RIGHTS_EVENTS.oscars,gameState.player,'nuit',{variance:1}).a2549,'audience follows the stars');
  // Incident aux César (d26) : réservé à la chaîne qui diffuse la cérémonie cette saison.
  for(const type of ['generaliste','cinema','culture']){setup(type);gameState.season=4;
    assert(!getEligibleDilemmas().some(d=>d.id==='d26'),'no César incident without the rights for '+type);}
  setup('generaliste');gameState.season=4;acquireSportsRight('cesars',{owner:gameState.competitors[0],price:8});sr().owned[0].broadcastSeason=4;
  assert(!getEligibleDilemmas().some(d=>d.id==='d26'),'no César incident when a rival airs the ceremony');
  setup('generaliste');gameState.season=4;acquireSportsRight('cesars',{owner:'player',price:8});sr().owned[0].broadcastSeason=4;
  const cq=pickDilemmaQueue();assert(cq[0].id==='d26'&&cq.length===3,'César broadcaster gets the live incident dilemma');
  gameState.season=5;gameState.seenDilemmaIds=[];assert(!getEligibleDilemmas().some(d=>d.id==='d26'),'César incident only during the broadcast season');
}
// Grands événements d'information : sept événements, réservés côté joueur aux chaînes
// Information, sur leurs seules cases (affectedSlots).
{
  const infoEv=Object.values(SPORT_RIGHTS_EVENTS).filter(e=>e.category==='info');
  const slots={debat_presidentiel:'prime',objectif_mars:'apresmidi,access,prime,nuit',habemus_papam:'apresmidi,access',nuit_americaine:'nuit',dossiers_secrets:'access,prime',mariage_du_siecle:'matin,apresmidi',sous_serment:'apresmidi'};
  assert(infoEv.length===7&&infoEv.every(e=>e.channelTypes.join()==='info'&&e.affectedSlots.join()===slots[e.id]&&e.preferredSlots.join()===slots[e.id]
    &&DILEMMA_BANK.some(d=>d.id===e.dilemmaIds[0]&&d.type==='sports_rights_auction'&&d.rightsEventId===e.id&&d.types.join()==='info')),'7 info events with their slots and auction dilemma');
  assert(infoEv.every(e=>e.illustration.genre==='evenement'&&e.illustration.subgenre)&&new Set(infoEv.map(e=>e.illustration.subgenre)).size===7,'one illustration per info event');
  for(const type of ['info','generaliste','sport','cinema']){
    setup(type);Object.values(sr().recurring).forEach(r=>r.nextAuctionSeason=99);const seen=[];
    for(let k=1;k<=30;k++){gameState.season=k;gameState.seenDilemmaIds=[];gameState.player.eventsSeen=[];
      pickDilemmaQueue().filter(d=>d.type==='sports_rights_auction').forEach(d=>seen.push(SPORT_RIGHTS_EVENTS[d.rightsEventId].category||'sport'));}
    if(type==='info') assert(seen.length>0&&seen.every(c=>c==='info'),'news channel gets info auctions only');
    else assert(!seen.includes('info'),'no info auction for '+type);
  }
  // Diffusion : seules les cases de l'événement sont occupées, les autres restent intactes.
  setup('info');gameState.season=3;const pi=gameState.player;
  TIME_SLOTS.forEach(({key})=>{const prog=availablePrograms('info',key)[0];if(prog)pi.contracts[key]={...prog,end:9,career:createProgramCareer(prog,key)};});
  const before=getCalculatedPDAs().find(r=>r.channel===pi);
  acquireSportsRight('nuit_americaine',{owner:'player',price:5});sr().owned.at(-1).broadcastSeason=3;activateSportsBroadcasts();
  const after=getCalculatedPDAs().find(r=>r.channel===pi);
  assert(activeContract(pi,'nuit')?.isSportsEvent&&TIME_SLOTS.filter(t=>t.key!=='nuit').every(t=>!activeContract(pi,t.key)?.isSportsEvent&&pi.contracts[t.key]?.sportsPause!==3),'only the night slot is taken');
  assert(TIME_SLOTS.filter(t=>t.key!=='nuit').every(t=>Math.abs(after.intrinsicSlots[t.key][pi.target]-before.intrinsicSlots[t.key][pi.target])<1e-9),'no direct impact outside the event slot');
  assert(after.slots.nuit[pi.target]>before.slots.nuit[pi.target],'the night audience jumps');
  const ed=sportsEventEditorial(SPORT_RIGHTS_EVENTS.debat_presidentiel,pi,'prime');
  assert(ed.genre==='info'&&ed.mix.info===100&&ed.mix.direct===100&&ed.mix.debat===100,'info event counts as live news and debate');
  // Aléa (report de la mission, révélations décevantes) : l'audience est rabotée.
  setup('info');gameState.season=3;acquireSportsRight('objectif_mars',{owner:'player',price:12});sr().owned.at(-1).broadcastSeason=3;
  const sRand2=sportsRandom;sportsRandom=()=>0;activateSportsBroadcasts();sportsRandom=sRand2;
  const mars=sr().owned.at(-1);assert(mars.riskHit&&Math.abs(mars.variance-0.9*0.6)<1e-9,'Mars risk lowers the audience');
}
// Grands événements jeunesse : cinq événements réservés côté joueur aux chaînes Jeunesse.
{
  const youth=Object.values(SPORT_RIGHTS_EVENTS).filter(e=>e.category==='jeunesse');
  const slots={eurovision_junior:'apresmidi,access',finale_esport:'apresmidi,access,prime',concert_youtubeurs:'access,prime',spectacle_noel:'apresmidi,prime',blockbuster_animation:'prime'};
  const stars={eurovision_junior:5,finale_esport:5,concert_youtubeurs:5,spectacle_noel:4,blockbuster_animation:5};
  assert(youth.length===5&&youth.every(e=>e.channelTypes.join()==='jeunesse'&&e.affectedSlots.join()===slots[e.id]&&e.preferredSlots.join()===slots[e.id]&&e.stars===stars[e.id]
    &&DILEMMA_BANK.some(d=>d.id===e.dilemmaIds[0]&&d.type==='sports_rights_auction'&&d.rightsEventId===e.id&&d.types.join()==='jeunesse')),'5 youth events with their slots, stars and auction dilemma');
  assert(new Set(youth.map(e=>e.illustration.subgenre)).size===5&&youth.every(e=>e.illustration.genre==='evenement'),'one illustration per youth event');
  for(const type of ['jeunesse','generaliste','info','cinema']){
    setup(type);Object.values(sr().recurring).forEach(r=>r.nextAuctionSeason=99);const seen=[];
    for(let k=1;k<=30;k++){gameState.season=k;gameState.seenDilemmaIds=[];gameState.player.eventsSeen=[];
      pickDilemmaQueue().filter(d=>d.type==='sports_rights_auction').forEach(d=>seen.push(SPORT_RIGHTS_EVENTS[d.rightsEventId].category||'sport'));}
    if(type==='jeunesse') assert(seen.length>0&&seen.every(c=>c==='jeunesse'),'youth channel gets youth auctions only');
    else assert(!seen.includes('jeunesse'),'no youth auction for '+type);
  }
  setup('jeunesse');gameState.season=3;const pj=gameState.player;
  TIME_SLOTS.forEach(({key})=>{const prog=availablePrograms('jeunesse',key)[0];if(prog)pj.contracts[key]={...prog,end:9,career:createProgramCareer(prog,key)};});
  const before=getCalculatedPDAs().find(r=>r.channel===pj);
  acquireSportsRight('blockbuster_animation',{owner:'player',price:10});sr().owned.at(-1).broadcastSeason=3;activateSportsBroadcasts();
  const after=getCalculatedPDAs().find(r=>r.channel===pj);
  assert(activeContract(pj,'prime')?.isSportsEvent&&TIME_SLOTS.filter(t=>t.key!=='prime').every(t=>!activeContract(pj,t.key)?.isSportsEvent),'only the prime slot is taken');
  assert(TIME_SLOTS.filter(t=>t.key!=='prime').every(t=>Math.abs(after.intrinsicSlots[t.key][pj.target]-before.intrinsicSlots[t.key][pj.target])<1e-9),'no direct impact outside the youth event slot');
  const ye=sportsEventEditorial(SPORT_RIGHTS_EVENTS.finale_esport,pj,'prime');
  assert(ye.genre==='jeunesse'&&ye.mix.jeunesse===100&&ye.mix.direct===100,'youth event counts as live youth programming');
}
// Grands événements culture : huit événements réservés côté joueur aux chaînes Culture.
{
  const cult=Object.values(SPORT_RIGHTS_EVENTS).filter(e=>e.category==='culture');
  const slots={concert_vienne:'matin,apresmidi',concert_tour_eiffel:'access,prime',comedie_francaise:'access,prime',lac_des_cygnes:'access,prime',
    concert_14_juillet:'access,prime',prix_goncourt:'access',eclipse_siecle:'apresmidi,access,prime',victoires_classique:'access,prime'};
  const stars={concert_vienne:5,concert_tour_eiffel:5,comedie_francaise:4,lac_des_cygnes:5,concert_14_juillet:5,prix_goncourt:3,eclipse_siecle:5,victoires_classique:4};
  assert(cult.length===8&&cult.every(e=>e.channelTypes.join()==='culture'&&e.affectedSlots.join()===slots[e.id]&&e.preferredSlots.join()===slots[e.id]&&e.stars===stars[e.id]
    &&DILEMMA_BANK.some(d=>d.id===e.dilemmaIds[0]&&d.type==='sports_rights_auction'&&d.rightsEventId===e.id&&d.types.join()==='culture')),'8 culture events with their slots, stars and auction dilemma');
  assert(new Set(cult.map(e=>e.illustration.subgenre)).size===8&&cult.every(e=>e.illustration.genre==='evenement'),'one illustration per culture event');
  for(const type of ['culture','generaliste','jeunesse','info']){
    setup(type);gameState.competitors.forEach(c=>c.budget=200);Object.values(sr().recurring).forEach(r=>r.nextAuctionSeason=99);const seen=[];
    for(let k=1;k<=30;k++){gameState.season=k;gameState.seenDilemmaIds=[];gameState.player.eventsSeen=[];
      pickDilemmaQueue().filter(d=>d.type==='sports_rights_auction').forEach(d=>seen.push(SPORT_RIGHTS_EVENTS[d.rightsEventId].category||'sport'));}
    if(type==='culture'){
      assert(seen.length>0&&seen.every(c=>c==='culture'),'culture channel gets culture auctions only');
      // Les droits hors de sa portée se vendent toujours entre chaînes IA.
      assert(sr().history.some(h=>h.result==='ai_only'&&h.winnerId&&SPORT_RIGHTS_EVENTS[h.eventId].category!=='culture'),'AI channels still sell the other rights');
    } else assert(!seen.includes('culture'),'no culture auction for '+type);
  }
  setup('culture');gameState.season=3;const pc=gameState.player;
  TIME_SLOTS.forEach(({key})=>{const prog=availablePrograms('culture',key)[0];if(prog)pc.contracts[key]={...prog,end:9,career:createProgramCareer(prog,key)};});
  const before=getCalculatedPDAs().find(r=>r.channel===pc);
  acquireSportsRight('prix_goncourt',{owner:'player',price:4});sr().owned.at(-1).broadcastSeason=3;activateSportsBroadcasts();
  const after=getCalculatedPDAs().find(r=>r.channel===pc);
  assert(activeContract(pc,'access')?.isSportsEvent&&TIME_SLOTS.filter(t=>t.key!=='access').every(t=>!activeContract(pc,t.key)?.isSportsEvent),'only the access slot is taken');
  assert(TIME_SLOTS.filter(t=>t.key!=='access').every(t=>Math.abs(after.intrinsicSlots[t.key][pc.target]-before.intrinsicSlots[t.key][pc.target])<1e-9),'no direct impact outside the culture event slot');
  const ce=sportsEventEditorial(SPORT_RIGHTS_EVENTS.comedie_francaise,pc,'prime');
  assert(ce.genre==='culture'&&ce.mix.culture===100&&ce.mix.direct===100&&ce.mix.prodFR===100,'culture event counts as live French culture');
}
['generaliste','sport','jeunesse','info','culture','cinema'].forEach(type=>assert(computeCompetitorSportsMaxBid({...mk('X','offensive',type),budget:200},SPORT_RIGHTS_EVENTS.world_cup)>0,'AI bids from '+type));
// Chaîne Sport : ses dilemmes dédiés (d89, d145) sont préférés.
setup('sport');gameState.season=sr().nextAuctionSeason;Object.values(sr().recurring).forEach(r=>r.nextAuctionSeason=99);const sq=pickDilemmaQueue().find(d=>d.type==='sports_rights_auction');
assert(sq&&(['d89','d145','d2','d_droits_jo_hiver'].includes(sq.id)),'sport channel auction dilemma');
// Un dilemme sport éditorial ou de production n'est pas converti.
['d79','d165','d20','d244','d76','d77','d148'].forEach(id=>assert(!DILEMMA_BANK.find(d=>d.id===id).type,'not converted '+id));
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
a=auctionSetup([80,80,0,0,0]);setMax(a,[17,15,0,0,0]);
sportsAuctionParticipate();assert(a.phase==='bidding'&&a.price===null&&a.leader===null,'single sealed round opens');
let gb=sportsGaugeBounds(a);assert(gb.min===ev.reservePrice&&gb.max>gb.estMax&&gb.canBid&&a.draft===gb.suggested&&gb.suggested>=gb.estMin&&gb.suggested<=gb.estMax,'gauge bounds and suggestion');
assert(sportsGaugeFeedback(a,gb.min).zone==='low'&&sportsGaugeFeedback(a,gb.estMax+1).zone==='high'&&sportsGaugeFeedback(a,gb.suggested).zone==='fair','gauge zones');
settle();const pdaBefore=getCalculatedPDAs().find(r=>r.channel===gameState.player).pda.a2549;
const revBefore=gameState.player.revenusPubPrevisionnels;
sportsAuctionSealedBid(20);
assert(a.phase==='verdict'&&a.result.outcome==='won','player wins in one round');
assert(a.result.price>17&&a.result.price<=20&&a.result.playerLastBid===20,'pays just above the second offer');
assert(a.result.reveal.length===3&&a.result.reveal[0].isPlayer&&a.result.reveal[1].amount===17&&a.result.reveal[2].amount===15,'sealed offers revealed in order');
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
sportsAuctionParticipate();sportsAuctionSealedBid(20);assert(a.result.outcome==='lost'&&a.result.price>20&&a.result.price<=24&&a.result.playerLastBid===20,'lower offer loses');
// Égalité d'offre : la plus forte PDA 4+ (moyenne des quatre cibles) l'emporte.
{
  const realCalc=getCalculatedPDAs;
  const withPda=(playerPda,rivalPda)=>{getCalculatedPDAs=()=>realCalc().map(r=>({...r,globalPda:r.channel===gameState.player?playerPda:r.channel===gameState.competitors[0]?rivalPda:0}));};
  a=auctionSetup([80,80,0,0,0]);setMax(a,[20,0,0,0,0]);withPda(5,8);
  sportsAuctionParticipate();sportsAuctionSealedBid(20);assert(a.result.outcome==='lost'&&a.result.price===20&&a.result.tieBreak,'tie goes to the stronger 4+ audience (rival)');
  a=auctionSetup([80,80,0,0,0]);setMax(a,[20,0,0,0,0]);withPda(9,8);
  sportsAuctionParticipate();sportsAuctionSealedBid(20);assert(a.result.outcome==='won'&&a.result.price===20&&a.result.tieBreak,'tie goes to the stronger 4+ audience (player)');
  a=auctionSetup([80,80,0,0,0]);setMax(a,[20,0,0,0,0]);withPda(9,8);
  sportsAuctionParticipate();sportsAuctionSealedBid(19.5);assert(a.result.outcome==='lost'&&!a.result.tieBreak,'the highest offer still wins first');
  // Entre chaînes IA aussi : à offre égale, la plus forte sur les 4 ans et plus.
  a=auctionSetup([80,80,0,0,0]);setMax(a,[20,20,0,0,0]);
  getCalculatedPDAs=()=>realCalc().map(r=>({...r,globalPda:r.channel===gameState.competitors[1]?9:r.channel===gameState.competitors[0]?3:0}));
  sportsAuctionPass();assert(a.result.winnerName===gameState.competitors[1].name&&a.result.price===20&&a.result.tieBreak,'AI tie goes to the stronger 4+ audience');
  getCalculatedPDAs=realCalc;
}
// Offres concurrentes jamais exposées avant l'ouverture des plis.
a=auctionSetup([80,80,0,0,0]);setMax(a,[15.5,0,0,0,0]);sportsAuctionParticipate();
const zoneHtml=renderSportsAuctionZone(DILEMMA_BANK.find(x=>x.id==='d2'));
assert(zoneHtml.includes('data-sa-range')&&!zoneHtml.includes('15,5'),'gauge shown, rival offers sealed');
// Hors des bornes de la jauge : ignoré.
const sealedBefore=JSON.stringify(a);sportsAuctionSealedBid(sportsGaugeBounds(a).max+5);sportsAuctionSealedBid(ev.reservePrice-1);
assert(JSON.stringify(a)===sealedBefore,'out of range offer ignored');
// Se retirer.
a=auctionSetup([80,80,0,0,0]);setMax(a,[18,16,0,0,0]);
sportsAuctionParticipate();sportsAuctionWithdraw();assert(a.result.outcome==='withdrawn'&&a.leader===0&&a.result.reveal.length===2,'withdraw');
// Aucun intérêt IA : le joueur l'emporte au prix de départ.
a=auctionSetup([0,0,0,0,0]);assert(a.rivals.every(r=>r.status==='out'),'no rival interested');
sportsAuctionParticipate();sportsAuctionSealedBid(sportsGaugeBounds(a).suggested);assert(a.result.outcome==='won'&&a.result.price===ev.reservePrice,'win at reserve');
// Budget insuffisant : offre bloquée ; offre risquée : signalée, déposée sans confirmation.
a=auctionSetup([80,80,0,0,0]);setMax(a,[15,0,0,0,0]);
sportsAuctionParticipate();gameState.player.tresorerie=-50;
assert(!sportsGaugeBounds(a).canBid,'cannot bid without funds');
const before=JSON.stringify(a);sportsAuctionSealedBid(ev.reservePrice);assert(JSON.stringify(a)===before,'blocked bid ignored');
gameState.player.tresorerie=-40;gb=sportsGaugeBounds(a);assert(gb.canBid&&gb.max<sportsGaugeBounds(a).estMax*1.5&&playerCanAfford(gb.max)&&!playerCanAfford(gb.max+0.5),'gauge capped by treasury');
gameState.player.tresorerie=20;gb=sportsGaugeBounds(a);assert(sportsGaugeFeedback(a,gb.max).risky,'risky top of the gauge');
sportsAuctionSealedBid(gb.max);assert(a.phase==='verdict'&&a.result.outcome==='won'&&!a.pending,'risky offer submitted without confirmation');

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
const pdaOnAir=getCalculatedPDAs().find(r=>r.channel===gameState.player).pda.a2549;
evaluateSportsBroadcasts();assert(rec.perf&&rec.perf.pdaGain>0&&rec.perf.revenueGain>0,'broadcast evaluated');
// L'événement reste à l'antenne jusqu'au lancement de la saison suivante : le bilan l'inclut.
assert(rec.status==='broadcast'&&sportsBroadcastOn(gameState.player,'prime')&&Math.abs(getCalculatedPDAs().find(r=>r.channel===gameState.player).pda.a2549-pdaOnAir)<1e-9,'season-end audiences keep the event');
assert(renderSportsRightsBilanHtml().includes(rec.perf.verdict),'season report shows verdict');
// Saison suivante : le programme reprend et son coût revient dans la grille.
gameState.season=3;closeSportsBroadcasts();restorePausedPrograms();assert(rec.status==='done'&&gameState.player.coutGrilleEngageSaison===5&&!gameState.player.contracts.prime.sportsPause,'program resumes');
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
assert(offRec.status==='broadcast'&&activeContract(rv,'prime')?.isSportsEvent&&offRec.perf.pdaGain>0&&offRec.perf.revenueGain>0&&offRec.perf.playerImpact<0,'competitor broadcast evaluated');
assert(Math.abs(rv.budget-budgetBefore-offRec.perf.revenueGain)<1e-9,'extra revenue credited to the competitor budget');
assert(renderSportsRightsBilanHtml().includes('CONCURRENT'),'season report shows the competitor broadcast');
const budgetAfter=rv.budget;evaluateSportsBroadcasts();assert(rv.budget===budgetAfter,'competitor revenue credited once');
gameState.season=3;closeSportsBroadcasts();assert(offRec.status==='done','competitor broadcast closed next season');rv.budget=50;planCompetitorSeasons();
assert(rv.plan.slots.prime.tag!=='evenement'&&!activeContract(rv,'prime')?.isSportsEvent,'event over for the competitor');
assert(rv.plan.slots.prime.name===pausedName||rv.contracts.prime.end>=3,'paused competitor program resumes');
// Programme mis en pause par un événement : sa PDA de renouvellement est la sienne, pas
// celle de l'événement, et sa carrière n'évolue pas pendant la pause.
{
  setup();gameState.season=2;const pp=gameState.player;
  const prog=PROGRAM_CATALOG.find(x=>x.channelType===pp.type&&x.slot==='prime');
  pp.contracts.prime={...prog,end:2,talentAnnual:0,career:createProgramCareer(prog,'prime')};pp.coutGrilleEngageSaison=prog.annual;
  pp.contracts.prime.career.history=[{season:1,performance:4.4}];
  acquireSportsRight('world_cup',{owner:'player',price:20});sr().owned.at(-1).broadcastSeason=2;activateSportsBroadcasts();
  const slotNow=getCalculatedPDAs().find(r=>r.channel===pp).slots.prime[pp.target];
  const real=programSlotPda('prime');
  assert(real.pda===4.4&&real.season===1&&real.pausedBy?.id==='world_cup'&&slotNow>real.pda,'paused program judged on its last aired season, not the event');
  pp.contracts.prime.career.history=[];
  const est=programSlotPda('prime');
  assert(Number.isFinite(est.pda)&&est.pda<slotNow&&!sr().owned.some(o=>o.suppressed),'paused program never aired: estimate without the event');
  const car={...pp.contracts.prime.career};evolveProgramCareers();
  assert(pp.contracts.prime.career.seasonsCount===car.seasonsCount&&pp.contracts.prime.career.awareness===car.awareness,'no career evolution while paused');
}
console.log('OK sports rights: frequency, selection, auction, economy, broadcast, competitors, state');
`;
const source = scripts.slice(0, -1).join('\n') + '\n' + tests;
vm.runInNewContext(source, { console }, { filename: 'audience-masters-sports-rights.js' });
