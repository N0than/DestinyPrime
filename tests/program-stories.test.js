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
// ——— Tirage des dilemmes d'une partie à l'autre ———
// Chaque nouvelle partie reçoit sa propre graine : les premiers dilemmes ne se répètent plus.
const nouvellePartie=()=>{ resetGame(); const p=gameState.player; p.name='Joueur'; p.type='generaliste'; p.target='a2549';
  finalizeChannelSetup(); launchFirstSeason(); return (gameState.dilemmaBaseQueue||gameState.dilemmaQueue).map(d=>d.id).join(','); };
{ let r=7; Math.random=()=>{r=(Math.imul(r,1103515245)+12345)>>>0; return r/4294967296;};
  const debuts=new Set(Array.from({length:8},nouvellePartie));
  ok(debuts.size>=6,'premiers dilemmes variés d’une partie à l’autre ('+debuts.size+'/8)');
  const graines=new Set(Array.from({length:8},()=>{resetGame(); ensureCampaign(); return gameState.campaign.seed;}));
  ok(graines.size===8&&!graines.has(0),'graine propre à chaque partie'); }
// Mémoire entre parties : à graine identique, les dilemmes que l'on vient de jouer passent après les autres.
{ const store={}; globalThis.localStorage={getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);}};
  partie(31); const vus=gameState.seenDilemmaIds.slice();
  partie(31); const revus=gameState.seenDilemmaIds.filter(id=>vus.includes(id)&&DILEMMA_BANK.some(d=>d.id===id));
  ok(vus.length&&!revus.length,'dilemmes récents écartés à la partie suivante');
  globalThis.localStorage={getItem:()=>{throw Error('bloqué');},setItem:()=>{throw Error('bloqué');}};
  partie(31); ok(gameState.dilemmaQueue.length>=3,'tirage intact sans stockage');
  delete globalThis.localStorage; }

// ——— Dilemmes qui changent la grille ———
ok(!DILEMMA_BANK.some(d=>d.id==='d32'),'« Fin de la pub après 20h » supprimé');
ok(DILEMMA_BANK.find(d=>d.id==='d_pub1').titre==='Recrutement du directeur de régie publicitaire','titre de la régie');
// Festival Rock/Metal : chaque réponse inscrit un programme, avec son niveau de production.
const festival=DILEMMA_BANK.find(d=>d.id==='d70');
ok(festival.c.every(c=>c.grille&&Number.isInteger(c.grille.level)),'festival : toutes les réponses touchent la grille');
ok(new Set(festival.c.map(c=>c.grille.level)).size===festival.c.length,'festival : niveaux de production distincts');
{ partie(5); const p=gameState.player;
  gameState.dilemmaQueue=[festival, ...DILEMMA_BANK.filter(d=>!d.grille&&!d.requiresRight&&!d.types).slice(0,2)];
  gameState.currentDilemmaIndex=0; gameState.dilemmaPhase='choosing';
  chooseDilemmaOption(0);
  const c=p.contracts.prime;
  ok(c&&c.name===festival.c[0].grille.programme&&c.investLevel===3&&c.power>0,'festival en prime : programme inscrit, production élevée');
  ok(channelSlotProfile(p,'prime').level===3,'niveau de production pris en compte par la grille');
  // Renouvellement : le programme à l'antenne est proposé, avec la possibilité de le prolonger.
  const tail=gameState.dilemmaQueue.slice(gameState.currentDilemmaIndex);
  const renewal=tail.find(d=>d.isCareerDilemma&&d.careerSlot==='prime'||d.isGridRenewal&&d.gridPrograms.some(g=>g.slot==='prime'));
  ok(renewal,'programme du dilemme proposé au renouvellement');
  if(renewal.isGridRenewal) ok(renewal.gridPrograms.find(g=>g.slot==='prime').name===c.name,'renouvellement : le programme à l’antenne, pas l’ancien');
  const end=c.end; applyCareerDilemmaChoice({careerSlot:'prime',programId:c.id},{careerAction:'renew'});
  ok(c.end===end+1,'programme du dilemme prolongé'); }

// ——— Démarchage de producteurs ———
{ partie(8); const p=gameState.player;
  const free=PROGRAM_CATALOG.find(x=>x.channelType===p.type&&!programHolder(x)&&!sameProgram(p.contracts[x.slot],x)&&quoteProgram(x.slot,x.id,'interne')?.allowed);
  const pitch=createProducerPitchDilemma({kind:'exclusive', program:free, slot:free.slot});
  const slot=pitch.pitchSlot, prog=PROGRAM_CATALOG.find(x=>x.id===pitch.programId);
  ok(pitch&&pitch.c.length===5&&pitch.c.slice(0,3).every(c=>c.producerDeal&&c.negotiation)&&pitch.c[3].producerOption,'démarchage : signer, option ou décliner');
  ok(!programHolder(prog),'concept exclusif : programme que personne ne diffuse');
  gameState.dilemmaQueue=[pitch, ...DILEMMA_BANK.filter(d=>!d.grille&&!d.requiresRight&&!d.types).slice(0,2)];
  gameState.currentDilemmaIndex=0; gameState.dilemmaPhase='choosing';
  const tres=p.tresorerie;
  chooseDilemmaOption(0);
  ok(sameProgram(p.contracts[slot],prog),'concept exclusif signé sur sa case');
  ok(p.tresorerie<tres+gameState.lastConsequence.deltas.revenusPub,'signature payée'); }
{ partie(9); const p=gameState.player;
  // Programme d'une chaîne concurrente : le producteur propose de le rapatrier.
  const rivals=[]; gameState.competitors.forEach(cp=>TIME_SLOTS.forEach(({key})=>{ const ct=activeContract(cp,key);
    const prog=ct&&PROGRAM_CATALOG.find(x=>x.channelType===p.type&&x.slot===key&&sameProgram(ct,x));
    if(prog&&quoteProgram(key,prog.id,'interne')?.allowed) rivals.push({kind:'rival',program:prog,slot:key,competitor:cp}); }));
  ok(rivals.length,'au moins un programme concurrent rachetable');
  const pitch=createProducerPitchDilemma(rivals[0]);
  ok(/vous propose/.test(pitch.titre)&&pitch.desc.includes(rivals[0].competitor.name),'démarchage : programme d’une autre chaîne');
  gameState.dilemmaQueue=[pitch, ...DILEMMA_BANK.filter(d=>!d.grille&&!d.requiresRight&&!d.types).slice(0,2)];
  gameState.currentDilemmaIndex=0; gameState.dilemmaPhase='choosing';
  chooseDilemmaOption(0);
  ok(sameProgram(p.contracts[rivals[0].slot],rivals[0].program)&&!sameProgram(activeContract(rivals[0].competitor,rivals[0].slot),rivals[0].program),'programme racheté : il quitte le concurrent');
  // Offre devenue impossible : seul le refus reste jouable.
  const again=createProducerPitchDilemma(rivals[0]); refreshProducerPitch(again);
  ok(again.c.filter(c=>c.producerDeal).every(c=>c.disabled)&&!again.c.at(-1).disabled,'offre retirée quand le programme n’est plus disponible'); }
