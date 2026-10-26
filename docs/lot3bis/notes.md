# Consolidation du lot 3 avant le lot 4

Ce correctif ne touche ni l'interface, ni les poids des sources, ni le tirage. Il n'ajoute aucune issue aléatoire.

Fichiers de résultats :

| Fichier | Contenu |
|---|---|
| `arcs-avant.txt` | Simulation des arcs sur `54deb70` (lot 3), mêmes graines et mêmes règles |
| `arcs-apres.txt` | La même simulation sur la version consolidée |
| `diversite-vs-lot3.txt` | Contrôles de diversité comparés au lot 3 |
| `file-apres.txt` | Contrôles de la file du lot 1 (pureté, crises, anciennes sauvegardes, renouvellements) |
| `situations.txt` | Clés de situation et histoires sans clé à examiner |

## 1. Audit : causes des écarts observés

La simulation est instrumentée de l'extérieur (`tests/narrative-arcs.sim.js`, option `--rev`). Elle sépare, pour chaque arc :

- les ouvertures **éligibles** : une ouverture était candidate ;
- les ouvertures **proposées** : une ouverture figurait dans la file ;
- les arcs **ouverts** ;
- les occasions de suite, les suites proposées et les suites jouées ;
- les clôtures, par cause.

Elle relève aussi le motif d'exclusion de chaque ouverture générique non candidate. Le diagnostic appelle `genericStoryCheck`, ou sa reconstitution sur l'ancienne version. Il est vérifié pur : aucun tirage, aucune écriture.

| Écart | Cause mesurée sur `54deb70` | Nature |
|---|---|---|
| 1 seul jury en 3 600 saisons | 164 ouvertures éligibles, 1 proposée. L'éligibilité reposait sur le genre « talent / cuisine » : 15 554 exclusions pour le genre, et les magazines de recettes comptaient comme des concours. Sur les vrais concours (prime généraliste), le titre a ses propres histoires. L'ouverture générique, qui partage le poids d'une histoire générique, est donc rarement tirée. | Construction (éligibilité fausse) + éligible non retenu |
| 1 seule riposte | 4 ouvertures éligibles. La condition `pressure` (pénalité de concurrence ≥ seuil) écarte 13 062 cas. Les histoires propres « rival / duel / bataille » n'ouvraient aucun arc. | Condition rare + défaut de construction (aucun lien titre → arc) |
| 28 % d'arcs expirés | 67 expirations, **toutes** après des suites devenues éligibles mais non retenues ; aucune « sans suite ». Deux causes : le malus de récence d'entité (×0,5) frappait chaque suite, puisque l'ouverture venait de solliciter le même programme ; le drapeau posé par le choix d'ouverture n'était pas rattaché à l'arc. | Défaut de pondération + suivi |
| 47 % d'histoires génériques | 82 % de ces histoires sont jouées sur des programmes qui ont encore des histoires propres jouables sur d'autres situations. Le poids des ouvertures génériques croissait avec le nombre de définitions applicables : plusieurs ouvertures à 0,6 chacune face à une histoire propre à 1. | Poids de source mal partagé |
| Jury proposé à des magazines de recettes | Genre `cuisine` pris pour la présence d'un jury (p003 « Cuisine & recettes »). | Construction |
| Clés manquantes ou fausses | Clés déduites de l'identifiant par expressions régulières. /animat/ prenait les films d'animation, /cout/ « couture », /duree/ « film trop long », /candidat/ « villes candidates », /finale/ des archives. | Construction |
| Un seul arc testé | Le test du lot 3 ne déroulait que l'arc jury, sur un programme choisi par genre. | Couverture de test |

Le cas du digital est particulier. Il exige une plateforme **et** des droits d'exploitation (programme produit ou coproduit). C'est une condition rare dans la simulation : une partie sur trois a une plateforme, et la plupart des programmes signés sont sous licence. Rien n'est à corriger.

## 2. Corrections (`index.html`)

### Cohérence éditoriale : capacités

`programCapabilities(contract)` établit 7 capacités :

