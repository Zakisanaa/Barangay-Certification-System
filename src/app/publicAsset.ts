export function publicAsset(path: string): string {
  const normalizedPath = path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${import.meta.env.BASE_URL}${normalizedPath}`;
}
