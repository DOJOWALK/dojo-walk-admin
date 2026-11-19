'use client';

import type { AdminBooking, AssignableWalker } from '../../types/admin';

type BookingOperationsProps = {
  bookings: AdminBooking[];
  totalBookings: number;
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  assignableWalkers: Record<string, AssignableWalker[]>;
  selectedWalkerByBooking: Record<string, string>;
  onSelectedWalkerChange: (bookingId: string, walkerId: string) => void;
  onRefresh: () => void;
  onFindWalkers: (booking: AdminBooking) => void;
  onAssignWalker: (booking: AdminBooking) => void;
};

const panelStyle = { border: '1px solid #ddd', borderRadius: 14, padding: 24, marginTop: 24 };
const labelStyle = { display: 'block', fontSize: 14, fontWeight: 600 as const, margin: '14px 0 6px' };
const inputStyle = { width: '100%', padding: 12, border: '1px solid #bbb', borderRadius: 8, boxSizing: 'border-box' as const, fontSize: 16 };
const buttonStyle = { padding: '10px 16px', border: '1px solid #bbb', borderRadius: 8, background: 'white', cursor: 'pointer' };
const primaryStyle = { width: '100%', marginTop: 14, padding: 12, border: 0, borderRadius: 8, background: '#f58220', color: 'white', fontWeight: 700 as const, cursor: 'pointer' };

export default function BookingOperations({ bookings, totalBookings, loading, search, onSearchChange, statusFilter, onStatusFilterChange, assignableWalkers, selectedWalkerByBooking, onSelectedWalkerChange, onRefresh, onFindWalkers, onAssignWalker }: BookingOperationsProps) {
  return (
    <section style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h2 id="booking-operations" style={{ marginTop: 0 }}>Booking operations</h2>
        <button disabled={loading} onClick={onRefresh} style={buttonStyle}>Refresh</button>
      </div>
      <p style={{ color: '#555' }}>Latest 100 bookings, payment state and walker assignment. This panel is read-only for booking status; status changes are recorded by the booking and walker workflows.</p>
      <div className="dojo-booking-tools">
        <input aria-label="Search bookings" placeholder="Search pet, city, pincode or booking ID…" value={search} onChange={event => onSearchChange(event.target.value)} />
        <select aria-label="Filter bookings by status" value={statusFilter} onChange={event => onStatusFilterChange(event.target.value)}>
          <option value="all">All statuses</option><option value="confirmed">Confirmed</option><option value="pending">Pending</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
        </select>
        <span>{bookings.length} of {totalBookings} bookings</span>
      </div>
      {bookings.length === 0
        ? <p style={{ color: '#666' }}>No bookings found.</p>
        : <div style={{ display: 'grid', gap: 12 }}>
          {bookings.map(booking => <article key={booking.bookingId} style={{ border: '1px solid #ddd', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <h3 style={{ margin: '0 0 8px' }}>{booking.petName || 'Pet walk'} · {booking.durationMinutes} min</h3>
              <strong>{booking.status.replaceAll('_', ' ')}</strong>
            </div>
            <p style={{ margin: '4px 0', color: '#555' }}>{booking.city} · {booking.pincode} · {booking.address}</p>
            <p style={{ margin: '4px 0', color: '#555' }}>Scheduled: {booking.scheduledAt ? new Date(booking.scheduledAt).toLocaleString('en-IN') : 'Not set'}</p>
            <p style={{ margin: '4px 0', color: '#555' }}>Payment: {booking.paymentStatus} · Walker: {booking.walkerId || 'Not assigned'}</p>
            {booking.status === 'confirmed' && !booking.walkerId && <>
              <button
                disabled={loading}
                onClick={() => onFindWalkers(booking)}
                style={{ ...buttonStyle, marginTop: 10 }}
              >
                Find eligible walkers
              </button>
              {Object.prototype.hasOwnProperty.call(assignableWalkers, booking.bookingId) && (
                assignableWalkers[booking.bookingId].length === 0
                  ? <p style={{ color: '#666' }}>No approved walker available for this city and pincode.</p>
                  : <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginTop: 10, alignItems: 'end' }}>
                      <label style={labelStyle}>Select Walker
                        <select
                          value={selectedWalkerByBooking[booking.bookingId] || ''}
                          onChange={event => onSelectedWalkerChange(booking.bookingId, event.target.value)}
                          style={inputStyle}
                        >
                          <option value="">Choose a walker</option>
                          {assignableWalkers[booking.bookingId].map(walker => (
                            <option key={walker.walkerId} value={walker.walkerId}>
                              {walker.displayName} · {walker.pincode}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        disabled={loading || !selectedWalkerByBooking[booking.bookingId]}
                        onClick={() => onAssignWalker(booking)}
                        style={{ ...primaryStyle, width: 'auto', marginTop: 0 }}
                      >
                        Assign Walker
                      </button>
                    </div>
              )}
            </>}
            {booking.paymentReviewRequired && <p role="alert" style={{ margin: '8px 0 0', color: '#a33', fontWeight: 700 }}>Payment requires manual review</p>}
            <p style={{ margin: '8px 0 0', color: '#777', fontSize: 12 }}>Booking ID: {booking.bookingId} · Customer UID: {booking.customerId}</p>
          </article>)}
        </div>}
    </section>

  );
}