| Capacité | Sens |
|---|---|
| `jury` | Concours départagé par un jury |
| `candidates` | Candidats suivis jusqu'à une finale |
| `host` | Présentation incarnée |
| `shoot` | Tournage commandé |
| `serial` | Fiction à suivre |
| `film` | Film unitaire |
| `liveSport` | Direct sportif |

Leurs sources :

- **Données structurées.**
  - `host` : format jeu, divertissement ou magazine, sauf la liste `noHost` des dispositifs sans présentateur (p018, p293, p451).
  - `liveSport` : `isSportsProgram`.
- **Listes explicites centralisées** (`PROGRAM_CAPABILITY_LISTS`) pour ce que les données ne disent pas : `jury`, `candidates`, `shoot`, `serial`, `film`. En cas de doute, le programme n'est pas listé et l'histoire qui exige la capacité est exclue.
- **Formats originaux.** Le concept choisi à la création fixe les capacités (`ORIGINAL_CONCEPT_CAPABILITIES`). Une télé-réalité originale reçoit `candidates` et `shoot`, sans `jury`.

`requires` les exige :

| Histoire générique | Exigence |
|---|---|
| Jury (4 définitions) | `jury`, à la place du genre |
| Animateur (3) | `host`, à la place du genre |
| Surcoût (3) | `shoot` |
| Départ de candidat, finale | `candidates`, à la place du genre |
| Suite de fiction | `serial` |
| Droits de film | `film` + `rights` |
| Invité | `host` |
| Dispositif sportif | `liveSport` |

Ces exigences produisent les exclusions demandées :

- pas de jury pour un magazine de recettes ;
- pas de départ de candidat sans compétition ;
- pas de présentateur nommé sans talent compatible : l'option reste soumise à `needs: 'talent'` ;
- pas de suite de fiction pour un film unitaire ;
- pas d'exploitation numérique sur la seule plateforme : il faut aussi `owned` ou `coproduction` ;
- aucun état pour les acteurs non suivis, inchangé.

Les capacités n'augmentent pas la pertinence (`programStoryRelevance`) : ce sont des conditions de vraisemblance, pas de contexte.

### Clés de situation

`STORY_SITUATION_KEYS` est une table explicite et la **seule** source des clés : 69 histoires, 12 situations, chacune vérifiée sur son texte. Les anciennes expressions régulières restent pour le diagnostic seulement (`storySituationHint`, `storySituationReport`). Elles signalent 84 histoires sans clé à examiner, sans rien rattacher automatiquement (voir `situations.txt`).

La fenêtre de 4 saisons ne s'applique qu'aux situations initiales. Une **continuation** (condition `flag` ou `after`) n'est jamais une répétition : elle reste jouable après la variante générique de la même situation.

### Liens titre → arc (`SPECIFIC_ARC_LINKS`)

L'association est explicite, choix par choix. L'histoire garde son texte et ses effets ; l'arc n'ajoute aucun effet. Le rappel est la décision réelle.

- L'ouverture n'a lieu que si l'arc a de la place (`storyArcCapacity` : plafond par programme, arc pas déjà ouvert, plafond par chaîne), si les ressources exigées existent et si les variables du rappel sont disponibles. Sinon, l'histoire se joue normalement, sans arc.
- Une **étape propre au titre** passe avant les suites génériques du même arc et le fait avancer ou le clôt.

### Pondération et suivi

- Les ouvertures génériques d'un programme se partagent `genericWeight` : leur poids ne croît plus avec le nombre de définitions. Les suites gardent `followUpWeight`. Aucun paramètre n'est modifié.
- Une suite d'arc n'a plus le malus de récence d'entité (`continuesArc`).
- Le drapeau du choix d'ouverture est rattaché à l'arc qu'il ouvre : il est retiré à la clôture.
- `genericStoryCheck` renvoie le motif d'exclusion. `programStoryMismatch` détaille les conditions ; `programStoryMatches` en est un enrobage.
- Le sélecteur note les saisons où une suite était éligible (`noteStoryArcOccasions`, sans effet sur le tirage). À l'expiration, `closeCause` vaut :
  - `non_retenue` : suites éligibles non retenues ;
  - `sans_suite` : aucune suite devenue éligible.

