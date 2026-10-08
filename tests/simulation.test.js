'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
// The final inline script starts the browser UI; the simulation tests exercise the same
// declarations in one VM evaluation without requiring a DOM implementation.
const tests = String.raw`
const assert=(v,m)=>{if(!v) throw Error(m)};
globalThis.localStorage={d:{},setItem(k,v){this.d[k]=v},getItem(k){return this.d[k]||null},removeItem(k){delete this.d[k]}};
const demos={j1524:10,a2549:10,s50:10,csp:10};
const mk=(name,strategy='offensive')=>({name,type:'generaliste',target:'a2549',pda:{...demos},budget:50,contracts:{},slotAudienceDeltas:{},strategy,slotInvestments:{},strategyHistory:[]});
function setup(){gameState.player=mk('Joueur');gameState.competitors=[mk('Off','offensive'),mk('Rent','rentable'),mk('Jeune','jeune'),mk('Prem','premium'),mk('Autre','rentable')];gameState.season=1;gameState.competitorEvents=[];gameState.campaign={deadline:5,status:'active',seed:1};}
setup();
let base=getCalculatedPDAs().find(x=>x.channel===gameState.player);
gameState.player.slotAudienceDeltas.access={a2549:4};
let row=getCalculatedPDAs().find(x=>x.channel===gameState.player);
assert(Math.abs(row.leadIns.prime.a2549-.5)<1e-9,'access prime positive capped');
assert(row.leadIns.nuit.a2549===0,'no cascade from received lead-in');
gameState.player.slotAudienceDeltas.access.a2549=-4;row=getCalculatedPDAs().find(x=>x.channel===gameState.player);
assert(Math.abs(row.leadIns.prime.a2549+.5)<1e-9,'negative cap');
gameState.player.slotAudienceDeltas={matin:{a2549:2},apresmidi:{a2549:2},prime:{a2549:2},nuit:{a2549:9}};row=getCalculatedPDAs().find(x=>x.channel===gameState.player);
assert(Math.abs(row.leadIns.apresmidi.a2549-.1)<1e-9,'morning transition');
assert(Math.abs(row.leadIns.access.a2549-.16)<1e-9,'afternoon transition');
assert(Math.abs(row.leadIns.nuit.a2549-.24)<1e-9,'prime transition');
assert(row.leadIns.matin.a2549===undefined,'no night morning');
setup();
const prog={id:'p-test',name:'Test Talk',slot:'access',format:'magazine',power:3,target:'a2549',annual:10,talent:'Équipe',talentAnnual:0,end:3,editorial:{genre:'diverti'}};
gameState.player.contracts.access={...prog,career:createProgramCareer(prog,'access')};
const c=gameState.player.contracts.access.career;evolveProgramCareers();
assert(c.seasonsCount===1&&c.awareness>18&&c.loyalty>12&&c.wear>0,'career evolves');
c.awareness=70;c.loyalty=60;c.wear=10;const freshPower=programCareerPower(gameState.player.contracts.access);c.wear=90;assert(programCareerPower(gameState.player.contracts.access)<freshPower,'wear reduces power');
c.seasonsCount=4;c.awareness=80;c.loyalty=75;c.wear=45;evolveProgramCareers();
assert(c.historic,'historic status');
c.franchiseOffered=true;const renewal=createCareerRenewalDilemma(selectCareerDecisions()[0]);assert(renewal&&renewal.c.length===4,'dynamic renewal dilemma');gameState.player.eventsSeen=[];gameState.seenDilemmaIds=[];const queue=pickDilemmaQueue();assert(queue.at(-1).isCareerDilemma,'renewal is final season choice');
const oldWear=c.wear;assert(applyCareerDilemmaChoice(renewal,renewal.c[1])&&c.wear<oldWear,'modify career');
const beforePotential=c.potential;applyCareerDilemmaChoice(renewal,renewal.c[2]);assert(c.potential>beforePotential,'relaunch career');
applyCareerDilemmaChoice(renewal,renewal.c[0]);assert(c.lastDecision==='renew','renew career');
applyCareerDilemmaChoice(renewal,renewal.c[3]);const stopped=gameState.player.contracts.access;assert(stopped&&stopped.stopped&&stopped.end<=gameState.season&&stopped.annual===0,'stop career');gameState.player.grilleOverrides??={};gameState.season++;expireContracts();assert(!gameState.player.contracts.access,'stopped program leaves next season');gameState.season--;
setup(); gameState.player.pda={j1524:80,a2549:80,s50:80,csp:80}; let seq=Array(30).fill(0);seededRandom=()=>seq.shift()??0;
let events=strategicCompetitors();assert(events.some(e=>e.strategy==='offensive'),'offensive reacts');assert(gameState.competitors.find(x=>x.strategy==='jeune').slotInvestments[events.find(e=>e.strategy==='jeune')?.slot]?.targets.j1524>0,'young target');assert(gameState.competitors.find(x=>x.strategy==='premium').slotInvestments[events.find(e=>e.strategy==='premium')?.slot]?.targets.csp>0,'premium target');
const offPower=events.find(e=>e.strategy==='offensive').power,rentPower=events.find(e=>e.strategy==='rentable').power;assert(offPower>rentPower,'offensive stronger than profitable');
setup();gameState.player.pda={j1524:80,a2549:80,s50:80,csp:80};seededRandom=()=>.999;assert(strategicCompetitors().length===0,'reaction not systematic');
setup();gameState.player.slotAudienceDeltas.access={a2549:3};gameState.player.pda={j1524:50,a2549:50,s50:50,csp:50};seededRandom=()=>0;const pre=getCalculatedPDAs().find(x=>x.channel===gameState.player);const rev0=computeRevenusPub(pre.pda.a2549,'a2549',50,1);strategicCompetitors();const post=getCalculatedPDAs().find(x=>x.channel===gameState.player);const rev1=computeRevenusPub(post.pda.a2549,'a2549',50,1);assert(pre.leadIns.prime.a2549>0&&post.pda.a2549!==pre.pda.a2549&&rev1!==rev0,'full interaction and revenue');
gameState.player.contracts.access={...prog,career:createProgramCareer(prog,'access')};gameState.player.contracts.access.career.seasonsCount=3;
// La sauvegarde persistante a été retirée du jeu (commit cb74fca) : test conservé si elle revient.
if(typeof persistGameState==='function'){persistGameState();const saved=JSON.stringify(gameState.competitors);gameState.competitors=[];gameState.player.contracts={};assert(restoreGameState()&&JSON.stringify(gameState.competitors)===saved,'save competitor strategy');assert(gameState.player.contracts.access.career.seasonsCount===3,'save program career');}
// Programme d'une saison signé après le tirage de la file (conférence de rentrée, grille) :
// son renouvellement doit être proposé en fin de saison, et disparaître s'il est remplacé.
render=()=>{};setup();Object.assign(gameState.player,{grilleOverrides:{},talents:[],tresorerie:500,coutGrilleEngageSaison:0,coutTalentsSaison:0,achatsSaison:0,commercialSaison:0,eventsSeen:[],popularite:50,puissanceCommerciale:1,revenusPubPrevisionnels:0,revenusPubFinals:0,regieRecettesSaison:0,pdaHistorySeason:[],pdaMoyenneSaison:0,pdaFinSaison:0});
gameState.step=6;gameState.dilemmaPhase='choosing';gameState.currentDilemmaIndex=0;gameState.seenDilemmaIds=[];gameState.dilemmaQueue=pickDilemmaQueue();
const baseLen=gameState.dilemmaQueue.length;assert(!gameState.dilemmaQueue.some(d=>d.isCareerDilemma||d.isGridRenewal),'no renewal before signing');
const oneSeason=availablePrograms('generaliste','matin').find(x=>x.years===1);assert(oneSeason&&signProgram('matin',oneSeason.id,'interne'),'sign one-season program');
assert(gameState.dilemmaQueue.at(-1).isCareerDilemma&&gameState.dilemmaQueue.at(-1).careerSlot==='matin'&&gameState.dilemmaQueue.length===baseLen,'one-season program renewal offered');
const twoSeasons=availablePrograms('generaliste','matin').find(x=>x.years>=2);assert(signProgram('matin',twoSeasons.id,'interne'),'replace program');
assert(!gameState.dilemmaQueue.some(d=>d.isCareerDilemma||d.isGridRenewal)&&gameState.dilemmaQueue.length===baseLen,'replaced program renewal removed');
// Talents en fin de contrat : un arbitrage de fin de saison propose de les prolonger ou de les laisser partir.
const mkTalent=(src,slot,annual)=>({id:src.id,name:src.name,specialty:src.specialty,role:src.role,affinities:src.affinities,annual,bonus:.6,until:gameState.season,since:gameState.season-1,slot});
const [ta,tb,tc]=MERCATO_TALENTS;gameState.player.talents=[mkTalent(ta,0,2),mkTalent(tb,1,1.5),mkTalent(tc,2,1)];
gameState.dilemmaQueue=pickDilemmaQueue();const td=gameState.dilemmaQueue.at(-1);
assert(td.isTalentRenewal&&td.talentIds.length===3&&td.c.length===2,'talent renewal dilemma offered');
assert(!quoteTalentExtension(gameState.player.talents[0]).allowed,'panel extension waits for the season-end decision');
td.picks={[ta.id]:0,[tb.id]:1,[tc.id]:2};const tChoice=buildTalentRenewalChoice(td,td.c[1]);
tChoice.talentPicks.forEach(x=>applyTalentRenewalAction(x.id,x.action));
const [xa,xb,xc]=gameState.player.talents;
assert(xa.until===gameState.season+GAME_BALANCE.mercato.duration&&xa.nextAnnual===2.2,'talent extended');
assert(xb.until===gameState.season+1&&xb.nextAnnual===1.8,'talent extended one season');
assert(xc.leaving&&!pendingTalentRenewals().length,'talent leaves');
gameState.player.coutGrilleEngageSaison=10;gameState.season++;expireTalents();
assert(gameState.player.talents.length===2&&!gameState.player.talents.some(t=>t.id===tc.id)&&xa.annual===2.2&&Math.abs(gameState.player.coutGrilleEngageSaison-9.5)<1e-9,'season rollover applies talent decisions');
gameState.season--;
const solo=createTalentRenewalDilemma([mkTalent(ta,0,2)]);assert(solo.c.length===3&&solo.c[2].talentAction==='leave','single talent renewal options');
// Rachat d'un programme concurrent : la nouvelle programmation de la chaîne lésée est
// visible, mais pas sa stratégie (badge, décryptage, mouvements de programmation).
{
  render=()=>{};resetGame();const pb=gameState.player;pb.name='Rachat';pb.type='generaliste';pb.target='a2549';finalizeChannelSetup();launchFirstSeason();
  gameState.seasonKickoffPending=false;gameState.mercatoPending=false;pb.tresorerie=500;
  let deal=null;
  for(const prog of PROGRAM_CATALOG){const h=programHolder(prog);if(h){pb.type=prog.channelType;if(signProgram(prog.slot,prog.id,'interne')){deal=h;break;}}}
  assert(deal,'a competitor program can be bought');
  const bv=competitorView(deal.competitor).find(x=>x.slot===deal.slot);
  assert(bv.buyout&&bv.isNew&&bv.name!==deal.contract.name,'replacement programme shown, flagged as a buyout');
  const row=renderRadarCards(deal.slot).split('class="radar-row').find(r=>r.includes('<span class="radar-name">'+esc(deal.competitor.name)+'</span>'));
  assert(row&&!row.includes('radar-strat'),'no strategy badge in the radar');
  const sheetRow=renderCompetitorSheet(deal.competitor).split('radar-grid-row').find(r=>r.includes(esc(bv.name)));
  assert(sheetRow&&!Object.values(STRATEGY_TAGS).some(t=>sheetRow.includes('>'+t.label+'<')),'no strategy badge in the competitor sheet');
  assert(!computeChannelBattle().moves.some(m=>m.c===deal.competitor&&m.key===deal.slot),'not listed as a strategic move');
}
// Retraite des talents : contrat plafonné, aucune prolongation, plus de recrutement.
{
  render=()=>{};resetGame();const pr=gameState.player;pr.name='Retraite';pr.type='generaliste';pr.target='a2549';finalizeChannelSetup();launchFirstSeason();
  gameState.seasonKickoffPending=false;gameState.mercatoPending=false;gameState.mercato=null;pr.tresorerie=500;pr.talents=[];
  const vet=MERCATO_TALENTS.find(t=>t.id==='t_gilles'),last=talentRetireSeason(vet);
  assert(Math.abs(last-TALENT_RETIREMENT.t_gilles)<=1&&talentRetireSeason(vet)===last,'retirement season drawn once per game');
  assert(talentRetireSeason(MERCATO_TALENTS.find(t=>TALENT_RETIREMENT[t.id]==null))===null,'not every talent retires');
  gameState.season=last;
  const offer=buildTalentOffer(vet);assert(offer.seasons===1&&offer.retiresAfter===last,'offer capped by the retirement');
  signTalent(offer,0);const signedVet=pr.talents.find(t=>t.id===vet.id);
  assert(signedVet.until===last&&talentRetiring(signedVet),'contract ends with the career');
  const rq=quoteTalentExtension(signedVet);assert(rq.retiring&&!rq.allowed,'no extension before the retirement');
  assert(!pendingTalentRenewals().some(t=>t.id===vet.id),'no season-end renewal for a retiring talent');
  gameState.season=last+1;expireTalents();
  assert(!pr.talents.some(t=>t.id===vet.id)&&talentRetired(vet),'talent retires');
  for(let k=0;k<20;k++){gameState.talentMarket=null;assert(!talentMarket().offers.some(o=>o.id===vet.id),'retired talent never offered');}
  // Deux saisons avant la retraite : la prolongation est ramenée à une saison, sans option courte.
  const vet2=MERCATO_TALENTS.find(t=>t.id==='t_claire'),last2=talentRetireSeason(vet2);
  gameState.season=last2-1;pr.talents=[{...vet2,annual:2,bonus:.8,until:last2-1,since:last2-2,slot:0}];
  const opts=talentRenewalOptions(pr.talents[0]);
  assert(opts.length===2&&opts[0].seasons===1&&opts[1].action==='leave','extension capped at the retirement season');
  // Mercato : aucune place libre, ou plus aucun talent libre, pas de mercato.
  pr.talents=[0,1,2].map(i=>({...MERCATO_TALENTS[i+3],annual:1,bonus:.5,until:gameState.season+1,since:gameState.season,slot:i}));
  assert(generateMercato()===null,'no mercato when every talent slot is taken');
  pr.talents=[];const nC=gameState.competitors.length;
  gameState.competitors.forEach((c,i)=>{c.talents=MERCATO_TALENTS.filter((_,k)=>k%nC===i).map(t=>({...t,until:gameState.season+1}));});
  assert(generateMercato()===null,'no mercato when every talent is under contract');
  gameState.competitors[0].talents.shift();
  const mk1=generateMercato();assert(mk1&&mk1.offers.length===1,'mercato with the only free talent');
  gameState.competitors.forEach(c=>{c.talents=[];});
}
// Conférence de rentrée : jamais sur une case d'événement ; grille faite d'événements, aucune.
{
  render=()=>{};resetGame();const pk=gameState.player;pk.name='Rentree';pk.type='generaliste';pk.target='a2549';finalizeChannelSetup();launchFirstSeason();
  gameState.season=2;ensureSportsRightsState();
  acquireSportsRight('courses_hippiques',{owner:'player',price:5});gameState.sportsRights.owned.at(-1).broadcastSeason=2;activateSportsBroadcasts();
  for(let k=0;k<30;k++){const kp=generateSeasonKickoffProposal();assert(!kp||kp.slot!=='matin','no kickoff on an event slot');}
  acquireSportsRight('olympic_games',{owner:'player',price:20});gameState.sportsRights.owned.at(-1).broadcastSeason=2;activateSportsBroadcasts();
  assert(TIME_SLOTS.every(s=>sportsBroadcastOn(pk,s.key))&&generateSeasonKickoffProposal()===null,'no kickoff when the grid is only events');
}
console.log('OK lead-in, competitors, careers, interaction, revenue, talents'+(typeof persistGameState==='function'?', persistence':''));

`;
const source = scripts.slice(0, -1).join('\n') + '\n' + tests;
vm.runInNewContext(source, { console }, { filename: 'audience-masters-simulation.js' });
