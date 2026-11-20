# Générer les illustrations hors de l'application : guide complet

Ce guide explique comment produire, en dehors d'Audience Masters, deux types de visuels :
- des visuels **identiques** à ceux du jeu : même graine, même image, octet pour octet ;
- des visuels **similaires** : nouveaux tirages, nouvelles variantes, dessin manuel ou IA dans le même style.

---

## 1. Les quatre façons de générer

| Méthode | Résultat | Prérequis |
|---|---|---|
| A. CLI `generate.mjs` | SVG/PNG identiques au jeu | Node 18+ (aucune dépendance npm) ; Playwright pour le PNG |
| B. Navigateur | SVG / data URI identiques | `dist/tv-programs.bundle.js` dans une page |
| C. `@dicebear/core` + JSON | SVG identiques | `npm i @dicebear/core@10.7.0` + `dist/tv-programs.json` |
| D. Charte graphique (§ 9) | Visuels « dans le style » | Illustrator, Figma, Inkscape ou un générateur d'images IA |

### A. Ligne de commande (recommandée)

```bash
cd tv-programs
node generate.mjs --list                                        # genres, sous-genres, palettes
node generate.mjs --genre cuisine --seed p123 --out cuisine.svg
node generate.mjs --genre sport --subgenre football --palette nuit --size 1280 --out match.svg
node generate.mjs --title "Top Chef" --channel generaliste --out topchef.svg   # classement automatique
node generate.mjs --program p009 --out motus.svg                # programme du catalogue (exact)
node generate.mjs --program all --out-dir programmes            # les 498 programmes du catalogue
node generate.mjs --career --out-dir carriere                   # les 8 cartes familles du Mode Carrière
node generate.mjs --genre talent --variations 12 --out-dir planche   # 12 tirages différents
node generate.mjs --genre jeu --seed demo --png --size 1920     # SVG + PNG 1920×1080
```

| Option | Rôle | Défaut |
|---|---|---|
| `--genre <g>` | Famille graphique (18 valeurs, § 4) | obligatoire sauf avec `--title`, `--program` ou `--career` |
| `--subgenre <s>` | Sous-genre ; filtre les décors et les objets (§ 4) | aucun |
| `--seed <texte>` | Graine : même graine + mêmes options = même image | `--title`, sinon `tv-programs` |
| `--palette <nom>` | Force l'une des 10 palettes (§ 5) | tirée parmi celles du genre (§ 3.2) |
| `--background <hex>` | Fond plein derrière la scène, sans `#` | aucun |
| `--size <px>` | Largeur ; la hauteur vaut largeur × 9/16 | SVG sans dimensions ; PNG en 1280 |
| `--title`, `--pitch`, `--format`, `--channel` | Entrées du classement automatique (§ 7) | aucun |
| `--program <id>[,<id>…]` ou `all` | Programmes du catalogue de `index.html` ; rendu exact | aucun |
| `--variations <n>` | Génère n graines : `<seed>-1` à `<seed>-n` | aucun |
| `--career` | Les 8 familles du Mode Carrière (`career:<id>`) | aucun |
| `--out <fichier>`, `--out-dir <dossier>` | Destination | `<genre>.svg`, `<genre>/` |
| `--png` | Ajoute un PNG à côté de chaque SVG (Chromium via Playwright) | aucun |

**Fidélité vérifiée** : les 498 programmes du catalogue générés par la CLI sont identiques octet pour octet aux SVG produits dans le jeu. Les méthodes B et C donnent aussi le même résultat.

**Autres conversions PNG** :
- librsvg : `rsvg-convert -w 1920 image.svg -o image.png` ;
- Inkscape : `inkscape image.svg -w 1920 -o image.png` ;
- sharp : `sharp('image.svg', { density: 576 }).png()`.

Chromium donne le rendu le plus proche du jeu (opacités, arrondis).

### B. Dans un navigateur

