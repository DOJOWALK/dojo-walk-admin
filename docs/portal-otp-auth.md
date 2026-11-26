# Portal mobile OTP authentication

## Implemented in the feature branch

- Walker and Customer portal login screens now request and verify a six-digit mobile OTP instead of asking for a password.
- OTP challenges are stored in D1 as HMAC hashes (not plaintext), expire after five minutes, allow at most five verification attempts, are one-time use, and resend is limited to three per 15-minute phone window.
- A new OTP request invalidates earlier outstanding challenges for the same role and phone.
- OTP verification creates the existing role-scoped portal session only after checking the linked account.
- The old password-based portal login API returns HTTP 410. Admin password login is separate and unchanged.
- Existing portal sessions are revoked by migration 0015 so old password-authenticated sessions do not bypass OTP-only login.
- Walker status is checked after OTP verification. Suspended, On Leave, Exited, Pending, and other non-active states are denied with a clear message. Active employment status is also re-checked for every authenticated request.
- Unknown Walker mobile numbers are told that no Walker registration exists. Walker self-registration is not allowed; Admin must create the Walker record and portal access.
- Customer OTP sign-in currently supports an existing Customer record with an already linked portal account. Customer self-registration and safe automatic linking are still pending.

## SMS delivery binding (not configured yet)

The app expects a Cloudflare service binding named `SMS_OTP` and a Worker secret named `OTP_PEPPER`.

The binding must accept a POST request at `https://sms-otp.internal/send` with JSON:
```json
{
  "to": "+919876543210",
  "code": "123456",
  "role": "walker",
  "expires_in_minutes": 5,
  "template": "dojo_walk_login_otp"
}
```

It must return a 2xx response only after the SMS provider has accepted the message, and a non-2xx response on delivery/provider failure. The SMS Worker must keep provider credentials in its own Cloudflare secrets, use an approved India DLT/template/sender configuration where required, and never log OTP codes. The portal Worker does not log or persist plaintext OTPs.

Neither `SMS_OTP` nor `OTP_PEPPER` is currently configured. Therefore OTP requests fail closed with a setup message; no SMS is sent until the binding and secret are configured. No test OTP or hard-coded bypass exists.

## Walker sign-in behavior

1. Walker enters their registered mobile number.
2. Backend finds the existing Walker record. Unknown number: show that it is not registered and direct them to Admin.
3. OTP is sent only to the phone stored on that Walker record.
4. After OTP verification, check both the Walker record status and HR employment status:
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
- Customer self-registration must verify phone ownership before linking a legacy Customer record or creating a new record; ambiguous duplicate phone matches must go to support, never guess.
- SMS provider selection, DLT/template registration, Cloudflare service binding, and secrets must be completed before deployment.
- Migration history must be reconciled before applying migration 0015. It revokes existing portal sessions intentionally; Admin sessions are not affected.
- Admin accounts continue using the existing Admin authentication system.
