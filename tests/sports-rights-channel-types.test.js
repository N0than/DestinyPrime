'use strict';
// Droits sportifs réservés aux chaînes généralistes et sportives : enchères (joueur et IA),
// dilemmes d'enchère, et transfert du joueur vers une chaîne Cinéma / Jeunesse / Culture / Info.
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const tests = String.raw`
const ok=(v,m)=>{if(!v) throw Error(m)};
render=()=>{};
globalThis.localStorage={d:{},setItem(){},getItem(){return null}};
function partie(type){ resetGame(); const p=gameState.player; p.name='J'; p.type=type; p.target='a2549';
  finalizeChannelSetup(); launchFirstSeason(); ensureSportsRightsState(); return p; }
const sports=Object.values(SPORT_RIGHTS_EVENTS).filter(isSportRight);
// 1. Dilemmes d'enchère sportifs : jamais proposés hors généraliste / sport.
for (const t of ['cinema','info','jeunesse','culture']) { partie(t);
  ok(!getEligibleDilemmas().some(d=>d.type==='sports_rights_auction'&&isSportRight(SPORT_RIGHTS_EVENTS[d.rightsEventId])),'aucune enchère sportive pour '+t); }
partie('generaliste'); ok(getEligibleDilemmas().some(d=>d.type==='sports_rights_auction'&&isSportRight(SPORT_RIGHTS_EVENTS[d.rightsEventId])),'enchères sportives pour une généraliste');
// 2. Chaînes IA : aucune offre ni reconduction hors généraliste / sport.
partie('generaliste');
for (const c of gameState.competitors) {
  const barred=!['generaliste','sport'].includes(c.type);
  sports.forEach(e=>{ ok(sportsRightBarred(c,e)===barred,'interdiction '+c.type);
    if(barred) ok(computeCompetitorSportsMaxBid(c,e)===0,'pas d’offre IA '+c.type+' '+e.id); }); }
// 3. Transfert vers une chaîne Cinéma détenant (ancienne partie) un droit sportif à venir : il est remis sur le marché.
{ partie('generaliste'); const c=gameState.competitors.find(x=>x.type==='cinema')||gameState.competitors[0]; c.type='cinema';
  gameState.sportsRights.owned.push({eventId:'ligue1',ownerId:'competitor',ownerName:c.name,broadcastSeason:gameState.season+1,acquisitionPrice:20});
  purgeBarredSportsRights(c);
  ok(!gameState.sportsRights.owned.some(o=>o.ownerName===c.name&&o.eventId==='ligue1'),'droit retiré à la chaîne Cinéma');
  ok(gameState.sportsRights.history.at(-1).type==='sports_rights_release','droit remis sur le marché'); }
console.log('OK sports rights channel types: auctions and dilemmas limited to generaliste/sport (player and AI), barred rights purged on transfer');
`;
vm.runInNewContext(scripts.slice(0, -1).join('\n') + tests, { console, structuredClone, URLSearchParams }, { filename: 'audience-masters-sports-types.js' });
