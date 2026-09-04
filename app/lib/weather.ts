export const DA_NANG_COORDS = {
  latitude: 16.0544,
  longitude: 108.2022,
} as const;

export type WeatherView = {
  icon: string;
  title: string;
  detail: string;
};

export function describeWeather(code: number, isDay: boolean) {
  if (code === 0) return { icon: isDay ? "☀️" : "🌙", label: "Trời quang" };
  if (code <= 3) return { icon: isDay ? "🌤️" : "☁️", label: "Có mây" };
  if (code <= 48) return { icon: "🌫️", label: "Có sương" };
  if (code <= 57) return { icon: "🌦️", label: "Mưa phùn" };
  if (code <= 67) return { icon: "🌧️", label: "Có mưa" };
  if (code <= 77) return { icon: "🌨️", label: "Có tuyết" };
  if (code <= 82) return { icon: "🌦️", label: "Mưa rào" };
  if (code <= 86) return { icon: "🌨️", label: "Mưa tuyết" };
  return { icon: "⛈️", label: "Có giông" };
}

export async function fetchWeather(
  latitude: number,
  longitude: number,
  locationLabel: string,
  signal?: AbortSignal,
): Promise<WeatherView> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,weather_code,is_day",
    timezone: "auto",
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal });
  if (!response.ok) throw new Error("Không thể tải thời tiết");

  const payload = await response.json() as {
    current?: { temperature_2m?: number; weather_code?: number; is_day?: number };
  };
  const current = payload.current;
  if (
    !current ||
    typeof current.temperature_2m !== "number" ||
    typeof current.weather_code !== "number"
  ) {
    throw new Error("Dữ liệu thời tiết không hợp lệ");
  }

  const condition = describeWeather(current.weather_code, current.is_day !== 0);
  return {
    icon: condition.icon,
    title: condition.label,
    detail: `${Math.round(current.temperature_2m)}°C · ${locationLabel}`,
  };
}
