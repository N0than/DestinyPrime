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
function setup(){gameState.player=mk('Joueur');gameState.competitors=[mk('Off','offensive'),mk('Rent','rentable'),mk('Jeune','jeune'),mk('Prem','premium'),mk('Autre','rentable')];gameState.season=1;gameState.competitorEvents=[];gameState.pendingCareerDecision=null;gameState.campaign={deadline:5,status:'active',seed:1};}
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
gameState.pendingCareerDecision={slot:'access',programId:'p-test'}; const oldWear=c.wear,oldCash=100;gameState.player.tresorerie=oldCash;gameState.player.achatsSaison=0;gameState.player.coutGrilleEngageSaison=10;render=()=>{};
assert(applyCareerDecision('modify')&&c.wear<oldWear&&gameState.player.tresorerie<oldCash,'modify career');
gameState.pendingCareerDecision={slot:'access',programId:'p-test'};const beforePotential=c.potential;applyCareerDecision('relaunch');assert(c.potential>beforePotential,'relaunch career');
gameState.pendingCareerDecision={slot:'access',programId:'p-test'};applyCareerDecision('renew');assert(c.lastDecision==='renew','renew career');
gameState.pendingCareerDecision={slot:'access',programId:'p-test'};applyCareerDecision('stop');assert(!gameState.player.contracts.access,'stop career');
setup(); gameState.player.pda={j1524:80,a2549:80,s50:80,csp:80}; let seq=Array(30).fill(0);seededRandom=()=>seq.shift()??0;
let events=strategicCompetitors();assert(events.some(e=>e.strategy==='offensive'),'offensive reacts');assert(gameState.competitors.find(x=>x.strategy==='jeune').slotInvestments[events.find(e=>e.strategy==='jeune')?.slot]?.targets.j1524>0,'young target');assert(gameState.competitors.find(x=>x.strategy==='premium').slotInvestments[events.find(e=>e.strategy==='premium')?.slot]?.targets.csp>0,'premium target');
const offPower=events.find(e=>e.strategy==='offensive').power,rentPower=events.find(e=>e.strategy==='rentable').power;assert(offPower>rentPower,'offensive stronger than profitable');
setup();gameState.player.pda={j1524:80,a2549:80,s50:80,csp:80};seededRandom=()=>.999;assert(strategicCompetitors().length===0,'reaction not systematic');
setup();gameState.player.slotAudienceDeltas.access={a2549:3};gameState.player.pda={j1524:50,a2549:50,s50:50,csp:50};seededRandom=()=>0;const pre=getCalculatedPDAs().find(x=>x.channel===gameState.player);const rev0=computeRevenusPub(pre.pda.a2549,'a2549',50,1);strategicCompetitors();const post=getCalculatedPDAs().find(x=>x.channel===gameState.player);const rev1=computeRevenusPub(post.pda.a2549,'a2549',50,1);assert(pre.leadIns.prime.a2549>0&&post.pda.a2549!==pre.pda.a2549&&rev1!==rev0,'full interaction and revenue');
gameState.player.contracts.access={...prog,career:createProgramCareer(prog,'access')};gameState.player.contracts.access.career.seasonsCount=3;
persistGameState();const saved=JSON.stringify(gameState.competitors);gameState.competitors=[];gameState.player.contracts={};assert(restoreGameState()&&JSON.stringify(gameState.competitors)===saved,'save competitor strategy');assert(gameState.player.contracts.access.career.seasonsCount===3,'save program career');
console.log('OK lead-in, competitors, careers, interaction, revenue, persistence');

`;
const source = scripts.slice(0, -1).join('\n') + '\n' + tests;
vm.runInNewContext(source, { console }, { filename: 'audience-masters-simulation.js' });