// Tirage : un démarchage apparaît certaines saisons, jamais en saison 1.
{ let seen=0; for(let k=1;k<=12;k++){ partie(100+k); gameState.season=3; const q=pickDilemmaQueue(); if(q.some(d=>d.isProducerPitch)) seen++; }
  ok(seen>=2&&seen<=11,'démarchages tirés certaines saisons ('+seen+'/12)');
  partie(7); gameState.season=1; ok(!pickDilemmaQueue().some(d=>d.isProducerPitch),'pas de démarchage en saison 1'); }
// Grilles concurrentes : un vrai programme, jamais un projet anonyme.
{ partie(11); ok(gameState.competitors.every(cp=>competitorView(cp).every(v=>!v.masked&&v.name)),'grilles concurrentes : programmes nommés'); }
// ——— Dilemmes reliés à la grille active ———
const fillers=()=>DILEMMA_BANK.filter(d=>!d.grille&&!d.requiresRight&&!d.types&&!DYNAMIC_DILEMMAS[d.id]).slice(0,2);
function joue(d,i){ gameState.dilemmaQueue=[d,...fillers()]; gameState.currentDilemmaIndex=0; gameState.dilemmaPhase='choosing';
  const live=materializeCurrentDilemma(); const before={t:p0().tresorerie,g:p0().coutGrilleEngageSaison,h:p0().decisionHistory.length};
  chooseDilemmaOption(i); return {live,before}; }
const p0=()=>gameState.player;
// Programme réel signé sur une case (partie neuve : grille par défaut, sans contrat).
const installe=slot=>{ const x=PROGRAM_CATALOG.find(y=>y.channelType===p0().type&&y.slot===slot&&!programHolder(y)&&quoteProgram(slot,y.id,'interne')?.allowed); return signe(slot,x.id); };
const base=id=>DILEMMA_BANK.find(d=>d.id===id);
// Polar régional : 3 choix, production réelle sur le prime, refus sans effet.
{ partie(21); const p=p0(); const avant=onAirProgram('prime');
  gameState.dilemmaQueue=[base('d61'),...fillers()]; gameState.currentDilemmaIndex=0;
  const d=materializeCurrentDilemma();
  ok(d.c.map(c=>c.l).join('|')==='Produire un pilote|Produire une série de déclinaison locale|Ne rien produire','polar : pilote, série locale ou rien');
  ok(d.desc.includes(avant.name)&&d.showcase.length===1&&d.showcase[0].current===avant.name&&d.showcase[0].level&&d.c.length===3,'polar : une seule illustration, options dans les choix');
  ok(dilemmaShowcaseHtml(d).includes('Polar en régions')&&dilemmaShowcaseHtml(d).includes('<img'),'polar : illustration affichée');
  const q=quoteProgram('prime','dp_polar_regions','interne');
  const achats=p.achatsSaison, deltas=JSON.stringify(p.slotAudienceDeltas||{});
  const {before}=joue(base('d61'),1);
  const c=p.contracts.prime;
  ok(c.id==='dp_polar_regions'&&activeContract(p,'prime').id==='dp_polar_regions','polar produit : il remplace le prime');
  ok(c.career.seasonNumber===1&&c.end===gameState.season+q.program.years-1,'polar : saison 1, contrat de '+q.program.years+' saisons');
  ok(p.decisionHistory.length===before.h+1,'polar : une seule décision enregistrée');
  ok(near(p.achatsSaison-achats,q.finance.purchase),'polar : droits payés une seule fois');
  ok(Object.values(p.slotAudienceDeltas.prime||{}).every(v=>v===0)&&deltas==='{}','polar : audience mesurée sur le programme, sans bonus forfaitaire en plus');
  const saved=JSON.parse(JSON.stringify(gameState)); Object.assign(gameState,saved);
  ok(activeContract(gameState.player,'prime').name==='Polar en régions'&&findProgram(gameState.player.contracts.prime.id).level===2,'polar : fiche persistante après rechargement');
  // Saison suivante : le programme diffusé passe à sa saison 2, contrat restant décompté.
  const c2=gameState.player.contracts.prime; c2.career.history.push({season:gameState.season}); gameState.season++; advanceProgramSeasonNumbers();
  ok(c2.career.seasonNumber===2&&contractSeasonsLeft(c2)===c2.end-gameState.season,'polar : saison 2 l’année suivante');
  const art1=TvPrograms.forProgram(findProgram('dp_polar_regions')); ok(art1&&art1===TvPrograms.forProgram(JSON.parse(JSON.stringify(c))),'polar : illustration stable après sauvegarde'); }
{ partie(21); const p=p0(); const avant=JSON.stringify(p.contracts.prime), t=p.tresorerie, g=p.coutGrilleEngageSaison, achats=p.achatsSaison;
  joue(base('d61'),2);
  ok(!findProgram('dp_polar_metropole'),'polar : plus de « Brigade Métropole »');
  ok(JSON.stringify(p.contracts.prime)===avant&&p.coutGrilleEngageSaison===g&&p.achatsSaison===achats,'polar refusé : grille et coûts inchangés');
  ok(gameState.lastConsequence.deltas&&!(gameState.lastConsequence.audience||[]).some(a=>a.slot==='prime'&&a.value),'polar refusé : aucun impact d’audience'); }
