"use client";

import { useEffect, useState } from "react";

import { DA_NANG_COORDS, fetchWeather, type WeatherView } from "../lib/weather";

const loadingWeather: WeatherView = {
  icon: "🌤️",
  title: "Đang xem thời tiết",
  detail: "Đang tìm vị trí của bé…",
};

const unavailableWeather: WeatherView = {
  icon: "☀️",
  title: "Thời tiết Đà Nẵng",
  detail: "Chưa thể cập nhật lúc này",
};

function locateUser(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Trình duyệt không hỗ trợ định vị"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 8_000,
      maximumAge: 15 * 60 * 1_000,
    });
  });
}

export function LocalWeather() {
  const [weather, setWeather] = useState<WeatherView>(loadingWeather);

  useEffect(() => {
    const controller = new AbortController();

    async function loadWeather() {
      try {
        const position = await locateUser();
        const localWeather = await fetchWeather(
          position.coords.latitude,
          position.coords.longitude,
          "Gần vị trí của bé",
          controller.signal,
        );
        setWeather(localWeather);
      } catch {
        try {
          const daNangWeather = await fetchWeather(
            DA_NANG_COORDS.latitude,
            DA_NANG_COORDS.longitude,
            "Đà Nẵng",
            controller.signal,
          );
          setWeather(daNangWeather);
        } catch {
          if (!controller.signal.aborted) setWeather(unavailableWeather);
        }
      }
    }

    void loadWeather();
    return () => controller.abort();
  }, []);

  return (
    <div className="weather-badge" aria-live="polite" aria-label={`${weather.title}, ${weather.detail}`}>
      <span aria-hidden="true">{weather.icon}</span>
      <div><strong>{weather.title}</strong><small>{weather.detail}</small></div>
    </div>
  );
}
