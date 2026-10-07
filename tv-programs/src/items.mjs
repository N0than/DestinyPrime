// Couvre-chefs, objets tenus en main, accessoires au sol et éléments décoratifs.
// Les variantes sont étiquetées par genre (« genre:… ») et éventuellement sous-genre
// (« sub:… ») : le filtre de tags de DiceBear ne retient que celles du programme.
import { HAND } from './characters.mjs';
import { star, heart, confettiField, cloud, r, statuette } from './helpers.mjs';

const g = (...genres) => genres.map(x => `genre:${x}`);
const H = HAND;

// --- Couvre-chefs (repère du personnage, tête centrée en 30,18) ---------------------
export const headwear = {
  width: 60, height: 110, probability: 45,
  variants: {
    explorer: { tags: g('aventure', 'documentaire'), svg: '<path d="M12 11q18-7 36 0q-3 4-18 4t-18-4z" fill="#c9a46a"/><path d="M20 10q1-10 10-10t10 10q-10 3-20 0z" fill="#d8b57a"/><path d="M20 8q10 3 20 0v2q-10 3-20 0z" fill="#8a5a33"/>' },
    beanie: { tags: [...g('aventure', 'sport'), 'sub:montagne', 'sub:ski', 'sub:survie'], svg: '<path d="M18 12q0-11 12-11t12 11z" fill="$accentAlt"/><rect x="17" y="10" width="26" height="5" rx="2.5" fill="$accent"/><circle cx="30" cy="0" r="3" fill="$light"/>' },
    toque: { tags: g('cuisine'), svg: '<path d="M21 9q-6-1-6-7 0-6 7-5 2-5 8-5t8 5q7-1 7 5t-6 7z" fill="#ffffff"/><rect x="21" y="7" width="18" height="6" rx="1.5" fill="#f1f1f1"/><path d="M24 2q2 4 1 6M35 2q-2 4-1 6" stroke="#dcdcdc" stroke-width="1.2" fill="none"/>' },
    cap: { tags: g('sport', 'telerealite', 'jeunesse'), svg: '<path d="M18 13q0-11 12-11t12 11z" fill="$accent"/><path d="M38 12h12q-1 3-12 3z" fill="$accentAlt"/><circle cx="30" cy="2.5" r="1.5" fill="$accentAlt"/>' },
    fedora: { tags: g('policier'), svg: '<path d="M11 12q19-5 38 0q-4 3-19 3t-19-3z" fill="#4a4e69"/><path d="M20 11q0-11 10-11t10 11q-10 2-20 0z" fill="#5c6080"/><path d="M20 8q10 2 20 0v2.5q-10 2-20 0z" fill="#22223b"/>' },
    party: { tags: g('jeunesse', 'divertissement', 'humour'), svg: '<path d="M22 9l8-19 8 19q-8 3-16 0z" fill="$accent"/><path d="M25 3l4-1M23.5 6.5l9-2M27 -3l3-1" stroke="$light" stroke-width="2" stroke-linecap="round"/><circle cx="30" cy="-11" r="3" fill="$accentAlt"/>' },
    headset: { tags: g('info', 'magazine', 'jeu', 'talent', 'generique'), svg: '<path d="M18 17q0-15 12-15t12 15" stroke="$ink" stroke-width="2.4" fill="none"/><rect x="15.5" y="14" width="5" height="9" rx="2.5" fill="$ink"/><rect x="39.5" y="14" width="5" height="9" rx="2.5" fill="$ink"/><path d="M18 22q2 8 9 7" stroke="$ink" stroke-width="1.6" fill="none"/><circle cx="27.5" cy="29" r="1.8" fill="$ink"/>' },
    flower: { tags: g('dating', 'telerealite'), svg: '<g transform="translate(40 8)"><circle cx="0" cy="-4" r="3.2" fill="$accentAlt"/><circle cx="4" cy="0" r="3.2" fill="$accentAlt"/><circle cx="0" cy="4" r="3.2" fill="$accentAlt"/><circle cx="-4" cy="0" r="3.2" fill="$accentAlt"/><circle cx="0" cy="0" r="2.4" fill="$accent"/></g>' },
    crown: { tags: g('talent', 'divertissement'), svg: '<path d="M20 9l1-10 5 5 4-7 4 7 5-5 1 10z" fill="#ffc83d"/><circle cx="30" cy="-3" r="1.6" fill="$accentAlt"/><rect x="20" y="7.5" width="20" height="3" rx="1" fill="#e0a800"/>' },
    helmet: { tags: [...g('sport'), 'sub:auto', 'sub:velo'], svg: '<path d="M17 18q0-17 13-17t13 17q-6-3-13-3t-13 3z" fill="$accent"/><path d="M22 6q8-4 16 0" stroke="$light" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M17 17q13-4 26 0v3q-13-3-26 0z" fill="$ink" fill-opacity="0.35"/>' }
  }
};

