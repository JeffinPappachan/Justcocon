const treeOptions = [
  "1–5 trees",
  "6–10 trees",
  "11–25 trees",
  "26–50 trees",
  "More than 50 trees",
];

export default function App() {
  return (
    <main className="page-shell">
      <div className="staging-banner">STAGING / DEMO</div>

      <section className="hero-card">
        <p className="eyebrow">JustCocon</p>
        <h1>Fast, local coconut harvesting support</h1>
        <p className="subtitle">
          Schedule a harvest request for your property in Kerala. This demo does
          not connect to a live database or production WhatsApp number.
        </p>

        <form className="booking-card" aria-label="Quick booking form">
          <div className="form-header">
            <h2>Quick booking</h2>
            <span className="demo-tag">Demo only</span>
          </div>

          <label>
            Location
            <input
              type="text"
              placeholder="Enter your location or farm name"
              aria-label="Location"
            />
          </label>

          <label>
            Number of trees
            <select aria-label="Number of trees">
              {treeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label>
            Preferred date
            <input type="date" aria-label="Preferred date" />
          </label>

          <label>
            Notes (optional)
            <textarea
              rows={3}
              placeholder="Share access details, timing, or any special instructions"
              aria-label="Notes"
            />
          </label>

          <button type="button" className="primary-button">
            Book on WhatsApp
          </button>

          <p className="disclaimer">
            WhatsApp integration is not connected yet. This page is a staging UI
            foundation only.
          </p>
        </form>
      </section>
    </main>
  );
}
