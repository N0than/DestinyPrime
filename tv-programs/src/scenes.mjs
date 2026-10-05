// Décors de fond (calque 320 × 180). Le sol est aligné sur y ≈ 150 pour que les
// personnages et objets centraux s'y posent tous de la même façon.
// Chaque décor est étiqueté par genre et, si besoin, par sous-genre : un décor sans
// étiquette « sub » reste disponible pour tous les sous-genres de son genre.
import {
  r, rectD, circleD, blob, cloud, sun, moon, star, heart, palm, roundTree, pine, bush, plantPot, mountain,
  building, spotlightBeam, spot, curtains, floor, stage, windowFrame, tiles, bulbs
} from './helpers.mjs';

const g = (...genres) => genres.map(x => `genre:${x}`);
const sky = (fill = '$sky') => `<rect width="320" height="180" fill="${fill}"/>`;
const hills = (y, fill = '$groundAlt', opacity = 1) =>
  `<path d="M0 ${y}q60 -26 120 -6t110 -10t90 4V180H0z" fill="${fill}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ''}/>`;
const wall = (y = 148, fill = '$skyAlt') => `<rect width="320" height="${y}" fill="${fill}"/>`;
const plank = (y = 148, fill = '$ground') => {
  let out = `<rect x="0" y="${y}" width="320" height="${180 - y}" fill="${fill}"/>`;
  for (let x = 0; x < 320; x += 40) out += `<path d="M${x} ${y}l${x < 160 ? -12 : 12} ${180 - y}" stroke="$ink" stroke-opacity="0.07" stroke-width="2"/>`;
  return out + `<rect x="0" y="${y}" width="320" height="3" fill="$ink" fill-opacity="0.08"/>`;
};
const screen = (x, y, w, h, inner = '$accentAlt') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="$ink"/><rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 6}" rx="2" fill="${inner}"/>`
  + `<path d="M${x + 6} ${y + h - 8}l${r(w * 0.25)} ${r(-h * 0.3)} ${r(w * 0.15)} ${r(h * 0.15)} ${r(w * 0.2)} ${r(-h * 0.25)}" stroke="$light" stroke-opacity="0.55" stroke-width="2" fill="none"/>`;
const shelf = (x, y, w) =>
  `<rect x="${x}" y="${y}" width="${w}" height="4" rx="1" fill="$ink" fill-opacity="0.25"/>`;
const frame = (x, y, w, h, inner = '$accent') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="$light"/><rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 6}" fill="${inner}" fill-opacity="0.75"/>`
  + `<path d="M${x + 3} ${y + h - 3}l${r((w - 6) * 0.4)} ${r(-(h - 6) * 0.5)} ${r((w - 6) * 0.3)} ${r((h - 6) * 0.3)} ${r((w - 6) * 0.3)} ${r(-(h - 6) * 0.2)}V${y + h - 3}z" fill="$light" fill-opacity="0.5"/>`;
const lamp = (x, y, len = 22) =>
  `<path d="M${x} 0v${y - len}" stroke="$ink" stroke-opacity="0.5" stroke-width="1.5"/><path d="M${x - 9} ${y}q9 -${len / 2} 18 0z" fill="$accent"/><circle cx="${x}" cy="${y + 2}" r="3" fill="$light"/>`;
const sea = (y, fill = '#4fc3f7', foam = '$light') =>
  `<rect x="0" y="${y}" width="320" height="${180 - y}" fill="${fill}"/>`
  + `<path d="M0 ${y + 6}q20 -5 40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0" stroke="${foam}" stroke-opacity="0.6" stroke-width="2" fill="none"/>`;
const sand = (y = 150, fill = '#f3dca2') =>
  `<path d="M0 ${y}q80 -8 160 -2t160 -4V180H0z" fill="${fill}"/><path d="M0 ${y + 2}q80 -8 160 -2t160 -4" stroke="#e3c27a" stroke-width="2" fill="none"/>`;
const rain = () => {
  let d = '';
  for (let i = 0; i < 26; i++) d += `M${(i * 47) % 320} ${(i * 29) % 140}l-3 9`;
  return `<path d="${d}" stroke="$light" stroke-opacity="0.45" stroke-width="1.4" stroke-linecap="round"/>`;
};
const stripes = (y0, y1, fill, opacity = 0.12, step = 24) => {
  let d = '';
  for (let x = 0; x < 320; x += step * 2) d += rectD(x, y0, step, y1 - y0);
  return `<path d="${d}" fill="${fill}" fill-opacity="${opacity}"/>`;
};
const grandstand = (y = 112, fill = '$skyAlt') => {
  const ds = ['', '', '', ''];
  for (let i = 0; i < 40; i++) ds[i % 4] += circleD(4 + i * 8, y - 26 + (i % 3) * 9, 3);
  return `<rect x="0" y="${y - 30}" width="320" height="34" fill="$ink" fill-opacity="0.22"/>`
    + ['$accent', '$accentAlt', '$light', fill].map((c, i) => `<path d="${ds[i]}" fill="${c}" fill-opacity="0.85"/>`).join('');
};
const floodlight = (x, y) =>
  `<rect x="${x - 1.5}" y="${y}" width="3" height="${112 - y}" fill="$ink" fill-opacity="0.4"/><rect x="${x - 10}" y="${y - 8}" width="20" height="10" rx="2" fill="$ink" fill-opacity="0.6"/>`
  + `<circle cx="${x - 5}" cy="${y - 3}" r="2.5" fill="$light"/><circle cx="${x + 5}" cy="${y - 3}" r="2.5" fill="$light"/>`;
const question = (x, y, s = 1, fill = '$light') =>
  `<path d="M${x - 8 * s} ${y - 10 * s}q0 -10 ${r(9 * s)} -10t${r(9 * s)} 9q0 6 -${r(6 * s)} 9t-${r(3 * s)} 7" stroke="${fill}" stroke-width="${r(5 * s)}" fill="none" stroke-linecap="round"/><circle cx="${x}" cy="${r(y + 13 * s)}" r="${r(3 * s)}" fill="${fill}"/>`;
