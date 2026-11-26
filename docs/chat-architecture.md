# Dojo Walk Chat Architecture

## Scope
- Walk Chat: one conversation per walk, limited to that walk's assigned walker and booking customer.
- Support Chat: one open support conversation per customer or walker; Admin can reply.
- Messages: plain text up to 4,000 characters and optional photo attachment.
- Video, audio, voice notes, and video calls are deliberately unsupported.

## Storage
Migration `0008_chat_schema.sql` adds `chat_conversations` and `chat_messages`. Photo objects are private R2 objects; only their opaque object key and validated image metadata are stored in D1. Allowed photo MIME types are JPEG, PNG, and WebP; maximum size is 10 MiB.

## Required authorization before enabling routes
1. Keep the existing Admin cookie and Admin login unchanged.
2. Portal sessions must use a separate cookie and server-side session lookup.
3. Every Walk Chat read/write must verify the current walker is assigned to that walk or the current customer owns the booking for that walk.
4. Every Support Chat read/write must verify the customer/walker participant; Admin access must use Admin authentication only.
5. Never accept sender role, sender ID, participant IDs, or R2 object keys as trusted client input. Derive identity from the authenticated session.
6. Photo upload/download must go through authenticated server routes and private R2. Validate actual file bytes, MIME, size, and ownership. Never expose public object URLs.
7. Add rate limits, origin/CSRF protection, pagination, unread/read handling, and audit events before production use.

## Rollout gates
- Reconcile the existing migration history before applying any migration: production D1 currently has no `d1_migrations` table.
- Test the migration on an isolated copy of D1 and verify foreign keys and indexes.
- Enable R2 in Cloudflare before implementing photo upload/download.
- Implement portal authentication and role/ownership checks before exposing chat APIs.
- Run Admin regression and cross-account authorization tests.
- Do not deploy without explicit approval.
