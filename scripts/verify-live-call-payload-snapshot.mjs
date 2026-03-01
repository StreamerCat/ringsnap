#!/usr/bin/env node

import assert from "node:assert/strict";

function buildAssistantPayload({ metadata, prompt, voiceId, serverUrl, tools, modelName }) {
  return {
    name: `${metadata.company_name} Assistant`,
    model: {
      provider: "openai",
      model: modelName,
      messages: [
        {
          role: "system",
          content: prompt,
        },
      ],
    },
    tools: tools.length > 0 ? tools : undefined,
    voice: {
      provider: "11labs",
      voiceId,
    },
    firstMessage: `Thank you for calling ${metadata.company_name}! How can I help you today?`,
    serverUrl,
  };
}

const metadata = { company_name: "Acme Plumbing" };
const prompt = "System prompt";
const voiceId = "21m00Tcm4TlvDq8ikWAM";
const serverUrl = "https://project.supabase.co/functions/v1/vapi-webhook";
const tools = [{ type: "function", server: { url: "https://project.supabase.co/functions/v1/vapi-tools-availability" } }];

const payload = buildAssistantPayload({
  metadata,
  prompt,
  voiceId,
  serverUrl,
  tools,
  modelName: "gpt-4o-mini",
});

assert.equal(payload.name, "Acme Plumbing Assistant");
assert.equal(payload.model.provider, "openai");
assert.equal(payload.model.model, "gpt-4o-mini");
assert.equal(payload.model.messages[0].content, prompt);
assert.equal(payload.voice.provider, "11labs");
assert.equal(payload.voice.voiceId, voiceId);
assert.equal(payload.firstMessage, "Thank you for calling Acme Plumbing! How can I help you today?");
assert.equal(payload.serverUrl, serverUrl);
assert.equal(payload.tools[0].server.url, "https://project.supabase.co/functions/v1/vapi-tools-availability");

console.log("Payload snapshot checks passed.");
