import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  sidebarCollapsed: boolean;
  logDockExpanded: boolean;
  activeTab: string;

  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  toggleLogDock: () => void;
  setLogDockExpanded: (v: boolean) => void;
  setActiveTab: (tab: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      logDockExpanded: false,
      activeTab: "dashboard",

      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      toggleLogDock: () =>
        set((s) => ({ logDockExpanded: !s.logDockExpanded })),
      setLogDockExpanded: (v) => set({ logDockExpanded: v }),
      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    {
      name: "p2pclaw-ui",
      version: 1,
    },
  ),
);
