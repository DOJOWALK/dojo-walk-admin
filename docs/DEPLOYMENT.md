# Cloudflare deployment checklist

This repository is only the application source. No Cloudflare resource has been created and no production deployment has been performed yet.

## Before deployment
1. Create a Cloudflare Worker named `dojo-walk-admin`.
2. Create a D1 database named `dojo-walk-db`, then copy its database ID into `wrangler.jsonc`.
3. Create a private R2 bucket named `dojo-walk-private-photos`.
4. Confirm the Worker has D1 binding `DB` and R2 binding `WALK_PHOTOS`.
5. Set Worker secrets `ADMIN_PASSWORD` and `SESSION_SECRET`. Use a unique, strong admin password and a random session secret. Do not put secrets in GitHub.
6. Apply the SQL migration: `npx wrangler d1 migrations apply dojo-walk-db --remote`.
7. Install dependencies, run a local build/preview, and verify authentication and database access before production deploy.

## Costs and safety
- Start with Cloudflare free allowances, but usage, account terms, and limits can change. No paid plan or billing upgrade should be enabled without explicit approval.
- Keep the R2 bucket private. Never expose bucket credentials or public object URLs.
- Backups should be configured and tested before storing real customer records.
- The GitHub repository is public by choice. Never commit customer data, dog profiles, walk photos, passwords, API tokens, or database exports.

## Admin access
The application must remain single-admin. No customer portal, staff accounts, or public customer data pages are in scope.
