# Approches de chaînes concurrentes et changement de direction

## Règles retenues

### Calendrier (`CHANNEL_APPROACH`)

- Aucune approche avant 3 saisons terminées. La première évaluation a lieu après la saison 3, plus une attente tirée de 0 à 3 saisons.
- Chaque évaluation examine les 3 dernières saisons dirigées dans la chaîne actuelle.
- Attentes :
  - 1 à 2 saisons après une évaluation sans offre ;
  - 2 à 3 saisons après un refus ;
  - 3 à 4 saisons complètes après un changement de chaîne.
- Tous les tirages passent par `stableRandom` (graine de campagne + clé), sans `Math.random`. Chaque évaluation est mémorisée dans `director.approach.evaluated[saison]` : un rechargement ne retire rien.
- L'évaluation est reportée d'une saison :
  - pendant une saison de renouvellement de convention ;
  - tant qu'un scénario de carrière est actif (sans consommer l'évaluation).
- Aucune offre en faillite ni avec l'autorisation retirée.

### Éligibilité : deux voies indépendantes

**Audience** (score de 0 à 1) :
- progression absolue ou relative de la PDA 4+ et de la PDA cible ;
- gain de rangs au classement 4+ ;
- leadership durable (1er, ou top 2) sans recul de plus de 1,5 pt.

**Rentabilité** :
- résultat d'exploitation positif au moins 2 saisons sur 3 ;
- marge moyenne ;
- amélioration du résultat ;
- trésorerie saine.

Le résultat d'exploitation se calcule ainsi : recettes publicitaires définitives + recettes commerciales − recettes exceptionnelles − coût de grille − achats. Les apports d'actionnaire, les distributions et les ventes de format (recettes exceptionnelles) sont exclus. Si la PDA 4+ s'effondre (−30 % en relatif), le score de rentabilité est divisé par 2.

**Score retenu** : le meilleur des deux scores, plus un bonus limité (+0,15) si les deux voies réussissent.
- Éligibilité à partir de 0,55.
- Probabilité d'offre : de 12 % au seuil à 40 % au score maximal, modulée par la réputation (×0,75 à ×1,25, plafond 80 %).
- Après un mandat échoué, la probabilité est réduite de moitié pendant 4 saisons.

### Offre

- Elle émane d'une des 5 chaînes réelles, tirée au sort selon un poids qui combine :
  - la situation de la chaîne (en recul, en perte, solide) ;
  - l'adéquation entre son besoin et votre parcours ;
  - le contraste avec votre chaîne actuelle.
- Quatre motifs possibles : audience, maîtrise des coûts, relance, cap actionnarial. Une seule offre active à la fois.
- L'offre est figée dans un instantané sérialisable ; rien n'est recalculé à l'affichage.
- Elle apparaît au bilan de saison (encart « Proposition de poste »), puis sur l'écran « UNE AUTRE CHAÎNE VOUS VEUT AUX COMMANDES » (étape 12). L'écran montre :
  - le profil de la chaîne, sa cible, ses audiences et son classement ;
  - les comptes de la saison close et sa trésorerie après clôture et distributions ;
  - ses engagements ;
  - le prévisionnel de la saison suivante ;
  - les 4 lignes distinctes : trésorerie héritée, apport, dépenses déjà engagées, marge disponible ;
  - une comparaison avec votre chaîne actuelle ;
  - le détail de sa programmation (coûts, échéances), de ses talents et de ses droits sportifs.
- Refuser n'a aucune conséquence cachée : seule l'attente de 2 à 3 saisons s'applique. Une offre encore en attente au lancement de la saison suivante vaut refus.
- L'apport d'actionnaire est optionnel, plafonné à 30 % du capital de départ du format, et réservé à une chaîne en difficulté. Il est crédité une seule fois, hors résultat.

### Mandat de 3 saisons

- Quatre mandats possibles : développer, rentabilité, consolider ou relancer.
- L'objectif est mesurable, sur un état de départ figé :
  - gain de PDA sur la cible ;
  - maintien de la PDA ;
  - résultat positif.
- Le mandat est jugé à la clôture de sa dernière saison, uniquement sur les saisons dirigées dans la chaîne.
  - Succès : réputation +10.
  - Échec : réputation −10 et approches plus rares pendant 4 saisons.
