"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import type { Locale } from "@/paraglide/runtime.js";
import { useOptionalAppPreferences } from "@/lib/client/preferences/preference-context";

export type VoiceLanguage = "follow" | "id" | "en";
export type VoiceMode = "dictation" | "commands" | "both";

export type VoiceControlSettings = {
  enabled: boolean;
  language: VoiceLanguage;
  mode: VoiceMode;
};

type VoiceControlContextValue = {
  settings: VoiceControlSettings;
  updateSettings: (changes: Partial<VoiceControlSettings>) => void;
  saveFailed: boolean;
};

export const defaultVoiceControlSettings: VoiceControlSettings = {
  enabled: true,
  language: "follow",
  mode: "both"
};

const STORAGE_PREFIX = "aksa-voice-controls";
const VOICE_SETTINGS_AUTOSAVE_DELAY_MS = 350;
const VoiceControlContext = createContext<VoiceControlContextValue | null>(null);

function storageKey(userId: string | null): string {
  return `${STORAGE_PREFIX}:${userId ?? "anonymous"}`;
}

function isVoiceControlSettings(value: unknown): value is VoiceControlSettings {
  if (!value || typeof value !== "object") return false;
  const settings = value as Partial<VoiceControlSettings>;
  return (
    typeof settings.enabled === "boolean" &&
    (settings.language === "follow" || settings.language === "id" || settings.language === "en") &&
    (settings.mode === "dictation" || settings.mode === "commands" || settings.mode === "both")
  );
}

export function recognitionLocale(settings: VoiceControlSettings, pageLocale: Locale): "id" | "en" {
  if (settings.language === "id" || settings.language === "en") return settings.language;
  return pageLocale === "id" ? "id" : "en";
}

export function VoiceControlProvider({
  children,
  userId
}: {
  children: ReactNode;
  userId: string | null;
}) {
  const [settings, setSettings] = useState<VoiceControlSettings>(() => {
    if (typeof window === "undefined") return defaultVoiceControlSettings;
    try {
      const stored = window.localStorage.getItem(storageKey(userId));
      const parsed: unknown = stored ? JSON.parse(stored) : null;
      return isVoiceControlSettings(parsed) ? parsed : defaultVoiceControlSettings;
    } catch {
      return defaultVoiceControlSettings;
    }
  });
  const [saveFailed, setSaveFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appPreferences = useOptionalAppPreferences();

  const sharedSettings: VoiceControlSettings | null = appPreferences
    ? {
        enabled: appPreferences.preferences.voiceControlEnabled,
        language: appPreferences.preferences.voiceLanguage,
        mode: appPreferences.preferences.voiceMode
      }
    : null;

  const activeSettings = sharedSettings ?? settings;

  useEffect(() => {
    if (appPreferences) return;
    if (timerRef.current !== null) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey(userId), JSON.stringify(settings));
        setSaveFailed(false);
      } catch {
        setSaveFailed(true);
      }
    }, VOICE_SETTINGS_AUTOSAVE_DELAY_MS);

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [appPreferences, settings, userId]);

  const updateSettings = useCallback(
    (changes: Partial<VoiceControlSettings>) => {
      if (appPreferences) {
        appPreferences.updatePreferences({
          ...(changes.enabled === undefined ? {} : { voiceControlEnabled: changes.enabled }),
          ...(changes.language === undefined ? {} : { voiceLanguage: changes.language }),
          ...(changes.mode === undefined ? {} : { voiceMode: changes.mode })
        });
      } else {
        setSettings((current) => ({ ...current, ...changes }));
        setSaveFailed(false);
      }
    },
    [appPreferences]
  );

  const value = useMemo(
    () => ({ settings: activeSettings, updateSettings, saveFailed: appPreferences?.saveFailed ?? saveFailed }),
    [activeSettings, appPreferences?.saveFailed, saveFailed, updateSettings]
  );

  return <VoiceControlContext.Provider value={value}>{children}</VoiceControlContext.Provider>;
}

export function useVoiceControls(): VoiceControlContextValue {
  const context = useContext(VoiceControlContext);
  if (!context) {
    throw new Error("useVoiceControls must be used inside VoiceControlProvider.");
  }
  return context;
}

export function useOptionalVoiceControls(): VoiceControlContextValue | null {
  return useContext(VoiceControlContext);
}
