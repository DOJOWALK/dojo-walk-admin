# Portal mobile OTP authentication

## Implemented in the feature branch

- Walker and Customer portal login screens request and verify a six-digit mobile OTP instead of asking for passwords.
- MSG91 SendOTP API delivers the OTP; MSG91 Verify OTP API validates it before the portal session is issued.
- The application also stores an HMAC hash of the generated OTP in D1, never the plaintext. Challenges expire in five minutes, allow at most five verification attempts, are one-time use, and resend is limited to three per 15-minute phone window.
- A new OTP request invalidates earlier outstanding challenges for the same role and phone.
- The old password-based portal login and change-password APIs return HTTP 410. Admin password login is separate and unchanged.
- Admin Portal Access creates, enables, and disables OTP-only accounts; it no longer asks Admins to create or reset portal passwords. Random unusable password placeholders remain only because the existing D1 schema has non-null legacy password columns.
- Existing portal sessions are revoked by migration 0015 so old password-authenticated sessions do not bypass OTP-only login.
- Walker status is checked after OTP verification. Suspended, On Leave, Exited, Pending, and other non-active states are denied with a clear message. Active employment status is also re-checked for every authenticated request.
- Unknown Walker mobile numbers are told that no Walker registration exists. Walker self-registration is not allowed; Admin must create the Walker record and portal access.
- Customer can self-register with name, mobile number, and address. Account creation and activation happen automatically only after MSG91 verifies phone ownership; Admin approval is not required.
- If a verified phone matches exactly one active legacy Customer record, the portal account is safely linked to that record instead of creating a duplicate. Multiple matches, inactive records, or conflicting portal links are rejected and sent to Admin support.
- New registrations are held as short-lived pending details and become a Customer + active portal account together after OTP verification.

## Demo OTP testing mode

- Set `PORTAL_OTP_MODE=demo` only in a non-production testing environment to bypass MSG91 sending and verification.
- In this mode, the six-digit OTP is returned by the request endpoint and shown on the portal login screen for testing. The OTP is still stored only as an HMAC hash in D1, expires in five minutes, allows at most five attempts, and is one-time use.
- Clear `PORTAL_OTP_MODE` (or set it to `msg91`) to return to real MSG91 delivery. Do not enable demo mode on a public production login: anyone who can request an OTP can read the displayed code. No SMS is sent in demo mode.

## MSG91 configuration required

Set these Cloudflare Worker variables/secrets for the `dojo-walk-admin` Worker:

- `MSG91_AUTHKEY` — secret from MSG91 account. Store as a Cloudflare Worker secret; never commit it to Git or send it in chat.
- `MSG91_OTP_TEMPLATE_ID` — OTP template ID from the MSG91 OTP section. The approved template must include `##OTP##`.
- `OTP_PEPPER` — a long random secret used to HMAC-hash the OTP in D1.

The app calls:

- Send OTP: `POST https://control.msg91.com/api/v5/otp?template_id=...&mobile=...&otp=...&otp_length=6&otp_expiry=5&realTimeResponse=1`
- Verify OTP: `GET https://control.msg91.com/api/v5/otp/verify?otp=...&mobile=...`

Both calls send the MSG91 Authkey in the `authkey` header. The app checks the response `type` equals `success`; HTTP 200 alone is not enough for Verify OTP. MSG91's own docs specify international-format mobile numbers and an OTP template containing `##OTP##`.

Before production use, create/approve the OTP template in MSG91 and complete the applicable Indian DLT registration, sender/template approvals and wallet funding. MSG91's published India OTP rate varies by volume; check the current account rate card before adding balance. No SMS is sent until all three Worker settings are present.

## Customer self-registration behavior

1. Customer chooses “New customer? Register here”.
2. Customer enters name, mobile number, and full address; area is optional.
3. Backend checks existing Customer records using normalized Indian mobile number.
4. If exactly one active legacy record matches, it is retained and linked after successful OTP verification. If no record matches, temporary registration details are held for 15 minutes.
5. MSG91 verifies the OTP. Only then are a new Customer record (if needed) and active Customer portal account created together in one D1 batch.
6. Duplicate phone matches, inactive legacy records, or an already-conflicting portal account are not linked automatically; user is directed to Admin support.

No Admin approval is required for a normal verified Customer registration.

## Walker sign-in behavior

1. Walker enters their registered mobile number.
2. Backend finds the existing Walker record. Unknown number: show that it is not registered and direct them to Admin.
3. OTP is sent only to the phone stored on that Walker record.
4. After successful MSG91 verification, check both the Walker record status and HR employment status:
   - Active: allow sign-in if the Admin-created portal account is enabled.
   - Suspended: deny sign-in and show Suspended.
   - On Leave: deny sign-in and show On Leave.
   - Exited, Pending, inactive, or any other non-active state: deny sign-in and show the relevant status.
5. Walker sessions remain limited to that Walker's assigned walks and authorized data.

A phone match alone never grants access. Walker self-registration is not allowed.

## Security / rollout

- Keep Walker and Customer role scopes separate.
- Do not reveal a registered account's status before OTP ownership verification.
- Re-check account status on every authenticated request.
- Customer self-registration verifies phone ownership before linking a legacy Customer record or creating a new record; ambiguous duplicate phone matches go to support, never guess. The registration draft expires after 15 minutes.
- Migration history must be reconciled before applying migrations 0015 and 0016. Migration 0015 revokes existing portal sessions intentionally; Admin sessions are not affected.
- Admin accounts continue using the existing Admin authentication system.
- No production migration or Worker deployment has been made.
