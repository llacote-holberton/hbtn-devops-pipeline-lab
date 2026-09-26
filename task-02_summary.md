# Task 2 — Add Caching and Test Artifacts : récapitulatif

> Notes personnelles, fichier non commité.

## Résultat

Le job `Test` fait maintenant, dans l'ordre : restauration du cache npm → `npm ci`
→ lint → suite complète avec rapport JUnit → upload du rapport, même si les tests
échouent.

Vérifié en local (étapes `run:` du workflow rejouées en conteneur Node 24 +
Postgres 16) et avec `actionlint`. Les deux pushes de l'étape 7 **ont été faits** :

| Push | Commit | Run | Résultat |
|---|---|---|---|
| 1 | `58c69a4` (lint + cache) | [36171203671](https://github.com/llacote-holberton/hbtn-devops-pipeline-lab/actions/runs/36171203671) | **Vert, vérifié** : toutes les étapes en `success`, y compris *Lint the sources* et *Post Cache npm downloads* |
| 2 | `d7b7f3c` (JUnit + artifact) | voir l'onglet Actions | **Non vérifié par moi** (lecture refusée par le garde-fou de permissions, voir plus bas) |

## Commits (branche `feat/ci-cache-and-reports`)

| Commit | Date | Message |
|---|---|---|
| `a7d4463` | 2026-09-21 16:12 | CI pipeline - Feat: Lint the sources before any test runs |
| `58c69a4` | 2026-09-21 16:24 | CI pipeline - Feat: Cache npm downloads keyed on the lock file |
| `d7b7f3c` | 2026-09-21 16:37 | CI pipeline - Feat: Publish JUnit test reports as a workflow artifact |

L'énoncé n'impose pas de format de message pour cette task : j'ai suivi ta
convention.

## Détail des modifications

### 1. Lint avant les tests (`a7d4463`)

```yaml
      - name: Lint the sources
        run: npm run lint
```

Placé juste après `npm ci`, car ESLint est une devDependency et doit être
installé, et avant toute commande de test. Une erreur de lint arrête le job
avant les tests, qui sont plus lents.

### 2. Cache des téléchargements npm (`58c69a4`)

```yaml
      - name: Cache npm downloads
        uses: actions/cache@v4
        with:
          path: ~/.npm
          key: ${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}
          restore-keys: |
            ${{ runner.os }}-npm-
```

- **Clé exacte** : `Linux-npm-<sha256 du lock file>`. Elle vient du contexte du
  runner (`runner.os`) et du contenu de `package-lock.json`. Modifier le lock
  file change la clé, ce qui empêche de réutiliser une clé figée.
- **Préfixe `restore-keys`** : `Linux-npm-`. Si la clé exacte n'existe pas
  (lock file modifié), le cache le plus récent qui commence par ce préfixe est
  restauré. `npm ci` ne retélécharge alors que les paquets manquants.
- **Comportement attendu :**

  | Situation | Restauration | Sauvegarde en fin de job |
  |---|---|---|
  | Premier run | Rien (cache absent) | Oui, sous la clé exacte |
  | Lock file inchangé | Clé exacte (*cache hit*) | Non : un cache existant n'est jamais réécrit |
  | Lock file modifié | Partielle, via le préfixe | Oui, sous la nouvelle clé exacte |

- **Pourquoi `~/.npm` et pas `node_modules`** : `~/.npm` est le cache de
  téléchargement de npm. Il est indexé par hash d'intégrité, donc une entrée
  périmée ne peut pas fausser l'installation. `npm ci` supprime `node_modules`
  puis réinstalle **exactement** l'arbre du lock file. Le cache accélère les
  téléchargements, il ne remplace ni l'installation ni le lock file. Mettre
  `node_modules` en cache contournerait cette garantie.
- **Placé avant `npm ci`** : la restauration doit avoir lieu avant
  l'installation. La sauvegarde se fait dans l'étape *Post Cache npm downloads*,
  à la fin du job.
- `hashFiles('**/package-lock.json')` ne trouve qu'un fichier, celui à la racine.
  `node_modules` n'existe pas encore quand la clé est calculée.

### 3. Rapport JUnit et artifact (`d7b7f3c`)

```yaml
      - name: Run the test suite
        env:
          JEST_JUNIT_OUTPUT_DIR: ./reports
        run: npm test -- --reporters=default --reporters=jest-junit

      - name: Upload the test reports
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-reports
          path: reports/
          retention-days: 7
```

- **Les deux étapes de test sont fusionnées en une seule `npm test`**, qui lance
  les 11 tests (unitaires et intégration). Avec deux lancements, le second aurait
  écrasé le `reports/junit.xml` du premier. `DATABASE_URL` reste défini au niveau
  du job (task 1).
- `--reporters=default` garde la sortie lisible dans le log.
  `--reporters=jest-junit` ajoute le fichier XML. `jest.config.js` n'active que
  `default`, d'où l'option passée en ligne de commande.
- **`if: always()`** : sans condition, une étape ne s'exécute que si les
  précédentes ont réussi. Le rapport serait donc perdu justement quand un test
  échoue. `always()` lance l'upload quel que soit le résultat, même en cas
  d'annulation.
- Si l'échec survient **avant** les tests (install ou lint), `reports/` n'existe
  pas. L'upload produit alors un simple avertissement « No files were found »
  (comportement par défaut, `if-no-files-found: warn`) et ne masque pas l'échec
  réel.
- **Rétention de 7 jours** : `retention-days: 7`.
- **Rapports non commités** : `reports/` est déjà dans `.gitignore`.

## Vérifications effectuées

1. **`actionlint .github/workflows/ci.yml`** (image `rhysd/actionlint`) : code de
   sortie 0, après chaque modification.
2. **Rejeu des étapes `run:` du workflow** : le script est généré à partir de
   `ci.yml` lui-même, avec l'env du job et celui de l'étape. Il est exécuté dans
   `node:24-slim`, qui partage le réseau d'un `postgres:16-alpine`.
   - cas vert : install → lint (exit 0) → `Tests: 11 passed, 11 total`, et
     `reports/junit.xml` contient
     `<testsuites … tests="11" failures="0" errors="0">` ;
   - cas rouge (test en échec ajouté **uniquement dans la copie jetable**) :
     l'étape sort en code 1 et le rapport est quand même écrit,
     `<testsuites … tests="12" failures="1">`. C'est exactement ce que l'upload
     `if: always()` doit récupérer.
3. **Non vérifiable en local :** le comportement réel d'`actions/cache` (miss,
   hit, sauvegarde) et l'upload de l'artifact. Voir ci-dessous.

