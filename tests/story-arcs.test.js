'use strict';
// Consolidation du lot 3 : scénarios déterministes des six arcs, capacités éditoriales, clés
// de situation, liens entre histoires propres au titre et arcs, options contextuelles,
// compatibilité de sérialisation et de restauration JSON de l'état.
// Chaque arc : ouverture par un choix compatible, mémorisation (décision, entité), délai,
// suite selon l'évolution observée, résolution et nettoyage des flags, expiration, abandon,
// revalidation d'une suite déjà dans la file, plafonds, ni double effet ni double ouverture.
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const tests = String.raw`
const ok=(v,m)=>{if(!v) throw Error(m)};
const near=(a,b,e=1e-6)=>Math.abs(a-b)<e;
render=()=>{};
globalThis.localStorage={d:{},setItem(k,v){this.d[k]=String(v)},getItem(k){return k in this.d?this.d[k]:null}};
const G=id=>GENRE_STORY_BANK.find(d=>d.id===id);
const S=id=>PROGRAM_STORY_BANK.find(d=>d.id===id);
const P=id=>PROGRAM_CATALOG.find(x=>x.id===id);
function partie(type='generaliste', seed=4242){
  let r=seed>>>0; Math.random=()=>{r=(Math.imul(r,1103515245)+12345)>>>0; return r/4294967296;};
  resetGame(); const p=gameState.player; p.name='Joueur'; p.type=type; p.target='a2549';
  finalizeChannelSetup(); gameState.campaign.seed=seed; launchFirstSeason();
  gameState.seasonKickoffPending=false; gameState.mercatoPending=false; p.tresorerie=900;
  return p;
}
function signe(id){ const x=P(id); const q=quoteProgram(x.slot,id,'interne'); ok(q?.allowed,'signature '+id); executeProgramSigning(x.slot,q);
  const c=gameState.player.contracts[x.slot]; migrateProgramCareer(c,x.slot); c.career.seasonsCount=3; c.end=gameState.season+3; return c; }
const slotOf=id=>P(id).slot, C=id=>gameState.player.contracts[slotOf(id)];
const ctxOf=(id,extra={})=>({...programStoryContext(slotOf(id),C(id),getCalculatedPDAs()),...extra});
function generic(defId,pid,extra={}){ const def=G(defId), ctx=ctxOf(pid,extra); const r=genericStoryCheck(def,ctx);
  return r.ok ? buildProgramStoryDilemma({def,slot:slotOf(pid),contract:C(pid),ctx,arc:r.arc,choices:r.choices}) : r.reason; }
function specific(defId,pid,extra={}){ const def=S(defId), ctx=ctxOf(pid,extra); const open=storySpecificStepArc(def,C(pid).id);
  return buildProgramStoryDilemma({def,slot:slotOf(pid),contract:C(pid),ctx,arc:open?storyArcView(open,storyArcOutcome(open,ctx)):null}); }
const idx=(d,re)=>{ const i=d.c.findIndex(c=>re.test(c.l)); ok(i>=0,'choix '+re+' dans '+d.id+' : '+d.c.map(c=>c.l).join(' / ')); return i; };
function joue(d,i){ ok(typeof d==='object','dilemme non construit : '+d); gameState.dilemmaQueue=[d,DILEMMA_BANK[0],DILEMMA_BANK[1]]; gameState.currentDilemmaIndex=0; gameState.dilemmaPhase='choosing'; gameState.step=6; chooseDilemmaOption(i); }
// Saison suivante ; l'évolution observée (succès, recul, mitigé) est fixée par la part de
// référence de l'arc, sans toucher au calcul d'audience.
function saisonSuivante(pid,outcome){
  gameState.season++; C(pid).end=Math.max(C(pid).end,gameState.season+2); updateStoryArcs();
  const arc=openStoryArcs(C(pid).id)[0];
  if(arc&&outcome){ const now=ctxOf(pid).ratio; arc.lastRatio=now+(outcome==='succes'?-0.5:outcome==='recul'?0.5:0); }
  return arc;
}
const arcOf=pid=>openStoryArcs(C(pid).id)[0];
const followIds=pid=>programStoryCandidates().filter(k=>k.contract.id===C(pid).id&&k.arc).map(k=>k.def.id);

// ——— 1. Clés de situation ———
Object.entries(STORY_SITUATION_KEYS).forEach(([id,key])=>{
  ok(S(id),'clé sur une histoire existante : '+id);
  ok(GENRE_STORY_BANK.some(d=>d.genericKey===key)||(key==='relance'&&NARRATIVE_ARCS.relance?.composed),'clé d’une situation générique : '+id+' → '+key);
});
ok(S('ps_p152_film_animation_annee').genericKey!=='animateur','« animation » n’est pas « animateur »');
ok(S('ps_p472_maison_couture').genericKey===null,'« couture » n’est pas un surcoût');
ok(S('ps_p071_duree').genericKey===null,'« film trop long » n’est pas une refonte');
ok(S('ps_p422_les_villes_candidates').genericKey===null,'« villes candidates » ne sont pas des candidats');
const report=storySituationReport();
ok(report.keyed+report.unkeyed===PROGRAM_STORY_BANK.length&&report.toReview.length>0,'diagnostic des histoires sans clé ('+report.unkeyed+', dont '+report.toReview.length+' signalées)');
Object.entries(SPECIFIC_ARC_LINKS).forEach(([id,l])=>{
  ok(S(id),'lien sur une histoire existante : '+id);
  Object.entries(l.choices).forEach(([i,c])=>{ ok(S(id).c[i],'choix existant : '+id+'/'+i);
    if(typeof c==='object') ok(NARRATIVE_ARCS[c.open]&&c.recall,'ouverture d’un arc connu, avec rappel : '+id); });
  if(l.arc) ok(NARRATIVE_ARCS[l.arc]&&l.step>=2,'étape d’un arc connu : '+id);
});

// ——— 2. Capacités éditoriales ———
{ partie();
  signe('p003'); ok(generic('gs_jury_conteste','p003')==='capacité : jury','magazine de recettes : pas de jury');
  ok(generic('gs_candidat_depart','p003')==='capacité : candidates','magazine de recettes : pas de candidat');
  signe('p009'); ok(generic('gs_candidat_depart','p009')==='capacité : candidates','jeu quotidien : pas de candidat suivi');
  ok(generic('gs_finale_exceptionnelle','p009',{form:'succes'})==='capacité : candidates','jeu quotidien : pas de finale de saison');
  signe('p284'); ok(typeof generic('gs_jury_conteste','p284')==='object','concours de pâtisserie : jury');
  ok(typeof generic('gs_candidat_depart','p284')==='object','concours de pâtisserie : candidats suivis');
  signe('p018'); ok(generic('gs_animateur_depart','p018')==='capacité : host','docu-réalité : pas de présentation incarnée');
  signe('p028'); ok(typeof generic('gs_suite_fiction_chere','p028',{form:'stable'})==='object','série : suite de fiction');
  ok(generic('gs_droits_film','p028')==='capacité : film','série produite : pas de « droits de film »'); }
{ partie('cinema');
  signe('p071'); ok(generic('gs_suite_fiction_chere','p071',{form:'stable'})==='capacité : serial','film unitaire : pas de suite de fiction');
  ok(typeof generic('gs_droits_film','p071')==='object','film sous licence : droits de diffusion');
  signe('p065'); ok(generic('gs_droits_film','p065')==='capacité : film','magazine de cinéma : pas de droits de film'); }
{ partie('sport');
  signe('p184'); ok(generic('gs_production_sport','p184')==='capacité : liveSport','magazine sportif : pas de dispositif de direct');
  signe('p180'); ok(typeof generic('gs_production_sport','p180')==='object','compétition : dispositif de direct'); }
{ partie();
  signe('p009'); gameState.player.isPlatform=true; C('p009').ownership='licence';
  ok(generic('gs_valorisation_digitale','p009')==='ressource : platform','plateforme sans droits : pas d’exploitation en ligne'); }
// Format original : capacités du concept choisi à la création.
{ const p=partie();
  const f=designOriginalFormat({concept:'realite',positioning:'populaire',slot:'prime',budget:2}); ok(f,'format original conçu');
  f.readySeason=gameState.season; ok(launchOriginalFormat(f.id),'format original lancé');
  const caps=programCapabilities(p.contracts.prime);
  ok(caps.has('candidates')&&caps.has('shoot')&&!caps.has('jury'),'télé-réalité originale : candidats et tournage, pas de jury'); }

// ——— 3. Arc « jury » (générique) : ouverture, délai, suite selon l'évolution, clôture ———
{ const p=partie(); signe('p284');
  const d=generic('gs_jury_conteste','p284'); const i=idx(d,/Renouveler tout le jury/);
  const achats=p.achatsSaison, annual=C('p284').annual; joue(d,i);
  ok(near(p.achatsSaison-achats,d.c[i].finance.purchase)&&near(C('p284').annual,annual),'achat débité une fois');
  const arc=arcOf('p284');
  ok(arc.arcId==='jury'&&arc.branch==='remplace'&&arc.entity.id==='p284'&&arc.history[0].defId==='gs_jury_conteste'&&arc.history[0].choice===d.c[i].story.index,'décision et entité mémorisées');
  ok(!followIds('p284').length,'pas de suite la même saison');
  joue(d,i); ok(openStoryArcs('p284').length===1,'pas de double ouverture');
  saisonSuivante('p284','recul');
  const ids=followIds('p284'); ok(ids.length===1&&ids[0]==='gs_jury_suite_recul','suite conforme au recul : '+ids);
  const s=generic('gs_jury_suite_recul','p284'); ok(s.storyRecall.includes('renouvelé tout le jury'),'rappel fidèle');
  ok(s.c.some(c=>/Rappeler une partie/.test(c.l))&&!s.c.some(c=>/Renouveler finalement/.test(c.l)),'choix réservés à la branche');
  arc.flags.push('test_jury'); programStoryRecord('p284').flags.test_jury=1;
  joue(s,idx(s,/Rappeler une partie/));
  ok(arc.state==='resolu'&&programStoryRecord('p284').flags.test_jury==null,'résolu, flags nettoyés'); }
// Arc « jury » ouvert par l'histoire propre au titre (MasterCuisto), suite propre au titre.
{ const p=partie(); signe('p032');
  const d=specific('ps_p032_jury','p032'); const annual=C('p032').annual, achats=p.achatsSaison;
  const i=idx(d,/promouvoir une jeune cheffe/); ok(d.c[i].finance.category==='N','choix sans flux financier');
  joue(d,i);
  ok(near(C('p032').annual,annual)&&near(p.achatsSaison,achats),'ouverture d’arc : aucun effet ajouté');
  const arc=arcOf('p032'); ok(arc?.arcId==='jury'&&arc.history[0].defId==='ps_p032_jury'&&/jeune cheffe/.test(arc.history[0].recall),'arc ouvert par le titre, décision réelle mémorisée');
  ok(arc.flags.includes('nouveau_jury'),'drapeau de l’ouverture rattaché à l’arc');
  saisonSuivante('p032','succes');
  const cands=programStoryCandidates().filter(k=>k.contract.id==='p032');
  ok(cands.some(k=>k.def.id==='ps_p032_jury_suite'&&k.arc)&&!cands.some(k=>k.def.arc?.id==='jury'),'suite propre au titre prioritaire sur la suite générique');
  const s=specific('ps_p032_jury_suite','p032'); ok(s.storyArc?.arcId==='jury'&&/jeune cheffe/.test(s.storyRecall),'suite propre : étape d’arc et rappel fidèle');
  joue(s,0); ok(arc.state==='resolu'&&programStoryRecord('p032').flags.nouveau_jury==null,'arc résolu par la suite propre, drapeau retiré'); }

// ——— 4. Arc « présentation » : talent compatible, suite, abandon ———
{ const p=partie(); signe('p009');
  let d=generic('gs_animateur_depart','p009'); ok(!d.c.some(c=>/Confier/.test(c.l)),'sans talent compatible : pas d’option interne');
  const genre=channelSlotProfile(p,'matin').genre, t=MERCATO_TALENTS.find(m=>m.specialty===genre);
  p.talents=[{id:t.id,name:t.name,specialty:t.specialty,role:t.role,annual:1,until:gameState.season+3,since:gameState.season}];
  d=generic('gs_animateur_depart','p009'); const i=idx(d,/Confier/); ok(d.c[i].l.includes(t.name),'talent nommé');
  const achats=p.achatsSaison; joue(d,i); ok(near(p.achatsSaison-achats,d.c[i].finance.purchase),'coût de l’option appliqué une fois');
  const arc=arcOf('p009'); ok(arc.branch==='interne'&&arc.history[0].recall.includes(t.name),'branche interne, talent dans le rappel');
  saisonSuivante('p009','succes'); ok(followIds('p009')[0]==='gs_animateur_suite_succes','suite « succès »');
  // Abandon : le programme quitte la grille avec la suite déjà dans la file.
  const s=generic('gs_animateur_suite_succes','p009');
  gameState.dilemmaQueue=[DILEMMA_BANK[0],s,DILEMMA_BANK[1]]; gameState.currentDilemmaIndex=0; gameState.dilemmaPhase='choosing';
  delete p.contracts.matin; revalidateNarrativeQueue();
  ok(!gameState.dilemmaQueue.some(x=>x.id===s.id)&&arc.state==='abandonne','suite retirée, arc abandonné'); }
// Présentation : ouverture par l'histoire propre au titre (Le Grand journal).
{ partie('info'); signe('p227');
  const d=specific('ps_p227_presentateur','p227'); joue(d,idx(d,/promouvoir une journaliste/));
  const arc=arcOf('p227'); ok(arc?.arcId==='animateur'&&arc.branch==='interne'&&/journaliste de la rédaction/.test(arc.history[0].recall),'présentation : arc ouvert par le titre');
  saisonSuivante('p227','recul'); const ids=followIds('p227'); ok(ids[0]==='gs_animateur_suite_mitige','suite générique adaptée au recul : '+ids);
  const s=generic('gs_animateur_suite_mitige','p227'); joue(s,idx(s,/ancien chroniqueur/)); ok(arc.state==='resolu','présentation résolue'); }

// ——— 5. Arc « refonte » à trois étapes (générique), puis ouverture par le titre ———
{ partie(); signe('p009'); C('p009').career.wear=55;
  const d=generic('gs_formule_usee','p009'); joue(d,idx(d,/refonte complète/));
  const arc=arcOf('p009'); ok(arc.arcId==='refonte'&&arc.branch==='complete','refonte ouverte');
  saisonSuivante('p009'); arc.lastRatio=ctxOf('p009').ratio; arc.lastOutcome=null;
  const m=generic('gs_refonte_mitige','p009',{form:'stable'}); ok(typeof m==='object','suite « mitigé » : '+m);
  joue(m,idx(m,/second ajustement/)); ok(arc.state==='open'&&arc.step===2,'étape 2 : l’arc avance');
  saisonSuivante('p009'); ok(followIds('p009').includes('gs_refonte_cloture'),'étape 3 proposée');
  const c=generic('gs_refonte_cloture','p009'); joue(c,idx(c,/Graver/)); ok(arc.state==='resolu'&&arc.history.length===3,'refonte résolue en trois étapes'); }
{ const p=partie(); signe('p034'); C('p034').career.wear=55;
  const d=specific('ps_p034_refonte','p034'); const i=idx(d,/Refonte complète/); const achats=p.achatsSaison;
  joue(d,i); ok(near(p.achatsSaison-achats,d.c[i].finance.purchase),'effet du titre appliqué une seule fois');
  const arc=arcOf('p034'); ok(arc.arcId==='refonte'&&arc.flags.includes('refonte'),'arc ouvert par le titre, drapeau rattaché');
  saisonSuivante('p034');
  ok(programStoryCandidates().some(k=>k.def.id==='ps_p034_refonte_suite'&&k.arc),'suite propre au titre éligible malgré la même situation');
  const s=specific('ps_p034_refonte_suite','p034'); joue(s,0); ok(arc.step===2&&arc.state==='open','suite propre : l’arc avance');
  saisonSuivante('p034'); ok(followIds('p034').includes('gs_refonte_cloture'),'étape générique suivante'); }

// ——— 6. Arc « riposte » : concurrent réel, rappel, expiration ———
{ partie(); signe('p009');
  ok(generic('gs_pression_concurrente','p009',{pressure:false})==='conditions : pression concurrentielle','sans pression : pas de riposte');
  const d=generic('gs_pression_concurrente','p009',{pressure:true}); ok(typeof d==='object'&&d.storyRival,'concurrent réel');
  joue(d,idx(d,/Contre-programmer/)); const arc=arcOf('p009');
  ok(arc.arcId==='offensive'&&arc.rival===d.storyRival,'concurrent mémorisé');
  saisonSuivante('p009','succes'); const s=generic('gs_offensive_succes','p009'); ok(s.titre.includes(esc(arc.rival)),'suite : même concurrent');
  // Expiration : une occasion notée après la dernière étape → « non retenue ».
  arc.occasions=[gameState.season];
  gameState.season+=4; C('p009').end=gameState.season+1; updateStoryArcs(); ok(arc.state==='expire'&&arc.closeCause==='non_retenue','expiration malgré une occasion'); }
{ partie(); signe('p001');
  const d=specific('ps_p001_bataille','p001',{pressure:true}); joue(d,idx(d,/éditions régionales/));
  const arc=arcOf('p001'); ok(arc?.arcId==='offensive'&&arc.branch==='renfort'&&arc.history[0].recall.includes(esc(arc.rival)),'riposte ouverte par le titre, concurrent dans le rappel');
  gameState.season+=4; C('p001').end=gameState.season+1; updateStoryArcs(); ok(arc.state==='expire'&&arc.closeCause==='sans_suite','expiration sans suite devenue éligible'); }

// ——— 7. Arc « surcoût » : partenaire, commande réductible ———
{ const p=partie(); signe('p028');
  C('p028').end=gameState.season; let d=generic('gs_surcout_tournage','p028');
  ok(!d.c.some(c=>/Réduire la commande/.test(c.l))&&!d.c.some(c=>/Renégocier/.test(c.l)),'sans saison restante ni partenaire : options absentes');
  C('p028').end=gameState.season+2; C('p028').partnerId='prod-test';
  d=generic('gs_surcout_tournage','p028'); ok(d.c.some(c=>/Renégocier/.test(c.l)),'partenaire : renégociation proposée');
  const i=idx(d,/Réduire la commande/); const a=C('p028').annual;
  joue(d,i); ok(d.c[i].finance.recurring<0&&near(C('p028').annual-a,d.c[i].finance.recurring),'économie appliquée au programme');
  const arc=arcOf('p028'); ok(arc.branch==='reduit','branche « commande réduite »');
  saisonSuivante('p028','mitige'); const ids=followIds('p028'); ok(ids.length===1&&ids[0]==='gs_surcout_commande','suite propre à la branche : '+ids);
  const s=generic('gs_surcout_commande','p028'); const j=idx(s,/Rétablir/); const a2=C('p028').annual, g=p.coutGrilleEngageSaison;
  joue(s,j); ok(near(C('p028').annual-a2,s.c[j].finance.recurring)&&near(p.coutGrilleEngageSaison-g,s.c[j].finance.recurring),'coût récurrent une seule fois');
  ok(arc.state==='resolu','surcoût résolu'); }
{ const p=partie(); signe('p028'); C('p028').partnerId='prod-test';
  const d=generic('gs_surcout_tournage','p028'); const i=idx(d,/Renégocier/); const achats=p.achatsSaison;
  joue(d,i); ok(near(p.achatsSaison-achats,d.c[i].finance.purchase)&&arcOf('p028').branch==='renegocie','renégociation appliquée, branche mémorisée'); }

// ——— 8. Arc « développement en ligne » : plateforme et droits ———
{ const p=partie(); signe('p009');
  ok(generic('gs_valorisation_digitale','p009')==='ressource : platform','sans plateforme : rien');
  p.isPlatform=true; C('p009').ownership='owned';
  const d=generic('gs_valorisation_digitale','p009'); joue(d,idx(d,/contenus exclusifs/));
  const arc=arcOf('p009'); saisonSuivante('p009','succes');
  const s=generic('gs_digital_succes','p009'); joue(s,idx(s,/Élargir/)); ok(arc.step===2,'en ligne : étape 2');
  saisonSuivante('p009'); const c=generic('gs_digital_cloture','p009'); const k=idx(c,/Pérenniser/); const com=p.commercialSaison;
  joue(c,k); ok(near(p.commercialSaison-com,c.c[k].finance.commercial)&&arc.state==='resolu','recette commerciale une fois, arc résolu'); }
{ partie(); signe('p020');
  let d=specific('ps_p020_numerique','p020'); joue(d,0); ok(!openStoryArcs().length,'sans plateforme : l’histoire du titre garde ses effets, sans arc');
  const q=partie(); signe('p020'); q.isPlatform=true; C('p020').ownership='coproduction';
  d=specific('ps_p020_numerique','p020'); joue(d,0); ok(arcOf('p020')?.arcId==='digital','plateforme et droits : l’histoire du titre ouvre l’arc'); }
// Option contextuelle « plateforme » sur une finale de concours.
{ const p=partie(); signe('p284');
  let d=generic('gs_finale_exceptionnelle','p284',{form:'succes'}); ok(!d.c.some(c=>/plateforme/.test(c.l)),'finale sans plateforme : pas de vote en ligne');
  p.isPlatform=true; C('p284').ownership='owned';
  d=generic('gs_finale_exceptionnelle','p284',{form:'succes'}); const k=idx(d,/plateforme/); const com=p.commercialSaison;
  joue(d,k); ok(near(p.commercialSaison-com,d.c[k].finance.commercial),'vote en ligne : recette appliquée une fois'); }

// ——— 9. Plafonds ———
{ partie(); ['p009','p378','p022'].forEach(signe); C('p009').career.wear=55;
  joue(generic('gs_formule_usee','p009'),0); joue(generic('gs_jury_conteste','p378'),0); joue(generic('gs_surcout_tournage','p022'),0);
  ok(openStoryArcs().length===3,'trois arcs ouverts');
  signe('p256'); ok(generic('gs_formule_usee','p256',{wear:60})==='plafond d’arcs','plafond par chaîne : aucune ouverture de plus'); }
// Un choix d'histoire propre ne force pas un arc au-delà du plafond.
{ partie(); signe('p032');
  gameState.player.storyArcs=[1,2,3].map(i=>({arcId:'refonte',step:1,branch:'retouche',state:'open',openedSeason:gameState.season,lastSeason:gameState.season,expiresSeason:gameState.season+6,
    entity:{kind:'programme',id:'p032',slot:'prime',name:'X'},flags:[],occasions:[],history:[{step:1,season:gameState.season,recall:'test'}]})).slice(0,1)
    .concat([2,3].map(i=>({arcId:'refonte',step:1,branch:'retouche',state:'open',openedSeason:gameState.season,lastSeason:gameState.season,expiresSeason:gameState.season+6,
    entity:{kind:'programme',id:'autre'+i,slot:'matin',name:'X'},flags:[],occasions:[],history:[{step:1,season:gameState.season,recall:'test'}]})));
  const jd=specific('ps_p032_jury','p032'); joue(jd,idx(jd,/jeune cheffe/));
  ok(!openStoryArcs('p032').some(a=>a.arcId==='jury')&&programStoryRecord('p032').flags.nouveau_jury!=null,'plafond atteint : effets du titre conservés, pas d’arc'); }

// ——— 10. Fenêtre de situation : répétition et continuation ———
{ partie(); signe('p284');
  programStoryRecord('p284').log.push({id:'gs_candidat_depart',choice:0,season:gameState.season}); programStoryRecord('p284').last=gameState.season-2;
  ok(generic('gs_candidat_depart','p284')==='conditions : déjà jouée','situation déjà jouée : exclue');
  partie(); signe('p032');
  const rec=programStoryRecord('p032'); rec.log.push({id:'gs_jury_conteste',choice:0,season:gameState.season-1}); rec.flags.nouveau_jury=gameState.season-1; rec.last=gameState.season-2;
  ok(programStoryCandidates().some(k=>k.def.id==='ps_p032_jury_suite'),'continuation propre au titre non exclue par la fenêtre');
  ok(!programStoryCandidates().some(k=>k.def.id==='ps_p032_jury'),'situation initiale propre exclue après sa variante générique');
  rec.log=[{id:'gs_jury_conteste',choice:0,season:gameState.season-NARRATIVE_TUNING.stories.genericWindow}]; delete rec.flags.nouveau_jury; rec.last=gameState.season-NARRATIVE_TUNING.stories.genericWindow;
  ok(programStoryCandidates().some(k=>k.def.id==='ps_p032_jury'),'hors fenêtre : la situation initiale propre revient'); }

// ——— 11. Compatibilité de sérialisation et de restauration JSON de l'état ———
const restaure=()=>{ gameState=JSON.parse(JSON.stringify(gameState)); };
{ const p=partie(); signe('p284'); delete p.storyArcs; delete p.programStories;
  restaure(); ok(Array.isArray(programStoryCandidates()),'état antérieur aux arcs : collecte');
  ensureCampaign(); ok(Array.isArray(gameState.player.storyArcs)&&!gameState.player.storyArcs.length,'arcs initialisés (??=)'); }
{ partie(); signe('p284');
  const d=generic('gs_jury_conteste','p284'); joue(d,idx(d,/Renouveler tout le jury/));
  const avant=JSON.stringify(gameState.player.storyArcs); const tres=gameState.player.tresorerie;
  restaure();
  ok(JSON.stringify(gameState.player.storyArcs)===avant&&gameState.player.tresorerie===tres,'arc ouvert restauré à l’identique, aucun effet réappliqué');
  saisonSuivante('p284','succes'); ok(followIds('p284')[0]==='gs_jury_suite_succes','suite après restauration');
  // Suite déjà dans la file au moment de la sérialisation.
  const s=generic('gs_jury_suite_succes','p284');
  ok(JSON.stringify(JSON.parse(JSON.stringify(s)))===JSON.stringify(s)&&!Object.values(s).some(v=>typeof v==='function'),'dilemme sans fonction indispensable');
  gameState.dilemmaQueue=[s,DILEMMA_BANK[0],DILEMMA_BANK[1]]; gameState.currentDilemmaIndex=0; gameState.dilemmaPhase='choosing'; gameState.step=6;
  restaure();
  const p=gameState.player, achats=p.achatsSaison, annual=C('p284').annual, f=gameState.dilemmaQueue[0].c[1].finance;
  ok(narrativeValid(gameState.dilemmaQueue[0]),'suite restaurée valide');
  chooseDilemmaOption(1);
  const arc=p.storyArcs.find(a=>a.arcId==='jury');
  ok(arc.state==='resolu'&&arc.history.length===2&&arc.history[1].defId==='gs_jury_suite_succes','suite restaurée jouée : arc résolu, étape mémorisée');
  ok(near(p.achatsSaison-achats,f.purchase)&&near(C('p284').annual,annual+f.recurring),'effets appliqués une seule fois'); }
`;
const context = { console };
vm.runInNewContext(scripts.slice(0, -1).join('\n') + tests, context, { filename: 'audience-masters-story-arcs.js' });
console.log('OK story arcs: situation keys, editorial capabilities, six arcs (open, delay, branch, resolve, expiry, abandonment, revalidation, caps), title-arc links, contextual options, JSON state restoration');
