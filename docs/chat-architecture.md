# Dojo Walk Chat Architecture

## Scope
- Walk Chat: one conversation per walk, limited to that walk's assigned walker and booking customer.
- Support Chat: one open support conversation per customer or walker; Admin can reply.
- Messages: plain text up to 4,000 characters; photo attachments are planned but not active until private R2 is enabled.
- Video, audio, voice notes, and video calls are deliberately unsupported.

## Current branch implementation
- Separate Walker/Customer login endpoints and `dojo_walk_portal` cookie; Admin login remains unchanged.
- Passwords use PBKDF2-HMAC-SHA-256 with a per-account random salt; session tokens are random and only SHA-256 hashes are stored.
- Portal sessions are server-side, expire after 14 days, can be revoked, and are checked against active portal accounts.
- Login attempts are limited per role + normalized phone number; five failed attempts trigger a 15-minute lock.
- Admin-only APIs provision, disable, enable, and reset portal accounts.
- Portal dashboard and chat screens exist for both roles. Walk chat access is checked against current walk assignment / booking ownership. Support chat access is restricted to the participant.
- Admin Support Inbox uses the existing Admin cookie and has reply/close controls.
- POST chat operations check same-origin requests. Messages are plain text only for now.
- Walker Start Walk / Complete Walk controls and role-checked APIs are implemented on the branch. `started_at` is used to derive `in_progress`, while the stored status remains `scheduled` until completion; this avoids rebuilding the production `walks` table and preserves its child rows.
- `0011_walk_events.sql` records Walker start/completion events. Photo upload/download, realtime push, and broader audit-event coverage are not yet implemented.

## Storage
- `0008_chat_schema.sql`: `chat_conversations` and `chat_messages`. Chat photo metadata is constrained to JPEG, PNG, or WebP and a maximum of 10 MiB.
- `0009_portal_auth.sql`: portal users, server-side sessions, and login attempt state.
- `0010_walker_assignment_tables.sql`: declares the existing lazily-created `walkers` and `walk_assignments` tables for fresh database installs. Existing tables are preserved by `IF NOT EXISTS`.
- `0011_walk_events.sql`: records walk start/completion events without changing the existing walks status constraint.
- Photo objects must be private R2 objects; only opaque keys and validated metadata belong in D1. Never expose public object URLs.

## Security requirements before production
1. Keep the existing Admin cookie and Admin login unchanged.
2. Never accept sender role, sender ID, participant IDs, or R2 object keys as trusted client input. Derive identity from the authenticated session.
3. Every Walk Chat read/write must verify the current walker is assigned to that walk or the current customer owns the booking for that walk.
4. Every Support Chat read/write must verify the customer/walker participant; Admin access must use Admin authentication only.
5. Photo upload/download must go through authenticated server routes and private R2. Validate actual file bytes, MIME, size, and ownership. Never expose public object URLs.
6. Add message rate limits, audit events, and deeper CSRF testing before production use.
7. Run cross-account tests: Walker A cannot access Walker B's walk; Customer A cannot access Customer B's walk; neither can access another user's support conversation; portal sessions cannot call Admin APIs.

## Rollout gates
- Reconcile the existing migration history before applying any migration: production D1 currently has no `d1_migrations` table. Do not run the migrations blindly.
- Test all migrations on an isolated copy of D1 and verify foreign keys, indexes, and preservation of existing records.
- The existing `walks.status` CHECK constraint does not allow `in_progress`. The current implementation intentionally avoids that value in D1 and derives the UI state from `started_at`; do not change the constraint without a separately tested data-preserving migration.
- Enable R2 in Cloudflare before implementing photo upload/download.
- Run Admin regression, portal login, session revocation, and cross-account authorization tests.
- Do not merge or deploy without explicit approval.
