# Lot 1 — Économie des cinq concurrents IA

## Audit : écarts constatés

| Point | Avant | Problème |
|---|---|---|
| Recettes | `closeCampaignSeason` crédite `max(1, PDA × COMPETITOR_INCOME_RATE)` (0,4), soit 6 à 14 M€ par saison. `adMarketModel` calcule pourtant, pour l'affichage, 60 à 155 M€ avec le moteur commun. | Deux systèmes incohérents ; le CA affiché n'explique pas la trésorerie. |
| Coûts de grille | Forfait `investCost[niveau]` débité dans `planCompetitorSeason`. | Le coût annuel réel des programmes du catalogue n'est jamais facturé. |
| Contrats | `makeCompetitorContract` recrée chaque contrat à chaque saison et repousse son échéance. | Un programme n'expire jamais ; un renouvellement ne coûte rien. |
| Talents | Salaire débité une fois, à la signature. | Pas de coût récurrent. |
| Droits sportifs | Prix et production débités. En plus, `evaluateSportsBroadcasts` crédite un « gain de recettes ». | Double compte : le moteur publicitaire intègre déjà l'événement (`sportsAdFactor`, audiences). |
| Déficits | `Math.max(0, budget − …)` partout. | Déficits masqués, argent créé. |
| Décisions | Chaque décision lit `budget` séparément (part du budget, seuils fixes). | Pas de réserve, pas d'engagements, pas d'enveloppe commune. |

## Règles retenues

### Trésorerie

`competitor.budget` reste la trésorerie, sous ce nom pour la compatibilité des sauvegardes. C'est la seule source de vérité. Tout flux passe par `competitorBook`, qui l'inscrit au grand livre de la saison (`competitor.finance.season`) :

- **Recettes** : publicitaires, autres recettes (indemnités de rachat).
- **Financement** : apports d'actionnaire, distributions.
- **Dépenses** : charges récurrentes, droits sportifs, production sportive, dépenses ponctuelles.

L'identité comptable est vérifiée à chaque clôture :

> clôture = ouverture + recettes + apports − dépenses − distributions

### Recettes

Les recettes viennent du moteur commun, `computeRevenusPub`. Il prend l'audience publicitaire sur la cible de la chaîne, la valeur du GRP, la popularité et la puissance commerciale du profil, ainsi que l'effet des droits sportifs. Il n'y a pas de recettes de régie ni de sponsoring pour les IA, car ces activités ne sont pas simulées pour elles.

Le calendrier est celui du joueur :

1. **Ouverture** (`openCompetitorSeason`), après la programmation de toutes les chaînes :
   - charges annuelles ;
   - droits d'entrée des acquisitions du plan ;
   - crédit du prévisionnel.
2. **Clôture** (`closeCompetitorSeason`) : seule la différence avec les recettes définitives est créditée. L'historique est ensuite figé.

Les deux étapes sont idempotentes (`openedSeason`, `closedSeason`, `paidSeason`). La rentrée forfaitaire (`COMPETITOR_INCOME_RATE`) est supprimée.

### Coûts de grille

Le coût annuel d'un contrat est le coût du programme au catalogue, plus le surcoût de son niveau de production (`investCost`, désormais récurrent et non plus en plus du reste).

- **Droits d'entrée** : payés une fois, à l'acquisition d'un nouveau programme. Ni la grille initiale ni un programme maintenu ne les repaient.
- **Contrats** : un programme maintenu garde son échéance. À l'échéance, il est renouvelé ou remplacé.
- **Pause pour un droit sportif** : le contrat n'est pas facturé pendant la saison de l'événement.

### Talents

Le salaire est facturé à chaque saison sous contrat. Celui de la saison en cours est payé à la signature si la saison est déjà ouverte.

### Droits sportifs

- Le prix de la première saison est payé à la signature.
- Le prix différé et la production sont payés à la diffusion, une seule fois.
- Les reconductions IA sont payées à la reconduction.
- Aucun gain n'est crédité en plus : le bilan de l'événement reste informatif.

