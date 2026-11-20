# Lot 2 — Composer une saison variée (sélection pondérée)

Ce document résume ce que j'ai lu avant de coder, les changements et points d'intégration, les paramètres, les vérifications et les limites restantes. Les chiffres complets sont dans `resultats-diversite.txt`, produit par `node tests/narrative-diversity.sim.js --seasons 500 --seeds 5 --out docs/lot2/resultats-diversite.txt`.

## Lecture du code avant de coder

- **Prérequis du lot 1 : vérifié** (commit `615e519`). Toutes les sources exposent des candidats au format commun. Le sélecteur unique est `pickDilemmaQueue`, l'engagement passe par `narrativeFinalize`, et la revalidation (`revalidateNarrativeQueue`) s'appuie sur `release` et `commit`.
- **La banque compte 331 entrées, sans champ de catégorie ni de thème.** Les champs disponibles sont `types`, `requiresProgram`, `type`, `requiresRight`, `eligibleIf` et la catégorie financière des choix. Les thèmes sont donc attribués par des règles ordonnées (`NARRATIVE_BANK_THEME_RULES`), sans modifier les entrées une à une. `PROGRAM_STORY_BANK` (1 015 histoires) est rattachée par famille.
- **Historique.** Le code n'a pas de mémoire des thèmes, mais `player.decisionHistory` garde l'identifiant et la saison de chaque décision jouée, et `biddingHistory` garde les concurrents. La nouveauté des thèmes et la récence des entités sont donc reconstruites à partir des identifiants (`narrativeDescribe`). Aucun nouveau champ n'est sauvegardé, et une ancienne partie a d'emblée un historique exploitable.
- **Thème ajouté hors exemple : « droits ».** Classées en « opportunité », les enchères bloquaient les démarchages ; classées en « concurrence », elles bloquaient les mises en concurrence. Elles reviennent environ une saison sur deux ou trois et sont obligatoires : un thème propre, « Droits et événements », évite qu'une échéance de calendrier éteigne une source entière.
- **Crises contextuelles.** Le lot 1 les plaçait d'office (« obligatoires »). Le lot 2 en fait des crises facultatives avec un poids élevé. Une crise non retenue reste en attente (lot 1) avec un bonus de pertinence par saison d'attente, puis expire explicitement.
- **Événement de campagne.** Quand les renouvellements prennent la dernière place, il se place désormais sur la place libre la plus tardive. Dans le lot 1, il était reporté à une saison suivante.

## Changements et points d'intégration (`index.html`)

### Taxonomie

Le bloc « THÈMES NARRATIFS » contient :

- **`NARRATIVE_THEMES`**, dix thèmes : grille et programmes, arbitrage économique, arbitrage commercial, arbitrage humain, concurrence, opportunité, surprise, suite de décision, droits et événements, crise.
- **`PROGRAM_STORY_FAMILY_THEMES`** : `editorial` → grille, `economie` → économie, `audience` → concurrence, `image` → humain, `strategie` → opportunité. Une histoire qui fait suite à un choix passé relève de « suite ».
- **`NARRATIVE_SOURCE_THEMES`** : démarchage → opportunité, mise en concurrence → concurrence, régie → commercial, crise → crise, campagne → suite, enchère → droits, renouvellement → grille.
- **Fonctions :**
  - `bankDilemmaTheme(d)` : règles appliquées dans l'ordre, résultat en cache ;
  - `narrativeToneFor(theme, texte)` : tonalité négative, neutre ou positive ;
  - `narrativeDescribe(d | id)` : thème, tonalité et entités d'un dilemme construit ou d'une décision passée.

### Tonalité des candidats

- Une crise est négative.
- Une histoire dépend de la forme du programme : succès → positive, difficulté → négative.
- Un programme convoité par un concurrent est négatif ; un démarchage ou une opportunité régie sont positifs.
- Pour la banque, la tonalité vient du thème, nuancée par le vocabulaire du titre et de la description.

