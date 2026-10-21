import { addDockItem, removeDockItem, type DockSize } from "@opendock/config-schema";
import { useState } from "react";
import type { HubPage } from "../../services/ipc";
import { useSettings } from "../../services/settingsContext";
import {
  searchWidgets,
  widgetCatalog,
  widgetCategories,
  type WidgetCategory,
  type WidgetDefinition,
} from "../widgets/catalog";
import { Icon } from "../widgets/icons";
import { TileContent } from "../widgets/tiles";
import { PageHeader } from "./PageHeader";
import "../dock/dock.css";

const SIZE_LABEL: Record<DockSize, string> = { s: "S", m: "M", l: "L" };

function PreviewDock({ ids, size, styleName }: { ids: string[]; size: DockSize; styleName: string }) {
  return (
    <div className={`preview-dock dock-shell size-${size} style-${styleName} horizontal`} aria-hidden>
      <div className="dock-track">
        {ids.map((id) => (
          <div className="dock-item" key={id}>
            <TileContent id={id} size={size} compact={false} />
          </div>
        ))}
      </div>
    </div>
  );
}

function WidgetCard({
  widget,
  added,
  onToggle,
  onConfigure,
}: {
  widget: WidgetDefinition;
  added: boolean;
  onToggle: () => void;
  onConfigure: (page: HubPage) => void;
}) {
  const { settings } = useSettings();
  const [previewSize, setPreviewSize] = useState<DockSize>(settings.dock.size);
  const local = widget.network.length === 0;

  return (
    <article className={`widget-card ${added ? "is-added" : ""}`}>
      <div className="widget-preview">
        <PreviewDock ids={[widget.id]} size={previewSize} styleName={settings.dock.style} />
      </div>
      <div className="widget-card-body">
        <div className="widget-card-title">
          <h3>{widget.name}</h3>
          <span className="chip">{widget.category}</span>
        </div>
        <p className="muted">{widget.description}</p>
        <div className="widget-badges">
          <div className="size-badges" role="radiogroup" aria-label={`Preview ${widget.name} size`}>
            {widget.sizes.map((size) => (
              <button
                key={size}
                type="button"
                role="radio"
                aria-checked={previewSize === size}
                className={previewSize === size ? "is-active" : ""}
                onClick={() => setPreviewSize(size)}
              >
                {SIZE_LABEL[size]}
              </button>
            ))}
          </div>
          <span className={`privacy-badge ${local ? "is-local" : "is-network"}`} title={local ? undefined : widget.network.join(", ")}>
            <Icon name={local ? "lock" : "shield"} size={12} />
            {local ? "Local only" : `Connects to ${widget.network[0]}`}
          </span>
        </div>
        {widget.stores ? <p className="small muted">Stores: {widget.stores}</p> : null}
      </div>
      <footer className="widget-card-foot">
        {widget.configure ? (
          <button type="button" className="text-button" onClick={() => onConfigure(widget.configure!)}>
            <Icon name="settings" size={12} /> Set up
          </button>
        ) : (
          <span />
        )}
        <button type="button" className={`button ${added ? "" : "is-primary"}`} onClick={onToggle}>
          {added ? (
            <>
              <Icon name="check" size={14} /> On dock
            </>
          ) : (
            <>
              <Icon name="plus" size={14} /> Add
            </>
          )}
        </button>
      </footer>
    </article>
  );
}

export function GalleryPage({ onNavigate }: { onNavigate: (page: HubPage) => void }) {
  const { settings, update } = useSettings();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<WidgetCategory | "All">("All");
  const [error, setError] = useState<string | null>(null);
  const order = settings.dock.itemOrder;
  const results = searchWidgets(query, category);
  const onDockCount = widgetCatalog.filter((w) => order.includes(w.id)).length;

  const toggle = (id: string) => {
    void update((s) => ({
      ...s,
      dock: {
        ...s.dock,
        itemOrder: s.dock.itemOrder.includes(id)
          ? removeDockItem(s.dock.itemOrder, id)
          : addDockItem(s.dock.itemOrder, id),
      },
    })).then(setError);
  };

  return (
    <div className="page gallery-page">
      <PageHeader
        title="Widget gallery"
        subtitle={`${onDockCount} of ${widgetCatalog.length} widgets on your dock. Drag widgets on the dock to reorder them.`}
        actions={
          <button type="button" className="button" onClick={() => onNavigate("dock")}>
            <Icon name="dock" size={14} /> Dock settings
          </button>
        }
      />

      <section className="gallery-hero">
        <p className="eyebrow">Your dock</p>
        <PreviewDock ids={order} size={settings.dock.size} styleName={settings.dock.style} />
      </section>

      <div className="gallery-toolbar">
        <div className="search-field">
          <Icon name="search" size={14} />
          <input
            type="search"
            placeholder="Search widgets"
            aria-label="Search widgets"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="chip-group" role="radiogroup" aria-label="Category">
          {(["All", ...widgetCategories] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={category === c}
              className={`chip ${category === c ? "is-active" : ""}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      {error ? <p className="callout is-error" role="alert">{error}</p> : null}

      {results.length === 0 ? (
        <p className="muted">No widgets match “{query}”.</p>
      ) : (
        <div className="widget-grid">
          {results.map((widget) => (
            <WidgetCard
              key={widget.id}
              widget={widget}
              added={order.includes(widget.id)}
              onToggle={() => toggle(widget.id)}
              onConfigure={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