const wheel = (cx, cy, rad) => {
  let out = `<circle cx="${cx}" cy="${cy}" r="${rad + 5}" fill="$ink"/>`;
  const cols = ['$accent', '$accentAlt', '$light', '$skyAlt'];
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2, a1 = ((i + 1) / 8) * Math.PI * 2;
    out += `<path d="M${cx} ${cy}L${r(cx + rad * Math.cos(a0))} ${r(cy + rad * Math.sin(a0))}A${rad} ${rad} 0 0 1 ${r(cx + rad * Math.cos(a1))} ${r(cy + rad * Math.sin(a1))}z" fill="${cols[i % 4]}"/>`;
  }
  return out + `<circle cx="${cx}" cy="${cy}" r="6" fill="$ink"/>` + bulbs(cx - rad, cx + rad, cy - rad - 9, 12);
};
const cityline = (base = 120, fill = '$skyAlt', win = '$light', op = 0.6) =>
  building(0, 40, 56, base, fill, win, op) + building(46, 30, 78, base, fill, win, op) + building(82, 44, 46, base, fill, win, op)
  + building(200, 36, 70, base, fill, win, op) + building(242, 30, 50, base, fill, win, op) + building(278, 42, 84, base, fill, win, op);
const tape = (y) =>
  `<path d="M0 ${y}L320 ${y - 16}v9L0 ${y + 9}z" fill="#ffd60a"/>`
  + Array.from({ length: 12 }, (_, i) => `<path d="M${i * 28 + 6} ${r(y + 9 - i * 28 * 16 / 320)}l10 -9h6l-10 9z" fill="$ink" fill-opacity="0.8"/>`).join('');
const pinBoard = (x, y, w, h) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#c79a6b"/><rect x="${x + 4}" y="${y + 4}" width="${w - 8}" height="${h - 8}" rx="2" fill="#dcb58a"/>`
  + `<rect x="${x + 10}" y="${y + 10}" width="18" height="22" fill="$light"/><rect x="${x + w - 30}" y="${y + 12}" width="20" height="16" fill="$light"/><rect x="${x + w / 2 - 9}" y="${y + h - 30}" width="18" height="20" fill="$light"/>`
  + `<circle cx="${x + 19}" cy="${y + 19}" r="5" fill="$ink" fill-opacity="0.3"/>`
  + `<path d="M${x + 19} ${y + 12}L${x + w - 20} ${y + 14}L${x + w / 2} ${y + h - 28}z" stroke="#d62828" stroke-width="1.4" fill="none"/>`
  + `<circle cx="${x + 19}" cy="${y + 12}" r="2" fill="#d62828"/><circle cx="${x + w - 20}" cy="${y + 14}" r="2" fill="#d62828"/><circle cx="${x + w / 2}" cy="${y + h - 28}" r="2" fill="#d62828"/>`;
const rainbow = (cx, cy, rad) =>
  ['#ff6b6b', '#ffb547', '#ffe066', '#7bd389', '#4d96ff', '#9b5de5'].map((c, i) =>
    `<path d="M${cx - rad + i * 6} ${cy}a${rad - i * 6} ${rad - i * 6} 0 0 1 ${2 * (rad - i * 6)} 0" stroke="${c}" stroke-width="6" fill="none"/>`).join('');
const net = (x, y, w, h) => {
  let d = '';
  for (let xx = x + 6; xx < x + w; xx += 6) d += `M${xx} ${y}v${h}`;
  for (let yy = y + 6; yy < y + h; yy += 6) d += `M${x} ${yy}h${w}`;
  return `<path d="${d}" stroke="$light" stroke-opacity="0.45" stroke-width="0.8"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="$light" stroke-width="3"/>`;
};
const ledWall = (x0, y0, x1, y1) => {
  const ds = ['', '', ''];
  for (let x = x0 + 6; x < x1 - 4; x += 10) {
    for (let y = y0 + 6; y < y1 - 4; y += 10) {
      const k = (x * 3 + y * 7) % 5;
      ds[k < 2 ? 0 : k < 4 ? 1 : 2] += rectD(x, y, 7, 7);
    }
  }
  return `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="4" fill="$ink" fill-opacity="0.55"/>`
    + `<path d="${ds[0]}" fill="$accent" fill-opacity="0.35"/><path d="${ds[1]}" fill="$accentAlt" fill-opacity="0.35"/><path d="${ds[2]}" fill="$light" fill-opacity="0.6"/>`;
};
const pool = (x, y, w, h) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="$light"/><rect x="${x + 4}" y="${y + 3}" width="${w - 8}" height="${h - 6}" rx="4" fill="#4fc3f7"/>`
  + `<path d="M${x + 12} ${y + h / 2}q8 -4 16 0t16 0M${x + w - 50} ${y + h / 2 + 3}q8 -4 16 0t16 0" stroke="$light" stroke-opacity="0.7" stroke-width="2" fill="none"/>`;
const candle = (x, y) =>
  `<rect x="${x - 2}" y="${y}" width="4" height="12" rx="1" fill="$light"/><path d="M${x} ${y - 7}q4 4 0 6q-4 -2 0 -6z" fill="#ffb547"/><circle cx="${x}" cy="${y - 3}" r="7" fill="#ffd166" fill-opacity="0.2"/>`;
const garland = (y = 26) =>
  `<path d="M0 ${y - 8}q80 26 160 0t160 0" stroke="$ink" stroke-opacity="0.4" stroke-width="1" fill="none"/>`
  + [20, 60, 100, 140, 180, 220, 260, 300].map((x, i) => `<circle cx="${x}" cy="${r(y - 8 + 8 * Math.sin((x / 160) * Math.PI) ** 2 + 4)}" r="3.4" fill="${['$accent', '$accentAlt', '$light'][i % 3]}"/>`).join('');
const awning = (y = 30, a = '$accentAlt', b = '$light') =>
  Array.from({ length: 10 }, (_, i) => `<path d="M${i * 32} 0h32v${y}q-16 10 -32 0z" fill="${i % 2 ? b : a}"/>`).join('');
const crate = (x, y, fill = '#c68642') =>
  `<rect x="${x}" y="${y}" width="44" height="26" rx="2" fill="${fill}"/><path d="M${x} ${y + 9}h44M${x} ${y + 18}h44" stroke="#8d5524" stroke-width="1.5"/>`;
const fruitPile = (x, y, c1, c2) =>
  [0, 9, 18, 27, 4.5, 13.5, 22.5].map((dx, i) => `<circle cx="${x + 4 + dx}" cy="${y - (i > 3 ? 11 : 4)}" r="5" fill="${i % 2 ? c1 : c2}"/>`).join('');
const brick = (y0 = 0, y1 = 148, fill = '$groundAlt') => {
  let d = '';
  for (let y = y0; y < y1; y += 12) {
    for (let x = ((y / 12) % 2) * 14 - 14; x < 320; x += 28) d += rectD(x + 1, y + 1, 26, 10);
  }
  return `<rect width="320" height="${y1}" fill="${fill}"/><path d="${d}" fill="$ink" fill-opacity="0.12"/>`;
};
const globe = (cx, cy, rad) =>
  `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="$accent" fill-opacity="0.9"/>`
  + `<ellipse cx="${cx}" cy="${cy}" rx="${r(rad * 0.45)}" ry="${rad}" fill="none" stroke="$light" stroke-opacity="0.6" stroke-width="1.5"/>`
  + `<path d="M${cx - rad} ${cy}h${rad * 2}M${r(cx - rad * 0.86)} ${r(cy - rad * 0.5)}h${r(rad * 1.72)}M${r(cx - rad * 0.86)} ${r(cy + rad * 0.5)}h${r(rad * 1.72)}" stroke="$light" stroke-opacity="0.6" stroke-width="1.5"/>`;
const planet = (cx, cy, rad, fill) =>
  `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${fill}"/><ellipse cx="${cx}" cy="${cy}" rx="${rad * 1.7}" ry="${r(rad * 0.4)}" fill="none" stroke="$light" stroke-opacity="0.7" stroke-width="2" transform="rotate(-18 ${cx} ${cy})"/>`;
