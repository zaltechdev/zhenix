"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode
} from "react";
import { useRouter } from "next/navigation";
import type { AksaIntent } from "@/lib/contracts/voice-intent";
import { executeAksaIntent as dispatchAksaIntent } from "@/lib/client/actions/aksa-action-dispatcher";
import { useHeadControl } from "@/lib/client/vision/head-control-context";

const SIDEBAR_PREFERENCE_KEY = "aksa-sidebar-collapsed";
const SIDEBAR_PREFERENCE_EVENT = "aksa-sidebar-preference";
let sidebarPreferenceFallback = false;

function getSidebarPreferenceSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = window.localStorage.getItem(SIDEBAR_PREFERENCE_KEY);
    return stored === null ? sidebarPreferenceFallback : stored === "true";
  } catch {
    return sidebarPreferenceFallback;
  }
}

function subscribeToSidebarPreference(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(SIDEBAR_PREFERENCE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SIDEBAR_PREFERENCE_EVENT, onChange);
  };
}

export type AksaActionContextValue = {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  calibrationOpen: boolean;
  closeCalibration: () => void;
  executeAksaIntent: (intent: AksaIntent) => AksaIntent;
};

const AksaActionContext = createContext<AksaActionContextValue | null>(null);

export function WorkspaceActionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const headControl = useHeadControl();
  const { pauseControl, resumeControl } = headControl;
  const sidebarCollapsed = useSyncExternalStore(
    subscribeToSidebarPreference,
    getSidebarPreferenceSnapshot,
    () => false
  );
  const [calibrationOpen, setCalibrationOpen] = useState(false);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    sidebarPreferenceFallback = collapsed;
    try {
      window.localStorage.setItem(SIDEBAR_PREFERENCE_KEY, String(collapsed));
    } catch {
      // Preference storage is optional and must never block workspace controls.
    }
    window.dispatchEvent(new Event(SIDEBAR_PREFERENCE_EVENT));
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(!sidebarCollapsed);
  }, [setSidebarCollapsed, sidebarCollapsed]);

  const closeCalibration = useCallback(() => {
    setCalibrationOpen(false);
  }, []);

  const openHeadCalibration = useCallback(() => {
    setCalibrationOpen(true);
  }, []);

  const pauseHeadControl = useCallback(() => {
    setCalibrationOpen(false);
    pauseControl();
  }, [pauseControl]);

  const executeAksaIntent = useCallback(
    (intent: AksaIntent) =>
      dispatchAksaIntent(intent, {
        navigate: (route) => router.push(route as never),
        pauseHeadControl,
        resumeHeadControl: resumeControl,
        openHeadCalibration,
        setSidebarCollapsed
      }),
    [openHeadCalibration, pauseHeadControl, resumeControl, router, setSidebarCollapsed]
  );

  const value = useMemo<AksaActionContextValue>(
    () => ({
      sidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebar,
      calibrationOpen,
      closeCalibration,
      executeAksaIntent
    }),
    [calibrationOpen, closeCalibration, executeAksaIntent, setSidebarCollapsed, sidebarCollapsed, toggleSidebar]
  );

  return <AksaActionContext.Provider value={value}>{children}</AksaActionContext.Provider>;
}

export function useAksaActions(): AksaActionContextValue {
  const context = useContext(AksaActionContext);
  if (!context) {
    throw new Error("useAksaActions must be used within a WorkspaceActionProvider");
  }
  return context;
}

export function useOptionalAksaActions(): AksaActionContextValue | null {
  return useContext(AksaActionContext);
}
