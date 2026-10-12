/**
 * Stable colour per speaker. Derived from the name rather than stored, so the same person gets
 * the same colour on the DJ page, the phone and the web app without anything to keep in sync —
 * the hash below is duplicated verbatim in public/dj-web/index.html and DJChatScreen.kt, so keep
 * the three in step.
 */
export const SPEAKER_COLORS = [
  '#8b7cf6', // violet (the app accent)
  '#12a594', // teal
  '#e0557a', // rose
  '#b9740f', // amber
  '#3fa45c', // green
  '#4a86f0', // blue
];

/** Java-style int hash, so JS and Kotlin agree on the index. */
export function speakerIndex(name: string): number {
  let hash = 0;
  const key = name.trim().toLowerCase();
  for (let i = 0; i < key.length; i++) {
    // tslint:disable-next-line no-bitwise
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  const size = SPEAKER_COLORS.length;
  return ((hash % size) + size) % size;
}

export function speakerColor(name?: string): string {
  return name ? SPEAKER_COLORS[speakerIndex(name)] : SPEAKER_COLORS[0];
}

/** The same colour as a faint fill, for the DJ page's tinted bubbles. */
export function speakerTint(name: string | undefined, alpha: number = 0.16): string {
  const hex = speakerColor(name);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
