import { mediaControl } from "../../../services/ipc";
import { useLive } from "../../../services/liveContext";
import { Icon } from "../../widgets/icons";
import { PanelState } from "../../widgets/visuals";
import { PanelHeader } from "./PanelHeader";

export function MediaPanel() {
  const { media } = useLive();

  if (media.status === "loading") {
    return <PanelState kind="loading" title="Looking for media" />;
  }
  if (media.status === "error") {
    return <PanelState kind="error" title="Media controls are unavailable" detail={media.error} />;
  }
  const m = media.data;
  if (!m.available || !m.title) {
    return (
      <>
        <PanelHeader icon="music" title="Now playing" />
        <PanelState
          kind="empty"
          title="Nothing is playing"
          detail="Start music or a video in any app that supports Windows media controls."
        />
      </>
    );
  }

  return (
    <>
      <PanelHeader icon="music" title="Now playing" subtitle={m.app || undefined} />
      <div className="media-hero">
        <div className={`media-cover ${m.playing ? "is-playing" : ""}`} aria-hidden>
          <Icon name="music" size={34} />
        </div>
        <div className="media-meta">
          <p className="media-title">{m.title}</p>
          <p className="media-artist">{m.artist || "Unknown artist"}</p>
          {m.album ? <p className="media-album">{m.album}</p> : null}
        </div>
      </div>
      <div className="media-controls">
        <button
          type="button"
          className="round-button"
          aria-label="Previous track"
          disabled={!m.canPrevious}
          onClick={() => void mediaControl("previous")}
        >
          <Icon name="previous" size={18} />
        </button>
        <button
          type="button"
          className="round-button is-primary"
          aria-label={m.playing ? "Pause" : "Play"}
          onClick={() => void mediaControl("toggle")}
        >
          <Icon name={m.playing ? "pause" : "play"} size={22} />
        </button>
        <button
          type="button"
          className="round-button"
          aria-label="Next track"
          disabled={!m.canNext}
          onClick={() => void mediaControl("next")}
        >
          <Icon name="next" size={18} />
        </button>
      </div>
    </>
  );
}
