'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const tests = String.raw`
const assert=(v,m)=>{if(!v) throw Error(m)};
const near=(a,b)=>Math.abs(a-b)<1e-7;
render=()=>{};
function setup(type='generaliste',cash=500){
 resetGame(); const p=gameState.player; p.name='Studio';p.type=type;
 p.target=({jeunesse:'j1524',culture:'csp',cinema:'csp',info:'s50'})[type]||'a2549';
 finalizeChannelSetup();launchFirstSeason();
 gameState.seasonKickoffPending=false;gameState.mercatoPending=false;
 gameState.step=6;gameState.currentDilemmaIndex=0;gameState.dilemmaPhase='choosing';p.tresorerie=cash;
 return p;
}
const expected={
 generaliste:['Fiction','Divertissement','Jeu','Télé-réalité','Magazine','Talk-show'],
 sport:['Magazine sportif','Talk-show sportif','Documentaire sportif','Compétition originale','Débat sportif','Divertissement sportif'],
 culture:['Documentaire','Magazine culturel','Vulgarisation','Investigation','Débat d’idées','Exploration'],
 info:['Talk-show','Débat','Documentaire','Investigation','Interview','Décryptage'],
 cinema:['Série dramatique','Comédie','Thriller / Polar','Science-fiction / Fantastique','Téléfilm','Magazine cinéma'],
 jeunesse:['Animation','Fiction jeunesse','Jeu jeunesse','Éducatif','Divertissement jeunesse','Aventure']
};
const catalogBefore=JSON.stringify(PROGRAM_CATALOG);
const allIds=[];
let launched=0;
for(const [type,labels] of Object.entries(expected)){
 setup(type);
 const options=studioGaugeOptions('concept');
 assert(JSON.stringify(options.map(o=>o.label))===JSON.stringify(labels),'six genres exacts : '+type);
 allIds.push(...options.map(o=>o.value));
 gameState.studioDraft={concept:'incompatible'};
 assert(options.some(o=>o.value===studioDraft().concept),'brouillon invalide corrigé : '+type);
 const alien=Object.keys(ORIGINAL_FORMATS.concepts).find(id=>!options.some(o=>o.value===id));
 const before=gameState.player.tresorerie;
 assert(!designOriginalFormat({concept:alien,positioning:'populaire',slot:'prime',budget:2}),'genre incompatible refusé : '+type);
 assert(gameState.player.tresorerie===before,'refus sans débit');
 for(const option of options){
  for(const slot of TIME_SLOTS.map(s=>s.key)){
   const p=setup(type),start=p.tresorerie,spent=p.achatsSaison;
   const f=designOriginalFormat({concept:option.value,positioning:'populaire',target:'invalid',slot,budget:2,requestId:'validation'});
   assert(f&&f.target===p.target&&f.conceptLabel===option.label,'genre conçu / cible de référence : '+option.value);
   assert(near(start-p.tresorerie,.25)&&near(p.achatsSaison-spent,.25),'250 000 € : '+option.value);
   assert(designOriginalFormat({requestId:'validation'})===f&&near(start-p.tresorerie,.25),'confirmation idempotente');
   assert(f.editorial.genre===ORIGINAL_FORMATS.concepts[option.value].editorialGenre,'profil éditorial : '+option.value);
   assert(Number.isFinite(f.power)&&Number.isFinite(f.annual),'potentiel / coût valides');
   assert(programGenreLabel(f)===option.label,'libellé distinct en programmation');
   assert(launchOriginalFormat(f.id)&&p.contracts[slot].id===f.id,'lancement : '+option.value+'/'+slot);
   assert(!launchOriginalFormat(f.id),'lancement unique');
   const calc=getCalculatedPDAs();
   assert(calc.every(row=>Object.values(row.pda).every(Number.isFinite)),'audience calculable');
   for(const target of ['j1524','a2549','s50','csp']){
    assert(near(calc.reduce((n,row)=>n+row.expectedSlots[slot][target],0),100),'audience de référence normalisée');
    assert(calc.every(row=>row.slots[slot][target]>=.1&&row.slots[slot][target]<=99.9),'audience finale bornée');
   }
   p.contracts[slot].end=gameState.season;
   const renewal=createCareerRenewalDilemma({slot,programId:f.id});
   assert(renewal&&renewal.c.length,'renouvellement disponible');
   if(option.value==='sport_competition')assert(f.ownership==='owned'&&!f.rightsEventId&&!sportsBroadcastOn(p,slot),'compétition produite, pas un droit acquis');
   launched++;
  }
 }
}
assert(new Set(allIds).size===36,'36 identifiants distincts');
assert(JSON.stringify(PROGRAM_CATALOG)===catalogBefore,'catalogue non modifié');
// Liquidités, journal financier et séparation des coûts.
for(const cash of [0,.249,-1]){
 const p=setup('info',cash),spent=p.achatsSaison;
 assert(!designOriginalFormat({concept:'info_debat',positioning:'populaire',slot:'prime',budget:2}),'fonds insuffisants');
 assert(p.tresorerie===cash&&p.achatsSaison===spent&&Object.keys(p.originalFormats).length===0,'aucune mutation financière si refus');
 gameState.studioForm=true;
 assert(/data-of-action="design" disabled/.test(renderStudioSlide()),'bouton bloqué sans fonds');
}
{
 const p=setup('generaliste',.25),spent=p.achatsSaison;
 const f=designOriginalFormat({concept:'jeu',positioning:'populaire',slot:'access',budget:2,requestId:'last-cash'});
 assert(f&&near(p.tresorerie,0)&&near(p.achatsSaison-spent,.25),'fonds exacts acceptés');
 assert(p.decisionHistory.filter(d=>d.id==='original-design-'+f.id).length===1,'dépense tracée une fois');
 assert(near(p.resultatSaison,p.revenusPubPrevisionnels+p.commercialSaison-p.coutGrilleEngageSaison-p.achatsSaison),'résultat mis à jour');
 assert(p.seasonSignals.some(s=>s.key==='design:'+f.id&&s.text.includes('250 000 €')&&s.text.includes('Trésorerie')),'notification dépense et solde');
 abandonOriginalFormat(f.id);assert(near(p.tresorerie,0),'abandon sans remboursement');
 const saved=JSON.parse(JSON.stringify(gameState));Object.assign(gameState,saved);ensureConsequenceState();
 assert(designOriginalFormat({requestId:'last-cash'}).id===f.id&&near(gameState.player.tresorerie,0),'rejeu après sauvegarde sans débit');
}
{
 const p=setup(),f=designOriginalFormat({concept:'fiction',positioning:'premium',slot:'prime',budget:3});
 const before=p.tresorerie,spent=p.achatsSaison;
 const pilot=Math.round(f.annual*ORIGINAL_FORMATS.devCost.pilot*10)/10;
 assert(developOriginalFormat(f.id,'pilot')&&near(before-p.tresorerie,pilot),'pilote indépendant');
 assert(!developOriginalFormat(f.id,'pilot')&&near(p.achatsSaison-spent,pilot),'pas de double pilote');
 gameState.season++;
 const quote=quoteProgram(f.slot,f.id,'interne'),cash=p.tresorerie;
 assert(launchOriginalFormat(f.id)&&near(cash-p.tresorerie,quote.immediate),'lancement facturé selon le devis uniquement');
 assert(p.decisionHistory.filter(d=>d.id==='original-design-'+f.id).length===1,'aucune nouvelle conception au lancement');
}
// Sauvegarde ancienne : concept historiquement incompatible, sans nouveaux champs.
{
 const p=setup('info');
 const f={id:'of-old',name:'Ancienne fiction',concept:'fiction',positioning:'premium',target:'csp',slot:'prime',budget:2,format:'fiction',channelType:'info',preferredSlot:'prime',years:1,level:2,ownership:'owned',original:true,annual:3,rights:1,power:2,reference:2,stage:'concept',designedSeason:1,readySeason:1,pitch:'Fiction premium',estimate:{stage:'direct',min:1,max:3}};
 f.editorial=programEditorialProfile(f);p.originalFormats[f.id]=f;
 const original=JSON.stringify(f),cash=p.tresorerie;
 Object.assign(gameState,JSON.parse(JSON.stringify(gameState)));ensureConsequenceState();
 assert(JSON.stringify(gameState.player.originalFormats[f.id])===original,'ancien format conservé');
 assert(studioFormatCardHtml(gameState.player.originalFormats[f.id],true,ORIGINAL_FORMATS).includes('Fiction'),'ancien libellé visible');
 assert(gameState.player.tresorerie===cash,'aucun débit rétroactif');
 assert(launchOriginalFormat(f.id),'ancien format toujours lançable');
 assert(gameState.player.contracts.prime.concept==='fiction','ancien genre conservé après lancement');
}
// Toutes les vues utilisent le même badge de rôle, y compris le verso.
{
 setup();const t={...MERCATO_TALENTS[0],name:'Un nom de talent particulièrement long pour les petites cartes',role:'Animateur',shortRole:'Animateur'};
 for(const opts of [{single:true,readonly:true},{choices:[{index:0,label:'Renouveler',cost:'1 M€',costCls:'cost'}]}]){
  const markup=talentRenewalCardHtml(t,opts);
  assert(markup.includes('gr-talent-card')&&markup.includes('gr-role-badge'),'carte avec badge de fonction');
  assert(/gr-name-row[\s\S]*?gr-name[\s\S]*?gr-role-badge/.test(markup),'badge sur la ligne du nom');
  if(opts.choices)assert(markup.match(/gr-role-badge/g).length===2,'badge au recto et au verso');
 }
}
console.log('OK studio: 36 genres, '+launched+' conceptions/lancements, audience, renouvellements, 250 000 €, idempotence, fonds, pilote, sauvegardes et talents');
`;
vm.runInNewContext(scripts.slice(0,-1).join('\n')+tests,{console},{filename:'audience-masters-studio.js'});
