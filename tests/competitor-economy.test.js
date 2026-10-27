'use strict';
// Économie des concurrents IA : recettes du moteur commun, calendrier (prévisionnel, différence,
// régularisation), charges facturées une fois, contrats maintenus, droits sportifs, capacité
// commune, difficultés (renoncement, apport plafonné, austérité), distribution, écrans sans effet,
// migration d'une ancienne sauvegarde, historique figé, identité comptable.
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const tests = String.raw`
const ok=(v,m)=>{if(!v) throw Error(m)};
const near=(a,b,e=1e-6)=>Math.abs(a-b)<e;
render=()=>{};
globalThis.localStorage={d:{},setItem(k,v){this.d[k]=String(v)},getItem(k){return k in this.d?this.d[k]:null}};
function partie(type='generaliste', seed=4242){
  let r=seed>>>0; Math.random=()=>{r=(Math.imul(r,1103515245)+12345)>>>0; return r/4294967296;};
  resetGame(); const p=gameState.player; p.name='Joueur'; p.type=type; p.target='a2549';
  finalizeChannelSetup(); gameState.campaign.seed=seed; launchFirstSeason();
  gameState.seasonKickoffPending=false; gameState.mercatoPending=false; p.tresorerie=900;
  return p;
}
const C=i=>gameState.competitors[i];
const identity=h=>near(h.opening+h.adRevenue+h.otherIncome+h.contributions-h.recurring-h.sportsRights-h.sportsProduction-h.oneOff-h.distributions,h.closing,0.01);
const ledgerIdentity=c=>{ const L=c.finance.season; return near(L.opening+L.ad+L.income+L.contribution-L.recurring-L.sportsRights-L.sportsProduction-L.oneOff-L.distribution,c.budget,0.01); };
// Clôture d'une saison (sans jouer les dilemmes) puis ouverture de la suivante.
function cloture(){ const p=gameState.player; gameState.history.push({season:gameState.season,resultatSaison:0}); closeCampaignSeason(); }
function suivante(){ gameState.step=7; startNewSeason(); gameState.seasonKickoffPending=false; gameState.mercatoPending=false; }

// ——— 1. Recettes : moteur commun, aucune rentrée forfaitaire ———
ok(typeof COMPETITOR_INCOME_RATE==='undefined','rentrée simplifiée supprimée');
{ const p=partie(); const c=C(0);
  const rowP=getCalculatedPDAs().find(r=>r.channel===p);
  c.target=p.target; c.popularite=p.popularite; c.puissanceCommerciale=p.puissanceCommerciale;
  const rows=[{channel:c,adPda:{[p.target]:rowP.adPda[p.target]}}];
  ok(near(competitorAdRevenue(c,rows),computeRevenusPub(rowP.adPda[p.target],p.target,p.popularite,p.puissanceCommerciale)),'même état commercial, même audience : mêmes recettes que le joueur');
  const m=adMarketModel(); ok(near(m.channels.find(x=>x.name===c.name).revenue,competitorAdRevenue(c)),'CA du marché publicitaire = recettes du moteur commun'); }

// ——— 2. Ouverture : charges une fois, prévisionnel crédité une fois ———
{ partie(); gameState.competitors.forEach(c=>{
    const f=c.finance, L=c.finance.season;
    ok(f.openedSeason===1&&L.adForecast>0&&near(L.ad,L.adForecast),'prévisionnel crédité à l’ouverture');
    ok(near(L.recurring,competitorAnnualCharges(c).total),'charges annuelles de la grille et des talents facturées');
    ok(L.oneOff===0,'grille initiale : aucun droit d’entrée repayé');
    const b=c.budget; ok(!openCompetitorSeason(c)&&c.budget===b,'ouverture idempotente');
    ok(ledgerIdentity(c),'identité du grand livre'); }); }

// ——— 3. Clôture : seule la différence est créditée, historique figé ———
{ partie(); const c=C(1), L=c.finance.season, avant=c.budget, forecast=L.adForecast;
  c.puissanceCommerciale=Math.min(1.15,c.puissanceCommerciale+0.1); // recettes en hausse
  const final=competitorAdRevenue(c);
  cloture();
  const h=c.finance.history.at(-1);
  ok(h&&near(h.adRevenue,final,0.01)&&final>forecast,'recettes définitives = recettes du moteur à la clôture');
  ok(near(c.budget-avant+h.distributions,final-forecast+h.contributions,0.01),'seule la différence est créditée');
  ok(identity(h),'identité comptable de la saison');
  const fige=JSON.stringify(h); closeCompetitorSeason(c,getCalculatedPDAs()); ok(JSON.stringify(c.finance.history.at(-1))===fige&&c.finance.history.length===1,'clôture idempotente');
  suivante(); ok(JSON.stringify(c.finance.history[0])===fige,'historique clôturé inchangé à la saison suivante'); }

// ——— 4. Contrats : échéance conservée, renouvellement et acquisitions facturés ———
{ partie(); const c=C(0);
  // Contrat à échéance lointaine : maintenu, il garde son échéance.
  const slot='prime', k=c.contracts[slot]; k.end=gameState.season+3; const end=k.end;
  cloture(); suivante();
  const k2=c.contracts[slot];
  if(sameProgram(k2,k)) ok(k2.end===end,'programme maintenu : échéance inchangée ('+k2.end+' / '+end+')');
  ok(c.finance.season.recurring>0&&near(c.finance.season.recurring,competitorAnnualCharges(c).total),'saison 2 : charges facturées une fois');
  const due=Object.values(c.plan.rightsDue||{}).reduce((a,b)=>a+b,0);
  ok(near(c.finance.season.oneOff,due),'droits d’entrée des seules nouvelles acquisitions'); }
{ partie(); const c=C(2); Object.values(c.contracts).forEach(k=>{ k.end=gameState.season; });
  cloture(); suivante();
  const nouveaux=Object.entries(c.plan.slots).filter(([,d])=>d.isNew&&!d.isSportsEvent);
  nouveaux.forEach(([slot])=>ok(c.contracts[slot].end>=gameState.season,'nouveau contrat signé : '+slot));
  ok(near(c.finance.season.oneOff,Object.values(c.plan.rightsDue||{}).reduce((a,b)=>a+b,0)),'contrats échus : renouvellement ou acquisition facturés'); }

// ——— 5. Droits sportifs : prix et production facturés une seule fois ———
{ partie(); const c=C(0), ev=Object.values(SPORT_RIGHTS_EVENTS).find(e=>!e.category&&!e.recurring);
  const b=c.budget, L=c.finance.season;
  const recs=acquireSportsRight(ev.id,{owner:c,price:10,term:2});
  ok(near(b-c.budget,10)&&near(L.sportsRights,10),'droits de la première saison payés à la signature');
  ok(near(competitorSportsDues(c).future,10+2*ev.productionCost),'engagements : prix différé et productions');
  const cap=competitorCapacity(c);
  cloture(); suivante();
  const L2=c.finance.season;
  ok(near(L2.sportsProduction,ev.productionCost)&&L2.sportsRights===0,'saison de diffusion : production seule');
  activateSportsBroadcasts(); ok(near(c.finance.season.sportsProduction,ev.productionCost),'pas de seconde facturation');
  cloture(); suivante(); ok(near(c.finance.season.sportsRights,10)&&near(c.finance.season.sportsProduction,ev.productionCost),'deuxième saison : prix différé et production, une fois'); }

// ——— 6. Capacité commune : une acquisition réduit la capacité suivante ———
{ partie(); const c=C(1); const avant=competitorCapacity(c);
  competitorBook(c,'oneOff',8,'Acquisition test'); ok(near(avant-competitorCapacity(c),8),'acquisition : capacité réduite d’autant');
  const ev=Object.values(SPORT_RIGHTS_EVENTS).find(e=>!e.category);
  const bid1=computeCompetitorSportsMaxBid(c,ev); competitorBook(c,'oneOff',c.budget,'Vide la trésorerie');
  ok(computeCompetitorSportsMaxBid(c,ev)===0&&bid1>=0,'sans marge : aucune enchère');
  ok(competitorCapacity(c)<0,'capacité négative'); }
// Sans marge : pas de riposte, pas de recrutement, pas de renforcement.
{ const p=partie(); gameState.season=2; gameState.competitors.forEach(c=>competitorBook(c,'oneOff',c.budget+5,'Vide la trésorerie'));
  const before=gameState.competitors.map(c=>c.budget);
  p.contracts.prime={...PROGRAM_CATALOG.find(x=>x.id==='p036'),career:{historic:true,awareness:90,loyalty:90,wear:10,seasonsCount:5}};
  strategicCompetitors();
  ok(gameState.competitors.every((c,i)=>c.budget===before[i]),'sans marge : aucune riposte payée');
  ok(gameState.competitors.every(c=>competitorTalentInterest(c,{specialty:'diverti',affinities:{a2549:1,j1524:1,s50:1,csp:1}})<1),'sans marge : intérêt réduit pour les talents');
  ok(interestedCompetitor(1,PROGRAM_CATALOG[0])===null,'sans marge : aucun concurrent ne surenchérit'); }

// ——— 7. Difficultés : apport plafonné, historisé, austérité ; résultat inchangé ———
{ partie(); const c=C(3); competitorBook(c,'oneOff',c.budget+30,'Pertes');
  cloture(); const h=c.finance.history.at(-1), cap=COMPETITOR_ECONOMY.support.cap*CHANNEL_TYPES[c.type].baseBudget;
  ok(h.contributions>0&&h.contributions<=cap+1e-9&&c.finance.supports.length===1,'apport d’actionnaire plafonné et historisé');
  ok(near(h.result,h.adRevenue+h.otherIncome-h.recurring-h.sportsRights-h.sportsProduction-h.oneOff),'l’apport n’améliore pas le résultat');
  ok(identity(h)&&competitorAusterity(c),'identité et austérité');
  suivante(); ok(Object.values(c.contracts).every(k=>(k.investLevel??0)<=COMPETITOR_ECONOMY.support.austerityLevel),'austérité : niveaux de production plafonnés');
  // Au plus maxSupports apports par fenêtre : ensuite, plus d'apport.
  for(let k=0;k<3;k++){ competitorBook(c,'oneOff',Math.max(0,c.budget)+30,'Pertes'); cloture(); suivante(); }
  ok(c.finance.supports.filter(s=>gameState.season-s.season<COMPETITOR_ECONOMY.support.window).length<=COMPETITOR_ECONOMY.support.maxSupports,'apports limités');
  ok(c.budget<0||c.finance.supports.length<=COMPETITOR_ECONOMY.support.maxSupports,'aucun renflouement silencieux'); }

// ——— 8. Distribution : au-delà de la cible, sans toucher au résultat ———
{ partie(); const c=C(4); competitorBook(c,'income',500,'Recette test');
  cloture(); const h=c.finance.history.at(-1);
  ok(h.distributions>0&&identity(h)&&c.budget<competitorTreasuryTarget(c)+500,'excédent distribué');
  ok(near(h.result,h.adRevenue+h.otherIncome-h.recurring-h.sportsRights-h.sportsProduction-h.oneOff),'distribution hors résultat'); }

// ——— 9. Écrans et recalculs sans effet financier ———
{ partie(); const snap=JSON.stringify(gameState.competitors.map(c=>[c.budget,c.finance]));
  adMarketModel(); adMarketSnapshot(); gameState.competitors.forEach(c=>{ renderCompetitorSheet(c); competitorFinanceHtml(c); competitorCapacity(c); competitorFinanceState(c); });
  ok(JSON.stringify(gameState.competitors.map(c=>[c.budget,c.finance]))===snap,'affichages et estimations : aucun solde modifié'); }

// ——— 10. Migration d'une ancienne sauvegarde ———
{ partie(); gameState.season=3;
  gameState.competitors.forEach(c=>{ delete c.finance; c.plan.season=3; c.budget=30; });
  const save=JSON.parse(JSON.stringify(gameState)); gameState=save;
  ensureCampaign();
  gameState.competitors.forEach(c=>ok(c.finance.boundary===4&&c.finance.openedSeason===3&&c.budget===30,'saison entamée : saison de transition, solde conservé'));
  openCompetitorSeasons(); ok(gameState.competitors.every(c=>c.budget===30),'aucune refacturation de la saison en cours');
  cloture(); gameState.competitors.forEach(c=>{ const h=c.finance.history.at(-1); ok(h.transition&&h.recurring===0&&identity(h),'transition : recettes définitives seulement'); });
  const after=gameState.competitors.map(c=>c.budget); closeCampaignSeason(); ok(gameState.competitors.every((c,i)=>c.budget===after[i]),'clôture rejouée : aucun flux');
  suivante(); gameState.competitors.forEach(c=>ok(c.finance.openedSeason===4&&c.finance.season.recurring>0,'nouvelles règles dès la frontière')); }
// Partie entre deux saisons (saison close sous les anciennes règles) : rien n'est recrédité.
{ partie(); gameState.history.push({season:1}); gameState.competitors.forEach(c=>{ delete c.finance; });
  ensureCampaign(); ok(gameState.competitors.every(c=>c.finance.closedSeason===1),'saison close : pas de seconde clôture');
  const b=gameState.competitors.map(c=>c.budget); closeCampaignSeason(); ok(gameState.competitors.every((c,i)=>c.budget===b[i]),'aucun double crédit'); }

// ——— 11. Plusieurs saisons : identité de chaque saison clôturée ———
{ partie('sport',77); for(let k=0;k<6;k++){ cloture(); suivante(); }
  gameState.competitors.forEach(c=>{ ok(c.finance.history.length===6&&c.finance.history.every(identity),'identité sur 6 saisons : '+c.name);
    c.finance.history.slice(1).forEach((h,i)=>ok(near(h.opening,c.finance.history[i].closing,0.01),'continuité des soldes')); }); }
`;
const context = { console };
vm.runInNewContext(scripts.slice(0, -1).join('\n') + tests, context, { filename: 'audience-masters-competitor-economy.js' });
console.log('OK competitor economy: common ad engine, no flat income, opening/closing calendar, delta only, costs once, kept contracts, renewals, sports once, shared capacity, no-margin renunciation, capped support + austerity, distribution, read-only screens, migration, frozen history, accounting identity');
