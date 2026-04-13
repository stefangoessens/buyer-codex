export function buildListingIntakeHref(url: string): string {
  return `/intake?url=${encodeURIComponent(url)}`;
}
