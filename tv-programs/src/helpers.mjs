// Primitives graphiques partagées (flat design, formes arrondies).
// Les couleurs « $nom » sont des références aux couleurs nommées du style DiceBear :
//   scène  : $sky $skyAlt $ground $groundAlt $accent $accentAlt $ink $light
//   perso  : $skin $hair $top $bottom (et leurs variantes « 2 » pour le second personnage)

export const r = n => Math.round(n * 10) / 10;

// Formes répétées regroupées dans un seul <path> (bibliothèque plus légère).
export const rectD = (x, y, w, h) => `M${r(x)} ${r(y)}h${w}v${h}h${-w}z`;
export const circleD = (cx, cy, rad) => `M${r(cx - rad)} ${r(cy)}a${rad} ${rad} 0 1 0 ${2 * rad} 0a${rad} ${rad} 0 1 0 ${-2 * rad} 0z`;

export const shadow = (cx, cy, rx, ry = 4) =>
  `<ellipse cx="${r(cx)}" cy="${r(cy)}" rx="${r(rx)}" ry="${r(ry)}" fill="$ink" fill-opacity="0.12"/>`;

export const blob = (cx, cy, w, h, fill = '$skyAlt', opacity = 1) => {
  const x = cx - w / 2, y = cy - h / 2;
  return `<path d="M${r(x + w * 0.15)} ${r(y + h * 0.35)}C${r(x + w * 0.2)} ${r(y - h * 0.05)} ${r(x + w * 0.7)} ${r(y - h * 0.08)} ${r(x + w * 0.88)} ${r(y + h * 0.22)}C${r(x + w * 1.08)} ${r(y + h * 0.55)} ${r(x + w * 0.9)} ${r(y + h * 1.02)} ${r(x + w * 0.52)} ${r(y + h * 0.98)}C${r(x + w * 0.12)} ${r(y + h * 0.95)} ${r(x - w * 0.06)} ${r(y + h * 0.72)} ${r(x + w * 0.15)} ${r(y + h * 0.35)}Z" fill="${fill}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ''}/>`;
};

export const cloud = (x, y, s = 1, fill = '$light', opacity = 0.9) =>
  `<path d="M${r(x)} ${r(y)}h${r(34 * s)}a${r(8 * s)} ${r(8 * s)} 0 0 0 -4 -15a${r(10 * s)} ${r(10 * s)} 0 0 0 -18 -4a${r(8 * s)} ${r(8 * s)} 0 0 0 -12 19z" fill="${fill}" fill-opacity="${opacity}"/>`;

export const sun = (x, y, rad, fill = '$accent') =>
  `<circle cx="${x}" cy="${y}" r="${rad + 6}" fill="${fill}" fill-opacity="0.25"/><circle cx="${x}" cy="${y}" r="${rad}" fill="${fill}"/>`;

export const moon = (x, y, rad, fill = '$light') =>
  `<circle cx="${x}" cy="${y}" r="${rad}" fill="${fill}"/><circle cx="${r(x + rad * 0.45)}" cy="${r(y - rad * 0.3)}" r="${r(rad * 0.85)}" fill="$sky"/>`;

export const star = (x, y, s = 1, fill = '$light', opacity = 1) =>
  `<path d="M${x} ${r(y - 5 * s)}l${r(1.4 * s)} ${r(3.6 * s)} ${r(3.6 * s)} ${r(1.4 * s)} ${r(-3.6 * s)} ${r(1.4 * s)} ${r(-1.4 * s)} ${r(3.6 * s)} ${r(-1.4 * s)} ${r(-3.6 * s)} ${r(-3.6 * s)} ${r(-1.4 * s)} ${r(3.6 * s)} ${r(-1.4 * s)}z" fill="${fill}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ''}/>`;

export const heart = (x, y, s = 1, fill = '$accentAlt', opacity = 1) =>
  `<path d="M${x} ${r(y + 6 * s)}c${r(-8 * s)} ${r(-5 * s)} ${r(-11 * s)} ${r(-9 * s)} ${r(-8 * s)} ${r(-13 * s)}c${r(3 * s)} ${r(-3 * s)} ${r(7 * s)} ${r(-2 * s)} ${r(8 * s)} ${r(1 * s)}c${r(1 * s)} ${r(-3 * s)} ${r(5 * s)} ${r(-4 * s)} ${r(8 * s)} ${r(-1 * s)}c${r(3 * s)} ${r(4 * s)} 0 ${r(8 * s)} ${r(-8 * s)} ${r(13 * s)}z" fill="${fill}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ''}/>`;

