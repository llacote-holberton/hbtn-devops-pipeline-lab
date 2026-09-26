# À faire en rentrant, dans l'ordre

> Fichier non commité. Tous les commits des tasks 3 à 6 sont prêts sur des
> branches empilées. Il reste à les pousser dans l'ordre et à configurer Render.
> Les commandes marchent depuis n'importe quelle branche.

État actuel : `origin/main` = `d7b7f3c` (task 2 poussée, deux runs).

## 0. Task 2 : vérifier le 2ᵉ run (2 min)

Onglet Actions › run de `d7b7f3c`. L'étape *Cache npm downloads* doit afficher
`Cache restored from key: Linux-npm-…`. Dans la section **Artifacts**, il doit y
avoir `test-reports`. Détails : `task-02_summary.md`.

## 1. Task 3 : publier l'image (3 min)

```bash
git push origin feat/ci-docker-publish:main
```

- Actions : `Test` ✅ puis `Build and publish image` ✅.
- GitHub › ton profil › **Packages** › `hbtn-devops-pipeline-lab` : vérifier que
  le package existe et regarder sa visibilité.
- **Décision de visibilité** (nécessaire pour Render) :
  - **Public** : Package settings › Change visibility. C'est **irréversible**,
    mais l'image ne contient que le code, déjà public dans le dépôt.
  - **Privé** : créer un PAT *classic* limité à `read:packages`, à fournir à
    Render comme registry credential.
- Smoke test (si le package est privé, faire d'abord
  `docker login ghcr.io -u llacote-holberton` avec le PAT) :

  ```bash
  docker pull ghcr.io/llacote-holberton/hbtn-devops-pipeline-lab:latest
  docker run --rm -d --name pipeline-lab-smoke -p 3000:3000 ghcr.io/llacote-holberton/hbtn-devops-pipeline-lab:latest
  curl -s http://localhost:3000/health
  docker stop pipeline-lab-smoke
  ```

## 2. Configurer Render (≈ 15 min, le seul vrai travail manuel)

1. **PostgreSQL** : New › PostgreSQL, plan Free. Après création, copier
   l'**Internal Database URL**.
2. **Web Service** : New › Web Service › depuis une **image existante** :
   `ghcr.io/llacote-holberton/hbtn-devops-pipeline-lab:latest` (avec le registry
   credential si le package est privé).
   - **Même région que la base** : l'URL interne ne fonctionne que dans la même
     région.
   - Plan Free.
   - Variable d'environnement : `DATABASE_URL` = l'Internal Database URL.
   - L'app lit `PORT` et applique ses migrations au démarrage : rien d'autre à
     régler.
3. Une fois le service *live*, noter :
   - l'URL `https://<nom>.onrender.com`. Vérifier que
     `curl https://<nom>.onrender.com/health` et `…/items` répondent 200 ;
   - l'**id du service** (`srv-…`, visible dans l'URL du tableau de bord du
     service).
4. Render › Account settings › **API Keys** › créer une clé.
5. GitHub › dépôt › Settings › Secrets and variables › **Actions** :
   - onglet *Secrets* : `RENDER_API_KEY` et `RENDER_SERVICE_ID` ;
   - onglet *Variables* : `STAGING_URL` = `https://<nom>.onrender.com`, **sans
     slash final**.

## 3. Task 4 : déployer via le pipeline (5 min)

```bash
git push origin feat/ci-staging-deploy:main
```

- Actions : `Test` ✅ → `Build and publish image` ✅ → `Deploy to staging` ✅.
- Puis, indépendamment du pipeline :

  ```bash
  curl -i https://<nom>.onrender.com/health
  curl -i https://<nom>.onrender.com/items
  ```

- Si `Deploy to staging` échoue, le message dit pourquoi : config manquante,
  401, statut du déploiement, ou endpoint pas à 200.

## 4. Task 5 : l'expérience du garde-fou (≈ 8 min, en DEUX pushes)

```bash
# a) Le commit du test en échec, seul :
git push origin 6ccc71d9a21953853bd0eb285fe9e85d8bc61026:main
```

**Attendre la fin de ce run.** Il doit montrer : `Test` ❌ (étape *Run the test
suite*), *Upload the test reports* exécutée, `Build` et `Deploy` **skipped**.

```bash
# b) Puis le revert :
git push origin test/safety-gate:main
```

Ce run doit être entièrement vert. Le staging n'a jamais reçu l'image rouge.

## 5. Task 6 : le badge (2 min)

```bash
git push origin feat/ci-badge-audit:main
```

- Run vert.
- Ouvrir le README sur GitHub : le badge « passing » doit s'afficher, et un clic
  doit mener à la page du workflow CI.

## 6. Remettre `main` à jour en local

```bash
git switch main && git pull --ff-only
```

## 7. Task 7 : le quiz sur l'intranet

Fiche de révision dans `task-07_summary.md`.

## À noter

- `feat/cicd-labs` (ton commit de `PROJECT_README.md`) n'est **pas** dans `main`.
- Écart de Node : 24 en CI, 20 dans le `Dockerfile` (voir `task-03_summary.md`).
- Seulement 2 commits `fix(ci)` sur 3 pour la task 1 (voir
  `task-01_summary.md`).
- Fin du lab : nettoyage décrit dans `DEPLOY.md` › Cleanup.
