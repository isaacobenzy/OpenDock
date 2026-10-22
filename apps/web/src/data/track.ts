/** Films the dock's Now playing widget can open. Audio stays on YouTube. */

export type PreviewTrack = {
  id: string;
  title: string;
  artist: string;
  youtubeId: string;
};

export const previewTracks: readonly PreviewTrack[] = [
  {
    id: "fusion-jazz",
    title: "Just 2 Minutes of Fusion Jazz!",
    artist: "Giulio Carmassi",
    youtubeId: "Ljy6IxNlaxw",
  },
  {
    id: "tokyo",
    title: "Tokyo",
    artist: "Toshiki Soejima feat. Nahokimama",
    youtubeId: "0uPNXDD1sRU",
  },
];

export const previewTrack = previewTracks[0];

export function watchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
}

export function youtubeEmbedSrc(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`;
}

/** Wrap a previous/next step around the playlist. */
export function trackIndex(current: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return (((current + delta) % count) + count) % count;
}
