#!/usr/bin/env node
// Générateur autonome d'illustrations tv-programs, hors de l'application.
//
// Il exécute le moteur compilé du jeu (dist/tv-programs.bundle.js : @dicebear/core 10.7.0
// + bibliothèque de dessins + runtime tv-programs) dans une VM Node : mêmes paramètres,
// même SVG, au caractère près, que dans Audience Masters. Aucune dépendance npm, Node 18+.
//
//   node generate.mjs --genre cuisine --seed p123 --out cuisine.svg
//   node generate.mjs --genre sport --subgenre football --palette nuit --size 1280 --out match.svg
//   node generate.mjs --title "Top Chef" --channel generaliste --out topchef.svg   (classement auto)
//   node generate.mjs --genre talent --variations 12 --out-dir planche            (12 graines)
//   node generate.mjs --program p009 --out motus.svg     (programme du catalogue ; --program all)
//   node generate.mjs --career --out-dir carriere                                 (8 cartes familles)
//   node generate.mjs --genre jeu --seed demo --png --size 1280                   (PNG via Playwright)
//   node generate.mjs --list                                                      (genres, palettes)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sandbox = { structuredClone, TextEncoder, TextDecoder, URL, console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(here, 'dist/tv-programs.bundle.js'), 'utf8'), sandbox);
const TP = sandbox.TvPrograms;

const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};

if (flag('help') || !args.length) {
  const doc = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 15);
  console.log(doc.map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(0);
}

if (flag('list')) {
  console.log('Genres (palettes autorisées, sous-genres) :');
  for (const [g, v] of Object.entries(TP.GENRES)) {
    console.log(`  ${g.padEnd(14)} ${v.label.padEnd(18)} ${v.palettes.join(', ')}`);
    if (TP.SUBGENRES[g]) console.log(`  ${''.padEnd(33)}sous-genres : ${TP.SUBGENRES[g].join(', ')}`);
  }
  console.log('\nPalettes :');
  for (const [p, v] of Object.entries(TP.PALETTES)) console.log(`  ${p.padEnd(9)} ${Object.entries(v).map(([k, c]) => `${k}=${c}`).join(' ')}`);
  process.exit(0);
}

const size = opt('size') ? Number(opt('size')) : undefined;
const jobs = [];
const queue = (file, options) => jobs.push({ file, svg: TP.svg({ ...options, size }) });

