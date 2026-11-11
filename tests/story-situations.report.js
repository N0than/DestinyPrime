'use strict';
// Diagnostic des clés de situation (consolidation du lot 3) : histoires propres au titre
// rattachées à une situation générique (STORY_SITUATION_KEYS), histoires sans clé, et parmi
// elles celles qu'un indice tiré de l'identifiant signale à examiner (aucune n'est rattachée
// automatiquement). Usage : node tests/story-situations.report.js [--out fichier]
const fs = require('node:fs');
const vm = require('node:vm');
const i = process.argv.indexOf('--out'), OUT = i > 0 ? process.argv[i + 1] : null;
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).slice(0, -1).join('\n');
const ctx = { console };
vm.runInNewContext(scripts + `
render = () => {};
const r = storySituationReport();
const byKey = {};
PROGRAM_STORY_BANK.filter(d => d.genericKey).forEach(d => { (byKey[d.genericKey] ??= []).push(d.id); });
const byHint = {};
r.toReview.forEach(x => { (byHint[x.hint] ??= []).push(x.id); });
globalThis.__R = { r, byKey, byHint, links: Object.keys(SPECIFIC_ARC_LINKS).length };
`, ctx);
const { r, byKey, byHint, links } = ctx.__R;
const lines = [
  `Histoires propres au titre : ${r.keyed + r.unkeyed} ; avec clé de situation : ${r.keyed} ; sans clé : ${r.unkeyed} ; liens vers un arc : ${links}`,
  '',
  'Clés attribuées (table explicite) :',
  ...Object.entries(byKey).map(([k, ids]) => `- ${k} (${ids.length}) : ${ids.join(', ')}`),
  '',
  `Sans clé, signalées par un indice de l'identifiant (${r.toReview.length}) — à examiner, aucune équivalence supposée :`,
  ...Object.entries(byHint).map(([k, ids]) => `- ${k} (${ids.length}) : ${ids.join(', ')}`)
];
const text = lines.join('\n');
console.log(text);
if (OUT) fs.writeFileSync(OUT, text + '\n');
