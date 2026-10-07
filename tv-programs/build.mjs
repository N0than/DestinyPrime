// Build du style DiceBear `tv-programs`.
//
//   node build.mjs            → assemble, valide, génère dist/ + demo.html et injecte le
//                               moteur dans ../index.html (entre les marqueurs tv-programs)
//   node build.mjs --check    → assemble et valide uniquement
//
// Étapes :
//   1. assemblage de la bibliothèque compacte (chaînes SVG) à partir de src/*.mjs, avec
//      génération automatique du second personnage (« …2 ») et de ses couleurs propres ;
//   2. validation de la StyleDefinition complète avec @dicebear/core (validateur inclus) ;
//   3. tests de rendu : chaque genre/sous-genre, déterminisme, diversité des compositions ;
//   4. bundle « lean » du runtime @dicebear/core (validateurs retirés, ~42 Ko) ;
//   5. écriture de dist/, de demo.html et injection dans index.html.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import * as DiceBearCore from '@dicebear/core';

import { character, legs, torsoF, torsoM, armLeft, armRight, headF, headM, faceF, faceM, hairF, hairM } from './src/characters.mjs';
import { headwear, handheld, accessory, decor } from './src/items.mjs';
import { scene } from './src/scenes.mjs';
import { prop } from './src/props.mjs';
import { composition } from './src/compositions.mjs';
import { PROGRAMS as DEMO_PROGRAMS } from './src/demo-programs.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const CHECK_ONLY = process.argv.includes('--check');
const coreVersion = JSON.parse(fs.readFileSync(path.join(here, 'node_modules/@dicebear/core/package.json'), 'utf8')).version;

// ---------------------------------------------------------------------------
// 1. Assemblage
// ---------------------------------------------------------------------------
const CHARACTER_PARTS = { character, legs, torsoF, torsoM, armLeft, armRight, headF, headM, faceF, faceM, hairF, hairM, headwear, handheld };
const PERSON_COLORS = ['skin', 'hair', 'top', 'bottom'];

const cloneForSecond = comp => {
  const out = { ...comp, variants: {} };
  for (const [name, v] of Object.entries(comp.variants)) {
    let svg = v.svg.replace(/<c name="([A-Za-z]+)"/g, (m, ref) => CHARACTER_PARTS[ref] ? `<c name="${ref}2"` : m);
    svg = svg.replace(new RegExp(`"\\$(${PERSON_COLORS.join('|')})"`, 'g'), '"$$$12"');
    out.variants[name] = { ...v, svg };
  }
  return out;
};

const components = { scene, composition, decor, prop, accessory };
for (const [name, comp] of Object.entries(CHARACTER_PARTS)) {
  components[name] = comp;
  components[`${name}2`] = cloneForSecond(comp);
}
// Le second personnage tient moins souvent un objet : silhouettes plus variées.
components.handheld2.probability = 60;

const SKIN = ['#f8d5b5', '#e8b48e', '#c68a63', '#8d5a3b', '#5c3a28', '#f1c9a0'];
const HAIR = ['#2b1d16', '#5a3825', '#a0522d', '#e5b766', '#1e2a3a', '#b8b8c4', '#c0392b'];
const TOP = ['#4d96ff', '#ff6b6b', '#ffd166', '#06d6a0', '#8e7dff', '#ff9f68', '#2ec4b6', '#f15bb5'];
const BOTTOM = ['#263859', '#3d405b', '#5c4b51', '#2f4858', '#6c757d', '#1d3557'];

// Les couleurs de scène sont toujours fournies par le runtime (palette du genre) ;
// les valeurs ci-dessous ne servent que de repli (palette « jour »).
const JOUR = { sky: '#cfeefa', skyAlt: '#eef9fd', ground: '#9bd48a', groundAlt: '#74bb6c', accent: '#ffb547', accentAlt: '#ff7a59', ink: '#263238', light: '#ffffff' };
const colors = {};
for (const [k, v] of Object.entries(JOUR)) colors[k] = { values: [v] };
Object.assign(colors, {
  skin: { values: SKIN }, skin2: { values: SKIN },
  hair: { values: HAIR }, hair2: { values: HAIR, notEqualTo: ['hair'] },
  top: { values: TOP, notEqualTo: ['accent', 'accentAlt'] }, top2: { values: TOP, notEqualTo: ['top', 'accent', 'accentAlt'] },
  bottom: { values: BOTTOM, notEqualTo: ['top'] }, bottom2: { values: BOTTOM, notEqualTo: ['bottom', 'top2'] }
});

