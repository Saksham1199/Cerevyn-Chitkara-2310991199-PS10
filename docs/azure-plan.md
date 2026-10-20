# Azure plan: PS10 Attention and Reaction Time Game

This app is a static, browser-only single page application (SPA). All game logic runs on the player's
device, so the Azure design is deliberately small. **Live deployment is optional for this assessment;
this document is the design and the steps.** Prices and quotas change, so check the current Azure pricing
page before deploying.

## 1. Architecture

```
Developer ── git push ──▶ GitHub ── Actions (ci.yml: install, typecheck, test, build)
                                │
                                └─ manual deploy-azure.yml ──▶ Azure Static Web Apps
                                                                   │  (global CDN, HTTPS)
Player's browser ◀──────────── static files (HTML, JS, CSS) ───────┘
      │
      └─ results stay in the browser (localStorage); JSON export is a client-side download
```

## 2. Compute and storage choices

| Need | Choice | Why |
| --- | --- | --- |
| Hosting the built `dist/` files | **Azure Static Web Apps** (Free plan to start) | Built for SPAs: global CDN, automatic HTTPS, GitHub Actions integration, no server to manage. |
| Backend / database | **None** | Scoring and timing run in the browser. Session results are anonymous and stored in `localStorage`. A server would add cost and risk for no benefit. |
| Alternative considered | Storage account "static website" + Azure Front Door | Works, but more pieces to configure and pay for. Static Web Apps covers this in one resource. |

**Optional extension (not built):** to collect anonymous results from many players, add an Azure Function
(HTTP trigger) in the same Static Web App (`/api`) that writes each exported JSON document to Azure Table
Storage or Blob Storage. The JSON schema in `src/storage/results.ts` is already versioned (`schemaVersion`).

## 3. Identity and secret handling

- The app has **no secrets**: no API keys, no connection strings, no user accounts, no personal data.
- The only secret in the pipeline is the Static Web Apps **deployment token**. It lives in
  **GitHub → Settings → Secrets and variables → Actions** as `AZURE_STATIC_WEB_APPS_API_TOKEN`
  and is read in `deploy-azure.yml` as `${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}`. It is never committed.
- `.env.example` documents the only configuration value (`VITE_SESSION_SEED`). Anything prefixed `VITE_` is
  bundled into public JavaScript, so it must never hold a secret.
- If a backend is added later: use a **managed identity** for the Function to reach Storage (no keys),
  and sign in to Azure from GitHub Actions with **OIDC federated credentials** instead of stored secrets.
- Security headers are set in `public/staticwebapp.config.json`.

## 4. Monitoring

- Static Web Apps gives basic request and bandwidth metrics in the Azure portal.
- Optional: add the Application Insights JavaScript SDK to track page loads and JS errors (no player data).
- GitHub Actions run history is the record of test and build health.

## 5. Deployment steps

1. **Create the resource** (portal, or CLI):
   ```bash
   az login
   az group create --name rg-ps10-attention --location centralindia
   az staticwebapp create --name swa-ps10-attention --resource-group rg-ps10-attention \
     --location eastasia --sku Free
   ```
   (Static Web Apps is only offered in certain regions; `eastasia` is one of them. Pick the nearest supported one.)
2. **Get the deployment token:** Portal → the Static Web App → *Manage deployment token*. Copy it.
3. **Store it in GitHub:** repo → Settings → Secrets and variables → Actions → *New repository secret*
   → name `AZURE_STATIC_WEB_APPS_API_TOKEN`.
4. **Deploy:** repo → Actions → *Deploy to Azure Static Web Apps (manual, optional)* → *Run workflow*.
   The workflow installs, tests, builds, then uploads `dist/`.
5. **Verify:** open the Static Web App URL shown in the portal. Run the practice round and one scored session.
6. **Roll back:** re-run the workflow on an earlier commit (Run workflow → choose the older branch or tag).

## 6. Cost-control assumptions

- The Free plan is enough for a demo; there is nothing to scale because all computing is on the client.
- No database, functions, or storage means no per-request or per-GB compute costs.
- Set a **budget alert** on the resource group (Cost Management → Budgets) so any surprise is caught early.
- Delete the resource group when the assessment is over: `az group delete --name rg-ps10-attention`.
