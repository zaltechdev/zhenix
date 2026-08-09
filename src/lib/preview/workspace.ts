import type { MailInbox, SheetRange } from "@/lib/contracts/google";
import type { SearchResult } from "@/lib/contracts/search";
import type { Locale } from "@/paraglide/runtime.js";

const PREVIEW_TIME = Date.UTC(2026, 7, 7, 9, 0, 0);

export function createPreviewSheetRange(locale: Locale): SheetRange {
  const isIndonesian = locale === "id";

  return {
    spreadsheetId: "preview-launch-plan",
    spreadsheetTitle: isIndonesian ? "Rencana peluncuran" : "Launch plan",
    sheets: [
      { sheetId: "overview", title: isIndonesian ? "Ringkasan" : "Overview" },
      { sheetId: "tasks", title: isIndonesian ? "Tugas" : "Tasks" }
    ],
    activeSheetId: "overview",
    a1Range: `${isIndonesian ? "Ringkasan" : "Overview"}!A1:D5`,
    majorDimension: "ROWS",
    columnHeaders: isIndonesian
      ? ["Tugas", "Pemilik", "Status", "Tenggat"]
      : ["Task", "Owner", "Status", "Due"],
    rowHeaders: ["1", "2", "3", "4"],
    formattedValues: isIndonesian
      ? [
          ["Tinjau naskah", "Maya", "Selesai", "8 Agu"],
          ["Periksa aksesibilitas", "Rafi", "Berjalan", "9 Agu"],
          ["Siapkan demo", "Nadia", "Siap", "10 Agu"],
          ["Kirim ringkasan", "Dimas", "Belum mulai", "11 Agu"]
        ]
      : [
          ["Review copy", "Maya", "Done", "Aug 8"],
          ["Check accessibility", "Rafi", "In progress", "Aug 9"],
          ["Prepare demo", "Nadia", "Ready", "Aug 10"],
          ["Send recap", "Dimas", "Not started", "Aug 11"]
        ],
    canEdit: false,
    truncated: false,
    rowLimit: 50,
    columnLimit: 20
  };
}

export function createPreviewMailInbox(locale: Locale): MailInbox {
  const isIndonesian = locale === "id";

  return {
    messages: [
      {
        id: "preview-mail-1",
        threadId: "preview-thread-1",
        senderDisplay: "Maya Putri",
        subject: isIndonesian ? "Catatan terakhir untuk demo" : "Final notes for the demo",
        receivedAt: PREVIEW_TIME,
        preview: isIndonesian
          ? "Alur Dokumen sudah siap. Mohon periksa konfirmasi dan riwayat sebelum presentasi."
          : "The Docs flow is ready. Please check confirmation and history before the presentation.",
        unread: true
      },
      {
        id: "preview-mail-2",
        threadId: "preview-thread-2",
        senderDisplay: "Rafi Akbar",
        subject: isIndonesian ? "Hasil pemeriksaan aksesibilitas" : "Accessibility review results",
        receivedAt: PREVIEW_TIME - 3_600_000,
        preview: isIndonesian
          ? "Navigasi papan ketik dan kontras sudah diperiksa pada tampilan desktop."
          : "Keyboard navigation and contrast have been checked on the desktop layout.",
        unread: false
      },
      {
        id: "preview-mail-3",
        threadId: "preview-thread-3",
        senderDisplay: "Nadia Sari",
        subject: isIndonesian ? "Jadwal presentasi" : "Presentation schedule",
        receivedAt: PREVIEW_TIME - 7_200_000,
        preview: isIndonesian
          ? "Presentasi dimulai pukul 10.00. Dokumen uji sudah tersedia di Drive."
          : "The presentation starts at 10:00. The test document is ready in Drive.",
        unread: false
      }
    ],
    nextPageToken: null
  };
}

export function createPreviewSearchResult(locale: Locale): SearchResult {
  const isIndonesian = locale === "id";
  const sourceId = "preview-source-1";
  const source = {
    id: sourceId,
    title: isIndonesian ? "Panduan kolaborasi yang mudah diakses" : "Accessible collaboration guide",
    publisher: "Aksa Preview Library",
    url: "https://example.com/aksa-preview/accessible-collaboration",
    domain: "example.com",
    publishedAt: PREVIEW_TIME - 86_400_000,
    retrievedAt: PREVIEW_TIME,
    snippet: isIndonesian
      ? "Daftar periksa singkat untuk pembagian tugas, peninjauan, dan akses papan ketik."
      : "A short checklist for task ownership, review, and keyboard access."
  };

  return {
    sources: [source],
    artifact: {
      id: "preview-search-artifact",
      taskId: "preview-search-task",
      kind: "search_summary",
      title: isIndonesian ? "Ringkasan hasil pratinjau" : "Preview result summary",
      blocks: [
        {
          type: "summary",
          text: isIndonesian
            ? "Tetapkan pemilik setiap tugas, gunakan tenggat yang jelas, dan periksa alur papan ketik sebelum pekerjaan dibagikan."
            : "Assign each task an owner, use clear due dates, and check keyboard flow before sharing the work.",
          citations: [sourceId]
        },
        {
          type: "key_point",
          text: isIndonesian
            ? "Catat keputusan di satu tempat agar tim tidak kehilangan konteks."
            : "Record decisions in one place so the team keeps its context.",
          citations: [sourceId]
        }
      ],
      sources: [source],
      language: isIndonesian ? "id" : "en",
      bodyFormat: "plain",
      retrievedAt: PREVIEW_TIME,
      createdAt: PREVIEW_TIME,
      truncated: false
    },
    retrievedAt: PREVIEW_TIME
  };
}
