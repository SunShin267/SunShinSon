export type VersionedStorageRecord<T> = {
  version: number;
  value: T;
};

type ValueValidator<T> = (value: unknown) => value is T;

export function readVersionedStorage<T>(
  key: string,
  version: number,
  isValue: ValueValidator<T>,
) {
  if (typeof window === "undefined") return null;

  try {
    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) return null;

    const record: unknown = JSON.parse(rawValue);
    if (
      !record ||
      typeof record !== "object" ||
      !("version" in record) ||
      !("value" in record) ||
      record.version !== version ||
      !isValue(record.value)
    ) {
      return null;
    }

    return record.value;
  } catch {
    return null;
  }
}

export function writeVersionedStorage<T>(key: string, version: number, value: T) {
  if (typeof window === "undefined") return false;

  try {
    const record: VersionedStorageRecord<T> = { version, value };
    window.localStorage.setItem(key, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export function removeVersionedStorage(key: string) {
  if (typeof window === "undefined") return false;

  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
