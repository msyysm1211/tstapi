"use strict";

const MODELS = [
  "perplexity/sonar",
  "google/gemini-2.5-flash",
  "google/gemini-2.0-flash",
  "openai/gpt-4.1-nano",
  "togetherai/Meta-Llama-3.1-70B-Instruct-Turbo",
  "google/gemini-1.5-flash-latest",
  "anthropic/claude-3-haiku-20240307",
  "openai/gpt-4o-mini",
];

export default {
  async fetch(request, env, ctx) {
    const data = MODELS.map((model) => ({
      id: model,
      object: "model",
      created: Date.now(),
      owned_by: "organization-owner",
    }));

    return new Response(JSON.stringify({ object: "list", data }), {
      headers: { "Content-Type": "application/json" },
    });
  },
};