// Végétation
export const palm = (x, base, h = 70, trunk = '#a8743f', leaf = '$groundAlt') => {
  const top = base - h;
  return `<path d="M${x - 3} ${base}q2 ${r(-h * 0.5)} ${r(5 + h * 0.08)} ${r(-h)}h4q-5 ${r(h * 0.5)} -2 ${h}z" fill="${trunk}"/>`
    + `<path d="M${r(x + h * 0.08 + 4)} ${top}q-22 -6 -34 10q16 -8 34 -6z" fill="${leaf}"/>`
    + `<path d="M${r(x + h * 0.08 + 4)} ${top}q22 -8 34 8q-16 -6 -34 -4z" fill="${leaf}"/>`
    + `<path d="M${r(x + h * 0.08 + 4)} ${top}q-12 -16 -30 -14q18 2 30 18z" fill="${leaf}" fill-opacity="0.85"/>`
    + `<path d="M${r(x + h * 0.08 + 4)} ${top}q14 -16 30 -12q-18 0 -30 16z" fill="${leaf}" fill-opacity="0.85"/>`;
};

export const roundTree = (x, base, s = 1, leaf = '$groundAlt', trunk = '#9c6b3f') =>
  `<rect x="${r(x - 2.5 * s)}" y="${r(base - 20 * s)}" width="${r(5 * s)}" height="${r(20 * s)}" rx="2" fill="${trunk}"/>`
  + `<circle cx="${x}" cy="${r(base - 30 * s)}" r="${r(16 * s)}" fill="${leaf}"/>`
  + `<circle cx="${r(x - 7 * s)}" cy="${r(base - 34 * s)}" r="${r(7 * s)}" fill="$light" fill-opacity="0.18"/>`;

export const pine = (x, base, s = 1, leaf = '$groundAlt') =>
  `<rect x="${r(x - 2 * s)}" y="${r(base - 8 * s)}" width="${r(4 * s)}" height="${r(8 * s)}" fill="#8a5a33"/>`
  + `<path d="M${x} ${r(base - 46 * s)}l${r(15 * s)} ${r(38 * s)}h${r(-30 * s)}z" fill="${leaf}"/>`
  + `<path d="M${x} ${r(base - 46 * s)}l${r(-15 * s)} ${r(38 * s)}h${r(15 * s)}z" fill="$ink" fill-opacity="0.08"/>`;

export const bush = (x, base, s = 1, fill = '$groundAlt') =>
  `<path d="M${r(x - 16 * s)} ${base}a${r(9 * s)} ${r(9 * s)} 0 0 1 ${r(6 * s)} ${r(-14 * s)}a${r(10 * s)} ${r(10 * s)} 0 0 1 ${r(19 * s)} ${r(-2 * s)}a${r(8 * s)} ${r(8 * s)} 0 0 1 ${r(7 * s)} ${r(16 * s)}z" fill="${fill}"/>`;

export const plantPot = (x, base, s = 1, pot = '$accent', leaf = '$groundAlt') =>
  `<path d="M${x} ${r(base - 14 * s)}q${r(-14 * s)} ${r(-14 * s)} ${r(-12 * s)} ${r(-30 * s)}q${r(10 * s)} ${r(10 * s)} ${r(12 * s)} ${r(30 * s)}z" fill="${leaf}"/>`
  + `<path d="M${x} ${r(base - 14 * s)}q${r(14 * s)} ${r(-12 * s)} ${r(10 * s)} ${r(-28 * s)}q${r(-10 * s)} ${r(10 * s)} ${r(-10 * s)} ${r(28 * s)}z" fill="${leaf}" fill-opacity="0.8"/>`
  + `<path d="M${x} ${r(base - 14 * s)}q${r(-2 * s)} ${r(-18 * s)} ${r(3 * s)} ${r(-34 * s)}q${r(2 * s)} ${r(18 * s)} ${r(-3 * s)} ${r(34 * s)}z" fill="${leaf}" fill-opacity="0.9"/>`
  + `<path d="M${r(x - 9 * s)} ${r(base - 15 * s)}h${r(18 * s)}l${r(-3 * s)} ${r(15 * s)}h${r(-12 * s)}z" fill="${pot}"/>`;

export const mountain = (x, base, w, h, fill = '$groundAlt', snow = false) =>
  `<path d="M${r(x - w / 2)} ${base}L${x} ${r(base - h)}L${r(x + w / 2)} ${base}z" fill="${fill}"/>`
  + `<path d="M${x} ${r(base - h)}L${r(x + w / 2)} ${base}h${r(-w * 0.22)}z" fill="$ink" fill-opacity="0.1"/>`
  + (snow ? `<path d="M${x} ${r(base - h)}l${r(w * 0.12)} ${r(h * 0.24)}l${r(-w * 0.05)} ${r(-h * 0.05)}l${r(-w * 0.07)} ${r(h * 0.08)}l${r(-w * 0.06)} ${r(-h * 0.08)}l${r(-w * 0.06)} ${r(h * 0.05)}z" fill="$light"/>` : '');

