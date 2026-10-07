/*
 * tv-programs — moteur d'illustrations de programmes TV (style DiceBear personnalisé).
 *
 * Ce fichier est autonome et s'exécute dans le navigateur (ou dans une VM Node pour les
 * tests). Il attend deux globales injectées par le build :
 *   - DiceBearCore            : le runtime @dicebear/core (Style, Avatar)
 *   - TV_PROGRAMS_LIBRARY     : la bibliothèque compacte de composants SVG
 *
 * API exposée sous `TvPrograms` :
 *   TvPrograms.definition()                       → StyleDefinition DiceBear du style `tv-programs`
 *   TvPrograms.svg({ seed, genre, subgenre, backgroundColor, palette, size })
 *   TvPrograms.dataUri(options)                   → data URI mise en cache
 *   TvPrograms.classify(program)                  → { genre, subgenre }
 *   TvPrograms.forProgram(program, options)       → data URI de l'illustration du programme
 *   TvPrograms.pitch(program, exclude)            → pitch éditorial déterministe (hors `exclude`)
 *   TvPrograms.GENRES / TvPrograms.SUBGENRES / TvPrograms.PALETTES
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Hachage déterministe (FNV-1a 32 bits) : palettes, pitchs, choix stables.
  // ---------------------------------------------------------------------------
  function hash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }
  const pick = (list, seed, salt) => list[hash(`${seed}|${salt}`) % list.length];

  // ---------------------------------------------------------------------------
  // Genres éditoriaux et ambiances chromatiques autorisées.
  // ---------------------------------------------------------------------------
  const GENRES = {
    aventure:      { label: "Jeu d'aventure",     palettes: ['jour', 'tropical', 'aube', 'menthe'] },
    jeu:           { label: 'Jeu de plateau',     palettes: ['studio', 'neon', 'cobalt'] },
    divertissement:{ label: 'Divertissement',     palettes: ['studio', 'neon', 'corail', 'cobalt'] },
    telerealite:   { label: 'Télé-réalité',       palettes: ['tropical', 'corail', 'jour', 'aube'] },
    dating:        { label: 'Dating',             palettes: ['aube', 'corail', 'pastel', 'nuit'] },
    cuisine:       { label: 'Cuisine',            palettes: ['menthe', 'corail', 'jour', 'pastel'] },
    talent:        { label: 'Talent show',        palettes: ['neon', 'studio', 'nuit'] },
    policier:      { label: 'Fiction policière',  palettes: ['nuit', 'cobalt', 'aube'] },
    drame:         { label: 'Fiction dramatique', palettes: ['aube', 'nuit', 'pastel', 'cobalt'] },
    sport:         { label: 'Sport',              palettes: ['jour', 'cobalt', 'menthe', 'nuit'] },
    documentaire:  { label: 'Documentaire',       palettes: ['jour', 'aube', 'menthe', 'tropical'] },
    magazine:      { label: 'Magazine',           palettes: ['pastel', 'menthe', 'corail', 'jour'] },
    info:          { label: 'Information',        palettes: ['cobalt', 'jour', 'nuit'] },
    humour:        { label: 'Humour',             palettes: ['neon', 'corail', 'studio'] },
    jeunesse:      { label: 'Jeunesse',           palettes: ['pastel', 'jour', 'corail', 'menthe'] },
    cinema:        { label: 'Cinéma',             palettes: ['nuit', 'studio', 'neon', 'aube'] },
    generique:     { label: 'Programme',          palettes: ['jour', 'pastel', 'cobalt', 'corail'] }
  };

  // Sous-genres reconnus : ils affinent décor, objets et accessoires. Un sous-genre
  // inconnu est ignoré (le genre seul s'applique) pour ne jamais vider un calque.
  const SUBGENRES = {
    aventure: ['survie', 'montagne'],
    sport: ['football', 'rugby', 'basket', 'handball', 'tennis', 'auto', 'velo', 'surf', 'combat', 'ski', 'fitness', 'athletisme', 'hippisme'],
    documentaire: ['nature', 'histoire', 'science', 'culture'],
    cinema: ['ceremonie', 'festival', 'film', 'serie']
  };

  // Palettes de scène : chaque couleur alimente une couleur nommée du style.
  const PALETTES = {
    jour:     { sky: '#cfeefa', skyAlt: '#eef9fd', ground: '#9bd48a', groundAlt: '#74bb6c', accent: '#ffb547', accentAlt: '#ff7a59', ink: '#263238', light: '#ffffff' },
    aube:     { sky: '#ffd2b8', skyAlt: '#ffeadb', ground: '#e9b48a', groundAlt: '#d39468', accent: '#ff8a65', accentAlt: '#7e57c2', ink: '#3e2a3c', light: '#fff8f2' },
    nuit:     { sky: '#2f3b6e', skyAlt: '#45528f', ground: '#3a4766', groundAlt: '#28324d', accent: '#ffd166', accentAlt: '#ef476f', ink: '#151b2e', light: '#f3f5ff' },
    studio:   { sky: '#3b2d8f', skyAlt: '#5a48c4', ground: '#271d63', groundAlt: '#1c1549', accent: '#ff4fa3', accentAlt: '#3ec5f2', ink: '#140f33', light: '#fdf6ff' },
    neon:     { sky: '#1f1446', skyAlt: '#3a2276', ground: '#2a1b5c', groundAlt: '#170f38', accent: '#ffd400', accentAlt: '#ff3d7f', ink: '#0d0820', light: '#fff9e8' },
    pastel:   { sky: '#fde4ef', skyAlt: '#fff4f8', ground: '#cdeadf', groundAlt: '#a9d8c6', accent: '#ff8fb1', accentAlt: '#7cc6fe', ink: '#3a3352', light: '#ffffff' },
    menthe:   { sky: '#d6f3ec', skyAlt: '#effbf8', ground: '#a5dcc4', groundAlt: '#7cc5a8', accent: '#ff9f68', accentAlt: '#2bb3a3', ink: '#1f3b3a', light: '#ffffff' },
    corail:   { sky: '#ffe0d6', skyAlt: '#fff2ec', ground: '#f6c2a8', groundAlt: '#ee9f80', accent: '#ff6b6b', accentAlt: '#4d96ff', ink: '#3b2626', light: '#ffffff' },
    cobalt:   { sky: '#d9e6ff', skyAlt: '#f0f5ff', ground: '#b4c8ee', groundAlt: '#8fa9dc', accent: '#3d6bff', accentAlt: '#ffb020', ink: '#1b2440', light: '#ffffff' },
    tropical: { sky: '#bdeef0', skyAlt: '#e6fafa', ground: '#f3dca2', groundAlt: '#e3c27a', accent: '#ff7b54', accentAlt: '#00a6a6', ink: '#203a43', light: '#ffffff' }
  };

  // ---------------------------------------------------------------------------
  // Conversion de la bibliothèque compacte (chaînes SVG) en StyleDefinition DiceBear.
  //   - un attribut valant "$nom" devient une référence de couleur { type: 'color', name }
  //   - <c name="x" transform="…"/> devient un élément { type: 'component', name: 'x' }
  // ---------------------------------------------------------------------------
  function parseSvg(src) {
    const rootEl = { children: [] };
    const stack = [rootEl];
    const re = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g;
    let m;
    while ((m = re.exec(src))) {
      const [, closing, name, attrStr, selfClosing] = m;
      if (closing) { if (stack.length > 1) stack.pop(); continue; }
      const attributes = {};
      attrStr.replace(/([\w:-]+)="([^"]*)"/g, (_, k, v) => {
        attributes[k] = v[0] === '$' ? { type: 'color', name: v.slice(1) } : v;
        return '';
      });
      let el;
      if (name === 'c') {
        const ref = attributes.name;
        delete attributes.name;
        el = { type: 'component', name: ref };
        if (Object.keys(attributes).length) el.attributes = attributes;
        stack[stack.length - 1].children.push(el);
        continue;
      }
      el = { type: 'element', name };
      if (Object.keys(attributes).length) el.attributes = attributes;
      stack[stack.length - 1].children.push(el);
      if (!selfClosing) { el.children = []; stack.push(el); }
    }
    const clean = list => list.map(el => {
      if (el.children) {
        if (el.children.length) el.children = clean(el.children); else delete el.children;
      }
      return el;
    });
    return clean(rootEl.children);
  }

  let cachedDefinition = null;
  function definition() {
    if (cachedDefinition) return cachedDefinition;
    const lib = root.TV_PROGRAMS_LIBRARY;
    const components = {};
    for (const [name, comp] of Object.entries(lib.components)) {
      const variants = {};
      for (const [vName, v] of Object.entries(comp.variants)) {
        const variant = { elements: parseSvg(v.svg) };
        if (v.tags && v.tags.length) variant.tags = v.tags;
        if (v.weight) variant.weight = v.weight;
        variants[vName] = variant;
      }
      const c = { width: comp.width, height: comp.height, variants };
      if (comp.probability !== undefined) c.probability = comp.probability;
      components[name] = c;
    }
    cachedDefinition = {
      $comment: 'tv-programs — style DiceBear personnalisé pour Audience Masters.',
      meta: lib.meta,
      canvas: { width: lib.canvas.width, height: lib.canvas.height, elements: parseSvg(lib.canvas.svg) },
      components,
      colors: lib.colors
    };
    return cachedDefinition;
  }

  let cachedStyle = null;
  function style() {
    if (!cachedStyle) cachedStyle = new root.DiceBearCore.Style(definition());
    return cachedStyle;
  }

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------
  const tagSafe = v => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

  function resolvePalette(seed, genre, palette) {
    if (palette && typeof palette === 'object') return palette;
    if (palette && PALETTES[palette]) return PALETTES[palette];
    const allowed = (GENRES[genre] || GENRES.generique).palettes;
    return PALETTES[pick(allowed, seed, 'palette')];
  }

  function svg(options = {}) {
    const seed = String(options.seed ?? 'tv-programs');
    const genre = GENRES[options.genre] ? options.genre : 'generique';
    const subgenre = (SUBGENRES[genre] || []).includes(tagSafe(options.subgenre)) ? tagSafe(options.subgenre) : '';
    const pal = resolvePalette(seed, genre, options.palette);
    const opts = { seed: `${genre}:${seed}`, tags: [`genre:${genre}`] };
    if (subgenre) opts.tags.push(`sub:${subgenre}`);
    for (const [k, v] of Object.entries(pal)) opts[`${k}Color`] = [v.replace('#', '')];
    if (options.backgroundColor) opts.backgroundColor = [String(options.backgroundColor).replace('#', '')];
    let out = new root.DiceBearCore.Avatar(style(), opts).toString();
    // DiceBear produit un SVG carré lorsque `size` est fourni : on conserve le 16:9.
    if (options.size) {
      const w = Math.round(options.size);
      const h = Math.round(w * root.TV_PROGRAMS_LIBRARY.canvas.height / root.TV_PROGRAMS_LIBRARY.canvas.width);
      out = out.replace('<svg ', `<svg width="${w}" height="${h}" `);
    }
    return out;
  }

  const FALLBACK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#e8eefc"/>'
    + '<rect x="104" y="40" width="112" height="76" rx="12" fill="#3d6bff"/><rect x="114" y="50" width="92" height="56" rx="6" fill="#cfe0ff"/>'
    + '<rect x="150" y="116" width="20" height="14" fill="#3d6bff"/><rect x="128" y="130" width="64" height="8" rx="4" fill="#1b2440"/></svg>';

  const cache = new Map();
  const toDataUri = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);

  function dataUri(options = {}) {
    const key = JSON.stringify([options.seed, options.genre, options.subgenre, options.palette, options.backgroundColor, options.size]);
    if (cache.has(key)) return cache.get(key);
    let uri;
    try {
      uri = toDataUri(svg(options));
    } catch (err) {
      try { uri = toDataUri(svg({ ...options, genre: 'generique', subgenre: '' })); }
      catch (err2) { uri = toDataUri(FALLBACK_SVG); }
    }
    cache.set(key, uri);
    return uri;
  }

  // ---------------------------------------------------------------------------
  // Association programme → famille graphique
  // ---------------------------------------------------------------------------
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // Règles ordonnées : la première correspondance sur le titre/pitch l'emporte.
  const RULES = [
    [/science-fiction|acteurs/, 'drame'],
    [/conso/, 'magazine'],
    [/koh|aventur|expedition|survie|ile deserte|jungle|destination express|pekin|fort boyard/, 'aventure', 'survie'],
    [/montagne|alpin|sommet/, 'aventure', 'montagne'],
    [/dating|amour|amours|seduction|celibataire|mariage|rencontre/, 'dating'],
    [/cuisin|culinaire|recette|chef|patiss|gastronom|top chef/, 'cuisine'],
    [/talent|chanteur|chanson|voix|the voice|nouvelle star|casting|danse avec|masque/, 'talent'],
    [/realite|loft|villa|secret story|telerealite|docu-realite/, 'telerealite'],
    [/humour|humoriste|comedien|stand.?up|sketch|rire|satiri|late.night|mokshu|patamu/, 'humour'],
    [/polici|procedural|enquete|crime|detective|commissaire|faits divers|thriller|experts|investigation/, 'policier'],
    [/quiz|motus|lettres et les chiffres|\bjeux?\b|buzzer|questions|panini/, 'jeu'],
    [/journal|info|actualite|breaking|news|politique|edition|revue de presse|debrief|decryptage|grand entretien|interview eco|economie|meteo|direct terrain|reportage|international en continu|face a l.info|merci pour l.info|ca se dispute|debat/, 'info'],
    [/football|foot|telefoot|mercato/, 'sport', 'football'],
    [/rugby/, 'sport', 'rugby'],
    [/basket/, 'sport', 'basket'],
    [/handball/, 'sport', 'handball'],
    [/tennis|davis/, 'sport', 'tennis'],
    [/hippi|turf|tierce|quinte|course de chevaux|galop|trot/, 'sport', 'hippisme'],
    [/f1|grand prix|mecanique|automobile|caisses a savon/, 'sport', 'auto'],
    [/cyclisme|velo|tour de france/, 'sport', 'velo'],
    [/surf/, 'sport', 'surf'],
    [/combat|boxe|mma|judo/, 'sport', 'combat'],
    [/biathlon|ski/, 'sport', 'ski'],
    [/fitness|sport sante/, 'sport', 'fitness'],
    [/athletisme|olympi|marathon|decathlon/, 'sport', 'athletisme'],
    [/sport|athlet|multisports|match|champion|e-sport|esport|gaming/, 'sport'],
    [/nature|animaux|environnement|sauvage|ocean|mer/, 'documentaire', 'nature'],
    [/histoire|historique|patrimoine|archeolog|archives|civilisation|biopic|portrait/, 'documentaire', 'histoire'],
    [/science|espace|sciences/, 'documentaire', 'science'],
    [/documentaire|geopolitique|voyage|decouverte|beaux-arts|architecture|captation|opera|theatre|concert|festival|jazz|musique|ballet|spectacle|masterclass/, 'documentaire', 'culture'],
    [/animation|anime|manga|prescolaire|comptine|eveil|ludo|kids|jeunesse|famili|super-heros|franchise|enfant/, 'jeunesse'],
    [/film|serie|fiction|feuilleton|sitcom|saga|cinema|telefilm|comedie|drame|court|blockbuster|premium|mini-serie|culte|independant/, 'drame'],
    [/magazine|lifestyle|people|conso|maison|decoration|sante|bien-etre|parentalite|emploi|temoignage|talk|plateau|c a moi|experts|after|libre antenne|chronique|teleshopping/, 'magazine'],
    [/show|divertissement|gala|spectacle|soiree|ceremonie/, 'divertissement']
  ];

  const FORMAT_FALLBACK = { magazine: 'magazine', jeu: 'jeu', divertissement: 'divertissement', fiction: 'drame', documentaire: 'documentaire', animation: 'jeunesse', sport: 'sport' };

  // Règles propres à certaines antennes : sur une chaîne sport, tout reste du sport ;
  // sur une chaîne jeunesse, l'univers enfant prime sauf jeu, sport ou nature explicites.
  const SPORT_RULES = RULES.filter(([, genre]) => genre === 'sport');
  const JEUNESSE_RULES = [
    [/quiz|\bjeux?\b/, 'jeu'],
    [/sport|gaming|e-sport|esport/, 'sport'],
    [/satiri/, 'humour'],
    [/nature|animaux/, 'documentaire', 'nature']
  ];

  function classify(program = {}) {
    if (program.genre && GENRES[program.genre]) return { genre: program.genre, subgenre: tagSafe(program.subgenre) };
    const text = norm(`${program.title || program.name || ''} ${program.pitch || ''}`);
    const match = rules => {
      for (const [re, genre, subgenre] of rules) if (re.test(text)) return { genre, subgenre: subgenre || '' };
      return null;
    };
    if (program.channelType === 'sport') return match(SPORT_RULES) || { genre: 'sport', subgenre: '' };
    if (program.channelType === 'jeunesse') return match(JEUNESSE_RULES) || { genre: 'jeunesse', subgenre: '' };
    const found = match(RULES);
    if (found) {
      // Une « enquête » sur une chaîne d'info ou de culture relève du journalisme, pas du polar.
      if (found.genre === 'policier' && program.channelType === 'info') return { genre: 'info', subgenre: '' };
      if (found.genre === 'policier' && program.channelType === 'culture') return { genre: 'documentaire', subgenre: 'culture' };
      return found;
    }
    const byFormat = FORMAT_FALLBACK[program.format];
    if (byFormat) return { genre: byFormat, subgenre: '' };
    const byChannel = { sport: 'sport', info: 'info', jeunesse: 'jeunesse', culture: 'documentaire', cinema: 'drame' }[program.channelType];
    return { genre: byChannel || 'generique', subgenre: '' };
  }

  function forProgram(program, options = {}) {
    const { genre, subgenre } = classify(program);
    return dataUri({ seed: program.id || program.title || program.name, genre, subgenre, ...options });
  }

  // ---------------------------------------------------------------------------
  // Pitchs éditoriaux (présentation uniquement, aucun effet sur le jeu)
  // ---------------------------------------------------------------------------
  const PITCHS = {
    aventure: ['Des candidats affrontent la nature sauvage et doivent survivre, épreuve après épreuve.', 'Une expédition hors norme où chaque étape se gagne à la force du mental.', 'Boussole en main, les équipes partent à la conquête de territoires inconnus.', 'Cartes, cordes et coups de théâtre : une aventure grandeur nature.', 'Loin de tout confort, chaque équipe se dépasse pour atteindre l’arrivée.'],
    jeu: ['Des candidats s’affrontent au buzzer pour décrocher la cagnotte.', 'Un jeu de connaissances rythmé, où chaque bonne réponse rapproche de la finale.', 'Questions, pièges et rebondissements : le plateau s’enflamme chaque jour.', 'Un jeu de réflexion familial où l’on joue aussi depuis son canapé.', 'Culture, logique et sang-froid : un seul candidat repartira gagnant.'],
    divertissement: ['Un grand show familial, ses invités surprises et ses moments de fête.', 'Une soirée spectacle rythmée par des défis, des stars et de la musique.', 'Le rendez-vous qui réunit toute la famille devant un spectacle grandiose.', 'Des surprises, des invités et des défis pour une soirée de fête.', 'Un show rythmé qui mise sur la bonne humeur et l’émotion.'],
    telerealite: ['Des candidats cohabitent sous l’œil des caméras, alliances et rivalités comprises.', 'Une aventure humaine en immersion, au cœur d’une villa pas comme les autres.', 'Le quotidien sans filtre d’un groupe que tout oppose.', 'Amitiés, rivalités et confessions : la vie de groupe sans filtre.', 'Un huis clos ensoleillé où chaque semaine rebat les cartes.'],
    dating: ['Des célibataires se rencontrent pour trouver, peut-être, l’amour.', 'Des rendez-vous en tête-à-tête qui pourraient tout changer.', 'Coups de cœur, hésitations et premières confidences au soleil couchant.', 'Des tête-à-tête sincères pour croire encore au coup de foudre.', 'Rencontres, rendez-vous et confidences sous le soleil.'],
    cuisine: ['Des cuisiniers passionnés relèvent des défis culinaires sous l’œil des chefs.', 'Recettes, astuces et créativité : les fourneaux s’affolent.', 'Un concours gourmand où chaque assiette peut faire basculer la compétition.', 'Un concours gourmand où chaque assiette se joue au millimètre.', 'Des produits frais, des astuces de chef et beaucoup de gourmandise.'],
    talent: ['Des artistes inconnus montent sur scène pour convaincre le jury.', 'Voix, danse, performances : un concours qui révèle les talents de demain.', 'Sous les projecteurs, chaque candidat joue sa place pour la finale.', 'Une scène, un jury, une chance : les talents de demain se révèlent.', 'Des performances bluffantes et un public qui vote pour son favori.'],
    policier: ['Une équipe d’enquêteurs remonte les indices d’une affaire hors norme.', 'Une enquête sous tension dans les rues de la ville, de nuit comme de jour.', 'Chaque indice compte pour démasquer le coupable avant qu’il ne frappe encore.', 'Des enquêteurs aguerris face aux affaires les plus troublantes.', 'Suspense, interrogatoires et fausses pistes jusqu’au dernier indice.'],
    drame: ['Des destins croisés, des secrets de famille et des choix impossibles.', 'Une fiction intense portée par des personnages attachants.', 'Une histoire forte, entre émotion, suspense et rebondissements.', 'Une saga familiale pleine d’émotions et de rebondissements.', 'Des personnages forts face à des choix qui changeront leur vie.'],
    sport: ['Les plus grands rendez-vous sportifs en direct, au plus près des athlètes.', 'Analyses, émotions et exploits : le meilleur du sport sur votre antenne.', 'Des compétitions spectaculaires racontées par des passionnés.', 'Le direct, les coulisses et les analyses des plus grands événements.', 'Des exploits, des records et toute l’émotion du terrain.'],
    documentaire: ['Un voyage documentaire au cœur de mondes méconnus.', 'Une enquête documentaire qui éclaire notre époque sous un nouveau jour.', 'Images rares et récits forts pour comprendre le monde.', 'Des récits forts et des images rares pour mieux comprendre le monde.', 'Une exploration passionnante, entre savoir et émerveillement.'],
    magazine: ['Un magazine convivial qui décrypte la vie quotidienne avec ses invités.', 'Chroniques, reportages et conseils pratiques autour d’un canapé.', 'Le rendez-vous qui accompagne le quotidien des téléspectateurs.', 'Reportages, invités et conseils utiles pour le quotidien.', 'Un rendez-vous chaleureux qui parle de la vie de tous les jours.'],
    info: ['L’actualité décryptée en direct par une rédaction mobilisée.', 'Les faits, les analyses et les invités qui font l’actualité.', 'Une édition d’information complète, du local à l’international.', 'Une rédaction en éveil pour suivre l’actualité minute par minute.', 'Des invités, des experts et des reportages pour décrypter les faits.'],
    humour: ['Des humoristes enchaînent sketchs et improvisations devant un public conquis.', 'Un rendez-vous d’humour décalé qui croque l’actualité.', 'Rires garantis avec la nouvelle génération du stand-up.', 'Des sketchs, de l’impro et une bonne dose d’autodérision.', 'Les humoristes du moment croquent l’actualité avec malice.'],
    jeunesse: ['Des aventures colorées pour éveiller la curiosité des plus jeunes.', 'Un univers joyeux où chaque épisode est une nouvelle découverte.', 'Héros attachants et histoires pleines d’humour pour toute la famille.', 'Des héros attachants pour apprendre en s’amusant.', 'Des histoires drôles et tendres pour toute la famille.'],
    generique: ['Un programme fédérateur pensé pour votre public cible.', 'Une proposition originale pour renouveler votre grille.', 'Un format éprouvé qui a déjà conquis d’autres antennes.', 'Un programme pensé pour fidéliser votre public cible.', 'Une nouveauté qui peut donner un nouveau souffle au créneau.']
  };

  // `exclude` : pitchs déjà affichés à côté (ex. deux cartes d'un même genre) ; on
  // prend alors le suivant dans la liste, ce qui reste déterministe.
  function pitch(program = {}, exclude = []) {
    if (program.pitch) return program.pitch;
    const list = PITCHS[classify(program).genre] || PITCHS.generique;
    const start = hash(`${program.id || program.name || ''}|pitch`) % list.length;
    for (let i = 0; i < list.length; i++) {
      const candidate = list[(start + i) % list.length];
      if (!exclude.includes(candidate)) return candidate;
    }
    return list[start];
  }

  root.TvPrograms = { definition, svg, dataUri, classify, forProgram, pitch, parseSvg, GENRES, SUBGENRES, PALETTES, FALLBACK_SVG, _cache: cache };
})(typeof globalThis !== 'undefined' ? globalThis : this);
