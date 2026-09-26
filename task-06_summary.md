# Task 6 — Add the Status Badge and Audit the Workflow : récapitulatif

> Notes personnelles, fichier non commité.

## Résultat

Le badge est ajouté en haut du `README.md` et l'audit est fait en local :
`actionlint` OK, aucun motif d'identifiant trouvé, revue manuelle faite.
**Reste à faire sur GitHub** : vérifier le badge et le lien sur la page rendue,
puis confirmer que le workflow final est vert (ce qui nécessite Render,
task 4).

## Commit (branche `feat/ci-badge-audit`, au-dessus de la task 5)

| Commit | Date | Message |
|---|---|---|
| `7abcc58` | 2026-09-21 18:58 | README - Docs: Show the CI workflow status badge |

```markdown
[![CI](https://github.com/llacote-holberton/hbtn-devops-pipeline-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/llacote-holberton/hbtn-devops-pipeline-lab/actions/workflows/ci.yml)
```

- L'image est exactement l'URL de l'énoncé, avec ton nom d'utilisateur.
- Elle est entourée d'un lien vers la page du workflow, pour que « follow the
  badge link » mène au bon endroit.
- Sans paramètre `?branch=`, un badge GitHub reflète la **branche par défaut**,
  donc `main`, qui est la branche visée.

## Audit

### 1. `actionlint .github/workflows/ci.yml`

Code de sortie **0**, sans rien à corriger. Il a été lancé après chaque
modification du workflow (tasks 1 à 4), avec l'image `rhysd/actionlint`.

### 2. Recherche de motifs d'identifiants (commande de l'énoncé)

```bash
git grep -nE 'ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY' -- .github README.md DEPLOY.md
```

Aucune correspondance (code de sortie 1). J'ai aussi appliqué les mêmes motifs à
**tout l'historique**, toutes branches confondues (`git log -p --all`) : **0**
correspondance. Aucun fichier `.env` n'existe, ni suivi ni ignoré.

Cette recherche n'est **pas exhaustive** : elle ne connaît que quelques formats.
Elle ne prouve pas qu'aucun secret n'a jamais fuité.

### 3. Revue manuelle des valeurs `password` / `token` / `secret` / `key`

| Ligne `ci.yml` | Valeur | Verdict |
|---|---|---|
| `POSTGRES_PASSWORD: pipeline` (service du job `test`) | en clair | ✅ Acceptable : base **jetable**, créée et détruite avec le job, jamais exposée hors du runner |
| `DATABASE_URL: postgres://pipeline:pipeline@localhost…` | en clair | ✅ Même base jetable, mêmes identifiants |
| `password: ${{ secrets.GITHUB_TOKEN }}` (login GHCR) | jeton automatique | ✅ Limité à `contents: read` + `packages: write` sur le seul job `build`, et il expire à la fin du job |
| `RENDER_API_KEY: ${{ secrets.RENDER_API_KEY }}` | secret du dépôt | ✅ Jamais affiché, masqué dans les logs, envoyé seulement en en-tête `Authorization` vers l'API Render |
| `RENDER_SERVICE_ID: ${{ secrets.RENDER_SERVICE_ID }}` | secret du dépôt | ✅ Ce n'est pas un identifiant de connexion, mais le garder en secret ne coûte rien |
| `key:` / `restore-keys:` (cache) | clés de cache | ✅ Ce ne sont pas des secrets |

Côté droits, le workflow est en `contents: read` par défaut, `build` a
`packages: write` en plus, `deploy` a `permissions: {}`. Il n'y a aucun PAT dans
le workflow.

**Côté Render**, le périmètre de la clé dépend de toi : une clé API Render donne
accès à tout le compte. D'où le compte ou le workspace dédié au lab, et la
révocation de la clé en fin de lab (`DEPLOY.md` › Cleanup).

## Self Validation (état actuel)

- [ ] Badge ajouté, page rendue ouverte, lien suivi jusqu'au bon workflow et à la
      bonne branche : **ajouté**, il reste à le vérifier sur GitHub après le
      push.
- [x] `actionlint .github/workflows/ci.yml` : code de sortie 0.
- [x] Recherche ciblée lancée sur le workflow et la doc, sans correspondance à
      revoir, et sans la prendre pour une preuve exhaustive.
- [ ] Revue manuelle : faite (tableau ci-dessus). Il reste le « finished with a
      green workflow » : **après Render**.
