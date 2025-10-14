// index.js
var MODELS = ["perplexity/sonar", "google/gemini-2.5-flash", "google/gemini-2.0-flash", "openai/gpt-4.1-nano", "togetherai/Meta-Llama-3.1-70B-Instruct-Turbo", "google/gemini-1.5-flash-latest", "anthropic/claude-3-haiku-20240307", "openai/gpt-4o-mini"];
var tstapi_default = {
  async fetch(request, env, ctx) {
    const data = MODELS.map(model => ({
      id: model,
      object: "model",
      created: Date.now(),
      owned_by: "organization-owner"
    }));
    return new Response(JSON.stringify({
      object: "list",
      data
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
};

// .dev/mock/cache.js
var MockCache = class {
  constructor(port) {
    this.port = port;
  }
  async put(reqOrUrl, response) {
    if (arguments.length < 2) {
      throw new TypeError(`Failed to execute 'put' on 'cache': 2 arguments required, but only ${arguments.length} present.`);
    }
    if (!reqOrUrl) {
      throw new TypeError("Failed to execute 'put' on 'cache': 2 arguments required, but only 0 present.");
    }
    if (!(response instanceof Response)) {
      throw new TypeError("Failed to execute 'put' on 'cache': Argument 2 is not of type Response.");
    }
    try {
      const body = await response.clone().text();
      const headers = {};
      response.headers.forEach((v, k) => headers[k] = v);
      const cacheControl = response.headers.get("Cache-Control") || "";
      const ttl = this.parseTTL(cacheControl);
      const key = this.normalizeKey(reqOrUrl);
      const fetchRes = await fetch(`http://localhost:${this.port}/mock_cache/put`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          key,
          response: {
            status: response.status,
            headers,
            body
          },
          ttl
        })
      });
      if (!fetchRes.ok) {
        const error = await fetchRes.json();
        throw new Error(error.error);
      }
      return void 0;
    } catch (err2) {
      throw new Error(`Cache put failed: ${err2.message}`);
    }
  }
  async get(reqOrUrl) {
    const key = this.normalizeKey(reqOrUrl);
    const fetchRes = await fetch(`http://localhost:${this.port}/mock_cache/get`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        key
      })
    });
    if (!fetchRes.ok) {
      const error = await fetchRes.json();
      throw new Error(error.error);
    }
    const res = await fetchRes.json();
    if (res && res.success) {
      return new Response(res.data.response.body, {
        status: res.data.response.status,
        headers: new Headers(res.data.response.headers)
      });
    } else {
      return void 0;
    }
  }
  async delete(reqOrUrl) {
    const key = this.normalizeKey(reqOrUrl);
    const fetchRes = await fetch(`http://localhost:${this.port}/mock_cache/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        key
      })
    });
    if (!fetchRes.ok) {
      const error = await fetchRes.json();
      throw new Error(error.error);
    }
    const res = await fetchRes.json();
    return res.success;
  }
  normalizeKey(input) {
    const url = input instanceof Request ? input.url : input;
    return url.replace(/^https:/i, "http:");
  }
  parseTTL(cacheControl) {
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    return maxAgeMatch ? parseInt(maxAgeMatch[1]) : 3600;
  }
};
var cache_default = MockCache;

// .dev/mock/kv.js
var mockKV = class _EdgeKV {
  static port = 0;
  JS_RESPONSE_BUFFER_THRESHOLD = 64 * 1024;
  constructor(options) {
    if (!options || !options.namespace && !options.namespaceId) {
      throw new TypeError("The argument to `EdgeKV` must be an object with a `namespace` or `namespaceId` field");
    }
    this.namespace = options.namespace;
  }
  async put(key, value) {
    if (arguments.length < 2) {
      throw new TypeError(`Failed to execute 'put' on 'EdgeKV': 2 arguments required, but only ${arguments.length} present.`);
    }
    if (!key) {
      throw new TypeError("Failed to execute 'put' on 'EdgeKV': 2 arguments required, but only 0 present.");
    }
    if (typeof key !== "string") {
      throw new TypeError(`Failed to execute 'put' on 'EdgeKV': 1th argument must be a string.`);
    }
    try {
      let body;
      if (typeof value === "string") {
        if (value.length > this.JS_RESPONSE_BUFFER_THRESHOLD) {
          const encoder = new TextEncoder();
          const encodedValue = encoder.encode(value);
          body = new ReadableStream({
            start(controller) {
              controller.enqueue(encodedValue);
              controller.close();
            }
          });
        } else {
          body = value;
        }
      } else if (value instanceof Response) {
        const resBody = await value.clone().text();
        const headers = {};
        value.headers.forEach((v, k) => headers[k] = v);
        body = JSON.stringify({
          body: resBody,
          headers,
          status: value.status
        });
      } else if (value instanceof ReadableStream || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
        body = value;
      } else {
        throw new TypeError(`Failed to execute 'put' on 'EdgeKV': 2nd argument should be one of string/Response/ArrayBuffer/ArrayBufferView/ReadableStream`);
      }
      const fetchRes = await fetch(`http://localhost:${_EdgeKV.port}/mock_kv/put?key=${key}&namespace=${this.namespace}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body
      });
      if (!fetchRes.ok) {
        const error = await fetchRes.json();
        throw new Error(error.error);
      }
      return void 0;
    } catch (err2) {
      throw new Error(`Cache put failed: ${err2.message}`);
    }
  }
  async get(key, options) {
    const isTypeValid = ty => typeof ty === "string" && (ty === "text" || ty === "json" || ty === "stream" || ty === "arrayBuffer");
    if (options && !isTypeValid(options?.type)) {
      throw new TypeError("EdgeKV.get: 2nd optional argument must be an object with a 'type' field. The 'type' field specifies the format of the return value and must be a string of 'text', 'json', 'stream' or 'arrayBuffer'");
    }
    const type = options?.type || "text";
    const fetchRes = await fetch(`http://localhost:${_EdgeKV.port}/mock_kv/get?key=${key}&namespace=${this.namespace}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    });
    let isGetFailed = false;
    fetchRes.headers.forEach((v, k) => {
      if (k === "kv-get-empty") {
        isGetFailed = true;
      }
    });
    if (isGetFailed) {
      return void 0;
    }
    switch (type) {
      case "text":
        return fetchRes.text();
      case "json":
        try {
          const value2 = await fetchRes.text();
          const userObject = JSON.parse(value2);
          return userObject;
        } catch (error) {
          throw new TypeError(`Invalid JSON: ${err.message}`);
        }
      case "arrayBuffer":
        try {
          const buffer = await fetchRes.arrayBuffer();
          return buffer;
        } catch (error) {
          throw new TypeError(`Failed to read the response body into an ArrayBuffer: ${error.message}`);
        }
      case "stream":
        const value = await fetchRes.text();
        return new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(value));
            controller.close();
          }
        });
      default:
        throw new Error(`Unsupported type: ${type}`);
    }
  }
  async delete(key) {
    const fetchRes = await fetch(`http://localhost:${_EdgeKV.port}/mock_kv/delete?key=${key}&namespace=${this.namespace}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    });
    if (!fetchRes.ok) {
      const error = await fetchRes.json();
      throw new Error(error.error);
    }
    const res = await fetchRes.json();
    return res.success;
  }
};
var kv_default = mockKV;

// .dev/devEntry-1760446224328.js
var mock_cache = new cache_default(18080);
globalThis.mockCache = mock_cache;
kv_default.port = 18080;
globalThis.mockKV = kv_default;
var devEntry_1760446224328_default = tstapi_default;
export { devEntry_1760446224328_default as default };