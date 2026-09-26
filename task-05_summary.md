# Task 5 — Prove the Safety Gate : récapitulatif

> Notes personnelles, fichier non commité.

## Résultat

Les deux commits de l'expérience sont prêts : le test en échec, puis son
`git revert`. **L'expérience elle-même n'a pas encore eu lieu** : il faut pousser
ces deux commits l'un après l'autre sur `main`, en attendant la fin du premier
run. Commandes dans `todo-retour.md`.

Fais-la **après** avoir configuré Render (task 4). Sinon le pipeline de départ et
celui du revert ne peuvent pas être verts, alors que la Self Validation le
demande.

## Commits (branche `test/safety-gate`, au-dessus de la task 4)

| Commit | Date | Message |
|---|---|---|
| `2282965` | 2026-09-21 18:31 | Safety gate - Tests: Add a deliberately failing test (temporary) |
| `60aca70` | 2026-09-21 18:36 | Revert "Safety gate - Tests: Add a deliberately failing test (temporary)" |

- Le test en échec est isolé dans **son propre fichier**,
  `tests/unit/safety-gate.test.js`, avec le code exact de l'énoncé. Le revert
  supprime ce fichier et rien d'autre.
- Le revert a été créé avec `git revert --no-edit`. Son message contient
  « This reverts commit 2282965c… ».

## Ce qu'on doit observer

**Run du commit `2282965` (rouge) :**

| Job / étape | État attendu | Pourquoi |
|---|---|---|
| `Test` › Lint the sources | ✅ success | le fichier de test respecte les règles ESLint (vérifié) |
| `Test` › Run the test suite | ❌ **failure** | `Tests: 1 failed, 11 passed, 12 total` |
| `Test` › Upload the test reports | ✅ **exécutée** | `if: always()` ; le rapport contient `failures="1"` |
| `Build and publish image` | ⏭ **skipped** | `needs: test`, et `test` n'a pas réussi |
| `Deploy to staging` | ⏭ **skipped** | `needs: build`, et `build` n'a pas tourné |

**Run du revert `60aca70`** : tout redevient vert, `test → build → deploy`.

### Échec ou « skipped » : la différence

- Un job **failed** a démarré et une de ses étapes a renvoyé un code non nul. Il
  a un log qui montre l'erreur.
- Un job **skipped** n'a jamais démarré : sa condition `needs` (tous les jobs
  requis doivent réussir) n'était pas remplie. Il n'a ni runner ni log.
  L'avantage, c'est qu'aucune image n'est construite et que rien n'est déployé à
  partir d'un code rouge.
- En conséquence, le staging garde l'image du dernier run vert : le commit rouge
  ne l'a jamais remplacée.

## Vérifications effectuées (en local)

Les étapes du job `test` ont été rejouées à partir de `ci.yml`, avec le fichier
en échec présent, en Node 24 + Postgres 16 :

- lint : exit 0 ;
- `Tests: 1 failed, 11 passed, 12 total`, étape en **exit 1** ;
- `reports/junit.xml` est bien écrit : `<testsuites … tests="12" failures="1">`.
  C'est ce que l'étape d'upload doit récupérer.

## Self Validation (à cocher après les deux pushes)

- [ ] Le pipeline est vert au départ, puis le test en échec arrive dans son
      propre commit temporaire sur `main`.
- [ ] Dans le run rouge, `test` échoue, et `build` et `deploy` restent
      *skipped*.
- [ ] L'upload du rapport a tourné après l'échec, et l'image de staging n'a pas
      été remplacée.
- [ ] Le revert est poussé sur `main` et le pipeline complet suivant est vert.