## Reste à faire : vérifier les deux runs dans l'onglet Actions

Les deux pushes sont faits : `58c69a4` puis `d7b7f3c`, sans changement du lock
file entre les deux. Le run 1 est vert. Pour le run 2, je n'ai pas pu lire le
résultat : ma requête vers l'API a été refusée par le garde-fou de permissions
de Claude Code (motif « Create Public Surface »). À vérifier toi-même :

| Run | Étape *Cache npm downloads* | Étape *Post Cache npm downloads* |
|---|---|---|
| 1 (`58c69a4`) | `Cache not found for input keys: Linux-npm-<hash>, Linux-npm-` | `Cache saved with key: Linux-npm-<hash>` |
| 2 (`d7b7f3c`) | `Cache restored from key: Linux-npm-<hash>` | `Cache hit occurred on the primary key …, not saving cache.` |

Dans le résumé du run 2, la section **Artifacts** doit contenir `test-reports`,
avec `junit.xml` à l'intérieur (11 tests, 0 échec).

## Points d'attention

1. **Avertissement Node 20** : `actions/cache@v4` et `actions/upload-artifact@v4`
   sont imposés par l'énoncé. Comme `checkout@v4` et `setup-node@v4`, ils
   tournent sur le runtime Node 20 : c'est vérifié dans leur `action.yml`
   (`runs.using: node20`), tout comme `checkout@v4` et `setup-node@v4`. Ils
   s'ajoutent donc à la liste de l'avertissement « Node.js 20 is deprecated »,
   qui n'est pas bloquant.
2. **Portée des caches** : un run peut restaurer les caches de sa propre branche
   et ceux de la branche par défaut (`main`). Un cache créé sur `main` sert donc
   aussi aux PR, mais pas l'inverse.
3. Les étapes *Run the unit tests* et *Run the integration tests* n'existent
   plus : elles sont remplacées par *Run the test suite*. La task 5 s'appuie,
   elle, sur l'étape d'upload du rapport, qui doit tourner même quand les tests
   échouent.
