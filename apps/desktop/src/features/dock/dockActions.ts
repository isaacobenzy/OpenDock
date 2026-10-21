import { createContext, useContext } from "react";

export type DockActions = {
  /** Opens a panel above the dock, centred on `anchor` (dock-relative CSS px). */
  openPanel: (kind: string, anchor: number, target?: string) => void;
  vertical: boolean;
};

export const DockActionsContext = createContext<DockActions>({
  openPanel: () => undefined,
  vertical: false,
});

export function useDockActions(): DockActions {
  return useContext(DockActionsContext);
}

export function anchorOf(element: Element, vertical: boolean): number {
  const rect = element.getBoundingClientRect();
  return vertical ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
}