- Ni licenciement ni nouvelle condition de fin.

### Transfert (`acceptChannelOffer`)

**Calendrier** : le transfert a lieu après la clôture et avant l'ouverture de la saison suivante.

**Chaîne rejointe** : elle est convertie aux structures du joueur et garde tout :
- son identité et sa trésorerie (`budget` devient `tresorerie`) ;
- ses audiences ;
- ses contrats, avec leur coût annuel et leur échéance ;
- ses talents et ses droits sportifs ;
- sa politique d'actionnaire (austérité en cours, apports) ;
- son historique, archivé dans `aiArchive`.

**Ancienne chaîne** : elle passe à l'IA avec tout son actif.
- Ses contrats sont gardés tels quels jusqu'à leur échéance (`powerModel: 'player'`) ; ensuite, l'IA renouvelle ou remplace selon ses règles.
- Sa trésorerie devient `budget`.
- Son grand livre est reconstruit à partir de l'historique de la partie (`directedByPlayer`).

**Neutralité** : aucun droit d'entrée, remboursement, crédit de recettes ou bonus d'audience supplémentaire, et aucune charge ne disparaît. La grille de la chaîne rejointe est facturée à l'ouverture suivante, comme pour toute chaîne.

**Atomicité** : l'état est sauvegardé, puis les deux conversions sont validées (`validateTransfer`) :
- 6 chaînes, avec les mêmes noms ;
- trésoreries conservées (plus l'apport) ;
- contrats échangés à l'identique ;
- talents et droits sportifs conservés ;
- audiences inchangées ;
- aucun programme dupliqué par le transfert.

À la moindre anomalie, l'état initial est restauré et l'offre reste consultable avec le motif. L'offre est consommée à l'acceptation, ce qui empêche une double acceptation ou un double apport.

**Identité et historique** :
- Identifiants de chaîne stables (`channelId`).
- La carrière du dirigeant (`gameState.director` : réputation, transferts, mandats) est distincte de l'historique des chaînes (`h.perf` par saison, avec le nom de la chaîne dirigée).
- Les histoires restent attachées à leur chaîne.

**Compatibilité** : une ancienne sauvegarde reçoit des valeurs par défaut (`ensureDirector`). Aucun historique n'est inventé et aucune offre rétroactive n'est émise : seules les saisons clôturées après la mise à jour comptent.

## Paramètres centralisés

Tous les paramètres sont dans `CHANNEL_APPROACH`, juste avant `competitorTreasuryTarget` dans `index.html`. Les motifs et les mandats sont dans `APPROACH_MOTIVES` et `DIRECTOR_MANDATES`.

Calibrage par simulation :
- **Premier passage** : seuil 0,5, leadership 0,8, marge de référence 0,2, probabilité de 30 à 65 %. Résultat : 56 % d'évaluations éligibles et des offres trop fréquentes (plus de 3 par carrière pour un joueur économe).
- **Retenu** : seuil 0,55, leadership 0,7, top 2 0,55, marge de référence 0,4, probabilité de 12 à 40 %.

## Résultats

**Tests** : les 14 fichiers `tests/*.test.js` sont OK. Le nouveau `tests/channel-approach.test.js` couvre :
- le calendrier et l'éligibilité par chaque voie ;
- le leader stable, le contexte d'effondrement et la trésorerie malsaine ;
- l'exclusion des apports et des recettes exceptionnelles ;
- le tirage mémorisé et le rechargement ;
- les attentes et le refus ;
- le transfert complet :
  - 6 chaînes ;
  - trésoreries, audiences, contrats, talents, droits sportifs, engagements ;
  - grille facturée une fois ;
  - recettes identiques ;
  - historique ;
  - sauvegarde et rechargement ;
- l'atomicité et l'apport versé une seule fois ;
- l'ancienne chaîne sous IA ;
- le mandat ;
- la garde du mode carrière ;
- les anciennes sauvegardes.

**Simulation** : `tests/channel-approach.sim.js`, résultats dans `simulation.txt`. Elle couvre 6 formats × 3 politiques × 3 graines × 30 saisons, soit 54 carrières et 1 350 saisons.
- 50 % des évaluations sont éligibles et 14 % donnent une offre.
- Première approche entre S4 et S28 ; médiane S7 à S11 selon la politique.
- Offres par carrière : 0,7 à 0,9 pour les politiques aléatoire et audience, 2,9 pour la politique économe.
- Chaque format de départ reçoit des offres, de 3 à 7 carrières sur 9 ; la voie audience et la voie rentabilité donnent toutes deux des offres.
- 20 transferts sans erreur, toujours 6 chaînes ; mandats : 7 succès, 12 échecs.

**Autres simulations** (inchangées sur le fond) :
- Économie des IA (`economie.txt`) : identité comptable respectée sur toutes les saisons.
- File des dilemmes (`file.txt`) : aucune file bloquée.

**Correctif issu de la simulation** : un contrat échu peut rester en case chez une IA pendant un événement sportif, alors que le joueur a déjà signé ce programme. La validation n'interdit donc plus que les doublons créés par le transfert.

## Limites restantes

1. **Rentabilité saturée** : après avoir rejoint une chaîne IA très rentable, le score de rentabilité sature vite (calibrage économique du lot précédent : recettes élevées pour un coût de grille modéré). La voie rentabilité domine donc pour un joueur économe.
2. **Événements sportifs** : leur audience est pondérée par la popularité pour le joueur, pas pour une IA (`calculateSportsEventAudience`). La comparaison d'audience avant et après le transfert exclut donc les événements de la saison close.
3. **Saisons de convention** : aucune offre n'est faite en saison de renouvellement de convention (report d'une saison).
4. **ARCOM et régie** : l'état ARCOM et la régie restent attachés à leur chaîne, et non au dirigeant.
5. **Apport d'actionnaire** : ses conditions (chaîne en difficulté) sont rarement réunies ; aucun apport n'a été observé en simulation.
6. **Austérité** : chez le joueur, l'austérité héritée est informative ; elle ne bride pas ses décisions comme elle bride l'IA.
7. **Nouveaux formats** : l'IA ne programme pas de recettes de nouveaux formats après la reprise de l'ancienne chaîne.
8. **Mode carrière** : seules les évaluations sont reportées tant qu'un scénario est actif. Après une victoire de carrière, les approches reprennent normalement.

