# Lot 3 — Histoires par genre, arcs narratifs et choix contextuels

Ce document donne l'inventaire fait avant de coder, les changements, les paramètres, la liste des situations et des arcs, les vérifications et les limites. Les chiffres complets sont dans :

- `resultats-arcs.txt` (simulation des arcs) ;
- `resultats-file-apres-lot3.txt` (contrôles des lots 1 et 2 relancés) ;
- `resultats-diversite-vs-lot2.txt` (diversité comparée au lot 2).

## 1. Inventaire des acteurs réellement suivis (lu dans le code)

| Acteur | Où | Ce qui est suivi |
|---|---|---|
| Programme (contrat) | `player.contracts[case]` | `id`, `name`, `format`, `editorial.genre`, `annual`, `rights`, `years`, `end`, `power`, `ownership` (`licence` / `coproduction` / `owned`), `partnerId`, `exclusive`, `stopped`, `sportsPause`, `startSeason`, `acquiredFrom` |
| Carrière du programme | `contract.career` | `awareness`, `loyalty`, `wear`, `seasonsCount` (ancienneté), `seasonNumber`, `history` (performance / attendu), `historic`, `storyBoost`, `storySeasonBoost` |
| « Talent » du contrat | `contract.talent` | **niveau de production** (`TALENT_CATALOG` : Prod. Interne / Externe / Internationale), **pas une personne** |
| Talents nommés | `player.talents` (issus de `MERCATO_TALENTS`) | `id`, `name`, `specialty`, `role`, `until`, `since`, `annual` ; rattachés aux cases par leur spécialité (`channelSlotProfile(p, case).genre`) |
| Concurrents | `gameState.competitors[].contracts[case]` | programme à l'antenne par case (`activeContract`), part par case (`getCalculatedPDAs`) |
| Droits | `sportsRights.owned` | droits diffusés par saison (`playerBroadcastsRight`) |
| Producteurs | `player.producerAgreements`, `player.partners` | options d'achat (`programId`, `fee`, `closed`) ; partenaire d'un contrat négocié (`contract.partnerId`, confiance existante) |
| Plateforme digitale | `player.isPlatform` | booléen (dilemme « Devenir une plateforme ? ») ; droits d'exploitation : `contract.ownership` |
| Mémoire éditoriale | `player.programStories[id]` | `log`, `flags`, `last` |

**Acteurs non suivis** : jury, candidat, invité, animateur ou présentateur, sponsor, distributeur. Les histoires génériques les évoquent sans les nommer et sans leur donner d'état. Aucun contrat ni aucune relation n'est créé.

**Écarts avec la consigne :**

- Le jeu ne contient pas environ 450 histoires propres à un programme mais **1 015**, et **les 498 programmes du catalogue en ont toutes**. Les variantes génériques jouent donc surtout :
  - sur les situations qu'un titre ne couvre pas ;
  - après épuisement des histoires du titre (souvent uniques) ;
  - sur les programmes hors catalogue (formats originaux, programmes installés par un dilemme).
- `PROGRAM_FAMILIES` ne couvrait ni l'information, ni le sport, ni le documentaire, ni la jeunesse. Quatre familles sont ajoutées, fondées sur les données du programme (genre éditorial, format), pas sur l'intitulé.

## 2. Changements (`index.html`)

### Familles de programmes

`PROGRAM_FAMILIES` gagne `info`, `sport`, `documentaire` et `jeunesse`. `programGenresOf(contract, case)` donne les genres d'un programme, sur la même base que `gridProgramsOf`.

### Histoires génériques

- **`GENRE_STORY_BANK`** : 34 définitions, soit 16 situations et 18 étapes d'arcs. Ce sont les mêmes champs que `PROGRAM_STORY_BANK`, plus :
  - `genericKey` ;
  - `genres`, `excludeGenres`, `slots`, `channelTypes` ;
  - `requires` ;
  - `theme` ;
  - `opensArc` et `arc` ;
  - pour les choix : `needs`, `branch`, `outcome`, `arc`.