// --- Objets tenus en main (centrés sur la main droite) -------------------------------
const at = (svg, dx = 0, dy = 0) => `<g transform="translate(${H.x + dx} ${H.y + dy})">${svg}</g>`;
export const handheld = {
  width: 60, height: 110, probability: 85,
  variants: {
    mic: { tags: g('talent', 'divertissement', 'humour', 'info', 'magazine', 'generique', 'jeu', 'telerealite', 'cinema'), svg: at('<rect x="-2" y="-2" width="4" height="14" rx="2" fill="$ink"/><circle cx="0" cy="-6" r="5" fill="#9aa5b1"/><path d="M-4 -8h8M-4.5 -5h9M-4 -2.5h8" stroke="$ink" stroke-opacity="0.3" stroke-width="0.8"/>', 0, -4) },
    cue: { tags: g('info', 'magazine', 'jeu'), svg: at('<rect x="-5" y="-14" width="13" height="17" rx="2" fill="$light" transform="rotate(12)"/><path d="M-2 -10h8M-2 -6h8M-2 -2h5" stroke="$ink" stroke-opacity="0.3" stroke-width="1.2" transform="rotate(12)"/>', 0, 0) },
    magnifier: { tags: g('policier', 'documentaire'), svg: at('<path d="M0 2l6 10" stroke="#6d4c41" stroke-width="3.5" stroke-linecap="round"/><circle cx="-3" cy="-6" r="8" fill="$skyAlt" fill-opacity="0.6" stroke="$ink" stroke-width="2.4"/><path d="M-7 -9q2-3 5-3" stroke="$light" stroke-width="1.6" fill="none" stroke-linecap="round"/>', 0, 0) },
    notebook: { tags: g('policier', 'info', 'documentaire'), svg: at('<rect x="-4" y="-16" width="14" height="18" rx="2" fill="$accent"/><rect x="-1" y="-13" width="9" height="12" rx="1" fill="$light"/><path d="M1 -10h5M1 -7h5M1 -4h3" stroke="$ink" stroke-opacity="0.35" stroke-width="1"/>', 0, 2) },
    compass: { tags: [...g('aventure')], svg: at('<circle cx="2" cy="-4" r="8" fill="#c9a46a"/><circle cx="2" cy="-4" r="6" fill="$light"/><path d="M2 -9l2 5-2 5-2-5z" fill="$accentAlt"/><circle cx="2" cy="-4" r="1" fill="$ink"/>', 0, 0) },
    torch: { tags: [...g('aventure'), 'sub:survie', 'sub:montagne'], svg: at('<rect x="-1.8" y="-10" width="3.6" height="22" rx="1.5" fill="#8a5a33"/><path d="M0 -22q8 6 3 12-1 2-3 2t-3-2q-5-6 3-12z" fill="#ff9f1c"/><path d="M0 -16q4 3 1.5 6h-3q-2.5-3 1.5-6z" fill="#ffd166"/>', 0, 0) },
    map: { tags: [...g('aventure', 'documentaire')], svg: at('<path d="M-6 -16l6 2 6-2 6 2v18l-6-2-6 2-6-2z" fill="#f4e1b3"/><path d="M0 -14v18M6 -16v18" stroke="#c9a46a" stroke-width="1"/><path d="M-3 -8l4 3 5-2" stroke="$accentAlt" stroke-width="1.3" fill="none" stroke-dasharray="2 1.5"/>', 0, 4) },
    football: { tags: [...g('sport'), 'sub:football'], svg: at('<circle cx="0" cy="-6" r="7" fill="#ffffff" stroke="$ink" stroke-width="1"/><path d="M0 -9l2.5 1.8-1 3h-3l-1-3z" fill="$ink"/><path d="M-6 -8l2.5 0M6 -8l-2.5 0M-3 0l1.5-2M3 0l-1.5-2" stroke="$ink" stroke-width="1"/>', 0, 0) },
    basketball: { tags: [...g('sport'), 'sub:basket'], svg: at('<circle cx="0" cy="-6" r="7.5" fill="#f28c28"/><path d="M-7.5 -6h15M0 -13.5v15M-5 -11.5q4 5.5 0 11M5 -11.5q-4 5.5 0 11" stroke="$ink" stroke-opacity="0.6" stroke-width="1" fill="none"/>', 0, 0) },
    rugby: { tags: [...g('sport'), 'sub:rugby'], svg: at('<ellipse cx="0" cy="-6" rx="9" ry="5.5" fill="#a0522d" transform="rotate(-30 0 -6)"/><path d="M-3 -7.5l6 3M-1.5 -9l1 1.5M1 -7.8l1 1.5M3.5 -6.3l1 1.5" stroke="#ffffff" stroke-width="1.1" transform="rotate(-30 0 -6)"/>', 0, 0) },
    handball: { tags: [...g('sport'), 'sub:handball'], svg: at('<circle cx="0" cy="-5" r="6.5" fill="$accent"/><path d="M-6.5 -5q6.5 3 13 0M0 -11.5q-3 6.5 0 13" stroke="$light" stroke-width="1.2" fill="none"/>', 0, 0) },
    racket: { tags: [...g('sport'), 'sub:tennis'], svg: at('<rect x="-1.5" y="-4" width="3" height="14" rx="1.5" fill="$ink"/><ellipse cx="0" cy="-13" rx="7" ry="9" fill="none" stroke="$accentAlt" stroke-width="2.4"/><path d="M-5 -16h10M-6 -12h12M-5 -8h10M-3 -20v14M0 -21v16M3 -20v14" stroke="$light" stroke-opacity="0.7" stroke-width="0.7"/><circle cx="9" cy="-24" r="3" fill="#d4e157"/>', 0, 0) },
    flag: { tags: [...g('sport'), 'sub:auto', 'sub:velo'], svg: at('<rect x="-1" y="-24" width="2" height="34" rx="1" fill="$ink"/><rect x="1" y="-24" width="16" height="11" fill="#ffffff"/><path d="M1 -24h4v3.7h-4zM9 -24h4v3.7h-4zM5 -20.3h4v3.7h-4zM13 -20.3h4v3.7h-4zM1 -16.6h4v3.6h-4zM9 -16.6h4v3.6h-4z" fill="$ink"/>', 0, 0) },
    gloves: { tags: [...g('sport'), 'sub:combat'], svg: at('<path d="M-6 -12q0-6 6-6h3q5 0 5 6v8q0 4-4 4h-6q-4 0-4-4z" fill="#e63946"/><path d="M-6 -6q-4 0-4-4t5-3" fill="#c1121f"/><rect x="-5" y="-1" width="11" height="5" rx="1.5" fill="$light"/>', 0, 0) },
    flambeau: { tags: [...g('sport'), 'sub:athletisme'], svg: at('<path d="M-2.4 10h4.8l2-16h-8.8z" fill="#cfd8dc"/><path d="M-5 -6h10l-1.5 3h-7z" fill="#ffc83d"/><path d="M0 -7q-8 -6 -1.5 -17q1 5 4 5q1 -5 -1 -9q10 7 3 21z" fill="#ff7a00"/><path d="M0 -7q-3.5 -4 0 -10q3.5 5 1.5 10z" fill="#ffd54f"/>', 0, 0) },
    trophy: { tags: g('sport', 'divertissement', 'talent', 'jeu'), svg: at('<path d="M-7 -20h14q0 12-7 13-7-1-7-13z" fill="#ffc83d"/><path d="M-7 -18q-6 0-5 5t6 4M7 -18q6 0 5 5t-6 4" stroke="#ffc83d" stroke-width="2" fill="none"/><rect x="-1.5" y="-8" width="3" height="5" fill="#e0a800"/><rect x="-5" y="-3" width="10" height="4" rx="1" fill="#8d6e63"/>', 0, 2) },
    spatula: { tags: g('cuisine'), svg: at('<rect x="-1.4" y="-6" width="2.8" height="16" rx="1.4" fill="#8a5a33"/><rect x="-5" y="-20" width="10" height="14" rx="3" fill="#b0bec5"/><path d="M-2 -17v8M2 -17v8" stroke="#78909c" stroke-width="1.2"/>', 0, 0) },
    whisk: { tags: g('cuisine'), svg: at('<rect x="-1.6" y="-4" width="3.2" height="14" rx="1.6" fill="$accentAlt"/><path d="M0 -4q-8-10 0-18 8 8 0 18zM0 -4q-4-10 0-18 4 8 0 18z" fill="none" stroke="#9aa5b1" stroke-width="1.2"/>', 0, 0) },
    plate: { tags: g('cuisine'), svg: at('<ellipse cx="4" cy="-6" rx="13" ry="4.5" fill="#ffffff" stroke="#dcdcdc" stroke-width="1"/><path d="M-3 -8q7-8 14 0z" fill="$accent"/><circle cx="2" cy="-10" r="1.4" fill="$groundAlt"/><circle cx="7" cy="-11" r="1.4" fill="$accentAlt"/>', 0, 0) },
    rose: { tags: g('dating'), svg: at('<path d="M0 -6v16" stroke="#2e7d32" stroke-width="2"/><path d="M0 2q-6-1-6-6 5 0 6 6z" fill="#43a047"/><path d="M-5 -10q0-6 5-7 5 1 5 7-2 4-5 4t-5-4z" fill="$accentAlt"/><path d="M-2 -12q2-2 4 0" stroke="$ink" stroke-opacity="0.25" stroke-width="1" fill="none"/>', 0, 0) },
    glass: { tags: g('dating', 'divertissement'), svg: at('<path d="M-4 -18h8l-1 8q-3 3-6 0z" fill="$skyAlt" fill-opacity="0.7" stroke="$ink" stroke-opacity="0.4" stroke-width="0.8"/><path d="M-3.4 -14h6.8l-0.6 4q-2.8 2.4-5.6 0z" fill="$accentAlt" fill-opacity="0.75"/><path d="M0 -10v9M-3 -1h6" stroke="$ink" stroke-opacity="0.45" stroke-width="1.2"/>', 0, 2) },
    camera: { tags: g('documentaire', 'telerealite', 'aventure'), svg: at('<rect x="-8" y="-14" width="18" height="12" rx="3" fill="$ink"/><circle cx="2" cy="-8" r="4" fill="#9aa5b1"/><circle cx="2" cy="-8" r="2" fill="$skyAlt"/><rect x="-6" y="-17" width="6" height="3" rx="1" fill="$ink"/>', 0, 2) },
    phone: { tags: g('telerealite', 'magazine', 'jeunesse', 'humour'), svg: at('<rect x="-4" y="-16" width="9" height="16" rx="2" fill="$ink"/><rect x="-2.6" y="-14" width="6.2" height="11" rx="1" fill="$skyAlt"/>', 0, 2) },
    clapper: { tags: g('drame', 'cinema'), svg: at('<rect x="-8" y="-12" width="17" height="11" rx="1.5" fill="$ink"/><path d="M-8 -12l16-5 1.5 4-16 5z" fill="$light"/><path d="M-4 -13.5l2 3.6M1 -15l2 3.6M5.5 -16.4l2 3.6" stroke="$ink" stroke-width="1.6"/>', 0, 2) },
    script: { tags: g('drame', 'magazine'), svg: at('<rect x="-5" y="-17" width="13" height="17" rx="1.5" fill="$light" transform="rotate(-8)"/><path d="M-2 -13h7M-2 -10h7M-2 -7h5M-2 -4h7" stroke="$ink" stroke-opacity="0.3" stroke-width="1" transform="rotate(-8)"/>', 0, 2) },
    balloon: { tags: g('jeunesse', 'divertissement'), svg: at('<path d="M0 0q-3 -10 1 -18" stroke="$ink" stroke-opacity="0.5" stroke-width="0.8" fill="none"/><ellipse cx="1" cy="-26" rx="7" ry="8.5" fill="$accentAlt"/><path d="M-2 -30q1-3 4-3" stroke="$light" stroke-opacity="0.7" stroke-width="1.4" fill="none" stroke-linecap="round"/>', 0, 0) },
    lollipop: { tags: g('jeunesse'), svg: at('<rect x="-1" y="-6" width="2" height="14" fill="$light"/><circle cx="0" cy="-12" r="7" fill="$accent"/><path d="M0 -12m-4 0a4 4 0 1 1 4 4" stroke="$accentAlt" stroke-width="2" fill="none"/>', 0, 0) },
    mug: { tags: g('magazine', 'info', 'generique'), svg: at('<rect x="-5" y="-12" width="10" height="11" rx="2" fill="$accent"/><path d="M5 -9q4 0 4 3t-4 3" stroke="$accent" stroke-width="2" fill="none"/><path d="M-2 -15q1-2 0-4M2 -15q1-2 0-4" stroke="$ink" stroke-opacity="0.25" stroke-width="1" fill="none" stroke-linecap="round"/>', 0, 2) },
    statuette: { tags: g('cinema'), svg: at(statuette(0, 4, 0.44), 0, 0) },
    popcorn: { tags: g('cinema'), svg: at('<path d="M-6 -12h12l-2 14h-8z" fill="#ffffff"/><path d="M-6 -12h3l1 14h-2zM1 -12h3l-0.6 14h-2z" fill="#e53935"/><circle cx="-4" cy="-14" r="3" fill="#fff3c4"/><circle cx="0" cy="-15.5" r="3.2" fill="#fff3c4"/><circle cx="4" cy="-14" r="3" fill="#fff3c4"/>', 0, 2) },
    buzzer: { tags: g('jeu'), svg: at('<rect x="-7" y="-6" width="14" height="6" rx="2" fill="$ink"/><path d="M-5 -6q0-6 5-6t5 6z" fill="$accentAlt"/>', 0, 2) }
  }
};

