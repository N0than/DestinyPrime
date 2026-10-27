# Plan de relance d'un programme en baisse (v2.0)

Mise en œuvre de la spécification « Système de dilemmes Programme en baisse v2.0 » dans le moteur d'histoires existant (`index.html`). Aucune nouvelle interface ; aucun nouvel état persistant hors de l'arc et de la mémoire des programmes.

## Ce qui est en place

| Spec | Mise en œuvre |
|---|---|
| Arc `relance` à 3 étapes | `NARRATIVE_ARCS.relance` (`composed: true`). L'arc garde son régime, la gravité et l'usure à l'ouverture. |
| Gravité 0–6, 4 composantes | `relanceGravity` (persistance, profondeur, usure ≥ 60, pression), appelée dans `programStoryContext`. Gravité nulle hors forme `difficulte`. |
| Régimes | Alerte 1–2, Crise 3–4, Urgence 5–6, figés à l'ouverture. |
| Économie | `relanceScale` : prix selon la valeur de la case (0,5–1,1), promesse selon la santé du contenu × lassitude de la case × crédibilité × antenne. Inaction : −1,5 × gravité. Plafond : 0,25 du coût annuel. |
| Jauges séparées | `relanceGauges` lit le journal des programmes : `antennaFatigue` (2 saisons, 0,25 par autopromo, × 2 si martelée), `promoCredibility` (échecs nets sur 4 saisons), plans promo récents sur la case. `wear` reste l'usure du contenu. |
| Issues pondérées | `relanceOdds` (succès borné de 10 à 85 %). Probabilités figées dans la carte (`uncertain.odds`, modèle `pondere`). Tirage unique par `resolveStoryOutcome`, avec la graine de campagne, donc identique après rechargement. |
| Étude d'audience | Option à 0,02 en Alerte et en Crise. Pronostic sans chiffre (favorable, incertain, défavorable) et cause dominante, sur les cartes suivantes de l'arc. |
| Composition | `composeRelanceStories(ctx)` : 3 ouvertures, 12 déroulés (4 branches × 3 issues), 1 diagnostic, 2 bilans. Textes dans `RELANCE_TEXTS` ; montants, probabilités, options et jauge nommée sont calculés par la composition. Voie principale : appelée pour toute case dans `programStoryCandidates`. |
| Identifiants | `gs_relance_<étape>_<branche ou régime>[_<issue>]`, jamais dérivés de la gravité. |
| Conditions | `gravityMin` / `gravityMax` dans `programStoryMismatch`. |
| Situation | Clé `relance` réservée dans `STORY_SITUATION_KEYS` (`ps_p393_retour_soiree`, histoire propre prioritaire). |
| Correctif | `ps_p393_retour_soiree` : `form: 'struggle'` → `'difficulte'`. |
| Arrêt programmé (Urgence) | Économie de 0,15 ; le programme finit la saison à l'antenne puis quitte la grille (`stopped`, `end`). |
| Bascule vers la refonte | Un choix d'étape qui ouvre la refonte clôt d'abord le plan (`storyArcApply`). |

Tous les paramètres sont dans `RELANCE_TUNING`.

## Écarts à la spec, et pourquoi

