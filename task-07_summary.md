# Task 7 — Final Knowledge Check : fiche de révision

> Notes personnelles, fichier non commité. Je n'ai **pas** passé le quiz : il est
> noté, soumis en ton nom sur l'intranet, et une réponse envoyée ne se reprend
> pas. Cette fiche reprend les thèmes annoncés, appliqués à ce qu'on a construit.

## Déclencheurs (`on:`)

- `push: branches: [main]` lance le workflow à chaque push sur `main`.
  `pull_request: branches: [main]` le lance pour une PR **qui cible** `main`.
- Le push d'une autre branche, sans PR, ne déclenche **rien**.
- Même workflow, comportements différents selon l'événement :
  `github.event_name` (`push` ou `pull_request`) et `github.ref`
  (`refs/heads/main`, ou `refs/pull/N/merge` pour une PR).

## Dépendances et conditions entre jobs

- Sans `needs`, les jobs tournent **en parallèle**. `needs: X` impose l'ordre
  **et** exige que X réussisse.
- Si X échoue, le job dépendant est **skipped** : il n'a ni runner ni log. Le
  saut se propage, donc `deploy` (needs `build`) est aussi skipped.
- Un `if:` au niveau du **job** (notre condition de release) décide si le job
  existe pour ce run. Un `if:` au niveau de l'**étape** décide seulement si
  l'étape s'exécute.
- Fonctions de statut d'étape : `success()` (par défaut), `failure()`,
  `always()` (même si c'est annulé), `cancelled()`, `!cancelled()`.

## Diagnostic des échecs

- **Erreur de parsing** (YAML ou syntaxe du workflow) : le run échoue avec **0
  job**, et l'annotation pointe sur le fichier et la ligne.
- **Échec d'exécution** : un job a démarré et une étape a renvoyé un code non
  nul. On lit la commande, son erreur et les lignes juste au-dessus.
- On corrige **une cause à la fois**, puis on vérifie que le run suivant va plus
  loin que le précédent.
- Masquer un échec (`continue-on-error`, `|| true`, un test désactivé, une étape
  supprimée) donne un pipeline vert qui ne prouve plus rien.

## Installations reproductibles

- `npm ci` installe **exactement** ce que contient `package-lock.json`. Il vide
  d'abord `node_modules` et échoue si le manifest et le lock file divergent.
- `npm install` peut résoudre d'autres versions et réécrire le lock file : ce
  n'est pas reproductible.
- Le lock file doit être **commité**, sinon la CI teste un arbre de dépendances
  que personne n'a revu.

## Caches

- Un cache sert à **accélérer**. Il ne garantit rien : si on le supprime, le
  résultat doit être le même, juste plus lent.
- Clé exacte = ce dont le contenu dépend : OS + `hashFiles(lock file)`.
  `restore-keys` = préfixe de secours pour une **restauration partielle**
  (le cache le plus récent qui correspond).
- Si la clé exacte est trouvée, le cache n'est **pas** réécrit (les caches sont
  immuables). Si elle ne l'est pas, le cache est sauvegardé en fin de job, sous
  la clé exacte.
- On met en cache `~/.npm` (les téléchargements), pas `node_modules`
  (l'installation).
- Une clé **fixe** ne change jamais : on restaurerait indéfiniment un cache
  obsolète.
- Portée : une branche peut lire ses propres caches et ceux de la branche par
  défaut.

## Artifacts

- Un artifact est un **fichier produit par un run et conservé après lui**
  (rapport, binaire), téléchargeable depuis la page du run, avec une durée de
  rétention (`retention-days`).
- Un cache sert au run suivant. Un artifact sert à **un humain ou un autre job**.
- Un upload de rapport doit avoir `if: always()`, sinon on perd le rapport
  justement quand un test a échoué.

## Traçabilité des images

- Un tag **immuable** (`:<sha>`) identifie exactement le commit construit. Il
  sert au rollback et à l'audit.
- Un tag **mobile** (`:latest`) est pratique, mais il ne dit pas quelle version
  il désigne et il change à chaque release.
- Le tag seul ne suffit pas : le digest (`sha256:…`) est l'identifiant vraiment
  immuable du contenu.

## Vérification du déploiement

- « Le déploiement a été déclenché » ne veut pas dire « le service fonctionne ».
  Il faut **vérifier** avec des requêtes réelles, un nombre d'essais **borné**,
  et un échec explicite du job.
- Liveness (`/health` : le processus répond) ≠ fonctionnement réel (`/items` :
  la base répond aussi).
- Attention à la vérification qui passe contre **l'ancienne** version pendant
  que la nouvelle se construit.

## Secrets

- On les range dans GitHub Secrets ou chez la plateforme, puis on les référence
  avec `${{ secrets.NOM }}`. GitHub les masque dans les logs.
- On ne les écrit jamais dans le code, le workflow, les logs ou un fichier
  commité. Même effacé ensuite, un secret commité est **compromis** : il faut le
  révoquer ou le faire tourner, pas seulement le supprimer.
- Pour les réglages non sensibles (une URL par exemple), on utilise les
  variables (`${{ vars.NOM }}`).
- Les secrets ne sont pas transmis aux workflows déclenchés par une PR venant
  d'un fork.

## Droits du jeton

- `GITHUB_TOKEN` est automatique et **expire à la fin du job**. Ses droits se
  fixent avec `permissions:`, au niveau du workflow ou du job (le job
  l'emporte).
- Moindre privilège : `contents: read` partout, `packages: write` sur le seul job
  qui publie, `{}` pour un job qui n'en a pas besoin.
- Il vaut mieux `GITHUB_TOKEN` qu'un PAT : pas de secret à longue durée de vie à
  gérer.

## Ce qu'un pipeline vert prouve, et ce qu'il ne prouve pas

- **Il prouve :** pour **ce** commit, le lint et **les tests existants** passent
  dans **cet** environnement, l'image a été construite et publiée, et le staging
  répondait au moment de la vérification.
- **Il ne prouve pas :** l'absence de bugs (seulement ceux que les tests
  couvrent), la sécurité (pas d'analyse des dépendances ni de l'image, pas de
  signature), le bon comportement en production (données, charge, config
  différentes), ni l'absence de secret déjà fuité.
  - Exemple concret ici : la CI teste sur Node 24 alors que l'image tourne sur
    Node 20.
