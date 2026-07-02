import { API_BASE_URL } from '../api/client';

const API_ORIGIN = new URL(API_BASE_URL, window.location.origin).origin;

export function toDisplayImageUrl(src?: string | null): string | null {
  if (!src) {
    return null;
  }

  if (src.startsWith('blob:') || src.startsWith('data:')) {
    return src;
  }

  if (src.startsWith('/uploads/')) {
    return `${API_ORIGIN}${src}`;
  }

  if (src.startsWith('products/') || src.startsWith('chats/')) {
    return `${API_ORIGIN}/uploads/${src}`;
  }

  try {
    return new URL(src).toString();
  } catch {
    return new URL(src, API_ORIGIN).toString();
  }
}

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
      hostname.endsWith('.via.placeholder.com')
    );
  } catch {
    return false;
  }
}
