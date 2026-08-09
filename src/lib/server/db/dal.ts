import { eq, and, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { assertServerOnly } from "@/lib/server/server-guard";
import { db, ensureLocalSchema } from "@/lib/server/db/client";
import {
  users,
  workspaces,
  workspaceMembers,
  accessibilityProfiles,
  consentRecords,
  auditLogs
} from "@/lib/server/db/schema";
import { auth } from "@/lib/server/auth/better-auth";
import type { AccessibilityProfile, Session, UserPreferences } from "@/lib/contracts/auth";
import {
  defaultUserPreferences,
  provisionalAccessibilityProfile,
  userPreferencesSchema
} from "@/lib/contracts/auth";

assertServerOnly("src/lib/server/db/dal.ts");

/**
 * Idempotently bootstrap a user's default workspace and accessibility profile.
 * Guarantees every account has exactly 1 default workspace and 1 accessibility profile.
 */
export async function bootstrapUserWorkspaceAndProfile(
  userId: string,
  userEmail: string,
  userDisplayName?: string | null
): Promise<{ workspaceId: string }> {
  await ensureLocalSchema();
  const now = Date.now();

  // 1. Check or create workspace
  const existingUser = await db.query.users.findFirst({
    where: eq(users.id, userId)
  });

  let workspaceId = existingUser?.defaultWorkspaceId;

  if (!workspaceId) {
    const existingWs = await db.query.workspaces.findFirst({
      where: and(eq(workspaces.ownerUserId, userId), isNull(workspaces.deletedAt))
    });

    if (existingWs) {
      workspaceId = existingWs.id;
    } else {
      const newWsId = `ws_${userId.slice(0, 12)}_${now}`;
      const wsName = userDisplayName ? `${userDisplayName}'s Workspace` : "Workspace";

      await db.insert(workspaces).values({
        id: newWsId,
        ownerUserId: userId,
        name: wsName,
        createdAt: now,
        updatedAt: now
      });

      await db.insert(workspaceMembers).values({
        id: `wm_${newWsId}_${userId}`,
        workspaceId: newWsId,
        userId: userId,
        role: "owner",
        createdAt: now
      });

      workspaceId = newWsId;
    }

    if (existingUser) {
      await db.update(users).set({ defaultWorkspaceId: workspaceId, updatedAt: new Date() }).where(eq(users.id, userId));
    }
  }

  // 2. Check or create accessibility profile
  const existingProfile = await db.query.accessibilityProfiles.findFirst({
    where: eq(accessibilityProfiles.userId, userId)
  });

  if (!existingProfile) {
    await db.insert(accessibilityProfiles).values({
      id: `prof_${userId}`,
      userId: userId,
      pointerSensitivity: provisionalAccessibilityProfile.pointerSensitivity,
      deadZone: provisionalAccessibilityProfile.deadZone,
      smoothing: provisionalAccessibilityProfile.smoothing,
      selectionMode: provisionalAccessibilityProfile.selectionMode,
      dwellDurationMs: provisionalAccessibilityProfile.dwellDurationMs,
      gestureType: provisionalAccessibilityProfile.gestureType,
      gestureThreshold: provisionalAccessibilityProfile.gestureThreshold,
      gestureCooldownMs: provisionalAccessibilityProfile.gestureCooldownMs,
      reacquisitionPointerBehavior:
        provisionalAccessibilityProfile.reacquisitionPointerBehavior,
      reducedMotion: provisionalAccessibilityProfile.reducedMotion ? 1 : 0,
      uiPreferences: JSON.stringify(defaultUserPreferences),
      createdAt: now,
      updatedAt: now
    });
  }

  return { workspaceId };
}

/**
 * Resolves the authenticated session from request headers.
 */
export async function getSession(): Promise<Session | null> {
  try {
    const reqHeaders = await headers();
    const sessionRes = await auth.api.getSession({
      headers: reqHeaders
    });

    if (!sessionRes || !sessionRes.user || !sessionRes.session) {
      return null;
    }

    const { user, session } = sessionRes;
    const bootstrap = await bootstrapUserWorkspaceAndProfile(user.id, user.email, user.name);

    const userDb = await db.query.users.findFirst({
      where: eq(users.id, user.id)
    });

    return {
      userId: user.id,
      email: user.email,
      displayName: user.name ?? null,
      workspaceId: bootstrap.workspaceId,
      locale: (userDb?.locale as "en" | "id") || "en",
      expiresAt: new Date(session.expiresAt).getTime()
    };
  } catch {
    return null;
  }
}

/**
 * Reads the accessibility profile for an authenticated user.
 */
export async function getAccessibilityProfile(userId: string): Promise<AccessibilityProfile | null> {
  const profile = await db.query.accessibilityProfiles.findFirst({
    where: eq(accessibilityProfiles.userId, userId)
  });

  if (!profile) return null;

  return {
    pointerSensitivity: profile.pointerSensitivity,
    deadZone: profile.deadZone,
    smoothing: profile.smoothing,
    selectionMode: (profile.selectionMode as AccessibilityProfile["selectionMode"]) || "dwell",
    dwellDurationMs: profile.dwellDurationMs,
    gestureType: (profile.gestureType as AccessibilityProfile["gestureType"]) || null,
    gestureThreshold: profile.gestureThreshold,
    gestureCooldownMs: profile.gestureCooldownMs,
    reacquisitionPointerBehavior:
      (profile.reacquisitionPointerBehavior as AccessibilityProfile["reacquisitionPointerBehavior"]) ||
      "keep_position",
    reducedMotion: Boolean(profile.reducedMotion)
  };
}

function storedUserPreferences(value: unknown): Partial<UserPreferences> {
  if (typeof value !== "string" || value.trim() === "") return {};

  try {
    const parsed: unknown = JSON.parse(value);
    const result = userPreferencesSchema.partial().safeParse(parsed);
    return result.success ? result.data : {};
  } catch {
    return {};
  }
}

/** Reads presentation and control-availability preferences for the session owner. */
export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  await ensureLocalSchema();
  const [profile, user] = await Promise.all([
    db.query.accessibilityProfiles.findFirst({
      where: eq(accessibilityProfiles.userId, userId)
    }),
    db.query.users.findFirst({
      where: eq(users.id, userId)
    })
  ]);
  const stored = storedUserPreferences(profile?.uiPreferences);

  return {
    ...defaultUserPreferences,
    ...stored,
    language:
      user?.locale === "id" ? "id" : user?.locale === "en" ? "en" : stored.language ?? "en",
    reducedMotion: profile ? Boolean(profile.reducedMotion) : Boolean(stored.reducedMotion)
  };
}

