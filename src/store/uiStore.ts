import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  sidebarCollapsed: boolean;
  /** Off-canvas navigation on small screens; never persisted. */
  mobileNavOpen: boolean;
  logDockExpanded: boolean;
  activeTab: string;

  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setMobileNavOpen: (v: boolean) => void;
  toggleLogDock: () => void;
  setLogDockExpanded: (v: boolean) => void;
  setActiveTab: (tab: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileNavOpen: false,
      logDockExpanded: false,
      activeTab: "dashboard",

      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setMobileNavOpen: (v) => set({ mobileNavOpen: v }),
      toggleLogDock: () =>
        set((s) => ({ logDockExpanded: !s.logDockExpanded })),
      setLogDockExpanded: (v) => set({ logDockExpanded: v }),
      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    {
      name: "p2pclaw-ui",
      version: 1,
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        logDockExpanded: s.logDockExpanded,
        activeTab: s.activeTab,
      }),
    },
  ),
);