// Polar : un épisode unitaire, payé une fois, sans toucher à la grille.
{ partie(21); const p=p0(); installe('prime'); const avant=JSON.stringify(p.contracts.prime), achats=p.achatsSaison, g=p.coutGrilleEngageSaison;
  joue(base('d61'),0);
  ok(JSON.stringify(p.contracts.prime)===avant&&p.coutGrilleEngageSaison===g,'polar épisode : le prime garde son programme');
  ok(near(p.achatsSaison-achats,findProgram('dp_polar_episode').rights),'polar épisode : production payée une fois');
  ok(p.slotAudienceDeltas.prime.s50>0,'polar épisode : soirée suivie par les 50 ans et plus');
  // Pilote : audience mesurée face au programme actuel, puis commande proposée juste après.
  const pt=gameState.lastConsequence.pilotTest, next=gameState.dilemmaQueue[gameState.currentDilemmaIndex];
  ok(pt&&pt.pda>0&&Number.isFinite(pt.currentPda)&&pt.currentName===JSON.parse(avant).name&&pilotResultHtml(pt).includes('% PDA'),'pilote : audience comparée au programme actuel');
  ok(next?.isPilotOrder&&next.c.length===2&&next.c[0].pilotOrder.season===gameState.season+1&&next.desc.includes(nf1(pt.pda))&&/indemnité/.test(next.desc),'pilote : commande de nouveaux épisodes proposée, indemnité signalée');
  const g2=p.coutGrilleEngageSaison, a2=p.achatsSaison, prime0=JSON.stringify(p.contracts.prime);
  continueAfterConsequence(); ok(gameState.dilemmaPhase==='choosing'&&gameState.dilemmaQueue[gameState.currentDilemmaIndex]===next,'pilote : la commande est le dilemme suivant');
  chooseDilemmaOption(0);
  ok(JSON.stringify(p.contracts.prime)===prime0&&p.coutGrilleEngageSaison===g2&&p.achatsSaison===a2&&scheduledProgramOrder('dp_polar_regions'),'commande : rien ne change cette saison, série inscrite pour la suivante');
  ok(!DYNAMIC_DILEMMAS.d61.eligible(),'commande en cours : le polar n’est plus proposé');
  const saved=JSON.parse(JSON.stringify(p.scheduledPrograms));
  gameState.season++; p.achatsSaison=0; const g3=p.coutGrilleEngageSaison; installScheduledPrograms();
  const serie=findProgram('dp_polar_regions');
  ok(p.contracts.prime.id==='dp_polar_regions'&&p.contracts.prime.annual===serie.annual&&p.achatsSaison>=serie.rights&&p.coutGrilleEngageSaison!==g3,'saison suivante : série installée en prime, droits et coût annuel réglés');
  installScheduledPrograms(); ok(p.scheduledPrograms.every(o=>o.done)&&saved.length===1,'installation unique, commande sauvegardable'); }
// Pilote sans suite : la grille de la saison suivante est inchangée.
{ partie(22); const p=p0(); installe('prime'); joue(base('d61'),0);
  const next=gameState.dilemmaQueue[gameState.currentDilemmaIndex]; ok(next?.isPilotOrder,'pilote : dilemme de suite');
  continueAfterConsequence(); chooseDilemmaOption(1); const prime=p.contracts.prime.id;
  ok(!scheduledProgramOrder('dp_polar_regions'),'sans suite : aucune commande');
  gameState.season++; installScheduledPrograms(); ok(p.contracts.prime.id===prime,'sans suite : le prime garde son programme'); }
// Changement d'animateur : seulement si un jeu est programmé, nommé dans le dilemme.
{ partie(31); const p=p0();
  const jeu=PROGRAM_CATALOG.find(x=>x.channelType===p.type&&PROGRAM_FAMILIES.jeu.test(x)&&!programHolder(x)&&quoteProgram(x.slot,x.id,'interne')?.allowed);
  const sansJeu=!gridProgramsOf(p).some(x=>PROGRAM_FAMILIES.jeu.test(x));
  if(sansJeu) ok(!dynamicDilemmaEligible(base('d49')),'animateur : aucun jeu, aucun dilemme');
  signe(jeu.slot,jeu.id);
  gameState.dilemmaQueue=[base('d49'),...fillers()]; gameState.currentDilemmaIndex=0;
  const d=materializeCurrentDilemma(), game=dilemmaProgramMatch(base('d49'));
  ok(d.titre.includes(p.contracts[game.slot].name)&&d.desc.includes(slotLabelOf(game.slot))&&!/ench[eè]res|objets anciens/i.test(d.titre+d.desc),'animateur : le jeu programmé est nommé');
  ok(d.c.map(c=>c.l).join('|')==='Recruter un animateur charismatique|Miser sur une jeune pousse','animateur : charismatique ou jeune pousse'); }
// Sélection pour l'Eurovision : seulement si la chaîne diffuse l'Eurovision.
{ partie(32); const p=p0();
  ok(!getEligibleDilemmas().some(d=>d.id==='d40'),'Eurovision non diffusée : pas de sélection');
  (gameState.sportsRights.owned??=[]).push({ownerId:'player',eventId:'eurovision_junior',broadcastSeason:gameState.season,slots:['access']});
  ok(getEligibleDilemmas().some(d=>d.id==='d40'),'Eurovision diffusée : sélection possible'); }