/** Saves presentation and control-availability preferences for the session owner. */
export async function saveUserPreferences(
  userId: string,
  preferences: UserPreferences
): Promise<UserPreferences> {
  await ensureLocalSchema();
  const parsed = userPreferencesSchema.parse(preferences);
  const now = Date.now();
  const existing = await db.query.accessibilityProfiles.findFirst({
    where: eq(accessibilityProfiles.userId, userId)
  });

  if (existing) {
    await db
      .update(accessibilityProfiles)
      .set({
        reducedMotion: parsed.reducedMotion ? 1 : 0,
        uiPreferences: JSON.stringify(parsed),
        updatedAt: now
      })
      .where(eq(accessibilityProfiles.userId, userId));
  } else {
    await db.insert(accessibilityProfiles).values({
      id: `prof_${userId}`,
      userId,
      pointerSensitivity: provisionalAccessibilityProfile.pointerSensitivity,
      deadZone: provisionalAccessibilityProfile.deadZone,
      smoothing: provisionalAccessibilityProfile.smoothing,
      selectionMode: provisionalAccessibilityProfile.selectionMode,
      dwellDurationMs: provisionalAccessibilityProfile.dwellDurationMs,
      gestureType: provisionalAccessibilityProfile.gestureType,
      gestureThreshold: provisionalAccessibilityProfile.gestureThreshold,
      gestureCooldownMs: provisionalAccessibilityProfile.gestureCooldownMs,
      reacquisitionPointerBehavior: provisionalAccessibilityProfile.reacquisitionPointerBehavior,
      reducedMotion: parsed.reducedMotion ? 1 : 0,
      uiPreferences: JSON.stringify(parsed),
      createdAt: now,
      updatedAt: now
    });
  }

  await db
    .update(users)
    .set({ locale: parsed.language, updatedAt: new Date(now) })
    .where(eq(users.id, userId));

  return getUserPreferences(userId);
}