```html
<script src="dist/tv-programs.bundle.js"></script>
<script>
  const svg = TvPrograms.svg({ seed: 'p123', genre: 'cuisine' });            // chaîne SVG
  const uri = TvPrograms.dataUri({ seed: 'p123', genre: 'cuisine' });        // data:image/svg+xml (mis en cache)
  const art = TvPrograms.forProgram({ id: 'p009', name: 'Motus', format: 'jeu', channelType: 'generaliste' });
  document.querySelector('img').src = uri;
</script>
```

### C. `@dicebear/core` et la définition JSON

```js
import { Avatar, Style } from '@dicebear/core';           // version 10.7.0 exactement
import definition from './dist/tv-programs.json' with { type: 'json' };
const svg = new Avatar(new Style(definition), {
  seed: 'cuisine:p123',                                    // « <genre>:<graine> »
  tags: ['genre:cuisine'],                                 // + 'sub:<sous-genre>' le cas échéant
  // Palette « jour », celle que le § 3.2 tire pour la graine p123 en cuisine :
  skyColor: ['cfeefa'], skyAltColor: ['eef9fd'], groundColor: ['9bd48a'], groundAltColor: ['74bb6c'],
  accentColor: ['ffb547'], accentAltColor: ['ff7a59'], inkColor: ['263238'], lightColor: ['ffffff']
}).toString();                                             // identique à TvPrograms.svg({ seed: 'p123', genre: 'cuisine' })
```

Sans les options `*Color`, DiceBear utilise la palette « jour » intégrée à la définition.

---

## 2. Anatomie d'une image

**Toile** : 320 × 180 (16:9), `viewBox="0 0 320 180"`. L'image est vectorielle : on peut l'agrandir sans perte. Trois calques sont empilés dans cet ordre :

```
canvas 320×180
├─ scene        (320×180)  décor de fond : ciel, sol, éléments du lieu        [toujours]
├─ composition  (320×180)  placement du premier plan                          [toujours]
│   ├─ prop        (120×100) objet central (caméra, pupitre, fourneau…)
│   ├─ accessory   (50×50)   petit objet au sol                               [85 %]
│   ├─ character   (60×110)  personnage 1
│   └─ character2  (60×110)  personnage 2, retourné horizontalement
└─ decor        (320×180)  surcouche : confettis, cœurs, flashs…             [75 %]
```

### 2.1 Compositions (sol à y = 162)