## 3. Avant / après par arc

5 graines × 120 saisons × 6 types, mêmes règles. Les dénominateurs sont donnés entre parenthèses.

| Arc | Version | Ouvertures éligibles | Proposées | Ouverts (titre) | Occasions de suite | Suites proposées | Suites jouées | Résolus (/ouverts) | Expirés sans suite | Expirés non retenus | Abandonnés | Ouverts en fin | Cohorte résolue (/cohorte) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| jury | avant | 164 | 1 | 1 (0) | 1 | 1 | 1 | 1 (1) | 0 | 0 | 0 | 0 | 1/1 |
| jury | après | 100 | 1 | 1 (0) | 3 | 0 | 0 | 0 (1) | 0 | 1 | 0 | 0 | 0/1 |
| animateur | avant | 1 403 | 41 | 18 (0) | 30 | 3 | 2 | 2 (18) | 0 | 3 | 3 | 10 | 2/4 |
| animateur | après | 3 272 | 116 | 51 (2) | 105 | 27 | 24 | 24 (51) | 0 | 12 | 4 | 11 | 16/27 |
| refonte | avant | 3 079 | 262 | 168 (0) | 428 | 113 | 100 | 60 (168) | 0 | 48 | 16 | 44 | 47/99 |
| refonte | après | 3 257 | 213 | 131 (0) | 291 | 127 | 115 | 71 (131) | 0 | 23 | 10 | 27 | 49/70 |
| offensive | avant | 4 | 1 | 1 (0) | 3 | 0 | 0 | 0 (1) | 0 | 1 | 0 | 0 | 0/1 |
| offensive | après | 10 | 3 | 2 (0) | 4 | 4 | 4 | 2 (2) | 0 | 0 | 0 | 0 | 1/1 |
| surcout | avant | 3 062 | 85 | 47 (0) | 101 | 11 | 11 | 11 (47) | 0 | 15 | 8 | 13 | 4/17 |
| surcout | après | 422 | 11 | 8 (0) | 18 | 5 | 3 | 3 (8) | 0 | 2 | 0 | 3 | 1/1 |
| digital | avant | 146 | 7 | 2 (0) | 4 | 0 | 0 | 0 (2) | 0 | 0 | 1 | 1 | 0/1 |
| digital | après | 125 | 9 | 5 (0) | 6 | 3 | 3 | 3 (5) | 0 | 0 | 2 | 0 | 3/4 |
| **total** | avant | 7 858 | 397 | 237 (0) | 567 | 128 | 114 | 74 (31 %) | 0 | 67 (28 %) | 28 | 68 | 54/123 (44 %) |
| **total** | après | 7 186 | 353 | 198 (2) | 427 | 166 | 149 | 103 (52 %) | 0 | 38 (19 %) | 16 | 41 | 70/104 (67 %) |

Définitions des colonnes :

- **Ouvertures éligibles** et **proposées** : comptées par couple (saison, programme), une fois par saison.
- **Occasions de suite** : une par (saison, arc ouvert), sans les gonfler par le nombre de définitions candidates.
- **Ouvertures** et **suites** sont comptées séparément.
- **Cohorte** : arcs ouverts au moins `maxDuration` + 1 saisons avant la fin de la partie. Leur échéance est passée, leur issue est donc définitive.

Lecture :