const LIBRARY = {
  meta: {
    creator: { name: 'Audience Masters — tv-programs' },
    source: { name: 'tv-programs', url: 'https://github.com/n0than/destinyprime/tree/main/tv-programs' },
    license: { name: 'MIT' }
  },
  canvas: { width: 320, height: 180, svg: '<c name="scene"/><c name="composition"/><c name="decor"/>' },
  components,
  colors
};

// ---------------------------------------------------------------------------
// 2. Validation (StyleDefinition complète, validateur officiel)
// ---------------------------------------------------------------------------
const runtimeSrc = fs.readFileSync(path.join(here, 'src/runtime.js'), 'utf8');
const sandbox = { DiceBearCore, TV_PROGRAMS_LIBRARY: LIBRARY };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(runtimeSrc, sandbox);
const TP = sandbox.TvPrograms;
const definition = TP.definition();
new DiceBearCore.Style(definition); // lève une StyleValidationError si la définition est invalide

// ---------------------------------------------------------------------------
// 3. Tests de rendu
// ---------------------------------------------------------------------------
const errors = [];
const used = id => new RegExp(`id="(?:${id})2?-`);
const pickedVariant = (svgText, comp) => (svgText.match(new RegExp(`id="${comp}-([A-Za-z0-9]+)-[a-z0-9]+"`)) || [])[1];
const SUBS = Object.fromEntries(Object.entries(TP.SUBGENRES).map(([genre, list]) => [genre, ['', ...list]]));
const stats = {};
for (const genre of Object.keys(TP.GENRES)) {
  for (const sub of SUBS[genre] || ['']) {
    const combos = new Set();
    for (let i = 0; i < 40; i++) {
      const opts = { seed: `test-${i}`, genre, subgenre: sub };
      const a = TP.svg(opts), b = TP.svg(opts);
      if (a !== b) errors.push(`${genre}/${sub}: rendu non déterministe`);
      for (const comp of ['scene', 'composition', 'prop', 'character', 'legs', 'torsoF|torsoM', 'hairF|hairM', 'headF|headM']) {
        if (!used(comp).test(a)) errors.push(`${genre}/${sub} #${i}: composant « ${comp} » absent`);
      }
      if (/\$[a-z]/i.test(a)) errors.push(`${genre}/${sub}: référence de couleur non résolue`);
      combos.add(['scene', 'composition', 'prop', 'hairF', 'hairM', 'torsoF', 'torsoM'].map(c => pickedVariant(a, c) || pickedVariant(a, c + '2')).join('/'));
    }
    stats[`${genre}${sub ? '/' + sub : ''}`] = combos.size;
    if (combos.size < 15) errors.push(`${genre}/${sub}: diversité insuffisante (${combos.size} combinaisons sur 40)`);
  }
}
// Cohérence des silhouettes : jamais de barbe ni de moustache sur une silhouette féminine,
// jamais de robe sur une silhouette masculine.
for (let i = 0; i < 300; i++) {
  const svgText = TP.svg({ seed: `coh-${i}`, genre: Object.keys(TP.GENRES)[i % Object.keys(TP.GENRES).length] });
  if (/id="faceF2?-(beard|mustache)-/.test(svgText) || /id="torsoM2?-dress-/.test(svgText)) errors.push(`silhouette incohérente (graine coh-${i})`);
}
// Chaque genre doit disposer de décors, d'objets et d'accessoires dédiés.
const genresOf = comp => new Set(Object.values(components[comp].variants).flatMap(v => (v.tags || []).filter(t => t.startsWith('genre:')).map(t => t.slice(6))));
for (const comp of ['scene', 'prop', 'accessory', 'decor', 'handheld']) {
  const covered = genresOf(comp);
  for (const genre of Object.keys(TP.GENRES)) if (!covered.has(genre)) errors.push(`aucune variante « ${comp} » pour le genre ${genre}`);
}
// Sous-genres : le décor doit toujours correspondre au sous-genre demandé.
const SUB_SCENES = {
  'sport/football': ['stade'], 'sport/rugby': ['rugby'], 'sport/basket': ['parquet'], 'sport/handball': ['parquet'], 'sport/tennis': ['tennis'],
  'sport/auto': ['circuit'], 'sport/velo': ['col'], 'sport/surf': ['surf'], 'sport/combat': ['ring'], 'sport/ski': ['piste'], 'sport/fitness': ['salleSport'], 'sport/athletisme': ['pisteAthle'],
  'cinema/ceremonie': ['ceremonie'], 'cinema/festival': ['tapisRouge'], 'cinema/film': ['salleCinema'], 'cinema/serie': ['plateauTournage'],
  'aventure/montagne': ['montagne'], 'documentaire/science': ['espace', 'bibliotheque'],
  'documentaire/histoire': ['musee', 'bibliotheque', 'carteMonde'], 'documentaire/nature': ['savane', 'ocean', 'montagne', 'canyon', 'foret']
};
for (const [key, expected] of Object.entries(SUB_SCENES)) {
  const [genre, sub] = key.split('/');
  for (let i = 0; i < 20; i++) {
    const got = pickedVariant(TP.svg({ seed: `s${i}`, genre, subgenre: sub }), 'scene');
    if (!expected.includes(got)) errors.push(`${key}: décor inattendu « ${got} »`);
  }
}
// Programmes de la démo : deux programmes distincts ne doivent pas partager la même image.
const demoUris = new Set(DEMO_PROGRAMS.map(p => TP.forProgram(p)));
if (demoUris.size !== DEMO_PROGRAMS.length) errors.push('deux programmes de la démo partagent la même illustration');