// --- Accessoires posés au sol (boîte 50 × 50, base en bas) ---------------------------
export const accessory = {
  width: 50, height: 50, probability: 85,
  variants: {
    backpack: { tags: g('aventure'), svg: '<rect x="12" y="20" width="26" height="30" rx="7" fill="#8d6e63"/><rect x="16" y="32" width="18" height="12" rx="3" fill="#6d4c41"/><path d="M18 20q0-8 7-8t7 8" stroke="#6d4c41" stroke-width="3" fill="none"/><rect x="12" y="26" width="26" height="3" fill="$accent"/>' },
    rocks: { tags: g('aventure', 'documentaire'), svg: '<path d="M4 50q2-14 14-15 10 0 12 15z" fill="#9aa5b1"/><path d="M24 50q3-10 12-10t11 10z" fill="#b0bec5"/><path d="M10 36q4-8 10 0" stroke="$groundAlt" stroke-width="3" fill="none" stroke-linecap="round"/>' },
    cone: { tags: [...g('sport'), 'sub:football', 'sub:rugby', 'sub:handball', 'sub:fitness'], svg: '<path d="M25 18l9 28h-18z" fill="#ff7f11"/><path d="M21.5 30h7M19.8 37h10.4" stroke="#ffffff" stroke-width="3"/><rect x="12" y="45" width="26" height="5" rx="2" fill="#ff7f11"/>' },
    ballGround: { tags: g('sport'), svg: '<circle cx="25" cy="40" r="10" fill="#ffffff" stroke="$ink" stroke-width="1.2"/><path d="M25 35l3.5 2.5-1.3 4h-4.4l-1.3-4z" fill="$ink"/>' },
    ferACheval: { tags: [...g('sport'), 'sub:hippisme'], svg: '<path d="M15 47V31a10 10 0 0 1 20 0v16" stroke="#9aa5b1" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="15" cy="38" r="1.3" fill="$ink"/><circle cx="35" cy="38" r="1.3" fill="$ink"/><circle cx="17" cy="27" r="1.3" fill="$ink"/><circle cx="33" cy="27" r="1.3" fill="$ink"/>' },
    haie: { tags: [...g('sport'), 'sub:athletisme'], svg: '<rect x="8" y="22" width="34" height="8" rx="1.5" fill="$light"/><path d="M8 22h8v8h-8zM24 22h8v8h-8z" fill="#e53935"/><path d="M11 30v18M39 30v18" stroke="$ink" stroke-width="2.5"/><path d="M6 48h10M34 48h10" stroke="$ink" stroke-width="3" stroke-linecap="round"/>' },
    tyres: { tags: [...g('sport'), 'sub:auto'], svg: '<circle cx="16" cy="38" r="12" fill="#37474f"/><circle cx="16" cy="38" r="5" fill="#90a4ae"/><circle cx="36" cy="40" r="10" fill="#263238"/><circle cx="36" cy="40" r="4" fill="#90a4ae"/>' },
    basket: { tags: g('cuisine', 'dating'), svg: '<path d="M8 30h34l-4 20h-26z" fill="#c68642"/><path d="M8 30h34" stroke="#8d5524" stroke-width="3"/><path d="M14 30q11-20 22 0" stroke="#8d5524" stroke-width="2.5" fill="none"/><circle cx="18" cy="27" r="5" fill="$accentAlt"/><circle cx="28" cy="26" r="5" fill="$groundAlt"/><path d="M33 28l6-9" stroke="#43a047" stroke-width="3" stroke-linecap="round"/>' },
    veggies: { tags: g('cuisine'), svg: '<path d="M8 44q-2-14 8-14 9 0 8 14z" fill="#e53935"/><path d="M15 30q2-5 6-6" stroke="#43a047" stroke-width="2.5" fill="none"/><path d="M28 50l14-26q3 3 0 6l-12 21z" fill="#fb8c00"/><path d="M42 24l4-4M42 24l5 1" stroke="#43a047" stroke-width="2" stroke-linecap="round"/>' },
    suitcase: { tags: g('telerealite', 'policier', 'drame', 'aventure'), svg: '<rect x="10" y="22" width="30" height="28" rx="4" fill="$accentAlt"/><rect x="19" y="16" width="12" height="7" rx="2" fill="none" stroke="$ink" stroke-width="2"/><path d="M10 34h30" stroke="$ink" stroke-opacity="0.2" stroke-width="2"/>' },
    float: { tags: g('telerealite', 'dating'), svg: '<ellipse cx="25" cy="42" rx="20" ry="8" fill="$accentAlt"/><ellipse cx="25" cy="40" rx="9" ry="3.5" fill="$sky"/><path d="M8 40q4-6 8-6M34 34q5 0 8 5" stroke="$light" stroke-width="3" fill="none" stroke-linecap="round"/>' },
    speaker: { tags: g('talent', 'divertissement', 'humour', 'jeunesse'), svg: '<rect x="12" y="12" width="26" height="38" rx="4" fill="$ink"/><circle cx="25" cy="38" r="7" fill="#546e7a"/><circle cx="25" cy="38" r="3" fill="$ink"/><circle cx="25" cy="22" r="4" fill="#546e7a"/>' },
    plant: { tags: g('magazine', 'info', 'generique', 'drame', 'documentaire'), svg: '<path d="M25 34q-14-14-12-30 10 10 12 30z" fill="$groundAlt"/><path d="M25 34q14-12 10-28-10 10-10 28z" fill="$groundAlt" fill-opacity="0.8"/><path d="M25 34q-3-18 3-32 2 18-3 32z" fill="$groundAlt" fill-opacity="0.9"/><path d="M15 33h20l-3 17h-14z" fill="$accent"/>' },
    toys: { tags: g('jeunesse'), svg: '<rect x="6" y="34" width="16" height="16" rx="2" fill="$accent"/><rect x="24" y="34" width="16" height="16" rx="2" fill="$accentAlt"/><rect x="15" y="18" width="16" height="16" rx="2" fill="$skyAlt" stroke="$ink" stroke-opacity="0.2"/><circle cx="23" cy="26" r="3" fill="$ink" fill-opacity="0.3"/>' },
    clapperGround: { tags: g('drame', 'cinema'), svg: '<rect x="8" y="30" width="34" height="20" rx="2" fill="$ink"/><path d="M8 30l32-10 3 7-32 10z" fill="$light"/><path d="M15 27.5l4 7M24 24.8l4 7M33 22l4 7" stroke="$ink" stroke-width="3"/>' },
    hydrant: { tags: g('policier'), svg: '<rect x="18" y="22" width="14" height="24" rx="3" fill="#d62828"/><rect x="15" y="44" width="20" height="6" rx="2" fill="#9d0208"/><path d="M18 22q7-10 14 0z" fill="#d62828"/><rect x="11" y="30" width="7" height="6" rx="2" fill="#9d0208"/><rect x="32" y="30" width="7" height="6" rx="2" fill="#9d0208"/>' },
    buzzerStand: { tags: g('jeu'), svg: '<rect x="18" y="26" width="14" height="22" fill="$ink"/><rect x="12" y="46" width="26" height="4" rx="2" fill="$ink"/><rect x="10" y="20" width="30" height="8" rx="3" fill="$accent"/><path d="M15 20q0-10 10-10t10 10z" fill="$accentAlt"/><ellipse cx="22" cy="13" rx="4" ry="1.5" fill="$light" fill-opacity="0.6"/>' },
    moneyBag: { tags: g('jeu', 'divertissement'), svg: '<path d="M17 22q-12 10-10 20 2 8 18 8t18-8q2-10-10-20z" fill="#c9a46a"/><path d="M18 22l-4-10q5 3 11 0 6 3 11 0l-4 10z" fill="#b08850"/><rect x="17" y="20" width="16" height="4" rx="2" fill="#8a5a33"/><circle cx="25" cy="37" r="7" fill="#ffc83d"/><path d="M25 32v10M22 34.5h5a2 2 0 0 1 0 4h-4a2 2 0 0 0 0 4h5" stroke="#8a5a33" stroke-width="1.4" fill="none"/>' },
    books: { tags: g('documentaire', 'info', 'magazine'), svg: '<rect x="8" y="40" width="34" height="10" rx="2" fill="$accent"/><rect x="11" y="31" width="30" height="9" rx="2" fill="$accentAlt"/><rect x="9" y="23" width="28" height="8" rx="2" fill="$skyAlt" stroke="$ink" stroke-opacity="0.2"/>' },
    popcornSeau: { tags: g('cinema'), svg: '<path d="M13 24h24l-3 26h-18z" fill="#ffffff"/><path d="M13 24h5l2 26h-4zM23 24h4l-0.5 26h-3zM32 24h5l-3 26h-4z" fill="#e53935"/><circle cx="17" cy="21" r="5" fill="#fff3c4"/><circle cx="25" cy="18" r="6" fill="#fff3c4"/><circle cx="33" cy="21" r="5" fill="#fff3c4"/>' },
    bobine: { tags: g('cinema'), svg: '<path d="M30 46h18" stroke="$ink" stroke-width="5"/><circle cx="22" cy="34" r="15" fill="$ink"/><circle cx="22" cy="34" r="4" fill="#cfd8dc"/><circle cx="22" cy="25" r="3.5" fill="#546e7a"/><circle cx="22" cy="43" r="3.5" fill="#546e7a"/><circle cx="13" cy="34" r="3.5" fill="#546e7a"/><circle cx="31" cy="34" r="3.5" fill="#546e7a"/>' }
  }
};