// Ville
export const building = (x, w, h, base = 150, fill = '$skyAlt', win = '$light', winOpacity = 0.7) => {
  const cols = Math.max(1, Math.floor((w - 6) / 9));
  const rows = Math.max(1, Math.floor((h - 10) / 12));
  let d = '';
  for (let c = 0; c < cols; c++) {
    for (let rr = 0; rr < rows; rr++) {
      if ((c * 7 + rr * 3 + x) % 5 === 0) continue;
      d += rectD(x + 5 + c * 9, base - h + 7 + rr * 12, 5, 6);
    }
  }
  return `<rect x="${x}" y="${base - h}" width="${w}" height="${h}" fill="${fill}"/><path d="${d}" fill="${win}" fill-opacity="${winOpacity}"/>`;
};

// Scène / plateau
export const spotlightBeam = (x, topY, spread, bottomY = 160, fill = '$light', opacity = 0.14) =>
  `<path d="M${x - 4} ${topY}h8L${x + spread} ${bottomY}H${x - spread}z" fill="${fill}" fill-opacity="${opacity}"/>`;

export const spot = (x, y, flip = false) =>
  `<g transform="translate(${x} ${y})${flip ? ' scale(-1 1)' : ''}"><rect x="-6" y="-4" width="12" height="10" rx="3" fill="$ink"/><circle cx="0" cy="7" r="4" fill="$accent"/></g>`;

export const curtains = (fill = '$accentAlt') =>
  `<path d="M0 0h70q-8 40 -2 80q4 40 -6 80H0z" fill="${fill}"/>`
  + `<path d="M20 0q-6 60 4 160M42 0q-6 60 2 160" stroke="$ink" stroke-opacity="0.15" stroke-width="3" fill="none"/>`
  + `<path d="M320 0h-70q8 40 2 80q-4 40 6 80h62z" fill="${fill}"/>`
  + `<path d="M300 0q6 60 -4 160M278 0q6 60 -2 160" stroke="$ink" stroke-opacity="0.15" stroke-width="3" fill="none"/>`
  + `<path d="M0 0h320v18q-40 10 -80 0q-40 10 -80 0q-40 10 -80 0q-40 10 -80 0z" fill="${fill}"/>`
  + `<path d="M0 18q40 10 80 0q40 10 80 0q40 10 80 0q40 10 80 0" stroke="$ink" stroke-opacity="0.18" stroke-width="2" fill="none"/>`;

export const floor = (y = 150, fill = '$ground', edge = '$groundAlt') =>
  `<rect x="0" y="${y}" width="320" height="${180 - y}" fill="${fill}"/><rect x="0" y="${y}" width="320" height="4" fill="${edge}"/>`;

export const stage = (y = 146, fill = '$groundAlt') =>
  `<path d="M0 ${y}h320v34H0z" fill="${fill}"/><path d="M0 ${y}h320v6H0z" fill="$light" fill-opacity="0.18"/>`
  + `<path d="M40 ${y + 14}h240" stroke="$light" stroke-opacity="0.12" stroke-width="2"/>`;

export const windowFrame = (x, y, w, h, sky = '$skyAlt') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="$light"/>`
  + `<rect x="${x + 4}" y="${y + 4}" width="${w - 8}" height="${h - 8}" rx="2" fill="${sky}"/>`
  + `<rect x="${r(x + w / 2 - 1.5)}" y="${y + 4}" width="3" height="${h - 8}" fill="$light"/>`
  + `<rect x="${x + 4}" y="${r(y + h / 2 - 1.5)}" width="${w - 8}" height="3" fill="$light"/>`;

export const tiles = (y0, y1, size = 14, fill = '$light', opacity = 0.35) => {
  let d = '';
  for (let y = y0; y < y1; y += size) {
    for (let x = ((y / size) % 2) * (size / 2); x < 320; x += size) d += rectD(x + 1, y + 1, size - 2, size - 2);
  }
  return `<path d="${d}" fill="${fill}" fill-opacity="${opacity}"/>`;
};

export const bulbs = (x0, x1, y, step = 14, fill = '$accent') => {
  let small = '', halo = '';
  for (let x = x0; x <= x1; x += step) { small += circleD(x, y, 2.6); halo += circleD(x, y, 5); }
  return `<path d="${halo}" fill="${fill}" fill-opacity="0.25"/><path d="${small}" fill="${fill}"/>`;
};

export const confettiField = (seedShift = 0, area = [20, 300, 10, 90], colors = ['$accent', '$accentAlt', '$light', '$skyAlt']) => {
  let out = '';
  for (let i = 0; i < 18; i++) {
    const x = area[0] + ((i * 53 + seedShift * 31) % (area[1] - area[0]));
    const y = area[2] + ((i * 37 + seedShift * 17) % (area[3] - area[2]));
    const rot = (i * 47) % 180;
    const c = colors[i % colors.length];
    out += i % 3 === 0
      ? `<circle cx="${x}" cy="${y}" r="2" fill="${c}"/>`
      : `<rect x="${x}" y="${y}" width="6" height="3" rx="1" fill="${c}" transform="rotate(${rot} ${x + 3} ${y + 1.5})"/>`;
  }
  return out;
};
