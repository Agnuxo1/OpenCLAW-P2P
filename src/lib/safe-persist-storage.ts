import { createJSONStorage } from "zustand/middleware";

// Browser storage is optional: a full quota must not break React state updates.
export const safePersistStorage = createJSONStorage(() => ({
  getItem: (name: string) => {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      // The store remains usable in memory.
    }
  },
  removeItem: (name: string) => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      // Storage may be disabled or unavailable.
    }
  },
}));
