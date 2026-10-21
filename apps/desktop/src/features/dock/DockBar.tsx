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
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { AppSettings } from "@opendock/config-schema";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AddWidgetButton } from "./AddWidgetButton";
import { ClockWidget } from "./ClockWidget";
import { DockContextMenu } from "./DockContextMenu";
import { applyDockLayout, quitApp, saveSettings } from "../../services/ipc";
import "./dock.css";

type Props = {
  settings: AppSettings;
  onSettingsChange: (next: AppSettings) => void;
};

function SortableItem({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="sortable-wrap">
      {children}
    </div>
  );
}

export function DockBar({ settings, onSettingsChange }: Props) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const persist = useCallback(
    async (next: AppSettings) => {
      onSettingsChange(next);
      const saved = await saveSettings(next);
      onSettingsChange(saved);
    },
    [onSettingsChange],
  );

  useEffect(() => {
    const onResize = () => {
      void applyDockLayout();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = settings.dock.itemOrder.indexOf(String(active.id));
    const newIndex = settings.dock.itemOrder.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }
    const itemOrder = arrayMove(settings.dock.itemOrder, oldIndex, newIndex);
    void persist({ ...settings, dock: { ...settings.dock, itemOrder } });
  };

  const onContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY });
  };

  const startDragWindow = async (event: React.MouseEvent) => {
    if (event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest("button, input, .sortable-wrap")) {
      return;
    }
    await getCurrentWindow().startDragging();
  };

  const renderItem = (id: string) => {
    if (id === "clock") {
      return <ClockWidget use24h={settings.dock.clock24h} />;
    }
    if (id === "add-widget") {
      return <AddWidgetButton onClick={() => undefined} />;
    }
    return (
      <div className="dock-item unknown" aria-label={`Unknown widget ${id}`}>
        {id}
      </div>
    );
  };

  const isVertical = settings.dock.position === "left" || settings.dock.position === "right";

  return (
    <div
      className={`dock-shell size-${settings.dock.size} mode-${settings.dock.mode} ${isVertical ? "vertical" : "horizontal"}`}
      data-theme={settings.dock.theme}
      data-glass={window.matchMedia("(backdrop-filter: blur(1px))").matches ? "on" : "off"}
      onContextMenu={onContextMenu}
      onMouseDown={startDragWindow}
      role="toolbar"
      aria-label="OpenDock bar"
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext
          items={settings.dock.itemOrder}
          strategy={horizontalListSortingStrategy}
        >
          <div className="dock-track">
            {settings.dock.itemOrder.map((id) => (
              <SortableItem key={id} id={id}>
                {renderItem(id)}
              </SortableItem>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {menu ? (
        <DockContextMenu
          x={menu.x}
          y={menu.y}
          settings={settings}
          onChange={(next) => void persist(next)}
          onClose={() => setMenu(null)}
          onQuit={() => void quitApp()}
        />
      ) : null}
    </div>
  );
}
