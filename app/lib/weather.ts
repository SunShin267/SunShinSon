export const DA_NANG_COORDS = {
  latitude: 16.0544,
  longitude: 108.2022,
} as const;

export type WeatherView = {
  icon: string;
  title: string;
  detail: string;
  message: string;
};

export function describeWeather(code: number, isDay: boolean) {
  if (code === 0) return {
    icon: isDay ? "☀️" : "🌙",
    label: "Trời quang",
    message: isDay
      ? "Trời hôm nay đẹp quá, bé hãy cùng vui học và khám phá nhé!"
      : "Đêm nay trời trong quá, bé khám phá thêm một điều hay rồi nghỉ ngơi nhé!",
  };
  if (code <= 3) return {
    icon: isDay ? "🌤️" : "☁️",
    label: "Có mây",
    message: "Mây đang dạo chơi, bé cùng SunShinSon khám phá điều hay nhé!",
  };
  if (code <= 48) return {
    icon: "🌫️",
    label: "Có sương",
    message: "Ngoài trời có sương, bé nhớ đi cùng người lớn và giữ ấm nhé!",
  };
  if (code <= 57) return {
    icon: "🌦️",
    label: "Mưa phùn",
    message: "Mưa rơi tí tách, mình cùng vui học trong nhà nhé!",
  };
  if (code <= 67) return {
    icon: "🌧️",
    label: "Có mưa",
    message: "Trời đang mưa, mình cùng khám phá những trò vui trong nhà nhé!",
  };
  if (code <= 77) return {
    icon: "🌨️",
    label: "Có tuyết",
    message: "Ngoài trời có tuyết, bé nhớ mặc thật ấm trước khi ra ngoài nhé!",
  };
  if (code <= 82) return {
    icon: "🌦️",
    label: "Mưa rào",
    message: "Có mưa rào rồi, bé cùng SunShinSon vui học trong nhà nhé!",
  };
  if (code <= 86) return {
    icon: "🌨️",
    label: "Mưa tuyết",
    message: "Trời lạnh lắm, bé nhớ giữ ấm và ở nơi khô ráo nhé!",
  };
  return {
    icon: "⛈️",
    label: "Có giông",
    message: "Ngoài trời có giông, bé ở nơi an toàn và cùng SunShinSon vui học nhé!",
  };
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
    message: condition.message,
  };
}
