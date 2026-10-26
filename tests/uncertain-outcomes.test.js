'use strict';
// Lot 4 : issues incertaines encadrées.
// - périmètre : choix concernés, modèles cohérents (2 ou 3 issues) ;
// - probabilités bornées et de somme 1 sur un balayage des entrées (0 à 100) ;
// - 10 000 tirages : fréquences observées cohérentes avec les probabilités affichées ;
// - sauvegarde avant validation puis rechargement : même issue avec la même graine ;
//   sauvegarde après validation puis rechargement : issue conservée, effets non réappliqués ;
// - garde d'idempotence (double clic, retour arrière) ; aucun tirage hors validation ;
// - effets certains et effets de l'issue appliqués une seule fois ; issue → suite d'arc.
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
const C=id=>gameState.player.contracts[P(id).slot];
const ctxOf=(id,extra={})=>({...programStoryContext(P(id).slot,C(id),getCalculatedPDAs()),...extra});
function generic(defId,pid,extra={}){ const def=G(defId), ctx=ctxOf(pid,extra); const r=genericStoryCheck(def,ctx);
  ok(r.ok,'dilemme '+defId+' : '+r.reason);
  return buildProgramStoryDilemma({def,slot:P(pid).slot,contract:C(pid),ctx,arc:r.arc,choices:r.choices}); }
const idx=(d,re)=>{ const i=d.c.findIndex(c=>re.test(c.l)); ok(i>=0,'choix '+re); return i; };
function enFile(d){ gameState.dilemmaQueue=[d,DILEMMA_BANK[0],DILEMMA_BANK[1]]; gameState.currentDilemmaIndex=0; gameState.dilemmaPhase='choosing'; gameState.step=6; }
const restaure=()=>{ gameState=JSON.parse(JSON.stringify(gameState)); };
const T=NARRATIVE_TUNING.outcomes, EPS=1e-9;

// ——— 1. Périmètre ———
const uncertain=GENRE_STORY_BANK.flatMap(d=>d.c.map((c,i)=>({d,c,i})).filter(x=>x.c.uncertain));
ok(uncertain.length===6,'six choix à issues incertaines : '+uncertain.length);
uncertain.forEach(({d,c})=>{ const m=T.models[c.uncertain.model];
  ok(m&&m.base.length===c.uncertain.outcomes.length&&[2,3].includes(m.base.length),'modèle cohérent : '+d.id);
  ok(Object.keys(m.factors).every(f=>f in STORY_OUTCOME_FACTOR_TEXT),'facteurs connus : '+d.id); });
// Tirages aléatoires préexistants (hors lot 4) : le scoop d161 et l'offre de droits du mode
// Carrière, conservés tels quels.
ok(DILEMMA_BANK.filter(d=>d.c.some(c=>c.randomOutcomes)).length===1,'un seul dilemme de la banque à issue aléatoire préexistante');
globalThis.__liste=uncertain.map(({d,c,i})=>({def:d.id,choix:i,label:c.l,model:c.uncertain.model,issues:c.uncertain.outcomes.map(o=>o.label),
  base:T.models[c.uncertain.model].base,facteurs:T.models[c.uncertain.model].factors}));

// ——— 2. Balayage : probabilités bornées, somme 1 ———
{ let n=0; const steps=[0,10,25,40,50,60,75,90,100];
  const ctx0={career:{},slot:'prime',contract:{annual:4},pressureLevel:0,talent:null};
  partie();
  for(const L of steps) for(const W of steps) for(const A of steps) for(const budget of [0,0.5,1,2,4,8,20]) for(const pr of [0,0.03,0.06,0.12,0.5]) for(const aff of [null,0,0.5,1]){
    const ctx={...ctx0,career:{loyalty:L,wear:W,awareness:A},contract:{annual:budget},pressureLevel:pr,talent:aff==null?null:{id:'x',affinities:{a2549:aff}}};
    const f=storyOutcomeFactors(ctx);
    ok(Object.values(f).every(v=>v>=-1&&v<=1),'facteurs dans [−1, 1]');
    for(const id of Object.keys(T.models)){ const {p}=storyOutcomeOdds(id,f); n++;
      ok(p.every(v=>v>=T.min-EPS&&v<=T.max+EPS),'borné : '+id+' '+p);
      ok(Math.abs(p.reduce((a,v)=>a+v,0)-1)<EPS,'somme 1 : '+id+' '+p); } }
  // Valeurs extrêmes hors données : toujours bornées.
  for(const s of [-50,-3,-1,0,1,3,50]) for(const b of [[0.4,0.35,0.25],[0.5,0.5],[0.9,0.05,0.05]]){
    const raw=b.map((v,i)=>i===0?v+s:i===b.length-1?v-s:v), p=boundedShares(raw,T.min,T.max);
    ok(p.every(v=>v>=T.min-EPS&&v<=T.max+EPS)&&Math.abs(p.reduce((a,v)=>a+v,0)-1)<EPS,'bornes extrêmes '+s); }
  globalThis.__balayage=n; }

