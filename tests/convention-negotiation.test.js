'use strict';
// Renégociation de convention avec l'ARCOM : acceptation directe, refus motivé,
// contre-proposition (acceptée, maintenue : améliorée / maintenue / retirée), renoncement,
// seuils appliqués à la saison suivante, sauvegarde à chaque étape, planchers et marges,
// concessions passées, pas de nouvelle négociation après décision, appel intact.
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const tests = String.raw`
const ok=(v,m)=>{if(!v) throw Error(m)};
render=()=>{};
globalThis.localStorage={d:{},setItem(){},getItem(){return null}};
let SCORE=85, ROLL=0.5;
computeRenewalScore=()=>({renewalScore:SCORE,complianceAverage:SCORE});
seededRandom=()=>ROLL;
const reload=()=>{ gameState=JSON.parse(JSON.stringify(gameState)); };
function partie(score=85){
  SCORE=score; resetGame(); const p=gameState.player; p.name='J'; p.type='generaliste'; p.target='a2549';
  finalizeChannelSetup(); launchFirstSeason(); gameState.conventionNegotiation={season:gameState.season,open:true,phase:'edit'};
  return p;
}
const REF={information:15,fiction:25,culture:10,prodFrancaise:30,prodEuropeenne:20};
const req=o=>({...REF,...o});
const minOf=id=>()=>computeArcomCompliance().obligations.find(o=>o.id===id).minimum;

// 1. Toujours une contre-proposition, même dans la marge ; appliquée la saison suivante (7).
{ const p=partie(); const n=submitConventionNegotiation(req({information:13}));
  ok(n.phase==='counter'&&n.counter.information>13&&n.counter.information<15,'contre-proposition dans la marge'); reload();
  const r=acceptConventionCounter(); ok(r.status==='countered','accord'); reload();
  ok(minOf('information')()===15,'seuil inchangé pendant la saison en cours');
  gameState.season++; ok(minOf('information')()===n.counter.information,'appliqué à la saison suivante');
  ok(gameState.player.conventionHistory.at(-1).status==='countered','accord enregistré'); }
{ partie(); const n=submitConventionNegotiation(req({fiction:30})); ok(n.phase==='counter'&&n.counter.fiction===30,'hausse seule : proposée telle quelle'); }
// 2. Contre-proposition acceptée.
{ const p=partie(); const n=submitConventionNegotiation(req({information:9,fiction:15,culture:6}));
  ok(n.phase==='counter'&&n.round===1,'contre-proposition'); reload();
  const c=currentConventionNegotiation().counter;
  ok(c.information>9&&c.information<=15&&c.fiction>15&&c.fiction<=25,'baisses réduites, jamais au-delà de la demande');
  ok(negotiationBalance(c)>=-negotiationContext().margin-1e-9,'proposition dans la marge');
  ok(minOf('information')()===15,'aucun seuil appliqué avant l’accord');
  const r=acceptConventionCounter(); ok(r.status==='countered'&&r.accepted,'contre-proposition acceptée'); reload();
  gameState.season++; ok(minOf('information')()===c.information,'seuils proposés appliqués'); }
// 3. Maintien avec amélioration.
{ partie(); const n1=submitConventionNegotiation(req({information:9,fiction:15,culture:6})); const c1={...n1.counter};
  ROLL=0.3; SCORE=85; const n=maintainConventionRequest(); reload();
  ok(n.verdict==='improved'&&n.round===2,'proposition améliorée');
  ok(n.counter.information<=c1.information&&n.counter.fiction<=c1.fiction&&(n.counter.information<c1.information||n.counter.fiction<c1.fiction),'meilleure que la première');
  ok(maintainConventionRequest().round===2&&currentConventionNegotiation().counter.information===n.counter.information,'pas de troisième tour');
  ok(acceptConventionCounter().accepted,'acceptée'); }
// 4. Maintien sans amélioration.
{ partie(); const n1=submitConventionNegotiation(req({information:9,fiction:15,culture:6})); const c1={...n1.counter};
  ROLL=0.995; const n=maintainConventionRequest(); reload();
  ok(n.verdict==='maintained'&&JSON.stringify(n.counter)===JSON.stringify(c1),'proposition maintenue'); }
// 5. Retrait de l'offre.
{ const p=partie(); submitConventionNegotiation(req({information:9,fiction:15,culture:6}));
  ROLL=0; const r=maintainConventionRequest(); reload();
  ok(r.status==='withdrawn'&&!r.accepted&&!gameState.player.conventionAgreement,'offre retirée, convention inchangée'); }
// 6. Renoncement.
{ partie(); submitConventionNegotiation(req({information:9,fiction:15,culture:6})); const r=renounceConventionNegotiation(); reload();
  ok(r.status==='renounced'&&!gameState.player.conventionAgreement,'renoncement : convention inchangée');
  ok(gameState.player.conventionHistory.at(-1).status==='renounced','retrait enregistré'); }
// 9. Planchers, marges, refus motivé, poids et difficulté, concessions passées.
{ partie(); const b=negotiationBounds(ARCOM_CONVENTIONS.generaliste.obligations[0]); ok(b.min===9&&b.max===21,'planchers et plafonds');
  const n=submitConventionNegotiation(req({information:9,fiction:15,culture:6,prodFrancaise:18,prodEuropeenne:12}));
  ok(n.phase==='counter'&&negotiationBalance(n.counter)>=-negotiationContext().margin-1e-9,'demande excessive : contre-proposition dans la marge'); }
{ partie(); const ctx=negotiationContext();
  // Une hausse déjà tenue à l'antenne compte moins qu'une hausse exigeante.
  ctx.actual={...ctx.actual,fiction:99}; const easy=negotiationBalance(req({fiction:30}),ctx);
  ctx.actual={...ctx.actual,fiction:0}; const hard=negotiationBalance(req({fiction:30}),ctx); ok(hard>easy&&easy>0,'difficulté des hausses');
  // Baisse plus coûteuse sur une obligation mal respectée.
  const good=negotiationBalance(req({information:12}),ctx); ctx.history={...ctx.history,information:0};
  ok(negotiationBalance(req({information:12}),ctx)<good,'respect historique pris en compte');
  SCORE=55; ok(negotiationContext().margin===0.04,'marge selon le score'); }
{ const p=partie(); p.conventionHistory=[{season:0,status:'accepted',balance:-0.1}];
  ok(Math.abs(negotiationContext().margin-0.17)<1e-9,'concessions passées : marge réduite'); }
// 10. Pas de nouvelle négociation après décision ; sauvegarde (8).
{ partie(); submitConventionNegotiation(req({information:13})); acceptConventionCounter(); reload();
  ok(conventionNegotiationClosed()&&submitConventionNegotiation(req({information:9})).status==='countered','décision définitive');
  ok(renounceConventionNegotiation().status==='countered'&&acceptConventionCounter().status==='countered','aucun nouveau tour');
  ok(/Arbitrage|Soumettre/.test(conventionNegotiationHtml()),'panneau'); }
{ partie(); submitConventionNegotiation(req({information:9,fiction:15,culture:6})); ok(/Négociation ARCOM/.test(conventionNegotiationHtml())&&/Maintenir la demande/.test(conventionCounterHtml()),'carte de contre-proposition');
  ROLL=0.995; maintainConventionRequest(); ok(!/Maintenir la demande/.test(conventionCounterHtml()),'second arbitrage : plus de maintien'); }
// Compatibilité : ancienne sauvegarde (seuils directs, résultat booléen) et appel.
{ const p=partie(); p.conventionTerms={information:12}; delete p.conventionAgreement; ok(minOf('information')()===12,'ancien format de seuils');
  gameState.conventionNegotiation={season:gameState.season,open:false,result:{accepted:true}}; ok(conventionNegotiationClosed(),'ancien résultat clos');
  SCORE=30; const a=fileRenewalAppeal(); ok(a&&currentRenewalAppeal()===a,'appel intact'); }
console.log('OK convention negotiation: always counter, counter accepted, maintain improved / maintained / withdrawn, renounce, next-season thresholds, save/reload, floors & margins, past concessions, single decision, legacy saves, appeal');
`;
vm.runInNewContext(scripts.slice(0, -1).join('\n') + tests, { console, structuredClone, URLSearchParams }, { filename: 'audience-masters-nego.js' });