1. **Persistance de la gravité.** Elle compte les saisons difficiles consécutives déjà closes, hors celle qui fonde le constat quand la difficulté vient de l'écart de la dernière saison. Sinon, une 1re saison difficile à ratio 0,85 (recette a) compterait déjà un point de persistance, puisque la forme `difficulte` à 0,85 vient justement de cette saison.
2. **L'étude ne fait pas perdre de saison.** Son diagnostic est inséré juste après elle, dans la même saison, par le même mécanisme que l'arbitrage des renouvellements au cas par cas. L'arc s'ouvre alors à l'étape 0 : étude → diagnostic, puis déroulé et bilan comme sans étude. Sans ce choix, l'étude retardait toute action d'une saison et perdait face à toutes les stratégies fixes.
3. **Diagnostic en Alerte.** Après une étude, la carte de diagnostic propose aussi la campagne en ligne et le renfort. L'étude sert à orienter vers la bonne branche, y compris le renfort quand le public se lasse.
4. **Renfort éditorial.** L'usure retirée est proportionnelle à l'usure présente : nulle à 20, pleine (−12) à 60. Après un renfort, le bonus durable de consolidation suit la même proportion (au moins 20 % de 0,05). Avec −12 fixe, le renfort dominait partout, contenu frais compris, contrairement aux critères de la section 9.
5. **Promesse de base : 0,12** au lieu de 0,08 (calibrée). À 0,08, une campagne réussie sur un contenu frais rapportait moins que le renfort.
6. **Autopromo martelée ou antenne saturée (≥ 0,5).** L'issue `recul` ôte 0,25 × la promesse (« Trop vue, l'autopromo agace »), comme le module d'exemple de la section 8.
7. **Formule allégée.** En trésorerie négative, toute campagne payante passe en formule allégée. Le plafond de 0,25 est sous le seuil d'achat lourd (0,3), ce qui rendait la recette (c) impossible.
8. **Bilan.** La consolidation est aussi retenue si la case n'est plus en difficulté (gravité 0). Sinon, un plan ouvert en Alerte à gravité 1 ne pouvait jamais consolider.
9. **Facteur d'inventaire.** Le taux de remplissage des écrans n'est pas modélisé : facteur fixe 0,7.
10. **Lisibilité.** Les lignes de contexte des histoires sont masquées (demande antérieure). La jauge qui pèse le plus est donc nommée dans la description de la carte, et la cause d'un échec dans le texte de l'issue.
11. **Affichage des probabilités.** Les probabilités sont inscrites dans la carte, mais les intitulés n'affichent que le libellé (demande antérieure). L'estimation n'apparaît qu'avec l'issue, comme au lot 4.
12. **Urgence, « plus forte probabilité de déprogrammation ».** Attendre en Urgence use le contenu (+4), ce qui rapproche l'arbitrage de fin de carrière du programme.
13. **Fatigue de l'équipe.** Abandonnée : pas de variable de moral.

## Vérifications

**Tests.** `tests/relance.test.js` couvre :
- la gravité, sur les 6 cas types et les bornes ;
- l'économie et les probabilités des cas A et B de la spec ;
- la recette a–j ;
- l'étude et le diagnostic dans la saison ;
- la consolidation après renfort, la résolution anticipée ;
- la collecte (poids 1,2), les modules et les identifiants.

Les 15 fichiers `tests/*.test.js` sont OK. Deux tests anciens supposaient que tout arc vient de la banque statique : ils exceptent désormais l'arc composé.

**Simulation d'équilibrage** (`tests/relance.sim.js`, `simulation.txt`). Elle suit le protocole de la section 9 : cases en déclin tirées au hasard, 5 stratégies, 4 saisons, sur le moteur du jeu (cartes, coûts, tirages, carrière, audience). Résultats sur 10 000 cases : voir `simulation.txt` et la synthèse ci-dessous.

(Synthèse ajoutée à la fin du calcul de 10 000 cases ; sur 1 000 cases : aucune stratégie fixe ne domine partout, renfort meilleur sur contenu usé, promotion meilleure sur contenu frais, « toujours autopromo » pire stratégie active sur une grille, étude ×1,17 face au renfort.)

**Parties réelles** (`tests/narrative-arcs.sim.js`, `arcs.txt` : 2 graines × 60 saisons × 6 formats, choix aléatoires) :
- 53 plans de relance ouverts, 43 % résolus ;
- 0 anomalie d'issue, 0 texte incomplet, 0 file vide, bloquée ou en erreur ;
- collectes pures (aucun tirage ni écriture).

Le simulateur accepte désormais les bornes propres au modèle pondéré, et ne compte plus le diagnostic d'étude comme une seconde histoire du programme dans la saison.

**File narrative** (`tests/narrative-queue.sim.js 40`) : pureté (613 contrôles), crises, anciennes sauvegardes et files sans écart.

**Captures** : `relance-carte-*.png`, `relance-issue-*.png`, sur ordinateur et mobile, sans défilement horizontal.

## Limites

1. **Poids 1,2.** Sur 720 saisons de parties réelles :
   - histoires jouées : de 358 à 397 ;
   - histoires propres au titre : de 211 à 177 (−16 %) ;
   - arcs de refonte : de 29 à 18, car le plan saisit les programmes en déclin plus tôt.

   Si le plan doit moins « écraser le reste », il faut baisser `RELANCE_TUNING.weight` (0,6 le met au niveau des autres ouvertures génériques).
2. **Le renfort reste la meilleure stratégie fixe en moyenne**, notamment sur un contenu usé, ce qui est voulu. Il coûte en revanche environ deux fois plus qu'une campagne sur l'horizon de simulation. La promotion ne gagne que sur un contenu frais.
3. **Simulation réduite.** La part de la case est rapportée à sa part de départ pour fixer le profil de déclin. Les autres histoires et les concurrents ne réagissent pas pendant les 4 saisons.
4. **Lien avec un futur dilemme de lancement.** Les jauges (`relanceGauges`) sont prêtes à être partagées, mais ce dilemme n'existe pas encore.