// ——— 3. Présentation : issues et explication sur la carte ———
let finale;
{ const p=partie(); signe('p284'); C('p284').career.awareness=80; C('p284').career.loyalty=70;
  finale=generic('gs_finale_exceptionnelle','p284',{form:'succes'});
  const ch=finale.c[idx(finale,/grande salle/)];
  ok(ch.story.uncertain.outcomes.length===3&&near(ch.story.uncertain.outcomes.reduce((a,o)=>a+o.p,0),1,1e-5),'issues figées sur le choix');
  const h=storyOutcomeHint(ch);
  ok(/Certain :/.test(h)&&/Issue incertaine/.test(h)&&/Triomphe : chances (faibles|moyennes|élevées) \(~\d+ %\)/.test(h),'carte : certain / incertain / estimation');
  ok(/public est fidèle|très connu/.test(ch.story.uncertain.note),'explication : '+ch.story.uncertain.note);
  ok(!storyOutcomeHint(finale.c[idx(finale,/enregistrée/)]),'choix certain : aucun encart');
  ok(storyChanceLabel(0.65)==='chances élevées (~65 %)'&&storyChanceLabel(0.2)==='chances faibles (~20 %)','libellés'); }

// ——— 4. 10 000 tirages : fréquences ———
{ partie(); signe('p009'); C('p009').career.wear=70; C('p009').career.loyalty=30;
  const d=generic('gs_formule_usee','p009'); const i=idx(d,/refonte complète/), ch=d.c[i];
  const counts={}; const N=10000;
  for(let k=0;k<N;k++){ const copy={...d}; const r=resolveStoryOutcome(copy,i,ch); counts[r.story.outcome.key]=(counts[r.story.outcome.key]||0)+1; }
  const ecarts=ch.story.uncertain.outcomes.map(o=>({key:o.key,p:o.p,obs:(counts[o.key]||0)/N}));
  ecarts.forEach(e=>ok(Math.abs(e.obs-e.p)<4*Math.sqrt(e.p*(1-e.p)/N),'fréquence '+e.key+' : '+e.obs+' / '+e.p));
  globalThis.__freq=ecarts; }

// ——— 5. Validation : un tirage, enregistré avant les effets, effets appliqués une fois ———
function etat(pid){ const p=gameState.player, c=C(pid).career;
  return JSON.stringify({t:p.tresorerie,a:p.achatsSaison,aw:c.awareness,lo:c.loyalty,we:c.wear,sb:c.storySeasonBoost,b:c.storyBoost,pop:p.popularite,
    log:p.programStories?.p284?.log||p.programStories?.[pid]?.log,arcs:p.storyArcs}); }
{ const p=partie(); signe('p284'); C('p284').career.awareness=60;
  const d=generic('gs_finale_exceptionnelle','p284',{form:'succes'}); const i=idx(d,/grande salle/);
  enFile(d);
  // Rendu répété : aucun tirage (compteur du diagnostic).
  NARRATIVE_DEBUG=true; NARRATIVE_RANDOM_CALLS.count=0; console.log=(()=>{const l=console.log; return (...a)=>{ if(typeof a[0]==='string'&&a[0].startsWith('[narratif')) return; l(...a); };})();
  for(let k=0;k<20;k++) storyOutcomeHint(d.c[i]);
  ok(NARRATIVE_RANDOM_CALLS.count===0,'affichage : aucun tirage');
  const avant=JSON.stringify(gameState), c0={...C('p284').career}, achats=p.achatsSaison;
  chooseDilemmaOption(i);
  const r=d.resolvedOutcome; ok(r&&r.choice===i&&d.c[i].story.uncertain.outcomes[r.index].key===r.key,'issue enregistrée sur l’entrée de la file');
  const o=d.c[i].story.uncertain.outcomes[r.index];
  ok(near(p.achatsSaison-achats,d.c[i].finance.purchase),'coût certain prélevé une fois');
  ok(near(C('p284').career.awareness,Math.min(100,c0.awareness+(o.career.awareness||0))),'notoriété : effet de l’issue appliqué une fois');
  ok(near(C('p284').career.storySeasonBoost.value,o.boost*Math.max(1,C('p284').career.basePotential||C('p284').power||1)),'boost d’audience : celui de l’issue, une fois');
  const log=p.programStories.p284.log.at(-1); ok(log.outcome===r.key,'issue dans le log du programme');
  ok(gameState.lastConsequence.outcome?.label===o.label&&gameState.lastConsequence.resultat.includes(o.r),'issue affichée après le choix');
  // Double clic : la phase n'est plus « choosing ».
  const apres=etat('p284'); const n0=NARRATIVE_RANDOM_CALLS.count; chooseDilemmaOption(i);
  ok(etat('p284')===apres&&NARRATIVE_RANDOM_CALLS.count===n0,'double clic : rien');
  // Retour arrière forcé sur le même dilemme : ni nouveau tirage ni nouvel effet.
  gameState.currentDilemmaIndex=0; gameState.dilemmaPhase='choosing'; chooseDilemmaOption(i); chooseDilemmaOption((i+1)%d.c.length);
  ok(etat('p284')===apres&&NARRATIVE_RANDOM_CALLS.count===n0&&d.resolvedOutcome.key===r.key,'retour arrière : issue conservée, rien de réappliqué');
  // Sauvegarde après validation, rechargement : issue conservée, effets non réappliqués.
  gameState.currentDilemmaIndex=1; gameState.dilemmaPhase='result';
  restaure(); ok(gameState.dilemmaQueue[0].resolvedOutcome.key===r.key&&etat('p284')===apres,'rechargement après validation : issue et effets conservés');
  gameState.currentDilemmaIndex=0; gameState.dilemmaPhase='choosing'; chooseDilemmaOption(i);
  ok(etat('p284')===apres,'rechargement puis nouvelle validation : rien de réappliqué');
  // Sauvegarde avant validation, rechargement : même issue avec la même graine.
  const issues=[];
  for(let k=0;k<3;k++){ gameState=JSON.parse(avant); chooseDilemmaOption(i); issues.push(JSON.stringify([gameState.dilemmaQueue[0].resolvedOutcome,etat('p284')])); }
  ok(issues.every(x=>x===issues[0]),'rechargement avant validation : même issue, mêmes effets');
  globalThis.__tirage={issue:r.key,p:r.p,roll:r.roll}; }