## Évolutions (retours de jeu)

- **Proposition de poste.** Ce n'est plus un écran du bilan : c'est le premier dilemme de la saison qui suit l'évaluation, au format des enchères, avec l'illustration du propriétaire à son bureau et le contrat sur la table.
  - Présentation : deux choix, « Étudier la proposition » et « Refuser la proposition ».
  - Étude : six indicateurs (PDA 4+ et rang, PDA cible, recettes pub prévues, coût de grille, trésorerie, enveloppe) et l'objectif du propriétaire. Trois choix : accepter, négocier ou décliner.
  - Négociation : le propriétaire relève l'enveloppe (tirage mémorisé, chance de 30 à 75 % selon l'intérêt pour le candidat et sa réputation) ou retire son offre (`CHANNEL_APPROACH.negotiation`).
  - Une offre acceptée est signée. La prise de fonction a lieu entre les deux saisons ; le mandat commence à la saison suivante, avec un objectif calé sur la situation du moment.
  - Une offre sans réponse vaut refus, sans sanction.
- **Prix du marché à la reprise.** La grille reprise vaut 55 % des recettes publicitaires attendues de la chaîne, répartis entre les cases au prorata de leur audience. Un contrat déjà plus cher garde son prix (`CHANNEL_APPROACH.market`). Un contrat dont l'échéance tombe à la saison close est prolongé d'une saison au lieu de retomber sur la programmation de base. Exemple : une chaîne sport à 110 M€ de recettes passe de 17 à 62 M€ de grille.
- **Entretien préalable de licenciement.** Un mandat manqué entraîne une convocation en tête de la saison suivante.
  - Accepter le licenciement : le dirigeant est démis de ses fonctions (fin de partie).
  - Négocier : un objectif plus modeste est fixé sur 2 saisons (`CHANNEL_APPROACH.renegotiation`).
  - Objectif renégocié manqué : démis de ses fonctions.
  - Convocation sans réponse : licenciement.