- **Les expirations ne viennent jamais d'une suite inaccessible**, avant comme après. Le malus de récence levé, les suites proposées passent de 23 % à 39 % des occasions, et 67 % de la cohorte est résolue (44 % avant).
- **Surcoût.** La baisse (3 062 → 422 ouvertures éligibles) est voulue. Elle vient de la capacité `shoot` (3 209 exclusions) : fictions achetées et émissions sans tournage commandé, où un surcoût de tournage n'a pas de sens.
- **Jury.** Seuls 11 programmes du catalogue ont un jury. La simulation garnit la grille au hasard parmi les programmes de la case et du type de chaîne, donc ils y sont rares. L'arc est atteint et testé jusqu'à sa résolution dans les scénarios déterministes.
- **Offensive** reste rare, puisque sa condition est rare (`pressure` : 11 461 exclusions). Ses ouvertures doublent pourtant, et ses deux arcs sont résolus.
- **Ouvertures par le titre** (2 en simulation). La simulation choisit uniformément parmi les options : un lien sur un seul choix sur trois, sur une histoire unique parmi plusieurs centaines, s'ouvre rarement. Les liens existent pour la cohérence (pas de doublon titre / générique), pas pour le volume.

### Paramètre d'attente : non modifié

Un bonus d'attente borné sur les suites aurait réduit les 38 expirations « non retenues ». Il ne garantit rien, il augmenterait un poids pour viser une fréquence, et une suite non retenue reste une issue narrative plausible (le fil s'éteint). La levée du malus, qui était un défaut, suffit à faire passer la cohorte résolue de 44 % à 67 %. Aucun paramètre de `NARRATIVE_TUNING` n'a été modifié.

## 4. Part des histoires génériques

Elle passe de 46,7 % à 41,1 % : 725 sur 1 765 histoires, contre 833 sur 1 785. Répartition après correction :

| Catégorie | Avant | Après |
|---|---:|---:|
| Programme dont des histoires propres restent jouables sur d'autres situations | 685 (82,2 %) | 590 (81,4 %) |
| Programme dont toutes les histoires propres sont épuisées | 107 (12,8 %) | 110 (15,2 %) |
| Programme sans histoire propre (installé par un dilemme, hors catalogue) | 41 (4,9 %) | 25 (3,4 %) |
| Format original | 0 | 0 |

Le premier poste est structurel. Les histoires propres d'un titre ont des conditions (forme, ancienneté, drapeau) qui ne sont pas toujours remplies. Une variante générique d'une **autre** situation peut alors légitimement jouer. La priorité du titre n'a jamais été violée : 0 générique jouée alors qu'une histoire propre de la même situation était éligible. Le poids des génériques n'a pas été réduit arbitrairement ; seul son partage par programme a été corrigé. Aucun format original n'apparaît, car la simulation ne crée pas de formats.

## 5. Associations titre → arc

| Histoire | Choix → arc / branche |
|---|---|
| `ps_p032_jury` (MasterCuisto) | 1 « jeune cheffe » → jury / remplace |
| `ps_p032_jury_suite` | étape 2 du jury : 0, 1, 2 → clôture |
| `ps_p489_jure` | 2 → jury / remplace |
| `ps_p020_animatrice` | 1 → animateur / externe |
| `ps_p227_presentateur` | 1 → animateur / interne |
| `ps_p034_refonte` | 0 → refonte / complete ; 1 → refonte / retouche |
| `ps_p034_refonte_suite` | étape 2 de la refonte : 0 → avance ; 1, 2 → clôture |
| `ps_p489_relance` | 0 → refonte / complete |
| `ps_p034_duel` | 0, 2 → offensive / riposte ; 1 → attente |
| `ps_p001_bataille` | 0 → renfort ; 1 → attente ; 2 → riposte |
| `ps_p012_rival_apres_midi` | 0, 1 → riposte ; 2 → attente |
| `ps_p025_quiz_rival`, `ps_p106_face_magazine_rival` | 0 → renfort ; 1 → attente ; 2 → riposte |
| `ps_p052_serie_coute_trop` | 1 → surcoût / absorbe |
| `ps_p020_numerique`, `ps_p008_…`, `ps_p131_…`, `ps_p214_…`, `ps_p476_…` | 0 → digital / exclusif, si plateforme et droits |

Périmètre : seules les histoires dont le texte décrit la même situation initiale qu'un arc, et dont le choix correspond à une branche existante, sont liées. Deux cas restent à part :