- **`programStoryCandidates`** : en plus des histoires propres au titre, elle propose les variantes génériques via `genericStoryMatches`. Celle-ci vérifie :
  - genres, case, type de chaîne ;
  - ressources (`STORY_RESOURCES`) ;
  - conditions et répétition, avec le `programStoryMatches` existant ;
  - étape d'arc et évolution observée ;
  - priorité du titre ;
  - plafond d'arcs ;
  - variables disponibles et au moins deux choix.
- **Priorité au titre.** `genericKey` est déduite de l'identifiant des histoires propres (`inferStoryGenericKey`, 12 situations). La variante générique est écartée dans deux cas : une histoire propre de même clé est éligible, ou la situation a été jouée sur ce programme pendant `genericWindow` saisons. Une histoire propre attend de même après sa variante générique.
- **Textes.** `fillStoryText(text, ctx, vars)` remplit `{programme}`, `{saisons}`, `{anciennete}`, `{creneau}`, `{rival}`, `{rivalProgramme}` et `{talent}` (`storyTextVars`). Une variable absente exclut le candidat générique. Les histoires propres gardent leurs formulations de repli.
- **Identifiant.** Une histoire générique a l'identifiant `définition--programme`. La mémoire du programme garde l'identifiant de la définition. `narrativeDescribe` (thèmes du lot 2) reconnaît ces identifiants.

### Choix contextuels (`STORY_RESOURCES`)

Une option n'apparaît que si la ressource existe :

| Ressource | Condition |
|---|---|
| `talent` | talent de la chaîne de spécialité compatible, sous contrat et pas sur le départ |
| `platform` | `isPlatform` et programme `owned` ou `coproduction` |
| `rights` | programme sous licence avec droits d'achat |
| `partner` | `contract.partnerId` ou option d'achat ouverte |
| `reducible` | au moins une saison de contrat restante |

Aucune jauge de relation n'est créée. Chaque dilemme garde 2 à 4 choix.

### Coûts

Ils passent par `programStoryFinance` : achat ponctuel, coût récurrent ou économie sur le budget du programme (`prepareProgramStoryChoice`, qui existait déjà), recette commerciale pour la chaîne. Il y a un seul flux par choix. Les effets d'audience passent par la carrière du programme (`boost`, `lasting`, notoriété, fidélité, usure), jamais par un bonus global. `pop` (popularité de la chaîne) est réservé aux choix d'image : débat, enquête, défense publique d'un jury.

### Arcs

- **Stockage.** `player.storyArcs` est initialisé par `??=` dans `ensureCampaign`. Chaque arc contient :

  ```
  { arcId, step, branch, state, openedSeason, lastSeason, expiresSeason,
    entity { kind: 'programme', id, slot, name }, rival, lastRatio, flags, history[] }
  ```

  La mémoire de décision reste `programStoryRecord` (log, flags, last).
- **`storyArcApply`** gère l'ouverture, l'étape suivante (`advance`) et la clôture (`resolve`) quand un choix est appliqué.
- **`updateStoryArcs`** s'exécute en début de saison et quand une suite est retirée de la file :
  - « abandonné » si le programme a quitté la grille ;
  - « expiré » sans suite pendant `inactiveSeasons` saisons ou au-delà de `maxDuration`.
- **`closeStoryArc`** supprime les flags de l'arc et borne l'historique. `cleanResolvedStoryFlags` supprime les flags consommés par une suite quand plus aucune histoire non jouée n'en dépend.
- **Choix de la suite.** `storyArcOutcome` compare la part de la case, rapportée à la moyenne de la chaîne, à celle de l'étape précédente ; à défaut, il prend la forme du programme. Il en sort « succès », « mitigé » ou « recul ». Les textes disent « la case progresse / se maintient / recule » sans attribuer toute la variation au choix passé.
- **Sélection des suites.** Une suite est un candidat du sélecteur pondéré du lot 2. Elle a un poids propre (`followUpWeight`) et le bonus de suite (`followUpBonus`). Elle n'est jamais garantie.

### Interface

