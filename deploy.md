# Deploy / Run Guide

This guide is for `tecompanytea/shopify-subscriptions`.

## 1) One-time setup on a new machine

```bash
git clone https://github.com/tecompanytea/shopify-subscriptions.git
cd shopify-subscriptions
pnpm install
```

You also need a Postgres database for the app's session storage and
business data. The fastest options:

- **Vercel + Neon** (recommended for hosted dev): import the repo into
  Vercel, then add the Neon integration from the marketplace. Neon auto-
  populates `DATABASE_URL` and `DATABASE_URL_UNPOOLED` for every
  environment.
- **Local Docker** (recommended for local dev/tests):
  ```bash
  docker run --rm -d --name pg \
    -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16
  export DATABASE_URL=postgresql://postgres:dev@localhost:5432/postgres
  export DATABASE_URL_UNPOOLED="$DATABASE_URL"
  pnpm setup:dev
  ```

Login to Shopify CLI (only needed for `pnpm shopify app dev` /
`pnpm shopify app deploy`):

```bash
pnpm shopify auth login
```

Link the app config (first time only):

```bash
pnpm shopify app config link --reset
```

When prompted:
- Choose existing app: `Subscriptions application`
- Use config file: `shopify.app.subscriptions-application.toml`

## 2) Deploy to Vercel (hosted dev / staging / prod)

The `react` branch ships the `@vercel/react-router` preset and a
`vercel.json`, so Vercel detects this as a React Router 7 app.

1. **Create a Vercel project** pointing at this repo, branch `react`
   (or `main` once it's merged).

2. **Add a Postgres database.** Easiest path: open the project on
   Vercel → Storage → Connect Database → Neon. The integration sets
   `DATABASE_URL` and `DATABASE_URL_UNPOOLED` automatically.

3. **Add the Shopify env vars** under Project Settings → Environment
   Variables (apply to all environments unless you're running multiple
   apps):
   - `SHOPIFY_API_KEY` — `client_id` from `shopify.app.subscriptions-application.toml`.
   - `SHOPIFY_API_SECRET` — get this from Partner Dashboard → Apps →
     Subscriptions application → API credentials.
   - `SHOPIFY_APP_URL` — Vercel deployment URL, e.g.
     `https://shopify-subscriptions-react.vercel.app`.
   - `SCOPES` — copy the comma-separated list from the toml's
     `[access_scopes].scopes`.

4. **Deploy.** Vercel runs `npm run setup && npm run build`, which
   generates the Prisma client, applies pending migrations to the
   Neon DB, and builds the React Router bundle.

5. **Update the Shopify app config** with the Vercel URL (Partner
   Dashboard or via CLI). The simplest option is the toml: edit
   `shopify.app.subscriptions-application.toml`:
   ```toml
   application_url = "https://shopify-subscriptions-react.vercel.app"

   [auth]
   redirect_urls = [
     "https://shopify-subscriptions-react.vercel.app/auth/callback",
     "https://shopify-subscriptions-react.vercel.app/auth/shopify/callback",
     "https://shopify-subscriptions-react.vercel.app/api/auth/callback",
   ]
   ```
   Then push and run:
   ```bash
   pnpm shopify app deploy -c shopify.app.subscriptions-application.toml
   ```

6. **Install on the dev store** at
   `https://admin.shopify.com/store/tecompany-dev/apps`, find the app
   in Apps → "Develop apps" → Install.

### What works on Vercel out of the box

- All synchronous routes: contracts list / detail / edit, plans, settings.
- Embedded Shopify admin shell (App Bridge, Polaris wrapper).
- Webhooks (point Shopify at `https://<vercel-url>/webhooks/...`).
- i18n with all 21 locales.

### What still needs the existing GCP setup (or a Vercel port)

- **Cloud Tasks → background jobs**: subscription billing emails, dunning,
  scheduled plan operations. They run via `/internal/jobs/run`, which
  expects POSTs from Google Cloud Tasks. Vercel Cron / Inngest / QStash
  are reasonable replacements; not in scope for the migration.
- **Google Cloud Storage**: bulk-operation file uploads. Vercel Blob is
  the obvious replacement.

## 3) Run locally (daily)

```bash
pnpm shopify app dev --store tecompany-dev.myshopify.com -c shopify.app.subscriptions-application.toml
```

Requires an active `DATABASE_URL` env (see step 1). If asked for the
storefront password, use the dev-store password from
`Online Store → Preferences`.

App URL when running locally:
`https://admin.shopify.com/store/tecompany-dev/apps/<app-client-id>?dev-console=show`

If the Cloudflare tunnel dies (it will), restart with the same
command — that's normal.

## 4) Create a test subscription contract

1. In the app, go to `Plans` and create a plan.
2. Attach it to a product and save.
3. Make sure the product is published to Online Store.
4. In the theme editor, enable the subscription app block / widget on
   the product template.
5. In `Settings → Payments`, enable a test gateway (Bogus).
6. Buy the product on the storefront as a **subscription** (not one-time).
7. Refresh the app home (contracts page) to see the contract.

## 5) Push code changes

```bash
git add -A
git commit -m "your message"
git push origin react   # or main, once merged
```

## Quick command reference

- Install deps: `pnpm install`
- Build: `pnpm build`
- Type-check: `pnpm type-check`
- Tests (needs `DATABASE_URL` for DB-using tests): `pnpm test`
- Local dev: `pnpm shopify app dev --store tecompany-dev.myshopify.com -c shopify.app.subscriptions-application.toml`
- Deploy app metadata to Shopify: `pnpm shopify app deploy -c shopify.app.subscriptions-application.toml`
- Generate GraphQL types (one-off, needs `SHOPIFY_API_KEY`):
  ```bash
  SHOPIFY_API_KEY=<client_id from toml> pnpm graphql-codegen
  ```
- Shopify CLI version: `pnpm shopify version`