### Collecteurs

Tous les collecteurs renseignent maintenant `theme`, `tone`, `weight` (poids propre dans la source) et `relevance`.

- **Mise en concurrence.** `collectBiddingWarCandidates` porte une étape `resolve()` : l'offre concurrente est tirée seulement quand le candidat est retenu (`resolveBiddingWarCandidate`, `biddingOffer`). `drawBiddingWarCandidate` est supprimée.
- **Histoires.** La pertinence est extraite dans `programStoryRelevance` et réutilisée par `programStoryCandidates`.

### Sélection : `pickDilemmaQueue()`

1. **Obligations et calendrier**, placés d'abord et jamais écartés pour la diversité :
   - le droit diffusé, en tête ;
   - l'enchère, en 2ᵉ place ;
   - l'événement de campagne ;
   - la place des renouvellements (dernière), réservée dès que `buildRenewalDilemmas().main` n'est pas vide.
2. **Places restantes**, tirées une par une avec `narrativeDrawPlace(pool, position, ctx)` :
   - filtrage par position et par phase (`PROGRAM_STORY_POSITIONS`, crise jamais en dernière place) ;
   - calcul des poids ;
   - garde-fous `NARRATIVE_GUARDS`, qui cèdent un à un si plus rien ne reste ;
   - relèvement des dilemmes neutres ou positifs ;
   - tirage `seededRandom`, puis `resolve()` éventuel.

   Le contexte (`narrativeSeasonContext`, `narrativeContextAdd`) est recalculé après chaque sélection.
3. **Place réservée aux renouvellements** : elle reçoit un dilemme général de réserve. Ce dilemme est remplacé par `withRenewalDilemmas()`, dont la logique ne change pas. Il n'est engagé que s'il réapparaît, ce qui garde intacts `refreshRenewalDilemmas` et `dilemmaBaseQueue`.
4. **Repli** : une place restée vide reçoit un dilemme général, puis viennent la construction, `withRenewalDilemmas()` et l'engagement, comme au lot 1.

### Poids

```
poids final = base × pertinence × suite narrative × nouveauté du thème × récence de l'entité × proximité
```

`narrativeWeigh` le calcule et journalise chaque facteur.

