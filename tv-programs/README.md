# tv-programs — style DiceBear d'illustrations de programmes TV

Illustrations vectorielles « flat » (scènes façon Storyset) générées **localement** et de façon
**déterministe** à partir d'un programme : un même programme donne toujours la même image, deux
programmes d'un même genre obtiennent des compositions différentes. Aucun appel réseau, aucune IA
générative. Utilisé par les cartes de la « Conférence de rentrée » d'Audience Masters.

Démo : [`demo.html`](demo.html) (≈ 30 programmes fictifs, explorateur de variations, tailles).

## Architecture

Le style est une `StyleDefinition` [DiceBear 10](https://www.dicebear.com) composée de calques :

| Calque | Fichier | Contenu |
| --- | --- | --- |
| `scene` | `src/scenes.mjs` | ~55 décors 320 × 180 (sol à y ≈ 150), étiquetés par genre / sous-genre |
| `composition` | `src/compositions.mjs` | 5 mises en place (duo, hostLeft, hostRight, center, trio) |
| `character`, `character2` | `src/characters.mjs` | personnages modulaires : jambes, buste, bras, coiffure (tête + visage), couvre-chef |
| `handheld`, `headwear` | `src/items.mjs` | objets tenus en main et couvre-chefs par genre |
| `prop` | `src/props.mjs` | objet central du genre (coffre, pupitre, fourneau, bureau du JT, buts…) |
| `accessory` | `src/items.mjs` | accessoires posés au sol |
| `decor` | `src/items.mjs` | éléments décoratifs (confettis, cœurs, notes, oiseaux…) |
| palette | `src/runtime.js` | 10 ambiances (`jour`, `nuit`, `studio`, `neon`, `pastel`…) autorisées par genre |

Les variantes portent des tags `genre:<genre>` et `sub:<sous-genre>` : le filtre de tags de DiceBear
ne retient que celles du programme. Le second personnage (`character2`, `legs2`…) est généré par le
build avec ses propres couleurs (`$skin2`, `$top2`…).

Genres : `aventure`, `jeu`, `divertissement`, `telerealite`, `dating`, `cuisine`, `talent`,
`policier`, `drame`, `sport`, `documentaire`, `magazine`, `info`, `humour`, `jeunesse`, `cinema`, `evenement`, `generique`.
Sous-genres : sport (`football`, `rugby`, `basket`, `handball`, `tennis`, `auto`, `velo`, `surf`,
`combat`, `ski`, `fitness`, `athletisme`, `hippisme`), aventure (`survie`, `montagne`), documentaire (`nature`, `histoire`,
`science`, `culture`), cinema (`ceremonie`, `festival`, `film`, `serie` — droits cinéma & séries du jeu),
evenement (`debat`, `espace`, `vatican`, `election`, `royal`, `enquete`, `commission` pour les grands événements
d'information, `eurovision`, `esport`, `concertweb`, `noel`, `animation` pour ceux des chaînes Jeunesse —
un décor dédié par sous-genre).

## API (navigateur)

```js
TvPrograms.svg({ seed, genre, subgenre, backgroundColor, palette, size }); // chaîne SVG 16:9
TvPrograms.dataUri(options);              // data URI, mise en cache (Map)
TvPrograms.classify(program);             // { genre, subgenre } depuis { title|name, pitch, genre?, subgenre?, format?, channelType? }
TvPrograms.forProgram(program, options);  // data URI de l'illustration du programme (graine = program.id)
TvPrograms.pitch(program, exclude);       // pitch éditorial déterministe (program.pitch s'il existe)
```

En cas d'erreur, `dataUri` retombe sur le genre `generique`, puis sur une image statique (`FALLBACK_SVG`).

## Avec `@dicebear/core` (Node)

```js
import { Style, Avatar } from '@dicebear/core';
import definition from './dist/tv-programs.json' with { type: 'json' };

const style = new Style(definition);
const svg = new Avatar(style, {
  seed: 'aventure:koh-menta',
  tags: ['genre:aventure', 'sub:survie'],
  skyColor: ['cfeefa'], groundColor: ['9bd48a'] // couleurs de scène facultatives
}).toString();
```

## Build

```bash
npm install
npm run build          # node build.mjs
node build.mjs --check # validation seule
```

Le build assemble la bibliothèque, valide la définition avec le validateur officiel de
`@dicebear/core`, vérifie pour chaque genre / sous-genre la présence des calques, le déterminisme,
la diversité (≥ 15 combinaisons sur 40 graines) et la correspondance décor ↔ sous-genre, puis écrit
`dist/tv-programs.json`, `dist/tv-programs.bundle.js`, `demo.html` et injecte le moteur dans
`../index.html` (entre les marqueurs `tv-programs:start` / `tv-programs:end`, à ne pas éditer à la
main). Le runtime embarqué est `@dicebear/core` (MIT) sans ses validateurs (~42 Ko), la définition
étant déjà validée au build.
