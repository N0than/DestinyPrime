// Compositions : placement cohérent des calques au premier plan (calque 320 × 180).
//   - personnage   : boîte 60 × 110, pieds à y = 110 → posé sur le sol par translate(x - 30, 52)
//   - objet central: boîte 120 × 100, base à y = 100 → posé par translate(x - 60, 60)
//   - accessoire   : boîte 50 × 50, base à y = 50   → posé par translate(x - 25, 112)
// Le second personnage est retourné horizontalement pour faire face à la scène.
import { shadow } from './helpers.mjs';

const FEET = 162;
const person = (x, name = 'character', flip = false, s = 1) => shadow(x, FEET, 20 * s, 4)
  + (flip
    ? `<c name="${name}" transform="translate(${x + 30 * s} ${FEET - 110 * s}) scale(${-s} ${s})"/>`
    : `<c name="${name}" transform="translate(${x - 30 * s} ${FEET - 110 * s})${s !== 1 ? ` scale(${s})` : ''}"/>`);
const prop = (x, s = 1) => `<c name="prop" transform="translate(${x - 60 * s} ${FEET - 2 - 100 * s})${s !== 1 ? ` scale(${s})` : ''}"/>`;
const accessory = (x, s = 1) => `<c name="accessory" transform="translate(${x - 25 * s} ${FEET + 2 - 50 * s})${s !== 1 ? ` scale(${s})` : ''}"/>`;

export const composition = {
  width: 320, height: 180,
  variants: {
    // Deux personnages de part et d'autre de l'objet central.
    duo: { weight: 3, svg: prop(160) + person(74) + person(246, 'character2', true) },
    // Un animateur à gauche présente l'objet central.
    hostLeft: { weight: 2, svg: prop(196) + accessory(290, 0.9) + person(86) },
    // Variante miroir : l'animateur arrive par la droite.
    hostRight: { weight: 2, svg: accessory(32, 0.9) + prop(126) + person(240, 'character2', true) },
    // Personnage au centre, objet central en retrait.
    center: { weight: 2, svg: prop(76, 0.82) + accessory(260) + person(170) },
    // Deux personnages côte à côte, l'objet central sur le côté.
    trio: { weight: 1, svg: prop(244, 0.9) + accessory(30, 0.8) + person(92) + person(150, 'character2', true, 0.94) }
  }
};
