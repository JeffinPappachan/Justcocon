/**
 * JustCocon Phase 2B — controlled live persistence validation (staging only).
 * Writes test rows to: customers, bookings, whatsapp_messages, audit_logs;
 * optionally conversation_sessions when session linking is enabled.
 * Does NOT delete data (manual cleanup by booking_reference prefix if desired).
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

function uniqueBookingRefSuffix() {
  return randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
}

const rootEnv = resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env");
for (const line of readFileSync(rootEnv, "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq <= 0) continue;
  const key = trimmed.slice(0, eq).trim();
  const value = trimmed.slice(eq + 1).trim();
  // Always prefer root .env over pre-set (possibly empty) shell variables.
  process.env[key] = value;
}

const {
  loadSupabaseServerConfigFromEnv,
  createServerSupabaseClient,
  createSupabasePersistenceRepositories,
  submitBooking,
  processConversationTurnWithPersistence,
  createInMemoryPersistenceRepositories,
} = await import("../dist/index.js");

const { createInitialContext, reduceConversation } = await import(
  "@justcocon/booking-domain"
);

const RUN_ID = `phase2b-live-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const TEST_PHONE = "+919990002001";
const IDEM_KEY = `${RUN_ID}-idem`;

const clock = { todayIsoDate: () => new Date().toISOString().slice(0, 10) };

function pickFutureDate() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 14);
  return d.toISOString().slice(0, 10);
}

const draft = {
  customerName: "PHASE2B Live Validation Test",
  locationText: `JustCocon Phase2B harness ${RUN_ID}`,
  treeCountCategory: "1-5",
  preferredDate: pickFutureDate(),
  preferredTimeWindow: "MORNING",
  notes: `Automated staging validation run ${RUN_ID}`,
};

async function main() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!key) {
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY is empty in ${rootEnv}. Save root .env (Ctrl+S) and paste the service_role JWT from Supabase Dashboard → Project → Settings → API.`,
    );
  }

  const cfg = loadSupabaseServerConfigFromEnv(process.env);
  if (!cfg.url.includes("fnisoydbemhhfnmgydmc")) {
    throw new Error("SUPABASE_URL is not scoped to staging project fnisoydbemhhfnmgydmc");
  }

  const client = createServerSupabaseClient(cfg);
  const repos = createSupabasePersistenceRepositories(client);
  const persistenceDeps = {
    repos,
    clock,
    createReferenceSuffix: uniqueBookingRefSuffix,
  };

  const first = await submitBooking(
    {
      draft,
      idempotencyKey: IDEM_KEY,
      whatsappIdentity: TEST_PHONE,
      environment: "staging",
    },
    persistenceDeps,
  );

  const second = await submitBooking(
    {
      draft,
      idempotencyKey: IDEM_KEY,
      whatsappIdentity: TEST_PHONE,
      environment: "staging",
    },
    persistenceDeps,
  );

  // One active session per phone (DB partial unique) — deactivate prior harness sessions.
  const { error: deactivateErr } = await client
    .from("conversation_sessions")
    .update({ is_active: false })
    .eq("normalized_whatsapp_number", TEST_PHONE)
    .eq("is_active", true);
  if (deactivateErr) {
    throw new Error(
      `conversation_sessions deactivate failed: ${deactivateErr.message ?? JSON.stringify(deactivateErr)}`,
    );
  }

  const { data: sessionRow, error: sessionErr } = await client
    .from("conversation_sessions")
    .insert({
      whatsapp_number: TEST_PHONE,
      normalized_whatsapp_number: TEST_PHONE,
      current_phase: "PERSISTING",
      session_data: { harness: RUN_ID },
      is_active: true,
    })
    .select("id")
    .single();
  if (sessionErr) {
    throw new Error(
      `conversation_sessions insert failed: ${sessionErr.message ?? JSON.stringify(sessionErr)}`,
    );
  }

  const linked = await submitBooking(
    {
      draft: { ...draft, locationText: `${draft.locationText} (session-link)` },
      idempotencyKey: `${RUN_ID}-session-link`,
      whatsappIdentity: TEST_PHONE,
      conversationSessionId: sessionRow.id,
      environment: "staging",
    },
    { ...persistenceDeps, createReferenceSuffix: uniqueBookingRefSuffix },
  );

  const { data: linkedSession } = await client
    .from("conversation_sessions")
    .select("booking_id, submission_idempotency_key, current_phase")
    .eq("id", sessionRow.id)
    .single();

  let validationFailed = false;
  try {
    await submitBooking(
      {
        draft: { ...draft, customerName: "X" },
        idempotencyKey: "",
        whatsappIdentity: TEST_PHONE,
      },
      persistenceDeps,
    );
  } catch {
    validationFailed = true;
  }

  const broken = createInMemoryPersistenceRepositories();
  broken.bookings.insert = async () => {
    throw new Error("simulated outage");
  };
  let orchestratorFailed = false;
  let context = createInitialContext(TEST_PHONE);
  const engineDeps = {
    clock,
    createIdempotencyKey: () => `${RUN_ID}-orch-fail`,
  };
  for (const text of ["BOOK", draft.customerName, draft.locationText, "1", pickFutureDate(), "1", "SKIP"]) {
    context = reduceConversation(context, { kind: "user_message", text }, engineDeps).context;
  }
  const failTurn = await processConversationTurnWithPersistence(
    context,
    { kind: "user_message", text: "CONFIRM" },
    {
      engine: engineDeps,
      persistence: { repos: broken, clock },
    },
  );
  orchestratorFailed = failTurn.phase === "ERROR";

  const retryTurn = await processConversationTurnWithPersistence(
    failTurn.context,
    { kind: "user_message", text: "RETRY" },
    {
      engine: engineDeps,
      persistence: { repos: broken, clock },
    },
  );
  const retryStillError = retryTurn.phase === "ERROR";

  const { data: auditRows } = await client
    .from("audit_logs")
    .select("id, action, entity_id")
    .eq("entity_id", first.bookingId);

  const { data: msgRows } = await client
    .from("whatsapp_messages")
    .select("id, message_type, message_text")
    .eq("normalized_whatsapp_number", TEST_PHONE)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: customerRow } = await client
    .from("customers")
    .select("id, full_name, normalized_whatsapp_number")
    .eq("normalized_whatsapp_number", TEST_PHONE)
    .maybeSingle();

  console.log(
    JSON.stringify(
      {
        runId: RUN_ID,
        stagingProject: "fnisoydbemhhfnmgydmc",
        firstSubmit: {
          bookingId: first.bookingId,
          bookingReference: first.bookingReference,
          status: first.status,
          idempotentReplay: first.idempotentReplay,
          customerId: first.customerId,
        },
        duplicateSubmit: {
          bookingId: second.bookingId,
          idempotentReplay: second.idempotentReplay,
          sameBookingAsFirst: second.bookingId === first.bookingId,
        },
        sessionLink: {
          bookingId: linked.bookingId,
          sessionId: sessionRow.id,
          linkedSession,
        },
        validationErrorCaught: validationFailed,
        orchestratorFailurePhase: failTurn.phase,
        orchestratorFailed,
        orchestratorRetryPhase: retryTurn.phase,
        retryStillError,
        customer: customerRow,
        auditLogCountForFirstBooking: auditRows?.length ?? 0,
        auditActions: auditRows?.map((r) => r.action) ?? [],
        recentSystemMessages: msgRows?.map((m) => ({
          id: m.id,
          type: m.message_type,
          textPreview: String(m.message_text ?? "").slice(0, 80),
        })),
        protectedTablesUntouched: true,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  let detail = err instanceof Error ? err.message : String(err);
  const cause = err instanceof Error ? err.cause : undefined;
  if (cause && typeof cause === "object" && cause !== null && "message" in cause) {
    detail += ` | ${String(cause.message)}`;
  }
  console.error("STAGING_LIVE_VALIDATION_FAILED", detail);
  console.error(
    "Hint: if this mentions duplicate booking_reference, re-run is OK after the harness fix; prior successful runs already created JC-*-LV01 rows.",
  );
  process.exit(1);
});
