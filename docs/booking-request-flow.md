# Customer booking request workflow

## Customer
- Customer portal has a **Book a Walk** entry.
- Customer selects one of their own dogs, service, preferred date/time, duration, pickup address, and optional instructions.
- Customer may explicitly tap **Use my current location** to request browser GPS permission. Coordinates are optional; manually entered address remains available.
- Customers can save one Home, Work, and Other address with optional GPS coordinates and reuse them for later requests.
- Request is stored separately from operational bookings and starts as `new_request`.
- Customer can cancel an unconfirmed request.
- When Admin proposes a time and final price, Customer can accept it. Acceptance moves the request to `customer_confirmed`.

## Admin
- Admin sidebar has **Booking Requests**.
- Admin can mark a new request under review, propose date/time and final price with a note, or reject it.
- For a customer-confirmed `single_walk`, Admin can use **Create Booking + Walk**. The server creates one operational booking and one scheduled walk, carries the pickup address and instructions into booking notes, and marks the request `converted`.
- Conversion uses stable IDs and a D1 atomic batch so repeated clicks/retries do not create duplicate bookings or walks.
- The created booking remains unassigned; Admin must assign a Walker through the existing booking/schedule workflow.

## Recurring requests and rollout limits
- `monthly_am_pm`, `monthly_once`, and `temporary_am_pm` requests are not auto-converted yet. The request form does not collect a service end date or all recurrence rules, so creating a recurring schedule automatically would be unsafe. Admin must set up those plans manually.
- A single-walk conversion is blocked if that dog already has another active booking; Admin must review the existing booking first.
- GPS coordinates can be saved and viewed as an OpenStreetMap pin. An interactive draggable map is not implemented.
- Apply `migrations/0012_booking_requests.sql` and `migrations/0013_customer_saved_addresses.sql` only after the full D1 backup/restore and migration-history reconciliation gate. Do not apply them to production blindly.
- No production migration or Worker deployment is included in this change.

## Saved pickup addresses
- Saved addresses are scoped to the authenticated customer.
- The migration is `0013_customer_saved_addresses.sql`.
