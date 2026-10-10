'use strict';
// Histoires de programmes : dilemmes narratifs propres à un programme du catalogue.
// Éligibilité stricte (programme réellement diffusé par le joueur), seconde validation
// avant affichage, répétition, mémoire éditoriale, économie sans double comptage,
// reproductibilité du tirage et contrôle automatique de la banque.
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const tests = String.raw`
const ok=(v,m)=>{if(!v) throw Error(m)};
const near=(a,b,e=1e-6)=>Math.abs(a-b)<e;
render=()=>{};

// ——— 1. Contrôle de la banque (propriétés objectivement vérifiables) ———
const issues=[]; const chk=(v,m)=>{if(!v) issues.push(m)};
const ids=new Set(), byProgram={};
const setFlags={}, needFlags=[];
const SENT=/[.!?…](\s|$)/g;
PROGRAM_STORY_BANK.forEach(d=>{
  chk(!ids.has(d.id),'id unique '+d.id); ids.add(d.id);
  const prog=PROGRAM_CATALOG.find(p=>p.id===d.programId);
  chk(prog,'programme réel '+d.id);
  chk(PROGRAM_STORY_FAMILIES[d.family],'famille '+d.id);
  chk([1,2,3].includes(d.phase),'phase '+d.id);
  chk(d.repeat===undefined||d.repeat==='unique'||(Number.isInteger(d.repeat)&&d.repeat>=2),'répétition '+d.id);
  chk(d.c.length>=2&&d.c.length<=4,'2 à 4 choix '+d.id);
  chk(new Set(d.c.map(c=>c.l)).size===d.c.length,'choix distincts '+d.id);
  chk(d.titre.length<=60,'titre court '+d.id);
  const sentences=(d.desc.match(SENT)||[]).length;
  chk(sentences>=2&&sentences<=5&&d.desc.length<=420,'contexte de 2 à 5 phrases '+d.id+' ('+sentences+')');
  chk(!/\{(?!programme|saisons|rival|rivalProgramme|creneau)[a-zA-Z]+\}/.test(d.desc+d.titre+d.c.map(c=>c.l+c.r).join('')),'balises connues '+d.id);
  (byProgram[d.programId]??=[]).push(d);
  d.c.forEach(c=>{
    chk(c.l.length<=75&&c.r&&c.r.length<=200,'textes de choix '+d.id);
    const costs=Object.keys(c.cost||{});
    chk(costs.length<=1,'un seul flux financier par choix '+d.id);
    costs.forEach(k=>chk(['purchase','recurring','saving','commercial'].includes(k)&&c.cost[k]>0&&c.cost[k]<=0.8,'coût proportionné '+d.id));
    chk(Math.abs(c.boost||0)<=0.25&&Math.abs(c.lasting||0)<=0.1,'effets bornés '+d.id);
    Object.values(c.career||{}).forEach(v=>chk(Math.abs(v)<=25,'carrière bornée '+d.id));
    chk(Math.abs(c.pop||0)<=3,'popularité bornée '+d.id);
    if(c.flag) (setFlags[d.programId]??=new Set()).add(c.flag);
  });
  [].concat(d.when?.flag||[]).forEach(f=>needFlags.push([d.programId,f,d.id]));
  [].concat(d.when?.after||[]).forEach(a=>chk(PROGRAM_STORY_BANK.some(x=>x.id===a&&x.programId===d.programId),'suite valide '+d.id));
  // Arbitrage réel : effets positifs et négatifs comparés choix par choix.
  const vec=c=>{const f=programStoryFinance(c.cost,{annual:10});
    return [-(f.purchase+Math.max(0,f.recurring)*2+Math.min(0,f.recurring)*2-f.commercial), c.boost||0, c.lasting||0,
      c.career?.awareness||0, c.career?.loyalty||0, -(c.career?.wear||0), c.pop||0];};
  const vs=d.c.map(vec);
  vs.forEach((a,i)=>vs.forEach((b,j)=>{ if(i===j) return;
    chk(!(a.every((x,k)=>x>=b[k]-1e-9)&&a.some((x,k)=>x>b[k]+1e-9)),'aucun choix ne domine '+d.id+' #'+i+'>#'+j); }));
  vs.forEach((v,i)=>{
    const gains=v.slice(1).some(x=>x>0), losses=v.slice(1).some(x=>x<0)||v[0]<0;
    chk(!(gains&&!losses),'pas de choix sans contrepartie '+d.id+' #'+i);
  });
  chk(d.c.some(c=>!c.cost?.purchase&&!c.cost?.recurring),'une option sans dépense '+d.id);
});
needFlags.forEach(([pid,f,id])=>chk(setFlags[pid]?.has(f),'drapeau posé par un choix '+id+' '+f));
Object.entries(byProgram).forEach(([pid,list])=>{
  chk(list.length>=2,'au moins deux histoires par programme couvert '+pid);
  chk(new Set(list.map(d=>d.titre)).size===list.length,'titres distincts '+pid);
});
PROGRAM_CATALOG.forEach(p=>chk(byProgram[p.id]?.length>=2,'programme du catalogue couvert '+p.id));
// Conséquences visibles : presque chaque histoire touche l'audience du programme, et une
// large part engage aussi la popularité de la chaîne.
const withAudience=PROGRAM_STORY_BANK.filter(d=>d.c.some(c=>c.boost||c.lasting)).length;
const withPop=PROGRAM_STORY_BANK.filter(d=>d.c.some(c=>c.pop)).length;
chk(withAudience>=0.95*PROGRAM_STORY_BANK.length,'conséquences d’audience '+withAudience);
chk(withPop>=0.55*PROGRAM_STORY_BANK.length,'conséquences de popularité '+withPop);
ok(!issues.length,'Banque des histoires :\n'+issues.join('\n'));

// ——— 2. Mise en place d'une partie ———
function partie(seed=4242, type='generaliste'){
  // Graine du marché concurrent comprise : à état et graine identiques, tirage identique.
  let r=seed>>>0; Math.random=()=>{r=(Math.imul(r,1103515245)+12345)>>>0; return r/4294967296;};
  resetGame(); const p=gameState.player; p.name='Joueur'; p.type=type; p.target='a2549';
  finalizeChannelSetup(); gameState.campaign.seed=seed; launchFirstSeason();
  gameState.seasonKickoffPending=false; gameState.mercatoPending=false;
  gameState.step=6; gameState.dilemmaPhase='choosing'; gameState.currentDilemmaIndex=0; p.tresorerie=500;
  return p;
}
function signe(slot,id){
  const p=gameState.player;
  const holder=programHolder(PROGRAM_CATALOG.find(x=>x.id===id));
  const q=quoteProgram(slot,id,TALENT_CATALOG[0].id); ok(q&&q.allowed,'signature possible '+id);
  executeProgramSigning(slot,q); return p.contracts[slot];
}
const storyIds=()=>programStoryCandidates().map(c=>c.def.id);
const ofProgram=(pid)=>storyIds().filter(id=>PROGRAM_STORY_BANK.find(d=>d.id===id).programId===pid);

// Programme absent : aucun déclenchement.
let p=partie();
ok(!ofProgram('p032').length,'programme absent : aucune histoire');
// Programme présent : ses histoires deviennent éligibles (et seulement les siennes).
const c32=signe('prime','p032');
ok(ofProgram('p032').length>0,'programme diffusé : histoires éligibles');
ok(programStoryCandidates().every(x=>x.contract.id==='p032'),'seules les histoires du programme diffusé');
ok(!storyIds().includes('ps_p032_jury'),'condition de saisons respectée (minSeasons)');
// Programme diffusé par un concurrent : rien.
const rival=gameState.competitors[0];
rival.contracts.access=makeCompetitorContract(rival,PROGRAM_CATALOG.find(x=>x.id==='p022'),'access',3,{});
ok(!ofProgram('p022').length,'programme concurrent : aucune histoire');
// Pause (case prise par un droit), arrêt, retrait : inéligible et invalidé.
const story=buildProgramStoryDilemma(programStoryCandidates()[0]);
ok(programStoryDilemmaValid(story),'histoire valide tant que le programme est diffusé');
c32.sportsPause=gameState.season; ok(!ofProgram('p032').length&&!programStoryDilemmaValid(story),'programme suspendu : inéligible'); delete c32.sportsPause;
c32.stopped=true; ok(!programStoryDilemmaValid(story),'programme arrêté : inéligible'); delete c32.stopped;
c32.end=gameState.season-1; ok(!programStoryDilemmaValid(story),'contrat échu : inéligible'); c32.end=gameState.season+1;

// ——— 3. Seconde validation : remplacement avant affichage ———
gameState.dilemmaQueue=[DILEMMA_BANK[0],story,DILEMMA_BANK[1]]; gameState.currentDilemmaIndex=0;
delete p.contracts.prime;
ok(revalidateProgramStoryQueue(),'file revalidée');
ok(gameState.dilemmaQueue.length===3&&!gameState.dilemmaQueue.some(d=>d.isProgramStory),'histoire invalide remplacée par un générique');
// Le choix d'une histoire invalide est refusé (aucun effet).
signe('prime','p032'); const s2=buildProgramStoryDilemma(programStoryCandidates()[0]);
gameState.dilemmaQueue=[s2,DILEMMA_BANK[0],DILEMMA_BANK[1]]; gameState.currentDilemmaIndex=0;
delete p.contracts.prime; const tr0=p.tresorerie;
chooseDilemmaOption(0);
ok(p.tresorerie===tr0&&gameState.currentDilemmaIndex===0&&!gameState.dilemmaQueue[0].isProgramStory,'choix refusé et histoire remplacée');

// ——— 4. Application d'un choix : économie, carrière, mémoire ———
p=partie(); const c=signe('prime','p032');
const finale=PROGRAM_STORY_BANK.find(d=>d.id==='ps_p032_finale');
const cand=programStoryCandidates().find(x=>x.def.id==='ps_p032_finale')
  || { def:finale, slot:'prime', contract:c, ctx:programStoryContext('prime',c,getCalculatedPDAs()) };
let dil=buildProgramStoryDilemma(cand);
gameState.dilemmaQueue=[dil,DILEMMA_BANK[0],DILEMMA_BANK[1]]; gameState.currentDilemmaIndex=0; gameState.dilemmaPhase='choosing';
const grilleAvant=p.coutGrilleEngageSaison, achatsAvant=p.achatsSaison, aw=c.career.awareness;
const shareAvant=getCalculatedPDAs().find(r=>r.channel===p).slots.prime[p.target];
const pubAvant=p.revenusPubPrevisionnels, trAvant=p.tresorerie;
chooseDilemmaOption(0);
const achat=dil.c[0].finance.purchase;
ok(achat>0&&near(p.achatsSaison-achatsAvant,achat),'achat ponctuel débité une fois');
ok(near(p.coutGrilleEngageSaison,grilleAvant),'achat ponctuel : coût de grille inchangé');
ok(c.career.awareness>aw&&c.career.storySeasonBoost?.season===gameState.season,'carrière du programme mise à jour');
ok(getCalculatedPDAs().find(r=>r.channel===p).slots.prime[p.target]>shareAvant,'la case du programme progresse');
ok(near(p.tresorerie-trAvant,(p.revenusPubPrevisionnels-pubAvant)-achat,1e-6),'trésorerie = écart de recettes pub − achat (pas de double comptage)');
const rec=p.programStories.p032;
ok(rec.log.length===1&&rec.log[0].id==='ps_p032_finale'&&rec.flags.finale_live===gameState.season&&rec.last===gameState.season,'mémoire éditoriale enregistrée');
ok(!storyIds().includes('ps_p032_finale'),'histoire unique non répétée');
ok(p.decisionHistory.at(-1).id==='ps_p032_finale','décision tracée');
// Coût récurrent : il entre dans le budget du programme et la grille, une seule fois.
const jury=PROGRAM_STORY_BANK.find(d=>d.id==='ps_p032_jury');
dil=buildProgramStoryDilemma({def:jury,slot:'prime',contract:c,ctx:programStoryContext('prime',c,getCalculatedPDAs())});
gameState.dilemmaQueue.splice(gameState.currentDilemmaIndex,0,dil); gameState.dilemmaPhase='choosing';
const annualAvant=c.annual, g2=p.coutGrilleEngageSaison, rec2=dil.c[0].finance.recurring;
chooseDilemmaOption(0);
ok(rec2>0&&near(c.annual-annualAvant,rec2)&&near(p.coutGrilleEngageSaison-g2,rec2),'coût récurrent : programme et grille augmentent du même montant');
// Économie : le budget du programme baisse et la grille avec lui.
const refonte=PROGRAM_STORY_BANK.find(d=>d.id==='ps_p034_refonte');
const c34=signe('prime','p034');
dil=buildProgramStoryDilemma({def:refonte,slot:'prime',contract:c34,ctx:programStoryContext('prime',c34,getCalculatedPDAs())});
gameState.dilemmaQueue.splice(gameState.currentDilemmaIndex,0,dil); gameState.dilemmaPhase='choosing';
const a34=c34.annual, g3=p.coutGrilleEngageSaison, eco=dil.c[2].finance.recurring;
chooseDilemmaOption(2);
ok(eco<0&&near(c34.annual-a34,eco)&&near(p.coutGrilleEngageSaison-g3,eco),'économie : programme et grille baissent du même montant');

// ——— 5. Répétition, délais et suites narratives ———
p=partie(); const k=signe('prime','p034');
const rk=programStoryRecord('p034');
rk.log.push({id:'ps_p034_duel',choice:0,season:1}); rk.last=1;
const ctxAt=season=>{gameState.season=season;return programStoryContext('prime',k,getCalculatedPDAs());};
const duel=PROGRAM_STORY_BANK.find(d=>d.id==='ps_p034_duel');
const pressured=s=>({...ctxAt(s),pressure:true});
ok(!programStoryMatches(duel,pressured(2)),'délai entre deux histoires du même programme');
ok(!programStoryMatches(duel,pressured(3)),'délai du dilemme récurrent respecté');
ok(programStoryMatches(duel,pressured(4)),'dilemme récurrent de retour après son délai');
const suite=PROGRAM_STORY_BANK.find(d=>d.id==='ps_p034_refonte_suite');
ok(!programStoryMatches(suite,ctxAt(4)),'suite verrouillée sans le choix préalable');
rk.flags.refonte=3; rk.last=3;
ok(programStoryMatches(suite,ctxAt(4)),'suite débloquée la saison suivante par la mémoire');
gameState.season=1;

// ——— 6. Rachat : pas d'héritage de décisions jamais prises ———
p=partie();
const seller=gameState.competitors[1];
const prog=PROGRAM_CATALOG.find(x=>x.id==='p032');
seller.contracts.prime=makeCompetitorContract(seller,prog,'prime',3,{seasonsCount:4});
const c3=signe('prime','p032');
ok(c3.acquiredFrom===seller.name,'programme racheté au concurrent');
ok(!p.programStories?.p032?.log?.length,'aucune mémoire héritée du concurrent');
ok(!storyIds().includes('ps_p032_jury_suite'),'suite non débloquée par un passé étranger');

// ——— 7. Tirage : trois dilemmes, au plus deux histoires, reproductible ———
function tirage(seed){
  partie(seed); signe('prime','p032'); signe('access','p022'); signe('matin','p001');
  return pickDilemmaQueue();
}
let withStories=0;
for(let s=1;s<=60;s++){
  const q=tirage(s*7919);
  const base=gameState.dilemmaBaseQueue;
  ok(base.length===3,'trois dilemmes par saison');
  const st=base.filter(d=>d.isProgramStory);
  ok(st.length<=PROGRAM_STORY_TUNING.maxPerSeason,'au plus deux histoires');
  ok(new Set(st.map(d=>d.programId)).size===st.length,'jamais deux histoires du même programme');
  ok(st.every(d=>programStoryDilemmaValid(d)),'histoires tirées valides');
  if(st.length) withStories++;
  const again=tirage(s*7919).map(d=>d.id).join('|');
  ok(again===q.map(d=>d.id).join('|'),'tirage reproductible à graine identique');
}
ok(withStories>=25&&withStories<=55,'fréquence des histoires raisonnable ('+withStories+'/60)');
// Sans programme concerné, le tirage est identique à celui d'avant (aucun tirage consommé).
partie(99); const seedAvant=gameState.campaign.seed; ok(!placeProgramStories([DILEMMA_BANK[0]]).length&&gameState.campaign.seed===seedAvant,'aucun aléa consommé sans histoire éligible');

// ——— 8. Contexte dynamique : trésorerie, proportionnalité, plafond ———
p=partie(); const cc=signe('prime','p032');
p.tresorerie=-5;
const tight=buildProgramStoryDilemma({def:finale,slot:'prime',contract:cc,ctx:programStoryContext('prime',cc,getCalculatedPDAs())});
p.tresorerie=200;
const rich=buildProgramStoryDilemma({def:finale,slot:'prime',contract:cc,ctx:programStoryContext('prime',cc,getCalculatedPDAs())});
ok(/allégée/.test(tight.c[0].l)&&tight.c[0].finance.purchase<rich.c[0].finance.purchase&&tight.c[0].story.scale<1,'trésorerie serrée : formule allégée');
ok(!/allégée/.test(rich.c[0].l),'trésorerie saine : formule complète');
const weak={career:createProgramCareer({power:1},'prime')}, strong={career:createProgramCareer({power:4},'prime')};
weak.career.storyBoost=0.1*Math.max(1,weak.career.basePotential); strong.career.storyBoost=0.1*Math.max(1,strong.career.basePotential);
ok(strong.career.storyBoost>weak.career.storyBoost*3.9,'effet proportionnel à la puissance du programme');
gameState.dilemmaQueue=[]; const big={...buildProgramStoryDilemma({def:finale,slot:'prime',contract:cc,ctx:programStoryContext('prime',cc,getCalculatedPDAs())})};
for(let i=0;i<20;i++) applyProgramStoryChoice(big,{story:{index:0,scale:1,lasting:0.1}});
ok(cc.career.storyBoost<=PROGRAM_STORY_TUNING.lastingCap*cc.career.basePotential+1e-9,'bonus durable plafonné');
// Effet attaché au programme : il disparaît avec lui.
delete p.contracts.prime; ok(programOwnContribution(activeContract(p,'prime'),p.target)===0,'effet parti avec le programme');

// ——— 9. Compatibilité d'état : joueur sans mémoire éditoriale ———
p=partie(); delete p.programStories; signe('prime','p032');
ok(Array.isArray(programStoryCandidates())&&p.programStories.p032.log.length===0,'mémoire créée à la volée');

// ——— 10. Une saison complète jouée avec des histoires ———
p=partie(31337); signe('prime','p032'); signe('access','p022'); signe('apresmidi','p013');
for(let season=1;season<=4;season++){
  gameState.dilemmaPhase='choosing';
  let guard=0;
  while(gameState.step===6&&gameState.currentDilemmaIndex<gameState.dilemmaQueue.length&&guard++<20){
    const d=gameState.dilemmaQueue[gameState.currentDilemmaIndex];
    if(d.type==='sports_rights_auction'&&gameState.sportsRights?.activeAuction) gameState.sportsRights.activeAuction.phase='verdict';
    chooseDilemmaOption(d.isProgramStory?(season%d.c.length):0);
    gameState.dilemmaPhase='choosing';
  }
  if(gameState.step!==6) break;
}
ok(Object.values(gameState.player.programStories||{}).every(r=>r.log.every(l=>PROGRAM_STORY_BANK.some(d=>d.id===l.id))),'journal cohérent après plusieurs saisons');
`;
const context = { console };
vm.runInNewContext(scripts.slice(0, -1).join('\n') + tests
  + '\nglobalThis.__summary=[PROGRAM_STORY_BANK.length,new Set(PROGRAM_STORY_BANK.map(d=>d.programId)).size];',
  context, { filename: 'audience-masters-program-stories.js' });
const [count, programs] = context.__summary;
console.log(`OK program stories: bank (${count} dilemmas, ${programs} programs), eligibility, second validation, economy, memory, repetition, buyout, draw, context, compatibility`);
