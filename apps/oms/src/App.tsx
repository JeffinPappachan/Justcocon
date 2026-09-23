const statusCards = [
  { label: "New requests", value: "0" },
  { label: "Pending review", value: "0" },
  { label: "Scheduled", value: "0" },
];

export default function App() {
  return (
    <main className="oms-shell">
      <div className="staging-banner">STAGING / DEMO</div>

      <header className="topbar">
        <div>
          <p className="eyebrow">JustCocon OMS</p>
          <h1>Operations management</h1>
        </div>
        <div className="mode-chip">Demo mode</div>
      </header>

      <nav className="nav-panel" aria-label="Main navigation">
        <button type="button">Overview</button>
        <button type="button">Bookings</button>
        <button type="button">Staff review</button>
        <button type="button">Scheduling</button>
      </nav>

      <section className="stats-grid" aria-label="Booking overview">
        {statusCards.map((card) => (
          <article key={card.label} className="stat-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </section>

      <section className="panel-grid">
        <article className="panel">
          <h2>Booking overview</h2>
          <p className="placeholder-text">
            No live booking data is connected in this demo.
          </p>
          <div className="empty-list">
            <p>No bookings yet</p>
          </div>
        </article>

        <article className="panel">
          <h2>Pending staff review</h2>
          <p className="placeholder-text">
            Manual review queue placeholder only.
          </p>
        </article>
      </section>

      <section className="details-panel">
        <h2>Booking details</h2>
        <p className="placeholder-text">
          Select a booking to view details or update status.
        </p>
      </section>

      <section className="details-panel">
        <h2>Status management</h2>
        <p className="placeholder-text">
          Status actions are intentionally disabled in staging.
        </p>
      </section>
    </main>
  );
}
