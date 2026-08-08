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
import {
  defaultUserPreferences,
  userPreferencesSaveResultSchema,
  userPreferencesSchema,
  type UserPreferences
} from "@/lib/contracts/auth";

type PreferencePatch = Partial<UserPreferences>;
type PreferenceKey = keyof UserPreferences;

export type AppPreferencesContextValue = {
  preferences: UserPreferences;
  accountUserId: string | null;
  saveFailed: boolean;
  updatePreferences: (patch: PreferencePatch) => void;
  reconcileAccountPreferences: (
    userId: string | null,
    serverPreferences: UserPreferences | null
  ) => Promise<void>;
};

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null);
const ANONYMOUS_KEY = "aksa-preferences:anonymous";
const changedKeysKey = `${ANONYMOUS_KEY}:changed`;
const allPreferenceKeys = Object.keys(defaultUserPreferences) as PreferenceKey[];

function accountStorageKey(userId: string): string {
  return `aksa-preferences:${userId}`;
}

function readJson(key: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function readChangedKeys(): Set<PreferenceKey> {
  const value = readJson(changedKeysKey);
  if (!Array.isArray(value)) return new Set();
  return new Set(value.filter((key): key is PreferenceKey => allPreferenceKeys.includes(key as PreferenceKey)));
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local preference persistence is best effort when storage is unavailable.
  }
}

function readStoredPreferences(key: string, initialLocale: UserPreferences["language"]): UserPreferences {
  const stored = userPreferencesSchema.partial().safeParse(readJson(key));
  const legacyTheme = typeof window !== "undefined" ? window.localStorage.getItem("aksa-theme") : null;
  const legacySidebar = typeof window !== "undefined" ? window.localStorage.getItem("aksa-sidebar-collapsed") : null;
  const documentTheme =
    typeof document !== "undefined" &&
    (document.documentElement.dataset.theme === "dark" || document.documentElement.dataset.theme === "light")
      ? document.documentElement.dataset.theme
      : undefined;
  const scope = key === ANONYMOUS_KEY ? "anonymous" : key.replace("aksa-preferences:", "");
  const legacyVoice = readJson(`aksa-voice-controls:${scope}`);
  const legacyVoicePatch =
    legacyVoice && typeof legacyVoice === "object"
      ? {
          ...(typeof (legacyVoice as { enabled?: unknown }).enabled === "boolean"
            ? { voiceControlEnabled: (legacyVoice as { enabled: boolean }).enabled }
            : {}),
          ...((legacyVoice as { language?: unknown }).language === "follow" ||
          (legacyVoice as { language?: unknown }).language === "id" ||
          (legacyVoice as { language?: unknown }).language === "en"
            ? { voiceLanguage: (legacyVoice as { language: UserPreferences["voiceLanguage"] }).language }
            : {}),
          ...((legacyVoice as { mode?: unknown }).mode === "dictation" ||
          (legacyVoice as { mode?: unknown }).mode === "commands" ||
          (legacyVoice as { mode?: unknown }).mode === "both"
            ? { voiceMode: (legacyVoice as { mode: UserPreferences["voiceMode"] }).mode }
            : {})
        }
      : {};
  const legacyHeadPreset = typeof window !== "undefined" ? window.localStorage.getItem(`aksa-head-preset:${scope}`) : null;
  const legacyHeadPatch =
    legacyHeadPreset === "auto" ||
    legacyHeadPreset === "standard" ||
    legacyHeadPreset === "low_light" ||
    legacyHeadPreset === "custom"
      ? { headPreset: legacyHeadPreset as UserPreferences["headPreset"] }
      : {};

  return {
    ...defaultUserPreferences,
    language: initialLocale,
    ...(documentTheme ? { theme: documentTheme } : {}),
    ...legacyVoicePatch,
    ...legacyHeadPatch,
    ...(stored.success ? stored.data : {}),
    ...(legacyTheme === "dark" || legacyTheme === "light" ? { theme: legacyTheme } : {}),
    ...(legacySidebar === "true" || legacySidebar === "false"
      ? { sidebarCollapsed: legacySidebar === "true" }
      : {})
  };
}