// Programme sportif : agence de droits sportifs, compétition, offre exclusive.
{ partie(33,'sport'); const p=p0();
  const comp=PROGRAM_CATALOG.find(x=>x.name==='Coupe Davis');
  ok(isSportsProgram(comp)&&!isSportsProgram(PROGRAM_CATALOG.find(x=>x.name==='La récré des grands')),'Coupe Davis : agence ; La récré des grands : producteur');
  const d=createProducerPitchDilemma({kind:'exclusive',program:comp,slot:comp.slot});
  ok(d.titre.startsWith('Offre exclusive')&&d.desc.startsWith('Une agence de droits sportifs')&&/compétition/.test(d.desc)&&!/concept|producteur/i.test(d.titre+d.desc),'sport : agence, compétition, offre exclusive');
  ok(d.showcase[0].tag==='Compétition inédite','sport : étiquette compétition');
  const mag=PROGRAM_CATALOG.find(x=>x.name==='Journal des sports');
  ok(mag&&!isSportsProgram(mag),'magazine sportif : reste un concept de producteur'); }
// Téléfilms de Noël : remplacement temporaire du vrai programme, restauré ensuite.
{ partie(22); const p=p0(); installe('apresmidi'); const reg=p.contracts.apresmidi; ok(reg,'programme d’après-midi en place');
  const name=reg.name, end=reg.end, g=p.coutGrilleEngageSaison;
  gameState.dilemmaQueue=[base('d73'),...fillers()]; gameState.currentDilemmaIndex=0;
  const d=materializeCurrentDilemma();
  ok(d.desc.includes('« '+name+' »')&&d.desc.includes('Souhaitez-vous le remplacer temporairement'),'Noël : cite le vrai programme');
  joue(base('d73'),0);
  ok(activeContract(p,'apresmidi').id==='dp_noel_telefilms'&&reg.sportsPause===gameState.season&&reg.end===end+1,'Noël : programme remplacé, contrat habituel conservé');
  ok(p.coutGrilleEngageSaison===g-reg.annual,'Noël : coût du programme habituel suspendu une seule fois');
  // Sauvegarde / rechargement.
  const saved=JSON.parse(JSON.stringify(gameState)); Object.assign(gameState,saved);
  ok(activeContract(gameState.player,'apresmidi').name==='Les Noëls enchantés','Noël : persistant après rechargement');
  gameState.season++; restorePausedPrograms();
  const back=activeContract(gameState.player,'apresmidi');
  ok(back&&back.name===name&&!back.isSlotEvent,'Noël : programme habituel restauré à la fin de la période'); }
{ partie(22); const p=p0(); installe('apresmidi'); const name=p.contracts.apresmidi.name, t=p.tresorerie, achats=p.achatsSaison;
  joue(base('d73'),1);
  ok(activeContract(p,'apresmidi').name===name&&p.achatsSaison===achats&&!(p.slotEvents||[]).length,'Noël refusé : aucun coût, rien ne change'); }
// Remplacement décidé pendant l'événement : rien n'est restauré par-dessus.
{ partie(23); const p=p0(); installe('apresmidi'); joue(base('d73'),0);
  const alt=PROGRAM_CATALOG.find(x=>x.channelType===p.type&&x.slot==='apresmidi'&&!programHolder(x)&&!sameProgram(p.contracts.apresmidi,x));
  executeProgramSigning('apresmidi',quoteProgram('apresmidi',alt.id,'interne'));
  gameState.season++; restorePausedPrograms();
  ok(sameProgram(activeContract(p,'apresmidi'),alt),'nouvelle programmation conservée à la fin de l’événement'); }
// Événement de streamer : case libre, installation, refus, fin.
{ partie(24); const p=p0(); ['prime','nuit','access'].forEach(installe); gameState.dilemmaQueue=[base('d66'),...fillers()]; gameState.currentDilemmaIndex=0;
  const d=materializeCurrentDilemma(); const slot=d.eventSlot, name=activeContract(p,slot)?.name;
  ok(slot&&d.showcase[0].current===onAirProgram(slot).name&&d.showcase[0].level===3&&d.showcase[0].conditions.length===2,'streamer : vitrine (case, programme actuel, niveau, période)');
  joue(base('d66'),0);
  ok(activeContract(p,slot).id==='dp_streamer_rallye','streamer installé dans la vraie grille');
  ok(slotTakenByEvent(slot)&&!producerPitchSlots().includes(slot),'streamer : case réservée, aucun chevauchement');
  gameState.dilemmaQueue=[base('d66'),...fillers()]; const d2=materializeCurrentDilemma(); ok(d2.eventSlot!==slot,'streamer : pas deux événements sur la même case');
  gameState.season++; restorePausedPrograms(); ok(!activeContract(p,slot)||activeContract(p,slot).name===name,'streamer : fin de l’événement, programme habituel de retour'); }
{ partie(24); const p=p0(); const grid=JSON.stringify(p.contracts), achats=p.achatsSaison; joue(base('d66'),1);
  ok(!(p.slotEvents||[]).length&&p.achatsSaison===achats,'streamer refusé : pas d’événement, pas de coût'); }
