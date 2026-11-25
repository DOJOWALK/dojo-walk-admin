# Dojo Walk Admin

Private, single-admin operations dashboard for Dojo Walk. The source repository is public; customer records, dog details, payments, and walk media must remain private behind admin authentication.

## Planned stack
- Next.js + TypeScript
- Cloudflare Workers (OpenNext adapter)
- Cloudflare D1 for operational records
- Cloudflare R2 private bucket for walk photos
- Manual WhatsApp links (admin reviews and sends messages)

## Business rules
- Morning + Evening: ₹2,999/month, two 30-minute walks per day
- One walk daily: ₹1,999/month, one 30-minute walk per day
- Temporary Morning + Evening: ₹150/day, two 30-minute walks
- Single walk: ₹100, one 30-minute walk
- Weekly off: Sunday; exceptional Sunday bookings may be recorded
- Monthly plans are calculated over 26 working days (Monday–Saturday)
- Cancellation settlement = (monthly fee / 26 × used working days) + ₹299 cancellation fee − advance received; round to nearest rupee

## Security principles
- One admin only; no staff or customer login
- Never commit secrets, customer data, credentials, or real walk photos
- Keep R2 private; serve media only through authenticated, short-lived access
- Public GitHub repository does not mean public app data

## Development
The project is being bootstrapped. Follow the Cloudflare setup guide in `docs/DEPLOYMENT.md` before deploying. Do not run a production deployment until D1, R2, and admin secrets are configured.