Positions exactes (x = centre de l'élément) :

| Variante | Poids | Objet central | Accessoire | Personnages |
|---|---|---|---|---|
| `duo` | 3 (30 %) | x 160 | aucun | P1 x 74 ; P2 x 246 (retourné) |
| `hostLeft` | 2 (20 %) | x 196 | x 290, ×0,9 | P1 x 86 |
| `hostRight` | 2 (20 %) | x 126 | x 32, ×0,9 | P2 x 240 (retourné) |
| `center` | 2 (20 %) | x 76, ×0,82 | x 260 | P1 x 170 |
| `trio` | 1 (10 %) | x 244, ×0,9 | x 30, ×0,8 | P1 x 92 ; P2 x 150 (retourné, ×0,94) |

Transformations SVG, pour une échelle `s` :
- personnage : `translate(x − 30s, 162 − 110s) scale(s)` ;
- personnage retourné : `translate(x + 30s, 162 − 110s) scale(−s, s)` ;
- objet central : `translate(x − 60s, 160 − 100s) scale(s)` ;
- accessoire : `translate(x − 25s, 164 − 50s) scale(s)`.

Chaque personnage a une ombre portée : ellipse centrée en (x, 162), rx = 20s, ry = 4, couleur `ink`, opacité 0,12.

### 2.2 Personnage (boîte 60 × 110, pieds à y = 110)

```
character : fem | masc  (50/50)
  fem  = legs + torsoF + armLeft + hairF(→ headF → faceF) + headwear + armRight(→ handheld)
  masc = legs + torsoM + armLeft + hairM(→ headM → faceM) + headwear + armRight(→ handheld)
```

| Composant | Variantes | Probabilité d'apparition |
|---|---|---|
| legs | pants, stride, shorts, jeans | 100 % |
| torsoF | tee, jacket, hoodie, dress, stripes | 100 % |
| torsoM | tee, jacket, hoodie, stripes (jamais de robe) | 100 % |
| armLeft | down, wave, point, hip, fist | 100 % |
| armRight | hold (tient l'objet `handheld`) | 100 % |
| headF / headM | round : visage en disque (r = 11, centre (30, 18)), oreilles r = 3 | 100 % |
| faceF | smile, laugh, glasses, wow, wink (+ cils) | 100 % |
| faceM | smile, laugh, glasses, wow, wink, beard, mustache | 100 % |
| hairF | bob, long, bun, ponytail, curly | 100 % |
| hairM | short, quiff, curly, bald | 100 % |
| headwear | explorer, beanie, cap, helmet, toque, flower, party, fedora, headset, crown | 45 % (selon le genre) |
| handheld | 31 objets (micro, trophée, spatule…) | 85 % (P1), 60 % (P2) |

Chaque coiffure inclut la tête : l'arrière des cheveux est dessiné derrière le visage, la frange devant.

Le personnage 2 reprend les mêmes composants, suffixés `2`, avec ses propres couleurs (`skin2`, `hair2`, `top2`, `bottom2`). Il est donc tiré indépendamment du premier.

---

## 3. L'algorithme de tirage, pas à pas

### 3.1 Entrées

```
svg({ seed, genre, subgenre, palette?, backgroundColor?, size? })
  genre    ← 'generique' si inconnu
  subgenre ← '' s'il n'appartient pas à SUBGENRES[genre]
  graine DiceBear = `${genre}:${seed}`
  tags = ['genre:<genre>'] (+ 'sub:<subgenre>')
  options DiceBear = <rôle>Color: [hex sans #] pour les 8 couleurs de la palette
```

### 3.2 Choix de la palette (runtime tv-programs)

```js
function hash(str) {                       // FNV-1a 32 bits, sur les unités UTF-16
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
palette = options.palette                                           // nom ou objet, s'il est fourni
       ?? PALETTES[ allowed[ hash(`${seed}|palette`) % allowed.length ] ]   // allowed = GENRES[genre].palettes
```

Attention : ce hachage porte sur la graine **brute** (`p123`), pas sur `cuisine:p123`. Exemple : pour la graine `p123` en cuisine, `allowed` vaut [menthe, corail, jour, pastel] et le tirage donne `jour`.

### 3.3 Générateur pseudo-aléatoire (DiceBear 10.7.0)

Chaque décision a sa propre clé, donc son propre nombre aléatoire. Les décisions sont indépendantes de leur ordre :

```js
function value(seed, key) {                      // nombre dans [0, 1)
  let state = hash(seed + ':' + key);            // même FNV-1a que ci-dessus
  let z = (state + 0x6d2b79f5) | 0;              // Mulberry32, un pas
  let t = Math.imul(z ^ (z >>> 15), z | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
```

| Décision | Clé | Règle |
|---|---|---|
| Composant présent ? | `<nom>Probability` | `value × 100 < probabilité` (ex. `decorProbability`, seuil 75) |
| Variante | `<nom>Variant` | Tirage pondéré, voir ci-dessous |
| Couleur | `<nom>Color` | Mélange Fisher-Yates, puis premier candidat, voir ci-dessous |

**Tirage pondéré** :
1. Filtrer les variantes par tags.
2. Trier les clés restantes par code Unicode.
3. Calculer le seuil : `value × somme des poids`.
4. Prendre la première variante dont le cumul des poids dépasse le seuil.

**Filtre par tags** : une variante est retenue si, pour chaque catégorie demandée (`genre`, `sub`), l'une de ces conditions est vraie :
- elle ne porte aucun tag de cette catégorie (elle est universelle pour cette catégorie) ;
- elle porte l'une des valeurs demandées.

Exemple avec `genre:sport` + `sub:football` :
- la scène `stade` (`genre:sport`, `sub:football`) passe ;
- `parquet` (`sub:basket`) est exclue ;
- un accessoire `genre:sport` sans tag `sub` passe.

**Couleurs** :
1. Les candidats sont la liste de la définition, ou l'option `<nom>Color`.
2. On retire ceux qui sont égaux aux couleurs nommées dans `notEqualTo`.
3. On mélange (Fisher-Yates, Mulberry32 amorcé par `hash(seed + ':<nom>Color')`) et on prend le premier.

### 3.4 Ordre de résolution

```
scene        → Variant (filtré genre/sub)
composition  → Variant (duo/hostLeft/…)
  prop       → Variant (filtré)          accessory → Probability 85 → Variant
  character  → Variant fem|masc → legs, torsoF|M, armLeft, hairF|M → headF|M → faceF|M,
               headwear (Probability 45), armRight → handheld (Probability 85)
  character2 → idem avec les clés suffixées « 2 » (handheld2 : Probability 60)
decor        → Probability 75 → Variant (filtré)
couleurs     → $sky, $skyAlt, $ground, … $skin, $hair, $top, $bottom (+ versions « 2 »)
```

---

## 4. Genres, sous-genres et contenus

| Genre | Palettes autorisées | Sous-genres |
|---|---|---|
| aventure | jour, tropical, aube, menthe | survie, montagne |
| jeu | studio, neon, cobalt | aucun |
| divertissement | studio, neon, corail, cobalt | aucun |
| telerealite | tropical, corail, jour, aube | aucun |
| dating | aube, corail, pastel, nuit | aucun |
| cuisine | menthe, corail, jour, pastel | aucun |
| talent | neon, studio, nuit | aucun |
| policier | nuit, cobalt, aube | aucun |
| drame | aube, nuit, pastel, cobalt | aucun |
| sport | jour, cobalt, menthe, nuit | football, rugby, basket, handball, tennis, auto, velo, surf, combat, ski, fitness, athletisme, hippisme |
| documentaire | jour, aube, menthe, tropical | nature, histoire, science, culture |
| magazine | pastel, menthe, corail, jour | aucun |
| info | cobalt, jour, nuit | aucun |
| humour | neon, corail, studio | aucun |
| jeunesse | pastel, jour, corail, menthe | aucun |
| cinema | nuit, studio, neon, aube | ceremonie, festival, film, serie |
| evenement | jour, nuit, cobalt, pastel | debat, espace, vatican, election, royal, enquete, commission, eurovision, esport, concertweb, noel, animation, vienne, toureiffel, theatre, opera, quatorze, goncourt, eclipse, victoires, miss |
| generique | jour, pastel, cobalt, corail | aucun |

`node generate.mjs --list` affiche la liste à jour, lue directement dans le moteur.

### 4.1 Décors (`scene`, 80 variantes)

| Genre | Scènes |
|---|---|
| aventure | jungle, plage, montagne, temple, canyon, ile, savane, foret. `montagne` : montagne ; `survie` : toutes sauf montagne. |
| telerealite | plage, villa, loft, ile, coucher |
| documentaire | montagne, canyon, savane, ocean, musee, espace, bibliotheque, foret, carteMonde. `nature` : montagne, canyon, savane, ocean, foret ; `histoire` et `culture` : musee, bibliotheque, carteMonde ; `science` : espace, bibliotheque. |
| jeu | plateauQuiz, plateauEcrans, plateauRoue |
| info | plateauEcrans, fenetreVille, bibliotheque, plateauJT, carteMonde |
| divertissement | plateauRoue, rideau, escalier, gala, studioTV |
| humour | rideau, gala, standup, plateauMag, bonbons |
| talent | rideau, escalier, gala, concert |
| dating | villa, ile, terrasse, chandelles, coucher |
| magazine | loft, salon, bibliotheque, plateauMag, studioTV |
| drame | chandelles, ruelle, salon, fenetreVille, pluie |
| cuisine | cuisine, marche, studioCuisine |
| policier | ruelle, bureauEnquete, sceneCrime, fenetreVille |
| generique | salon, plateauMag, studioTV, salonTV |
| cinema | ceremonie, tapisRouge (festival), salleCinema (film), plateauTournage (serie) |
| sport | stade (football), rugby, parquet (basket, handball), tennis, circuit (auto), col (velo), surf, ring (combat), piste (ski), pisteAthle (athletisme), hippodrome (hippisme), salleSport (fitness), arene |
| jeunesse | espace, foret, parcArcEnCiel, chambre, bonbons |
| evenement | Un décor par sous-genre : debat, espaceMars, vatican, soireeElectorale, palaisRoyal, enquete, commission, eurovisionJunior, esportArena, concertWeb, spectacleNoel, animationGeant, concertVienne, toureiffel, comedieFrancaise, operaBallet, quatorzeJuillet, goncourt, eclipse, victoiresClassique, missFrance |

### 4.2 Objets centraux (`prop`, 68 variantes)

| Genre | Objets |
|---|---|
| aventure | coffre, campfire, tente, totem, trepied |
| jeu | coffre, pupitre, cagnotte, des, jury, ecranGeant |
| talent | pupitre, discoball, podiumShow, micStand, jury, piano |
| divertissement | cagnotte, cadeau, discoball, podiumShow, micStand, gateau |
| jeunesse | des, cadeau, telescope, tortue, globeProp, cubes, toboggan |
| humour | discoball, tabouret, micStand, fauteuils, televiseur |
| generique | podiumShow, canape, lampadaire, trepied, tableBasse, ecranGeant, televiseur |
| drame | piano, banc, bureau, canape, bistro, lampadaire |
| telerealite | transat, confession, canape, trepied |
| dating | transat, tableRomantique, banc, bistro |
| magazine | banc, bureau, canape, fauteuils, tableBasse, lutrin, plateauCuisine, coinDeco, presentoir, televiseur |
| cuisine | fourneau, gateau, billot |
| policier | voiturePolice, bureau, preuve |
| info | bureau, trepied, globeProp, fauteuils, deskJT, lutrin, ecranGeant |
| sport | buts (football, handball), panier, podiumSport, formule, velo, planche, sacFrappe, halteres, raquettes, rugbyTee, skis |
| documentaire | trepied, telescope, amphore, tortue, globeProp |
| evenement | trepied, telescope, lutrin, fusee, urne, tableCommission, deskGaming, microPied, sapin, peluche, pianoQueue, fauteuilVelours |
| cinema | cameraCine, pupitreStatuette, cordons, projecteurFilm, chaiseRealisateur |

### 4.3 Accessoires au sol (`accessory`, 27 variantes, 85 %)

| Genre | Accessoires |
|---|---|
| aventure | backpack, rocks, suitcase |
| documentaire | rocks, plant, books |
| sport | cone, ballGround, ferACheval, haie, tyres |
| cuisine | basket, veggies |
| dating | basket, float |
| telerealite | suitcase, float |
| policier | suitcase, hydrant |
| drame | suitcase, plant, clapperGround |
| talent, humour | speaker |
| divertissement | speaker, moneyBag |
| jeunesse | speaker, toys |
| magazine, info | plant, books |
| generique | plant |
| evenement | plant, pileDossiers, cadeaux, manette, batonsLumineux, diademe, coussinCouronne |
| cinema | clapperGround, popcornSeau, bobine |
| jeu | buzzerStand, moneyBag |

### 4.4 Objets tenus (`handheld`, 31) et couvre-chefs (`headwear`, 10)

| Genre | Objets tenus | Couvre-chefs |
|---|---|---|
| talent | mic, trophy | headset, crown |
| divertissement | mic, trophy, glass, balloon | party, crown |
| humour | mic, phone | party |
| info | mic, cue, notebook, mug | headset |
| magazine | mic, cue, phone, script, mug | headset |
| generique | mic, mug | headset |
| jeu | mic, cue, trophy, buzzer | headset |
| telerealite | mic, camera, phone | cap, flower |
| cinema | mic, clapper, statuette, popcorn | aucun |
| evenement | mic, notebook | headset |
| policier | magnifier, notebook | fedora |
| documentaire | magnifier, notebook, map, camera | explorer |
| aventure | compass, torch, map, camera | explorer, beanie |
| sport | football, basketball, rugby, handball, racket, flag, gloves, flambeau, trophy | beanie, cap, helmet |
| cuisine | spatula, whisk, plate | toque |
| dating | rose, glass | flower |
| jeunesse | phone, balloon, lollipop | cap, party |
| drame | clapper, script | aucun |

### 4.5 Surcouches (`decor`, 12 variantes, 75 %)

| Genre | Surcouches |
|---|---|
| divertissement | confetti, confetti2, sparkles, notes |
| jeu | confetti, confetti2 |
| talent | confetti, confetti2, sparkles, notes, stars |
| jeunesse | confetti, confetti2, sparkles, notes, clouds |
| humour | confetti, notes, stars |
| telerealite | confetti, clouds |
| generique, magazine | sparkles, clouds |
| dating | sparkles, hearts, bokeh, stars |
| cinema | sparkles, stars, flashs |
| aventure, documentaire | birds, leaves, clouds |
| drame | birds, bokeh, stars |
| sport | birds, clouds |
| cuisine | leaves, steam |
| policier, info | bokeh, stars |
| evenement | bokeh, stars, flashs |

---

## 5. Couleurs

### 5.1 Les 10 palettes de scène

| Palette | sky | skyAlt | ground | groundAlt | accent | accentAlt | ink | light |
|---|---|---|---|---|---|---|---|---|
| jour | #cfeefa | #eef9fd | #9bd48a | #74bb6c | #ffb547 | #ff7a59 | #263238 | #ffffff |
| aube | #ffd2b8 | #ffeadb | #e9b48a | #d39468 | #ff8a65 | #7e57c2 | #3e2a3c | #fff8f2 |
| nuit | #2f3b6e | #45528f | #3a4766 | #28324d | #ffd166 | #ef476f | #151b2e | #f3f5ff |
| studio | #3b2d8f | #5a48c4 | #271d63 | #1c1549 | #ff4fa3 | #3ec5f2 | #140f33 | #fdf6ff |
| neon | #1f1446 | #3a2276 | #2a1b5c | #170f38 | #ffd400 | #ff3d7f | #0d0820 | #fff9e8 |
| pastel | #fde4ef | #fff4f8 | #cdeadf | #a9d8c6 | #ff8fb1 | #7cc6fe | #3a3352 | #ffffff |
| menthe | #d6f3ec | #effbf8 | #a5dcc4 | #7cc5a8 | #ff9f68 | #2bb3a3 | #1f3b3a | #ffffff |
| corail | #ffe0d6 | #fff2ec | #f6c2a8 | #ee9f80 | #ff6b6b | #4d96ff | #3b2626 | #ffffff |
| cobalt | #d9e6ff | #f0f5ff | #b4c8ee | #8fa9dc | #3d6bff | #ffb020 | #1b2440 | #ffffff |
| tropical | #bdeef0 | #e6fafa | #f3dca2 | #e3c27a | #ff7b54 | #00a6a6 | #203a43 | #ffffff |

Rôle de chaque couleur :
- `sky` / `skyAlt` : fond et halos ;
- `ground` / `groundAlt` : sol et plans ;
- `accent` / `accentAlt` : touches vives (lumières, détails ; joues en `accentAlt` à 30 %) ;
- `ink` : traits, yeux, ombres (à 12 %), voiles sombres ;
- `light` : reflets, blancs.

### 5.2 Couleurs des personnages (indépendantes de la palette)

| Rôle | Candidats | Contraintes |
|---|---|---|
| skin, skin2 | #f8d5b5 #e8b48e #c68a63 #8d5a3b #5c3a28 #f1c9a0 | aucune |
| hair, hair2 | #2b1d16 #5a3825 #a0522d #e5b766 #1e2a3a #b8b8c4 #c0392b | hair2 ≠ hair |
| top, top2 | #4d96ff #ff6b6b #ffd166 #06d6a0 #8e7dff #ff9f68 #2ec4b6 #f15bb5 | top ≠ accent, accentAlt ; top2 ≠ top, accent, accentAlt |
| bottom, bottom2 | #263859 #3d405b #5c4b51 #2f4858 #6c757d #1d3557 | bottom ≠ top ; bottom2 ≠ bottom, top2 |

---

## 6. Graines utilisées dans le jeu

| Usage | Appel | Graine |
|---|---|---|
| Programme du catalogue | `forProgram(program)` | `program.id` (ex. `p009`), sinon le titre |
| Droits sportifs et cinéma | `dataUri({ seed: 'sports-rights:<id>', genre: 'sport', ...event.illustration })` | `sports-rights:<id>` |
| Familles du Mode Carrière | `dataUri({ seed: 'career:<id>', ...fam.illustration })` | `career:<id>` |

Familles du Mode Carrière :

| Famille | Genre | Sous-genre | Palette |
|---|---|---|---|
| redressement | drame | aucun | nuit |
| domination | talent | aucun | studio |
| ascension | aventure | montagne | jour |
| actionnaire | evenement | commission | cobalt |
| marche | aventure | survie | nuit |
| thematiques | info | aucun | jour |
| courts | jeu | aucun | neon |
| narratifs | policier | aucun | nuit |

Pour reproduire une image du jeu, il faut la même graine, les mêmes genre et sous-genre, et la même palette (forcée, ou tirée comme au § 3.2). La moindre différence de graine, une majuscule ou un espace, donne une autre image.

---

## 7. Classement automatique d'un titre (`classify`)

1. Si un `genre` connu est fourni, il est utilisé tel quel.
2. Sinon, le texte `titre + pitch` est normalisé (sans accents, en minuscules) et comparé à une liste ordonnée d'expressions régulières (`RULES` dans `src/runtime.js`). La première correspondance l'emporte. Exemples :
   - `koh|aventur|survie…` → aventure / survie ;
   - `cuisin|chef|patiss…` → cuisine ;
   - `quiz|motus|jeux?` → jeu ;
   - `football|foot` → sport / football.
3. Selon le type de chaîne :
   - chaîne `sport` : seules les règles sport s'appliquent ; défaut : sport ;
   - chaîne `jeunesse` : seules jeu, sport, humour et nature s'appliquent ; défaut : jeunesse.
4. Un résultat `policier` devient `info` sur une chaîne `info`, et `documentaire / culture` sur une chaîne `culture`.
5. Sans correspondance, on se replie dans cet ordre :
   - sur le format : `magazine`, `jeu`, `divertissement`, `fiction` → drame, `documentaire`, `animation` → jeunesse, `sport` ;
   - puis sur le type de chaîne : `culture` → documentaire, `cinema` → drame ;
   - puis sur `generique`.

---

## 8. Créer de nouvelles variantes

1. Ajoutez la variante dans `src/scenes.mjs`, `src/props.mjs`, `src/items.mjs` ou `src/characters.mjs`, sous la forme `{ svg: '…', tags: ['genre:x', 'sub:y'], weight?: n }`.
   - Dessinez dans la boîte du composant : scène 320×180, objet central 120×100 (base à y = 100), accessoire 50×50, personnage 60×110.
   - Les couleurs s'écrivent `$sky`, `$accent`, `$ink`, `$skin`, `$hair`, `$top`, `$bottom`…, jamais en hexadécimal : la variante suit alors toutes les palettes.
2. Lancez `npm run build` (ou `node build.mjs`).
   - Le build valide la définition et vérifie : le déterminisme, la diversité (au moins 15 combinaisons pour 40 graines), la cohérence scène ↔ sous-genre, l'absence de barbe chez fem et de robe chez masc.
   - Il régénère `dist/`, `demo.html` et le bloc embarqué dans `index.html`.
3. Contrôlez le résultat : `node generate.mjs --genre <g> --variations 24 --png`.

**Attention** : ajouter ou retirer une variante dans un groupe change les images déjà tirées pour ce groupe, car les seuils du tirage pondéré dépendent de la liste triée et du poids total.

---

## 9. Charte graphique pour dessiner ou générer « dans le style »

- **Rendu** :
  - illustration vectorielle plate (flat design), sans dégradé ni texture, formes géométriques arrondies ;
  - des traits uniquement pour les détails (yeux, bouche, accessoires) : 1 à 2 px sur une toile de 320 px, couleur `ink`, extrémités arrondies.
- **Profondeur** :
  - plans superposés de la même teinte (`ground` puis `groundAlt`) ;
  - ombres portées en ellipse `ink` à 12 % ;
  - voiles et halos à 7–40 % d'opacité ;
  - petits reflets `light` à 85 %.
- **Cadrage** :
  - 16:9, horizon vers 60–70 % de la hauteur, sol à 90 % (y = 162/180) ;
  - premier plan centré : un ou deux personnages et un objet emblématique du programme ;
  - personnages sur environ 60 % de la hauteur.
- **Personnages** :
  - proportions « mascotte » : la tête fait environ 1/5 de la hauteur (visage r = 11 pour 110) ;
  - visage sans nez, yeux en points ou en arcs, joues rosées (`accentAlt` à 30 %), cils pour les femmes ;
  - corps simple : haut uni ou rayé, bas sombre, baskets blanches ;
  - bras gauche en geste (salut, pointage, poing, main sur la hanche), main droite tenant un objet ; le second personnage fait face au premier.
- **Couleurs** : une palette du § 5.1 par image, plus les couleurs de personnages du § 5.2. Le vêtement ne prend jamais la couleur d'accent.
- **Ambiance** : un décor reconnaissable (plateau TV, nature, cuisine, stade…), plus une surcouche festive facultative (confettis, étoiles, cœurs, bokeh).

**Gabarit de prompt pour un générateur d'images IA** (à adapter) :

> Flat vector illustration, 16:9, clean geometric shapes, no gradients, no outlines except small dark details, soft ellipse drop shadows. Scene: {décor, ex. « a bright TV kitchen studio »}. Foreground: {un ou deux personnages cartoon aux proportions de mascotte, grosse tête ronde, visage simple en points, joues rosées}, one {geste}, holding a {objet tenu}, next to a {objet central}. Colors: sky {sky}, background shapes {skyAlt}, floor {ground}/{groundAlt}, accents {accent} and {accentAlt}, dark details {ink}. Cheerful TV-show mood, minimal, friendly, no text.

Remplacez les accolades par une palette du § 5.1 (ex. menthe pour la cuisine) et des éléments du § 4. Une IA ne reproduira pas l'image exacte : pour une fidélité parfaite, utilisez les méthodes A, B ou C.

---

## 10. Fichiers et licence

| Fichier | Contenu |
|---|---|
| `dist/tv-programs.json` | Définition DiceBear (StyleDefinition) |
| `dist/tv-programs.bundle.js` | Moteur et bibliothèque, pour le navigateur et la CLI |
| `generate.mjs` | CLI décrite dans ce guide |
| `src/` | Sources des dessins |
| `build.mjs` | Compilation et contrôles |

`@dicebear/core` est sous licence MIT. Les dessins tv-programs ont été créés pour Audience Masters, sans élément de marque réelle.
