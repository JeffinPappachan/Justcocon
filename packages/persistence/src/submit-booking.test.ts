import assert from "node:assert/strict";
import test from "node:test";
import type { CompleteBookingDraft } from "@justcocon/validation";
import { createInMemoryPersistenceRepositories } from "./repositories/in-memory.js";
import { submitBooking } from "./submit-booking.js";

const clock = {
  todayIsoDate: () => "2026-09-25",
};

const draft: CompleteBookingDraft = {
  customerName: "Anu Kumar",
  locationText: "Kochi, Kerala",
  treeCountCategory: "1-5",
  preferredDate: "2026-09-25",
  preferredTimeWindow: "MORNING",
  notes: null,
};

function deps(repos = createInMemoryPersistenceRepositories()) {
  return {
    repos,
    clock,
    createReferenceSuffix: () => "TEST",
  };
}

test("submitBooking persists PENDING_STAFF_REVIEW", async () => {
  const repos = createInMemoryPersistenceRepositories();
  const result = await submitBooking(
    {
      draft,
      idempotencyKey: "idem-1",
      whatsappIdentity: "+919876543210",
    },
    deps(repos),
  );

  assert.equal(result.status, "PENDING_STAFF_REVIEW");
  assert.match(result.bookingReference, /^JC-/);
  assert.equal(result.idempotentReplay, false);

  const stored = await repos.bookings.findByIdempotencyKey("idem-1");
  assert.equal(stored?.status, "PENDING_STAFF_REVIEW");
});

test("submitBooking duplicate idempotency key returns same booking", async () => {
  const repos = createInMemoryPersistenceRepositories();
  const first = await submitBooking(
    {
      draft,
      idempotencyKey: "idem-dup",
      whatsappIdentity: "9876543210",
    },
    deps(repos),
  );
  const second = await submitBooking(
    {
      draft,
      idempotencyKey: "idem-dup",
      whatsappIdentity: "9876543210",
    },
    deps(repos),
  );

  assert.equal(second.idempotentReplay, true);
  assert.equal(second.bookingId, first.bookingId);
  assert.equal(second.bookingReference, first.bookingReference);
});

test("submitBooking surfaces repository failures", async () => {
  const repos = createInMemoryPersistenceRepositories();
  const broken = {
    ...repos,
    bookings: {
      ...repos.bookings,
      async insert() {
        throw new Error("db down");
      },
      findByIdempotencyKey: repos.bookings.findByIdempotencyKey.bind(repos.bookings),
      findByReference: repos.bookings.findByReference.bind(repos.bookings),
    },
  };

  await assert.rejects(
    () =>
      submitBooking(
        {
          draft,
          idempotencyKey: "idem-fail",
          whatsappIdentity: "+919876543210",
        },
        deps(broken),
      ),
    /Failed to insert booking|db down/,
  );
});
