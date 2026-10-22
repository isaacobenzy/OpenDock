import { describe, expect, it } from "vitest";
import { previewTracks, trackIndex, watchUrl, youtubeEmbedSrc } from "../data/track";

describe("now playing preview", () => {
  it("queues the two films from the dock, without copying the audio", () => {
    expect(previewTracks.map((track) => track.youtubeId)).toEqual(["Ljy6IxNlaxw", "0uPNXDD1sRU"]);
    expect(previewTracks[0].title).toBe("Just 2 Minutes of Fusion Jazz!");
    expect(previewTracks[1].title).toBe("Tokyo");
    expect(watchUrl(previewTracks[1].youtubeId)).toBe("https://www.youtube.com/watch?v=0uPNXDD1sRU");
  });

  it("embeds the chosen film from the no-cookie host", () => {
    expect(youtubeEmbedSrc("Ljy6IxNlaxw")).toBe(
      "https://www.youtube-nocookie.com/embed/Ljy6IxNlaxw?autoplay=1&rel=0",
    );
  });

  it("wraps previous and next around the queue", () => {
    expect(trackIndex(0, 1, 2)).toBe(1);
    expect(trackIndex(1, 1, 2)).toBe(0);
    expect(trackIndex(0, -1, 2)).toBe(1);
  });
});