if (flag('career')) {
  // Mêmes graines et réglages que CAREER_FAMILIES dans index.html (seed `career:<id>`).
  const FAMILIES = {
    redressement: { genre: 'drame', palette: 'nuit' },
    domination: { genre: 'talent', palette: 'studio' },
    ascension: { genre: 'aventure', subgenre: 'montagne', palette: 'jour' },
    actionnaire: { genre: 'evenement', subgenre: 'commission', palette: 'cobalt' },
    marche: { genre: 'aventure', subgenre: 'survie', palette: 'nuit' },
    thematiques: { genre: 'info', palette: 'jour' },
    courts: { genre: 'jeu', palette: 'neon' },
    narratifs: { genre: 'policier', palette: 'nuit' }
  };
  const dir = opt('out-dir', 'carriere');
  for (const [id, o] of Object.entries(FAMILIES)) queue(path.join(dir, `${id}.svg`), { seed: `career:${id}`, ...o });
} else if (opt('program')) {
  // Programme du catalogue du jeu : mêmes champs que PROGRAM_CATALOG (index.html), puis forProgram.
  const html = fs.readFileSync(path.join(here, '../index.html'), 'utf8');
  const literal = (start, end) => { const i = html.indexOf(start) + start.length; return html.slice(i, html.indexOf(end, i) + end.length - 1); };
  const data = vm.runInNewContext(`(${literal('const PROGRAM_CATALOG_DATA = ', '];')})`);
  const overrides = vm.runInNewContext(`(${literal('const PROGRAM_PITCH_OVERRIDES = ', '\n};')})`);
  const ids = opt('program') === 'all' ? data.map(row => row[0]) : opt('program').split(',');
  for (const id of ids) {
    const row = data.find(r => r[0] === id);
    if (!row) { console.error(`Programme inconnu : ${id}`); process.exit(1); }
    const [, channelType, , format, name, , , , , , , pitch] = row;
    const program = { id, channelType, format, name, ...(overrides[id] || pitch ? { pitch: overrides[id] || pitch } : {}) };
    const { genre, subgenre } = TP.classify(program);
    if (ids.length === 1) console.log(`${id} « ${name} » → ${genre}${subgenre ? ' / ' + subgenre : ''}`);
    queue(ids.length === 1 ? opt('out', `${id}.svg`) : path.join(opt('out-dir', 'programmes'), `${id}.svg`), { seed: id, genre, subgenre });
  }
} else {
  let genre = opt('genre');
  let subgenre = opt('subgenre', '');
  if (!genre && opt('title')) {
    const c = TP.classify({ title: opt('title'), pitch: opt('pitch', ''), format: opt('format'), channelType: opt('channel') });
    genre = c.genre;
    subgenre = subgenre || c.subgenre;
    console.log(`Classement : « ${opt('title')} » → ${genre}${subgenre ? ' / ' + subgenre : ''}`);
  }
  if (!genre) { console.error('Indiquez --genre (ou --title pour un classement automatique). Voir --list.'); process.exit(1); }
  if (!TP.GENRES[genre]) { console.error(`Genre inconnu : ${genre}. Voir --list.`); process.exit(1); }
  if (subgenre && !(TP.SUBGENRES[genre] || []).includes(subgenre)) console.warn(`⚠ Sous-genre « ${subgenre} » inconnu pour ${genre} : ignoré.`);
  const palette = opt('palette');
  if (palette && !TP.PALETTES[palette]) { console.error(`Palette inconnue : ${palette}. Voir --list.`); process.exit(1); }
  const base = { genre, subgenre, palette, backgroundColor: opt('background') };
  const name = `${genre}${subgenre ? '-' + subgenre : ''}`;
  const variations = Number(opt('variations', 0));
  if (variations > 0) {
    const dir = opt('out-dir', name);
    const prefix = opt('seed', genre);
    for (let i = 1; i <= variations; i++) queue(path.join(dir, `${prefix}-${String(i).padStart(2, '0')}.svg`), { ...base, seed: `${prefix}-${i}` });
  } else {
    // Dans le jeu, la graine d'un programme est program.id (à défaut son titre).
    queue(opt('out', `${name}.svg`), { ...base, seed: opt('seed', opt('title', 'tv-programs')) });
  }
}

for (const { file, svg } of jobs) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, svg);
  console.log(`✓ ${file}`);
}

if (flag('png')) {
  // Rasterisation fidèle avec Chromium (Playwright). Alternative : rsvg-convert, sharp, Inkscape.
  let playwright;
  try { playwright = createRequire(import.meta.url)('playwright'); } catch {
    try {
      // Installation globale (npm i -g playwright).
      const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
      playwright = createRequire(path.join(globalRoot, 'noop.js'))('playwright');
    } catch {
      console.error('PNG : installez Playwright (npm i playwright && npx playwright install chromium).');
      process.exit(1);
    }
  }
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  const width = size || 1280;
  const height = Math.round(width * 9 / 16);
  await page.setViewportSize({ width, height });
  for (const { file, svg } of jobs) {
    const sized = svg.replace(/<svg( width="\d+" height="\d+")? /, `<svg width="${width}" height="${height}" `);
    await page.setContent(`<style>html,body{margin:0}svg{display:block}</style>${sized}`);
    const png = file.replace(/\.svg$/, '.png');
    await page.screenshot({ path: png, clip: { x: 0, y: 0, width, height } });
    console.log(`✓ ${png}`);
  }
  await browser.close();
}