/**
 * Saves/updates accessibility profile for an authenticated user.
 */
export async function saveAccessibilityProfile(
  userId: string,
  profileData: AccessibilityProfile
): Promise<AccessibilityProfile> {
  await ensureLocalSchema();
  const now = Date.now();
  const existing = await db.query.accessibilityProfiles.findFirst({
    where: eq(accessibilityProfiles.userId, userId)
  });

  if (existing) {
    await db
      .update(accessibilityProfiles)
      .set({
        pointerSensitivity: profileData.pointerSensitivity,
        deadZone: profileData.deadZone,
        smoothing: profileData.smoothing,
        selectionMode: profileData.selectionMode,
        dwellDurationMs: profileData.dwellDurationMs,
        gestureType: profileData.gestureType,
        gestureThreshold: profileData.gestureThreshold,
        gestureCooldownMs: profileData.gestureCooldownMs,
        reacquisitionPointerBehavior: profileData.reacquisitionPointerBehavior,
        reducedMotion: profileData.reducedMotion ? 1 : 0,
        uiPreferences: JSON.stringify({
          ...defaultUserPreferences,
          ...storedUserPreferences(existing.uiPreferences),
          reducedMotion: profileData.reducedMotion
        }),
        updatedAt: now
      })
      .where(eq(accessibilityProfiles.userId, userId));
  } else {
    await db.insert(accessibilityProfiles).values({
      id: `prof_${userId}`,
      userId,
      pointerSensitivity: profileData.pointerSensitivity,
      deadZone: profileData.deadZone,
      smoothing: profileData.smoothing,
      selectionMode: profileData.selectionMode,
      dwellDurationMs: profileData.dwellDurationMs,
      gestureType: profileData.gestureType,
      gestureThreshold: profileData.gestureThreshold,
      gestureCooldownMs: profileData.gestureCooldownMs,
      reacquisitionPointerBehavior: profileData.reacquisitionPointerBehavior,
      reducedMotion: profileData.reducedMotion ? 1 : 0,
      uiPreferences: JSON.stringify({
        ...defaultUserPreferences,
        reducedMotion: profileData.reducedMotion
      }),
      createdAt: now,
      updatedAt: now
    });
  }

  return (await getAccessibilityProfile(userId))!;
}

/**
 * Record camera or microphone consent independently.
 */
export async function recordConsent(
  userId: string,
  consentType: "camera" | "microphone" | "grounded_search" | "google_connection",
  granted: boolean,
  policyVersion = "1.0"
): Promise<void> {
  const now = Date.now();
  await db.insert(consentRecords).values({
    id: `cs_${crypto.randomUUID()}`,
    userId,
    consentType,
    granted: granted ? 1 : 0,
    policyVersion,
    grantedAt: granted ? now : null,
    revokedAt: granted ? null : now,
    createdAt: now
  });
}

/** Records a redacted security event without provider payloads or user content. */
export async function recordAuditLog(input: {
  userId: string;
  workspaceId?: string | null;
  eventType: string;
  subjectType?: string | null;
  subjectId?: string | null;
  detail?: string | null;
}): Promise<void> {
  await db.insert(auditLogs).values({
    id: `audit_${crypto.randomUUID()}`,
    userId: input.userId,
    workspaceId: input.workspaceId ?? null,
    eventType: input.eventType,
    subjectType: input.subjectType ?? null,
    subjectId: input.subjectId ?? null,
    detail: input.detail ?? null,
    createdAt: Date.now()
  });
}