### Capacité d'investissement commune

`competitorCapacity` vaut :

> trésorerie + recettes de la saison pas encore créditées − charges dues pas encore payées − sommes sportives dues et engagements des saisons suivantes − réserve du profil

La réserve représente 15 % des charges annuelles pour le profil offensif, 50 % pour le rentable, 30 % pour le jeune et 35 % pour le premium. Chaque dépense réduit la trésorerie, donc la capacité suivante : une même enveloppe ne finance pas deux opérations.

Cette capacité s'applique à toutes les décisions coûteuses :

- programmation de saison (budget prévisionnel du plan) ;
- renforcement après un rachat ;
- ripostes ;
- recrutement de talents (le premier prétendant solvable signe) ;
- enchères et reconductions de droits sportifs ;
- mises en concurrence (`interestedCompetitor`).

Les profils ne changent que les arbitrages (niveaux visés, réserve, part des enchères), jamais les règles comptables.

### Difficultés financières

Quand le plan dépasse le budget, la chaîne procède dans cet ordre :

1. Elle baisse ses niveaux de production, en commençant par les cases les moins stratégiques.
2. Elle remplace ses nouvelles acquisitions par des programmes moins chers.
3. Les contrats en cours restent dus.

Sans marge, la chaîne ne lance ni riposte, ni enchère, ni recrutement, ni renforcement.

**Soutien d'actionnaire** (`competitorShareholderSupport`) :

- **Déclencheur** : uniquement si la trésorerie est négative à la clôture.
- **Montant** : plafonné à 50 % du capital de départ du format.
- **Fréquence** : au plus 2 apports sur 10 saisons.
- **Suivi** : historisé dans `finance.supports`.
- **Contrepartie** : 2 saisons d'austérité, avec les niveaux de production plafonnés à 1 et ni riposte, ni enchère, ni acquisition coûteuse.
- **Effet comptable** : l'apport augmente la trésorerie sans améliorer le résultat.

### Distribution aux actionnaires (règle ajoutée)

Avec le moteur commun, les recettes d'une chaîne installée dépassent largement le coût de sa grille au catalogue. Sans contrepartie, la trésorerie croissait sans limite : de 1 000 à 2 400 M€ en 20 saisons.

À la clôture, la chaîne distribue désormais une part de sa trésorerie au-delà d'une cible :

- **Cible** : le plus grand du capital de départ du format et de 2 à 3 fois les charges annuelles, selon le profil, plus les engagements sportifs.
- **Part distribuée** : de 50 % (offensive) à 80 % (rentable).

C'est un flux de financement, symétrique de l'apport : il réduit la trésorerie, jamais le résultat. Les paramètres sont dans `COMPETITOR_ECONOMY.payout`.

### Historique et interface

**Historique** (`finance.history`, 40 saisons, figé à la clôture). Chaque saison conserve :

- la trésorerie d'ouverture et de clôture ;
- les recettes publicitaires définitives ;
- les autres recettes ;
- les charges récurrentes ;
- les droits et la production sportifs ;
- les dépenses ponctuelles ;
- les apports et les distributions ;
- le résultat ;
- les engagements à honorer.

**Fiche concurrent** (`competitorFinanceHtml`, lecture seule) :

- trésorerie ;
- CA publicitaire (prévisionnel puis définitif) ;
- coût annuel de grille ;
- résultat (prévisionnel ou définitif, clairement indiqué) ;
- état : confortable (trésorerie ≥ 0,75 × charges annuelles), sous tension (≥ 0,2) ou critique.

### Migration

`ensureCompetitorFinance` est appelé via `migrateCompetitorStrategy` et `ensureCampaign`. Une partie antérieure garde son solde comme point de départ.

- **Saison déjà entamée** : c'est une saison de transition. La frontière (`boundary`) est la saison suivante. Rien n'est refacturé ; seules les recettes définitives de la saison sont créditées à la clôture, une fois.
- **Saison déjà close** : elle n'est pas recréditée.

