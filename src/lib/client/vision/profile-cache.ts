/**
 * Client IndexedDB cache for accessibility profile persistence.
 * Enables instant profile loading on client startup before server profile fetch resolves.
 * Includes in-memory fallback for test and non-IndexedDB environments.
 * Never stores biometric data, raw camera frames, landmarks, or blendshapes.
 */

import { AccessibilityProfile } from "@/lib/contracts/auth";

const DB_NAME = "aksa_settings_cache";
const STORE_NAME = "accessibility_profile";
const memoryCache = new Map<string, AccessibilityProfile>();

function getStoreKey(userId?: string | null): string {
  return `user_profile_${userId && userId.trim() !== "" ? userId.trim() : "default"}`;
}

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

export async function getCachedProfile(userId?: string | null): Promise<AccessibilityProfile | null> {
  const key = getStoreKey(userId);
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const val = (request.result as AccessibilityProfile) ?? memoryCache.get(key) ?? null;
        resolve(val);
      };
      request.onerror = () => resolve(memoryCache.get(key) ?? null);
    });
  } catch {
    return memoryCache.get(key) ?? null;
  }
}

export async function setCachedProfile(profile: AccessibilityProfile, userId?: string | null): Promise<void> {
  const key = getStoreKey(userId);
  memoryCache.set(key, profile);

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(profile, key);

      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  } catch {
    // Memory cache updated, ignore DB error
  }
}

export async function clearCachedProfile(userId?: string | null): Promise<void> {
  const key = getStoreKey(userId);
  memoryCache.delete(key);

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  } catch {
    // Memory cache cleared, ignore DB error
  }
}
