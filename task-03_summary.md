# Task 3 — Build and Publish the Docker Image : récapitulatif

> Notes personnelles, fichier non commité.

## Résultat

Nouveau job `build` : il dépend de `test` et ne tourne que pour un push sur
`main`. Il construit l'étape `runtime` du Dockerfile et la publie sur GHCR sous
deux tags. Validé par `actionlint` et par un build local de l'image.

**Pas encore poussé.** Je me suis arrêté avant tout ce qui publie quelque chose
(voir « Pourquoi je n'ai pas poussé »). La commande est dans `todo-retour.md`.

## Commits (branche `feat/ci-docker-publish`)

| Commit | Date | Message |
|---|---|---|
| `1a152d1` | 2026-09-21 17:05 | CI pipeline - Feat: Publish a traceable Docker image to GHCR |
| `cbf3309` | 2026-09-21 17:18 | CI pipeline - Feat: Cache Docker image layers between builds |

## Le job

```yaml
  build:
    name: Build and publish image
    needs: test
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v4
      - uses: docker/login-action@v4          # ghcr.io, github.actor, secrets.GITHUB_TOKEN
      - uses: docker/build-push-action@v7     # context ., target runtime, push
        # tags : ghcr.io/${{ github.repository }}:${{ github.sha }} et :latest
        # cache-from: type=gha / cache-to: type=gha,mode=max
```

### Pourquoi chaque élément

- **`needs: test`** : pas d'image si les tests échouent. Le job est *skipped*,
  pas *failed* (c'est ce qu'on observe à la task 5).
- **`if:` au niveau du job** : un push sur `main` publie. Une PR lance les tests
  mais ne publie jamais, parce que son `github.event_name` vaut `pull_request`.
- **Permissions** : le workflow garde `contents: read` par défaut, et seul ce job
  obtient `packages: write`. Pas de `write-all`, pas de `contents: write`, pas
  de PAT : le `GITHUB_TOKEN` automatique suffit pour publier dans le GHCR du
  dépôt, et il expire à la fin du job.
- **`setup-buildx-action`** : le driver `docker` par défaut ne sait pas exporter
  le cache `type=gha`. L'action crée un builder `docker-container` qui le sait.
- **Deux tags pour la même image** :
  - `:<sha du commit>` est **immuable** : on sait exactement quel code tourne, et
    c'est ce tag qu'on utilise pour un rollback (voir `DEPLOY.md`) ;
  - `:latest` est **mobile** : pratique, mais il ne dit pas quelle version il
    désigne.
- **`target: runtime`** : l'image livrée contient uniquement les dépendances de
  production, un utilisateur non-root et pas d'outils de build. `builder` sert au
  développement et aux tests.
- **`cache-to: type=gha,mode=max`** : `mode=max` exporte aussi les couches de
  l'étape `builder` (le `npm ci` complet), ce qui les rend réutilisables au build
  suivant.
- **Versions** : `setup-buildx-action@v4` est imposé par l'énoncé. Pour
  `login-action@v4` et `build-push-action@v7`, ce sont les dernières versions
  majeures (releases vérifiées le 2026-09-25). Les trois tournent sur Node 24, et
  les entrées utilisées existent bien dans leur `action.yml` actuel.

## Vérifications effectuées

1. `actionlint` : code de sortie 0 après chaque commit.
2. **Build local de la cible `runtime`** puis smoke test, **en local** (ce n'est
   pas l'image GHCR) :
   `docker build --target runtime` → conteneur lancé → `GET /health` →
   `200 {"status":"ok"}`. Le processus tourne sous l'utilisateur `app`, `/app`
   contient uniquement `src`, `node_modules`, `package*.json`, avec Node
   `v20.20.2`. Conteneur et image supprimés ensuite.
3. **Non fait** : le run GitHub et le `docker pull` depuis GHCR, puisque rien
   n'est poussé.

## Smoke test de l'image publiée (à faire après le push)

```bash
# Si le package GHCR est privé, il faut d'abord se connecter avec un PAT read:packages :
#   echo "<PAT>" | docker login ghcr.io -u llacote-holberton --password-stdin
docker pull ghcr.io/llacote-holberton/hbtn-devops-pipeline-lab:latest
docker run --rm -d --name pipeline-lab-smoke -p 3000:3000 ghcr.io/llacote-holberton/hbtn-devops-pipeline-lab:latest
curl -s http://localhost:3000/health     # {"status":"ok"} ; ne teste que la liveness
docker stop pipeline-lab-smoke
```

Après le premier push, vérifie la visibilité affichée pour le package. Un
package de compte personnel est normalement privé à sa création, mais je ne l'ai
pas constaté ici. La visibilité se règle dans GitHub › ton profil › Packages ›
`hbtn-devops-pipeline-lab` › Package settings. C'est un choix à faire pour la
task 4 : **un package rendu public ne peut plus redevenir privé.**

## Pourquoi je n'ai pas poussé

Tu m'avais autorisé à pousser sur `main`, et j'ai poussé les deux commits de la
task 2. Ensuite, le garde-fou de permissions de Claude Code a refusé une de mes
actions (motif « Create Public Surface »). Par prudence, je n'ai rien poussé qui
publie une image ou déclenche un déploiement.

Les commits sont prêts. Pousser `feat/ci-docker-publish` ne présente aucun risque
pour le pipeline : il n'y a pas encore de job de déploiement à cette étape.

## Points d'attention

1. **Node 24 en CI, Node 20 dans l'image** : le `Dockerfile` utilise
   `node:20-slim` / `node:20-alpine`, alors que la CI teste sur Node 24. L'image
   publiée tourne donc sur une version de Node qui n'a pas été testée, et Node 20
   n'est plus maintenu. À aligner (par exemple passer le Dockerfile en
   `node:24-*`), mais je n'y ai pas touché : c'est hors du périmètre de la task.
2. Le nom d'image `ghcr.io/${{ github.repository }}` doit être en minuscules.
   C'est le cas pour `llacote-holberton/hbtn-devops-pipeline-lab`.