## Vérifications

**`tests/competitor-economy.test.js`**, tout est OK :

- Mêmes audiences et même état commercial : mêmes recettes qu'avec le moteur du joueur. Le CA du marché publicitaire est égal aux recettes.
- La rentrée simplifiée a disparu.
- Le prévisionnel est crédité une fois et l'ouverture est idempotente.
- Une hausse de recettes ne crédite que la différence.
- Les charges annuelles sont facturées une fois par saison. La grille initiale ne paie pas de droits d'entrée.
- Un programme maintenu garde son échéance. Les contrats échus sont renouvelés ou remplacés, avec leurs droits.
- Droits sportifs : premier prix à la signature, production à la diffusion, prix différé à la deuxième saison. Rien n'est facturé deux fois.
- Une acquisition réduit d'autant la capacité.
- Une IA sans marge ne fait ni enchère, ni riposte, ni surenchère, et son intérêt pour les talents baisse.
- L'apport est plafonné, historisé, suivi d'austérité, sans effet sur le résultat, et limité en nombre. La distribution est hors résultat.
- Les écrans et recalculs (marché, fiche, capacité, état) ne modifient aucun solde.
- Migration d'une saison entamée : transition sans refacturation, nouvelles règles à la frontière. Une saison close n'est pas recréditée.
- L'historique clôturé reste stable. Identité comptable et continuité des soldes vérifiées sur 6 saisons.

**`tests/sports-rights.test.js`** : l'événement d'un concurrent n'est plus crédité en plus des recettes publicitaires.

**`tests/program-transfer.test.js`** : ce test était instable avant ce lot (2 échecs sur 8). Les dilemmes du lot précédent qui signent un programme en prime (saga d'été, formats proposés) n'étaient pas écartés de son scénario ; c'est corrigé (12 sur 12).

**Simulation** (`tests/competitor-economy.sim.js`, `simulation.txt`, 4 graines × 6 types × 30 saisons, 3 270 saisons-concurrent) :

- Identité comptable respectée sur 3 270 / 3 270 saisons.
- Trésorerie moyenne stable : 71 M€ en saison 1, puis environ 100 M€ de la saison 5 à la saison 30.
- 5 trajectoires sur 120 en enrichissement continu ; 1 avec 5 déficits consécutifs (profil offensif).
- Aucun apport d'actionnaire nécessaire ; aucune case vide, file bloquée ou erreur.

Les autres contrôles des lots précédents (pureté des collectes, crises, sauvegardes, renouvellements) sont inchangés (`file.txt`).

## Limites avant de permettre au joueur de reprendre une chaîne concurrente

1. **Calibrage.** La rentabilité des chaînes installées est très élevée : recettes de 60 à 135 M€ pour 11 à 31 M€ de charges. C'est la conséquence directe du moteur publicitaire commun et des coûts du catalogue, et le joueur obtiendrait la même chose à audience égale. La distribution borne la trésorerie, mais elle ne remplace pas un calibrage (coût des programmes ou frais de structure, valeur du GRP) à décider avant la reprise d'une chaîne.
2. **Profil et format liés.** Chaque concurrent garde le même profil et le même format. On ne peut donc pas séparer la « domination d'un profil » de celle d'un format : la culture « jeune » et le sport « offensif » sont les plus riches.
3. **Prévisionnel IA.** Il n'est réestimé qu'à la clôture (une seule régularisation), et non après chaque décision du joueur.
4. **Charges non simulées.** Pas de frais de structure, de coûts de diffusion ni de fiscalité, pas plus que pour le joueur.
5. **Mi-saison.** Un programme installé en cours de saison (rachat, mise en concurrence) reprend la case déjà réglée : la différence de coût de la saison en cours n'est pas facturée.
6. **Reprise d'une chaîne.** Il faudra encore convertir `finance`, `contracts` et `talents` vers les structures du joueur : `coutGrilleEngageSaison`, `revenusPubPrevisionnels` et les contrats avec talents.