// Package indivisible : lot sous scellés, une compétition différente par case, tout ou rien.
{ partie(41,'sport'); const p=p0(); installe('prime'); const reg=p.contracts.prime, end=reg.end, achats=p.achatsSaison;
  gameState.dilemmaQueue=[base('d246'),...fillers()]; gameState.currentDilemmaIndex=0;
  const d=materializeCurrentDilemma(), lot=d.blindLot;
  ok(materializeCurrentDilemma().blindLot===lot,'lot : contenu stable d’un affichage à l’autre');
  ok(lot.items.length===5&&new Set(lot.items.map(i=>i.name)).size===5&&lot.items.every(i=>isSportsProgram(findProgram(i.programId))),'lot : un sport différent du catalogue par case');
  ok(lot.items.filter(i=>i.gem).length===1&&lot.items.filter(i=>!i.gem).every(i=>i.power<2),'lot : une pépite, le reste en remplissage');
  ok(d.c.length===3&&d.c[2].l==='Ne rien prendre','lot : porte de sortie');
  ok(lot.price>=BLIND_LOT.minPrice&&lot.totalPaused===reg.annual,'lot : prix et programme mis en pause');
  chooseDilemmaOption(0);
  ok(TIME_SLOTS.every(t=>activeContract(p,t.key)?.isSlotEvent),'lot entier : toute la grille diffuse du sport');
  ok(lot.items.every(i=>activeContract(p,i.slot).name===i.name),'lot entier : chaque case reçoit sa compétition');
  ok(reg.sportsPause===gameState.season&&reg.end===end+1&&p.achatsSaison===achats+lot.price,'lot entier : prix payé, programme habituel en pause');
  gameState.season++; restorePausedPrograms();
  ok(activeContract(p,'prime')?.name===reg.name,'lot : programmes habituels de retour la saison suivante'); }
{ partie(42,'sport'); const p=p0(); const achats=p.achatsSaison; const {live}=joue(base('d246'),1); const lot=live.blindLot;
  const gem=lot.items.find(i=>i.gem);
  ok(lot.extractOk ? (p.slotEvents.length===1&&activeContract(p,gem.slot).name===gem.name&&p.achatsSaison===achats+BLIND_LOT.gemPrice)
    : (!(p.slotEvents||[]).length&&p.achatsSaison===achats),'pépite seule : installée si le vendeur accepte, rien sinon'); }
{ partie(43,'sport'); const p=p0(); const achats=p.achatsSaison; joue(base('d246'),2);
  ok(!(p.slotEvents||[]).length&&p.achatsSaison===achats,'lot refusé : aucun coût, grille inchangée'); }
{ partie(44,'sport'); const p=p0(); ['prime','nuit','access'].forEach(slot=>installSlotEvent({slot,programId:'dp_streamer_rallye'}));
  ok(!dynamicDilemmaEligible(base('d246')),'lot : pas proposé si la grille est déjà occupée par des événements'); }
// Lot de demandes sport : plateforme, NBA, finale, catalogue, parts de marché.
{ partie(51,'sport'); const p=p0();
  ok(!PROGRAM_CATALOG.some(x=>x.name==='Grand prix F1'||x.name==='Basket US'),'catalogue : Grand prix F1 et Basket US retirés');
  ok(SPORT_RIGHTS_EVENTS.nba&&SPORT_RIGHTS_EVENTS.nba.recurring&&SPORT_RIGHTS_EVENTS.nba.preferredSlots.join()==='nuit','droit NBA annuel, la nuit');
  ok(base('d97').c.length===3&&base('d112').c.length===4&&base('d222').c.length===3,'porte de sortie ajoutée');
  const ids=()=>getEligibleDilemmas().map(d=>d.id);
  ok(!ids().includes('d251')&&ids().includes('d254'),'numérique : réservé aux plateformes');
  joue(base('d254'),0);
  ok(p.isPlatform&&ids().includes('d251')&&!ids().includes('d254'),'plateforme lancée : dilemmes numériques ouverts');
  ok(!dynamicDilemmaEligible(base('d79')),'finale : aucun droit, pas de dilemme');
  (gameState.sportsRights.owned??=[]).push({ownerId:'player',eventId:'top14',broadcastSeason:gameState.season,slots:['prime']});
  gameState.dilemmaQueue=[base('d79'),...fillers()]; gameState.currentDilemmaIndex=0;
  ok(materializeCurrentDilemma().titre==='Finale du Top 14 : grand spectacle ou simple diffusion ?','finale : « du Top 14 »');
  gameState.sportsRights.owned=[{ownerId:'player',eventId:'nba',broadcastSeason:gameState.season,slots:['nuit']}];
  gameState.dilemmaQueue=[base('d79'),...fillers()];
  ok(materializeCurrentDilemma().titre.startsWith('Finale du basket US'),'finale : « du basket US »');
  joue(base('d97'),0);
  const c=getCalculatedPDAs();
  ok(TIME_SLOTS.every(t=>['j1524','a2549','s50','csp'].every(a=>Math.abs(c.reduce((s,r)=>s+r.slots[t.key][a],0)-100)<1e-6)),'parts de marché : 100 % sur chaque case'); }
// Lot de demandes : dilemmes supprimés, derby conditionnel, scoop aléatoire, numérique sans parts d'audience.
{ partie(52,'sport'); const p0_=p0();
  ['d203','d96','d141','d243','d100','d84'].forEach(id=>ok(!DILEMMA_BANK.some(d=>d.id===id),'dilemme supprimé '+id));
  ok(!getEligibleDilemmas().some(d=>d.id==='d81'),'derby : aucun championnat, pas de dilemme');
  (gameState.sportsRights.owned??=[]).push({ownerId:'player',eventId:'ligue1',broadcastSeason:gameState.season,slots:['prime']});
  ok(getEligibleDilemmas().some(d=>d.id==='d81'),'derby : Ligue 1 diffusée, dilemme possible');
  ok(['d251','d188','d190','d204','d254','d215','d216','d223'].every(id=>DILEMMA_BANK.find(d=>d.id===id).c.every(c=>Object.values(c.pda).every(v=>v===0))),'numérique : aucun effet direct sur les parts d’audience');
  const outcomes=new Set(); for(let i=0;i<40;i++){ gameState.campaign.seed=((i*2654435761)>>>0)||7; const r=joue(base('d161'),0); outcomes.add(gameState.lastConsequence.resultat.slice(0,12)); }
  ok(outcomes.size===2,'scoop : issue confirmée ou démentie tirée au sort');
  ok(studioSlideHidden()===false,'studio : visible avec une grille normale');
  TIME_SLOTS.forEach(t=>{ if(!slotTakenByEvent(t.key)) installSlotEvent({slot:t.key,programId:'dp_streamer_rallye'}); });
  ok(studioSlideHidden()&&hudSlideCount()===7,'studio : masqué quand toute la grille est en événements'); }
