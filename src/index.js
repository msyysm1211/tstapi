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
    try {
      return await handleRequest(request);
    } catch (err) {
      return new Response("cfworker error:\n" + err.stack, { status: 502 });
    }
  },
};

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/v1/models") {
    return handleModelsRequest();
  } else if (path === "/v1/chat/completions") {
    return handleChatCompletionsRequest(request);
  } else {
    return new Response("Not Found", { status: 404 });
  }
}

function handleModelsRequest() {
  const data = MODELS.map((model) => ({
    id: model,
    object: "model",
    created: Date.now(),
    owned_by: "organization-owner",
  }));

  return new Response(JSON.stringify({ object: "list", data }), {
    headers: { "Content-Type": "application/json" },
  });
}

async function handleChatCompletionsRequest(request) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const requestBody = await request.json();
  const stream = requestBody.stream || false;

  // 1. Get anon user token
  const anonUserId = `anon_${crypto.randomUUID()}`;
  const anonUserResponse = await fetch(
    "https://www.iron.cx/api/upsert-anon-user",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36",
      },
      body: JSON.stringify({
        anonUserId,
        geoCountry: "null",
        geoLatitude: null,
        geoLongitude: null,
      }),
    }
  );

  if (!anonUserResponse.ok) {
    return new Response("Failed to get anonymous user token", { status: 500 });
  }

  const anonUserData = await anonUserResponse.json();
  const token = anonUserData.token;

  // 2. Forward to chat completions
  const chatCompletionsBody = {
    ...requestBody,
    stream: true, // Always stream from the backend
  };

  const chatCompletionsResponse = await fetch(
    "https://www.iron.cx/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36",
      },
      body: JSON.stringify(chatCompletionsBody),
    }
  );

  if (!chatCompletionsResponse.ok) {
    return new Response("Failed to get chat completions", { status: 500 });
  }

  if (stream) {
    // Handle streaming response
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const reader = chatCompletionsResponse.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    let buffer = "";

    const processText = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          writer.close();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.substring(6);
            if (data === "[DONE]") {
              await writer.write(encoder.encode("data: [DONE]\n\n"));
              continue;
            }
            try {
              const json = JSON.parse(data);
              const openaiResponse = {
                id: json.responseMessageId,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model: json.model,
                choices: [
                  {
                    index: 0,
                    delta: { content: json.text || "" },
                    finish_reason: json.usage ? "stop" : null,
                  },
                ],
              };
              await writer.write(
                encoder.encode(`data: ${JSON.stringify(openaiResponse)}\n\n`)
              );
            } catch (e) {
              // ignore parse errors
            }
          }
        }
      }
    };

    processText();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } else {
    // Handle non-streaming response
    const reader = chatCompletionsResponse.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let finalJson = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.substring(6);
          if (data !== "[DONE]") {
            try {
              const json = JSON.parse(data);
              if (json.text) {
                fullText += json.text;
              }
              if (json.usage) {
                finalJson = json;
              }
            } catch (e) {
              // ignore parse errors
            }
          }
        }
      }
    }

    if (finalJson) {
      const openaiResponse = {
        id: finalJson.responseMessageId,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: finalJson.model,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: fullText,
            },
            finish_reason: "stop",
          },
        ],
        usage: finalJson.usage,
      };
      return new Response(JSON.stringify(openaiResponse), {
        headers: { "Content-Type": "application/json" },
      });
    } else {
      return new Response("Failed to construct non-streaming response", {
        status: 500,
      });
    }
  }
}
