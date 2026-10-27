'use strict';
// Évolutions des dilemmes : dilemmes reliés aux programmes (Saga d'été, Star sous le masque,
// Télécrochet culte, Champion du quiz, Marionnettes satiriques, Dessin animé produit en France),
// illustration du programme ou de l'événement, lignes de contexte masquées, CDI au troisième
// renouvellement d'un talent, contre-offres plus souples.
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const tests = String.raw`
const ok=(v,m)=>{if(!v) throw Error(m)};
const near=(a,b,e=1e-6)=>Math.abs(a-b)<e;
render=()=>{};
globalThis.localStorage={d:{},setItem(k,v){this.d[k]=String(v)},getItem(k){return k in this.d?this.d[k]:null}};
const B=id=>DILEMMA_BANK.find(d=>d.id===id);
const P=id=>PROGRAM_CATALOG.find(x=>x.id===id);
function partie(type='generaliste', seed=4242){
  let r=seed>>>0; Math.random=()=>{r=(Math.imul(r,1103515245)+12345)>>>0; return r/4294967296;};
  resetGame(); const p=gameState.player; p.name='Joueur'; p.type=type; p.target='a2549';
  finalizeChannelSetup(); gameState.campaign.seed=seed; launchFirstSeason();
  gameState.seasonKickoffPending=false; gameState.mercatoPending=false; p.tresorerie=900;
  // Grille sans programme détenu par un concurrent pour les formats proposés.
  gameState.competitors.forEach(c=>Object.keys(c.contracts||{}).forEach(k=>{ if(['p031','p036','p501'].includes(c.contracts[k]?.id)) delete c.contracts[k]; }));
  return p;
}
function signe(id){ const x=P(id); const q=quoteProgram(x.slot,id,'interne'); ok(q?.allowed,'signature '+id); executeProgramSigning(x.slot,q); return gameState.player.contracts[x.slot]; }
// Dilemme dynamique en file, matérialisé, puis choix i.
function enFile(id){ gameState.dilemmaQueue=[B(id),DILEMMA_BANK[0],DILEMMA_BANK[1]]; gameState.currentDilemmaIndex=0; gameState.dilemmaPhase='choosing'; gameState.step=6; return materializeCurrentDilemma(); }
function joue(i){ chooseDilemmaOption(i); ok(gameState.dilemmaPhase==='result','choix validé'); }
const eligible=id=>getEligibleDilemmas().some(d=>d.id===id);
const renouvelable=slot=>{ const c=gameState.player.contracts[slot]; gameState.season=c.end; return selectCareerDecisions().some(x=>x.slot===slot); };

// ——— Saga d'été : la série s'installe en prime, renouvelable ———
{ const p=partie();
  ok(eligible('d58'),'saga d’été proposée');
  const d=enFile('d58'); ok(d.dynamicOf==='d58'&&d.showcase[0].programId==='dp_saga_ete'&&d.c.length===2&&/Mystères de la lande/.test(d.desc),'dilemme relié à la série');
  const avant=p.tresorerie; joue(0);
  const c=p.contracts.prime; ok(c?.id==='dp_saga_ete'&&c.end===gameState.season+findProgram('dp_saga_ete').years-1,'série à la grille');
  ok(!eligible('d58'),'plus proposée une fois produite');
  ok(renouvelable('prime'),'série renouvelable en fin de contrat'); }
// ——— Retour de la Carte aux Trésors : le jeu s'installe en prime, renouvelable, passer son tour ———
{ const p=partie();
  ok(eligible('d68'),'Carte aux trésors proposée');
  const d=enFile('d68'); ok(d.dynamicOf==='d68'&&d.showcase[0].programId==='dp_carte_tresors'&&d.c.length===3&&/Carte aux trésors/.test(d.desc),'dilemme relié au jeu, illustré');
  ok(/Passer son tour/.test(d.c[2].l)&&d.c[2].finance.purchase===0,'choix pour passer son tour');
  ok(/carte aux tresors/.test(normalizeAudienceText(d.showcase[0].name||findProgram('dp_carte_tresors').name))&&TvPrograms.classify({name:'La Carte aux trésors',format:'jeu'}).genre==='aventure','illustration du jeu d’aventure');
  joue(1);
  const c=p.contracts.prime; ok(c?.id==='dp_carte_tresors'&&c.end===gameState.season+findProgram('dp_carte_tresors').years-1,'jeu à la grille');
  ok(!eligible('d68'),'plus proposé une fois produit');
  ok(renouvelable('prime'),'jeu renouvelable en fin de contrat'); }
{ const p=partie(); const avant=p.contracts.prime?.id; enFile('d68'); joue(2); ok(p.contracts.prime?.id===avant&&eligible('d68'),'passer son tour : grille inchangée'); }
{ partie('cinema'); ok(eligible('d58')&&findProgram('dp_saga_ete').power>=slotReference('cinema','prime').power,'chaîne Cinéma : saga au niveau de la case'); }

// ——— Star sous le masque : « Chanteurs masqués », trois choix, illustration ———
{ const p=partie();
  const d=enFile('d51'); ok(d.c.length===3&&d.showcase[0].programId==='p036'&&/Chanteurs masqués/.test(d.desc),'format relié à Chanteurs masqués, illustré');
  ok(d.c[2].l==='Ne pas prendre le format'&&d.c[2].finance.category==='N','troisième choix : ne pas prendre le format');
  ok(d.c[0].producerDeal.talentId==='vedette'&&d.c[0].finance.recurring>d.c[1].finance.recurring,'stars mondiales : production plus chère');
  const prime=p.contracts.prime?.id; joue(2); ok(p.contracts.prime?.id===prime,'format refusé : prime inchangé'); }
{ const p=partie(); enFile('d51'); joue(0); ok(p.contracts.prime?.id==='p036'&&p.contracts.prime.talent==='Prod. Internationale','format signé avec des stars mondiales');
  ok(!eligible('d51'),'plus proposé une fois à l’antenne'); }

// ——— Télécrochet culte : « Talent show », passer son tour ———
{ const p=partie();
  const d=enFile('d23'); ok(d.c.length===3&&d.showcase[0].programId==='p031'&&d.c[2].l==='Passer son tour','télécrochet relié à Talent show, choix de passer');
  joue(1); ok(p.contracts.prime?.id==='p031','Talent show signé en prime'); ok(renouvelable('prime'),'Talent show renouvelable'); }

// ——— Champion du quiz : seulement avec un jeu à l'antenne, case réelle ———
{ const p=partie();
  // Aucun jeu : la grille de base est remplacée par des magazines.
  ['matin','apresmidi','access'].forEach(slot=>{ p.grilleOverrides[slot]='Magazine'; delete p.contracts[slot]; });
  ok(!eligible('d62'),'sans jeu : pas de champion');
  signe('p009'); ok(eligible('d62'),'avec un jeu : champion proposé');
  const d=enFile('d62'); ok(/Un candidat du jeu du matin, « Motus »/.test(d.desc),'case du jeu dans la description : '+d.desc);
  ok(linkedProgramCardHtml(d).includes('Motus'),'carte illustrée du jeu');
  delete p.contracts.matin; p.grilleOverrides.matin='Magazine'; p.grilleOverrides.access='Jeu quotidien';
  ok(/Un candidat du jeu de l’access/.test(enFile('d62').desc),'jeu de l’access'); }

// ——— Marionnettes satiriques : « Les Guignols » (p501), access ———
{ const g=P('p501'); ok(g&&g.slot==='access'&&g.channelType==='generaliste'&&g.power>=3&&g.annual<=slotReference('generaliste','access').annual*1.5,'Les Guignols : access, performant, coût raisonnable');
  const p=partie(); ok(!eligible('d27'),'sans Les Guignols : pas de dilemme');
  signe('p501'); ok(eligible('d27'),'avec Les Guignols : dilemme proposé');
  const d=enFile('d27'); ok(/programme « Les Guignols »/.test(d.desc)&&linkedProgramCardHtml(d).includes('Les Guignols'),'dilemme nommé et illustré');
  joue(0); ok(gameState.lastConsequence.deltas.slots.some(s=>s.slot==='access'),'conséquences sur la case access'); }

// ——— Dessin animé produit en France : case animation, grille, studio, renouvelable ———
{ partie(); ok(!eligible('d69'),'généraliste sans case animation : pas de dessin animé'); }
{ const p=partie('jeunesse');
  ok(eligible('d69'),'chaîne jeunesse avec case animation');
  const d=enFile('d69'), slot=d.linkedSlot, id='dp_coccinelle@'+slot;
  ok(['matin','apresmidi'].includes(slot)&&d.showcase[0].programId===id,'case animation de la chaîne : '+slot);
  joue(0);
  const c=p.contracts[slot]; ok(c?.id===id&&c.ownership==='owned'&&c.original,'série à la grille, détenue par la chaîne');
  ok(studioSlotFormats().some(f=>f.id===id&&f.stage==='launched'),'série visible dans le Studio de création');
  ok(typeof studioFormatCardHtml(p.originalFormats[id],true,ORIGINAL_FORMATS)==='string','carte du Studio');
  ok(!eligible('d69'),'plus proposé ensuite');
  ok(renouvelable(slot),'série renouvelable');
  const g=JSON.parse(JSON.stringify(gameState)); ok(g.player.originalFormats[id].stage==='launched','sérialisable'); }

// ——— Événement : carte illustrée de Miss France dans le dilemme des Miss ———
{ partie(); gameState.season=3;
  acquireSportsRight('miss_france',{owner:'player',price:10,term:2}); gameState.sportsRights.owned.forEach(o=>{ if(o.eventId==='miss_france') o.broadcastSeason-=1; });
  ok(linkedProgramCardHtml(B('d30')).includes('Miss France'),'dilemme d’un événement : carte de l’événement'); }

// ——— Refonte du samedi soir : seulement sur une programmation de base, option « ne rien changer » ———
{ const p=partie(); delete p.contracts.prime; ok(eligible('d276'),'prime de base : refonte proposée');
  ok(B('d276').c.length===3&&B('d276').c[2].l==='Ne rien changer'&&B('d276').c[2].finance.category==='N','option ne rien changer');
  signe('p036'); ok(!eligible('d276'),'programme signé en prime : pas de refonte'); }

// ——— Agrandissement du studio : cinq variantes, une finalité (6 formats) ———
{ const p=partie(); const ids=[1,2,3,4,5].map(i=>'d_studio_'+i);
  ok(!ids.some(eligible),'studio peu occupé : pas de proposition');
  ['jeu','magazine'].forEach((concept,k)=>designOriginalFormat({concept,positioning:'populaire',slot:['matin','access'][k],budget:2}));
  ok(ids.filter(eligible).join()==='d_studio_1','une seule variante proposée');
  const d=enFile('d_studio_1'); ok(d.c[0].finance.purchase===10&&/doubler/.test(d.desc),'agrandissement à 10 M€');
  joue(1); ok(!p.studioExpanded&&studioMaxProjects()===3,'refus : 3 formats');
  ok(!ids.some(eligible),'refus : rien avant 10 saisons');
  gameState.season+=10; ok(ids.filter(eligible).join()==='d_studio_2','10 saisons plus tard : une autre variante');
  gameState.step=6; const d2=enFile('d_studio_2'); const achats=p.achatsSaison; joue(0);
  ok(p.studioExpanded&&studioMaxProjects()===6&&near(p.achatsSaison-achats,10),'acceptée : 6 formats, 10 M€');
  gameState.season+=20; ok(!ids.some(eligible),'acceptée : plus jamais proposée');
  for(let k=0;k<4;k++) ok(designOriginalFormat({concept:'jeu',positioning:'populaire',slot:'apresmidi',budget:1}),'format '+(k+3));
  ok(studioSlotFormats().length===6&&!designOriginalFormat({concept:'jeu',positioning:'populaire',slot:'apresmidi',budget:1}),'6 formats au plus');
  ok(/data-of-sel="5"/.test(renderStudioSlide()),'six emplacements dans le Studio'); }

// ——— Lignes de contexte masquées, « en fin de contrat » retiré ———
ok(!/en fin de contrat/.test(GENRE_STORY_BANK.find(d=>d.id==='gs_animateur_depart').desc),'départ d’animateur sans « en fin de contrat »');
{ partie(); const c=signe('p009'); migrateProgramCareer(c,'matin'); c.career.seasonsCount=4;
  const ctx=programStoryContext('matin',c,getCalculatedPDAs());
  ok(storyContextLine({when:{form:['succes']}},ctx,null)===''&&storyContextLine({},ctx,null)==='','forme et ancienneté : pas de ligne'); }

// ——— CDI au troisième renouvellement ———
{ const p=partie(); const t0=MERCATO_TALENTS.find(m=>!TALENT_RETIREMENT[m.id]);
  p.talents=[{id:t0.id,name:t0.name,specialty:t0.specialty,role:t0.role,annual:1,until:gameState.season,since:1,affinities:t0.affinities}];
  const t=p.talents[0];
  for(let k=1;k<=3;k++){ ok(pendingTalentRenewals().includes(t),'renouvellement dû '+k);
    const r=talentRenewalResult(t,talentRenewalOptions(t)[0]); ok(applyTalentRenewalAction(t.id,'extend'),'prolongé');
    ok(t.renewals===k&&!!t.cdi===(k===3),'CDI au 3e renouvellement seulement'); if(k===3) ok(/CDI/.test(r),'annonce du CDI');
    gameState.season=Math.min(t.until,gameState.season+5); t.nextAnnual=null; }
  ok(!pendingTalentRenewals().includes(t)&&t.until>gameState.season+50,'CDI : plus de fin de contrat');
  const ind=talentIndemnity(t); ok(ind.remaining===1+TALENT_CDI.indemnitySeasons,'rupture d’un CDI : indemnité plafonnée'); }

// ——— Contre-offres plus souples ———
{ partie(); const prog=PROGRAM_CATALOG.find(x=>x.channelType==='generaliste'&&x.slot==='prime'&&quoteProgram('prime',x.id,'interne')?.allowed);
  const q=quoteProgram('prime',prog.id,'interne');
  const ca=dealTermsFor(q,'aggressive',true), cb=dealTermsFor(q,'balanced',true), sec=dealTermsFor(q,'secure');
  ok(ca.annual<cb.annual&&cb.annual<q.annual&&cb.annual<sec.annual,'contre-offres sous le devis, d’autant plus basses que l’offre l’était');
  ok(near(counterPriceRate('aggressive'),0.62+0.38*0.5)&&counterPriceRate('balanced',3)<counterPriceRate('balanced',0),'la confiance rend le partenaire plus conciliant');
  ok(ca.exclusive&&cb.exclusive,'exclusivité accordée'); }
`;
const context = { console };
vm.runInNewContext(scripts.slice(0, -1).join('\n') + tests, context, { filename: 'audience-masters-dilemmas-update.js' });
console.log('OK dilemmas update: summer saga, treasure map (grid, renewal, pass), masked singers, talent show come-back, quiz champion slot, Les Guignols, French cartoon (grid, studio, renewal), linked illustrations, hidden context lines, CDI, softer counter-offers');
