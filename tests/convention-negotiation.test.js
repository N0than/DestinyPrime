'use strict';
// Renégociation de la convention au renouvellement : marge selon le score, hausses qui
// compensent les baisses, une seule demande, seuils appliqués au calcul des obligations.
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const tests = String.raw`
const ok=(v,m)=>{if(!v) throw Error(m)};
render=()=>{};
globalThis.localStorage={d:{},setItem(){},getItem(){return null}};
resetGame(); const p=gameState.player; p.name='J'; p.type='generaliste'; p.target='a2549';
finalizeChannelSetup(); launchFirstSeason();
ok(!evaluateConventionNegotiation({information:10},55).accepted,'baisse au-delà de la marge refusée');
ok(evaluateConventionNegotiation({information:10,fiction:35},55).accepted,'une hausse compense la baisse');
ok(!evaluateConventionNegotiation({information:14},40).accepted,'aucune baisse en cas de refus');
const r=submitConventionNegotiation({information:12,fiction:28});
ok(r.accepted&&p.conventionTerms.information===12,'seuils enregistrés');
ok(computeArcomCompliance().obligations.find(o=>o.id==='information').minimum===12,'appliqués au calcul');
ok(ARCOM_CONVENTIONS.generaliste.obligations[0].minimum===15,'référence inchangée');
ok(submitConventionNegotiation({information:30})===r,'une seule demande par renouvellement');
ok(/Soumettre/.test(conventionNegotiationHtml()),'panneau de négociation');
console.log('OK convention negotiation: margin by score, offsets, single request, applied thresholds');
`;
vm.runInNewContext(scripts.slice(0, -1).join('\n') + tests, { console, structuredClone, URLSearchParams }, { filename: 'audience-masters-nego.js' });