| Facteur | Calcul |
|---|---|
| base | poids de la source × poids propre du candidat ÷ somme des poids propres de la source à cette place. Une source nombreuse (la banque, 70 candidats environ) ne noie pas les autres. |
| pertinence | histoires : + 0,4 par condition de contexte remplie (la logique de `programStoryCandidates`) ; banque liée à la grille réelle : × 1,3 ; crise en attente : + 0,5 par saison d'attente |
| suite narrative | × 1,5 pour une suite d'un choix passé |
| nouveauté | × 0,75 par apparition du thème lors des 2 dernières saisons jouées ; × 0,02 pour un dilemme de la banque joué dans une partie précédente (`recentDilemmaIds`, « en dernier recours » comme avant) |
| récence de l'entité | × 0,5 si le programme, le talent ou le concurrent a été sollicité lors des 2 dernières saisons |
| proximité | × 0,15 pour un thème déjà présent dans la saison, × 0,05 pour un programme déjà présent (ne joue que lorsqu'un garde-fou a cédé) |

### Garde-fous (souples)

Ils cèdent, dans cet ordre, seulement si aucun candidat ne reste :

1. même thème dans la saison ;
2. même programme dans la saison ;
3. plus d'une crise facultative ;
4. démarchage et mise en concurrence dans la même saison (règle du lot 1) ;
5. plus de `PROGRAM_STORY_TUNING.maxPerSeason` histoires.

Autres garanties :

- Tant que la saison n'a aucun dilemme neutre ou positif, ceux-ci gardent au moins `minNonNegativeShare` (50 %) de la probabilité de chaque place.
- Les phases ne sont pas un garde-fou souple : ce sont des positions permises, jamais levées.
- La banque générale est toujours dans le tirage : c'est le repli.

### Revalidation

`narrativeReplacement` passe par le même tirage pondéré : histoires compatibles et banque, avec le contexte du reste de la saison.

### Suppressions

`placeProgramStories`, `narrativeFirstPosition`, `narrativeReplaceable`, `narrativeStoryReplaceable`, `replaceableQueueDilemma` et `drawBiddingWarCandidate`, devenus sans usage.

### Diagnostic `NARRATIVE_DEBUG`

Une entrée `place` par position donne :

- le tirage obtenu (position dans [0, 1]) et la sélection ;
- les candidats avec thème et tonalité, et la décomposition de leur poids ;
- les exclusions avec leur raison ;
- les garde-fous levés et le relèvement neutre/positif éventuel.

Les obligations (`obligation`) et les candidats par source (`candidats`) sont aussi journalisés.

## Paramètres : `NARRATIVE_TUNING` (commenté dans le code)

| Paramètre | Valeur | Remplace / rôle |
|---|---|---|
| `sourceWeight.bank` | 1 | référence |
| `sourceWeight.producer` | 0,75 | `PRODUCER_PITCH.chance` (50 % par saison) |
| `sourceWeight.biddingWar` / `biddingWarOption` | 0,13 / 0,35 | `BIDDING_WAR.chance` / `optionChance` (35 % / 60 %) |
| `sourceWeight.story`, `storyPerProgram`, `storyMax` | 0,45, 0,15, 1 | `PROGRAM_STORY_TUNING.baseChance`, `chancePerProgram`, `maxChance`, `secondChance` |
| `sourceWeight.regie` | 6 | ex-placement d'office quand l'opportunité est éligible |
| `sourceWeight.crisis` | 2,5 | ex-placement d'office de la crise mûre |
| `rivalShare` | 0,5 | ex-`PRODUCER_PITCH.rivalShare` |
| `relevance.perCondition`, `contextualBank`, `crisisWaiting` | 0,4, 1,3, 0,5 | pertinence |
| `followUpBonus` | 1,5 | suite narrative |
| `novelty.seasons`, `novelty.malus` | 2, 0,75 | nouveauté du thème |
| `entityRecency.seasons`, `entityRecency.malus` | 2, 0,5 | récence de l'entité |
| `recentBankMalus` | 0,02 | mémoire entre parties |
| `proximity.sameTheme`, `proximity.sameProgram` | 0,15, 0,05 | proximité |
| `maxOptionalCrises` | 1 | garde-fou |
| `minNonNegativeShare` | 0,5 | place réservée au neutre ou positif |

Les poids des sources ont été calibrés par simulation pour retrouver les fréquences du lot 1 : démarchage 49 %, mise en concurrence 16 %. Seuils conservés et pourquoi :

- `PRODUCER_PITCH.minSeason` et `BIDDING_WAR.minSeason` (saison ≥ 2) : ce sont des conditions d'éligibilité, pas des chances.
- `PROGRAM_STORY_TUNING.maxPerSeason` : c'est devenu un garde-fou.
- L'opportunité régie reste réservée aux saisons sans enchère (règle de position historique).

## Vérifications

- `tests/narrative-diversity.sim.js` joue 5 graines × 500 saisons × 6 types de chaînes avec des choix aléatoires. Cela fait 15 221 saisons pour le lot 2 et 15 264 pour le lot 1 (révision `615e519`), environ 40 minutes. La table complète, avec la distribution des thèmes, est dans `resultats-diversite.txt`.

| Indicateur | Lot 1 | Lot 2 | Cible proposée |
|---|---|---|---|
| Part moyenne du thème dominant par saison | 50,1 % | 44,5 % | ≤ 45 % |
| Saisons avec deux dilemmes du même thème | 13,1 % | 0,2 % | ≤ 10 % |
| Saisons avec deux sollicitations du même programme | 0,2 % | 0,0 % | ≤ 1 % |
| Saisons avec une crise facultative | 16,4 % | 20,0 % | 20 à 35 % |
| Saisons avec deux crises facultatives ou plus | 0,5 % | 0,0 % | 0 % |
| Saisons avec au moins un dilemme neutre ou positif | 99,9 % | 100 % | ≥ 60 % |
| … dont chaînes en difficulté | 99,9 % | 100 % | ≥ 60 % |
| Histoires / (histoires + banque générale) | 19,6 % | 28,0 % | 15 à 35 % |
| Saisons avec démarchage / mise en concurrence / régie / crise contextuelle / histoire | 47 / 19 / 7 / 8 / 17 % | 53 / 15 / 6 / 11 / 23 % | proches du lot 1 |
| Obligations perdues, renouvellements absents, files vides ou bloquées, erreurs | 0 | 0 | 0 |
| Événements de campagne reportés | 5,7 % | 0 % | information |

Justification des cibles :

- **Thème dominant.** Une saison a 2 ou 3 rendez-vous. 33 % signifie trois thèmes distincts, 50 % deux thèmes distincts sur deux places (saison avec renouvellement).
- **Crise.** Fourchette indiquée par le lot : une crise de temps en temps donne de la tension sans transformer la partie en gestion de catastrophes.
- **Histoires.** De 15 à 35 % : la grille réelle se sent sans écraser la banque générale.

Les tests unitaires du lot 2 sont dans `tests/program-stories.test.js` :

- thème et tonalité pour les 331 entrées de la banque ;
- familles d'histoires rattachées à un thème ;
- aucun doublon de programme et doublons de thème seulement faute d'alternative, sur 40 tirages ;
- probabilité minimale du neutre ou positif mesurée sur une place à 7 candidats négatifs contre 1 neutre : 42 à 58 % pour une cible de 50 % ;
- droit diffusé toujours en tête.

Les contrôles du lot 1 sont relancés après le lot 2 (`tests/narrative-queue.sim.js`, `docs/lot1/resultats-simulation-apres-lot2.txt`) :

- 0 écart de pureté sur 1 101 tirages ;
- aucune crise perdue en silence, expiration forcée correcte ;
- 6 anciennes sauvegardes rejouées ;
- aucune décision scénarisée de Carrière perdue (38 défis × 2 graines) ;
- 0 file vide ou bloquée.

L'équivalence stricte avec l'ancien sélecteur ne s'applique plus : elle reste disponible avec `--compare` à la révision du lot 1.

Les 8 suites `tests/*.test.js` passent. Dans Chromium, la page se charge sans erreur ; le diagnostic est muet sans drapeau et actif avec `?narrativeDebug=1`.

## Limites restantes

- **Indicateur « neutre ou positif ».** Il est atteint dans presque toutes les saisons, au lot 1 comme au lot 2, parce que la tonalité par règles classe la majorité de la banque en « neutre » (55 entrées négatives sur 284 hors enchères). Le mécanisme de probabilité minimale n'est donc éprouvé que par le test synthétique. Une tonalité saisie à la main serait plus fine.
- **Règles de thème.** Quelques classements discutables, par exemple « Grand Marathon Caritatif » en commercial parce que sa description parle de publicité. Une table d'exceptions (`NARRATIVE_BANK_THEME_RULES` en tête) permettrait de les corriger sans toucher aux entrées.
- **Crises facultatives.** Elles atteignent 20,0 %, en bas de la cible : `sourceWeight.crisis` ou la part des crises de la banque peuvent être relevés si l'on veut plus de tension.
- **Thème « droits ».** Il pèse 25 % des rendez-vous. Ce sont des obligations de calendrier (enchères), hors de portée de la diversité par construction.
- **Fréquences des sources.** Elles s'écartent un peu du lot 1 (démarchage + 6 points, histoires + 6 points, mise en concurrence − 4 points) : les garde-fous de thème déplacent une partie des tirages.
