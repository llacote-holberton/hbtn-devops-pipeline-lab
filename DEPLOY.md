# Staging deployment runbook

## Trigger

A push to `main` runs `test`, then `build`, then `deploy`
(`.github/workflows/ci.yml`). Pull requests only run `test`. The `deploy` job:

1. checks that the staging secrets and variable exist;
2. asks Render to deploy the service (`POST /v1/services/<id>/deploys`);
3. waits until that deploy is `live` (at most 40 × 15 s);
4. requires HTTP 200 from both `/health` and `/items` (at most 20 × 15 s).

Any failure in these steps makes the job, and the run, fail.

## Target

- **Render Web Service** deployed from the image
  `ghcr.io/llacote-holberton/hbtn-devops-pipeline-lab:latest`, built and pushed
  by the `build` job. The same image is also tagged with the full commit SHA.
- **Render PostgreSQL**, a disposable database used only by this lab.

The image can be pulled in one of two ways:

- the GHCR package is public (it contains only the application code, which is
  already public in this repository); **making a package public cannot be
  undone**;
- or the Render service has a registry credential: the GitHub username plus a
  personal access token limited to `read:packages`.

## Configuration

| Where | Name | Value |
|---|---|---|
| GitHub › Settings › Secrets and variables › Actions › **Secrets** | `RENDER_API_KEY` | Render API key (Account settings › API keys) |
| GitHub › Settings › Secrets and variables › Actions › **Secrets** | `RENDER_SERVICE_ID` | Service id, `srv-…`, visible in the service URL |
| GitHub › Settings › Secrets and variables › Actions › **Variables** | `STAGING_URL` | `https://<service>.onrender.com`, **no trailing slash** |
| Render › Web Service › Environment | `DATABASE_URL` | The database's **internal** connection string |

The application applies its migrations at startup (`src/db/migrate.js`), so a
fresh database needs no manual step. No credential value is stored in the
workflow, the repository or this runbook.

## Verification

Run both requests independently after a deploy:

```bash
curl -i "$STAGING_URL/health"   # 200 {"status":"ok"} : the process is alive
curl -i "$STAGING_URL/items"    # 200 [...]           : the API can query PostgreSQL
```

`/health` does not touch the database. Only `/items` proves that `DATABASE_URL`
is correct and the database is reachable.

## Rollback

Every release is also tagged with its commit SHA, which never moves.

1. Pick the last good commit on `main` (its run was green) and copy its full SHA.
2. Render › Web Service › Settings › Image URL: set
   `ghcr.io/llacote-holberton/hbtn-devops-pipeline-lab:<full-sha>` and save.
3. Start a deploy from the service's **Manual Deploy** menu, then run the two
   verification requests above.
4. Fix forward on `main` (for example with `git revert`), then set the Image URL
   back to `:latest` so the pipeline deploys again.

## Cleanup

When the lab is no longer needed:

1. Delete the Render Web Service and the Render PostgreSQL database.
2. Revoke the Render API key (Account settings › API keys).
3. Delete the `RENDER_API_KEY` and `RENDER_SERVICE_ID` secrets and the
   `STAGING_URL` variable from the repository.
4. If a registry credential was used, delete it in Render and revoke the
   `read:packages` token on GitHub.
5. Delete the GHCR package or keep it, depending on your cleanup policy.
   A package that was made public cannot be made private again.
