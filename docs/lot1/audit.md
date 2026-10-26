# Lot 1 — Unifier la collecte des candidats

Ce document couvre l'audit (rédigé avant le code), les changements et les points d'intégration. Il donne aussi les paramètres et les limites restantes. Les résultats chiffrés sont dans `resultats-simulation.txt`, produit par `node tests/narrative-queue.sim.js 220 --out docs/lot1/resultats-simulation.txt`.

## 1. Audit des sources (révision de référence `6fdce0a`)

L'ancien `pickDilemmaQueue()` enchaînait toutes les sources. Chacune écrivait dans `gameState` au moment où elle était tirée, même si un dilemme placé plus tard l'écrasait ensuite.

| # | Source | Création | Conditions | Position | Écritures d'état (ancien code) | Nature |
|---|---|---|---|---|---|---|
| 1 | Banque (tirage de base) | `getEligibleDilemmas()` + `shuffle` | éligible, hors enchère, hors doublons du mercato ; non vus d'abord, récents en dernier | 0, 1, 2 | `seenDilemmaIds` (remis à zéro si la banque est épuisée, puis les 3 tirés ajoutés **avant** remplacement) ; `rememberDilemmas` (localStorage, les 3 tirés) | facultative |
| 2 | Droit diffusé (`requiresRight`) | même pool | droit diffusé cette saison, pas déjà tiré | 0 | `seenDilemmaIds` | obligatoire |
| 3 | Événement de campagne (`STORY_EVENTS`) | objet statique | `eligible(p)`, jamais vu | dernière | `eventsSeen` (écrit même si un renouvellement prend ensuite la dernière place) | obligatoire |
| 4 | Enchère de droits (`scheduleSportsAuction`) | dilemme de banque `sports_rights_auction` | droit annuel dû ou marché dû | 1 | ventes entre chaînes IA, `nextAuctionSeason`, `activeAuction = null` (flux `sportsRandom`) | calendrier |
| 5 | Opportunité régie | `createRegieOpportunityDilemma()` | `regieOpportunityEligible()` (pur), pas d'enchère | 1 | `lastRegieOpportunity` | facultative |
| 6 | Démarchage producteur | `pickProducerPitch()` + `createProducerPitchDilemma()` | saison ≥ 2, `seededRandom() < 0,5`, place remplaçable en 0 ou 1 | 0, 1 | `producerPitched` ; genre tiré par **`Math.random()`** | facultative |
| 7 | Mise en concurrence | `pickBiddingWar()` + `createBiddingWarDilemma()` | saison ≥ 2, pas de démarchage, tirage 0,35 (0,6 avec option) | 1, 0 | `biddingHistory` (entrée `pending`) ; genre tiré par **`Math.random()`** | facultative |
| 8 | Crise contextuelle | `updateCrisisWatch()` (début de saison) → `createCrisisDilemma()` | crise mûre, place remplaçable en 1 ou 0 | 1, 0 (jamais dernière) | `crisisWatch[key].queued` ; **`pendingCrisis = null` même si la crise n'est pas placée** | obligatoire |
| 9 | Histoires de programmes | `programStoryCandidates()` + `buildProgramStoryDilemma()` | tirage de fréquence, poids, 2e histoire possible | `PROGRAM_STORY_POSITIONS` selon la phase (1 : [0,1], 2 : [1,2,0], 3 : [2,1]) ; dernière place exclue si un renouvellement est dû | **`programStoryRecord()` crée la mémoire pendant la collecte** ; **retrait du dilemme remplacé de `seenDilemmaIds`** | facultative |
| 10 | Renouvellements | `withRenewalDilemmas()` | contrats, droits annuels, talents en fin de contrat | dernière place, puis à la suite | — | calendrier |
| 11 | Dilemmes dynamiques (`DYNAMIC_DILEMMAS`) | `materializeCurrentDilemma()` à l'affichage | `eligible()` de chaque entrée | celle du dilemme de banque | reconstruction du dilemme courant | — |
| 12 | Revalidation (`revalidateProgramStoryQueue`) | à l'affichage, avant l'application, à la matérialisation | histoire qui n'est plus à l'antenne, dynamique inéligible, surenchère caduque | entrée invalide | remplaçant : une histoire (sans contrôle de phase), sinon un générique (`seenDilemmaIds`) ; le retiré n'était jamais rendu | — |
| 13 | Signaux précurseurs de crise | `updateCrisisWatch()` | détecteurs (talent, trésorerie, ARCOM, dépendance, sous-financement) | — (signaux du bilan) | `crisisWatch`, `seasonSignals` — étape du monde, hors file | — |
| 14 | Mode Carrière | `careerShapeQueue()` après le tirage ; `careerReshapeQueue()` lors d'une signature | longueur imposée, `blockChoice`, `rule.queue`, décision d'ouverture | tête ou fin de file | `seenDilemmaIds` (remplissage) ; le dilemme coupé par la longueur imposée restait « vu » | obligatoire (scénarisé) |

