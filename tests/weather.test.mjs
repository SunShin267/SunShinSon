import assert from "node:assert/strict";
import test from "node:test";

import { DA_NANG_COORDS, describeWeather, fetchWeather } from "../app/lib/weather.ts";

test("uses Da Nang as the fixed fallback location", () => {
  assert.deepEqual(DA_NANG_COORDS, { latitude: 16.0544, longitude: 108.2022 });
});

test("maps Open-Meteo weather codes to child-friendly Vietnamese", () => {
  assert.deepEqual(describeWeather(0, true), {
    icon: "☀️",
    label: "Trời quang",
    message: "Trời hôm nay đẹp quá, bé hãy cùng vui học và khám phá nhé!",
  });
  assert.deepEqual(describeWeather(61, true), {
    icon: "🌧️",
    label: "Có mưa",
    message: "Trời đang mưa, mình cùng khám phá những trò vui trong nhà nhé!",
  });
  assert.deepEqual(describeWeather(95, false), {
    icon: "⛈️",
    label: "Có giông",
    message: "Ngoài trời có giông, bé ở nơi an toàn và cùng SunShinSon vui học nhé!",
  });
});

test("formats current weather with temperature and location label", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    current: { temperature_2m: 27.6, weather_code: 1, is_day: 1 },
  }));

  try {
    const weather = await fetchWeather(16, 108, "Đà Nẵng");
    assert.deepEqual(weather, {
      icon: "🌤️",
      title: "Có mây",
      detail: "28°C · Đà Nẵng",
      message: "Mây đang dạo chơi, bé cùng SunShinSon khám phá điều hay nhé!",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
