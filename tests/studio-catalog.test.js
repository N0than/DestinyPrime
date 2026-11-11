'use strict';
// Catalogue du studio : un format maison qui quitte l'antenne sans être cédé reste un actif de
// la chaîne (hors capacité du studio), relançable en début de saison ou cessible.
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const tests = String.raw`
const ok=(v,m)=>{if(!v) throw Error(m)};
render=()=>{};
globalThis.localStorage={d:{},setItem(){},getItem(){return null}};
function setup(){ resetGame(); const p=gameState.player; p.name='Studio'; p.type='generaliste'; p.target='a2549';
  finalizeChannelSetup(); launchFirstSeason(); gameState.seasonKickoffPending=false; gameState.mercatoPending=false;
  gameState.step=6; gameState.currentDilemmaIndex=0; gameState.dilemmaPhase='choosing'; p.tresorerie=500; return p; }
function lance(p){ const f=designOriginalFormat({concept:'jeu',positioning:'populaire',slot:'access',budget:2});
  f.readySeason=gameState.season; ok(launchOriginalFormat(f.id),'lancement'); return f; }
// Format retiré de l'antenne (non renouvelé) : au catalogue, hors capacité du studio.
{ const p=setup(), f=lance(p);
  ok(!studioCatalogFormats().length&&studioSlotFormats().some(x=>x.id===f.id),'à l’antenne : dans le studio');
  p.contracts.access.end=gameState.season-1; expireContracts();
  ok(studioCatalogFormats().map(x=>x.id).join()===f.id,'non renouvelé : au catalogue');
  ok(!studioSlotFormats().some(x=>x.id===f.id),'ne prend plus de place dans le studio');
  ok(/Formats disponibles/.test(studioCatalogHtml(true))&&/Relancer/.test(studioCatalogHtml(true)),'catalogue affiché');
  gameState=JSON.parse(JSON.stringify(gameState));
  ok(studioCatalogFormats().length===1,'catalogue conservé après rechargement');
  // Relance : de nouveau à l'antenne, sorti du catalogue.
  ok(relaunchOriginalFormat(f.id),'relance');
  const c=gameState.player.contracts.access; ok(c.id===f.id&&c.ownership==='owned'&&c.end>=gameState.season,'format relancé sur sa case');
  ok(!studioCatalogFormats().length,'sorti du catalogue'); }
// Relance hors début de saison : refusée.
{ const p=setup(), f=lance(p); p.contracts.access.end=gameState.season-1; expireContracts(); gameState.currentDilemmaIndex=2;
  ok(!relaunchOriginalFormat(f.id),'relance seulement en début de saison'); }
// Cession étrangère (reste au catalogue) puis nationale (quitte le catalogue, rejoint un concurrent).
{ const p=setup(), f=lance(p); p.contracts.access.end=gameState.season-1; expireContracts();
  const cash=p.tresorerie, up=sellCatalogFormat(f.id,'foreign');
  ok(up>0&&p.tresorerie>cash&&studioCatalogFormats().length===1,'cession étrangère : encaissée, reste au catalogue');
  ok(sellCatalogFormat(f.id,'foreign')===0,'une seule adaptation étrangère');
  const price=sellCatalogFormat(f.id,'national');
  ok(price>0&&f.soldSeason===gameState.season&&f.buyer&&!studioCatalogFormats().length,'cession nationale : quitte le catalogue');
  ok(gameState.player.commitments.some(e=>e.kind==='formatSold'&&e.programId===f.id),'rejoint la grille de l’acquéreur'); }
// Format cédé avant de quitter l'antenne : jamais au catalogue.
{ const p=setup(), f=lance(p); sellOriginalFormat(f.id,'national'); p.contracts.access.end=gameState.season-1; expireContracts();
  ok(!studioCatalogFormats().length,'format déjà cédé : pas au catalogue'); }
console.log('OK studio catalog: off-air formats kept as channel assets, outside studio capacity, relaunch at season start, foreign and national sale, save/reload');
`;
vm.runInNewContext(scripts.slice(0, -1).join('\n') + tests, { console, structuredClone, URLSearchParams }, { filename: 'audience-masters-studio-catalog.js' });