- `ps_p029_vieillissement` (fiction) porte la clé `refonte` mais n'ouvre pas d'arc : les suites de la refonte sont rédigées pour des émissions de plateau.
- Les histoires « surcoût » ou « numérique » dont les choix ne correspondent à aucune branche gardent leur clé, sans lien.

## 6. Tests et scripts

| Fichier | Contenu |
|---|---|
| `tests/story-arcs.test.js` (nouveau) | Voir le détail ci-dessous |
| `tests/genre-stories.test.js` | Le programme de l'arc complet est choisi parmi les concours à jury |
| `tests/narrative-arcs.sim.js` | Réécrit : tableau par arc, motifs d'exclusion, répartition des génériques, pureté, `--rev` |
| `tests/story-situations.report.js` (nouveau) | Diagnostic des clés |

`tests/story-arcs.test.js` couvre :

- clés et liens valides ;
- capacités positives et négatives : recettes, jeu quotidien, concours, docu-réalité, série, film, magazine de cinéma, magazine sportif, compétition, plateforme sans droits, format original ;
- les six arcs : ouverture, mémoire (décision, entité), délai, branche, évolution, résolution et nettoyage des flags ;
- l'expiration avec ses deux causes ;
- l'abandon avec la suite déjà dans la file ;
- les ouvertures par le titre (jury, présentation, refonte, riposte, digital) ;
- les options contextuelles, avec et sans la ressource : talent, partenaire, commande réductible, plateforme et droits, et leurs conséquences financières appliquées une seule fois ;
- les plafonds, y compris un choix du titre qui garde ses effets sans forcer l'arc ;
- la fenêtre de situation, en distinguant répétition et continuation ;
- la sérialisation JSON : état antérieur aux arcs, arc ouvert, suite déjà dans la file. Les identifiants, étapes et décisions sont conservés, aucun effet n'est réappliqué, aucune fonction n'est nécessaire.

Commandes :

```
for t in tests/*.test.js; do node $t; done
node tests/narrative-arcs.sim.js --rev 54deb70 --out docs/lot3bis/arcs-avant.txt
node tests/narrative-arcs.sim.js --out docs/lot3bis/arcs-apres.txt
node tests/narrative-queue.sim.js --out docs/lot3bis/file-apres.txt
node tests/narrative-diversity.sim.js --seeds 2 --seasons 150 --rev 54deb70 --out docs/lot3bis/diversite-vs-lot3.txt
node tests/story-situations.report.js --out docs/lot3bis/situations.txt
```

Contrôles conservés, tous à zéro :

- deux histoires du même programme dans une saison ;
- répétition avant délai ;
- textes incomplets ;
- files vides ou bloquées ;
- erreurs ;
- même arc ouvert deux fois ;
- collecte impure (3 702 collectes) ;
- obligations perdues ;
- renouvellements absents.

Les anciennes sauvegardes du lot 1 se rechargent et se jouent. La diversité est inchangée (thème dominant 43,9 %, crises facultatives 20,8 %).

## 7. Limites et avis sur le lot 4

Limites :

- Les listes de capacités sont manuelles (11 concours à jury, 26 à candidats, etc.). Un programme ajouté au catalogue sans y figurer n'aura pas ces histoires : c'est le choix « en cas de doute, exclure ».
- 84 histoires sans clé sont signalées à examiner. Les rattacher demande une relecture de leur texte.
- Les arcs jury et offensive restent rares en partie aléatoire. Leurs conditions sont rares (concours sur la grille, pression concurrentielle), et aucun poids n'a été relevé.
- La simulation choisit uniformément ; un joueur réel choisit autrement. Les fréquences sont des ordres de grandeur.

**Avis : prêt pour le lot 4.** Les six arcs s'ouvrent dans des situations vraisemblables et sont testés jusqu'à leur résolution. Leurs clôtures sont diagnostiquées par cause. La collecte reste pure, et l'état se sérialise sans perte. Le lot 4 (issues aléatoires) pourra s'appuyer sur `genericStoryCheck` et sur le suivi `occasions` / `closeCause` pour mesurer ses effets.
