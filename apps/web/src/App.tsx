import { useMemo, useState } from "react";
import {
  SERVICE_AREA,
  TREE_OPTIONS,
  buildWhatsAppBookingUrl,
} from "./whatsapp-booking";

const bookingNumber = import.meta.env.VITE_WHATSAPP_BOOKING_NUMBER ?? "";
const isStaging = import.meta.env.DEV;

export default function App() {
  const [location, setLocation] = useState(SERVICE_AREA);
  const [trees, setTrees] = useState<string>(TREE_OPTIONS[0]);

  const whatsappUrl = useMemo(
    () =>
      buildWhatsAppBookingUrl({
        phone: bookingNumber,
        location: location.trim() || SERVICE_AREA,
        trees,
      }),
    [location, trees],
  );

  return (
    <div className="site">
      <header className="site-header">
        <div className="site-header__inner">
          <a className="logo" href="/">
            <CoconutMark />
            <span>JustCocon</span>
          </a>
          {isStaging ? (
            <span className="staging-pill">Staging</span>
          ) : null}
        </div>
      </header>

      <main className="site-main">
        <section className="hero">
          <p className="hero__eyebrow">Kerala · Coconut harvesting</p>
          <h1 className="hero__title">
            Fast, local coconut harvesting support
          </h1>
          <p className="hero__lead">
            Book a crew for your home or farm in minutes. Tell us your location
            and tree count on the website, continue on WhatsApp, and get a quote
            before we visit.
          </p>

          <ul className="hero__points" aria-label="Why JustCocon">
            <li>
              <CheckIcon />
              <span>Insured crew · Same-week visits when slots allow</span>
            </li>
            <li>
              <CheckIcon />
              <span>Clear pricing — no haggling at the gate</span>
            </li>
            <li>
              <CheckIcon />
              <span>Finish booking in WhatsApp with our guided chat</span>
            </li>
          </ul>
        </section>

        <section className="booking-section" aria-labelledby="booking-heading">
          <form
            className="booking-card"
            aria-label="Quick booking form"
            onSubmit={(event) => {
              event.preventDefault();
              if (whatsappUrl) {
                window.open(whatsappUrl, "_blank", "noopener,noreferrer");
              }
            }}
          >
            <div className="booking-card__head">
              <h2 id="booking-heading">Quick booking</h2>
            </div>

            <div className="booking-card__body">
              <label className="field">
                <span className="field-label">Your location</span>
                <div className="input-with-icon">
                  <PinIcon />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Town, district, or farm name"
                    aria-label="Your location"
                    autoComplete="address-level2"
                  />
                </div>
              </label>

              <label className="field">
                <span className="field-label">Number of trees</span>
                <select
                  aria-label="Number of trees"
                  value={trees}
                  onChange={(event) => setTrees(event.target.value)}
                >
                  {TREE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <div className="visit-row">
                <div className="visit-copy">
                  <span className="visit-label">Typical visit</span>
                  <strong>Same week · Insured crew</strong>
                </div>
                <span className="on-demand">On demand</span>
              </div>

              {whatsappUrl ? (
                <a
                  className="whatsapp-button"
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <WhatsAppIcon />
                  Book on WhatsApp
                </a>
              ) : (
                <button type="button" className="whatsapp-button" disabled>
                  <WhatsAppIcon />
                  Book on WhatsApp
                </button>
              )}

              <p className="footnote">No haggling · Quote before we visit</p>

              {!whatsappUrl ? (
                <p className="setup-hint">
                  Set{" "}
                  <code>VITE_WHATSAPP_BOOKING_NUMBER</code> in the project{" "}
                  <code>.env</code> to your paired bot number, then restart the
                  web dev server.
                </p>
              ) : null}
            </div>
          </form>
        </section>

        <section className="steps" aria-labelledby="steps-heading">
          <h2 id="steps-heading" className="steps__title">
            How it works
          </h2>
          <ol className="steps__list">
            <li>
              <span className="steps__num">1</span>
              <div>
                <strong>Choose location & trees</strong>
                <p>Use the form — we pre-fill your WhatsApp message.</p>
              </div>
            </li>
            <li>
              <span className="steps__num">2</span>
              <div>
                <strong>Chat with our bot</strong>
                <p>Add your name, date, and any access notes in WhatsApp.</p>
              </div>
            </li>
            <li>
              <span className="steps__num">3</span>
              <div>
                <strong>Confirm your request</strong>
                <p>Our team reviews and follows up with scheduling details.</p>
              </div>
            </li>
          </ol>
        </section>
      </main>

      <footer className="site-footer">
        <p>© {new Date().getFullYear()} JustCocon · Kozhikode &amp; nearby</p>
      </footer>
    </div>
  );
}

function CoconutMark() {
  return (
    <svg className="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="currentColor" opacity="0.12" />
      <path
        fill="currentColor"
        d="M16 6c-3.2 0-6 2.4-6.5 5.6-.3 2.1.5 4 2.1 5.2-.8 1.2-1.2 2.6-1.1 4.1.2 2.8 2.5 5 5.3 5.1 3.4.1 6.2-2.6 6.2-6 0-1.5-.5-2.9-1.4-4 1.4-1.3 2.2-3.2 2-5.2C22.4 8.2 19.4 6 16 6Z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="check-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.2 7.2a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.5-6.5a1 1 0 0 1 1.4 0Z"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg className="pin-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z"
      />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg className="whatsapp-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12.04 2C6.58 2 2.15 6.4 2.15 11.83c0 1.74.46 3.44 1.34 4.94L2 22l5.39-1.41a10 10 0 0 0 4.65 1.18h.01c5.46 0 9.89-4.4 9.89-9.84C21.94 6.4 17.5 2 12.04 2Zm5.77 13.99c-.24.67-1.4 1.23-1.94 1.31-.5.07-1.13.1-1.82-.11-.42-.13-.95-.31-1.64-.61-2.89-1.25-4.77-4.15-4.92-4.34-.14-.2-1.18-1.57-1.18-3 0-1.42.74-2.12 1.01-2.41.26-.28.58-.35.77-.35.2 0 .38 0 .55.01.18.01.41-.07.64.49.24.58.82 2 .89 2.15.07.15.12.32.02.52-.1.2-.14.32-.28.5-.14.17-.3.38-.42.51-.14.14-.29.3-.12.58.16.29.73 1.2 1.56 1.94 1.08.96 1.98 1.26 2.26 1.4.28.14.45.12.61-.07.17-.2.7-.81.88-1.09.19-.28.37-.23.63-.14.26.1 1.64.77 1.92.91.28.14.47.21.54.32.07.12.07.67-.17 1.34Z"
      />
    </svg>
  );
}
