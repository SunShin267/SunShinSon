export const SAVED_COLORING_STORAGE_KEY = "sunshinson-coloring-library";
export const SAVED_COLORING_STORAGE_VERSION = 1;
export const MAX_SAVED_COLORING_ARTS = 10;
export const MAX_SAVED_IMAGE_CHARACTERS = 4_000_000;

export type SavedColoringArt = {
  id: string;
  title: string;
  prompt: string;
  src: string;
  icon: string;
  theme: "Mẫu của bé";
  generated: true;
  saved: true;
  savedAt: number;
};

function isSavedColoringArt(value: unknown): value is SavedColoringArt {
  if (!value || typeof value !== "object") return false;
  const art = value as Partial<SavedColoringArt>;
  return (
    typeof art.id === "string" && art.id.startsWith("sun-ai-") &&
    typeof art.title === "string" && art.title.length > 0 && art.title.length <= 160 &&
    typeof art.prompt === "string" && art.prompt.length > 0 && art.prompt.length <= 160 &&
    typeof art.src === "string" && /^data:image\/(?:jpeg|png|webp);base64,/i.test(art.src) &&
    art.icon === "💛" && art.theme === "Mẫu của bé" &&
    art.generated === true && art.saved === true &&
    typeof art.savedAt === "number" && Number.isFinite(art.savedAt)
  );
}

export function isSavedColoringCollection(value: unknown): value is SavedColoringArt[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_SAVED_COLORING_ARTS &&
    value.every(isSavedColoringArt) &&
    value.reduce((total, art) => total + art.src.length, 0) <= MAX_SAVED_IMAGE_CHARACTERS
  );
}

export function addSavedColoringArt(
  current: SavedColoringArt[],
  art: Omit<SavedColoringArt, "savedAt"> & { savedAt?: number },
) {
  const unique = [
    { ...art, savedAt: art.savedAt ?? Date.now() } as SavedColoringArt,
    ...current.filter((item) => item.id !== art.id),
  ];
  const kept: SavedColoringArt[] = [];
  let totalCharacters = 0;

  for (const item of unique) {
    if (kept.length >= MAX_SAVED_COLORING_ARTS) break;
    if (totalCharacters + item.src.length > MAX_SAVED_IMAGE_CHARACTERS) continue;
    kept.push(item);
    totalCharacters += item.src.length;
  }

  return kept;
}

