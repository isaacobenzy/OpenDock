import { previewTracks, trackIndex, watchUrl, youtubeEmbedSrc, type PreviewTrack } from "../data/track";

let index = 0;

export function activeTrack(): PreviewTrack {
  return previewTracks[index] ?? previewTracks[0];
}

function paint(): void {
  const track = activeTrack();
  for (const node of document.querySelectorAll<HTMLElement>("[data-now-title]")) node.textContent = track.title;
  for (const node of document.querySelectorAll<HTMLElement>("[data-now-artist]")) node.textContent = track.artist;
  const label = `Now playing, ${track.title} by ${track.artist}`;
  for (const chip of document.querySelectorAll<HTMLElement>("[data-now-chip]")) {
    chip.setAttribute("aria-label", label);
  }
  for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-now-watch]")) {
    link.href = watchUrl(track.youtubeId);
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-track]")) {
    button.setAttribute("aria-pressed", button.dataset.track === track.id ? "true" : "false");
  }
}

function mountFrame(panel: HTMLElement): void {
  const slot = panel.querySelector<HTMLElement>("[data-yt-slot]");
  if (!slot || panel.hidden) return;
  const track = activeTrack();
  slot.replaceChildren();
  const frame = document.createElement("iframe");
  frame.src = youtubeEmbedSrc(track.youtubeId);
  frame.title = `${track.title} by ${track.artist}`;
  frame.allow = "autoplay; encrypted-media; picture-in-picture";
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  frame.setAttribute("allowfullscreen", "");
  slot.append(frame);
}

/** Load the current film. Does nothing while the dock widget is closed. */
export function mountPreview(panel: HTMLElement): void {
  paint();
  mountFrame(panel);
}

/** Remove the player so closing the dock widget stops the sound. */
export function releasePreview(panel: HTMLElement): void {
  panel.querySelector("[data-yt-slot]")?.replaceChildren();
}

function choose(panel: HTMLElement, next: number): void {
  index = trackIndex(next, 0, previewTracks.length);
  paint();
  mountFrame(panel);
}

let bound = false;

/** Playlist controls, plus Now playing on example layouts outside the homepage studio. */
export function bindNowPlaying(): void {
  if (bound || typeof document === "undefined") return;
  bound = true;

  const panelFor = (trigger: HTMLElement): HTMLElement | null => {
    const id = trigger.getAttribute("aria-controls");
    return id ? document.getElementById(id) : null;
  };

  const close = (panel: HTMLElement): void => {
    releasePreview(panel);
    panel.hidden = true;
    const trigger = document.querySelector<HTMLElement>(`[aria-controls="${panel.id}"]`);
    trigger?.setAttribute("aria-expanded", "false");
    panel.closest(".layout-frame")?.classList.remove("is-now-open");
  };

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const step = target.closest<HTMLElement>("[data-track-step]");
    const pick = target.closest<HTMLElement>("[data-track]");
    if (step || pick) {
      const panel = (step ?? pick)?.closest<HTMLElement>("[data-now-flyout-panel]");
      if (!panel) return;
      event.preventDefault();
      if (step) choose(panel, index + Number(step.dataset.trackStep ?? 1));
      else if (pick) {
        const next = previewTracks.findIndex((track) => track.id === pick.dataset.track);
        if (next >= 0) choose(panel, next);
      }
      return;
    }

    const trigger = target.closest<HTMLElement>("[data-now-flyout]");
    if (trigger && !trigger.closest("[data-studio]")) {
      const panel = panelFor(trigger);
      if (!panel) return;
      const open = !panel.hidden;
      if (open) close(panel);
      else {
        panel.hidden = false;
        trigger.setAttribute("aria-expanded", "true");
        panel.closest(".layout-frame")?.classList.add("is-now-open");
        mountPreview(panel);
      }
      return;
    }

    for (const panel of document.querySelectorAll<HTMLElement>("[data-now-flyout-panel]")) {
      if (panel.hidden || panel.closest("[data-studio]") || panel.contains(target)) continue;
      close(panel);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    for (const panel of document.querySelectorAll<HTMLElement>("[data-now-flyout-panel]")) {
      if (!panel.hidden && !panel.closest("[data-studio]")) close(panel);
    }
  });
}
