"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role } from "@/lib/mock/fixtures";

interface AppState {
  /** Demo-mode "view app as" role — independent of the connected wallet's real on-chain
   * role, so a judge can see all 5 role views without 5 logins (brief §5). Every
   * role-gated nav item / action button reads this, not useAccount()/useHasRole(). */
  activeRole: Role;
  setActiveRole: (role: Role) => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeRole: "ADMIN",
      setActiveRole: (role) => set({ activeRole: role }),

      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: "bel-chain-app-store" }
  )
);
