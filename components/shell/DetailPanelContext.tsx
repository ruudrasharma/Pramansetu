"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { AuditEvent } from "@/lib/mock-data";

/**
 * DetailPanelContext — app-wide state for the slide-in right detail panel.
 * Any component can call openPanel(event) to show the decoded event payload.
 * The panel itself is rendered once in layout and slides in from the right,
 * keeping the primary content visible (UI_UX_SPEC.md §1 Layout Shape).
 */
interface DetailPanelState {
  event: AuditEvent | null;
  isOpen: boolean;
  openPanel: (event: AuditEvent) => void;
  closePanel: () => void;
}

const DetailPanelContext = createContext<DetailPanelState>({
  event: null,
  isOpen: false,
  openPanel: () => {},
  closePanel: () => {},
});

export function DetailPanelProvider({ children }: { children: ReactNode }) {
  const [event, setEvent] = useState<AuditEvent | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openPanel = useCallback((e: AuditEvent) => {
    setEvent(e);
    setIsOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <DetailPanelContext.Provider value={{ event, isOpen, openPanel, closePanel }}>
      {children}
    </DetailPanelContext.Provider>
  );
}

export function useDetailPanel() {
  return useContext(DetailPanelContext);
}
