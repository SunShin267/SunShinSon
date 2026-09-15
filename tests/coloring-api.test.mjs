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
