import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { reorderDockItems } from "@opendock/config-schema";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  applyDockLayout,
  on,
  openHub,
  openStartMenu,
  setDockLength,
  showFlyout,
} from "../../services/ipc";
import { useSettings } from "../../services/settingsContext";
import { ADD_WIDGET_ID, findWidget } from "../widgets/catalog";
import { TileContent } from "../widgets/tiles";
import { decideTileClick, flyoutKey, type FlyoutMemory } from "./dockClick";
import { anchorOf, DockActionsContext } from "./dockActions";
import "./dock.css";

const HIGHLIGHT_MS = 4000;

function DockItem({
  id,
  vertical,
  highlighted,
  onActivate,
  onMenu,
}: {
  id: string;
  vertical: boolean;
  highlighted: boolean;
  onActivate: (id: string, anchor: number) => void;
  onMenu: (id: string, anchor: number) => void;
}) {
  const { settings } = useSettings();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const name = id === ADD_WIDGET_ID ? "Add widget" : (findWidget(id)?.name ?? id);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`dock-item ${isDragging ? "is-dragging" : ""} ${highlighted ? "is-highlighted" : ""}`}
      data-widget={id}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={name}
      aria-roledescription="dock widget"
      onClick={(event) => onActivate(id, anchorOf(event.currentTarget, vertical))}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onActivate(id, anchorOf(event.currentTarget, vertical));
        } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
          event.preventDefault();
          onMenu(id, anchorOf(event.currentTarget, vertical));
        } else {
          listeners?.onKeyDown?.(event);
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onMenu(id, anchorOf(event.currentTarget, vertical));
      }}
    >
      <TileContent id={id} size={settings.dock.size} compact={vertical} />
    </div>
  );
}

export function DockBar() {
  const { settings, update } = useSettings();
  const { dock } = settings;
  const vertical = dock.position === "left" || dock.position === "right";
  const trackRef = useRef<HTMLDivElement>(null);
  const memory = useRef<FlyoutMemory>({ openKind: null, hiddenKind: null, hiddenAt: 0 });
  const [highlight, setHighlight] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  useEffect(() => {
    const offs = [
      on("flyout:hidden", ({ kind, at }) => {
        memory.current = { openKind: null, hiddenKind: kind, hiddenAt: at };
      }),
      on("dock:highlight", (id) => setHighlight(id)),
      on("dock:fullscreen-visible", () => void applyDockLayout()),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  useEffect(() => {
    if (!highlight) return;
    const timer = window.setTimeout(() => setHighlight(null), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [highlight]);

  // Pills hug their widgets: tell the backend how long the content is.
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const report = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const shell = track.parentElement;
        const padding = shell
          ? vertical
            ? shell.offsetHeight - shell.clientHeight + 16
            : shell.offsetWidth - shell.clientWidth + 16
          : 16;
        const length = (vertical ? track.scrollHeight : track.scrollWidth) + padding;
        void setDockLength(length).catch(() => undefined);
      });
    };
    const observer = new ResizeObserver(report);
    observer.observe(track);
    Array.from(track.children).forEach((child) => observer.observe(child));
    report();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [vertical, dock.itemOrder, dock.size]);

  const open = (kind: string, anchor: number, target?: string) => {
    const key = flyoutKey(kind, target);
    const decision = decideTileClick(memory.current, key, Date.now());
    if (decision === "ignore") return;
    memory.current = { ...memory.current, openKind: key };
    void showFlyout({ kind, anchor, target: target ?? null });
  };

  const onActivate = (id: string, anchor: number) => {
    if (id === "start") {
      if (dock.startAction === "launcher") open("start", anchor);
      else void openStartMenu();
    } else if (id === ADD_WIDGET_ID) {
      void openHub("widgets");
    } else if (findWidget(id)?.panel) {
      open(id, anchor);
    }
  };

  const onMenu = (id: string | null, anchor: number) => {
    open("menu", anchor, id ?? undefined);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    void update((current) => ({
      ...current,
      dock: {
        ...current.dock,
        itemOrder: reorderDockItems(current.dock.itemOrder, String(active.id), String(over.id)),
      },
    }));
  };

  const onShellPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest(".dock-item")) return;
    void getCurrentWindow()
      .startDragging()
      .catch(() => undefined);
  };

  return (
    <div
      className={`dock-shell size-${dock.size} mode-${dock.mode} style-${dock.style} position-${dock.position} ${vertical ? "vertical" : "horizontal"}`}
      role="toolbar"
      aria-label="OpenDock"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      onPointerDown={onShellPointerDown}
      onContextMenu={(event) => {
        event.preventDefault();
        onMenu(null, vertical ? event.clientY : event.clientX);
      }}
    >
      <DockActionsContext.Provider value={{ openPanel: open, vertical }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={dock.itemOrder}
            strategy={vertical ? verticalListSortingStrategy : horizontalListSortingStrategy}
          >
            <div className="dock-track" ref={trackRef}>
              {dock.itemOrder.map((id) => (
                <DockItem
                  key={id}
                  id={id}
                  vertical={vertical}
                  highlighted={highlight === id}
                  onActivate={onActivate}
                  onMenu={onMenu}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </DockActionsContext.Provider>
    </div>
  );
}
