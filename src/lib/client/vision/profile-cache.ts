/**
 * Client IndexedDB cache for accessibility profile persistence.
 * Enables instant profile loading on client startup before server profile fetch resolves.
 * Never stores biometric data, raw camera frames, landmarks, or blendshapes.
 */

import { AccessibilityProfile } from "@/lib/contracts/auth";

const DB_NAME = "aksa_settings_cache";
const STORE_NAME = "accessibility_profile";
const KEY_NAME = "current_user_profile";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported in this environment"));
      return;
    }

    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedProfile(): Promise<AccessibilityProfile | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(KEY_NAME);

      request.onsuccess = () => {
        resolve((request.result as AccessibilityProfile) ?? null);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setCachedProfile(profile: AccessibilityProfile): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(profile, KEY_NAME);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Fail silently on cache write errors
  }
}
