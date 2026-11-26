# Customer booking request workflow

## Customer
- Customer portal has a **Book a Walk** entry.
- Customer selects one of their own dogs, service, preferred date/time, duration, pickup address, and optional instructions.
- Customer may explicitly tap **Use my current location** to request browser GPS permission. Coordinates are optional; manually entered address remains available.
- Request is stored separately from operational bookings and starts as `new_request`.
- Customer can cancel an unconfirmed request.
- When Admin proposes a time and final price, Customer can accept it. Acceptance moves the request to `customer_confirmed`.

## Admin
- Admin sidebar has **Booking Requests**.
- Admin can mark a new request under review, propose date/time and final price with a note, or reject it.
- The Admin screen explicitly identifies customer-confirmed requests for operational booking creation.

## Important rollout limitation
- The customer request workflow is additive. It does not create or alter an operational `bookings` row when the request is submitted.
- At this stage, after customer confirmation, Admin must create the operational booking in the existing Bookings workflow and assign a Walker. Automated conversion and recurring walk generation are not yet implemented.
- GPS coordinates can be saved, but an interactive draggable map and saved Home/Work addresses are not implemented yet.
- Apply `migrations/0012_booking_requests.sql` only after the full D1 backup/restore and migration-history reconciliation gate. Do not apply it to production blindly.
- No production migration or Worker deployment is included in this change.
