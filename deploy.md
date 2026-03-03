# Deploy / Run Guide

This guide is for `tecompanytea/shopify-subscriptions`.

## 1) One-time setup on a new machine

```bash
git clone https://github.com/tecompanytea/shopify-subscriptions.git
cd shopify-subscriptions
pnpm install
```

Login to Shopify CLI:

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

## 2) Run locally (daily)

```bash
cd shopify-subscriptions
pnpm shopify app dev --store tecompany-dev.myshopify.com -c shopify.app.subscriptions-application.toml
```

If asked for storefront password, use your dev-store password from:
- `Online Store -> Preferences`

When ready, open the app from the Preview URL shown in terminal.

Current app URL format:
- `https://admin.shopify.com/store/tecompany-dev/apps/<app-client-id>?dev-console=show`

## 3) If the app/tunnel dies

This is normal for Cloudflare dev tunnels. Restart with the same command:

```bash
pnpm shopify app dev --store tecompany-dev.myshopify.com -c shopify.app.subscriptions-application.toml
```

## 4) Create a test subscription contract

1. In app, go to `Plans` and create a plan.
2. Attach it to a product and save.
3. Make sure product is published to Online Store.
4. In theme editor, ensure subscription app block/widget is enabled on product template.
5. In `Settings -> Payments`, enable a test gateway (Bogus).
6. Buy the product on storefront as a **subscription** (not one-time).
7. Refresh app home (contracts page) to see the contract.

## 5) Push code changes

```bash
git add -A
git commit -m "your message"
git push origin main
```

## 6) Production deploy checklist (optional)

Use this only when you want a permanent hosted app (not local dev tunnel):

1. Create hosting project (ex: Vercel) connected to this GitHub repo.
2. Use a persistent database (not local SQLite file).
3. Set production env vars in host.
4. Set app URLs/redirect URLs to production domain.
5. Run Shopify deploy:

```bash
pnpm shopify app deploy -c shopify.app.subscriptions-application.toml
```

6. Install/update app in target store from Shopify Admin.

---

## Quick command reference

- Install deps: `pnpm install`
- Dev server: `pnpm shopify app dev --store tecompany-dev.myshopify.com -c shopify.app.subscriptions-application.toml`
- Shopify CLI version: `pnpm shopify version`

