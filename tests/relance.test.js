'use strict';
// Plan de relance d'un programme en baisse (v2.0) : gravité (4 composantes), économie (prix
// selon la valeur de la case, promesse selon la santé du contenu), jauges séparées, issues
// pondérées, arc « relance » en trois étapes composé à la volée, et recette a–j de la spec.
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const tests = String.raw`
const ok=(v,m)=>{if(!v) throw Error(m)};
const near=(a,b,e=1e-6)=>Math.abs(a-b)<e;
render=()=>{};
globalThis.localStorage={d:{},setItem(k,v){this.d[k]=String(v)},getItem(k){return k in this.d?this.d[k]:null}};
const P=id=>PROGRAM_CATALOG.find(x=>x.id===id);
function partie(seed=4242){
  let r=seed>>>0; Math.random=()=>{r=(Math.imul(r,1103515245)+12345)>>>0; return r/4294967296;};
  resetGame(); const p=gameState.player; p.name='Joueur'; p.type='generaliste'; p.target='a2549';
  finalizeChannelSetup(); gameState.campaign.seed=seed; launchFirstSeason();
  gameState.seasonKickoffPending=false; gameState.mercatoPending=false; p.tresorerie=900;
  return p;
}
function signe(id){ const x=P(id); const q=quoteProgram(x.slot,id,'interne'); ok(q?.allowed,'signature '+id); executeProgramSigning(x.slot,q);
  const c=gameState.player.contracts[x.slot]; migrateProgramCareer(c,x.slot); c.career.seasonsCount=3; c.end=gameState.season+3; return c; }
const PID='p009', slotOf=id=>P(id).slot, C=id=>gameState.player.contracts[slotOf(id)];
const S=()=>gameState.season;
const hard=k=>({season:S()-k,performance:0,expected:2});   // saison difficile close il y a k saisons
// Contexte de la case avec un état de déclin imposé (part, usure, pression, historique).
function rctx(o={}){
  const contract=C(PID); if(o.wear!=null) contract.career.wear=o.wear;
  const base=programStoryContext(slotOf(PID),contract,getCalculatedPDAs());
  const c={...base,form:'difficulte',...o};
  const g=relanceGravity({form:c.form,ratio:c.ratio,wear:c.wear,pressure:c.pressure,history:o.history||[],season:S()});
  return {...c,gravity:g.gravity,declineDepth:g.declineDepth,...relanceGauges(contract.id),...(o.gauges||{})};
}
function carte(ctx){
  const defs=composeRelanceStories(ctx); if(!defs.length) return null;
  const def=defs[0], r=genericStoryCheck(def,ctx); ok(r.ok,'carte '+def.id+' jouable : '+r.reason);
  return buildProgramStoryDilemma({def,slot:slotOf(PID),contract:C(PID),ctx,arc:r.arc,choices:r.choices});
}
const idx=(d,re)=>{ const i=d.c.findIndex(c=>re.test(c.l)); ok(i>=0,'choix '+re+' dans '+d.id+' : '+d.c.map(c=>c.l).join(' / ')); return i; };
// Issue imposée (succes, mitige, recul) pour un scénario déterministe.
function force(d,i,key){ const u=d.c[i].story.uncertain; ok(u,'choix incertain'); u.outcomes.forEach(o=>{o.p=o.key===key?1:0;}); }
function joue(d,i){ gameState.dilemmaQueue=[d,DILEMMA_BANK[0],DILEMMA_BANK[1]]; gameState.currentDilemmaIndex=0; gameState.dilemmaPhase='choosing'; gameState.step=6; chooseDilemmaOption(i); }
function suivante(){ gameState.season++; C(PID).end=Math.max(C(PID).end,S()+2); updateStoryArcs(); }
const arc=()=>openStoryArcs(C(PID).id).find(a=>a.arcId==='relance');

// ——— 1. Gravité : cas types de la spec ———
{ partie(); signe(PID);
  const G=o=>relanceGravity({form:'difficulte',season:S(),pressure:false,wear:30,history:[],...o}).gravity;
  ok(G({ratio:0.85,history:[hard(1)]})===1,'1re saison difficile, ratio 0,85, usure 30 → 1');
  ok(G({ratio:0.70})===2,'1re saison, ratio 0,70 → 2');
  ok(G({ratio:0.70,wear:65,pressure:true})===4,'1re saison, 0,70, usure 65, pression → 4');
  ok(G({ratio:0.85,wear:45,pressure:true,history:[hard(2),hard(1)]})===3,'2e saison, 0,85, usure 45, pression → 3');
  ok(G({ratio:0.72,wear:75,pressure:true,history:[hard(1)]})===5,'2e saison, 0,72, usure 75, pression → 5');
  ok(G({ratio:0.70,wear:75,pressure:true,history:[hard(2),hard(1)]})===6,'3e saison, 0,70, usure 75, pression → 6');
  ok(G({ratio:0.70,wear:75,pressure:true,history:[hard(4),hard(3),hard(2),hard(1)]})===6,'gravité bornée à 6');
  ok(relanceGravity({form:'stable',ratio:0.7,wear:90,pressure:true,history:[hard(1)],season:S()}).gravity===0,'gravité nulle hors difficulté');
  ok(['alerte','alerte','crise','crise','urgence','urgence'].every((r,i)=>relanceRegime(i+1)===r),'régimes 1–2 / 3–4 / 5–6');
}

// ——— 2. Économie et probabilités : cas A et B de la spec ———
{ const A={ratio:0.85,wear:30,gravity:1,recentPromos:0,promoCredibility:1,antennaFatigue:0,pressure:false};
  const B={ratio:0.70,wear:75,gravity:6,recentPromos:0,promoCredibility:1,antennaFatigue:0,pressure:true};
  ok(near(0.05*relanceScale(A).costScale,0.0425)&&near(0.05*relanceScale(B).costScale,0.035),'coût : 0,043 (A) et 0,035 (B), la gravité ne touche pas au prix');
  ok(near(0.08*relanceScale(A).boostScale,0.0656)&&near(0.08*relanceScale(B).boostScale,0.044),'promesse : 0,066 (A) et 0,044 (B)');
  ok(near(relanceScale(B).inactionAwareness,-9),'inaction : −1,5 × gravité');
  const oa=relanceOdds(A,'autopromo'), ob=relanceOdds(B,'digital'), oc=relanceOdds({...B,antennaFatigue:0.5},'autopromo');
  ok(Math.round(oa.succes*100)===69&&Math.round(oa.recul*100)===12&&Math.abs(oa.mitige-0.19)<0.01,'A autopromo : 69 / 19 / 12 %');
  ok(Math.round(ob.succes*100)===38&&Math.round(ob.recul*100)===30,'B digital : 38 / 32 / 30 %');
  ok(Math.round(oc.succes*100)===26&&Math.round(oc.recul*100)===36,'B autopromo, antenne 0,5 : 26 / 38 / 36 %');
  ok(near(relanceOdds(B,'autopromo',{hammer:true}).succes,relanceOdds(B,'autopromo').succes-0.1),'marteler : −10 pts');
  [A,B,{...B,promoCredibility:0.6,antennaFatigue:1}].forEach(x=>RELANCE_PROMO_BRANCHES.forEach(b=>{ const o=relanceOdds(x,b,{hammer:true});
    ok(o.succes>=0.1&&o.succes<=0.85&&o.mitige>=0&&near(o.succes+o.mitige+o.recul,1),'probabilités bornées, somme 1'); }));
}

// ——— 3. Recette ———
// (a) 1re saison difficile, ratio 0,85 : ouverture Alerte.
{ partie(); signe(PID);
  const ctx=rctx({ratio:0.85,wear:30,pressure:false,history:[hard(1)]});
  ok(ctx.gravity===1,'(a) gravité 1');
  const d=carte(ctx); ok(d.storyDefId==='gs_relance_1_alerte','(a) ouverture Alerte : '+d.storyDefId);
  ok(d.c.length===3&&/étude/i.test(d.c[0].l)&&/Renforcer le plan d’auto-promotion/.test(d.c[1].l)&&/qualitative/.test(d.c[0].l)&&/Attendre/.test(d.c[2].l),'(a) Alerte : étude, autopromo légère, attendre');
  ok(d.c[1].story.uncertain?.outcomes.length===3&&d.c[1].story.uncertain.model==='pondere','(a) campagne à issues pondérées');
  ok(near(d.c[1].story.uncertain.outcomes.reduce((a,o)=>a+o.p,0),1),'(a) probabilités inscrites dans la carte');
  ok(!d.c.some(c=>/%|chances/.test(c.l)),'aucune probabilité dans les intitulés');
  ok(composeRelanceStories({...ctx,form:'stable',gravity:0}).length===0,'pas de plan hors difficulté');
}
// (b) 2e saison, ratio 0,72, usure 75, pression : Urgence avec arrêt programmé, sans étude.
{ partie(); signe(PID);
  const ctx=rctx({ratio:0.72,wear:75,pressure:true,history:[hard(1)]});
  const d=carte(ctx); ok(d.storyDefId==='gs_relance_1_urgence','(b) Urgence : '+d.storyDefId);
  ok(!d.c.some(c=>/étude/i.test(c.l))&&d.c.some(c=>/arrêt/i.test(c.l)),'(b) arrêt programmé, sans étude');
  ok(d.c.some(c=>/sauvetage/i.test(c.l)),'(b) plan de sauvetage');
  const wait=d.c[idx(d,/Attendre/)].story.career;
  ok(near(wait.awareness,-1.5*5)&&wait.wear===RELANCE_TUNING.urgencyWear,'(b) attendre : notoriété −1,5 × gravité, usure');
  // Arrêt programmé : économie, le programme finit la saison puis quitte la grille.
  const annual=C(PID).annual, i=idx(d,/arrêt/i), f=d.c[i].finance; joue(d,i);
  ok(f.category==='E'&&f.recurring<0&&near(C(PID).annual,annual+f.recurring),'(b) arrêt : économie sur le coût annuel');
  ok(C(PID).stopped&&C(PID).end===S()&&!arc(),'(b) arrêt : programme retiré en fin de saison, aucun arc ouvert');
}
// (c) Trésorerie négative : achats en formule allégée.
{ partie(); signe(PID); C(PID).annual=40;
  const ctx=rctx({ratio:0.7,wear:40,pressure:true,history:[hard(1)]});
  const n=carte(ctx), t=carte({...ctx,cash:'serre'});
  ok(n.storyDefId==='gs_relance_1_crise','(c) crise');
  const a=idx(n,/autopromo/), b=idx(t,/autopromo/);
  ok(t.c[b].l===n.c[a].l&&!/formule allégée/.test(t.c[b].l),'(c) intitulé inchangé, formule allégée appliquée');
  ok(t.c[b].story.scale===PROGRAM_STORY_TUNING.tightCashScale&&t.c[b].finance.purchase<n.c[a].finance.purchase,'(c) moins chère et moins efficace');
  ok(n.c.every(c=>(c.finance.purchase||0)+(c.finance.recurring>0?c.finance.recurring:0)<=0.25*C(PID).annual+0.11),'plafond : 0,25 du coût annuel');
}
// (d) Deuxième plan promo sur la même case en 4 saisons : promesse × 0,8.
{ partie(); signe(PID);
  const ctx=rctx({ratio:0.7,wear:40,pressure:true,history:[hard(1)]});
  const d=carte(ctx), i=idx(d,/autopromo/); force(d,i,'mitige'); joue(d,i);
  const log=gameState.player.programStories[C(PID).id].log.at(-1);
  ok(log.tags.plan_promo===1&&log.tags.autopromo===1,'(d) décision étiquetée (plan promo, autopromo)');
  suivante(); const g=relanceGauges(C(PID).id);
  ok(g.recentPromos===1,'(d) un plan promo récent');
  const before=relanceScale({...ctx,recentPromos:0},'digital').boostScale, after=relanceScale({...ctx,...g},'digital').boostScale;
  ok(near(after/before,0.8),'(d) promesse × 0,8');
}
// (e) Usure 75, pression, autopromo : succès ≤ 40 % ; l'échec mène au bilan qui propose la refonte.
// (g) Deux échecs promo nets : crédibilité 0,7.
{ partie(); signe(PID);
  const ctx=rctx({ratio:0.72,wear:75,pressure:true,history:[hard(1)]});
  const d=carte(ctx), i=idx(d,/autopromo/); const u=d.c[i].story.uncertain;
  ok(u.outcomes[0].p<=0.4,'(e) succès ≤ 40 % ('+u.outcomes[0].p+')');
  ok(/contenu est usé/.test(u.outcomes[2].r),'(e) l’échec nomme la jauge qui a pesé');
  force(d,i,'recul'); joue(d,i);
  ok(arc()?.regime==='urgence'&&arc().gravity===5&&arc().lastOutcome==='recul','(e) arc ouvert : régime et gravité figés, issue tirée');
  suivante(); const s2=carte(rctx({ratio:0.72,wear:75,pressure:true,history:[hard(2),hard(1)]}));
  ok(s2.storyDefId==='gs_relance_2_autopromo_recul','(e) déroulé : '+s2.storyDefId);
  const h=idx(s2,/Marteler/); ok(s2.c[h].story.tags.autopromo===2,'(e) marteler compte double pour l’antenne');
  force(s2,h,'recul'); joue(s2,h);
  ok(relanceGauges(C(PID).id).promoCredibility===0.7,'(g) deux échecs nets : crédibilité 0,7');
  const low=relanceOdds({...ctx,promoCredibility:0.7},'digital').succes, full=relanceOdds({...ctx,promoCredibility:1},'digital').succes;
  ok(low<full,'(g) toute promo moins efficace');
  suivante(); const b=carte(rctx({ratio:0.72,wear:75,pressure:true,history:[hard(3),hard(2),hard(1)]}));
  ok(b.storyDefId==='gs_relance_3_echec','(e) bilan d’échec : '+b.storyDefId);
  joue(b,idx(b,/refonte/));
  const arcs=gameState.player.storyArcs;
  ok(arcs.find(a=>a.arcId==='relance').state==='resolu'&&openStoryArcs(C(PID).id).some(a=>a.arcId==='refonte'),'(e) bascule : relance close, refonte ouverte');
}
// (f) Quatre autopromos sur la grille en 2 saisons : antenne saturée.
{ partie(); signe(PID);
  gameState.player.programStories={x:{log:[{id:'a',season:S()-1,tags:{autopromo:1}},{id:'b',season:S()-1,tags:{autopromo:1}},
    {id:'c',season:S(),tags:{autopromo:2}}],flags:{},last:null},y:{log:[{id:'d',season:S()-3,tags:{autopromo:4}}],flags:{},last:null}};
  const ctx=rctx({ratio:0.7,wear:30,pressure:false,history:[hard(1)]});
  ok(ctx.antennaFatigue===1,'(f) antennaFatigue = 1 (hors fenêtre exclue)');
  ok(/L’antenne sature d’autopromo/.test(relanceGaugeLine(ctx)),'(f) ligne « L’antenne sature d’autopromo »');
  ok(/L’antenne sature d’autopromo/.test(carte(ctx).desc),'(f) la carte nomme la jauge');
  ok(relanceScale(ctx,'autopromo').boostScale<relanceScale(ctx,'digital').boostScale,'(f) digital peu sensible à la lassitude d’antenne');
}
// (h) Gravité qui passe de 3 à 2 pendant l'arc : le régime reste Crise, même identifiant.
// Étude d'audience : pronostic sur la carte suivante, renfort, bilan de consolidation.
{ partie(); signe(PID);
  const ctx=rctx({ratio:0.85,wear:45,pressure:true,history:[hard(2),hard(1)]}); ok(ctx.gravity===3,'(h) gravité 3');
  const d=carte(ctx); joue(d,idx(d,/étude/i));
  ok(arc().regime==='crise'&&arc().branch==='etude'&&arc().step===0&&gameState.player.programStories[C(PID).id].flags.etude_relance!=null,'étude : arc ouvert, drapeau posé');
  const e2=gameState.dilemmaQueue[1];
  ok(e2?.storyDefId==='gs_relance_1_etude','étude : diagnostic inséré dans la même saison');
  const c2=rctx({ratio:0.85,wear:45,pressure:false,history:[hard(2),hard(1)]}), c3=rctx({ratio:0.85,wear:45,pressure:true,history:[hard(2),hard(1)]});
  ok(c2.gravity===2&&composeRelanceStories(c2)[0].id===composeRelanceStories(c3)[0].id,'(h) gravité 3 → 2 : même identifiant de carte');
  ok(/pronostic (favorable|incertain|défavorable)/.test(e2.desc)&&!/\d+ ?%/.test(e2.desc),'pronostic sans chiffre');
  ok(e2.c.some(c=>/autopromo/.test(c.l))&&e2.c.some(c=>/Renforcer/.test(c.l)),'(h) options de Crise conservées');
  continueAfterConsequence(); ok(gameState.currentDilemmaIndex===1&&gameState.dilemmaPhase==='choosing','diagnostic joué dans la foulée');
  chooseDilemmaOption(idx(e2,/Renforcer/)); ok(arc().branch==='renfort'&&arc().step===1&&arc().regime==='crise','renfort choisi après l’étude');
  suivante(); const r2=carte(rctx({ratio:0.85,wear:40,pressure:true,history:[hard(3),hard(2),hard(1)]}));
  ok(/^gs_relance_2_renfort_/.test(r2.storyDefId)&&/pronostic/.test(r2.desc),'déroulé du renfort, pronostic rappelé : '+r2.storyDefId);
  joue(r2,idx(r2,/Poursuivre|Consolider/)); ok(arc().step===2,'déroulé joué');
  suivante(); const b=carte(rctx({ratio:0.85,wear:33,pressure:true,history:[hard(4),hard(3),hard(2),hard(1)]}));
  ok(b.storyDefId==='gs_relance_3_consolidation','renfort : consolidation sans risque');
  const i=idx(b,/durablement/); ok(b.c[i].story.lasting<=0.05,'lasting ≤ 0,05');
  joue(b,i); ok(!arc()&&!gameState.player.programStories[C(PID).id].flags.etude_relance,'arc résolu, drapeau d’étude retiré');
}
// Succès de campagne : résolution anticipée possible ; promo_succes efface un échec.
{ partie(); signe(PID);
  gameState.player.programStories={x:{log:[{id:'a',season:S(),tags:{promo_echec:1}}],flags:{},last:null}};
  const ctx=rctx({ratio:0.7,wear:20,pressure:false,history:[hard(1)]}); ok(ctx.promoCredibility===0.85,'un échec : crédibilité 0,85');
  const d=carte(ctx), i=idx(d,/autopromo/); force(d,i,'succes'); joue(d,i);
  ok(relanceGauges(C(PID).id).promoCredibility===1,'promo_succes efface un échec');
  suivante(); const s=carte(rctx({ratio:0.9,wear:20,pressure:false,history:[hard(2),hard(1)]}));
  ok(s.storyDefId==='gs_relance_2_autopromo_succes','déroulé succès');
  joue(s,idx(s,/Arrêter la campagne/)); ok(!arc()&&gameState.player.storyArcs.at(-1).state==='resolu','résolution anticipée');
}
// (i) Rechargement de sauvegarde avant le tirage : même issue.
{ partie(); signe(PID);
  const d=carte(rctx({ratio:0.7,wear:50,pressure:true,history:[hard(1)]})), i=idx(d,/autopromo/);
  gameState.dilemmaQueue=[d,DILEMMA_BANK[0],DILEMMA_BANK[1]]; gameState.currentDilemmaIndex=0; gameState.dilemmaPhase='choosing'; gameState.step=6;
  const saved=JSON.stringify(gameState);
  chooseDilemmaOption(i); const first=gameState.dilemmaQueue[0].resolvedOutcome.key;
  gameState=JSON.parse(saved); chooseDilemmaOption(i);
  ok(gameState.dilemmaQueue[0].resolvedOutcome.key===first,'(i) même issue après rechargement ('+first+')');
  const before=JSON.stringify(gameState.player.programStories); chooseDilemmaOption(i);
  ok(JSON.stringify(gameState.player.programStories)===before,'(i) un dilemme résolu n’est pas rejoué');
}
// (j) Programme remplacé en cours d'arc : arc abandonné proprement.
{ partie(); signe(PID);
  const d=carte(rctx({ratio:0.7,wear:50,pressure:true,history:[hard(1)]})); joue(d,idx(d,/Renforcer/));
  ok(arc(),'arc ouvert'); const a=arc();
  C(PID).end=S(); gameState.season++; updateStoryArcs();
  ok(a.state==='abandonne'&&!openStoryArcs(C(PID).id).length,'(j) arc abandonné');
}
// Collecte : le plan est une voie principale (toute case en difficulté), avec son poids.
{ partie(); signe(PID);
  const orig=programStoryContext;
  programStoryContext=(...a)=>{ const c=orig(...a); return a[1].id===C(PID).id ? {...c,form:'difficulte',gravity:3} : c; };
  const cands=programStoryCandidates().filter(k=>k.contract.id===C(PID).id&&k.def.genericKey==='relance');
  programStoryContext=orig;
  ok(cands.length===1&&cands[0].def.id==='gs_relance_1_crise'&&cands[0].baseWeight===RELANCE_TUNING.weight,'collecte : ouverture Crise, poids 1,2');
  ok(programStoryDef('gs_relance_2_autopromo_recul')?.genericKey==='relance'&&programStoryDef('gs_relance_1_crise').opensArc==='relance','modules joués reconnus (mémoire)');
  ok(PROGRAM_STORY_BANK.find(d=>d.id==='ps_p393_retour_soiree').when.form==='difficulte','correctif : struggle → difficulte');
  ok(STORY_SITUATION_KEYS.ps_p393_retour_soiree==='relance','clé relance réservée');
}
// Modules : 3 ouvertures, 12 déroulés, 1 diagnostic, 2 bilans ; identifiants stables.
{ const T=RELANCE_TEXTS;
  ok(Object.keys(T.open).length===3&&Object.values(T.step2).reduce((a,b)=>a+Object.keys(b).length,0)===12&&Object.keys(T.bilan).length===2,'17 modules + diagnostic');
  ok(relanceModuleText('gs_relance_2_digital_mitige')===T.step2.digital.mitige&&relanceModuleText('gs_relance_9_x')==null,'identifiants : étape, branche, issue');
}
console.log('OK relance: gravity (4 components, 6 reference cases), economy (slot value, content health), odds (A/B cases, bounds), recipe a–j, study and diagnosis, renfort consolidation, early resolution, reload, collection, modules');
`;
vm.runInNewContext(scripts.slice(0, -1).join('\n') + tests, { console, structuredClone, URLSearchParams }, { filename: 'audience-masters-relance.js' });