// ——— 6. L'issue oriente la suite de l'arc ———
{ const res={};
  for(const seed of [0x9e3779b1,0x85ebca6b,0xc2b2ae35,0x27d4eb2f,0x165667b1,0xd3a2646c,0xfd7046c5,0xb55a4f09]){
    partie('generaliste',seed); signe('p009'); C('p009').career.wear=60;
    const d=generic('gs_formule_usee','p009'); enFile(d); chooseDilemmaOption(idx(d,/refonte complète/));
    const arc=openStoryArcs('p009')[0]; ok(arc.lastOutcome===d.c[0].story.uncertain.outcomes[d.resolvedOutcome.index].arcHint,'indice d’arc mémorisé');
    ok(arc.history[0].outcome===d.resolvedOutcome.key&&/ — /.test(arc.history[0].recall),'rappel et historique de l’arc avec l’issue');
    gameState.season++; C('p009').end=gameState.season+2; updateStoryArcs(); arc.lastRatio=ctxOf('p009').ratio; // évolution mesurée neutre
    const suite=programStoryCandidates().filter(k=>k.contract.id==='p009'&&k.arc).map(k=>k.def.id);
    const attendu={succes:'gs_refonte_succes',mitige:'gs_refonte_mitige',recul:'gs_refonte_recul'}[arc.lastOutcome];
    ok(suite.includes(attendu),'suite orientée par l’issue ('+arc.lastOutcome+') : '+suite);
    res[arc.lastOutcome]=(res[arc.lastOutcome]||0)+1;
    // Une évolution mesurée nette garde la priorité sur l'issue.
    arc.lastRatio=ctxOf('p009').ratio+0.5; ok(storyArcOutcome(arc,ctxOf('p009'))==='recul','évolution mesurée prioritaire');
  }
  ok(Object.keys(res).length>=2,'plusieurs issues observées : '+JSON.stringify(res)); }

// ——— 7. Talent : facteur d'affinité, et choix étape d'arc « persévérer » ———
{ const p=partie(); signe('p009');
  const genre=channelSlotProfile(p,'matin').genre;
  const t=MERCATO_TALENTS.find(m=>m.specialty===genre);
  p.talents=[{id:t.id,name:t.name,specialty:t.specialty,role:t.role,annual:1,until:gameState.season+3,since:gameState.season,affinities:{a2549:1}}];
  const fort=generic('gs_animateur_depart','p009').c.find(c=>c.story.uncertain).story.uncertain;
  p.talents[0].affinities={a2549:0.1};
  const faible=generic('gs_animateur_depart','p009').c.find(c=>c.story.uncertain).story.uncertain;
  ok(fort.outcomes[0].p>faible.outcomes[0].p,'affinité du talent : meilleure intégration');
  ok(fort.note.includes(esc(t.name))&&/plaît à votre cible/.test(fort.note)&&/parle peu/.test(faible.note),'explication nominative : '+fort.note+' / '+faible.note);
  const d=generic('gs_animateur_depart','p009'); enFile(d); chooseDilemmaOption(idx(d,/Confier/));
  ok(openStoryArcs('p009')[0]?.branch==='interne'&&d.resolvedOutcome,'talent : arc ouvert et issue tirée'); }
`;
const context = { console };
vm.runInNewContext(scripts.slice(0, -1).join('\n') + tests, context, { filename: 'audience-masters-uncertain.js' });
const out = { liste: context.__liste, balayage: context.__balayage, frequences: context.__freq, tirage: context.__tirage };
if (process.argv.includes('--report')) console.log(JSON.stringify(out, null, 1));
console.log(`OK uncertain outcomes: 6 choices, ${out.balayage} bounded odds (sum 1), 10 000 draws within 4σ, single draw at validation, idempotence (double click, back, reload), save before/after, effects once, arc orientation, talent affinity`);