if (errors.length) {
  console.error(`✗ ${errors.length} erreur(s) :\n  - ` + [...new Set(errors)].slice(0, 40).join('\n  - '));
  process.exit(1);
}
const libJson = JSON.stringify(LIBRARY);
console.log(`✓ StyleDefinition valide (${Object.keys(components).length} composants, ${Object.values(components).reduce((n, c) => n + Object.keys(c.variants).length, 0)} variantes)`);
console.log(`✓ rendu déterministe, combinaisons distinctes sur 40 graines : ${Object.entries(stats).map(([k, v]) => `${k}=${v}`).join(' ')}`);
console.log(`  bibliothèque compacte : ${(libJson.length / 1024).toFixed(1)} Ko`);
if (CHECK_ONLY) process.exit(0);

// ---------------------------------------------------------------------------
// 4. Bundle « lean » de @dicebear/core
// ---------------------------------------------------------------------------
const stubValidators = {
  name: 'stub-validators',
  setup(b) {
    b.onResolve({ filter: /Validator\/(Style|Options)Validator\.js$/ }, a => ({ path: a.path, namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, a => ({
      contents: a.path.includes('Style') ? 'export const StyleValidator={validate(){}};' : 'export const OptionsValidator={validate(){}};',
      loader: 'js'
    }));
  }
};
const bundled = await build({
  stdin: { contents: "export { Avatar, Style } from '@dicebear/core';", resolveDir: here, loader: 'js' },
  bundle: true, minify: true, format: 'iife', globalName: 'DiceBearCore', target: 'es2020',
  write: false, legalComments: 'none', plugins: [stubValidators]
});
const coreJs = `/*! @dicebear/core ${coreVersion} — MIT License — https://www.dicebear.com (validateurs retirés : la définition est validée au build) */\n${bundled.outputFiles[0].text.trim()}`;
const libJs = `/*! tv-programs — bibliothèque SVG modulaire (générée par tv-programs/build.mjs) */\nvar TV_PROGRAMS_LIBRARY = ${libJson};`;
const runtimeJs = `;${runtimeSrc.trim()}\n`;

// ---------------------------------------------------------------------------
// 5. Sorties
// ---------------------------------------------------------------------------
const dist = path.join(here, 'dist');
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'tv-programs.json'), JSON.stringify(definition));
fs.writeFileSync(path.join(dist, 'tv-programs.bundle.js'), `${coreJs}\n${libJs}\n${runtimeJs}`);

const scriptTags = `<!-- tv-programs:start — généré par tv-programs/build.mjs, ne pas éditer à la main -->\n<script>${coreJs}</script>\n<script>${libJs}</script>\n<script>${runtimeJs}</script>\n<!-- tv-programs:end -->`;

// Démo autonome
const demoTpl = fs.readFileSync(path.join(here, 'src/demo.template.html'), 'utf8');
const demoHtml = demoTpl
  .replace('<!-- tv-programs:scripts -->', () => scriptTags)
  .replace('/* tv-programs:programs */', () => `const PROGRAMS = ${JSON.stringify(DEMO_PROGRAMS, null, 1)};`);
fs.writeFileSync(path.join(here, 'demo.html'), demoHtml);

// Injection dans le jeu
const indexPath = path.join(here, '..', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
const block = /<!-- tv-programs:start[\s\S]*?<!-- tv-programs:end -->/;
if (block.test(html)) html = html.replace(block, () => scriptTags);
else html = html.replace('<script>render();</script>', () => `${scriptTags}\n<script>render();</script>`);
fs.writeFileSync(indexPath, html);

console.log(`✓ dist/tv-programs.json, dist/tv-programs.bundle.js (${(Buffer.byteLength(`${coreJs}${libJs}${runtimeJs}`) / 1024).toFixed(1)} Ko), demo.html, index.html mis à jour`);
