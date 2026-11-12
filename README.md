# DOJO WALK Admin

Next.js admin dashboard with Firebase Authentication and server-enforced admin pricing controls.

## Firebase configuration

Copy `.env.example` to `.env.local` and fill the public Firebase web-app values from Firebase Console → Project settings → Your apps. These are Firebase client configuration values, not Razorpay secrets.

Enable Email/Password Authentication. The admin account must have the Firebase custom claim `admin: true`. Assign this claim only from a trusted, access-controlled environment using the Firebase Admin SDK; never from the browser or a public callable.

## Walk pricing

The dashboard reads and updates:

- `bookingPricing/30`
- `bookingPricing/45`
- `bookingPricing/60`

It calls admin-only backend functions `getBookingPricing` and `setBookingPricing`. The server checks the custom admin claim. Prices are entered in rupees and stored as integer paise. A price of ₹0 is saved as `active: false`, and Razorpay order creation refuses to proceed for that duration until an admin sets a positive price. The customer app reads the current trusted server price at order creation; the customer cannot submit or override an amount.

## Run

```bash
npm install
npm run dev
```

Deploy the Firebase Functions from `DOJOWALK/dojo-walk-firebase` before using the pricing dashboard. No production admin user, custom claim, web-app configuration, or deployment has been created by this code change.

## Assign the first admin account (trusted operator only)

1. Create the admin user's account with Email/Password sign-in enabled, or confirm the account already exists.
2. In a trusted machine, install the Firebase CLI and authenticate to the Firebase project with an account that has permission to manage Firebase Authentication.
3. Download a service-account JSON only through the Google Cloud/Firebase Console to a private location outside this repository. Do not upload it or commit it.
4. From `DOJOWALK/dojo-walk-firebase/functions`, set the credential path and run:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/absolute/private/path/service-account.json"
npm install
npm run set-admin-claim -- admin@example.com
unset GOOGLE_APPLICATION_CREDENTIALS
```

Replace the example email with the intended admin account. The script preserves existing custom claims and sets only `admin: true`. The admin must sign out and back in to refresh the ID token. Never expose the service-account file or grant the claim to an unverified account.
