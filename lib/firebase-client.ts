import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'dojo-platform-b68a3',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const functions = getFunctions(firebaseApp);
export const ADMIN_EMAIL = 'bapanrajbanshi9625@gmail.com';
export const durations = ['30', '45', '60'] as const;

import type { Duration, Pricing } from '../types/admin';

export const emptyPricing: Pricing = {
  '30': { amountPaise: 0, amountRupees: 0, active: false, currency: 'INR' },
  '45': { amountPaise: 0, amountRupees: 0, active: false, currency: 'INR' },
  '60': { amountPaise: 0, amountRupees: 0, active: false, currency: 'INR' },
};
