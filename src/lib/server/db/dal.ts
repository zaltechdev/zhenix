import { eq, and, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { assertServerOnly } from "@/lib/server/server-guard";
import { db } from "@/lib/server/db/client";
import {
  users,
  workspaces,
  workspaceMembers,
  accessibilityProfiles,
  consentRecords
} from "@/lib/server/db/schema";
import { auth } from "@/lib/server/auth/better-auth";
import type { AccessibilityProfile, Session } from "@/lib/contracts/auth";
import { provisionalAccessibilityProfile } from "@/lib/contracts/auth";

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
      const wsName = userDisplayName ? `${userDisplayName}'s Workspace` : "Default Workspace";

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

/**
 * Saves/updates accessibility profile for an authenticated user.
 */
export async function saveAccessibilityProfile(
  userId: string,
  profileData: AccessibilityProfile
): Promise<AccessibilityProfile> {
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
    id: `cs_${userId}_${consentType}_${now}`,
    userId,
    consentType,
    granted: granted ? 1 : 0,
    policyVersion,
    grantedAt: granted ? now : null,
    revokedAt: granted ? null : now,
    createdAt: now
  });
}