Seuls ajouts : sous la description d'une histoire de programme, une ligne de contexte (`storyContextLine`) et, pour une suite, le rappel de la décision passée, par exemple « Saison 1 : vous aviez renouvelé tout le jury de « … ». ». Style `.dc-story-context`. Le rendu a été vérifié dans Chromium à 390 px et 1 280 px, sans erreur.

## 3. Paramètres ajoutés (`NARRATIVE_TUNING`, commentés)

| Paramètre | Valeur | Rôle |
|---|---|---|
| `stories.genericWeight` | 0,6 | poids d'une variante générique face à une histoire propre au titre (1) |
| `stories.followUpWeight` | 3 | poids d'une étape d'arc (suite d'une décision), toujours soumise au tirage |
| `stories.genericWindow` | 4 | saisons pendant lesquelles une même situation ne revient pas sur un programme |
| `arcs.maxOpen` / `maxOpenPerProgram` | 3 / 1 | arcs ouverts simultanés, par chaîne et par programme |
| `arcs.followUpDelay` | 1 | saisons minimales entre deux étapes |
| `arcs.inactiveSeasons` / `maxDuration` | 3 / 6 | expiration sans suite, durée maximale |
| `arcs.successDelta` / `declineDelta` | 0,1 / 0,1 | écart de la case à la moyenne de la chaîne pour « succès » / « recul » |
| `arcs.keepClosed` | 30 | arcs fermés gardés en mémoire |

## 4. Situations ajoutées

| Situation (`id`, `genericKey`) | Genres (PROGRAM_FAMILIES) | Conditions | Phase | Thème | Choix contextuels | Arc |
|---|---|---|---|---|---|---|
| Jury contesté (`gs_jury_conteste`, jury) | talent, cuisine | ≥ 1 saison | 2 | humain | fauteuil confié à {talent} | jury |
| Succession à la présentation (`gs_animateur_depart`, animateur) | jeu, divertissement, talk, cuisine, humour | ≥ 2 saisons | 1 | humain | émission confiée à {talent} | animateur |
| Formule qui s'essouffle (`gs_formule_usee`, refonte) | émissions de plateau, info, documentaire | ≥ 2 saisons, usure ≥ 40 | 1 | grille | — | refonte |
| Pression concurrente sur la case (`gs_pression_concurrente`, concurrence) | tous sauf sport | pression concurrentielle, concurrent réel | 2 | concurrence | — | offensive |
| Surcoût de tournage (`gs_surcout_tournage`, surcout) | fiction, aventure, téléréalité, divertissement, talent | — | 2 | économie | commande réduite, renégociation avec le partenaire | surcoût |
| Valorisation digitale (`gs_valorisation_digitale`, numerique) | tous sauf sport | plateforme et droits d'exploitation, ≥ 1 saison | 2 | opportunité | — | digital |
| Candidat emblématique qui s'en va (`gs_candidat_depart`, candidat) | téléréalité, aventure, talent, cuisine | — | 2 | humain | — | — |
| Finale exceptionnelle (`gs_finale_exceptionnelle`, finale) | talent, cuisine, téléréalité, aventure, jeu, divertissement | ≥ 1 saison, forme succès ou stable | 3 | grille | vote sur la plateforme | — |
| Proposition de déclinaison (`gs_declinaison`, declinaison) | jeu, divertissement, cuisine, talent, animation | ≥ 2 saisons, succès | 3 | opportunité | déclinaison sur la plateforme | — |
| Suite de fiction plus chère (`gs_suite_fiction_chere`, suite_fiction) | fiction | ≥ 1 saison, succès ou stable | 3 | économie | saison raccourcie (contrat réductible) | — |
| Droits d'un film trop coûteux (`gs_droits_film`, droits) | fiction | sous licence avec droits d'achat | 1 | économie | négociation (partenaire), moins de diffusions | — |
| Invité qui se désiste (`gs_invite_desiste`, invite) | talk | — | 2 | surprise | édition spéciale par {talent} | — |
| Enquête sensible (`gs_enquete_sensible`, enquete) | investigation | — | 2 | surprise | — | — |
| Débat performant mais nuisible à l'image (`gs_debat_clivant`, debat) | talk | forme succès | 2 | grille | — | — |
| Offre jeunesse vieillissante (`gs_jeunesse_vieillissante`, jeunesse) | animation, jeunesse | ≥ 2 saisons, usure ≥ 30 ; chaînes jeunesse, généraliste, culture | 1 | grille | — | — |
| Arbitrage de production sportive (`gs_production_sport`, production_sport) | sport | — | 1 | économie | images sur la plateforme | — |

## 5. Arcs ajoutés (étapes et suites)

| Arc | Ouverture (branches) | Étape 2 (selon l'évolution observée) | Étape 3 |
|---|---|---|---|
| **jury** — renouvellement du jury | remplacé / confié à un talent / recadré | succès → installer l'équipe ou émission spéciale ; mitigé → ajuster ou laisser le temps ; recul → retour partiel de l'ancien jury (si remplacé), renouvellement finalement (si recadré) ou poursuite de la transformation | — |
| **animateur** — succession à la présentation | talent interne / nouveau visage | succès → installer ou soirée spéciale ; mitigé ou recul → retoucher la formule, associer un ancien chroniqueur (recul), maintenir le cap | — |
| **refonte** — programme usé | refonte complète / retouches | succès → consolider ou aller plus loin ; mitigé → second ajustement ou stabiliser ; recul → réintroduire les rubriques historiques ou persévérer | bilan : graver la nouvelle formule ou revenir en partie en arrière |
| **offensive** — riposte à un concurrent | soirée événement / renfort durable / pas de réponse | succès → consolider ou réduire le budget ; mitigé → seconde riposte ou tenir ; recul → refonte express ou réduire la voilure | fin de la bataille : rythme normal ou dernier coup d'éclat |
| **surcout** — surcoût de production | absorbé / commande réduite / renégocié | absorbé ou renégocié → budget relevé (succès, mitigé), dispositif réduit (mitigé, recul) ou budget initial ; commande réduite → rétablir la commande ou garder le format | — |
| **digital** — développement en ligne | contenus exclusifs / extraits gratuits | succès → offre premium ou élargir ; mitigé ou recul → recentrer ou fermer | bilan : pérenniser avec un partenaire ou arrêter |

Toutes les suites exigent :

- que l'arc soit ouvert sur le même programme, à la bonne étape ;
- au moins `followUpDelay` saison depuis l'étape précédente ;
- que le programme soit à l'antenne.

Le concurrent nommé dans les suites de l'arc « offensive » est celui de l'ouverture.

## 6. Vérifications

### Tests unitaires (`tests/genre-stories.test.js`)

- **Banque** : 16 situations, 6 arcs (toutes les étapes définies), 2 à 4 choix, au moins deux choix sans ressource pour chaque branche et chaque évolution, un seul flux financier par choix, variables connues.
- **Textes** : toutes les variantes génériques sont construites sur tous les programmes du catalogue des six types de chaînes (ancienneté et usure forcées pour ouvrir les conditions). Aucun « undefined », « null », « NaN » ni variable non remplacée.
- **Acteurs absents** :
  - aucune histoire sans programme signé, ni après déprogrammation ;
  - option « talent » seulement avec un talent compatible sous contrat, et il est nommé ;
  - histoire numérique seulement avec plateforme et droits d'exploitation.
- **Priorité au titre** : la variante générique est écartée tant que l'histoire propre de même situation est éligible, ou jouée dans la fenêtre, et réciproquement.
- **Arc complet** : ouverture avec achat débité une fois et budget du programme inchangé ; pas de suite la même saison ; suite choisie selon l'évolution observée (succès / recul) ; rappel « Saison N : vous aviez renouvelé tout le jury de « … ». » ; résolution ; aucun flag résiduel.
- **Programme déprogrammé en cours d'arc** : la suite déjà dans la file devient invalide, elle est retirée par la revalidation, l'arc passe « abandonné » et plus aucun arbitrage n'est proposé.
- **Plafond et expiration** : aucune ouverture au-delà de 3 arcs, abandon des arcs sans programme, expiration d'un arc inactif avec suppression de ses flags.
- **Finance** : coût récurrent appliqué une fois au programme et à la grille, aucun autre programme touché ; économie appliquée au budget du programme.
- **Ancienne partie** sans `storyArcs` ni `programStories`, rechargée depuis du JSON : la collecte fonctionne et les arcs sont initialisés par `??=`.

Les 9 suites `tests/*.test.js` passent. Dans `program-stories.test.js`, l'utilitaire `storyIds` ne compte plus que les histoires propres aux titres.

### Simulation des arcs (`tests/narrative-arcs.sim.js`, `resultats-arcs.txt`)

Paramètres : 5 graines × 120 saisons × 6 types = 3 600 saisons, choix aléatoires, grille garnie, un talent recruté, une partie sur trois en plateforme.

| Mesure | Valeur |
|---|---|
| Histoires de programmes jouées | 1 785 (0,50 par saison), dont 833 variantes génériques (46,7 %) et 114 suites d'arcs |
| Arcs ouverts | 237 (6,6 % des saisons) |
| Étapes intermédiaires | 40 |
| Résolus / expirés / abandonnés | 31 % / 28 % / 12 % des ouvertures (le reste encore ouvert en fin de partie) |
| Arcs ouverts simultanés | maximum 2 (plafond 3), moyenne 0,15 ; jamais plus d'un par programme |
| Arc rattaché à un programme absent | 0 |
| Deux histoires du même programme dans une saison | 0 |
| Même histoire rejouée avant son délai | 0 |
| Textes incomplets, files vides ou bloquées, erreurs | 0 |

### Contrôles des lots précédents relancés

- `resultats-file-apres-lot3.txt` : 0 écart de pureté sur 709 tirages, aucune crise perdue, expiration forcée correcte, 6 anciennes sauvegardes (révision `6fdce0a`) rejouées sans erreur, aucune décision de Carrière perdue, aucune file vide ou bloquée.
- `resultats-diversite-vs-lot2.txt` (2 graines × 150 saisons × 6 types) : indicateurs du lot 2 conservés.

  | Indicateur | Lot 2 | Lot 3 |
  |---|---|---|
  | Deux dilemmes du même thème | 0,1 % | 0,0 % |
  | Thème dominant | 43,9 % | 44,2 % |
  | Crise facultative | 21,6 % | 19,9 % |
  | Obligations perdues | 0 | 0 |
  | Saisons avec une histoire de programme | 22 % | 30 % |
  | Part des histoires face à la banque | 25 % | 35 % (haut de la cible) |

  Les histoires génériques ajoutent de la matière ; les deux dernières lignes en montrent la hausse.

## 7. Limites restantes

- **Répartition des arcs inégale** :
  - « refonte » domine, car les programmes atteignent souvent l'usure 40 ;
  - « jury » et « offensive » sont rares (1 ouverture chacun sur 3 600 saisons). « Jury » demande un concours de talents ou de cuisine sans histoire « jury » propre, et la plupart en ont une. « Offensive » demande une pression concurrentielle réelle sur la case, peu fréquente.
  - On peut les rendre plus fréquents par leurs conditions ou leur poids (`weight` de la définition), sans toucher au moteur.
- **Arcs expirés** : 28 % des ouvertures, parce que la suite reste soumise au tirage. `stories.followUpWeight` et `arcs.inactiveSeasons` règlent ce compromis.
- **Options contextuelles** : talent, partenaire, commande réduite et plateforme sont rarement retenues en simulation (choix aléatoires, ressources rares : partenaire seulement après une négociation, plateforme seulement après le dilemme dédié).
- **Classement par genre** : la famille « cuisine » de `PROGRAM_FAMILIES` reconnaît aussi des magazines de recettes ; une situation de concours (jury) peut donc viser un magazine culinaire. C'est la classification existante, réutilisée telle quelle.
- **Clés de situation des histoires propres** (`genericKey`) : elles sont déduites de leur identifiant par une table de règles ; quelques histoires sans mot-clé reconnaissable restent sans clé, et leur variante générique peut alors coexister dans le temps.
- **Ancienne sauvegarde** : comme aux lots précédents, simulée par sérialisation JSON, faute de système de sauvegarde dans le jeu.
