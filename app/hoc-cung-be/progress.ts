const STORAGE_KEY_PREFIX = "sunshinson-learning-progress";

export function normalizeChildProfileName(name: string) {
  return name.normalize("NFKC").trim().toLocaleLowerCase("vi-VN");
}

export function getProgressStorageKey(name: string) {
  return `${STORAGE_KEY_PREFIX}:${encodeURIComponent(normalizeChildProfileName(name))}`;
}
