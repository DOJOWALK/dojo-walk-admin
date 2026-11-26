# Portal mobile OTP authentication

## Required sign-in behavior

Walker and Customer portals use mobile-number OTP verification. The Admin password login and Admin session cookie remain separate and unchanged.

### Walker sign-in

1. The Walker enters their registered mobile number.
2. The server normalizes the number and looks up an existing Walker record. Walker self-registration is not allowed; only Admin-created Walker records can sign in.
3. An OTP is sent to the registered number through the configured SMS provider.
4. The server verifies the OTP (short expiry, hashed at rest, bounded attempts, resend throttling, and one-time use).
5. Only after successful OTP verification does the server evaluate account status and issue a Walker session:
   - Active: allow sign-in.
   - Suspended: show that the account is suspended and direct the Walker to Admin.
   - On leave: show that the account is currently on leave.
   - Exited/inactive/disabled or any other non-active state: deny sign-in and show a clear status-specific message where the state is known.
   - Missing Walker record: show that the mobile number is not registered and direct the person to Admin.
6. A valid session still only authorizes that Walker's own assigned walks and permitted profile/chat data.

Do not rely on an OTP sent to a number supplied by the user unless that number is the phone stored on the Walker record. Do not issue a session for any non-active account.

### Customer sign-in

- Customer self-registration is allowed and does not require Admin approval.
- Verify mobile ownership by OTP before linking an existing Customer record or creating a new one.
- A phone match alone must never grant access to an existing Customer record.
- If multiple existing records match, or the record is already linked to another portal identity, stop and route the case to Admin/support rather than guessing.
- Customer status and portal account state are checked server-side before issuing a session.

## SMS provider requirement

No SMS OTP provider/API is currently configured in this project. The app must not pretend an OTP was sent or accept a hard-coded/test OTP in production. OTP delivery remains blocked until a provider is selected and its credentials/sender configuration are added as Cloudflare Worker secrets. The provider adapter must fail closed with a clear setup error when configuration is absent.

## Security requirements

- Store only a cryptographic hash of each OTP, never the plaintext code.
- Use a short expiry, one-time consumption, bounded verification attempts, and per-number/IP request throttles.
- Keep Walker and Customer role scopes separate.
- Do not reveal account status before the phone owner proves control of the number; after OTP verification, provide the specific status message requested for the account.
- Re-check account status on every authenticated request, not only at login.
- Admin accounts continue using the existing Admin authentication system.
