import type { ColoringArt } from "./coloring-arts";

const PAINTING_SESSION_KEY = "sunshinson:coloring:active-art";

function isPaintingArt(value: unknown): value is ColoringArt {
  if (!value || typeof value !== "object") return false;
  const art = value as Record<string, unknown>;
  const src = typeof art.src === "string" ? art.src : "";

  return (
    typeof art.id === "string" &&
    typeof art.title === "string" &&
    typeof art.prompt === "string" &&
    typeof art.icon === "string" &&
    typeof art.theme === "string" &&
    (src.startsWith("/images/to-mau/") || src.startsWith("data:image/"))
  );
}

export function savePaintingSession(art: ColoringArt) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PAINTING_SESSION_KEY, JSON.stringify(art));
  } catch {
    // Static library images can still be restored from their URL id.
  }
}

export function readPaintingSession(id: string) {
  if (typeof window === "undefined") return null;
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(PAINTING_SESSION_KEY) ?? "null");
    return isPaintingArt(value) && value.id === id ? value : null;
  } catch {
    return null;
  }
}
