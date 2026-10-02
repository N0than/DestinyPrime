// Système de personnages modulaires (repère local 60 × 110, pieds en bas à y = 110).
// Le personnage est assemblé par le composant « character » à partir de pièces
// interchangeables : jambes, buste, bras, coiffure (qui embarque la tête et le visage),
// couvre-chef et objet tenu en main. Le second personnage (« character2 ») est généré
// automatiquement par le build avec ses propres couleurs ($skin2, $hair2, …).

// Point de préhension de la main droite : tous les objets tenus y sont centrés.
export const HAND = { x: 52, y: 58 };

const sleeve = (d, w = 8) => `<path d="${d}" stroke="$top" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
const hand = (x, y, rad = 4) => `<circle cx="${x}" cy="${y}" r="${rad}" fill="$skin"/>`;

export const character = {
  width: 60, height: 110,
  variants: {
    base: { svg: '<c name="legs"/><c name="torso"/><c name="armLeft"/><c name="hair"/><c name="headwear"/><c name="armRight"/>' }
  }
};

export const legs = {
  width: 60, height: 110,
  variants: {
    pants: { svg: '<path d="M18 64h11.5l-0.5 40h-10.5z" fill="$bottom"/><path d="M30.5 64h11.5l-0.5 40h-10.5z" fill="$bottom"/><rect x="15" y="102" width="15" height="7" rx="3.5" fill="$ink"/><rect x="30" y="102" width="15" height="7" rx="3.5" fill="$ink"/>' },
    stride: { svg: '<path d="M18 64h11.5l-9 40h-10.5z" fill="$bottom"/><path d="M30.5 64h11.5l5 40h-10.5z" fill="$bottom"/><rect x="7" y="102" width="15" height="7" rx="3.5" fill="$ink"/><rect x="36" y="102" width="15" height="7" rx="3.5" fill="$ink"/>' },
    shorts: { svg: '<path d="M18 64h11.5v18h-11.5z" fill="$bottom"/><path d="M30.5 64h11.5v18h-11.5z" fill="$bottom"/><rect x="20" y="82" width="8" height="21" fill="$skin"/><rect x="32" y="82" width="8" height="21" fill="$skin"/><rect x="16" y="102" width="14" height="7" rx="3.5" fill="$ink"/><rect x="30" y="102" width="14" height="7" rx="3.5" fill="$ink"/>' },
    jeans: { svg: '<path d="M18 64h11.5l-1 40h-9.5z" fill="$bottom"/><path d="M30.5 64h11.5l-1 40h-9.5z" fill="$bottom"/><path d="M24 70v30M36 70v30" stroke="$light" stroke-opacity="0.18" stroke-width="1.2"/><rect x="15" y="102" width="15" height="7" rx="3.5" fill="$light"/><rect x="30" y="102" width="15" height="7" rx="3.5" fill="$light"/><path d="M15 107h15M30 107h15" stroke="$ink" stroke-opacity="0.3" stroke-width="1.5"/>' }
  }
};

export const torso = {
  width: 60, height: 110,
  variants: {
    tee: { svg: '<rect x="26.5" y="24" width="7" height="10" rx="2" fill="$skin"/><path d="M14 41q0-10 10-10h12q10 0 10 10v27h-32z" fill="$top"/><path d="M25.5 31l4.5 5 4.5-5z" fill="$skin"/><path d="M14 60h32v8h-32z" fill="$ink" fill-opacity="0.06"/>' },
    jacket: { svg: '<rect x="26.5" y="24" width="7" height="10" rx="2" fill="$skin"/><path d="M14 41q0-10 10-10h12q10 0 10 10v27h-32z" fill="$top"/><path d="M24.5 31h11l-5.5 22z" fill="$light"/><path d="M24.5 31l5.5 22-9-14zM35.5 31l-5.5 22 9-14z" fill="$ink" fill-opacity="0.18"/><circle cx="30" cy="58" r="1.4" fill="$ink" fill-opacity="0.4"/>' },
    hoodie: { svg: '<rect x="26.5" y="24" width="7" height="10" rx="2" fill="$skin"/><path d="M20 33q10-6 20 0l-2 6h-16z" fill="$top"/><path d="M14 42q0-11 10-11h12q10 0 10 11v26h-32z" fill="$top"/><path d="M22 33q8 6 16 0" stroke="$ink" stroke-opacity="0.2" stroke-width="2" fill="none"/><path d="M27 37v8M33 37v8" stroke="$light" stroke-width="1.4"/><rect x="21" y="54" width="18" height="9" rx="3" fill="$ink" fill-opacity="0.12"/>' },
    dress: { svg: '<rect x="26.5" y="24" width="7" height="10" rx="2" fill="$skin"/><path d="M16 41q0-10 9-10h10q9 0 9 10l6 43h-40z" fill="$top"/><path d="M25.5 31l4.5 4 4.5-4z" fill="$skin"/><rect x="16" y="55" width="28" height="4" fill="$ink" fill-opacity="0.15"/>' },
    stripes: { svg: '<rect x="26.5" y="24" width="7" height="10" rx="2" fill="$skin"/><path d="M14 41q0-10 10-10h12q10 0 10 10v27h-32z" fill="$top"/><path d="M14 44h32M14 51h32M14 58h32" stroke="$light" stroke-opacity="0.55" stroke-width="3"/><path d="M25.5 31l4.5 5 4.5-5z" fill="$skin"/>' }
  }
};

export const armLeft = {
  width: 60, height: 110,
  variants: {
    down: { svg: sleeve('M17 36q-6 6-7 16l-1 10') + hand(9, 64) },
    wave: { svg: sleeve('M17 36q-9-3-11-18') + hand(6, 14) + '<path d="M1 9q-2 3 0 6M-1 4q-3 5 0 11" stroke="$ink" stroke-opacity="0.35" stroke-width="1.2" fill="none" stroke-linecap="round"/>' },
    point: { svg: sleeve('M17 36q-8 4-16 3') + hand(-1, 39) + '<path d="M-4 39h-6" stroke="$skin" stroke-width="3" stroke-linecap="round"/>' },
    hip: { svg: sleeve('M17 36q-12 8-5 22') + hand(15, 59) },
    fist: { svg: sleeve('M17 36q-7-6-7-24') + hand(10, 10, 5) }
  }
};

export const armRight = {
  width: 60, height: 110,
  variants: {
    hold: { svg: sleeve('M43 36q8 6 8 17l1 4') + '<c name="handheld"/>' + hand(HAND.x, HAND.y) }
  }
};

const ears = '<circle cx="19.5" cy="19" r="3" fill="$skin"/><circle cx="40.5" cy="19" r="3" fill="$skin"/>';
const faceDisc = '<circle cx="30" cy="18" r="11" fill="$skin"/>';

export const head = {
  width: 60, height: 110,
  variants: { round: { svg: ears + faceDisc + '<c name="face"/>' } }
};

const blush = '<circle cx="23.5" cy="22" r="2.2" fill="$accentAlt" fill-opacity="0.3"/><circle cx="36.5" cy="22" r="2.2" fill="$accentAlt" fill-opacity="0.3"/>';
export const face = {
  width: 60, height: 110,
  variants: {
    smile: { svg: '<circle cx="26" cy="18" r="1.5" fill="$ink"/><circle cx="34" cy="18" r="1.5" fill="$ink"/><path d="M26.5 23q3.5 3 7 0" stroke="$ink" stroke-width="1.4" stroke-linecap="round" fill="none"/>' + blush },
    laugh: { svg: '<path d="M24.5 18.5q1.5-2 3 0M32.5 18.5q1.5-2 3 0" stroke="$ink" stroke-width="1.4" stroke-linecap="round" fill="none"/><path d="M26 22h8q-0.5 5-4 5t-4-5z" fill="$ink"/><path d="M27.5 25.5q2.5-1.5 5 0q-1 1.5-2.5 1.5t-2.5-1.5z" fill="$accentAlt"/>' + blush },
    glasses: { svg: '<circle cx="26" cy="18" r="3.4" fill="$light" fill-opacity="0.35" stroke="$ink" stroke-width="1.2"/><circle cx="34" cy="18" r="3.4" fill="$light" fill-opacity="0.35" stroke="$ink" stroke-width="1.2"/><path d="M29.4 18h1.2" stroke="$ink" stroke-width="1.2"/><circle cx="26" cy="18" r="1.2" fill="$ink"/><circle cx="34" cy="18" r="1.2" fill="$ink"/><path d="M27 23.5q3 2.5 6 0" stroke="$ink" stroke-width="1.4" stroke-linecap="round" fill="none"/>' },
    wow: { svg: '<circle cx="26" cy="17.5" r="1.6" fill="$ink"/><circle cx="34" cy="17.5" r="1.6" fill="$ink"/><path d="M24 14q2-1.5 4-0.5M32 13.5q2-1 4 0.5" stroke="$ink" stroke-width="1.1" stroke-linecap="round" fill="none"/><ellipse cx="30" cy="24" rx="2.2" ry="2.6" fill="$ink"/>' + blush },
    wink: { svg: '<path d="M24.5 18.5q1.5-1.6 3 0" stroke="$ink" stroke-width="1.4" stroke-linecap="round" fill="none"/><circle cx="34" cy="18" r="1.5" fill="$ink"/><path d="M26 22.5q4 4 8 0" stroke="$ink" stroke-width="1.4" stroke-linecap="round" fill="none"/>' + blush },
    beard: { svg: '<circle cx="26" cy="17" r="1.5" fill="$ink"/><circle cx="34" cy="17" r="1.5" fill="$ink"/><path d="M19.5 19q1 11 10.5 11t10.5-11q-3 4-10.5 4t-10.5-4z" fill="$hair"/><path d="M27 23.5q3 2 6 0" stroke="$ink" stroke-width="1.3" stroke-linecap="round" fill="none"/>' }
  }
};

// Chaque coiffure inclut la tête : la partie arrière est dessinée derrière le visage,
// la frange devant, ce qui garantit des superpositions cohérentes.
export const hair = {
  width: 60, height: 110,
  variants: {
    short: { svg: '<c name="head"/><path d="M18.5 19Q17 5 30 5T41.5 19Q39 11 30 11.5T18.5 19z" fill="$hair"/>' },
    quiff: { svg: '<c name="head"/><path d="M18.5 19Q17 6 28 4.5Q37 2 40 7Q43 11 41.5 19Q38 10 30 12Q22 13 18.5 19z" fill="$hair"/><path d="M27 4.5q8-5 13 2-6-2-13-2z" fill="$hair"/>' },
    bob: { svg: '<path d="M16.5 17a13.5 13.5 0 0 1 27 0v12q-3 2-5.5 0v-8h-16v8q-2.5 2-5.5 0z" fill="$hair"/><c name="head"/><path d="M19 18Q19 5.5 30 5.5T41 18Q36 11 28 12.5Q22 13.5 19 18z" fill="$hair"/>' },
    long: { svg: '<path d="M16 16a14 14 0 0 1 28 0v27q-14 6-28 0z" fill="$hair"/><c name="head"/><path d="M19 18Q18 5 30 5.5Q41 5.5 41 17Q33 9 25 13Q21 15 19 18z" fill="$hair"/>' },
    bun: { svg: '<circle cx="30" cy="3.5" r="5.5" fill="$hair"/><c name="head"/><path d="M18.5 19Q17 6 30 6T41.5 19Q39 12 30 12T18.5 19z" fill="$hair"/>' },
    curly: { svg: '<circle cx="30" cy="14" r="15.5" fill="$hair"/><circle cx="16" cy="18" r="5" fill="$hair"/><circle cx="44" cy="18" r="5" fill="$hair"/><c name="head"/><path d="M19.5 15q2-7 6-7 2-3 5-2 4-2 6 2 4 0 5 7-5-4-11-4t-11 4z" fill="$hair"/>' },
    ponytail: { svg: '<path d="M40 10q12 2 9 24-4-9-11-14z" fill="$hair"/><c name="head"/><path d="M18.5 19Q17 6 30 6T41.5 19Q39 12 30 12T18.5 19z" fill="$hair"/>' },
    bald: { svg: '<c name="head"/><path d="M19 15q1-3 3-4M41 15q-1-3-3-4" stroke="$hair" stroke-width="3" stroke-linecap="round"/>' }
  }
};
