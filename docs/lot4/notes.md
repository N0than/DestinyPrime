# Lot 4 — Issues incertaines encadrées

## 1. Lecture du code avant modification

- **Application d'un choix d'histoire.** `chooseDilemmaOption` appelle `chooseMaterialized`, qui enchaîne :
  - `prepareProgramStoryChoice` : budget récurrent du programme ;
  - `quoteDilemma` / `applyFinance` : flux financiers ;
  - `applyProgramStoryChoice` : carrière, `storyBoost` / `storySeasonBoost`, mémoire `programStoryRecord`, arcs ;
  - `applyDilemmaAudienceImpacts` et la réestimation de la PDA.

  Les issues du lot 4 passent par ce circuit, sans moteur parallèle.
- **Sauvegarde.** Une partie est l'objet `gameState` sérialisé en JSON. Le tirage `seededRandom` lit et écrit `gameState.campaign.seed`, qui est donc sauvegardé avec la partie.
- **Arcs (lot 3).** `player.storyArcs` contient l'historique des étapes et l'évolution observée (`storyArcOutcome`), qui oriente la suite.
- **Hypothèse du prompt contredite par le code.** Deux choix avaient déjà une conséquence aléatoire (`randomOutcomes`, 50/50, sans affichage) :
  - le scoop `d161` (chaînes sport) ;
  - l'offre raisonnable sur les droits du mode Carrière.

  Ils sont conservés tels quels, pour ne pas toucher aux décisions scénarisées des carrières. Avec les 6 choix du lot 4, le jeu compte **8 choix incertains**.
- **Données disponibles.**
  - Carrière du programme (`awareness`, `loyalty`, `wear`, sur 100).
  - Budget annuel du contrat, comparé à `slotReference(type, case).annual` (référence existante du studio).
  - Pénalité de contre-programmation (`getCalculatedPDAs().pressure`, plafonnée par `GAME_BALANCE.counterProgramming.maxPenalty`).
  - Affinité du talent avec la cible de la chaîne (`talent.affinities[cible]`).

## 2. Changements (`index.html`)