### Hypothèses contredites par le code

- **Aucune sauvegarde de partie persistante.** `gameState` n'est jamais écrit en localStorage. Seuls la progression Carrière et la mémoire des dilemmes récents le sont. La règle « une ancienne sauvegarde doit se charger » est vérifiée en sérialisant en JSON un état de l'ancienne version en milieu de saison, puis en le rechargeant dans la nouvelle. Les dilemmes de banque ne sont alors plus les objets de `DILEMMA_BANK` mais leurs copies : leur source se retrouve désormais par l'identifiant.
- L'enchère de droits ne peut pas être collectée de façon pure. Le calendrier vend d'abord, entre chaînes IA, les droits hors de portée du joueur, et ces ventes changent l'enchère due. Ce calendrier reste donc une étape du monde (`resolveSportsAuction`, flux `sportsRandom`), jouée au même moment qu'avant. `collectSportsAuctionCandidates()`, elle, est pure et sert au diagnostic.
- Un droit diffusé déjà tiré par le hasard n'est pas remis en tête : c'est le comportement historique, conservé.

### Autres effets de bord relevés pendant la collecte

- `programStoryContext()` → `migrateProgramCareer()` : normalisation idempotente (`??=`, `status` recalculé à l'identique). Aucun écart JSON n'a été mesuré.
- Le genre du producteur était tiré par `Math.random()` à chaque appel de `producerPitchChoices()` sans genre fourni (valeur par défaut).
- `resetGame()` ne remettait pas `pendingCrisis` à zéro. C'était sans effet tant que l'ancien code l'effaçait à chaque tirage ; c'est corrigé, puisqu'une crise peut désormais attendre.
- Autres `Math.random()` dans la logique, hors périmètre du lot et signalés seulement :
  - `talentRetireSeason` (âge de retraite) ;
  - tri des noms proposés à la création ;
  - ordre des propositions de la conférence de rentrée (`generateSeasonKickoffProposal`) ;
  - graines initiales (`newCampaignSeed`, `marketSeed`, `sportsRights.seed`), ce qui est légitime ;
  - confettis (visuel).

## 2. Ce qui a changé (`index.html`)

### Structure de candidat commune

`narrativeCandidate(source, champs)` produit :

```
{ defId, instanceId, source, kind, theme, programId, talentId, rivalId, slot, phase,
  priority, weight, repeatGap, followsFrom, build(), validate(d), commit(d), release(d) }
```

- `theme` vaut la famille de l'histoire, sinon `null`.
- `validate`, `commit` et `release` passent par la table `NARRATIVE_SOURCES`. La source se retrouve à partir des données du dilemme (`narrativeSourceOf`), y compris pour une file sérialisée.

### Collectes pures

Aucune écriture ni aucun tirage :

- `collectBankCandidates`, `collectRightCandidates`, `collectCampaignCandidates` ;
- `collectSportsAuctionCandidates`, `collectRegieCandidates` ;
- `collectProducerCandidates`, `collectBiddingWarCandidates` ;
- `collectCrisisCandidates`, `collectStoryCandidates` ;
- `collectNarrativeCandidates()`, vue d'ensemble pour le diagnostic.

### Tirages séparés de la collecte

Ces fonctions tirent dans la même séquence `seededRandom` que l'ancien code :

- `drawProducerCandidate` ;
- `drawBiddingWar` et `drawBiddingWarCandidate` ;
- `placeProgramStories(plan, lastTaken)`.

`pickProducerPitch()` et `pickBiddingWar()` restent disponibles et utilisent la collecte puis le tirage.

### Sélecteur unique : `pickDilemmaQueue()`

Il traite les sources dans l'ordre de `NARRATIVE_PRIORITIES` sur un plan de positions, puis enchaîne :

1. **build**, dans l'ordre de la file, après tous les tirages de sélection ;
2. `withRenewalDilemmas()`, inchangé ;
3. **commit** (`narrativeFinalize`) : seuls les dilemmes présents dans la file finale sont engagés.

Un dilemme écrasé par une source prioritaire, ou par un renouvellement en dernière place, ne consomme rien : ni « déjà vu », ni mémoire récente, ni `eventsSeen`, ni démarchage, ni entrée `pending`, ni délai régie.

### Restitution (`release`)

- `narrativeReconcile(avant, après)` est appelé :
  - par `careerShapeQueue()` (dilemme coupé par la longueur imposée ou remplacé par une décision scénarisée) ;
  - par `refreshRenewalDilemmas()` (signature avant le premier dilemme) ;
  - un dilemme qui réapparaît est de nouveau engagé.
- `careerShapeQueue()` devient un enveloppeur de `careerShapeQueueRules()`, dont les règles sont inchangées.

### Revalidation généralisée : `revalidateNarrativeQueue()`

L'alias `revalidateProgramStoryQueue` est conservé.

- Elle est appelée avant l'affichage, uniquement sur les entrées à venir, avant l'application et à la matérialisation d'un dilemme dynamique.
- L'entrée invalide est rendue à sa source (`release`).
- Le remplaçant passe par le sélecteur, dans cet ordre :
  1. une histoire de même phase (si l'entrée retirée était une histoire), sinon une histoire dont les positions admettent cette place ;
  2. à défaut, un dilemme général valide et non vu ;
  3. à défaut, l'entrée est supprimée.
- Le remplaçant est ensuite engagé (`commit`).

### Bugs corrigés

- **`pendingCrisis`.** Une crise non placée reste en attente (`waitingSince`). Elle est reportée en priorité par `carryPendingCrisis()` au début de la saison suivante. Elle expire explicitement après `NARRATIVE.crisisMaxWait` saisons : le journal l'indique et `crisisWatch[key].expired` empêche qu'elle revienne tant que la vulnérabilité dure. Elle est abandonnée explicitement si la vulnérabilité a été corrigée.
- **`placeProgramStories()`** ne touche plus à `seenDilemmaIds`. Le dilemme remplacé n'a jamais été engagé.
- **`producerDraw()`** utilise `seededRandom()`. Le genre est tiré une fois au build et stocké dans le dilemme (`producerFem`, `war.producerFem`), qui est sérialisé. `producerPitchChoices()` ne tire plus rien : la valeur par défaut est « producteur ».
- **`pick()`** utilise `seededRandom()` : chaîne au hasard, nom de chaîne, nom en mode Carrière.
- **Mémoire des histoires.** La collecte la lit sans la créer (`programStoryRecordView`). Elle n'est créée qu'à l'application d'un choix.
- **`resetGame()`** remet `pendingCrisis` à zéro.

### Diagnostic

`NARRATIVE_DEBUG` est désactivé par défaut. On l'active avec `localStorage['audienceMasters.narrativeDebug'] = '1'` ou l'URL `?narrativeDebug=1`. `narrativeLog()` écrit en console, avec la saison et une raison :

- les candidats, les poids des histoires, les sélections et les remplacements ;
- les exclusions, les engagements et les restitutions ;
- les crises en attente, expirées ou abandonnées.

Rien n'apparaît dans l'interface.

## 3. Paramètres ajoutés

Ils sont centralisés en tête de la section « FILE NARRATIVE ».

| Paramètre | Valeur | Rôle |
|---|---|---|
| `NARRATIVE.queueSize` | 3 | dilemmes tirés par saison avant les renouvellements (valeur historique) |
| `NARRATIVE.crisisMaxWait` | 2 | saisons pendant lesquelles une crise sans place peut encore être proposée avant d'expirer |
| `NARRATIVE.debugStorageKey` / `debugParam` | `audienceMasters.narrativeDebug` / `narrativeDebug` | activation du diagnostic |
| `NARRATIVE_PRIORITIES` | table commentée | ordre de traitement, nature et positions permises par source |
| `NARRATIVE_SOURCES` | table | validation, engagement et restitution par source |

## 4. Divergences assumées avec l'ancien sélecteur

1. **Genre du producteur.** Un tirage `seededRandom` de plus par démarchage ou mise en concurrence construit. Il a lieu après tous les tirages de sélection, donc la file de la saison est identique. Seule la graine de fin diffère, et elle est vérifiée « au tirage du genre près ».
2. **Dilemmes écrasés.** Ils ne sont plus marqués « vus » ni mémorisés comme récents, conformément au lot. Les tirages des saisons suivantes s'écartent donc progressivement d'une partie jouée avec l'ancien code. La comparaison se fait à état d'entrée identique, tirage par tirage.
3. **Événement de campagne écrasé par un renouvellement.** Il n'est plus consommé : il reviendra une saison suivante, alors que l'ancien code le perdait.
4. **Revalidation.** Le remplaçant d'une histoire respecte désormais sa phase. Si aucune histoire compatible n'existe, le repli sur un générique change la consommation de `seededRandom` dans ce cas rare.
5. **Crise non placée.** Elle reste en attente au lieu d'être effacée. Dans la simulation, la moitié des crises mûres ne trouvaient pas de place à leur première saison.

## 5. Limites restantes

- Les autres `Math.random()` de logique listés plus haut ne sont pas corrigés : ils sont hors périmètre et changeraient les séquences d'autres systèmes.
- `pickDilemmaQueueLegacy` n'est pas dans le jeu. Elle est extraite à la volée de la révision `6fdce0a` par le script de vérification, ce qui nécessite git.
- Le calendrier des droits sportifs reste une étape du monde avec ses propres écritures, jouée au moment historique.
- Le test « ancienne sauvegarde » simule une sérialisation JSON, faute de système de sauvegarde dans le jeu.