const column = (x, y, h, fill = '$light') =>
  `<rect x="${x - 2}" y="${y}" width="22" height="6" fill="${fill}"/><rect x="${x}" y="${y + 6}" width="18" height="${h - 12}" fill="${fill}" fill-opacity="0.85"/>`
  + `<path d="M${x + 5} ${y + 8}v${h - 16}M${x + 9} ${y + 8}v${h - 16}M${x + 13} ${y + 8}v${h - 16}" stroke="$ink" stroke-opacity="0.08" stroke-width="1.5"/><rect x="${x - 2}" y="${y + h - 6}" width="22" height="6" fill="${fill}"/>`;
const wave = (x, y, s = 1) =>
  `<path d="M${x} ${y}q${r(30 * s)} ${r(-70 * s)} ${r(90 * s)} ${r(-60 * s)}q${r(-36 * s)} ${r(10 * s)} ${r(-24 * s)} ${r(40 * s)}q${r(10 * s)} ${r(-14 * s)} ${r(30 * s)} ${r(-8 * s)}q${r(-18 * s)} ${r(10 * s)} ${r(-6 * s)} ${r(28 * s)}z" fill="#29b6f6"/>`
  + `<path d="M${r(x + 60 * s)} ${r(y - 62 * s)}q${r(-20 * s)} ${r(6 * s)} ${r(-14 * s)} ${r(24 * s)}" stroke="$light" stroke-width="3" fill="none" stroke-linecap="round"/>`;