// Sport féminin : le rendez-vous prend un créneau libre, devient un programme classique.
{ partie(53,'sport'); const p=p0();
  ok(!getEligibleDilemmas().some(d=>d.id==='d88')||DYNAMIC_DILEMMAS.d88.eligible(),'sport féminin : éligible seulement avec un créneau libre');
  gameState.dilemmaQueue=[base('d88'),...fillers()]; gameState.currentDilemmaIndex=0; gameState.dilemmaPhase='choosing';
  const d=materializeCurrentDilemma(), slot=d.eventSlot;
  ok(slot&&!p.contracts[slot],'sport féminin : créneau libre choisi');
  ok(d.titre==='Sport féminin : prendre la vague'&&d.c[0].grille.slot===slot,'sport féminin : titre et créneau');
  joue(base('d88'),0);
  ok(activeContract(p,slot)?.name===SPORT_FEMININ_PROGRAM&&p.contracts[slot].end===gameState.season,'sport féminin : programme installé sur la case');
  ok(!DYNAMIC_DILEMMAS.d88.freeSlot()||DYNAMIC_DILEMMAS.d88.freeSlot()!==slot,'sport féminin : la case n’est plus proposée');
  ok(!DYNAMIC_DILEMMAS.d88.eligible(),'sport féminin : pas de second rendez-vous fixe'); }
// Forfait : seulement avec un programme de combat ; dilemmes retirés ; France 98.
{ partie(54,'sport'); const p=p0();
  ['d224','d94'].forEach(id=>ok(!DILEMMA_BANK.some(d=>d.id===id),'dilemme supprimé '+id));
  ok(DILEMMA_BANK.some(d=>d.id==='d_france98'&&d.c.length===2),'France 98 : deux choix');
  ok(!getEligibleDilemmas().some(d=>d.id==='d153'),'forfait : aucun combat à l’antenne, pas de dilemme');
  const combat=PROGRAM_CATALOG.find(x=>x.channelType===p.type&&/combat/i.test(x.name)&&quoteProgram(x.slot,x.id,'interne')?.allowed);
  if(combat){ signe(combat.slot,combat.id); ok(getEligibleDilemmas().some(d=>d.id==='d153'),'forfait : combat programmé, dilemme possible'); } }
// Le Grodeal : uniquement s'il est diffusé chez un concurrent.
{ partie(25); const p=p0(); const grodeal=PROGRAM_CATALOG.find(x=>x.id==='p478');
  ok(grodeal&&grodeal.name==='Le Grodeal','fiche stable p478');
  gameState.competitors.forEach(cp=>{ if(sameProgram(cp.contracts?.access,grodeal)) releaseCompetitorProgram(cp,'access',0); });
  ok(!dynamicDilemmaEligible(base('d34'))&&!getEligibleDilemmas().some(d=>d.id==='d34'),'Grodeal absent : dilemme non déclenché');
  const cp=gameState.competitors.find(c=>c.type===grodeal.channelType)||gameState.competitors[0];
  installCompetitorProgram(cp,grodeal,'access',2);
  ok(dynamicDilemmaEligible(base('d34')),'Grodeal diffusé chez '+cp.name+' : dilemme éligible');
  gameState.dilemmaQueue=[base('d34'),...fillers()]; gameState.currentDilemmaIndex=0;
  const d=materializeCurrentDilemma(); const now=onAirProgram('access').name;
  ok(d.showcase[0].tag===cp.name&&d.showcase[0].current===now&&d.c.at(-1).l==='Ne rien faire et conserver « '+now+' »','Grodeal : vitrine et « Ne rien faire »');
  // Ne rien faire.
  const avant=JSON.stringify(p.contracts.access); joue(base('d34'),d.c.length-1);
  ok(JSON.stringify(p.contracts.access)===avant&&sameProgram(activeContract(cp,'access'),grodeal),'Grodeal : ne rien faire, grilles inchangées');
  // Acquisition : le programme garde sa numérotation (3 saisons chez le concurrent).
  activeContract(cp,'access').career.seasonsCount=3;
  const q=quoteProgram('access','p478','interne'); joue(base('d34'),0);
  ok(sameProgram(p.contracts.access,grodeal)&&!sameProgram(activeContract(cp,'access'),grodeal),'Grodeal acquis en access, retiré au concurrent');
  ok(p.contracts.access.career.seasonNumber===4,'Grodeal : numérotation conservée ('+p.contracts.access.career.seasonNumber+')');
  ok(!dynamicDilemmaEligible(base('d34')),'Grodeal acquis : plus d’éligibilité');
  // Devenu inéligible dans la file : remplacé par le mécanisme habituel.
  gameState.dilemmaQueue=[base('d34'),...fillers()]; gameState.currentDilemmaIndex=0; gameState.dilemmaPhase='choosing';
  chooseDilemmaOption(0); ok(gameState.dilemmaQueue[0].id!=='d34','Grodeal inéligible : dilemme remplacé'); }
