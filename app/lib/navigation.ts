const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function internalPath(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const normalizedBasePath = configuredBasePath.replace(/\/$/, "");

  return `${normalizedBasePath}${normalizedPath}`;
}

export function navigateInternal(path: string, replace = false) {
  if (typeof window === "undefined") return;

  const destination = internalPath(path);
  if (replace) {
    window.location.replace(destination);
    return;
  }

  window.location.assign(destination);
}
