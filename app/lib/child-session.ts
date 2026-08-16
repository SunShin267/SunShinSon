export const CHILD_NAME_KEY = "sunshinson-name";

export function readChildName() {
  if (typeof window === "undefined") return "";

  try {
    return window.localStorage.getItem(CHILD_NAME_KEY)?.trim() || "";
  } catch {
    return "";
  }
}

export function saveChildName(name: string) {
  if (typeof window === "undefined") return false;

  try {
    window.localStorage.setItem(CHILD_NAME_KEY, name.trim());
    return true;
  } catch {
    return false;
  }
}

export function clearChildName() {
  if (typeof window === "undefined") return false;

  try {
    window.localStorage.removeItem(CHILD_NAME_KEY);
    return true;
  } catch {
    return false;
  }
}