// Mise en concurrence : concept sans accord, avec option, programme convoité.
{ partie(26); const p=p0(); gameState.season=3;
  const prog=biddingConceptCandidates()[0]; ok(prog,'concept disponible');
  const d=createBiddingWarDilemma({kind:'concept',program:prog,slot:prog.slot,rival:gameState.competitors[0].name,offer:prog.rights*1.3,agreement:null});
  ok(d.c[0].bid>d.war.offer&&d.c[1].concede&&d.c[1].concede.indemnity===0&&!d.c[1].finance.commercial,'concept : surenchère gagnante, renoncement sans indemnité faute d’accord');
  ok(d.showcase[0].stats[1].value===nf1(d.c[0].bid)+' M€'&&d.showcase[0].costs[0].includes('Offre de')&&!d.showcase[0].conditions.length,'concept : montant et justification affichés');
  joue(d,0); ok(sameProgram(p.contracts[prog.slot],prog),'surenchère : programme signé');
  const t=p.tresorerie; ok(p.decisionHistory.at(-1).purchase>=d.c[0].bid,'surenchère : montant payé'); }
{ partie(27); const p=p0(); gameState.season=3;
  const prog=biddingConceptCandidates()[0]; const fee=producerOptionFee(prog);
  p.producerAgreements=[{programId:prog.id,slot:prog.slot,fee,season:2}];
  const w=pickBiddingWar(); ok(w&&w.kind==='concept'&&w.agreement&&w.program.id===prog.id,'option signée : mise en concurrence du concept');
  const d=createBiddingWarDilemma(w); const ind=d.c[1].concede.indemnity;
  ok(ind>0&&d.c[1].finance.commercial===ind,'option : indemnité de renoncement justifiée');
  const com=p.commercialSaison; joue(d,1);
  ok(near(p.commercialSaison-com,ind),'indemnité versée une seule fois');
  const rival=gameState.competitors.find(c=>c.name===w.rival);
  ok(sameProgram(activeContract(rival,prog.slot),prog)&&!sameProgram(p.contracts[prog.slot],prog),'concept cédé : diffusé par le concurrent seulement');
  ok(p.producerAgreements[0].closed===3&&!pickBiddingWarAgain(),'pas de seconde indemnité');
  function pickBiddingWarAgain(){ const x=pickBiddingWar(); return x&&x.agreement; }
  ok(p.biddingHistory.filter(h=>h.programId===prog.id).length===1,'une seule trace par mise en concurrence');
  const saved=JSON.parse(JSON.stringify(gameState)); Object.assign(gameState,saved);
  ok(gameState.player.producerAgreements[0].closed===3&&gameState.player.biddingHistory[0].outcome==='conceded','mise en concurrence : état conservé après rechargement'); }
// Option d'achat : droit de priorité au prix de l'offre concurrente, programme réservé.
{ partie(27); const p=p0(); gameState.season=2;
  const prog=biddingConceptCandidates()[0];
  const pitch=createProducerPitchDilemma({kind:'exclusive',program:prog,slot:prog.slot});
  ok(/option d’achat/.test(pitch.c[3].l)&&!/développement/.test(pitch.c[3].l),'démarchage : « Prendre une option d’achat »');
  joue(pitch,3); ok(p.producerAgreements?.some(a=>a.programId===prog.id&&!a.closed),'option d’achat enregistrée');
  ok(gameState.competitors.every(cp=>TIME_SLOTS.every(({key})=>pickCompetitorProgram(cp,key)?.id!==prog.id)),'programme sous option : aucune chaîne IA ne le prend');
  gameState.season=5; const w=pickBiddingWar(); ok(w&&w.agreement&&w.program.id===prog.id,'plus tard dans la partie : le concurrent se manifeste');
  const d=createBiddingWarDilemma(w);
  ok(d.c[0].priority&&d.c[0].bid===w.offer&&!d.c[0].disabled&&/Exercer l’option d’achat/.test(d.c[0].l),'droit de priorité : signature au prix de l’offre, sans surenchère');
  ok(d.desc.includes('droit de priorité')&&d.showcase[0].conditions[0].includes('droit de priorité'),'droit de priorité expliqué');
  joue(d,0); ok(sameProgram(p.contracts[prog.slot],prog)&&p.producerAgreements.find(a=>a.programId===prog.id).closed===5,'option exercée : programme signé, option close'); }
{ partie(28); const p=p0(); gameState.season=3; ['prime','access'].forEach(installe);
  Object.entries(p.contracts).forEach(([s,c])=>{ migrateProgramCareer(c,s); c.career.seasonsCount=1; });
  const cov=biddingCoveted(); ok(cov.length,'programme convoitable');
  const {slot,contract}=cov[0]; const prog=PROGRAM_CATALOG.find(x=>x.id===contract.id);
  const rival=gameState.competitors[0]; rival.budget=500;
  const d=createBiddingWarDilemma({kind:'coveted',program:prog,slot,rival:rival.name,offer:exclusivityFee(prog,{contract})});
  ok(d.c.length===2&&d.c[0].keepProgram&&d.c[1].transferDeal,'convoité : garder ou céder, sans remplacement proposé en même temps');
  const com=p.commercialSaison;
  joue(d,1);
  ok(sameProgram(activeContract(rival,slot),prog)&&!p.contracts[slot],'transfert : programme chez le concurrent, case libérée');
  ok(near(p.commercialSaison-com,d.war.offer),'indemnité de transfert versée une fois');
  const next=gameState.dilemmaQueue[1];
  ok(next&&next.isReplacementChoice&&next.replaceSlot===slot,'remplacement proposé juste après');
  ok(next.c.length>=2&&next.c.at(-1).restoreDefault&&next.c.at(-1).l.includes(initialProgramming(slot)),'remplacement : programmes adaptés ou programmation initiale');
  ok(next.c.slice(0,-1).every(c=>c.producerDeal&&!c.disabled)&&next.showcase.length===next.c.length-1,'remplacements finançables, avec leur fiche');
  const repl=next.c[0].producerDeal.programId, achats=p.achatsSaison, qr=quoteProgram(slot,repl,'interne');
  gameState.currentDilemmaIndex=1; gameState.dilemmaPhase='choosing'; gameState.step=6; chooseDilemmaOption(0);
  ok(p.contracts[slot]?.id===repl&&p.contracts[slot].career.seasonNumber===1,'remplacement installé, lancé en saison 1');
  ok(near(p.achatsSaison-achats,qr.finance.purchase),'remplacement payé une fois');
  ok(!biddingCoveted().some(x=>x.contract.id===prog.id),'pas de nouvelle proposition pour ce programme'); }
{ partie(28); const p=p0(); gameState.season=3; ['prime','access'].forEach(installe);
  Object.entries(p.contracts).forEach(([s,c])=>{ migrateProgramCareer(c,s); c.career.seasonsCount=1; });
  const {slot,contract}=biddingCoveted()[0]; const prog=PROGRAM_CATALOG.find(x=>x.id===contract.id), end=contract.end;
  const d=createBiddingWarDilemma({kind:'coveted',program:prog,slot,rival:gameState.competitors[0].name,offer:exclusivityFee(prog,{contract})});
  joue(d,0); ok(sameProgram(p.contracts[slot],prog)&&p.contracts[slot].end===end+1&&!gameState.dilemmaQueue.some(x=>x.isReplacementChoice),'surenchère : programme gardé et prolongé, pas de remplacement'); }
