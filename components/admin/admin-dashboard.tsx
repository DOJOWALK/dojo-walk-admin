'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup, signOut, type User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { ADMIN_EMAIL, auth, durations, emptyPricing, functions } from '../../lib/firebase-client';
import type { AdminBooking, AssignableWalker, Duration, Pricing, ServiceArea, WalkerApplication } from '../../types/admin';
import AdminOverview from './admin-overview';
import BookingOperations from './booking-operations';

export default function AdminHome() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pricing, setPricing] = useState<Pricing>(emptyPricing);
  const [draft, setDraft] = useState<Record<Duration, string>>({ '30': '0', '45': '0', '60': '0' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [walkerApplications, setWalkerApplications] = useState<WalkerApplication[]>([]);
  const [adminBookings, setAdminBookings] = useState<AdminBooking[]>([]);
  const [assignableWalkers, setAssignableWalkers] = useState<Record<string, AssignableWalker[]>>({});
  const [selectedWalkerByBooking, setSelectedWalkerByBooking] = useState<Record<string, string>>({});
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [serviceCity, setServiceCity] = useState('Ghaziabad');
  const [servicePincode, setServicePincode] = useState('');
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingFilter, setBookingFilter] = useState('all');

  async function loadWalkerApplications() {
    const callable = httpsCallable<Record<string, never>, { applications: WalkerApplication[] }>(functions, 'listPendingWalkerApplications');
    const result = await callable({});
    setWalkerApplications(result.data.applications || []);
  }

  async function loadServiceAreas() {
    const callable = httpsCallable<Record<string, never>, { areas: ServiceArea[] }>(functions, 'getAdminServiceAreas');
    const result = await callable({});
    setServiceAreas(result.data.areas || []);
  }

  async function saveServiceArea(city: string, pincode: string, enabled: boolean) {
    setLoading(true);
    setMessage('');
    try {
      const callable = httpsCallable(functions, 'setAdminServiceArea');
      await callable({ city, pincode, enabled });
      await loadServiceAreas();
      setMessage(city + ' pincode ' + pincode + (enabled ? ' enabled for service.' : ' disabled for new bookings.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update service area.');
    } finally {
      setLoading(false);
    }
  }

  async function loadAdminBookings() {
    const callable = httpsCallable<Record<string, never>, { bookings: AdminBooking[] }>(functions, 'listAdminBookings');
    const result = await callable({});
    setAdminBookings(result.data.bookings || []);
  }

  async function loadAssignableWalkers(booking: AdminBooking) {
    setLoading(true);
    setMessage('');
    try {
      const callable = httpsCallable<
        { city: string; pincode: string },
        { walkers: AssignableWalker[] }
      >(functions, 'listAssignableWalkers');
      const result = await callable({
        city: booking.city,
        pincode: booking.pincode,
      });
      setAssignableWalkers(old => ({
        ...old,
        [booking.bookingId]: result.data.walkers || [],
      }));
      setSelectedWalkerByBooking(old => ({
        ...old,
        [booking.bookingId]: '',
      }));
      if (!result.data.walkers?.length) {
        setMessage('No approved, active walker matches this booking location.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load eligible walkers.');
    } finally {
      setLoading(false);
    }
  }

  async function assignWalker(booking: AdminBooking) {
    const walkerId = selectedWalkerByBooking[booking.bookingId];
    if (!walkerId) {
      setMessage('Please select a walker first.');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const callable = httpsCallable(functions, 'assignWalkerToBooking');
      await callable({ bookingId: booking.bookingId, walkerId });
      await loadAdminBookings();
      setAssignableWalkers(old => {
        const next = { ...old };
        delete next[booking.bookingId];
        return next;
      });
      setSelectedWalkerByBooking(old => {
        const next = { ...old };
        delete next[booking.bookingId];
        return next;
      });
      setMessage('Walker assigned successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not assign walker.');
    } finally {
      setLoading(false);
    }
  }

  async function reviewWalker(walkerId: string, decision: 'approve' | 'reject') {
    setLoading(true);
    setMessage('');
    try {
      const callable = httpsCallable(functions, 'reviewWalkerApplication');
      await callable({ walkerId, decision });
      await loadWalkerApplications();
      setMessage(decision === 'approve'
        ? 'Walker approved. The application pincode must already be enabled in service areas.'
        : 'Walker application rejected.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not review walker application.');
    } finally {
      setLoading(false);
    }
  }

  async function loadPricing() {
    const callable = httpsCallable<Record<string, never>, Pricing>(functions, 'getBookingPricing');
    const result = await callable({});
    setPricing(result.data);
    setDraft({
      '30': String(result.data['30'].amountRupees),
      '45': String(result.data['45'].amountRupees),
      '60': String(result.data['60'].amountRupees),
    });
  }

  useEffect(() => onAuthStateChanged(auth, async (nextUser) => {
    setUser(nextUser);
    setIsAdmin(false);
    if (!nextUser) return;
    try {
      if ((nextUser.email || '').toLowerCase() !== ADMIN_EMAIL) {
        await signOut(auth);
        setMessage('Please sign in with the authorized admin Google account: ' + ADMIN_EMAIL);
        return;
      }
      const token = await nextUser.getIdTokenResult(true);
      if (token.claims.admin !== true) {
        setMessage('This account does not have the DOJO WALK admin role.');
        return;
      }
      setIsAdmin(true);
      await Promise.all([loadPricing(), loadWalkerApplications(), loadAdminBookings(), loadServiceAreas()]);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load pricing.');
    }
  }), []);

  async function login(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  }

  async function googleLogin() {
    setLoading(true);
    setMessage('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const credential = await signInWithPopup(auth, provider);
      if ((credential.user.email || '').toLowerCase() !== ADMIN_EMAIL) {
        await signOut(auth);
        setMessage('Please choose the authorized admin Google account: ' + ADMIN_EMAIL);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Google sign in failed.');
    } finally {
      setLoading(false);
    }
  }

  async function savePrice(duration: Duration) {
    const amountRupees = Number(draft[duration]);
    if (!Number.isFinite(amountRupees) || amountRupees < 0 || Math.round(amountRupees * 100) !== amountRupees * 100) {
      setMessage('Enter a valid price with up to two decimal places.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const callable = httpsCallable(functions, 'setBookingPricing');
      await callable({ duration, amountRupees });
      await loadPricing();
      setMessage(amountRupees === 0
        ? duration + '-minute booking payments remain disabled at ₹0.'
        : duration + '-minute price updated. New payment orders will use ₹' + amountRupees + '.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save price. Check admin access.');
    } finally {
      setLoading(false);
    }
  }

  const currency = useMemo(() => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }), []);
  const filteredBookings = useMemo(() => adminBookings.filter(booking => {
    const search = [booking.petName, booking.city, booking.pincode, booking.bookingId, booking.customerId].join(' ').toLowerCase();
    return search.includes(bookingSearch.toLowerCase()) && (bookingFilter === 'all' || booking.status.toLowerCase() === bookingFilter);
  }), [adminBookings, bookingSearch, bookingFilter]);
  const pendingPayments = adminBookings.filter(booking => booking.paymentReviewRequired).length;
  const unassignedBookings = adminBookings.filter(booking => booking.status === 'confirmed' && !booking.walkerId).length;

  return <main style={{ fontFamily: 'Arial,sans-serif', padding: 32, maxWidth: 920, margin: 'auto', color: '#171717' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
      <div><h1 style={{ marginBottom: 4 }}>DOJO WALK Admin</h1><p style={{ color: '#666', marginTop: 0 }}>Operations and booking prices</p></div>
      {user && <button onClick={() => signOut(auth)} style={buttonStyle}>Sign out</button>}
    </header>

    {user && isAdmin && <AdminOverview bookingCount={adminBookings.length} pendingApplicationCount={walkerApplications.length} unassignedCount={unassignedBookings} paymentReviewCount={pendingPayments} />}
    {!user && <form onSubmit={login} style={panelStyle}>
      <h2>Admin sign in</h2>
      <label style={labelStyle}>Admin email</label>
      <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
      <label style={labelStyle}>Password</label>
      <input type="password" required value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
      <button disabled={loading} type="submit" style={primaryStyle}>{loading ? 'Please wait…' : 'Sign in'}</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}><span style={{ height: 1, background: '#ddd', flex: 1 }} /><span style={{ color: '#777', fontSize: 13 }}>OR</span><span style={{ height: 1, background: '#ddd', flex: 1 }} /></div>
      <button disabled={loading} type="button" onClick={googleLogin} style={{ ...buttonStyle, width: '100%', padding: 12, fontWeight: 700 }}>{loading ? 'Please wait…' : 'Continue with Google'}</button>
      <p style={{ color: '#666', fontSize: 13 }}>Use {ADMIN_EMAIL}. Only this email with the Firebase admin role can manage prices.</p>
    </form>}

    {user && isAdmin && <>
      <section style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h2 id="service-areas" style={{ marginTop: 0 }}>Service areas & pincodes</h2>
          <button disabled={loading} onClick={() => loadServiceAreas().catch(error => setMessage(error instanceof Error ? error.message : 'Could not refresh service areas.'))} style={buttonStyle}>Refresh</button>
        </div>
        <p style={{ color: '#555' }}>Enable verified pincodes before approving walkers. Disabling a pincode prevents new walker matching there; existing bookings are not changed.</p>
        <form onSubmit={event => { event.preventDefault(); if (!/^\d{6}$/.test(servicePincode.trim())) { setMessage('Enter a valid 6-digit pincode.'); return; } saveServiceArea(serviceCity, servicePincode.trim(), true); }} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <label style={labelStyle}>City<select value={serviceCity} onChange={event => setServiceCity(event.target.value)} style={inputStyle}><option>Noida</option><option>Greater Noida</option><option>Ghaziabad</option></select></label>
          <label style={labelStyle}>6-digit pincode<input inputMode="numeric" maxLength={6} value={servicePincode} onChange={event => setServicePincode(event.target.value.replace(/\D/g, '').slice(0, 6))} style={inputStyle} /></label>
          <button disabled={loading || servicePincode.length !== 6} type="submit" style={{ ...primaryStyle, marginTop: 0 }}>Enable pincode</button>
        </form>
        <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
          {serviceAreas.length === 0 ? <p style={{ color: '#666' }}>No service pincodes configured yet.</p> : serviceAreas.map(area => <article key={area.city + area.pincode} style={{ border: '1px solid #ddd', borderRadius: 10, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div><strong>{area.city} · {area.pincode}</strong><p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>{area.walkerCount} linked walker(s) · {area.enabled ? 'Enabled' : 'Disabled'}</p></div>
            <button disabled={loading} onClick={() => saveServiceArea(area.city, area.pincode, !area.enabled)} style={buttonStyle}>{area.enabled ? 'Disable' : 'Enable'}</button>
          </article>)}
        </div>
      </section>

      <section style={panelStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h2 id="walker-applications" style={{ marginTop: 0 }}>Walker applications</h2>
          <button disabled={loading} onClick={() => loadWalkerApplications().catch(error => setMessage(error instanceof Error ? error.message : 'Could not refresh applications.'))} style={buttonStyle}>Refresh</button>
        </div>
        <p style={{ color: '#555' }}>Review new walker registrations. Approval is allowed only when the applicant's pincode is already enabled in Firebase service areas.</p>
        {walkerApplications.length === 0
          ? <p style={{ color: '#666' }}>No pending walker applications.</p>
          : <div style={{ display: 'grid', gap: 12 }}>
            {walkerApplications.map(walker => <article key={walker.walkerId} style={{ border: '1px solid #ddd', borderRadius: 10, padding: 16 }}>
              <h3 style={{ margin: '0 0 8px' }}>{walker.displayName}</h3>
              <p style={{ margin: '4px 0', color: '#555' }}>{walker.email} · {walker.phone}</p>
              <p style={{ margin: '4px 0', color: '#555' }}>{walker.city} · Pincode {walker.pincode}</p>
              <p style={{ margin: '4px 0', color: '#777', fontSize: 12 }}>Application ID: {walker.walkerId}</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                <button disabled={loading} onClick={() => reviewWalker(walker.walkerId, 'approve')} style={{ ...primaryStyle, width: 'auto', marginTop: 0 }}>Approve</button>
                <button disabled={loading} onClick={() => reviewWalker(walker.walkerId, 'reject')} style={buttonStyle}>Reject</button>
              </div>
            </article>)}
          </div>}
      </section>
      <BookingOperations
        bookings={filteredBookings}
        totalBookings={adminBookings.length}
        loading={loading}
        search={bookingSearch}
        onSearchChange={setBookingSearch}
        statusFilter={bookingFilter}
        onStatusFilterChange={setBookingFilter}
        assignableWalkers={assignableWalkers}
        selectedWalkerByBooking={selectedWalkerByBooking}
        onSelectedWalkerChange={(bookingId, walkerId) => setSelectedWalkerByBooking(old => ({ ...old, [bookingId]: walkerId }))}
        onRefresh={() => loadAdminBookings().catch(error => setMessage(error instanceof Error ? error.message : 'Could not refresh bookings.'))}
        onFindWalkers={loadAssignableWalkers}
        onAssignWalker={assignWalker}
      />
      <section style={panelStyle}>
      <h2 id="walk-pricing" style={{ marginTop: 0 }}>Walk pricing</h2>
        <p style={{ color: '#555' }}>Set customer prices in rupees. ₹0 means this walk duration is disabled for payment. Customer app always fetches the latest active price from the server when a payment order is created.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
          {durations.map(duration => <article key={duration} style={{ border: '1px solid #ddd', borderRadius: 12, padding: 18 }}>
            <h3>{duration} minute walk</h3>
            <p style={{ color: '#666', fontSize: 13 }}>Current: {currency.format(pricing[duration].amountRupees)} · {pricing[duration].active ? 'Active' : 'Disabled'}</p>
            <label style={labelStyle}>Customer price (₹)</label>
            <input type="number" min="0" step="0.01" value={draft[duration]} onChange={e => setDraft(old => ({ ...old, [duration]: e.target.value }))} style={inputStyle} />
            <button disabled={loading} onClick={() => savePrice(duration)} style={primaryStyle}>Save {duration}-minute price</button>
          </article>)}
        </div>
        <p style={{ fontSize: 13, color: '#666' }}>Prices are stored in Firestore as paise. Changes apply to newly created payment orders; existing orders retain their original amount.</p>
      </section>
    </>}

    {message && <p role="status" style={{ background: '#fff7e6', border: '1px solid #f1d59a', padding: 12, borderRadius: 8 }}>{message}</p>}
  </main>;
}

const panelStyle = { border: '1px solid #ddd', borderRadius: 14, padding: 24, marginTop: 24 };
const labelStyle = { display: 'block', fontSize: 14, fontWeight: 600 as const, margin: '14px 0 6px' };
const inputStyle = { width: '100%', padding: 12, border: '1px solid #bbb', borderRadius: 8, boxSizing: 'border-box' as const, fontSize: 16 };
const buttonStyle = { padding: '10px 16px', border: '1px solid #bbb', borderRadius: 8, background: 'white', cursor: 'pointer' };
const primaryStyle = { width: '100%', marginTop: 14, padding: 12, border: 0, borderRadius: 8, background: '#f58220', color: 'white', fontWeight: 700 as const, cursor: 'pointer' };
