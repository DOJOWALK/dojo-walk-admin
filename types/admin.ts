export type Duration = '30' | '45' | '60';

export type WalkerApplication = {
  walkerId: string;
  displayName: string;
  email: string;
  phone: string;
  city: string;
  pincode: string;
  createdAt: string | null;
};

export type AdminBooking = {
  bookingId: string;
  customerId: string;
  walkerId: string | null;
  petName: string;
  city: string;
  pincode: string;
  address: string;
  durationMinutes: number;
  scheduledAt: string | null;
  status: string;
  paymentStatus: string;
  paymentReviewRequired: boolean;
  createdAt: string | null;
};

export type AssignableWalker = {
  walkerId: string;
  displayName: string;
  city: string;
  pincode: string;
};

export type ServiceArea = {
  city: string;
  pincode: string;
  enabled: boolean;
  walkerCount: number;
};

export type Pricing = Record<Duration, {
  amountPaise: number;
  amountRupees: number;
  active: boolean;
  currency: string;
}>;
