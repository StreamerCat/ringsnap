#!/usr/bin/env node

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_BASE_URL = process.env.VAPI_BASE_URL || "https://api.vapi.ai";
const DRY_RUN = process.env.DRY_RUN === "1";
const LIMIT = Number.isFinite(Number(process.env.LIMIT)) ? Number(process.env.LIMIT) : 10;
const TARGET_MODEL = "gpt-4o-mini";
const WEBHOOK_MARKER = ".supabase.co/functions/v1/vapi-webhook";

if (!VAPI_API_KEY) {
  console.error("Missing VAPI_API_KEY");
  process.exit(1);
}

async function vapiFetch(path, init = {}) {
  const res = await fetch(`${VAPI_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${VAPI_API_KEY}`,
      ...(init.headers || {}),
    },
  });

  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    throw new Error(`Vapi ${path} failed (${res.status}): ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  return body;
}

function extractList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.assistants)) return payload.assistants;
  return [];
}

function extractNextPage(payload) {
  return payload?.nextPageToken || payload?.nextPage || payload?.cursor || null;
}

function isTarget(assistant) {
  const provider = assistant?.model?.provider;
  const model = assistant?.model?.model;
  const serverUrl = assistant?.serverUrl || "";
  return provider === "openai" && model !== TARGET_MODEL && typeof serverUrl === "string" && serverUrl.includes(WEBHOOK_MARKER);
}

async function listAllAssistants() {
  const assistants = [];
  let cursor = null;
  do {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    const payload = await vapiFetch(`/assistant${qs}`);
    assistants.push(...extractList(payload));
    cursor = extractNextPage(payload);
  } while (cursor);
  return assistants;
}

async function run() {
  const summary = { scanned: 0, matched: 0, updated: 0, failed: 0, skippedByLimit: 0 };
  const assistants = await listAllAssistants();
  summary.scanned = assistants.length;

  const targets = assistants.filter(isTarget);
  summary.matched = targets.length;

  const limitedTargets = targets.slice(0, LIMIT);
  summary.skippedByLimit = Math.max(0, targets.length - limitedTargets.length);

  console.log(`Scanned ${summary.scanned} assistants; matched ${summary.matched}; processing ${limitedTargets.length} (LIMIT=${LIMIT}, DRY_RUN=${DRY_RUN ? 1 : 0})`);

  for (const assistant of limitedTargets) {
    const model = assistant.model || {};
    const nextModel = { ...model, model: TARGET_MODEL };
    const payload = { model: nextModel };

    if (DRY_RUN) {
      console.log(`[DRY_RUN] Would update assistant ${assistant.id}: ${model.model} -> ${TARGET_MODEL}`);
      summary.updated += 1;
      continue;
    }

    try {
      await vapiFetch(`/assistant/${assistant.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      console.log(`[UPDATED] assistant ${assistant.id}: ${model.model} -> ${TARGET_MODEL}`);
      summary.updated += 1;
    } catch (error) {
      summary.failed += 1;
      console.error(`[FAILED] assistant ${assistant.id}:`, error.message);
    }
  }

  console.log("Summary:", summary);
  if (summary.failed > 0) process.exitCode = 1;
}

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