// --- Éléments décoratifs (calque 320 × 180, partie haute) ----------------------------
let i = 0;
const birds = (x, y) => `<path d="M${x} ${y}q5-5 10 0q5-5 10 0" stroke="$ink" stroke-opacity="0.55" stroke-width="2" fill="none" stroke-linecap="round"/>`;
const note = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M4 -14v14" stroke="$light" stroke-width="2"/><path d="M4 -14q6 1 8 6" stroke="$light" stroke-width="2" fill="none"/><ellipse cx="1" cy="1" rx="4" ry="3" fill="$light"/></g>`;
const sparkle = (x, y, s = 1, fill = '$accent') => `<path d="M${x} ${y - 7 * s}q1 6 ${7 * s} ${7 * s}q-6 1 ${-7 * s} ${7 * s}q-1 -6 ${-7 * s} ${-7 * s}q6 -1 ${7 * s} ${-7 * s}z" fill="${fill}"/>`;
const leaf = (x, y, rot) => `<path d="M${x} ${y}q6-8 14-2q-6 8-14 2z" fill="$groundAlt" transform="rotate(${rot} ${x} ${y})"/>`;
const steam = (x, y) => `<path d="M${x} ${y}q-6-6 0-12q6-6 0-12M${x + 8} ${y}q-6-6 0-12q6-6 0-12" stroke="$light" stroke-opacity="0.7" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
const bokeh = (x, y, rad, fill) => `<circle cx="${x}" cy="${y}" r="${rad}" fill="${fill}" fill-opacity="0.28"/>`;

export const decor = {
  width: 320, height: 180, probability: 75,
  variants: {
    confetti: { tags: g('divertissement', 'jeu', 'talent', 'jeunesse', 'humour', 'telerealite'), svg: confettiField(1, [20, 300, 8, 70]) },
    confetti2: { tags: g('divertissement', 'jeu', 'talent', 'jeunesse'), svg: confettiField(4, [30, 290, 6, 60]) },
    sparkles: { tags: g('talent', 'divertissement', 'generique', 'jeunesse', 'magazine', 'dating', 'cinema'), svg: sparkle(42, 34) + sparkle(276, 28, 0.8, '$light') + sparkle(250, 62, 0.6) + sparkle(70, 70, 0.5, '$light') + star(160, 20, 0.8, '$light', 0.9) },
    hearts: { tags: g('dating'), svg: heart(48, 36, 1.1) + heart(270, 30, 0.9, '$accent') + heart(240, 64, 0.6) + heart(84, 70, 0.5, '$light') },
    birds: { tags: g('aventure', 'documentaire', 'drame', 'sport'), svg: birds(60, 34) + birds(84, 24) + birds(250, 40) },
    notes: { tags: g('talent', 'jeunesse', 'divertissement', 'humour'), svg: note(56, 44) + note(268, 36, 0.8) + note(240, 66, 0.6) + note(84, 72, 0.55) },
    leaves: { tags: g('aventure', 'documentaire', 'cuisine'), svg: leaf(40, 30, 20) + leaf(272, 24, -30) + leaf(250, 58, 60) + leaf(70, 66, -10) },
    steam: { tags: g('cuisine'), svg: steam(70, 60) + steam(244, 54) },
    bokeh: { tags: g('policier', 'drame', 'dating', 'info'), svg: bokeh(40, 30, 10, '$accent') + bokeh(280, 26, 14, '$accentAlt') + bokeh(250, 64, 7, '$light') + bokeh(70, 70, 6, '$light') },
    clouds: { tags: g('aventure', 'sport', 'documentaire', 'generique', 'magazine', 'telerealite', 'jeunesse'), svg: cloud(40, 40, 1, '$light', 0.85) + cloud(250, 30, 1.2, '$light', 0.85) },
    stars: { tags: g('policier', 'drame', 'talent', 'humour', 'info', 'dating', 'cinema'), svg: star(38, 26, 0.6) + star(80, 50, 0.4) + star(244, 20, 0.7) + star(282, 54, 0.45) + star(200, 34, 0.35) },
    flashs: { tags: g('cinema'), svg: [[46, 30, 1], [270, 24, 1.2], [236, 62, 0.7], [84, 66, 0.6]].map(([x, y, k]) => `<circle cx="${x}" cy="${y}" r="${r(9 * k)}" fill="$light" fill-opacity="0.3"/><path d="M${x} ${r(y - 8 * k)}l${r(2 * k)} ${r(6 * k)} ${r(6 * k)} ${r(2 * k)} ${r(-6 * k)} ${r(2 * k)} ${r(-2 * k)} ${r(6 * k)} ${r(-2 * k)} ${r(-6 * k)} ${r(-6 * k)} ${r(-2 * k)} ${r(6 * k)} ${r(-2 * k)}z" fill="$light"/>`).join('') }
  }
};
