import { describe, expect, it, vi } from "vitest";
import {
  matchAksaIntent,
  normalizeAksaTranscript,
  resolveAksaIntent
} from "@/lib/voice/intent-router";
import type { AksaIntent } from "@/lib/contracts/voice-intent";

const examples: Array<{ intent: AksaIntent; en: string; id: string }> = [
  { intent: "NAV_HOME", en: "go home", id: "buka beranda" },
  { intent: "NAV_DOCS", en: "open docs", id: "buka dokumen" },
  { intent: "NAV_SHEETS", en: "open sheets", id: "buka spreadsheet" },
  { intent: "NAV_DRIVE", en: "open drive", id: "buka drive" },
  { intent: "NAV_GMAIL", en: "open gmail", id: "buka gmail" },
  { intent: "NAV_WEB_SEARCH", en: "search the web", id: "cari di web" },
  { intent: "NAV_HISTORY", en: "open history", id: "buka riwayat" },
  { intent: "NAV_ACTIVITY", en: "show activity", id: "lihat aktivitas" },
  { intent: "NAV_ACCESSIBILITY", en: "open accessibility", id: "buka aksesibilitas" },
  { intent: "NAV_SETTINGS", en: "open settings", id: "buka pengaturan" },
  { intent: "NAV_ACCOUNT", en: "open account", id: "buka akun" },
  { intent: "HEAD_PAUSE", en: "pause pointer", id: "jeda pointer" },
  { intent: "HEAD_RESUME", en: "resume pointer", id: "lanjutkan pointer" },
  { intent: "HEAD_CALIBRATE", en: "recalibrate head control", id: "kalibrasi ulang kontrol kepala" },
  { intent: "SIDEBAR_COLLAPSE", en: "collapse sidebar", id: "ciutkan sidebar" },
  { intent: "SIDEBAR_EXPAND", en: "expand sidebar", id: "perluas sidebar" }
];

describe("Aksa deterministic voice router", () => {
  it.each(examples)("matches English $intent", ({ intent, en }) => {
    expect(matchAksaIntent(en, "en")).toBe(intent);
  });

  it.each(examples)("matches Indonesian $intent", ({ intent, id }) => {
    expect(matchAksaIntent(id, "id")).toBe(intent);
  });

  it("normalizes Unicode, punctuation, and repeated spaces", () => {
    expect(normalizeAksaTranscript("  OPEN\u00a0GMAIL!!! ")).toBe("open gmail");
    expect(matchAksaIntent("Open Gmail.", "en")).toBe("NAV_GMAIL");
  });

  it("does not guess unmatched text", () => {
    expect(matchAksaIntent("show me anything", "en")).toBeNull();
    expect(matchAksaIntent("buka dokumen saya sekarang", "id")).toBeNull();
  });

  it("executes deterministic matches without semantic routing", async () => {
    const semanticClassifier = vi.fn();

    await expect(
      resolveAksaIntent({
        locale: "en",
        semanticClassifier,
        transcript: "open gmail"
      })
    ).resolves.toEqual({ intent: "NAV_GMAIL", source: "deterministic" });
    expect(semanticClassifier).not.toHaveBeenCalled();
  });

  it("uses semantic fallback only after a deterministic miss", async () => {
    const semanticClassifier = vi.fn().mockResolvedValue("NAV_DOCS");

    await expect(
      resolveAksaIntent({
        locale: "en",
        semanticClassifier,
        transcript: "Could you show me my documents?"
      })
    ).resolves.toEqual({ intent: "NAV_DOCS", source: "semantic" });
    expect(semanticClassifier).toHaveBeenCalledOnce();
  });

  it("rejects malformed or unsupported semantic output", async () => {
    await expect(
      resolveAksaIntent({
        locale: "en",
        semanticClassifier: vi.fn().mockResolvedValue({ intent: "click_anything" }),
        transcript: "do something"
      })
    ).resolves.toEqual({ intent: "UNKNOWN", source: "unknown" });

    await expect(
      resolveAksaIntent({
        locale: "en",
        semanticClassifier: vi.fn().mockRejectedValue(new Error("offline")),
        transcript: "do something else"
      })
    ).resolves.toEqual({ intent: "UNKNOWN", source: "unknown" });
  });
});
