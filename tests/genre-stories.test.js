'use strict';
// Lot 3 : histoires génériques par genre, arcs narratifs et choix contextuels.
// Banque (situations, arcs, choix, variables), textes construits sur tout le catalogue,
// acteurs absents, priorité de l'histoire propre au titre, arc complet (ouverture, suite
// selon l'évolution observée, rappel, clôture), abandon d'un arc, options contextuelles,
// effets financiers sur le bon objet, ancienne partie sans arcs.
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const tests = String.raw`
const ok=(v,m)=>{if(!v) throw Error(m)};
const near=(a,b,e=1e-6)=>Math.abs(a-b)<e;
render=()=>{};
globalThis.localStorage={d:{},setItem(k,v){this.d[k]=String(v)},getItem(k){return k in this.d?this.d[k]:null}};

// ——— 1. Banque ———
const KNOWN=['programme','saisons','anciennete','creneau','rival','rivalProgramme','talent'];
const openers=GENRE_STORY_BANK.filter(d=>!d.arc);
ok(openers.length>=15,'au moins 15 situations ('+openers.length+')');
ok(Object.keys(NARRATIVE_ARCS).length>=5,'au moins 5 arcs');
Object.entries(NARRATIVE_ARCS).forEach(([id,a])=>{
  ok(openers.some(d=>d.opensArc===id),'arc ouvert par une situation : '+id);
  for(let step=2;step<=a.steps;step++) ok(GENRE_STORY_BANK.some(d=>d.arc?.id===id&&d.arc.step===step),'étape '+step+' de l’arc '+id);
});
GENRE_STORY_BANK.forEach(d=>{
  ok(d.c.length>=2&&d.c.length<=4,'2 à 4 choix : '+d.id);
  ok(NARRATIVE_THEMES[d.theme]&&PROGRAM_STORY_FAMILIES[d.family],'thème et famille : '+d.id);
  ok((d.genres||[]).concat(d.excludeGenres||[]).every(g=>PROGRAM_FAMILIES[g]),'genres connus : '+d.id);
  const texts=[d.titre,d.desc,...d.c.flatMap(c=>[c.l,c.r,c.arc?.recall||''])];
  ok(texts.every(t=>[...t.matchAll(/\{(\w+)\}/g)].every(m=>KNOWN.includes(m[1]))),'variables connues : '+d.id);
  d.c.forEach(c=>{ ok(!c.needs||STORY_RESOURCES[c.needs],'ressource connue : '+d.id);
    const kinds=Object.keys(c.cost||{}); ok(kinds.length<=1&&kinds.every(k=>['purchase','recurring','saving','commercial'].includes(k)),'un seul flux par choix : '+d.id); });
  // Choix toujours disponibles (sans ressource) : au moins deux, pour chaque branche et évolution.
  const branches=d.arc ? [...new Set(GENRE_STORY_BANK.filter(o=>o.opensArc===d.arc.id).flatMap(o=>o.c.map(c=>c.arc?.branch).filter(Boolean)))].filter(b=>!d.arc.branch||d.arc.branch.includes(b)) : [null];
  const outcomes=d.arc ? (d.arc.outcome||['succes','mitige','recul']) : [null];
  branches.forEach(branch=>outcomes.forEach(outcome=>{
    const n=d.c.filter(c=>!c.needs&&(!c.branch||c.branch.includes(branch))&&(!c.outcome||c.outcome.includes(outcome))).length;
    ok(n>=2,'deux choix sans ressource : '+d.id+' '+branch+'/'+outcome);
  }));
});

// ——— 2. Mise en place ———
function partie(type='generaliste', seed=4242){
  let r=seed>>>0; Math.random=()=>{r=(Math.imul(r,1103515245)+12345)>>>0; return r/4294967296;};
  resetGame(); const p=gameState.player; p.name='Joueur'; p.type=type; p.target='a2549';
  finalizeChannelSetup(); gameState.campaign.seed=seed; launchFirstSeason();
  gameState.seasonKickoffPending=false; gameState.mercatoPending=false;
  gameState.step=6; gameState.dilemmaPhase='choosing'; gameState.currentDilemmaIndex=0; p.tresorerie=800;
  return p;
}
function signe(slot,id){ const q=quoteProgram(slot,id,'interne'); if(!q?.allowed) return null; executeProgramSigning(slot,q); return gameState.player.contracts[slot]; }
const genericOf=pid=>programStoryCandidates().filter(c=>c.def.isGeneric&&c.contract.id===pid);
function joue(dil,i){ gameState.dilemmaQueue=[dil,DILEMMA_BANK[0],DILEMMA_BANK[1]]; gameState.currentDilemmaIndex=0; gameState.dilemmaPhase='choosing'; gameState.step=6; chooseDilemmaOption(i); }

// ——— 3. Textes réels sur tout le catalogue, six types de chaînes ———
let built=0, programmes=0;
for(const type of Object.keys(CHANNEL_TYPES)){
  partie(type);
  const p=gameState.player;
  PROGRAM_CATALOG.filter(x=>x.channelType===type&&!programHolder(x)).forEach(x=>{
    const c=signe(x.slot,x.id); if(!c) return;
    programmes++;
    migrateProgramCareer(c,x.slot); c.career.seasonsCount=3; c.career.wear=55;
    programStoryCandidates().filter(k=>k.def.isGeneric).forEach(k=>{
      const d=buildProgramStoryDilemma(k); built++;
      const all=[d.titre,d.desc,d.storyContext||'',d.storyRecall||'',...d.c.flatMap(ch=>[ch.l,ch.r])].join(' ');
      ok(!/undefined|null|NaN|\{\w+\}/.test(all),'texte complet : '+d.id+' → '+all.slice(0,160));
      ok(d.c.length>=2&&d.c.length<=4,'2 à 4 choix construits : '+d.id);
      ok(d.programId===c.id&&d.storySlot===x.slot,'histoire rattachée au programme : '+d.id);
    });
    delete p.contracts[x.slot];
  });
}
ok(built>=200,'variantes génériques construites sur le catalogue ('+built+' pour '+programmes+' programmes)');

// ——— 4. Acteurs absents : aucun candidat ———
{ const p=partie();
  ok(!programStoryCandidates().length,'grille sans programme signé : aucune histoire');
  const talk=PROGRAM_CATALOG.find(x=>x.channelType==='generaliste'&&programGenresOf(x,x.slot).includes('talk')&&!programHolder(x));
  const c=signe(talk.slot,talk.id); c.career.seasonsCount=2;
  const inv=GENRE_STORY_BANK.find(d=>d.id==='gs_invite_desiste');
  const ctx=programStoryContext(talk.slot,c,getCalculatedPDAs());
  p.talents=[];
  const sans=genericStoryMatches(inv,{...ctx,talent:storyCompatibleTalent(talk.slot)},new Set());
  ok(sans&&!sans.choices.some(x=>x.spec.needs==='talent'),'sans talent compatible : pas d’option interne');
  const genre=channelSlotProfile(p,talk.slot).genre, t=MERCATO_TALENTS.find(m=>m.specialty===genre);
  p.talents=[{id:t.id,name:t.name,specialty:t.specialty,role:t.role,annual:1,until:gameState.season+2,since:gameState.season}];
  const avec=genericStoryMatches(inv,programStoryContext(talk.slot,c,getCalculatedPDAs()),new Set());
  ok(avec.choices.some(x=>x.spec.needs==='talent'),'talent compatible sous contrat : option interne proposée');
  const d=buildProgramStoryDilemma({def:inv,slot:talk.slot,contract:c,ctx:programStoryContext(talk.slot,c,getCalculatedPDAs()),choices:avec.choices});
  ok(d.c.some(x=>x.l.includes(t.name)),'le talent est nommé dans l’option');
  // Plateforme : sans plateforme ni droits, ni histoire ni option numérique.
  ok(!genericOf(c.id).some(k=>k.def.requires?.includes('platform')),'pas de plateforme : pas d’histoire numérique');
  p.isPlatform=true; c.ownership='licence';
  ok(!genericOf(c.id).some(k=>k.def.requires?.includes('platform')),'plateforme sans droits d’exploitation : rien');
  c.ownership='owned';
  // (sans histoire propre au titre sur la même situation, qui passerait avant)
  ok(genericStoryMatches(GENRE_STORY_BANK.find(x=>x.id==='gs_valorisation_digitale'),programStoryContext(talk.slot,c,getCalculatedPDAs()),new Set()),'plateforme et droits : valorisation numérique possible');
  // Programme retiré : plus aucun candidat le concernant.
  delete p.contracts[talk.slot];
  ok(!programStoryCandidates().some(k=>k.contract.id===c.id),'programme déprogrammé : aucun candidat'); }

// ——— 5. L'histoire propre au titre prime sur sa variante générique ———
{ const p=partie();
  const c=signe('prime','p032'); c.career.seasonsCount=2;
  const ids=()=>programStoryCandidates().filter(k=>k.contract.id==='p032').map(k=>k.def.id);
  ok(programGenresOf(c,'prime').includes('cuisine')&&PROGRAM_STORY_BANK.find(d=>d.id==='ps_p032_jury').genericKey==='jury','situation « jury » propre au titre');
  ok(ids().includes('ps_p032_jury')&&!ids().includes('gs_jury_conteste'),'variante générique écartée tant que l’histoire propre est éligible');
  programStoryRecord('p032').log.push({id:'ps_p032_jury',choice:0,season:gameState.season}); programStoryRecord('p032').last=gameState.season-3;
  ok(!ids().includes('gs_jury_conteste'),'situation jouée récemment : pas de variante générique dans la fenêtre');
  programStoryRecord('p032').log=[{id:'gs_jury_conteste',choice:0,season:gameState.season-1}];
  ok(!ids().includes('ps_p032_jury'),'variante générique jouée récemment : l’histoire propre attend'); }

// ——— 6. Arc complet : ouverture, suite selon l'évolution, rappel, clôture ———
{ const p=partie();
  const arcProg=PROGRAM_CATALOG.find(x=>x.channelType==='generaliste'&&PROGRAM_CAPABILITY_LISTS.jury.includes(x.id)
    &&!programHolder(x)&&!(PROGRAM_STORIES_BY_PROGRAM[x.id]||[]).some(d=>d.genericKey==='jury'));
  const c=signe(arcProg.slot,arcProg.id); c.career.seasonsCount=2;
  const def=GENRE_STORY_BANK.find(d=>d.id==='gs_jury_conteste');
  const ctx=programStoryContext(arcProg.slot,c,getCalculatedPDAs());
  const m=genericStoryMatches(def,ctx,new Set()); ok(m,'situation « jury » applicable');
  const d=buildProgramStoryDilemma({def,slot:arcProg.slot,contract:c,ctx,choices:m.choices});
  ok(d.id==='gs_jury_conteste--'+c.id&&d.storyContext,'identifiant par programme et ligne de contexte');
  const achats=p.achatsSaison, annual=c.annual, achat=d.c[0].finance.purchase;
  joue(d,0);
  ok(near(p.achatsSaison-achats,achat)&&near(c.annual,annual),'achat ponctuel débité une fois, budget du programme inchangé');
  const arc=openStoryArcs(c.id)[0];
  ok(arc&&arc.arcId==='jury'&&arc.branch==='remplace'&&arc.step===1&&arc.entity.id===c.id,'arc ouvert sur le programme');
  ok(programStoryRecord(c.id).log.at(-1).id==='gs_jury_conteste','mémoire du programme : identifiant de la définition');
  ok(!genericOf(c.id).some(k=>k.def.arc||k.def.opensArc),'pas de suite la même saison, pas de second arc sur le programme');
  // Saison suivante : l'évolution observée choisit la suite (succès, recul).
  for(const out of ['succes','recul']){
    gameState.season++; programStoryRecord(c.id).last=gameState.season-2; arc.lastSeason=gameState.season-1;
    const saved=arc.lastRatio, now=programStoryContext(arcProg.slot,c,getCalculatedPDAs()).ratio;
    arc.lastRatio=now+(out==='succes'?-0.5:0.5);
    const suites=genericOf(c.id).filter(k=>k.def.arc?.id==='jury');
    ok(suites.length===1&&suites[0].def.arc.outcome.includes(out),'suite conforme à l’évolution observée : '+out);
    arc.lastRatio=saved; gameState.season--;
  }
  gameState.season++; arc.lastSeason=gameState.season-1; programStoryRecord(c.id).last=gameState.season-2;
  const suite=genericOf(c.id).find(k=>k.def.arc?.id==='jury'); ok(suite,'suite éligible la saison suivante');
  const sd=buildProgramStoryDilemma(suite);
  ok(sd.storyRecall==='Saison '+(gameState.season-1)+' : vous aviez renouvelé tout le jury de « '+esc(c.name)+' ».','rappel de la décision passée : '+sd.storyRecall);
  ok(/Depuis cette décision/.test(sd.storyContext),'contexte : évolution observée');
  joue(sd,0);
  ok(arc.state==='resolu'&&!openStoryArcs().length,'arc résolu à la dernière étape');
  ok(Object.keys(programStoryRecord(c.id).flags).length===0,'aucun flag résiduel'); }

// ——— 7. Programme déprogrammé en cours d'arc : arc abandonné, suite absente ———
{ const p=partie();
  const x=PROGRAM_CATALOG.find(y=>y.channelType==='generaliste'&&programGenresOf(y,y.slot).some(g=>GS_SHOWS.includes(g))&&!programHolder(y)
    &&!(PROGRAM_STORIES_BY_PROGRAM[y.id]||[]).some(d=>d.genericKey==='refonte'));
  const c=signe(x.slot,x.id); c.career.seasonsCount=3; c.career.wear=60;
  const def=GENRE_STORY_BANK.find(d=>d.id==='gs_formule_usee');
  const ctx=programStoryContext(x.slot,c,getCalculatedPDAs()); const m=genericStoryMatches(def,ctx,new Set());
  ok(m,'refonte applicable à un programme usé');
  joue(buildProgramStoryDilemma({def,slot:x.slot,contract:c,ctx,choices:m.choices}),0);
  const arc=openStoryArcs(c.id)[0]; ok(arc?.arcId==='refonte','arc de refonte ouvert');
  gameState.season++; arc.lastSeason=gameState.season-1; programStoryRecord(c.id).last=gameState.season-2;
  const suite=genericOf(c.id).find(k=>k.def.arc?.id==='refonte'); ok(suite,'suite de refonte éligible');
  const sd=buildProgramStoryDilemma(suite);
  // La suite est déjà dans la file quand le programme est retiré.
  gameState.dilemmaQueue=[DILEMMA_BANK[0],sd,DILEMMA_BANK[1]]; gameState.currentDilemmaIndex=0;
  delete p.contracts[x.slot];
  ok(!narrativeValid(sd),'suite invalide sans son programme');
  revalidateNarrativeQueue();
  ok(!gameState.dilemmaQueue.some(d=>d.id===sd.id),'suite retirée de la file');
  ok(arc.state==='abandonne'&&!openStoryArcs().length,'arc fermé « abandonné »');
  ok(!programStoryCandidates().some(k=>k.contract.id===c.id),'aucun arbitrage de production ensuite'); }

// ——— 8. Plafond par chaîne, abandon et expiration en début de saison ———
{ const p=partie();
  p.storyArcs=[1,2,3].map(i=>({arcId:'refonte',step:1,branch:'retouche',state:'open',openedSeason:1,lastSeason:1,expiresSeason:7,
    entity:{kind:'programme',id:'fictif'+i,slot:'prime',name:'X'},flags:[],history:[{step:1,season:1,recall:'test'}]}));
  const x=PROGRAM_CATALOG.find(y=>y.channelType==='generaliste'&&programGenresOf(y,y.slot).some(g=>GS_SHOWS.includes(g))&&!programHolder(y));
  const c=signe(x.slot,x.id); c.career.seasonsCount=3; c.career.wear=60;
  ok(!genericOf(c.id).some(k=>k.def.opensArc),'plafond d’arcs ouverts : aucune ouverture');
  gameState.season=6; updateStoryArcs();
  ok(p.storyArcs.every(a=>a.state==='abandonne'),'arcs sans programme : abandonnés');
  p.storyArcs=[{arcId:'refonte',step:1,branch:'retouche',state:'open',openedSeason:1,lastSeason:1,expiresSeason:7,
    entity:{kind:'programme',id:c.id,slot:x.slot,name:c.name},flags:['f1'],history:[]}];
  programStoryRecord(c.id).flags.f1=1;
  c.end=99; gameState.season=6; updateStoryArcs();
  ok(p.storyArcs[0].state==='expire'&&programStoryRecord(c.id).flags.f1==null,'arc inactif expiré, flags supprimés'); }

// ——— 9. Coût récurrent et économie sur le bon objet ———
{ const p=partie();
  const x=PROGRAM_CATALOG.find(y=>y.channelType==='generaliste'&&programGenresOf(y,y.slot).includes('fiction')&&!programHolder(y));
  const c=signe(x.slot,x.id); c.career.seasonsCount=2;
  const def=GENRE_STORY_BANK.find(d=>d.id==='gs_suite_fiction_chere');
  const ctx={...programStoryContext(x.slot,c,getCalculatedPDAs()),form:'stable'};
  const m=genericStoryMatches(def,ctx,new Set()); ok(m,'suite de fiction applicable');
  let d=buildProgramStoryDilemma({def,slot:x.slot,contract:c,ctx,choices:m.choices});
  const a=c.annual, g=p.coutGrilleEngageSaison, rec=d.c[0].finance.recurring;
  const others=Object.entries(p.contracts).filter(([k])=>k!==x.slot).map(([k,v])=>[k,v.annual]);
  joue(d,0);
  ok(rec>0&&near(c.annual-a,rec)&&near(p.coutGrilleEngageSaison-g,rec),'coût récurrent : programme et grille, une seule fois');
  ok(others.every(([k,v])=>near(p.contracts[k].annual,v)),'aucun autre programme touché');
  c.end=gameState.season+2;
  const m2=genericStoryMatches(def,ctx,new Set());
  d=buildProgramStoryDilemma({def,slot:x.slot,contract:c,ctx,choices:m2.choices});
  const i=d.c.findIndex(ch=>ch.finance.category==='E'); ok(i>=0,'contrat réductible : option d’économie proposée');
  const a2=c.annual; joue(d,i); ok(d.c[i].finance.recurring<0&&near(c.annual-a2,d.c[i].finance.recurring),'économie appliquée au programme'); }

// ——— 10. Ancienne partie sans arcs ni mémoire ———
{ const p=partie();
  const x=PROGRAM_CATALOG.find(y=>y.channelType==='generaliste'&&programGenresOf(y,y.slot).some(g=>GS_SHOWS.includes(g))&&!programHolder(y));
  const c=signe(x.slot,x.id); c.career.seasonsCount=3; c.career.wear=60;
  delete p.storyArcs; delete p.programStories;
  gameState=JSON.parse(JSON.stringify(gameState));
  ok(Array.isArray(programStoryCandidates()),'collecte sur une ancienne partie');
  updateStoryArcs(); ensureCampaign(); ok(Array.isArray(gameState.player.storyArcs),'arcs initialisés (??=)'); }
`;
const context = { console };
vm.runInNewContext(scripts.slice(0, -1).join('\n') + tests
  + '\nglobalThis.__s=[GENRE_STORY_BANK.filter(d=>!d.arc).length,Object.keys(NARRATIVE_ARCS).length,GENRE_STORY_BANK.length];',
  context, { filename: 'audience-masters-genre-stories.js' });
const [situations, arcs, defs] = context.__s;
console.log(`OK genre stories: ${situations} situations, ${arcs} arcs (${defs} definitions), texts on the catalogue, missing actors, title priority, arc flow, abandonment, expiry, contextual choices, finance, old saves`);