function applyPreferencesToDom(preferences: UserPreferences): void {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.dataset.theme = preferences.theme;
  root.lang = preferences.language;
  root.classList.toggle("high-contrast", preferences.highContrast);
  root.classList.toggle("text-size-large", preferences.textSize === "large");
  root.classList.toggle("text-size-extra-large", preferences.textSize === "extra_large");
  root.classList.toggle("large-text", preferences.textSize !== "default");
  root.classList.toggle("reduce-motion", preferences.reducedMotion);

  try {
    window.localStorage.setItem("aksa-theme", preferences.theme);
    window.localStorage.setItem("aksa-sidebar-collapsed", String(preferences.sidebarCollapsed));
    document.cookie = `aksa-theme=${preferences.theme}; path=/; max-age=31536000; SameSite=Lax`;
    document.cookie = `PARAGLIDE_LOCALE=${preferences.language}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // The UI state remains active even if browser persistence is blocked.
  }
}

function mergeChangedPreferences(
  serverPreferences: UserPreferences,
  localPreferences: UserPreferences,
  changedKeys: Set<PreferenceKey>
): UserPreferences {
  const merged = { ...serverPreferences };
  for (const key of changedKeys) {
    Object.assign(merged, { [key]: localPreferences[key] });
  }
  return userPreferencesSchema.parse(merged);
}

async function savePreferencesToAccount(
  preferences: UserPreferences,
  onFailure: () => void,
  onSuccess: () => void
): Promise<void> {
  try {
    const response = await fetch("/api/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(preferences)
    });
    const payload: unknown = await response.json();
    const parsed = userPreferencesSaveResultSchema.safeParse(payload);
    if (!response.ok || !parsed.success || parsed.data.outcome !== "saved") {
      onFailure();
      return;
    }
    onSuccess();
  } catch {
    onFailure();
  }
}

export function PreferenceProvider({
  children,
  initialLocale = "en"
}: {
  children: ReactNode;
  initialLocale?: UserPreferences["language"];
}) {
  const [preferences, setPreferences] = useState<UserPreferences>(() =>
    readStoredPreferences(ANONYMOUS_KEY, initialLocale)
  );
  const [accountUserId, setAccountUserId] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const preferencesRef = useRef(preferences);
  const accountUserIdRef = useRef<string | null>(null);
  const hydratedRef = useRef(false);

  const commit = useCallback((next: UserPreferences, userId: string | null) => {
    preferencesRef.current = next;
    setPreferences(next);
    applyPreferencesToDom(next);
    writeJson(userId ? accountStorageKey(userId) : ANONYMOUS_KEY, next);
  }, []);

  useEffect(() => {
    if (hydratedRef.current) return;
    const stored = readStoredPreferences(ANONYMOUS_KEY, initialLocale);
    hydratedRef.current = true;
    commit(stored, null);
  }, [commit, initialLocale]);

  useEffect(() => {
    applyPreferencesToDom(preferences);
  }, [preferences]);

  const updatePreferences = useCallback(
    (patch: PreferencePatch) => {
      const next = userPreferencesSchema.parse({ ...preferencesRef.current, ...patch });
      const activeUserId = accountUserIdRef.current;
      commit(next, activeUserId);

      if (!activeUserId) {
        const changed = readChangedKeys();
        for (const key of Object.keys(patch) as PreferenceKey[]) changed.add(key);
        writeJson(changedKeysKey, [...changed]);
        return;
      }

      void savePreferencesToAccount(next, () => setSaveFailed(true), () => setSaveFailed(false));
    },
    [commit]
  );

  const reconcileAccountPreferences = useCallback(
    async (userId: string | null, serverPreferences: UserPreferences | null) => {
      if (!hydratedRef.current && typeof window !== "undefined") {
        const stored = readStoredPreferences(ANONYMOUS_KEY, initialLocale);
        commit(stored, null);
        hydratedRef.current = true;
      }

      if (!userId) {
        accountUserIdRef.current = null;
        setAccountUserId(null);
        const anonymous = readStoredPreferences(ANONYMOUS_KEY, initialLocale);
        commit(anonymous, null);
        return;
      }

      if (accountUserIdRef.current === userId && serverPreferences) {
        return;
      }

      const localPreferences = readStoredPreferences(ANONYMOUS_KEY, initialLocale);
      const changedKeys = readChangedKeys();
      const base = serverPreferences ?? readStoredPreferences(accountStorageKey(userId), initialLocale);
      const merged = mergeChangedPreferences(base, localPreferences, changedKeys);

      accountUserIdRef.current = userId;
      setAccountUserId(userId);
      commit(merged, userId);
      writeJson(accountStorageKey(userId), merged);

      if (changedKeys.size > 0) {
        writeJson(changedKeysKey, []);
        await savePreferencesToAccount(merged, () => setSaveFailed(true), () => setSaveFailed(false));
      }
    },
    [commit, initialLocale]
  );

  const value = useMemo<AppPreferencesContextValue>(
    () => ({
      preferences,
      accountUserId,
      saveFailed,
      updatePreferences,
      reconcileAccountPreferences
    }),
    [accountUserId, preferences, reconcileAccountPreferences, saveFailed, updatePreferences]
  );

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export function useOptionalAppPreferences(): AppPreferencesContextValue | null {
  return useContext(AppPreferencesContext);
}

export function useAppPreferences(): AppPreferencesContextValue {
  const value = useOptionalAppPreferences();
  if (!value) throw new Error("useAppPreferences must be used within PreferenceProvider");
  return value;
}
