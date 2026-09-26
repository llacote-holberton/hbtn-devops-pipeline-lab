# Task 1 — Repair the Broken Pipeline : récapitulatif

> Notes personnelles, fichier non commité.

## Résultat

Les trois défauts volontaires du workflow `.github/workflows/ci.yml` sont
identifiés et corrigés, chacun dans son propre commit. Le job `Test` passe en
simulation locale : `npm ci` OK, 8/8 tests unitaires, 3/3 tests d'intégration,
`actionlint` sans erreur.

**Vérifié sur GitHub** : le run
[36168302984](https://github.com/llacote-holberton/hbtn-devops-pipeline-lab/actions/runs/36168302984)
(push de `4c98763` sur `main`) est **vert**, et toutes les étapes du job `Test`
sont en `success`, y compris *Run the unit tests* et *Run the integration tests*.
Il reste seulement l'avertissement « Node.js 20 is deprecated » (voir point
d'attention n°2).

## Diagnostic, run par run

| Run GitHub / étape locale | Commit | Symptôme observé | Cause |
|---|---|---|---|
| [35603240930](https://github.com/llacote-holberton/hbtn-devops-pipeline-lab/actions/runs/35603240930) | `9e9af5f` Initial | Run en échec avec **0 job** : GitHub n'a pas pu lire le workflow | Erreur YAML (défaut n°1) |
| [35605186020](https://github.com/llacote-holberton/hbtn-devops-pipeline-lab/actions/runs/35605186020) | `43b2fcd` | Étape *Install dependencies* en échec (`Process completed with exit code 1`), tests *skipped* | Commande d'installation (défaut n°2) |
| [35607566544](https://github.com/llacote-holberton/hbtn-devops-pipeline-lab/actions/runs/35607566544) | `4f88f52` | Identique : le passage à Node 24 ne touche pas ce défaut | Commande d'installation (défaut n°2) |
| Simulation locale | `1c6b56e` | `npm ci` OK, 8/8 unitaires, intégration en échec : `DATABASE_URL is not set` | Environnement BDD (défaut n°3) |
| Simulation locale | `4c98763` | 8/8 unitaires, 3/3 intégration, `actionlint` OK | — |
| [36168302984](https://github.com/llacote-holberton/hbtn-devops-pipeline-lab/actions/runs/36168302984) | `4c98763` | **Succès** : toutes les étapes vertes | — |

Un run avec **0 job** signale une erreur de parsing : GitHub rejette le fichier
avant de lancer quoi que ce soit, et l'annotation se trouve sur le fichier du
workflow. Un job lancé qui échoue sur une étape signale un échec d'exécution :
il faut lire la commande, son erreur et les lignes qui précèdent dans le log du
job.

## Les trois corrections

### Défaut n°1 : structure YAML (commit `43b2fcd`, le tien)

`steps:` était indenté de 5 espaces au lieu de 4 : il ne correspondait à aucun
niveau de la hiérarchie `jobs.test.*`. Voici l'erreur reproduite avec un parseur
YAML :

```text
while parsing a block mapping
  in "<stdin>", line 28, column 5
expected <block end>, but found '<block mapping start>'
  in "<stdin>", line 46, column 6
```

Ligne 28 : `name: Test`, début du mapping du job. Ligne 46, colonne 6 :
`steps:`, décalé d'un cran.

### Défaut n°2 : commande d'installation (commit `1c6b56e`)

```diff
-        run: npm install-deps
+        run: npm ci
```

- `npm install-deps` n'est pas une commande npm, d'où l'`exit code 1`.
- `npm ci` et non `npm install` : `npm ci` installe **exactement** l'arbre
  enregistré dans `package-lock.json`. Il part d'un `node_modules` vide et
  échoue si `package.json` et le lock file ne concordent pas. En CI, c'est ce
  qui rend l'installation reproductible : on teste l'arbre de dépendances qui a
  été revu et commité. `npm install`, lui, peut résoudre d'autres versions et
  réécrire le lock file.

### Défaut n°3 : environnement de la base de données (commit `4c98763`)

```diff
+    # Steps run on the runner host, so the service is reached through its
+    # published port on localhost, not through the "postgres" service name.
+    env:
+      DATABASE_URL: postgres://pipeline:pipeline@localhost:5432/pipeline
```

- Le conteneur de service Postgres démarrait bien (healthcheck OK), mais rien
  n'indiquait à l'application où le trouver. `src/db/connection.js` n'a
  volontairement aucune valeur par défaut et lève `DATABASE_URL is not set`.
- **Pourquoi `localhost` et pas `postgres` :** le job n'a pas de clé
  `container:`. Ses étapes s'exécutent donc directement sur la VM du runner, et
  le service y est joignable via le port publié (`ports: - 5432:5432`). Le nom
  de service `postgres` ne se résout que si le job tourne lui-même dans un
  conteneur.
- **Pourquoi au niveau du job et pas de l'étape :** les tests unitaires
  l'ignorent (le pool de connexions est créé à la première requête), et la
  task 2 lancera `npm test`, qui enchaîne les deux suites.
- **La valeur reste dans le workflow, pas dans le code** : c'est ce que demande
  l'énoncé. Les identifiants sont ceux de la base jetable du service
  (`POSTGRES_PASSWORD` est déjà en clair dans le même fichier), pas un secret de
  production. C'est à garder en tête pour la revue de la task 6.

## Vérifications effectuées

1. **Simulation du job CI** : image `node:24-slim` (même version que
   `node-version`) et `postgres:16-alpine` configuré comme le service. Le
   conteneur Node partage l'espace réseau de Postgres, donc `localhost:5432`
   s'y comporte comme sur le runner. La valeur de `DATABASE_URL` a été lue
   directement dans `ci.yml`.
   - après `1c6b56e` : `npm ci` OK, `Tests: 8 passed`, puis intégration
     `FAIL … DATABASE_URL is not set` (c'est l'échec suivant attendu) ;
   - après `4c98763` : `Tests: 8 passed, 8 total` et `Tests: 3 passed, 3 total`.
2. **`actionlint .github/workflows/ci.yml`** (image `rhysd/actionlint`) : aucune
   erreur, code de sortie 0.
3. **Run GitHub Actions** 36168302984 : `success`. Les deux commits `fix(ci)`
   ont été poussés ensemble, il n'y a donc pas de run intermédiaire pour
   `1c6b56e` seul : l'échec `DATABASE_URL is not set` n'a été observé qu'en
   simulation locale.

## Commits

| Commit | Date | Message |
|---|---|---|
| `43b2fcd` | 2026-09-21 15:22 | Fix: syntax error making the whole "services" block fail. |
| `4f88f52` | 2026-09-21 15:44 | Fix: job targeted unsupported (obsolete) version of Node |
| `1c6b56e` | 2026-09-21 15:52 | fix(ci): install dependencies with npm ci from the lock file |
| `4c98763` | 2026-09-21 16:03 | fix(ci): provide DATABASE_URL to the integration tests |

## Points d'attention

1. **Seulement deux commits `fix(ci)` sur trois.** La correction YAML
   (`43b2fcd`, déjà poussée) porte le message `Fix: …`. La Self Validation
   demande « three separate `fix(ci)` commits ». Tu peux soit laisser en l'état
   et l'expliquer, soit reformuler ce message : rebase + **force-push sur
   `main`**, puisque le commit est déjà sur `origin`.
2. **Le passage à Node 24 (`4f88f52`) ne supprime pas l'avertissement.**
   L'annotation dit : *« The following actions target Node.js 20 but are being
   forced to run on Node.js 24: actions/checkout@v4, actions/setup-node@v4 »*.
   Elle concerne le runtime **des actions elles-mêmes**, pas la version de Node
   de l'application. Elle apparaît d'ailleurs aussi sur le run 35607566544, qui
   a déjà `node-version: '24'`. Pour la faire disparaître, il faudrait passer à
   une version majeure de ces actions qui tourne sur Node 24 (à vérifier sur
   leurs pages de release).
3. **La CI teste sur Node 24 alors que l'image est construite sur Node 20**
   (`node:20-slim` / `node:20-alpine` dans le `Dockerfile`). Le pipeline ne teste
   donc pas le runtime qu'il livre. Ce n'est pas bloquant pour la task 1, mais à
   aligner dans un sens ou dans l'autre avant les tasks 3-4.
4. Espace en fin de ligne après `test:` (introduit par `43b2fcd`) : sans effet.
5. Le workflow ne se déclenche que sur un **push vers `main`** ou une **PR vers
   `main`**. Pousser seulement une branche de travail ne lance aucun run.

## Reste à faire

- [x] `git push origin main`.
- [x] Job `Test` vert dans l'onglet Actions, y compris les deux étapes de test
      (run 36168302984).
- [ ] Décider du sort du message de `43b2fcd` (point d'attention n°1).

### Self Validation (état actuel)

- [x] Premier run en échec ouvert, première erreur localisée depuis
      l'annotation ou le log.
- [ ] Trois commits `fix(ci)` séparés : **2/3** (voir point d'attention n°1).
- [ ] Après chaque correction, push et run inspecté : fait pour le défaut n°1.
      Les n°2 et n°3 ont été poussés ensemble, et l'étape intermédiaire n'a été
      observée qu'en simulation locale.
- [x] Job de test final vert sur GitHub (run 36168302984), sans erreur ignorée
      ni test désactivé : aucun `continue-on-error`, `|| true` ni test retiré.
