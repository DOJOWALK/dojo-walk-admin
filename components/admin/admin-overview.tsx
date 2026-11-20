type AdminOverviewProps = {
  bookingCount: number;
  pendingApplicationCount: number;
  unassignedCount: number;
  paymentReviewCount: number;
};

export default function AdminOverview({ bookingCount, pendingApplicationCount, unassignedCount, paymentReviewCount }: AdminOverviewProps) {
  return (
    <section className="dojo-overview">
      <div className="dojo-overview-heading">
        <div><span className="dojo-eyebrow">OPERATIONS OVERVIEW</span><h2>Good to see you, Admin 👋</h2><p>Your DOJO WALK operations at a glance.</p></div>
        <span className="dojo-live"><i /> Firebase connected</span>
      </div>
      <div className="dojo-metrics">
        <article><span className="dojo-metric-icon orange">▣</span><p>Bookings loaded</p><strong>{bookingCount}</strong><small>Latest 100 records</small></article>
        <article><span className="dojo-metric-icon blue">♧</span><p>Pending applications</p><strong>{pendingApplicationCount}</strong><small>Awaiting review</small></article>
        <article><span className="dojo-metric-icon violet">↗</span><p>Unassigned bookings</p><strong>{unassignedCount}</strong><small>Confirmed bookings</small></article>
        <article><span className="dojo-metric-icon amber">₹</span><p>Payment review</p><strong>{paymentReviewCount}</strong><small>Need manual attention</small></article>
      </div>
      <nav className="dojo-shortcuts"><a href="#service-areas">Service areas</a><a href="#walker-applications">Walker applications</a><a href="#booking-operations">Bookings</a><a href="#walk-pricing">Pricing</a></nav>
    </section>
  );
}
