'use strict';
// Optimisations stratégiques : moteur commun de conséquences (engagements différés,
// mémoire relationnelle, signaux), négociations courtes, formats originaux et crises
// contextuelles. Vérifie l'application unique des conséquences, la persistance (copie
// JSON de l'état), le rythme de trois dilemmes par saison et une séquence complète.
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
const tests = String.raw`
const ok=(v,m)=>{if(!v) throw Error(m)};
const near=(a,b,e=1e-6)=>Math.abs(a-b)<e;
render=()=>{};
globalThis.localStorage={d:{},setItem(k,v){this.d[k]=v},getItem(k){return this.d[k]||null},removeItem(k){delete this.d[k]}};
function partie(seed=4242, type='generaliste', cash=500){
  let r=seed>>>0; Math.random=()=>{r=(Math.imul(r,1103515245)+12345)>>>0; return r/4294967296;};
  resetGame(); const p=gameState.player; p.name='Joueur'; p.type=type; p.target='a2549';
  finalizeChannelSetup(); gameState.campaign.seed=seed; launchFirstSeason();
  gameState.seasonKickoffPending=false; gameState.mercatoPending=false;
  gameState.step=6; gameState.dilemmaPhase='choosing'; gameState.currentDilemmaIndex=0; p.tresorerie=cash;
  return p;
}
const p0=()=>gameState.player;
const fillers=()=>DILEMMA_BANK.filter(d=>!d.grille&&!d.requiresRight&&!d.types&&!DYNAMIC_DILEMMAS[d.id]&&!d.requiresProgram).slice(0,2);
function joue(d,i){ gameState.dilemmaQueue=[d,...fillers()]; gameState.currentDilemmaIndex=0; gameState.dilemmaPhase='choosing'; gameState.step=6; chooseDilemmaOption(i); }
// Clôture réelle de la saison en cours (dilemmes joués) puis ouverture de la suivante.
function finirSaison(pick=()=>0){
  let guard=0; while(gameState.step===6&&guard++<14){
    const cur=gameState.dilemmaQueue[gameState.currentDilemmaIndex];
    if(gameState.dilemmaPhase==='choosing'&&cur?.type==='sports_rights_auction'){ startSportsRightsAuction(cur.rightsEventId,cur.id); sportsAuctionPass(); }
    if(gameState.dilemmaPhase==='choosing'){ const i=pick(cur); chooseDilemmaOption(i); if(gameState.dilemmaPhase==='choosing'&&gameState.dilemmaQueue[gameState.currentDilemmaIndex]===cur) chooseDilemmaOption(0); }
    continueAfterConsequence();
  }
}
function saisonSuivante(pick){ finirSaison(pick); ok(gameState.step===7,'fin de saison atteinte'); startNewSeason(); gameState.seasonKickoffPending=false; gameState.mercatoPending=false; }
const exclusive=()=>{ const p=p0(); return PROGRAM_CATALOG.find(x=>x.channelType===p.type&&!programHolder(x)&&!sameProgram(p.contracts[x.slot],x)&&quoteProgram(x.slot,x.id,'interne')?.allowed&&x.rights>0); };

// ——— 1. Moteur de conséquences ———
{ partie(11); const p=p0();
  ok(Array.isArray(p.commitments)&&p.partners&&Array.isArray(p.seasonSignals),'état de conséquences initialisé');
  const a=registerCommitment({kind:'crisisAftermath',key:'k1',effect:{pop:-3,text:'test'}});
  ok(a&&!registerCommitment({kind:'crisisAftermath',key:'k1',effect:{pop:-3}}),'pas de doublon pour une même clé');
  const pop=p.popularite; gameState.season++; processCommitments(); processCommitments();
  ok(p.popularite===pop-3&&a.status==='resolved','conséquence appliquée une seule fois');
  // Ancienne sauvegarde sans les nouveaux champs : migration à la volée.
  const old=JSON.parse(JSON.stringify(gameState)); ['commitments','partners','seasonSignals','originalFormats','crisisWatch','crisisHistory'].forEach(k=>delete old.player[k]);
  Object.assign(gameState,old); ensureCampaign();
  ok(Array.isArray(gameState.player.commitments)&&gameState.player.originalFormats&&gameState.player.crisisWatch,'ancienne sauvegarde migrée');
  ok(stableRandom('x|1')===stableRandom('x|1')&&stableRandom('x|1')!==stableRandom('x|2'),'aléa reproductible'); }

// ——— 2. Négociations ———
{ partie(12); const p=p0(); gameState.season=2;
  const prog=exclusive(); const pitch=createProducerPitchDilemma({kind:'exclusive',program:prog,slot:prog.slot});
  const [sec,bal,agr]=pitch.c;
  ok(sec.negotiation.strategy==='secure'&&bal.negotiation.strategy==='balanced'&&agr.negotiation.strategy==='aggressive','trois stratégies');
  ok(sec.finance.purchase>bal.finance.purchase&&bal.finance.purchase>agr.finance.purchase,'prix : sécurisée > équilibrée > agressive');
  ok(sec.negotiation.terms.years===prog.years+1&&sec.negotiation.terms.exclusive&&!agr.negotiation.terms.exclusive,'durée et exclusivité');
  ok([sec,bal,agr].every(x=>x.negotiation.terms.bonus==null),'plus de prime de performance');
  ok(agr.negotiation.terms.annual<=Math.round(dealTermsFor(quoteProgram(prog.slot,prog.id,'interne'),'secure').annual*0.62/1.08*10)/10+0.1,'négociation agressive : prix nettement plus bas');
  { const reac=[]; for(let k=0;k<60;k++){ const dd={...pitch,id:'neg-'+k}; reac.push(negotiationReaction(dd,'aggressive',producerPartnerId(prog)),negotiationReaction(dd,'balanced',producerPartnerId(prog))); }
    ok(reac.filter(r=>r==='counter').length/reac.length>=0.85,'contre-offres quasi systématiques ('+reac.filter(r=>r==='counter').length+'/'+reac.length+')'); }
  ok(sec.outlook.certain.length&&agr.outlook.risk.length,'conséquences certaines et risques affichés');
  const achats=p.achatsSaison; joue(pitch,0);
  const c=p.contracts[prog.slot];
  ok(sameProgram(c,prog)&&c.exclusive&&c.ownership==='coproduction'&&c.end===gameState.season+prog.years,'sécurisée : signée, exclusive, coproduction, une saison de plus');
  ok(near(p.achatsSaison-achats,sec.negotiation.terms.purchase),'prix négocié payé une seule fois');
  ok(partnerTrust(producerPartnerId(prog))===1,'relation améliorée');
  ok(!biddingCoveted().some(x=>x.contract.id===prog.id),'exclusivité : programme protégé des convoitises'); }
// Réaction reproductible et contre-proposition dans le même dilemme.
{ let found=null;
  for(let k=0;k<40&&!found;k++){ partie(300+k); gameState.season=2; const prog=exclusive(); const d=createProducerPitchDilemma({kind:'exclusive',program:prog,slot:prog.slot});
    if(negotiationReaction(d,'aggressive',producerPartnerId(prog))==='counter') found={seed:300+k}; }
  ok(found,'une négociation agressive peut être contrée');
  partie(found.seed); gameState.season=2; const p=p0(); const prog=exclusive();
  const d=createProducerPitchDilemma({kind:'exclusive',program:prog,slot:prog.slot});
  const r1=negotiationReaction(d,'aggressive',producerPartnerId(prog)), r2=negotiationReaction(d,'aggressive',producerPartnerId(prog));
  ok(r1===r2,'réaction tirée une fois, identique au rechargement');
  gameState.dilemmaQueue=[d,...fillers()]; gameState.currentDilemmaIndex=0; gameState.dilemmaPhase='choosing'; gameState.step=6;
  const desc0=d.desc; chooseDilemmaOption(2);
  ok(gameState.currentDilemmaIndex===0&&gameState.dilemmaPhase==='choosing'&&d.negotiationState?.reaction==='counter','contre-proposition sans consommer le dilemme');
  ok(d.c.length===2&&d.c[0].negotiation.counter&&d.c[1].negotiationAbandon,'accepter ou abandonner');
  ok(!p.contracts[prog.slot]||!sameProgram(p.contracts[prog.slot],prog),'rien n’est signé avant la validation');
  // Tour suivant : même carte, contexte inchangé, encart porté par l'état de négociation.
  const st=d.negotiationState, offre=dealTermsFor(quoteProgram(prog.slot,prog.id,'interne'),'aggressive');
  ok(d.desc===desc0&&st.round===2&&st.partner==='producer'&&st.offer.annual===offre.annual&&st.terms.rights!=null&&/contre-propose/.test(st.message),'tour 2 : contexte fixe, offre du joueur mémorisée');
  ok(d.c[0].l==='Accepter la contre-offre'&&d.c[1].l==='Quitter la négociation','actions du tour issues de la logique');
  const rows=negotiationShowcaseRows(d,true), html=rows.head+rows.chips;
  const vitrine=dilemmaShowcaseHtml(d);
  ok(html.includes('Tour 2 · Contre-offre')&&html.includes('neg-reveal')&&html.includes('étudie votre proposition')&&html.includes('vous propose une contre-proposition'),'vitrine : badge du tour, réflexion, réponse');
  ok(vitrine.includes('Tour 2 · Contre-offre')&&!vitrine.includes('À l’antenne')&&vitrine.indexOf('neg-chips')>vitrine.indexOf('sa-stats'),'« À l’antenne » remplacé, badges de changement sous les blocs');
  const ch=negotiationStatChanges(d), q=quoteProgram(prog.slot,prog.id,'interne');
  ok(ch['Coût annuel'].from===q.annual&&ch['Coût annuel'].to===st.terms.annual&&ch['Engagement'].to===st.terms.years,'blocs : montants du devis vers ceux de la contre-offre');
  const anim=negotiationStatHtml({label:'Coût annuel',value:'x'},ch['Coût annuel'],true), fixe=negotiationStatHtml({label:'Coût annuel',value:'x'},ch['Coût annuel'],false);
  ok(anim.includes('data-neg-to')&&anim.includes(nf1(q.annual))&&!fixe.includes('data-neg-to')&&fixe.includes(nf1(st.terms.annual)),'montants animés, ou affichés directement sans animation');
  const chips=negotiationChips(st.offer,st.terms);
  ok(chips.find(c=>c.label==='Exclusivité').changed&&(html.match(/neg-changed/g)||[]).length===chips.filter(c=>c.changed).length,'badges limités aux conditions qui changent');
  const fixe2=negotiationShowcaseRows(d,false);
  ok(!(fixe2.head+fixe2.chips).includes('neg-reveal')&&seasonsLabel(2)==='deux saisons','sans animation : étape affichée directement');
  const tre=p.tresorerie, ach=p.achatsSaison; chooseDilemmaOption(2); chooseDilemmaOption(3);
  ok(d.negotiationState===st&&p.tresorerie===tre&&p.achatsSaison===ach&&gameState.currentDilemmaIndex===0,'double clic sur un ancien choix : sans effet');
  const terms=d.c[0].negotiation.terms; chooseDilemmaOption(0);
  const c=p.contracts[prog.slot];
  ok(sameProgram(c,prog)&&near(c.annual,terms.annual)&&c.exclusive,'contre-proposition signée à ses conditions');
  ok(!pendingCommitments(e=>e.kind==='performanceBonus').length,'aucune prime de performance enregistrée');
  ok(partnerTrust(producerPartnerId(prog))===0,'négociation agressive puis compromis : relation inchangée'); }
// Revalorisation au renouvellement (mécanisme conservé, posée ici directement).
{ partie(13); gameState.season=3; const p=p0(); const prog=exclusive();
  executeProgramSigning(prog.slot,quoteProgram(prog.slot,prog.id,'interne')); const c=p.contracts[prog.slot];
  c.revaluation={rate:0.15,from:3}; c.end=gameState.season;
  const ren=createCareerRenewalDilemma({slot:prog.slot,programId:c.id});
  const up=ren.c.find(x=>x.revaluation), keep=ren.c.find(x=>x.refuseRevaluation);
  ok(up&&keep&&up.outlook.certain.length&&keep.outlook.risk.length,'renouveler avec ou sans revalorisation');
  const annual=c.annual; applyCareerDilemmaChoice(ren,up);
  ok(c.nextAnnual>annual&&!c.revaluation,'revalorisation programmée');
  gameState.season++; applyContractRevaluations(); ok(near(c.annual,annual+up.revaluation),'coût annuel revalorisé à l’ouverture');
  // Ancienne sauvegarde : une prime de performance en attente est annulée sans effet.
  registerCommitment({kind:'performanceBonus',key:'old-bonus',programId:prog.id,slot:prog.slot,amount:2}); const ach=p.achatsSaison; gameState.season++; processCommitments();
  ok(p.achatsSaison===ach&&!pendingCommitments(e=>e.kind==='performanceBonus').length,'ancienne prime de performance : sans objet'); }
// Refus de revalorisation : le producteur peut partir chez un concurrent.
{ let left=false;
  for(let k=0;k<30&&!left;k++){ partie(500+k); gameState.season=3; const p=p0(); const prog=exclusive();
    executeProgramSigning(prog.slot,quoteProgram(prog.slot,prog.id,'interne')); const c=p.contracts[prog.slot];
    c.revaluation={rate:0.15,from:3}; c.end=gameState.season;
    const ren=createCareerRenewalDilemma({slot:prog.slot,programId:c.id}); applyCareerDilemmaChoice(ren,ren.c.find(x=>x.refuseRevaluation));
    if(c.stopped){ left=true; ok(pendingCommitments(e=>e.kind==='poached').length===1&&partnerTrust(producerPartnerId(prog))<0,'départ programmé, relation dégradée');
      gameState.season++; expireContracts(); processCommitments(); ok(!!programHolder(prog),'le programme rejoint un concurrent'); } }
  ok(left,'un refus de revalorisation peut coûter le programme'); }

// ——— 3. Formats originaux ———
{ partie(14); const p=p0();
  const f=designOriginalFormat({concept:'jeu',positioning:'populaire',target:'a2549',slot:'access',budget:2});
  ok(f&&f.ownership==='owned'&&f.stage==='concept'&&findProgram(f.id)===f,'format conçu, retrouvé comme un programme');
  const ref=slotReference(p.type,'access');
  ok(f.power>=ref.power*0.6*0.85&&f.power<=ref.power*1.45*1.2,'potentiel caché borné');
  ok(f.estimate.min<=f.power&&f.power<=f.estimate.max,'estimation directe : fourchette large contenant le potentiel');
  const tres=p.tresorerie, power=f.power;
  ok(developOriginalFormat(f.id,'pilot')&&!developOriginalFormat(f.id,'pilot'),'pilote financé une seule fois');
  ok(near(tres-p.tresorerie,Math.round(f.annual*ORIGINAL_FORMATS.devCost.pilot*10)/10),'coût du pilote');
  ok(f.power===power&&f.estimate.max-f.estimate.min<(f.annual?99:0)&&f.estimate.min<=f.power&&f.power<=f.estimate.max,'pilote : estimation affinée, potentiel inchangé');
  ok(!launchOriginalFormat(f.id),'pas de lancement avant la fin du pilote');
  gameState.season++; ok(launchOriginalFormat(f.id),'lancement la saison suivante');
  const c=p.contracts.access;
  ok(c.id===f.id&&c.ownership==='owned'&&near(c.power,f.power)&&migrateProgramCareer(c,'access').seasonNumber===1,'format à l’antenne, saison 1, potentiel réel');
  ok(pendingCommitments(e=>e.kind==='formatRevenue'&&e.programId===f.id).length===1,'revenus dérivés à évaluer');
  // Succès : revenus dérivés crédités une seule fois.
  c.career.history.push({season:gameState.season,performance:8,expected:5}); c.career.awareness=60;
  gameState.history.push({season:gameState.season,contracts:JSON.parse(JSON.stringify(p.contracts))});
  const com=p.commercialSaison; gameState.season++; processCommitments(); processCommitments();
  ok(p.commercialSaison>com,'revenus dérivés d’un format à succès');
  const once=p.commercialSaison; processCommitments(); ok(p.commercialSaison===once,'pas de double crédit');
  // Exploitation : la cession des droits n'est plus proposée au renouvellement, seulement au studio.
  c.end=gameState.season; const ren=createCareerRenewalDilemma({slot:'access',programId:c.id});
  ok(!ren.c.some(x=>x.resale||/Céder les droits/.test(x.l))&&!ren.c.some(x=>x.refuseRevaluation),'format détenu : pas de cession au renouvellement, pas de revalorisation');
  // Cession à l'étranger : avance tout de suite, royalties à chaque saison, programme conservé.
  const fo=p.originalFormats[c.id], offres=formatSaleOffers(fo), com2=p.commercialSaison;
  ok(offres.national.price>offres.foreign.upfront&&offres.foreign.royalty>0,'national : prix plus élevé ; étranger : avance + royalties');
  ok(sellOriginalFormat(c.id,'foreign')===offres.foreign.upfront&&near(p.commercialSaison-com2,offres.foreign.upfront)&&!c.stopped&&fo.foreignSale,'étranger : avance encaissée, programme conservé');
  ok(sellOriginalFormat(c.id,'foreign')===0,'étranger : une seule adaptation');
  // Cession nationale : prix seul, dernière saison chez soi, puis grille de l'acquéreur.
  const com3=p.commercialSaison, vendu=sellOriginalFormat(c.id,'national');
  ok(vendu===offres.national.price&&near(p.commercialSaison-com3,vendu)&&c.stopped&&c.end===gameState.season&&fo.soldSeason===gameState.season&&fo.buyer,'national : prix encaissé, dernière saison');
  ok(sellOriginalFormat(c.id,'national')===0,'cession unique');
  const s0=gameState.season; gameState.season++; const com4=p.commercialSaison; payFormatRoyalties(); payFormatRoyalties();
  ok(near(p.commercialSaison-com4,fo.foreignSale.royalty),'royalties versées une fois par saison');
  processCommitments(); const acq=gameState.competitors.find(x=>x.name===fo.buyer);
  ok(acq.contracts[fo.slot]?.id===fo.id,'le format rejoint la grille de l’acquéreur'); gameState.season=s0;
  // Lancement direct : plus rapide, plus incertain.
  const g=designOriginalFormat({concept:'fiction',positioning:'premium',target:'csp',slot:'prime',budget:3});
  ok(g.estimate.stage==='direct'&&(g.estimate.max-g.estimate.min)/g.power>(f.estimate.max-f.estimate.min)/f.power,'lancement direct plus incertain que le pilote');
  ok(launchOriginalFormat(g.id)&&p.contracts.prime.id===g.id,'lancement direct immédiat');
  // Persistance : la fiche survit à la copie JSON de l’état.
  const saved=JSON.parse(JSON.stringify(gameState)); Object.assign(gameState,saved);
  ok(findProgram(g.id)?.name===g.name&&gameState.player.contracts.prime.ownership==='owned','format persistant après rechargement'); }
// Même conception, même potentiel (reproductible) ; budgets différents, coûts différents.
{ partie(15); const a=designOriginalFormat({concept:'magazine',positioning:'jeune',target:'j1524',slot:'nuit',budget:1});
  partie(15); const b=designOriginalFormat({concept:'magazine',positioning:'jeune',target:'j1524',slot:'nuit',budget:1});
  ok(a.power===b.power&&a.name===b.name,'potentiel reproductible');
  partie(15); const c=designOriginalFormat({concept:'magazine',positioning:'jeune',target:'j1524',slot:'nuit',budget:3});
  ok(c.annual>a.annual,'budget ambitieux plus cher'); }

// ——— 4. Crises contextuelles ———
{ partie(16, 'generaliste', 4); const p=p0(); gameState.season=3;
  ok(!updateCrisisWatch()&&p.crisisWatch.cash&&p.seasonSignals.some(s=>/Trésorerie fragile/.test(s.text)),'saison N : signal faible, pas encore de crise');
  gameState.season=4; const v=updateCrisisWatch(); ok(v&&v.kind==='cash','saison N+1 : crise mûre');
  gameState.pendingCrisis=v; gameState.seenDilemmaIds=[]; const q=pickDilemmaQueue();
  ok(q.filter(d=>d.isCrisis).length===1,'une seule crise dans la file');
  const d=q.find(x=>x.isCrisis); ok(d.c.every(c=>c.outlook),'choix de crise lisibles');
  const refuse=d.c.find(c=>c.crisisAction?.type==='aftermath');
  joue(d,d.c.indexOf(refuse));
  ok(pendingCommitments(e=>e.kind==='crisisAftermath').length===1,'conséquence différée enregistrée');
  ok(p.crisisWatch.cash.queued===4&&p.crisisWatch.cash.triggered===4&&p.crisisHistory.length===1,'crise jouée et mémorisée');
  gameState.season=5; ok(!updateCrisisWatch(),'pas de nouvelle crise immédiate (délai)'); }
// Prévention : la vulnérabilité corrigée avant la crise l'écarte.
{ partie(17, 'generaliste', 4); const p=p0(); gameState.season=3; updateCrisisWatch();
  p.tresorerie=400; gameState.season=4;
  ok(!updateCrisisWatch()&&!p.crisisWatch.cash&&p.seasonSignals.some(s=>/Risque écarté/.test(s.text)),'risque écarté par la gestion'); }
// ARCOM : contester expose à une amende la saison suivante.
{ partie(18); const p=p0(); gameState.season=4;
  const d=createCrisisDilemma({key:'arcom',kind:'arcom',data:{score:40}});
  joue(d,1); const e=pendingCommitments(x=>x.kind==='crisisAftermath')[0];
  ok(e&&e.effect.purchase===5&&e.effect.chance===0.5,'amende possible enregistrée');
  const tres=p.tresorerie; gameState.season=5; processCommitments();
  ok(e.status==='resolved'&&(e.outcome==='spared'?p.tresorerie===tres:p.tresorerie<tres),'conséquence tranchée une seule fois'); }
// Talent clé en fin de contrat : le retenir prolonge son contrat et revalorise son coût.
{ partie(19); const p=p0(); gameState.season=4;
  const t={id:MERCATO_TALENTS[0].id,name:MERCATO_TALENTS[0].name,specialty:MERCATO_TALENTS[0].specialty,role:MERCATO_TALENTS[0].role,affinities:MERCATO_TALENTS[0].affinities,annual:2,bonus:.6,until:4,since:2};
  p.talents=[t]; const d=createCrisisDilemma({key:'talent:'+t.id,kind:'talent',data:{talentId:t.id,name:t.name,effect:0.8}});
  joue(d,0); ok(t.until>=5&&t.nextAnnual>2&&t.nextAnnualFrom===5,'talent retenu, revalorisé dès la saison suivante'); }
// Garantie d'audience vendue : pénalité si la PDA recule.
{ partie(20); const p=p0(); const d=DILEMMA_BANK.find(x=>x.id==='d_pub30');
  joue(d,0); const e=pendingCommitments(x=>x.kind==='adGuarantee')[0]; ok(e&&e.amount===4,'garantie enregistrée');
  gameState.history.push({season:gameState.season,pdaDebut:10,pdaCible:8});
  const achats=p.achatsSaison; gameState.season++; processCommitments(); ok(near(p.achatsSaison-achats,4)&&e.outcome==='penalty','pénalité appliquée'); }

// ——— 5. Rythme : trois dilemmes par saison, une crise au plus ———
{ for(const [k,type] of [[21,'generaliste'],[22,'sport'],[23,'jeunesse']]){ partie(k,type,6);
    for(let s=3;s<=12;s++){ gameState.season=s; gameState.seenDilemmaIds=[]; gameState.player.eventsSeen=[]; gameState.pendingCrisis=updateCrisisWatch();
      const q=pickDilemmaQueue(); const base=gameState.dilemmaBaseQueue;
      ok(base.length===3,'trois dilemmes ('+type+', S'+s+')'); ok(q.filter(d=>d.isCrisis).length<=1,'une crise au plus'); } } }

// ——— 6. Séquence complète sur plusieurs saisons ———
// Format original → négociation → lancement → succès ou échec → crise éventuelle →
// renouvellement ou arrêt, sans dérive de trésorerie ni double comptage.
for(const [seed,type,cash] of [[31,'generaliste',500],[32,'sport',60],[33,'culture',20]]){
  partie(seed,type,cash); const p=p0();
  const f=designOriginalFormat({concept:'divertissement',positioning:'populaire',target:p.target,slot:'access',budget:2});
  ok(f&&launchOriginalFormat(f.id),'lancement en saison 1 ('+type+')');
  const pick=cur=>{ if(cur?.isCrisis) return cur.c.length-1; if(cur?.isProducerPitch) return 1; return 0; };
  for(let s=0;s<4&&gameState.step!==8;s++){
    const before={cash:p.tresorerie};
    saisonSuivante(pick);
    if(gameState.step===8) break;
    const h=gameState.history.at(-1);
    ok(near(h.resultatSaison,(h.revenusPub+h.commercial)-(h.coutGrille+h.achats),1e-6),'résultat cohérent ('+type+', S'+h.season+')');
    ok(Number.isFinite(p.tresorerie),'trésorerie finie');
    ok(gameState.dilemmaBaseQueue.length===3,'trois dilemmes par saison');
  }
  ok(p.commitments.every(e=>['pending','resolved','void'].includes(e.status)),'engagements dans un état cohérent');
  const keys=p.commitments.map(e=>e.key+'|'+e.status).filter(k=>k.endsWith('|pending'));
  ok(new Set(keys).size===keys.length,'aucun engagement en double');
}
`;
const context = { console };
vm.runInNewContext(scripts.slice(0, -1).join('\n') + tests, context, { filename: 'audience-masters-strategy.js' });
console.log('OK strategy: consequence engine, negotiations, counter-offers, revaluation, original formats, ownership, contextual crises, prevention, three dilemmas, multi-season sequence, saves');
