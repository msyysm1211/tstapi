// src/index.js
var MODELS = [
  "perplexity/sonar",
  "google/gemini-2.5-flash",
  "google/gemini-2.0-flash",
  "openai/gpt-4.1-nano",
  "togetherai/Meta-Llama-3.1-70B-Instruct-Turbo",
  "google/gemini-1.5-flash-latest",
  "anthropic/claude-3-haiku-20240307",
  "openai/gpt-4o-mini"
];
var src_default = {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request);
    } catch (err) {
      return new Response(err.stack, { status: 502 });
    }
  }
};
async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === "/v1/models") {
    return handleModelsRequest();
  } else {
    return new Response("Not Found", { status: 404 });
  }
}
function handleModelsRequest() {
  const data = MODELS.map((model) => ({
    id: model,
    object: "model",
    created: Date.now(),
    owned_by: "organization-owner"
  }));
  return new Response(JSON.stringify({ object: "list", data }), {
    headers: { "Content-Type": "application/json" }
  });
}
export {
  src_default as default
};