// Céder puis revenir à la programmation initiale de la case : aucun coût.
{ partie(28); const p=p0(); gameState.season=3; ['prime','access'].forEach(installe);
  Object.entries(p.contracts).forEach(([s,c])=>{ migrateProgramCareer(c,s); c.career.seasonsCount=1; });
  const {slot,contract}=biddingCoveted()[0]; const prog=PROGRAM_CATALOG.find(x=>x.id===contract.id);
  const d=createBiddingWarDilemma({kind:'coveted',program:prog,slot,rival:gameState.competitors[0].name,offer:exclusivityFee(prog,{contract})});
  joue(d,1); const next=gameState.dilemmaQueue[1], t=p.tresorerie, g=p.coutGrilleEngageSaison;
  gameState.currentDilemmaIndex=1; gameState.dilemmaPhase='choosing'; gameState.step=6; chooseDilemmaOption(next.c.length-1);
  ok(!p.contracts[slot]&&onAirProgram(slot).name===initialProgramming(slot)&&p.coutGrilleEngageSaison===g,'programmation initiale rétablie, sans coût'); }
// Saisons de programme : 1 au lancement, migration des anciennes parties.
{ partie(29); const p=p0(); ['prime','access'].forEach(installe);
  ok(Object.values(p.contracts).every(c=>migrateProgramCareer(c).seasonNumber===1),'programmes lancés en saison 1');
  const c=Object.values(p.contracts)[0]; c.career.seasonNumber=0; migrateProgramCareer(c); ok(c.career.seasonNumber===1,'saison 0 normalisée à 1');
  delete c.career.seasonNumber; c.career.seasonsCount=2; c.career.history=[]; migrateProgramCareer(c); ok(c.career.seasonNumber===3,'ancienne partie : numéro reconstitué');
  const expired={end:gameState.season-2}; ok(contractSeasonsLeft(expired)===0,'contrat expiré jamais réactivé'); }
// Tirage : mises en concurrence certaines saisons, jamais en saison 1, jamais à la place d'une enchère.
{ let wars=0; for(let k=1;k<=16;k++){ partie(300+k); gameState.season=3; ['prime','access'].forEach(installe);
    const q=pickDilemmaQueue(); const w=q.filter(d=>d.isBiddingWar); ok(w.length<=1,'une mise en concurrence au plus');
    if(w.length){ wars++; ok(gameState.player.biddingHistory.at(-1).outcome==='pending','tirage tracé'); } }
  ok(wars>=1&&wars<=14,'mises en concurrence tirées certaines saisons ('+wars+'/16)');
  partie(7); gameState.season=1; ok(!pickDilemmaQueue().some(d=>d.isBiddingWar),'pas de mise en concurrence en saison 1'); }

// Synopsis consultable depuis les illustrations de producteurs et de mise en concurrence.
{
  partie(26); gameState.season=3;
  const prog=biddingConceptCandidates()[0]; ok(prog,'concept pour le synopsis');
  const pitch=createProducerPitchDilemma({kind:'exclusive',program:prog,slot:prog.slot});
  const war=createBiddingWarDilemma({kind:'concept',program:prog,slot:prog.slot,
    rival:gameState.competitors[0].name,offer:prog.rights*1.3,agreement:null});
  for(const d of [pitch,war]) {
    const markup=dilemmaShowcaseHtml(d), synopsis=prog.pitch||TvPrograms.pitch(prog);
    ok(synopsis&&markup.includes(esc(synopsis)),'synopsis du programme proposé affiché');
    ok(markup.includes('aria-label="Afficher le synopsis du programme"'),'bouton synopsis accessible');
    ok(markup.includes('class="sa-illu-face sa-illu-back" inert'),'verso initialement inactif');
    ok(markup.includes('aria-label="Revenir à l’illustration"'),'retour à l’illustration');
  }
  const original=prog.pitch;
  try {
    prog.pitch='<b>Synopsis & personnages</b>';
    const markup=dilemmaShowcaseHtml(pitch);
    ok(markup.includes(esc(prog.pitch))&&!markup.includes(prog.pitch),'synopsis échappé');
  } finally { if(original===undefined) delete prog.pitch; else prog.pitch=original; }
  const holder=gameState.competitors.flatMap(cp=>TIME_SLOTS.map(({key})=>({cp,key,c:activeContract(cp,key)})))
    .find(x=>x.c&&PROGRAM_CATALOG.some(p=>p.id===x.c.id&&p.channelType===gameState.player.type));
  ok(holder,'programme concurrent pour vérifier le badge PDA');
  const rivalProgram=PROGRAM_CATALOG.find(p=>p.id===holder.c.id);
  const rivalPitch=createProducerPitchDilemma({kind:'rival',program:rivalProgram,slot:holder.key,competitor:holder.cp});
  ok(dilemmaShowcaseHtml(rivalPitch).includes('dsc-pda with-info'),'badge PDA décalé pour le bouton i');
  const event=Object.values(SPORT_RIGHTS_EVENTS)[0];
  const sports=sportsIllustrationHtml(event,{info:SPORTS_PRICE_RULE});
  ok(sports.includes(SPORTS_PRICE_RULE)&&sports.includes('Afficher les informations'),'informations sportives conservées');
  ok(!sportsIllustrationHtml(event).includes('sa-info-btn'),'illustration sportive sans information inchangée');
}
`;
const context = { console };
vm.runInNewContext(scripts.slice(0, -1).join('\n') + tests
  + '\nglobalThis.__summary=[PROGRAM_STORY_BANK.length,new Set(PROGRAM_STORY_BANK.map(d=>d.programId)).size];',
  context, { filename: 'audience-masters-program-stories.js' });
const [count, programs] = context.__summary;
console.log(`OK program stories: bank (${count} dilemmas, ${programs} programs), eligibility, second validation, economy, memory, repetition, buyout, draw, context, compatibility, grid-linked dilemmas, bidding wars, program seasons`);
