"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role } from "@/lib/mock/fixtures";

interface AppState {
  /** Demo-mode "view app as" role — independent of the connected wallet's real on-chain
   * role, so a judge can see all 5 role views without 5 logins (brief §5). Mock-mode-only:
   * in onchain mode this is ignored for "who am I" purposes (identity, role display) in
   * favor of the real connected wallet — see lib/hooks/useCurrentIdentity.ts — since none
   * of the 5 fixture personas correspond to a real registered identity on the deployed
   * contract. Still used as-is by services not yet migrated off it (rbac/asset/governance,
   * pending Phase B.2-B.4). */
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