| Fonction ou élément | Rôle |
|---|---|
| `NARRATIVE_TUNING.outcomes` (nouveau) | Bornes, seuils d'affichage, modèles par choix (voir § 4) |
| `storyOutcomeFactors(ctx)` | Facteurs de −1 à +1 tirés des données existantes |
| `boundedShares(raw, min, max)` | Parts bornées et normalisées : p_i = borne(λ × raw_i), λ tel que Σ = 1 |
| `storyOutcomeOdds(model, facteurs)` | Score = Σ poids × facteur ; la meilleure issue gagne le score, la moins bonne le perd |
| `storyOutcomeNote` | Explication courte (« Le programme est très connu, mais la concurrence est forte sur la case. ») |
| `storyUncertainty` | Issues figées sur le choix à la construction du dilemme : textes remplis, probabilités |
| `storyChanceLabel` | « chances moyennes (~45 %) » |
| `resolveStoryOutcome` | **Seul tirage** (`seededRandom`) : `dilemma.resolvedOutcome` est écrit avant tout effet, puis le choix effectif est composé (effets certains + effets de l'issue) |
| `buildProgramStoryDilemma` | Ajoute `story.uncertain` aux choix concernés |
| `chooseMaterialized` | Garde d'idempotence (`resolvedOutcome` présent → ni tirage ni effet), puis tirage |
| `applyProgramStoryChoice` | Le log du programme est écrit **avant** les effets, avec l'issue |
| `storyArcApply` | Mémorise l'issue (historique, `lastOutcome`) ; le rappel la cite |
| `storyArcOutcome` | Une évolution mesurée nette garde la priorité ; sinon l'issue oriente la suite, à défaut la forme |
| `programStoryContext` | Ajoute `pressureLevel`, valeur de la pression |
| `gameState.lastConsequence.outcome` et rendu du résultat | « Issue : Déception · chances faibles (~15 %) » |
| `seededRandom` | Compteur `NARRATIVE_RANDOM_CALLS`, actif seulement en diagnostic |
| `GENRE_STORY_BANK` | 6 choix reçoivent `uncertain` ; leurs effets sont répartis entre la part certaine et les issues, à espérance voisine de l'ancien effet unique |
| CSS | `.story-outcome` |

Le diagnostic (`NARRATIVE_DEBUG`, `?narrativeDebug=1` ou localStorage) logue « issue tirée » (probabilité, tirage) et « issue déjà tirée ».

### Ce que garantit le tirage

- **Moment.** Il a lieu à la validation, jamais au rendu. Les probabilités sont calculées à la construction du dilemme, sans tirage, et stockées sur le choix : le tirage utilise exactement ces probabilités, même après rechargement.
- **Présentation.** À la demande, les choix de réponse n'affichent que leur intitulé (et leur pastille de coût habituelle) : ni encart certain / incertain, ni probabilités avant le choix. L'issue tirée est affichée après le choix, avec son estimation.
- **Idempotence.** Un dilemme avec `resolvedOutcome` n'est ni re-tiré ni réappliqué : double clic, retour arrière, rechargement.
- **Rechargement avant validation.** La graine est dans l'état, donc la même issue sort.
- **Effets.**
  - Les coûts certains passent par le circuit financier existant, une seule fois.
  - Les effets de l'issue (carrière, boost, popularité) sont ajoutés aux effets du choix avant leur application unique par `applyProgramStoryChoice`. Il n'y a donc pas de double comptage.
  - Le boost d'audience est appliqué par le même `storySeasonBoost`.
- **Anciennes sauvegardes.** Rien n'est à migrer. Un dilemme sauvegardé sans `uncertain` se joue avec des conséquences certaines ; un arc sans `lastOutcome` garde le comportement du lot 3.

## 3. Choix concernés, facteurs et bornes

Bornes communes : chaque issue est entre **15 % et 85 %**, et les probabilités somment à 1. Le facteur « pression » vaut 0 à 1 (pénalité / pénalité maximale) ; les autres facteurs vont de −1 à +1 :

- fidélité, usure, notoriété : (valeur − 50) / 50 ;
- production : (budget / référence de la case − 1) / 0,5 ;
- affinité : (affinité − 0,6) / 0,4.

| Histoire / choix | Modèle | Issues (de la meilleure à la moins bonne) | Base | Poids des facteurs |
|---|---|---|---|---|
| `gs_formule_usee` · Lancer une refonte complète (ouvre l'arc refonte) | `refonte` | Accueil favorable / Accueil partagé / Rejet des fidèles | 40 / 35 / 25 % | usure +0,25 · fidélité −0,2 · production +0,2 · pression −0,15 |
| `gs_refonte_recul` · Persévérer dans la transformation (étape d'arc) | `persistance` | Le public adopte la transformation / Les fidèles décrochent | 50 / 50 % | notoriété +0,2 · production +0,2 · fidélité +0,15 · pression −0,2 |
| `gs_animateur_depart` · Confier le programme à un talent de la chaîne | `relevePresentation` | Adoption rapide / Période de rodage / Greffe difficile | 40 / 35 / 25 % | affinité du talent +0,3 · fidélité −0,2 · notoriété +0,15 |
| `gs_jury_conteste` · Confier un fauteuil du jury à un talent | `fauteuilJury` | Le jury trouve son équilibre / Greffe difficile | 55 / 45 % | affinité du talent +0,3 · notoriété +0,15 · usure −0,1 |
| `gs_finale_exceptionnelle` · Finale en direct dans une grande salle | `finale` | Triomphe / Belle soirée / Déception | 35 / 45 / 20 % | notoriété +0,2 · fidélité +0,2 · production +0,15 · pression −0,2 |
| `gs_declinaison` · Produire une édition spéciale en prime | `editionSpeciale` | Soirée réussie / Soirée en demi-teinte | 55 / 45 % | notoriété +0,2 · usure −0,25 · pression −0,15 |

Ce qui reste **certain** sur chaque choix :

- le coût (achat ponctuel) ;
- l'engagement d'arc ;
- les effets structurels : usure −20 pour la refonte, usure +3 pour l'édition spéciale.

Les issues orientent les arcs : Accueil favorable / adoption → « succès », Accueil partagé / rodage → « mitigé », Rejet / greffe / décrochage → « recul ».

## 4. Paramètres ajoutés (`NARRATIVE_TUNING.outcomes`, commentés dans le code)

| Paramètre | Valeur | Rôle |
|---|---|---|
| `min`, `max` | 0,15 / 0,85 | Bornes de chaque issue |
| `labels.low`, `labels.high` | 0,30 / 0,55 | Chances « faibles » sous 30 %, « élevées » à partir de 55 % |
| `explain` | 0,05 | Effet minimal d'un facteur pour être cité dans l'explication |
| `models` | 6 modèles | Base et poids des facteurs (tableau ci-dessus) |

## 5. Vérifications

| Script | Résultat |
|---|---|
| `tests/uncertain-outcomes.test.js` (Node, `--report` pour le détail ; voir `verifications.txt`) | Voir le détail ci-dessous |
| `tests/uncertain-outcomes.browser.js` (Chromium, Playwright, `--shots docs/lot4`) | Voir le détail ci-dessous |
| `tests/narrative-arcs.sim.js` (5 graines × 120 saisons × 6 types de chaînes, `arcs.txt`) | Section « Issues incertaines » : observé / attendu, anomalies |
| `tests/narrative-queue.sim.js` (`file.txt`), `tests/narrative-diversity.sim.js` (`diversite.txt`) | Contrôles des lots 1 et 2 relancés |
| Tous les `tests/*.test.js` | OK |

`tests/uncertain-outcomes.test.js` vérifie :

- **Bornes et somme.** 612 360 jeux de probabilités sur un balayage :
  - fidélité, usure et notoriété de 0 à 100 ;
  - budget de 0 à 20 M€ ;
  - pression de 0 à 0,5 ;
  - affinité absente ou de 0 à 1 ;
  - plus des scores extrêmes.

  Tous sont bornés à [15 %, 85 %] et somment à 1 (à 10⁻⁹ près).
- **10 000 tirages.** Fréquences observées 56,3 / 28,6 / 15,2 % pour des probabilités affichées de 56,9 / 28,1 / 15,0 %. Écarts à moins de 4 σ.
- **Rechargement.** Sauvegarde avant validation : même issue et mêmes effets sur trois rechargements. Sauvegarde après validation : issue conservée, effets non réappliqués, et une nouvelle validation ne fait rien.
- **Double clic et retour arrière.** Ni tirage ni effet supplémentaire.
- **Effets appliqués une seule fois** : coût certain, notoriété, boost d'audience. L'issue est dans le log du programme et dans le résultat affiché.
- **Orientation de l'arc.** Sur 8 graines, l'issue oriente la suite d'arc lorsque l'évolution mesurée est neutre ; une évolution nette reste prioritaire.
- **Affinité du talent.** Elle change les probabilités et l'explication nominative.

`tests/uncertain-outcomes.browser.js` vérifie, sur mobile (390 px) et desktop (1 280 px) :

- 10 rendus de la carte sans aucun appel à `seededRandom` (compteur du diagnostic), les choix n'affichant que leur intitulé ;
- un clic de validation qui tire une seule fois ;
- l'issue affichée ;
- 10 rendus de l'écran de résultat sans tirage ;
- aucun débordement horizontal ni erreur de page.

Les captures sont `lot4-carte-*.png` et `lot4-issue-*.png`.

## 6. Limites

- **Fréquences en partie libre.** Les choix incertains n'apparaissent que si leur histoire est tirée et ce choix retenu. Sur 3 600 saisons (`arcs.txt`), 101 ont été joués :

  | Modèle | Choix joués | Issues : observé / attendu |
  |---|---:|---|
  | Refonte | 75 | 38 / 36,1 ; 26 / 25,0 ; 11 / 13,9 |
  | Persévérance | 15 | 11 / 9,7 ; 4 / 5,3 |
  | Relève de la présentation | 7 | — |
  | Édition spéciale | 4 | — |
  | Fauteuil du jury, finale | 0 | Leurs conditions sont rares en partie aléatoire (concours sur la grille, talent compatible) |

  Il n'y a aucune anomalie : chaque issue est tirée, enregistrée, bornée et de somme 1. Les fréquences sont vérifiées sur 10 000 tirages dédiés, car la partie libre n'en fournit pas assez.
- **Contrôles des lots précédents.** Ils sont inchangés : diversité (thème dominant 43,9 %), pureté des collectes, crises, anciennes sauvegardes, renouvellements et décisions du mode Carrière, files. Aucune erreur.
- **Tirages préexistants.** Le scoop `d161` et l'offre de droits du mode Carrière gardent leurs 50/50 non affichés, sans garde d'idempotence propre : la phase « résultat » protège déjà du double clic. Les aligner sur le lot 4 toucherait aux décisions scénarisées du mode Carrière.
- **Effets différés.** L'issue agit sur la carrière et l'audience de la saison. Elle n'a pas d'effet différé autre que l'orientation de l'arc.
- **Calibrage.** Les poids des modèles sont des choix de conception, documentés et centralisés, pas des mesures. Ils ne sont pas calibrés sur des données réelles.
