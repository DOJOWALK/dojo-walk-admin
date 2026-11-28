# Dojo Walk Management: HR, Pricing and Settlements

## Purpose
This is an additive schema foundation for the Admin Management system. It does not change existing customer, dog, booking, walk, payment, or walker rows.

## Walker HR
- `walker_employment_profiles` stores full-time/part-time classification, employment status, pay basis, hire date, weekly rest days, and Admin notes.
- `walker_leave_requests` stores requested leave periods and Admin approval/rejection.
- Walker onboarding remains Admin-only. Employee code stays in the existing `walkers.walker_code` field; portal login uses the registered mobile number and password, not the employee code.
- Employment classification and pay basis are separate. A full-time/part-time label must not be treated as a way to avoid applicable minimum-wage, leave, weekly-rest, overtime, or other employment obligations.

## Admin-controlled pricing
- `service_pricing_rules` stores area-wise customer rates by service, daily walk count, duration, billing cycle, and effective dates.
- `customer_pricing_overrides` stores an explicitly approved customer-specific rate. An override must not silently rewrite an existing confirmed booking.
- `walker_pay_rates` stores Admin-controlled Walker rates. A rate can be global, area-specific, or Walker-specific.
- New pricing rules apply to new quotes/bookings from their effective date. Existing confirmed booking prices remain snapshots until Admin explicitly changes them.

## Walker settlements
- `walker_settlements` stores a Walker's settlement period, completed-walk count, gross earnings, adjustments, payable amount, and approval/payment status.
- `walker_settlement_items` links individual walk records to a settlement. The unique constraint prevents the same walk being added twice to one settlement.
- The schema supports per-walk, hourly, and monthly pay bases; the actual calculation and legal payroll rules must be implemented and reviewed before use.

## Rollout safety
- Migration: `0014_management_hr_pricing.sql`.
- It is additive and uses foreign keys to existing `walkers`, `customers`, and `walks` records.
- It has been exercised in an isolated in-memory SQLite database with stub parent tables. CHECK constraints rejected invalid employment type, invalid duration, and reversed leave dates; `PRAGMA foreign_key_check` returned no violations.
- This is not a full D1 backup/restore test and is not approval to apply it to production.
- Production D1 has no verified migration-history ledger. Reconcile the live schema and verify a restorable backup before applying any migration.

## WhatsApp removal
- Admin navigation and Customer/Booking management screens no longer expose WhatsApp menu items, numbers, or booking-source choices.
- Legacy database columns and historical source values are retained for compatibility; no records are deleted by this UI cleanup.
- Do not add WhatsApp notifications, contact buttons, booking channels, or integrations.
