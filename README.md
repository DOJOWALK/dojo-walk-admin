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
