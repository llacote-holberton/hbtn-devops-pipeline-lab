# Task 4 — Deploy to Staging : récapitulatif

> Notes personnelles, fichier non commité.

## Résultat

Job `deploy` (cible **Render**) et runbook `DEPLOY.md` commités. La logique du
job est testée contre un faux serveur imitant l'API Render et le service de
staging, dans six scénarios.

**Bloqué côté comptes :** la task a besoin d'un service Render, d'une base
Render, d'une clé API et de secrets GitHub. Je n'ai ni tes accès ni le droit de
créer ces ressources à ta place. Il y en a pour environ 15 minutes, la marche à
suivre est dans `todo-retour.md`. **Si tu pousses ce job avant d'avoir configuré
Render, le run échouera à l'étape « Check the staging configuration ».** C'est
volontaire : l'échec est explicite plutôt que silencieux.

## Commits (branche `feat/ci-staging-deploy`, au-dessus de la task 3)

| Commit | Date | Message |
|---|---|---|
| `2e2d650` | 2026-09-21 17:52 | CI pipeline - Feat: Deploy the published image to Render staging |
| `657148d` | 2026-09-21 18:10 | Staging deployment - Docs: Add the staging deployment runbook |

## Le job `deploy`

- `needs: build` et la même condition de release : push sur `main`.
- `permissions: {}` : le job n'a besoin d'aucun droit du `GITHUB_TOKEN`. Ses
  identifiants viennent des secrets Render.
- Configuration : `RENDER_API_KEY` et `RENDER_SERVICE_ID` en **secrets**,
  `STAGING_URL` en **variable**. Ils sont lus une seule fois dans l'`env` du job,
  jamais écrits en dur. GitHub masque les secrets dans les logs.

| Étape | Rôle | Échoue si… |
|---|---|---|
| Check the staging configuration | Vérifie que les 2 secrets et la variable existent | l'un manque (message qui renvoie vers `DEPLOY.md`) |
| Trigger Render deploy | `POST /v1/services/<id>/deploys`, avec la commande `curl` de l'énoncé (`-f` : un HTTP ≥ 400 fait échouer) | clé invalide, service inconnu |
| Wait for the deploy to go live | Interroge le déploiement créé jusqu'à `live`, au plus **40 × 15 s** | `*failed`, `canceled`, `deactivated`, réponse inattendue, délai dépassé |
| Verify the staging service | `/health` **et** `/items` doivent répondre 200, au plus **20 × 15 s** | l'un des deux n'atteint jamais 200 |

**Pourquoi l'attente du déploiement, que l'énoncé ne demande pas :** Render
continue de servir l'ancienne version pendant qu'il construit la nouvelle. Sans
cette attente, les vérifications pourraient réussir **contre l'ancien
déploiement**, et le job serait vert alors que la nouvelle version est cassée.
Si Render ne renvoie pas d'id de déploiement, l'étape est sautée avec un
avertissement visible, et seules les vérifications des endpoints restent.

**Pourquoi `/health` et `/items` :** `/health` ne touche pas la base, il prouve
seulement que le processus tourne. `/items` prouve que `DATABASE_URL` est bon et
que PostgreSQL répond.

## Vérifications effectuées

1. `actionlint` : code de sortie 0.
2. **Faux serveur local** (Python) imitant l'API Render (authentification,
   création du déploiement, progression des statuts) et le service (`/health`,
   `/items`). Les scripts sont extraits de `ci.yml` et exécutés avec le même
   shell que le runner (`bash -eo pipefail`), dans Ubuntu 24.04 avec `jq 1.7`.
   Les `sleep` sont raccourcis.

   | Scénario | Résultat du job |
   |---|---|
   | Tout va bien (`/items` en 500 aux deux premiers essais) | **exit 0**, `live` au 3ᵉ essai, 200/200 au 3ᵉ essai |
   | Le build Render échoue | **exit 1** : `Render deploy ended as build_failed` |
   | Réponse inattendue de l'API | **exit 1** : `Unexpected answer from the Render API` |
   | `/items` toujours en 500 | **exit 1** après 20 essais |
   | Mauvaise clé API | **exit 22** : `curl: (22) … 401` |
   | Secrets et variable absents | **exit 1**, avec la liste de ce qui manque |

3. **Non vérifié :** le comportement du **vrai** Render. La forme des réponses de
   l'API (`id`, `status`) vient de ma connaissance de leur API, pas d'un appel
   réel. En cas d'écart, l'échec sera explicite (« Unexpected answer… ») et non
   silencieux.

## `DEPLOY.md` (commité)

Le runbook couvre, comme demandé : le déclenchement, la cible, la configuration
de la base (`DATABASE_URL` interne, migrations au démarrage de l'app), les deux
requêtes de vérification indépendantes, le **rollback vers le tag du SHA de
commit** et le nettoyage des ressources et des identifiants.

## Points d'attention

1. **Visibilité de l'image : c'est ta décision.** Soit tu rends le package public
   (irréversible ; il ne contient que le code, déjà public dans le dépôt), soit
   tu configures dans Render un registry credential avec un PAT limité à
   `read:packages`.
2. Le plan gratuit de Render met le service en veille après une période
   d'inactivité. Le premier appel peut prendre environ une minute, ce que couvre
   la marge de 20 × 15 s.
3. Le service Render suit `:latest`. Le tag du SHA sert au rollback manuel
   décrit dans `DEPLOY.md`.

## Self Validation (état actuel)

- [ ] Une cible choisie, une base jetable branchée via `DATABASE_URL`, et une
      décision explicite sur la visibilité de l'image : **à faire** (Render est
      prévu dans le code).
- [ ] Identifiants dans le coffre de secrets, aucune valeur dans le workflow, le
      dépôt ou les logs : **côté code, c'est fait**. Il reste à créer les
      secrets.
- [ ] Chaîne complète `test -> build -> deploy` depuis `main`, puis 200 sur
      `/health` et `/items` : **après la configuration de Render**.
- [x] Les vérifications sont bornées et échouent si les deux requêtes ne
      répondent pas 200 (testé sur le faux serveur).
- [x] `DEPLOY.md` couvre le déclenchement, la cible, la base, les deux requêtes,
      le rollback vers un tag immuable et le nettoyage.