// ---------------------------------------------------------------------------
export const scene = {
  width: 320, height: 180,
  variants: {
    // --- Aventure -----------------------------------------------------------
    jungle: { tags: [...g('aventure'), 'sub:survie'], svg: sky() + sun(262, 40, 16) + mountain(70, 140, 170, 90, '$skyAlt') + mountain(250, 140, 150, 70, '$skyAlt') + cloud(40, 44) + hills(132, '$groundAlt', 0.7) + palm(28, 152, 82) + palm(296, 152, 72) + bush(60, 152, 1.3) + bush(262, 152, 1.1) + floor(150) + bush(14, 180, 1.2) + bush(312, 182, 1.4) },
    plage: { tags: [...g('aventure', 'telerealite'), 'sub:survie'], svg: sky() + sun(70, 54, 18) + cloud(220, 40, 1.1) + sea(112) + `<path d="M228 112q20 -18 44 -8q16 -10 40 0h8v4h-92z" fill="$groundAlt"/>` + palm(258, 112, 34) + sand(146) + palm(30, 160, 92) + `<path d="M210 168q10 -4 20 0" stroke="#e3c27a" stroke-width="2" fill="none"/>` },
    montagne: { tags: [...g('aventure', 'documentaire'), 'sub:montagne', 'sub:nature'], svg: sky() + sun(56, 40, 12, '$light') + mountain(90, 150, 220, 120, '$skyAlt', true) + mountain(240, 150, 200, 96, '$groundAlt', true) + mountain(160, 150, 120, 60, '$groundAlt') + cloud(196, 52, 1.2) + floor(150) + pine(26, 156, 1.4) + pine(294, 158, 1.2) + pine(48, 160, 0.9) },
    temple: { tags: [...g('aventure'), 'sub:survie'], svg: sky() + `<path d="M110 150V96h100v54z" fill="$skyAlt"/><path d="M122 96V74h76v22zM136 74V56h48v18z" fill="$skyAlt"/><path d="M110 96h100M122 74h76" stroke="$ink" stroke-opacity="0.12" stroke-width="3"/><rect x="148" y="118" width="24" height="32" rx="12" fill="$ink" fill-opacity="0.3"/>` + `<path d="M118 96q10 18 4 40M200 74q-8 20 4 34" stroke="$groundAlt" stroke-width="4" fill="none" stroke-linecap="round"/>` + palm(34, 152, 86) + palm(292, 152, 76) + bush(84, 152, 1.2) + bush(236, 152, 1.3) + floor(150) },
    canyon: { tags: [...g('aventure', 'documentaire'), 'sub:survie', 'sub:nature'], svg: sky() + sun(248, 46, 18) + `<path d="M0 64h50l10 20h30l8 66H0z" fill="#d97b4a"/><path d="M320 54h-60l-8 24h-22l-12 72h102z" fill="#c4643a"/><path d="M0 92h86M244 96h76" stroke="$ink" stroke-opacity="0.1" stroke-width="4"/>` + `<path d="M120 150q4 -40 20 -44t20 44z" fill="#e39a6a"/>` + floor(150, '#f0b98c', '#e39a6a') + `<path d="M40 166q8 -16 4 -36M38 150l-8 -6M44 140l8 -6" stroke="#4caf50" stroke-width="5" fill="none" stroke-linecap="round"/>` },

    // --- Jeu de plateau -----------------------------------------------------
    plateauQuiz: { tags: g('jeu'), svg: sky('$sky') + blob(160, 70, 260, 120, '$skyAlt', 0.6) + `<circle cx="160" cy="62" r="44" fill="$ink" fill-opacity="0.5"/><circle cx="160" cy="62" r="38" fill="$accentAlt"/>` + question(160, 58, 1.6) + bulbs(20, 300, 12, 20) + spotlightBeam(40, 0, 50) + spotlightBeam(280, 0, 50) + stage(146) },
    plateauEcrans: { tags: g('jeu', 'info'), svg: sky('$sky') + screen(24, 30, 80, 54) + screen(120, 22, 80, 62, '$accent') + screen(216, 30, 80, 54) + bulbs(20, 300, 100, 14, '$accentAlt') + stage(146) + spot(40, 10) + spot(280, 10, true) },
    plateauRoue: { tags: g('jeu', 'divertissement'), svg: sky('$sky') + blob(160, 80, 300, 140, '$skyAlt', 0.5) + wheel(160, 68, 46) + spotlightBeam(30, 0, 40) + spotlightBeam(290, 0, 40) + stage(146) },

    // --- Divertissement / humour / talent -----------------------------------
    rideau: { tags: g('divertissement', 'humour', 'talent'), svg: sky('$sky') + spotlightBeam(160, 0, 90, 160, '$light', 0.18) + `<circle cx="160" cy="150" r="70" fill="$light" fill-opacity="0.08"/>` + curtains() + stage(146) + bulbs(80, 240, 172, 16) },
    escalier: { tags: g('divertissement', 'talent'), svg: sky('$sky') + ledWall(40, 14, 280, 104) + `<path d="M70 146h180v-10h-150v-10h120v-10h-90z" fill="$light" fill-opacity="0.85"/><path d="M70 146h180v-10h-150v-10h120v-10h-90" stroke="$accent" stroke-width="1.5" fill="none"/>` + stage(146) + spotlightBeam(30, 0, 60) + spotlightBeam(290, 0, 60) },
    gala: { tags: g('divertissement', 'talent', 'humour'), svg: sky('$sky') + `<path d="M0 0h320v40q-80 20 -160 0t-160 0z" fill="$skyAlt"/>` + garland(46) + star(60, 80, 1.2, '$accent') + star(260, 70, 1.4, '$accent') + star(110, 100, 0.8, '$light') + star(220, 106, 0.8, '$light') + spotlightBeam(110, 0, 60, 160, '$accent', 0.12) + spotlightBeam(210, 0, 60, 160, '$accentAlt', 0.12) + stage(146) },
    concert: { tags: g('talent'), svg: sky('$sky') + `<path d="M0 30h320" stroke="$ink" stroke-width="6"/>` + spot(40, 36) + spot(120, 36) + spot(200, 36, true) + spot(280, 36, true) + spotlightBeam(40, 40, 40, 150, '$accent', 0.18) + spotlightBeam(120, 40, 40, 150, '$accentAlt', 0.18) + spotlightBeam(200, 40, 40, 150, '$accent', 0.18) + spotlightBeam(280, 40, 40, 150, '$accentAlt', 0.18) + stage(146) + `<path d="M0 180q20 -22 40 0q20 -22 40 0q20 -22 40 0q20 -22 40 0q20 -22 40 0q20 -22 40 0q20 -22 40 0q20 -22 40 0z" fill="$ink" fill-opacity="0.6"/>` },
    standup: { tags: g('humour'), svg: brick(0, 148, '$skyAlt') + `<circle cx="160" cy="74" r="58" fill="$light" fill-opacity="0.15"/>` + `<rect x="236" y="24" width="56" height="36" rx="18" fill="$accentAlt"/><circle cx="252" cy="42" r="4" fill="$light"/><circle cx="264" cy="42" r="4" fill="$light"/><circle cx="276" cy="42" r="4" fill="$light"/>` + plank(148) },

    // --- Télé-réalité -------------------------------------------------------
    villa: { tags: g('telerealite', 'dating'), svg: sky() + sun(270, 34, 14) + `<rect x="60" y="54" width="200" height="94" fill="$light"/><rect x="60" y="44" width="200" height="12" fill="$accent"/><rect x="80" y="70" width="34" height="44" rx="2" fill="$skyAlt"/><rect x="143" y="70" width="34" height="44" rx="2" fill="$skyAlt"/><rect x="206" y="70" width="34" height="44" rx="2" fill="$skyAlt"/>` + palm(30, 150, 90) + palm(296, 150, 80) + floor(148, '$ground') + pool(90, 152, 140, 22) },
    loft: { tags: g('telerealite', 'magazine'), svg: wall(148, '$skyAlt') + windowFrame(28, 22, 70, 76) + windowFrame(226, 22, 70, 76) + lamp(160, 40) + frame(134, 62, 52, 36) + plantPot(118, 148, 1.2) + plantPot(206, 148, 1.1, '$accentAlt') + plank(148) },
    ile: { tags: [...g('telerealite', 'aventure', 'dating'), 'sub:survie'], svg: sky() + sun(160, 92, 26, '$accent') + sea(104, '#4fc3f7') + `<path d="M0 104h320" stroke="$light" stroke-opacity="0.5" stroke-width="2"/>` + sand(146) + palm(24, 156, 96) + palm(286, 154, 84) + `<path d="M60 150l10 -24 10 24z" fill="#c9a46a"/><path d="M54 128l16 -14 16 14z" fill="#a8743f"/>` },

    // --- Dating -------------------------------------------------------------
    terrasse: { tags: g('dating'), svg: sky() + sun(160, 108, 34, '$accent') + `<rect x="0" y="108" width="320" height="40" fill="$accentAlt" fill-opacity="0.25"/>` + garland(28) + `<path d="M0 120h320" stroke="$light" stroke-width="3"/>` + Array.from({ length: 17 }, (_, i) => `<rect x="${i * 20}" y="120" width="3" height="28" fill="$light"/>`).join('') + floor(148, '$ground') + plantPot(24, 150, 1.4) + plantPot(296, 150, 1.4, '$accentAlt') },
    chandelles: { tags: g('dating', 'drame'), svg: wall(148, '$sky') + `<rect x="0" y="0" width="320" height="148" fill="$ink" fill-opacity="0.12"/>` + windowFrame(116, 22, 88, 70, '$skyAlt') + moon(176, 50, 10) + `<path d="M40 0v60M80 0v40M240 0v40M280 0v60" stroke="$ink" stroke-opacity="0.4" stroke-width="1"/>` + candle(40, 66) + candle(80, 46) + candle(240, 46) + candle(280, 66) + heart(160, 118, 0.9, '$accentAlt', 0.6) + plank(148) },
    coucher: { tags: g('dating', 'telerealite'), svg: `<rect width="320" height="180" fill="$accent" fill-opacity="0.55"/><rect width="320" height="70" fill="$accentAlt" fill-opacity="0.35"/>` + sun(160, 112, 30, '$light') + sea(112, '$accentAlt') + sand(148) + palm(290, 156, 88) + heart(70, 50, 1, '$light', 0.7) },

    // --- Cuisine ------------------------------------------------------------
    cuisine: { tags: g('cuisine'), svg: wall(148, '$skyAlt') + tiles(56, 104, 14) + `<rect x="0" y="104" width="320" height="44" fill="$accentAlt"/><rect x="0" y="100" width="320" height="6" rx="2" fill="$light"/><path d="M80 112v30M160 112v30M240 112v30" stroke="$ink" stroke-opacity="0.15" stroke-width="2"/><circle cx="72" cy="126" r="2" fill="$light"/><circle cx="168" cy="126" r="2" fill="$light"/>` + shelf(30, 34, 80) + `<circle cx="44" cy="28" r="6" fill="$accent"/><rect x="58" y="20" width="10" height="14" rx="2" fill="$groundAlt"/><circle cx="86" cy="28" r="6" fill="$accentAlt"/>` + `<path d="M210 0v20h70v-20M200 20h90l-10 18h-70z" fill="#b0bec5"/>` + floor(148, '$ground', '$groundAlt') },
    marche: { tags: g('cuisine'), svg: sky() + cloud(250, 34) + awning(34) + `<rect x="0" y="34" width="320" height="4" fill="$ink" fill-opacity="0.15"/><rect x="18" y="38" width="4" height="70" fill="$ink" fill-opacity="0.4"/><rect x="298" y="38" width="4" height="70" fill="$ink" fill-opacity="0.4"/>` + `<rect x="0" y="100" width="320" height="48" fill="#c68642"/><rect x="0" y="100" width="320" height="6" fill="#a0522d"/>` + crate(16, 82) + fruitPile(18, 82, '#e53935', '#ff7043') + crate(70, 82, '#d39468') + fruitPile(72, 82, '#7cb342', '#aed581') + crate(206, 82) + fruitPile(208, 82, '#ffb300', '#ffd54f') + crate(260, 82, '#d39468') + fruitPile(262, 82, '#8e24aa', '#ab47bc') + floor(148) },
    studioCuisine: { tags: g('cuisine'), svg: sky('$sky') + blob(160, 70, 280, 120, '$skyAlt', 0.7) + `<rect x="40" y="30" width="240" height="60" rx="8" fill="$light" fill-opacity="0.65"/>` + shelf(60, 54, 200) + `<circle cx="80" cy="47" r="7" fill="$accent"/><rect x="100" y="40" width="12" height="14" rx="3" fill="$accentAlt"/><circle cx="132" cy="48" r="6" fill="$groundAlt"/><rect x="150" y="42" width="16" height="12" rx="3" fill="$accent"/><circle cx="188" cy="47" r="7" fill="$accentAlt"/><rect x="208" y="40" width="12" height="14" rx="3" fill="$groundAlt"/><circle cx="240" cy="48" r="6" fill="$accent"/>` + spot(30, 10) + spot(290, 10, true) + floor(148, '$ground', '$groundAlt') },

    // --- Policier -----------------------------------------------------------
    ruelle: { tags: g('policier', 'drame'), svg: sky('$sky') + moon(270, 34, 13) + star(40, 24, 0.5) + star(200, 18, 0.4) + cityline(148, '$skyAlt', '$accent', 0.75) + `<rect x="150" y="60" width="4" height="88" fill="$ink"/><path d="M146 60h20q4 0 4 6" stroke="$ink" stroke-width="4" fill="none"/><path d="M160 70l-26 78h52z" fill="$accent" fill-opacity="0.18"/>` + floor(148, '$ground', '$groundAlt') },
    bureauEnquete: { tags: g('policier'), svg: wall(148, '$skyAlt') + `<rect width="320" height="148" fill="$ink" fill-opacity="0.08"/>` + pinBoard(110, 20, 110, 76) + windowFrame(24, 26, 60, 60, '$sky') + moon(46, 46, 8) + lamp(268, 40, 18) + `<rect x="246" y="96" width="40" height="52" rx="3" fill="$ink" fill-opacity="0.35"/><path d="M246 113h40M246 130h40" stroke="$light" stroke-opacity="0.3" stroke-width="2"/>` + plank(148) },
    sceneCrime: { tags: g('policier'), svg: sky('$sky') + cityline(140, '$skyAlt', '$light', 0.5) + `<rect x="0" y="140" width="320" height="8" fill="$ink" fill-opacity="0.2"/>` + `<circle cx="60" cy="40" r="22" fill="#4d96ff" fill-opacity="0.25"/><circle cx="270" cy="44" r="22" fill="#ef476f" fill-opacity="0.25"/>` + floor(148) + tape(126) },

    // --- Drame --------------------------------------------------------------
    salon: { tags: g('drame', 'magazine', 'generique'), svg: wall(148, '$skyAlt') + `<rect x="0" y="0" width="320" height="18" fill="$ink" fill-opacity="0.05"/>` + windowFrame(36, 28, 64, 72) + frame(132, 34, 56, 40) + frame(204, 44, 34, 30, '$accentAlt') + lamp(272, 52) + plantPot(286, 148, 1.3) + plank(148) },
    fenetreVille: { tags: g('drame', 'policier', 'info'), svg: wall(148, '$skyAlt') + `<rect x="30" y="18" width="260" height="100" rx="4" fill="$light"/><rect x="36" y="24" width="248" height="88" rx="2" fill="$sky"/>` + `<g transform="translate(36 24) scale(0.775 0.6)">${cityline(146, '$skyAlt', '$accent', 0.8)}</g>` + `<path d="M160 24v88M36 68h248" stroke="$light" stroke-width="4"/>` + plank(148) },
    pluie: { tags: g('drame'), svg: sky('$sky') + `<rect width="320" height="180" fill="$ink" fill-opacity="0.15"/>` + cloud(30, 30, 1.6, '$skyAlt', 1) + cloud(200, 24, 2, '$skyAlt', 1) + cityline(148, '$skyAlt', '$accent', 0.6) + rain() + floor(148) + `<ellipse cx="80" cy="166" rx="30" ry="4" fill="$light" fill-opacity="0.25"/><ellipse cx="250" cy="170" rx="24" ry="3" fill="$light" fill-opacity="0.25"/>` },

    // --- Sport --------------------------------------------------------------
    stade: { tags: [...g('sport'), 'sub:football'], svg: sky() + floodlight(30, 30) + floodlight(290, 30) + grandstand(112) + `<rect x="0" y="112" width="320" height="68" fill="#5cb85c"/>` + stripes(112, 180, '$light', 0.08, 32) + `<path d="M0 140h320M160 112v68" stroke="$light" stroke-opacity="0.7" stroke-width="2"/><ellipse cx="160" cy="146" rx="40" ry="10" fill="none" stroke="$light" stroke-opacity="0.7" stroke-width="2"/>` + `<g transform="translate(268 96)">${net(0, 0, 44, 28)}</g>` },
    rugby: { tags: [...g('sport'), 'sub:rugby'], svg: sky() + cloud(90, 40) + grandstand(112) + `<rect x="0" y="112" width="320" height="68" fill="#66bb6a"/>` + stripes(112, 180, '$light', 0.08, 40) + `<path d="M40 70v80M80 70v80M40 116h40" stroke="$light" stroke-width="4"/><path d="M240 70v80M280 70v80M240 116h40" stroke="$light" stroke-width="4"/>` },
    parquet: { tags: [...g('sport'), 'sub:basket', 'sub:handball'], svg: wall(110, '$sky') + grandstand(110) + `<rect x="0" y="110" width="320" height="70" fill="#e0a96d"/>` + Array.from({ length: 16 }, (_, i) => `<path d="M${i * 20} 110v70" stroke="#c68642" stroke-opacity="0.5" stroke-width="1"/>`).join('') + `<ellipse cx="160" cy="150" rx="44" ry="12" fill="none" stroke="$light" stroke-width="2.5"/><path d="M0 128h320" stroke="$light" stroke-width="2.5"/>` + `<rect x="276" y="40" width="4" height="70" fill="$ink"/><rect x="262" y="40" width="34" height="22" rx="2" fill="$light" stroke="$ink" stroke-width="2"/><ellipse cx="270" cy="66" rx="9" ry="3" fill="none" stroke="#f28c28" stroke-width="2.5"/>` },
    tennis: { tags: [...g('sport'), 'sub:tennis'], svg: sky() + cloud(60, 36) + `<rect x="0" y="80" width="320" height="32" fill="$groundAlt" fill-opacity="0.6"/>` + `<rect x="0" y="112" width="320" height="68" fill="#d9773e"/><path d="M20 180l40 -68h200l40 68M60 140h200" stroke="$light" stroke-width="2.5" fill="none"/>` + `<g transform="translate(40 116)">${net(0, 0, 240, 18)}</g>` },
    circuit: { tags: [...g('sport'), 'sub:auto'], svg: sky() + cloud(220, 38) + grandstand(108) + `<rect x="0" y="108" width="320" height="72" fill="#546e7a"/><path d="M0 108h320" stroke="$light" stroke-width="3"/>` + Array.from({ length: 16 }, (_, i) => `<rect x="${i * 20}" y="104" width="10" height="6" fill="${i % 2 ? '#e53935' : '$light'}"/>`).join('') + `<path d="M0 146h40M70 146h40M140 146h40M210 146h40M280 146h40" stroke="$light" stroke-width="3"/>` },
    col: { tags: [...g('sport'), 'sub:velo'], svg: sky() + sun(60, 40, 14) + mountain(110, 150, 260, 120, '$skyAlt', true) + mountain(260, 150, 180, 90, '$groundAlt') + `<path d="M0 150q120 -30 320 -10V180H0z" fill="$ground"/><path d="M0 162q140 -36 320 -16" stroke="#78909c" stroke-width="12" fill="none"/><path d="M0 162q140 -36 320 -16" stroke="$light" stroke-width="1.5" stroke-dasharray="10 8" fill="none"/>` + pine(290, 128, 0.9) },
    surf: { tags: [...g('sport'), 'sub:surf'], svg: sky() + sun(270, 40, 16) + cloud(40, 40) + sea(96, '#4fc3f7') + wave(20, 150, 1.2) + wave(200, 150, 0.9) + sand(150) },
    ring: { tags: [...g('sport'), 'sub:combat'], svg: sky('$sky') + `<rect width="320" height="180" fill="$ink" fill-opacity="0.25"/>` + spotlightBeam(160, 0, 110, 150, '$light', 0.16) + `<rect x="20" y="70" width="6" height="80" fill="$light"/><rect x="294" y="70" width="6" height="80" fill="$light"/><path d="M26 80h268M26 100h268M26 120h268" stroke="$accentAlt" stroke-width="3"/>` + `<rect x="0" y="148" width="320" height="32" fill="$light" fill-opacity="0.9"/><rect x="0" y="160" width="320" height="20" fill="$accentAlt"/>` },
    piste: { tags: [...g('sport'), 'sub:ski'], svg: sky() + sun(270, 36, 13, '$light') + mountain(80, 150, 240, 130, '$skyAlt', true) + mountain(250, 150, 200, 100, '$skyAlt', true) + `<path d="M0 120q160 10 320 30V180H0z" fill="#ffffff"/>` + pine(30, 132, 1) + pine(52, 136, 0.8) + pine(296, 158, 1.2) + `<path d="M110 130l8 -22M140 134l8 -22" stroke="#e53935" stroke-width="2.5"/><path d="M118 108l6 3-6 3zM148 112l6 3-6 3z" fill="#e53935"/>` },
    salleSport: { tags: [...g('sport'), 'sub:fitness'], svg: wall(148, '$skyAlt') + windowFrame(30, 24, 80, 66) + windowFrame(210, 24, 80, 66) + `<rect x="130" y="40" width="60" height="6" rx="3" fill="$ink" fill-opacity="0.5"/><rect x="124" y="32" width="10" height="22" rx="3" fill="$accentAlt"/><rect x="186" y="32" width="10" height="22" rx="3" fill="$accentAlt"/>` + `<rect x="0" y="140" width="320" height="8" fill="$accent" fill-opacity="0.5"/>` + plank(148, '$ground') },
    arene: { tags: [...g('sport'), 'sub:general'], svg: sky() + floodlight(30, 26) + floodlight(290, 26) + grandstand(112) + `<rect x="0" y="112" width="320" height="68" fill="$groundAlt"/>` + stripes(112, 180, '$light', 0.08, 30) + `<path d="M0 140h320" stroke="$light" stroke-opacity="0.6" stroke-width="2"/>` },

    // --- Documentaire -------------------------------------------------------
    savane: { tags: [...g('documentaire', 'aventure'), 'sub:nature', 'sub:survie'], svg: `<rect width="320" height="180" fill="#ffe0b2"/>` + sun(160, 92, 34, '#ffb74d') + `<path d="M0 118q80 -10 160 -2t160 -6V180H0z" fill="#e6b85c"/>` + `<path d="M40 150q2 -40 4 -46M44 104q-30 -2 -36 6q30 6 72 0q-6 -8 -36 -6z" stroke="#6d4c41" stroke-width="4" fill="#7cb342"/><path d="M270 150q2 -34 4 -40M274 110q-24 -2 -30 6q24 6 60 0q-6 -8 -30 -6z" stroke="#6d4c41" stroke-width="4" fill="#7cb342"/>` + floor(150, '#f0c76c', '#e6b85c') + `<path d="M200 52q5 -5 10 0q5 -5 10 0" stroke="$ink" stroke-opacity="0.5" stroke-width="2" fill="none"/>` },
    ocean: { tags: [...g('documentaire'), 'sub:nature'], svg: `<rect width="320" height="180" fill="#0288d1"/><rect width="320" height="70" fill="#4fc3f7" fill-opacity="0.6"/>` + `<path d="M40 0l30 180M120 0l10 180M220 0l-20 180" stroke="$light" stroke-opacity="0.08" stroke-width="18"/>` + `<g fill="#ffb74d"><path d="M60 50q10 -8 20 0q-10 8 -20 0zM80 50l6 -5v10z"/><path d="M250 76q8 -6 16 0q-8 6 -16 0zM266 76l5 -4v8z"/></g>` + `<circle cx="100" cy="90" r="3" fill="$light" fill-opacity="0.5"/><circle cx="104" cy="78" r="2" fill="$light" fill-opacity="0.5"/><circle cx="230" cy="40" r="2.5" fill="$light" fill-opacity="0.5"/>` + `<path d="M0 150q40 -10 80 0t80 0t80 0t80 0V180H0z" fill="#f3dca2"/><path d="M30 150q-6 -26 4 -40M40 150q8 -24 0 -36M280 152q-8 -30 4 -44M290 152q6 -20 0 -30" stroke="#26a69a" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M250 152q4 -16 14 -16t12 16z" fill="#ff8a80"/>` },
    musee: { tags: [...g('documentaire'), 'sub:histoire', 'sub:culture'], svg: wall(148, '$skyAlt') + `<path d="M0 0h320v14H0z" fill="$ink" fill-opacity="0.08"/>` + column(20, 14, 134) + column(282, 14, 134) + frame(64, 34, 70, 52) + frame(186, 30, 70, 60, '$accentAlt') + `<rect x="148" y="104" width="24" height="44" fill="$light"/><circle cx="160" cy="92" r="12" fill="$accent" fill-opacity="0.85"/>` + plank(148, '$ground') },
    espace: { tags: [...g('documentaire', 'jeunesse'), 'sub:science'], svg: `<rect width="320" height="180" fill="#1a2350"/>` + star(30, 20, 0.6) + star(90, 50, 0.4) + star(210, 26, 0.7) + star(290, 70, 0.5) + star(150, 14, 0.4) + star(250, 110, 0.4) + star(50, 100, 0.5) + planet(240, 54, 20, '$accent') + `<circle cx="70" cy="60" r="12" fill="$accentAlt"/><circle cx="66" cy="56" r="3" fill="$ink" fill-opacity="0.2"/>` + `<path d="M0 150q160 -26 320 0V180H0z" fill="#9aa5b1"/><circle cx="60" cy="160" r="6" fill="$ink" fill-opacity="0.15"/><circle cx="250" cy="164" r="8" fill="$ink" fill-opacity="0.15"/>` },
    bibliotheque: { tags: [...g('documentaire', 'magazine', 'info'), 'sub:histoire', 'sub:culture', 'sub:science'], svg: wall(148, '$skyAlt') + Array.from({ length: 3 }, (_, row) => shelf(20, 44 + row * 32, 280) + Array.from({ length: 20 }, (_, i) => { const h = 18 + ((i * 7 + row * 3) % 8); return `<rect x="${24 + i * 14 + (row * 5) % 7}" y="${44 + row * 32 - h}" width="10" height="${h}" rx="1.5" fill="${['$accent', '$accentAlt', '$groundAlt', '$ink'][(i + row) % 4]}" fill-opacity="${(i + row) % 4 === 3 ? 0.4 : 0.85}"/>`; }).join('')).join('') + plank(148) },
    foret: { tags: [...g('documentaire', 'aventure', 'jeunesse'), 'sub:nature', 'sub:survie'], svg: sky() + sun(260, 40, 14) + hills(120, '$groundAlt', 0.5) + pine(40, 152, 1.8) + pine(80, 150, 1.3) + roundTree(250, 152, 1.6) + pine(292, 152, 1.5) + roundTree(120, 150, 1) + floor(150) + bush(196, 156, 1) },

    // --- Magazine / info ----------------------------------------------------
    plateauMag: { tags: g('magazine', 'humour', 'generique'), svg: wall(148, '$sky') + blob(160, 60, 220, 110, '$skyAlt') + `<rect x="34" y="20" width="252" height="80" rx="40" fill="$light" fill-opacity="0.5"/>` + plantPot(40, 148, 1.5) + plantPot(282, 148, 1.4, '$accentAlt') + lamp(96, 46) + lamp(224, 46) + plank(148, '$ground') },
    plateauJT: { tags: g('info'), svg: sky('$sky') + `<rect x="20" y="16" width="280" height="96" rx="6" fill="$ink" fill-opacity="0.35"/><rect x="26" y="22" width="268" height="84" rx="4" fill="$skyAlt"/>` + `<g transform="translate(26 22) scale(0.8375 0.55)">${cityline(150, '$sky', '$accent', 0.6)}</g>` + globe(250, 56, 20) + `<rect x="26" y="90" width="268" height="16" fill="$accentAlt"/><rect x="34" y="95" width="70" height="6" rx="3" fill="$light" fill-opacity="0.7"/>` + stage(146, '$groundAlt') },
    carteMonde: { tags: [...g('info', 'documentaire'), 'sub:histoire', 'sub:culture'], svg: sky('$sky') + `<rect x="30" y="18" width="260" height="104" rx="8" fill="$skyAlt"/>` + `<path d="M60 50q20 -14 46 -6t14 22q-8 18 -26 14t-26 10q-14 -12 -10 -24t2 -16zM140 40q30 -8 54 4t40 -2q24 4 26 22t-22 18q-18 -6 -30 10t-30 -6q-20 -6 -26 -20t-12 -26zM200 92q14 -6 26 2t-4 18q-16 0 -22 -20zM96 86q12 -2 16 12t-10 18q-10 -10 -6 -30z" fill="$accent" fill-opacity="0.6"/>` + `<circle cx="96" cy="58" r="4" fill="$accentAlt"/><circle cx="214" cy="62" r="4" fill="$accentAlt"/><path d="M96 58q60 -40 118 4" stroke="$accentAlt" stroke-width="1.5" stroke-dasharray="4 3" fill="none"/>` + stage(146, '$groundAlt') },

    // --- Jeunesse -----------------------------------------------------------
    parcArcEnCiel: { tags: g('jeunesse'), svg: sky() + rainbow(160, 120, 110) + cloud(40, 120, 1.4, '$light', 1) + cloud(236, 120, 1.4, '$light', 1) + roundTree(30, 152, 1.3) + roundTree(292, 152, 1.1, '$accent') + floor(150) + `<circle cx="80" cy="162" r="3" fill="$accentAlt"/><circle cx="240" cy="166" r="3" fill="$accent"/><circle cx="200" cy="160" r="2.5" fill="$light"/>` },
    chambre: { tags: g('jeunesse'), svg: wall(148, '$sky') + Array.from({ length: 8 }, (_, i) => `<circle cx="${20 + i * 40}" cy="${20 + (i % 2) * 14}" r="6" fill="$light" fill-opacity="0.5"/>`).join('') + windowFrame(30, 30, 64, 64) + moon(60, 56, 9) + `<rect x="220" y="80" width="70" height="68" rx="6" fill="$accent"/><rect x="226" y="88" width="58" height="16" rx="3" fill="$light" fill-opacity="0.5"/><rect x="226" y="110" width="58" height="16" rx="3" fill="$light" fill-opacity="0.5"/>` + `<path d="M120 20l10 18 10 -18" stroke="$accentAlt" stroke-width="2" fill="none"/><path d="M150 20l10 18 10 -18" stroke="$accent" stroke-width="2" fill="none"/>` + plank(148) },
    bonbons: { tags: g('jeunesse', 'humour'), svg: sky('$sky') + blob(160, 80, 300, 150, '$skyAlt', 0.6) + `<g transform="translate(40 50)"><circle r="16" fill="$accent"/><path d="M-16 0l-10 -8v16zM16 0l10 -8v16z" fill="$accent"/></g><g transform="translate(270 40)"><circle r="14" fill="$accentAlt"/><path d="M-14 0l-9 -7v14zM14 0l9 -7v14z" fill="$accentAlt"/></g>` + `<rect x="240" y="90" width="4" height="58" fill="$light"/><circle cx="242" cy="86" r="16" fill="$accentAlt"/><circle cx="242" cy="86" r="9" fill="$light" fill-opacity="0.4"/>` + `<path d="M0 148q20 -14 40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0V180H0z" fill="$ground"/>` },

    // --- Générique ----------------------------------------------------------
    studioTV: { tags: g('generique', 'magazine', 'divertissement'), svg: sky('$sky') + blob(160, 70, 240, 120, '$skyAlt', 0.7) + `<g transform="translate(26 30)"><rect x="0" y="0" width="30" height="20" rx="3" fill="$ink"/><circle cx="12" cy="10" r="6" fill="#9aa5b1"/><path d="M15 20l-8 40M15 20l8 40M15 20v40" stroke="$ink" stroke-width="2"/></g>` + spot(280, 20, true) + spotlightBeam(280, 26, 50, 150, '$light', 0.12) + `<rect x="120" y="22" width="80" height="40" rx="20" fill="$accent" fill-opacity="0.85"/><circle cx="160" cy="42" r="10" fill="$light"/><circle cx="160" cy="42" r="5" fill="$accentAlt"/>` + stage(146) },
    salonTV: { tags: g('generique'), svg: wall(148, '$skyAlt') + `<rect x="108" y="30" width="104" height="66" rx="6" fill="$ink"/><rect x="114" y="36" width="92" height="54" rx="3" fill="$accent" fill-opacity="0.8"/><path d="M130 70l20 -18 14 10 26 -20" stroke="$light" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="150" y="96" width="20" height="10" fill="$ink"/>` + plantPot(40, 148, 1.4) + lamp(270, 52) + plank(148) }
  }
};
