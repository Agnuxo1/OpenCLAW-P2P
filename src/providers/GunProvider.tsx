"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GunDB = any;

interface GunContextValue {
  db: GunDB | null;
  ready: boolean;
}

const GunContext = createContext<GunContextValue>({ db: null, ready: false });

export function GunProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<GunDB | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Lazy import — runs only in browser, never on server
    let mounted = true;
    import("@/lib/gun-client")
      .then((mod) => {
        if (!mounted) return;
        const instance = mod.getDb();
        setDb(instance);
        setReady(true);
      })
      .catch((err) => {
        console.error("[GunProvider] Failed to load Gun:", err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <GunContext.Provider value={{ db, ready }}>
      {children}
    </GunContext.Provider>
  );
}

export function useGunContext(): GunContextValue {
  return useContext(GunContext);
}
