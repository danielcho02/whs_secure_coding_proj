export function isPlaceholderImageUrl(src?: string | null): boolean {
  if (!src) {
    return false;
  }

  try {
    const url = new URL(src, 'http://localhost');
    const hostname = url.hostname.toLowerCase();

    return (
      hostname === 'placehold.co' ||
      hostname.endsWith('.placehold.co') ||
      hostname === 'via.placeholder.com' ||
      hostname.endsWith('.via.placeholder.com') ||
      hostname === 'dummyimage.com' ||
      hostname.endsWith('.dummyimage.com')
    );
  } catch {
    return false;
  }
}
