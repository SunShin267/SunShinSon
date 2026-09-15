import assert from "node:assert/strict";
import test from "node:test";

import { buildColoringPrompt, handleColoringApiRequest, normalizeColoringPrompt } from "../worker/coloring-api.ts";

test("normalizes a child's coloring idea without keeping control characters", () => {
  assert.equal(normalizeColoringPrompt("  Thỏ\nôm\t cà rốt  "), "Thỏ ôm cà rốt");
  assert.equal(normalizeColoringPrompt({ prompt: "nope" }), "");
});

test("builds a child-safe black-and-white coloring prompt", () => {
  const prompt = buildColoringPrompt("tàu ngầm gặp rùa biển");
  assert.match(prompt, /tàu ngầm gặp rùa biển/);
  assert.match(prompt, /black outlines only/);
  assert.match(prompt, /No color/);
  assert.match(prompt, /no text/);
});

test("generates an image through the Workers AI binding", async () => {
  const request = new Request("https://sunshinson.example/api/coloring/generate", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://sunshinson.example" },
    body: JSON.stringify({ prompt: "thỏ con trong vườn hoa" }),
  });
  const env = {
    AI: {
      async run(model, input) {
        assert.equal(model, "@cf/black-forest-labs/flux-1-schnell");
        assert.equal(input.steps, 4);
        return { image: "ZmFrZS1pbWFnZQ==" };
      },
    },
  };

  const response = await handleColoringApiRequest(request, env);
  assert.equal(response?.status, 200);
  assert.deepEqual(await response?.json(), {
    image: "data:image/jpeg;base64,ZmFrZS1pbWFnZQ==",
    model: "flux-1-schnell",
    provider: "cloudflare",
  });
});

test("rejects unsafe ideas before calling the model", async () => {
  const request = new Request("https://sunshinson.example/api/coloring/generate", {
    method: "POST",
    body: JSON.stringify({ prompt: "vẽ một khẩu súng" }),
  });
  let called = false;
  const response = await handleColoringApiRequest(request, {
    AI: { async run() { called = true; return { image: "unused" }; } },
  });

  assert.equal(response?.status, 400);
  assert.equal(called, false);
});

test("uses the protected proxy when the hosting worker has no AI binding", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://coloring-provider.example/api/internal/coloring/generate");
    assert.equal(init.headers["x-coloring-proxy-secret"], "test-secret");
    return Response.json({ image: "cHJveHktaW1hZ2U=" });
  };

  try {
    const request = new Request("https://sunshinson.example/api/coloring/generate", {
      method: "POST",
      body: JSON.stringify({ prompt: "cá voi bay giữa những đám mây" }),
    });
    const response = await handleColoringApiRequest(request, {
      COLORING_AI_PROXY_URL: "https://coloring-provider.example/",
      COLORING_AI_PROXY_SECRET: "test-secret",
    });

    assert.equal(response?.status, 200);
    const payload = await response?.json();
    assert.equal(payload.image, "data:image/jpeg;base64,cHJveHktaW1hZ2U=");
    assert.equal(payload.provider, "cloudflare");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("falls back to Pollinations when Cloudflare Workers AI fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://gen.pollinations.ai/v1/images/generations");
    assert.equal(init.headers.authorization, "Bearer pollinations-test-key");
    const body = JSON.parse(init.body);
    assert.equal(body.model, "flux");
    assert.equal(body.response_format, "b64_json");
    assert.match(body.safe, /sexual/);
    return Response.json({ data: [{ b64_json: "cG9sbGluYXRpb25zLWltYWdl" }] });
  };

  try {
    const request = new Request("https://sunshinson.example/api/coloring/generate", {
      method: "POST",
      body: JSON.stringify({ prompt: "gấu con đọc sách dưới gốc cây" }),
    });
    const response = await handleColoringApiRequest(request, {
      AI: { async run() { throw Object.assign(new Error("quota exceeded"), { status: 429 }); } },
      POLLINATIONS_API_KEY: "pollinations-test-key",
    });

    assert.equal(response?.status, 200);
    assert.deepEqual(await response?.json(), {
      image: "data:image/jpeg;base64,cG9sbGluYXRpb25zLWltYWdl",
      model: "flux",
      provider: "pollinations",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("continues to Pollinations when the Cloudflare proxy is rate limited", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls += 1;
    if (calls === 1) {
      assert.equal(url, "https://coloring-provider.example/api/internal/coloring/generate");
      return Response.json({ error: "quota" }, { status: 429 });
    }
    assert.equal(url, "https://gen.pollinations.ai/v1/images/generations");
    return Response.json({ data: [{ b64_json: "data:image/png;base64,ZmFsbGJhY2s=" }] });
  };

  try {
    const request = new Request("https://sunshinson.example/api/coloring/generate", {
      method: "POST",
      body: JSON.stringify({ prompt: "tàu hỏa chạy qua cánh đồng" }),
    });
    const response = await handleColoringApiRequest(request, {
      COLORING_AI_PROXY_URL: "https://coloring-provider.example",
      COLORING_AI_PROXY_SECRET: "test-secret",
      POLLINATIONS_API_KEY: "pollinations-test-key",
      POLLINATIONS_IMAGE_MODEL: "zimage",
    });

    assert.equal(response?.status, 200);
    assert.deepEqual(await response?.json(), {
      image: "data:image/jpeg;base64,ZmFsbGJhY2s=",
      model: "zimage",
      provider: "pollinations",
    });
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("protects the internal image provider endpoint", async () => {
  const request = new Request("https://provider.example/api/internal/coloring/generate", {
    method: "POST",
    headers: { "x-coloring-proxy-secret": "wrong-secret" },
    body: JSON.stringify({ prompt: "safe generated prompt" }),
  });
  const response = await handleColoringApiRequest(request, {
    COLORING_AI_PROXY_SECRET: "right-secret",
    AI: { async run() { return { image: "unused" }; } },
  });
  assert.equal(response?.status, 401);
});
